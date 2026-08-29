import type { JsonObject, JsonValue, ResolvedDocument, SelectorExpression } from '@repo/cms-domain';

export type RouteStatus = 'live' | 'not_live' | 'archived';
export type ProvenanceSource = 'pipeline' | 'author' | 'seed';

export interface TemplateInput {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly domain: string;
  readonly urlPattern: string;
  readonly description?: string;
  readonly status?: 'active' | 'archived';
}

export interface TemplateRecord {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly domain: string;
  readonly urlPattern: string;
  readonly description: string;
  readonly status: 'active' | 'archived';
  readonly routeAuthority: 'camo_press';
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TemplateSlotInput {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly kind: 'static' | 'variable' | 'derived';
  readonly pathPosition?: number | null;
  readonly staticValue?: string | null;
  readonly valueType?: 'string' | 'integer' | 'boolean';
  readonly isRequired?: boolean;
}

export interface TemplateSlotRecord {
  readonly id: string;
  readonly templateId: string;
  readonly key: string;
  readonly label: string;
  readonly kind: TemplateSlotInput['kind'];
  readonly pathPosition: number | null;
  readonly staticValue: string | null;
  readonly valueType: NonNullable<TemplateSlotInput['valueType']>;
  readonly isRequired: boolean;
  readonly createdAt: string;
}

export interface PageInput {
  readonly id: string;
  readonly canonicalUrl: string;
  readonly routeExternalId: string;
  readonly routeStatus: RouteStatus;
  readonly routeRevision: string;
  readonly context: JsonObject;
  readonly slotValues: Readonly<Record<string, string | number | boolean>>;
  readonly lastIngestionId?: string | null;
}

export interface PageRecord {
  readonly id: string;
  readonly templateId: string;
  readonly canonicalUrl: string;
  readonly routeExternalId: string;
  readonly routeStatus: RouteStatus;
  readonly routeRevision: string;
  readonly lastIngestionId: string | null;
  readonly slotValueHash: string;
  readonly context: JsonObject;
  readonly contextHash: string;
  readonly slotValues: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CursorPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface RouteImportRow extends PageInput {}

export interface RouteImportInput {
  readonly id: string;
  readonly templateId: string;
  readonly sourceRevision: string;
  /** Timestamp supplied by the route source, distinct from local import processing time. */
  readonly observedAt?: string;
  readonly routes: readonly RouteImportRow[];
}

export interface RouteImportResult {
  readonly ingestionId: string;
  readonly checksum: string;
  readonly sourceObservedAt: string;
  readonly rowCount: number;
  readonly inserted: number;
  readonly updated: number;
  readonly statusChanged: number;
  readonly skippedArchived: number;
  readonly unchanged: number;
  readonly notLive: number;
  readonly archived: number;
  readonly rejected: number;
  readonly idempotent: boolean;
}

export interface TagInput {
  readonly id: string;
  readonly namespace: string;
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly source: ProvenanceSource;
  readonly parentTagId?: string | null;
}

export interface TagRecord {
  readonly id: string;
  readonly templateId: string;
  readonly namespace: string;
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly source: ProvenanceSource;
  readonly parentTagId: string | null;
  readonly createdAt: string;
}

export interface PageTagRecord {
  readonly pageInstanceId: string;
  readonly templateId: string;
  readonly tag: TagRecord;
  readonly assignmentSource: ProvenanceSource;
  readonly assignedAt: string;
}

export interface BulkTagChangeInput {
  readonly tagId: string;
  readonly selector: string;
  readonly mode: 'assign' | 'remove';
}

export interface BulkTagChangePreview {
  readonly templateId: string;
  readonly tagId: string;
  readonly mode: 'assign' | 'remove';
  readonly normalizedSelector: string;
  readonly matchingCount: number;
  readonly changingCount: number;
  readonly changingPageIds: readonly string[];
  readonly samplePageIds: readonly string[];
}

export interface BulkTagChangeResult extends BulkTagChangePreview {
  readonly changedAt: string;
  readonly changedBy: string;
  readonly assignmentSource: ProvenanceSource;
}

export interface ApprovedSelectorField {
  readonly name: string;
  readonly kind: 'builtin' | 'slot' | 'tag';
  readonly cardinality: 'scalar' | 'multi';
  readonly valueType: 'string' | 'integer' | 'boolean';
  readonly sourceKey: string;
}

export interface ApprovedReadSurface {
  readonly templateId: string;
  readonly fields: readonly ApprovedSelectorField[];
}

export interface SelectorPreviewRow {
  readonly pageId: string;
  readonly canonicalUrl: string;
  readonly routeStatus: RouteStatus;
  readonly contextHash: string;
}

export interface SelectorPlanStep {
  readonly id: number;
  readonly parent: number;
  readonly detail: string;
}

export interface SelectorPreview {
  readonly normalizedSelector: string;
  readonly expression: SelectorExpression;
  /** Exact count for the template-scoped selector, independent of the sample limit. */
  readonly totalCount: number;
  readonly templatePageCount: number;
  readonly warnings: readonly ('zero_match' | 'full_template')[];
  readonly rows: readonly SelectorPreviewRow[];
  readonly truncated: boolean;
  readonly limit: number;
  readonly plan: readonly SelectorPlanStep[];
}

export interface VariantOverlap {
  readonly variantId: string;
  readonly variantRevisionId: string;
  readonly overlapPageIds: readonly string[];
  readonly overlapCount: number;
  readonly conflictingPlacementKeys: readonly string[];
  readonly truncated: boolean;
}

export interface BlockTypeInput {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly schemaVersion: number;
  readonly schema: JsonObject;
  readonly previewRenderer?: JsonObject | null;
}

export interface BlockLineageInput {
  readonly id: string;
  readonly key: string;
  readonly label: string;
}

export interface BlockVersionRecord {
  readonly id: string;
  readonly templateId: string;
  readonly lineageId: string;
  readonly parentVersionId: string | null;
  readonly versionNumber: number;
  readonly blockTypeId: string;
  readonly blockTypeKey: string;
  readonly schemaVersion: number;
  readonly content: JsonObject;
  readonly contentHash: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface CreateBlockVersionInput {
  readonly id: string;
  readonly lineageId: string;
  readonly blockTypeKey: string;
  readonly content: JsonObject;
  readonly createdBy: string;
}

export interface ForkBlockVersionInput {
  readonly id: string;
  readonly sourceVersionId: string;
  readonly content: JsonObject;
  readonly createdBy: string;
  readonly blockTypeKey?: string;
}

export interface CreateVariantInput {
  readonly id: string;
  readonly revisionId: string;
  readonly key: string;
  readonly name: string;
  readonly description?: string;
  readonly priority: number;
  readonly status?: 'draft' | 'active';
  readonly selector: string;
  readonly selectorDescription?: string;
  readonly createdBy: string;
  /**
   * `linked` starts with no local operations. `empty` records explicit tombstones for every
   * currently inherited placement so the initial document is visibly and unambiguously clear.
   */
  readonly mode?: 'linked' | 'empty';
}

export interface VariantRecord {
  readonly id: string;
  readonly templateId: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly isDefault: boolean;
  readonly priority: number;
  readonly status: 'draft' | 'active' | 'archived';
  readonly activeRevisionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VariantRevisionRecord {
  readonly id: string;
  readonly variantId: string;
  readonly revisionNumber: number;
  readonly originalSelector: string;
  readonly selector: string;
  readonly selectorHash: string;
  readonly validationResult: {
    readonly status: 'valid';
    readonly normalizedSelector: string;
  };
  readonly selectorDescription: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface EffectivePageDocument {
  readonly page: PageRecord;
  readonly document: ResolvedDocument;
  readonly renderedPlacements: readonly {
    readonly placementKey: string;
    readonly order: number;
    readonly blockType: string;
    readonly blockVersionId: string;
    readonly content: JsonObject;
  }[];
}

export interface CopyOnWritePlacementInput {
  readonly revisionId?: string;
  readonly blockVersionId: string;
  readonly content: JsonObject;
  readonly createdBy: string;
  readonly blockTypeKey?: string;
}

export interface CopyOnWritePlacementResult {
  readonly blockVersion: BlockVersionRecord;
  readonly revision: VariantRevisionRecord;
}

export interface CreateVariantPlacementInput {
  readonly revisionId?: string;
  readonly placementKey: string;
  readonly lineage: BlockLineageInput;
  readonly blockVersionId: string;
  readonly blockTypeKey: string;
  readonly content: JsonObject;
  readonly order: number;
  readonly createdBy: string;
}

export type DefaultPlacementPosition =
  | { readonly kind: 'start' | 'end' }
  | { readonly kind: 'before' | 'after'; readonly placementKey: string };

export interface CreateDefaultPlacementInput {
  readonly revisionId?: string;
  readonly placementKey: string;
  readonly lineage: BlockLineageInput;
  readonly blockVersionId: string;
  readonly blockTypeKey: string;
  readonly content: JsonObject;
  readonly createdBy: string;
  readonly position?: DefaultPlacementPosition;
}

export interface EditDefaultPlacementInput {
  readonly revisionId?: string;
  readonly placementKey: string;
  readonly blockVersionId: string;
  readonly content: JsonObject;
  readonly createdBy: string;
  readonly blockTypeKey?: string;
}

export interface DefaultPlacementMutationResult {
  readonly blockVersion: BlockVersionRecord;
  readonly revision: VariantRevisionRecord;
}

export type PublicationFailureStage =
  | 'after-publication'
  | 'after-manifests'
  | 'after-pages'
  | 'before-activation';

export interface PublishInput {
  readonly id?: string;
  readonly createdBy: string;
  readonly failAt?: PublicationFailureStage;
  readonly materializationMode?: 'manifest' | 'expanded';
  readonly batchSize?: number;
  readonly onProgress?: (progress: PublicationProgress) => void;
}

export interface PublicationProgress {
  readonly phase: 'compile' | 'write';
  readonly pagesProcessed: number;
  readonly totalPages: number;
}

export interface PublishResult {
  readonly publicationId: string;
  readonly sequence: number;
  readonly inputHash: string;
  readonly previousPublicationId: string | null;
  readonly pageCount: number;
  readonly manifestCount: number;
  readonly reusedManifestCount: number;
  readonly reusedCurrentPublication: boolean;
  readonly materializationMode: 'manifest' | 'expanded';
  readonly selectorMatchCount: number;
  readonly blockReferenceCount: number;
  readonly rowsWritten: number;
  readonly estimatedStorageBytes: number;
  /** UTF-8 bytes for every page's fully rendered document, independent of storage mode. */
  readonly logicalExpandedRenderedDocumentBytes: number;
  readonly durationMilliseconds: number;
}

export interface RollbackResult {
  readonly fromPublicationId: string;
  readonly publicationId: string;
  readonly activatedAt: string;
  readonly activatedBy: string;
}

export type PublishedDocumentResult =
  | {
      readonly status: 200;
      readonly publicationId: string;
      readonly canonicalUrl: string;
      readonly routeStatus: RouteStatus;
      readonly documentHash: string;
      readonly document: JsonValue;
    }
  | { readonly status: 404; readonly reason: 'missing' };

export type ServeResult =
  | {
      readonly status: 200;
      readonly publicationId: string;
      readonly canonicalUrl: string;
      readonly documentHash: string;
      readonly document: JsonValue;
    }
  | {
      readonly status: 404;
      readonly reason: 'missing' | 'not_live' | 'archived' | 'unpublished';
    };

export interface ServeReadEvidence {
  readonly result: ServeResult;
  readonly materializationMode: 'manifest' | 'expanded' | null;
  readonly sqlQueryCount: 1 | 2;
  readonly selectorSqlExecutions: 0;
  readonly elapsedMilliseconds: number;
}

export interface CmsServiceOptions {
  readonly now?: () => string;
  readonly createId?: (scope: string) => string;
  readonly selectorPreviewLimit?: number;
}
