import type { CmsDatabaseClient } from '@repo/cms-db';
import {
  compactScenarioRegistry,
  ensureCompactPublishedScenario,
} from '@repo/cms-scenarios/compact-seed';
import { CmsService, CmsServiceError } from '@repo/cms-service';
import type { ScenarioId } from '@/data/scenario-fixtures';
import type {
  CmsCommand,
  CmsCommandResult,
  CmsWorkspaceSnapshot,
  SelectorPreviewSnapshot,
} from '@/data/sqlite-authoring';

const ACTOR = 'prototype-ui';

export const editableScenarioRegistry = compactScenarioRegistry satisfies Record<
  ScenarioId,
  { templateId: string; pageId: string }
>;

type JsonObject = Parameters<CmsService['createDefaultPlacement']>[1]['content'];

interface VariantSelectorRow {
  id: string;
  selector: string;
}

interface BlockTypeRow {
  key: string;
  name: string;
  schemaVersion: number;
  schemaJson: string;
}

interface CurrentPublicationRow {
  currentPublicationId: string;
  rollbackPublicationId: string | null;
}

const blockExamples: Readonly<Record<string, JsonObject>> = {
  navigation: { label: 'Auteur prototype' },
  hero: { headline: 'A new immutable hero' },
  hero_alt: { headline: 'A split-layout hero', mapAssetKey: 'map-demo' },
  promo: { message: 'A new promotion' },
  footer: { legal: 'Prototype terms' },
};

const randomId = (scope: string): string => `${scope}:${globalThis.crypto.randomUUID()}`;

function parseContentJson(value: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new CmsServiceError('INVALID_INPUT', 'Block content must be valid JSON.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CmsServiceError('INVALID_INPUT', 'Block content must be a JSON object.');
  }
  return parsed as JsonObject;
}

const ensureEditableScenario = ensureCompactPublishedScenario;

function selectorsByVariant(client: CmsDatabaseClient, templateId: string): Map<string, string> {
  return new Map(
    client.sqlite
      .query<VariantSelectorRow, [string]>(
        `SELECT variants.id, revisions.selector_sql AS selector
         FROM variants
         JOIN variant_revisions AS revisions ON revisions.id = variants.active_revision_id
         WHERE variants.template_id = ?`
      )
      .all(templateId)
      .map((row) => [row.id, row.selector] as const)
  );
}

export function readCmsWorkspace(
  client: CmsDatabaseClient,
  scenarioId: ScenarioId,
  requestedScopeId?: string
): CmsWorkspaceSnapshot {
  const registry = ensureEditableScenario(client, scenarioId);
  const service = new CmsService(client);
  const template = service.getTemplate(registry.templateId);
  if (!template) throw new CmsServiceError('NOT_FOUND', 'Editable template was not found.');
  const variants = service.listVariants(registry.templateId);
  const defaultVariant = variants.find((variant) => variant.isDefault);
  if (!defaultVariant?.activeRevisionId) {
    throw new CmsServiceError('CONFLICT', 'Editable template has no active default revision.');
  }
  const selectedVariant =
    variants.find((variant) => variant.id === requestedScopeId && variant.status !== 'archived') ??
    defaultVariant;
  const selectors = selectorsByVariant(client, registry.templateId);
  let pageId: string = registry.pageId;
  let scopeMatchesSamplePage = true;
  if (!selectedVariant.isDefault) {
    const selector = selectors.get(selectedVariant.id) ?? '';
    const preview = service.previewSelector(registry.templateId, selector, 1);
    pageId = preview.rows[0]?.pageId ?? registry.pageId;
    scopeMatchesSamplePage = preview.totalCount > 0;
  }
  const page = service.getPage(registry.templateId, pageId);
  if (!page) throw new CmsServiceError('NOT_FOUND', 'Editable sample page was not found.');
  const resolved =
    !selectedVariant.isDefault && scopeMatchesSamplePage
      ? service.resolveVariantDraft(registry.templateId, selectedVariant.id, pageId)
      : selectedVariant.isDefault
        ? service.resolveDefaultPage(registry.templateId, pageId)
        : service.resolvePage(registry.templateId, pageId);
  const renderedByPlacement = new Map(
    resolved.renderedPlacements.map((placement) => [placement.placementKey, placement] as const)
  );
  const served = service.serve(registry.templateId, page.canonicalUrl);
  const currentPublication = client.sqlite
    .query<CurrentPublicationRow, [string]>(
      `SELECT current.publication_id AS currentPublicationId,
              publications.previous_publication_id AS rollbackPublicationId
       FROM current_publications AS current
       JOIN publications ON publications.id = current.publication_id
         AND publications.template_id = current.template_id
       WHERE current.template_id = ?`
    )
    .get(registry.templateId);
  const publicationCount =
    client.sqlite
      .query<{ count: number }, [string]>(
        'SELECT count(*) AS count FROM publications WHERE template_id = ?'
      )
      .get(registry.templateId)?.count ?? 0;
  const blockTypes = client.sqlite
    .query<BlockTypeRow, []>(
      `SELECT key, name, schema_version AS schemaVersion, schema_json AS schemaJson
       FROM block_types
       ORDER BY key`
    )
    .all()
    .filter((blockType) => blockType.key in blockExamples)
    .map((blockType) => ({
      ...blockType,
      exampleContentJson: JSON.stringify(blockExamples[blockType.key], null, 2),
    }));
  return {
    scenarioId,
    templateId: registry.templateId,
    templateName: template.name,
    pageId,
    canonicalUrl: page.canonicalUrl,
    scopeId: selectedVariant.id,
    scopeMatchesSamplePage,
    variants: variants.map((variant) => {
      const selector = selectors.get(variant.id) ?? 'TRUE';
      let matchesSamplePage = true;
      if (!variant.isDefault) {
        matchesSamplePage =
          service.previewSelector(registry.templateId, selector, 1).totalCount > 0;
      }
      return {
        id: variant.id,
        name: variant.name,
        priority: variant.priority,
        isDefault: variant.isDefault,
        status: variant.status,
        selector,
        activeRevisionId: variant.activeRevisionId ?? '',
        matchesSamplePage,
      };
    }),
    blockTypes,
    placements: resolved.document.placements.map((placement) => ({
      placementKey: placement.placementKey,
      order: placement.order,
      blockType: placement.blockVersion.blockType,
      blockVersionId: placement.blockVersion.id,
      contentJson: JSON.stringify(placement.blockVersion.content, null, 2),
      renderedJson: JSON.stringify(renderedByPlacement.get(placement.placementKey)?.content ?? {}),
      sourceRevisionId: placement.provenance.content.sourceId,
      sourcePriority: placement.provenance.content.priority,
      inherited:
        !selectedVariant.isDefault &&
        placement.provenance.content.sourceId !== selectedVariant.activeRevisionId,
      orderSourceRevisionId: placement.provenance.order.sourceId,
      orderSourcePriority: placement.provenance.order.priority,
      orderInherited:
        !selectedVariant.isDefault &&
        placement.provenance.order.sourceId !== selectedVariant.activeRevisionId,
    })),
    tombstones: resolved.document.tombstones.map((tombstone) => ({
      placementKey: tombstone.placementKey,
      sourceRevisionId: tombstone.source.sourceId,
      sourcePriority: tombstone.source.priority,
    })),
    currentPublicationId: currentPublication?.currentPublicationId ?? null,
    currentDocumentHash: served.status === 200 ? served.documentHash : null,
    rollbackPublicationId: currentPublication?.rollbackPublicationId ?? null,
    publicationCount,
  };
}

export function previewCmsSelector(
  client: CmsDatabaseClient,
  scenarioId: ScenarioId,
  selector: string
): SelectorPreviewSnapshot {
  const { templateId } = ensureEditableScenario(client, scenarioId);
  const preview = new CmsService(client).previewSelector(templateId, selector, 10);
  return {
    normalizedSelector: preview.normalizedSelector,
    totalCount: preview.totalCount,
    templatePageCount: preview.templatePageCount,
    warnings: preview.warnings,
    sampleUrls: preview.rows.map((row) => row.canonicalUrl),
    plan: preview.plan.map((step) => step.detail),
  };
}

function scopeForCommand(service: CmsService, templateId: string, scopeId: string) {
  const variant = service.getVariant(templateId, scopeId);
  if (!variant || variant.status === 'archived') {
    throw new CmsServiceError('NOT_FOUND', `Authoring scope "${scopeId}" was not found.`);
  }
  return variant;
}

function executeCmsCommandInTransaction(
  client: CmsDatabaseClient,
  command: CmsCommand
): CmsCommandResult {
  const registry = ensureEditableScenario(client, command.scenarioId);
  const service = new CmsService(client);
  let scopeId = 'scopeId' in command ? command.scopeId : undefined;
  let message: string;

  switch (command.kind) {
    case 'createVariant': {
      service.previewSelector(registry.templateId, command.selector, 10);
      const key =
        command.name
          .normalize('NFKC')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'variant';
      const id = randomId('variant');
      service.createVariant(registry.templateId, {
        id,
        revisionId: randomId('revision'),
        key: `${key}-${id.slice(-8)}`,
        name: command.name,
        priority: command.priority,
        status: 'active',
        selector: command.selector,
        createdBy: ACTOR,
        mode: command.mode,
      });
      scopeId = id;
      message = `${command.mode === 'linked' ? 'Linked' : 'Blank'} variant created in SQLite.`;
      break;
    }
    case 'reviseSelector':
      scopeForCommand(service, registry.templateId, command.scopeId);
      service.reviseVariantSelector(registry.templateId, command.scopeId, {
        revisionId: randomId('revision'),
        selector: command.selector,
        createdBy: ACTOR,
      });
      message = 'Selector revision validated and persisted.';
      break;
    case 'setVariantPriority':
      service.setVariantPriority(registry.templateId, command.scopeId, command.priority);
      message = `Variant priority changed to ${command.priority}.`;
      break;
    case 'addPlacement': {
      const variant = scopeForCommand(service, registry.templateId, command.scopeId);
      const content = parseContentJson(command.contentJson);
      if (variant.isDefault) {
        service.createDefaultPlacement(registry.templateId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          lineage: {
            id: randomId('lineage'),
            key: command.placementKey,
            label: command.placementKey,
          },
          blockVersionId: randomId('block-version'),
          blockTypeKey: command.blockTypeKey,
          content,
          createdBy: ACTOR,
          position: { kind: 'end' },
        });
      } else {
        const workspace = readCmsWorkspace(client, command.scenarioId, command.scopeId);
        service.createVariantPlacement(registry.templateId, command.scopeId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          lineage: {
            id: randomId('lineage'),
            key: command.placementKey,
            label: command.placementKey,
          },
          blockVersionId: randomId('block-version'),
          blockTypeKey: command.blockTypeKey,
          content,
          order: workspace.placements.length,
          createdBy: ACTOR,
        });
      }
      message = `Placement ${command.placementKey} added as an immutable version.`;
      break;
    }
    case 'editPlacement': {
      const variant = scopeForCommand(service, registry.templateId, command.scopeId);
      const content = parseContentJson(command.contentJson);
      if (variant.isDefault) {
        service.editDefaultPlacement(registry.templateId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          blockVersionId: randomId('block-version'),
          blockTypeKey: command.blockTypeKey,
          content,
          createdBy: ACTOR,
        });
      } else {
        const workspace = readCmsWorkspace(client, command.scenarioId, command.scopeId);
        service.copyOnWritePlacement(
          registry.templateId,
          command.scopeId,
          workspace.pageId,
          command.placementKey,
          {
            revisionId: randomId('revision'),
            blockVersionId: randomId('block-version'),
            blockTypeKey: command.blockTypeKey,
            content,
            createdBy: ACTOR,
          }
        );
      }
      message = `Placement ${command.placementKey} now points to a new immutable version.`;
      break;
    }
    case 'movePlacement': {
      const variant = scopeForCommand(service, registry.templateId, command.scopeId);
      const workspace = readCmsWorkspace(client, command.scenarioId, command.scopeId);
      const placementKeys = workspace.placements.map((placement) => placement.placementKey);
      const index = placementKeys.indexOf(command.placementKey);
      const targetIndex = command.direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= placementKeys.length) {
        throw new CmsServiceError('INVALID_INPUT', 'The placement cannot move farther.');
      }
      [placementKeys[index], placementKeys[targetIndex]] = [
        placementKeys[targetIndex] ?? '',
        placementKeys[index] ?? '',
      ];
      if (variant.isDefault) {
        service.reorderDefaultPlacements(registry.templateId, {
          revisionId: randomId('revision'),
          placementKeys,
          createdBy: ACTOR,
        });
      } else {
        service.reorderVariantPlacements(registry.templateId, command.scopeId, {
          revisionId: randomId('revision'),
          placementKeys,
          createdBy: ACTOR,
        });
      }
      message = `Placement ${command.placementKey} moved ${command.direction} atomically.`;
      break;
    }
    case 'deletePlacement': {
      const variant = scopeForCommand(service, registry.templateId, command.scopeId);
      if (variant.isDefault) {
        service.removeDefaultPlacement(registry.templateId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          createdBy: ACTOR,
        });
        message = `Default placement ${command.placementKey} removed; history remains immutable.`;
      } else {
        service.tombstoneVariantPlacement(registry.templateId, command.scopeId, {
          revisionId: randomId('revision'),
          placementKey: command.placementKey,
          createdBy: ACTOR,
        });
        message = `Scoped tombstone hides ${command.placementKey}.`;
      }
      break;
    }
    case 'revertPlacement': {
      const variant = scopeForCommand(service, registry.templateId, command.scopeId);
      if (variant.isDefault) {
        throw new CmsServiceError('INVALID_INPUT', 'Only a variant override can be reverted.');
      }
      service.revertVariantPlacement(registry.templateId, command.scopeId, {
        revisionId: randomId('revision'),
        placementKey: command.placementKey,
        createdBy: ACTOR,
      });
      message = `Local operation for ${command.placementKey} reverted to inheritance.`;
      break;
    }
    case 'publish': {
      const publication = service.publish(registry.templateId, { createdBy: ACTOR });
      message = publication.reusedCurrentPublication
        ? `Publication ${publication.publicationId} already matches the deterministic input.`
        : `Publication ${publication.publicationId} activated atomically for ${publication.pageCount} pages.`;
      break;
    }
    case 'rollback': {
      const rollback = service.rollback(registry.templateId, undefined, ACTOR);
      message = `Serving pointer rolled back from ${rollback.fromPublicationId} to ${rollback.publicationId}.`;
      break;
    }
  }

  return {
    ok: true,
    message,
    workspace: readCmsWorkspace(client, command.scenarioId, scopeId),
  };
}

export function executeCmsCommand(
  client: CmsDatabaseClient,
  command: CmsCommand
): CmsCommandResult {
  return client.sqlite
    .transaction(() => executeCmsCommandInTransaction(client, command))
    .immediate();
}
