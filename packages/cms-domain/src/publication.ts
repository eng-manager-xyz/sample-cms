import { canonicalHash, canonicalJson } from './hash';
import type { JsonValue, ResolvedDocument } from './types';

export type PublicationErrorCode =
  | 'DUPLICATE_PAGE_ID'
  | 'DUPLICATE_CANONICAL_URL'
  | 'BLOCK_VERSION_ID_COLLISION';

export class PublicationError extends Error {
  readonly code: PublicationErrorCode;

  constructor(code: PublicationErrorCode, message: string) {
    super(message);
    this.name = 'PublicationError';
    this.code = code;
  }
}

export interface PublicationPageInput {
  readonly pageId: string;
  readonly canonicalUrl: string;
  readonly document: ResolvedDocument;
}

export interface ManifestPlacement {
  readonly placementKey: string;
  readonly order: number;
  readonly blockType: string;
  readonly blockVersionId: string;
}

export interface DocumentManifest {
  readonly id: string;
  readonly hash: string;
  readonly templateId: string;
  readonly placements: readonly ManifestPlacement[];
}

export interface PublishedPageDocument {
  readonly pageId: string;
  readonly canonicalUrl: string;
  readonly templateId: string;
  readonly manifestId: string;
  readonly manifestHash: string;
  readonly effectiveDocumentHash: string;
}

export interface ManifestReuse {
  readonly manifestId: string;
  readonly pageCount: number;
}

export interface PublicationMetrics {
  readonly pageCount: number;
  readonly uniqueManifestCount: number;
  readonly reusedPageCount: number;
  readonly manifestReuseRatio: number;
  readonly deduplicatedPageRatio: number;
  readonly expandedPlacementCount: number;
  readonly storedPlacementCount: number;
  readonly savedPlacementCount: number;
  readonly savedPlacementRatio: number;
  readonly expandedManifestBytes: number;
  readonly storedManifestBytes: number;
  readonly savedManifestBytes: number;
  readonly manifestReuse: readonly ManifestReuse[];
}

export interface CompiledPublication {
  readonly hash: string;
  readonly manifests: readonly DocumentManifest[];
  readonly pages: readonly PublishedPageDocument[];
  readonly metrics: PublicationMetrics;
}

function manifestValue(document: ResolvedDocument): JsonValue {
  return {
    templateId: document.templateId,
    placements: document.placements.map((placement) => ({
      placementKey: placement.placementKey,
      order: placement.order,
      blockType: placement.blockVersion.blockType,
      blockVersionId: placement.blockVersion.id,
    })),
  };
}

export function createDocumentManifest(document: ResolvedDocument): DocumentManifest {
  const value = manifestValue(document);
  const hash = canonicalHash(value);
  return {
    id: `manifest:${hash}`,
    hash,
    templateId: document.templateId,
    placements: document.placements.map((placement) => ({
      placementKey: placement.placementKey,
      order: placement.order,
      blockType: placement.blockVersion.blockType,
      blockVersionId: placement.blockVersion.id,
    })),
  };
}

function blockVersionFingerprint(document: ResolvedDocument): readonly [string, string][] {
  return document.placements.map((placement) => [
    placement.blockVersion.id,
    canonicalHash({
      lineageId: placement.blockVersion.lineageId,
      blockType: placement.blockVersion.blockType,
      schemaVersion: placement.blockVersion.schemaVersion,
      content: placement.blockVersion.content,
    }),
  ]);
}

function assertPublicationInputs(pages: readonly PublicationPageInput[]): void {
  const pageIds = new Set<string>();
  const urls = new Set<string>();
  const blockVersions = new Map<string, string>();
  for (const page of pages) {
    if (pageIds.has(page.pageId)) {
      throw new PublicationError('DUPLICATE_PAGE_ID', `Duplicate page ID "${page.pageId}".`);
    }
    if (urls.has(page.canonicalUrl)) {
      throw new PublicationError(
        'DUPLICATE_CANONICAL_URL',
        `Canonical URL "${page.canonicalUrl}" maps to more than one page.`
      );
    }
    pageIds.add(page.pageId);
    urls.add(page.canonicalUrl);

    for (const [versionId, fingerprint] of blockVersionFingerprint(page.document)) {
      const existing = blockVersions.get(versionId);
      if (existing !== undefined && existing !== fingerprint) {
        throw new PublicationError(
          'BLOCK_VERSION_ID_COLLISION',
          `Immutable block version "${versionId}" has more than one value.`
        );
      }
      blockVersions.set(versionId, fingerprint);
    }
  }
}

function calculateMetrics(
  sourcePages: readonly PublicationPageInput[],
  manifests: readonly DocumentManifest[],
  publishedPages: readonly PublishedPageDocument[]
): PublicationMetrics {
  const pageCount = sourcePages.length;
  const uniqueManifestCount = manifests.length;
  const expandedPlacementCount = sourcePages.reduce(
    (total, page) => total + page.document.placements.length,
    0
  );
  const storedPlacementCount = manifests.reduce(
    (total, manifest) => total + manifest.placements.length,
    0
  );
  const savedPlacementCount = expandedPlacementCount - storedPlacementCount;
  const reuseCounts = new Map<string, number>();
  for (const page of publishedPages) {
    reuseCounts.set(page.manifestId, (reuseCounts.get(page.manifestId) ?? 0) + 1);
  }
  const manifestReuse = [...reuseCounts.entries()]
    .map(([manifestId, count]) => ({ manifestId, pageCount: count }))
    .sort(
      (left, right) =>
        right.pageCount - left.pageCount || left.manifestId.localeCompare(right.manifestId)
    );
  const manifestBytes = new Map(
    manifests.map((manifest) => [
      manifest.id,
      new TextEncoder().encode(
        canonicalJson({
          templateId: manifest.templateId,
          placements: manifest.placements.map((placement) => ({
            placementKey: placement.placementKey,
            order: placement.order,
            blockType: placement.blockType,
            blockVersionId: placement.blockVersionId,
          })),
        })
      ).byteLength,
    ])
  );
  const expandedManifestBytes = publishedPages.reduce(
    (total, page) => total + (manifestBytes.get(page.manifestId) ?? 0),
    0
  );
  const storedManifestBytes = [...manifestBytes.values()].reduce(
    (total, byteLength) => total + byteLength,
    0
  );

  return {
    pageCount,
    uniqueManifestCount,
    reusedPageCount: pageCount - uniqueManifestCount,
    manifestReuseRatio: uniqueManifestCount === 0 ? 0 : pageCount / uniqueManifestCount,
    deduplicatedPageRatio: pageCount === 0 ? 0 : (pageCount - uniqueManifestCount) / pageCount,
    expandedPlacementCount,
    storedPlacementCount,
    savedPlacementCount,
    savedPlacementRatio:
      expandedPlacementCount === 0 ? 0 : savedPlacementCount / expandedPlacementCount,
    expandedManifestBytes,
    storedManifestBytes,
    savedManifestBytes: expandedManifestBytes - storedManifestBytes,
    manifestReuse,
  };
}

/** Deduplicates immutable structural manifests and emits stable page pointers plus measurements. */
export function compilePublication(
  pageInputs: readonly PublicationPageInput[]
): CompiledPublication {
  assertPublicationInputs(pageInputs);
  const sourcePages = [...pageInputs].sort(
    (left, right) =>
      left.canonicalUrl.localeCompare(right.canonicalUrl) || left.pageId.localeCompare(right.pageId)
  );
  const manifestsByHash = new Map<string, DocumentManifest>();
  const pages: PublishedPageDocument[] = [];
  for (const page of sourcePages) {
    const manifest = createDocumentManifest(page.document);
    manifestsByHash.set(manifest.hash, manifestsByHash.get(manifest.hash) ?? manifest);
    pages.push({
      pageId: page.pageId,
      canonicalUrl: page.canonicalUrl,
      templateId: page.document.templateId,
      manifestId: manifest.id,
      manifestHash: manifest.hash,
      effectiveDocumentHash: page.document.contentHash,
    });
  }
  const manifests = [...manifestsByHash.values()].sort((left, right) =>
    left.hash.localeCompare(right.hash)
  );
  const metrics = calculateMetrics(sourcePages, manifests, pages);
  const hash = canonicalHash({
    manifests: manifests.map((manifest) => ({ id: manifest.id, hash: manifest.hash })),
    pages: pages.map((page) => ({
      pageId: page.pageId,
      canonicalUrl: page.canonicalUrl,
      templateId: page.templateId,
      manifestHash: page.manifestHash,
      effectiveDocumentHash: page.effectiveDocumentHash,
    })),
  });
  return { hash, manifests, pages, metrics };
}

export function measureManifestDeduplication(
  pageInputs: readonly PublicationPageInput[]
): PublicationMetrics {
  return compilePublication(pageInputs).metrics;
}
