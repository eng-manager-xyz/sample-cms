import * as z from 'zod';

import { type ScenarioId, ScenarioIdSchema } from './scenario-fixtures';

const AuthoringScopeSchema = z.string().min(1).max(160);

export const CmsWorkspaceInputSchema = z.object({
  scenarioId: ScenarioIdSchema,
  scopeId: AuthoringScopeSchema.optional(),
});

const JsonObjectTextSchema = z.string().min(2).max(20_000);
const PlacementKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase kebab-case placement key.');

export const CmsCommandSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('createVariant'),
    scenarioId: ScenarioIdSchema,
    name: z.string().trim().min(1).max(100),
    selector: z.string().trim().min(1).max(2_000),
    priority: z.int().min(1).max(10_000),
    mode: z.enum(['linked', 'empty']),
  }),
  z.object({
    kind: z.literal('reviseSelector'),
    scenarioId: ScenarioIdSchema,
    scopeId: AuthoringScopeSchema,
    selector: z.string().trim().min(1).max(2_000),
  }),
  z.object({
    kind: z.literal('setVariantPriority'),
    scenarioId: ScenarioIdSchema,
    scopeId: AuthoringScopeSchema,
    priority: z.int().min(1).max(10_000),
  }),
  z.object({
    kind: z.literal('addPlacement'),
    scenarioId: ScenarioIdSchema,
    scopeId: AuthoringScopeSchema,
    placementKey: PlacementKeySchema,
    blockTypeKey: z.enum(['navigation', 'hero', 'hero_alt', 'promo', 'footer']),
    contentJson: JsonObjectTextSchema,
  }),
  z.object({
    kind: z.literal('editPlacement'),
    scenarioId: ScenarioIdSchema,
    scopeId: AuthoringScopeSchema,
    placementKey: PlacementKeySchema,
    blockTypeKey: z.enum(['navigation', 'hero', 'hero_alt', 'promo', 'footer']),
    contentJson: JsonObjectTextSchema,
  }),
  z.object({
    kind: z.literal('movePlacement'),
    scenarioId: ScenarioIdSchema,
    scopeId: AuthoringScopeSchema,
    placementKey: PlacementKeySchema,
    direction: z.enum(['up', 'down']),
  }),
  z.object({
    kind: z.literal('deletePlacement'),
    scenarioId: ScenarioIdSchema,
    scopeId: AuthoringScopeSchema,
    placementKey: PlacementKeySchema,
  }),
  z.object({
    kind: z.literal('revertPlacement'),
    scenarioId: ScenarioIdSchema,
    scopeId: AuthoringScopeSchema,
    placementKey: PlacementKeySchema,
  }),
  z.object({
    kind: z.literal('publish'),
    scenarioId: ScenarioIdSchema,
  }),
  z.object({
    kind: z.literal('rollback'),
    scenarioId: ScenarioIdSchema,
  }),
]);

export const SelectorPreviewInputSchema = z.object({
  scenarioId: ScenarioIdSchema,
  selector: z.string().trim().min(1).max(2_000),
});

export type CmsCommand = z.infer<typeof CmsCommandSchema>;

export interface CmsWorkspaceVariant {
  readonly id: string;
  readonly name: string;
  readonly priority: number;
  readonly isDefault: boolean;
  readonly status: 'draft' | 'active' | 'archived';
  readonly selector: string;
  readonly activeRevisionId: string;
  readonly matchesSamplePage: boolean;
}

export interface CmsWorkspacePlacement {
  readonly placementKey: string;
  readonly order: number;
  readonly blockType: string;
  readonly blockVersionId: string;
  readonly contentJson: string;
  readonly renderedJson: string;
  readonly sourceRevisionId: string;
  readonly sourcePriority: number;
  readonly inherited: boolean;
  readonly orderSourceRevisionId: string;
  readonly orderSourcePriority: number;
  readonly orderInherited: boolean;
}

export interface CmsWorkspaceTombstone {
  readonly placementKey: string;
  readonly sourceRevisionId: string;
  readonly sourcePriority: number;
}

export interface CmsWorkspaceBlockType {
  readonly key: string;
  readonly name: string;
  readonly schemaVersion: number;
  readonly schemaJson: string;
  readonly exampleContentJson: string;
}

export interface CmsWorkspaceSnapshot {
  readonly scenarioId: ScenarioId;
  readonly templateId: string;
  readonly templateName: string;
  readonly pageId: string;
  readonly canonicalUrl: string;
  readonly scopeId: string;
  readonly scopeMatchesSamplePage: boolean;
  readonly variants: readonly CmsWorkspaceVariant[];
  readonly blockTypes: readonly CmsWorkspaceBlockType[];
  readonly placements: readonly CmsWorkspacePlacement[];
  readonly tombstones: readonly CmsWorkspaceTombstone[];
  readonly currentPublicationId: string | null;
  readonly currentDocumentHash: string | null;
  readonly rollbackPublicationId: string | null;
  readonly publicationCount: number;
}

export interface SelectorPreviewSnapshot {
  readonly normalizedSelector: string;
  readonly totalCount: number;
  readonly templatePageCount: number;
  readonly warnings: readonly ('zero_match' | 'full_template')[];
  readonly sampleUrls: readonly string[];
  readonly plan: readonly string[];
}

export interface CmsCommandResult {
  readonly ok: true;
  readonly message: string;
  readonly workspace: CmsWorkspaceSnapshot;
}
