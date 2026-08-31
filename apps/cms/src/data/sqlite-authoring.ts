import * as z from 'zod';

import { CanonicalUrlSchema } from './content-explorer';
import { type ScenarioId, ScenarioIdSchema } from './scenario-fixtures';
import {
  type PlacementTraceStep,
  type SelectorConflict,
  type SelectorField,
  type SelectorWorkspacePreview,
  SelectorWorkspacePreviewInputSchema,
} from './selector-workspace';

const AuthoringScopeSchema = z.string().min(1).max(160);

export const CmsWorkspaceInputSchema = z.object({
  scenarioId: ScenarioIdSchema,
  scopeId: AuthoringScopeSchema.optional(),
  canonicalUrl: CanonicalUrlSchema.optional(),
});

export const CmsBlockFieldInspectionInputSchema = z.object({
  scenarioId: ScenarioIdSchema,
  canonicalUrl: CanonicalUrlSchema,
  source: z.string().max(10_000),
});

const PublicationWorkspaceContextShape = {
  scenarioId: ScenarioIdSchema,
  scopeId: AuthoringScopeSchema.optional(),
  canonicalUrl: CanonicalUrlSchema.optional(),
};

const PublicationMetadataSchema = z.object({
  id: z.string().min(1),
  sequence: z.int().min(1),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  previousPublicationId: z.string().min(1).nullable(),
  pageCount: z.int().min(0),
  manifestCount: z.int().min(0),
  publishedAt: z.iso.datetime(),
  activatedAt: z.iso.datetime().nullable(),
  activatedBy: z.string().min(1).nullable(),
});

export const CmsPublicationHistoryInputSchema = z.object({
  scenarioId: ScenarioIdSchema,
  limit: z.int().min(1).max(50).optional(),
});

const CmsPublicationHistoryRowSchema = z.object({
  id: z.string().min(1),
  sequence: z.int().min(1),
  status: z.enum(['published', 'failed']),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  previousPublicationId: z.string().min(1).nullable(),
  pageCount: z.int().min(0),
  manifestCount: z.int().min(0),
  createdBy: z.string().min(1),
  publishedAt: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  activatedAt: z.string().min(1).nullable(),
  activatedBy: z.string().min(1).nullable(),
  isCurrent: z.boolean(),
  isRollbackTarget: z.boolean(),
});

export const CmsPublicationHistorySchema = z.object({
  scenarioId: ScenarioIdSchema,
  templateId: z.string().min(1),
  currentPublicationId: z.string().min(1).nullable(),
  rollbackTargetPublicationId: z.string().min(1).nullable(),
  total: z.int().min(0),
  counts: z.object({
    published: z.int().min(0),
    failed: z.int().min(0),
    current: z.int().min(0).max(1),
    rollbackTarget: z.int().min(0).max(1),
    historical: z.int().min(0),
  }),
  rows: z.array(CmsPublicationHistoryRowSchema).max(50),
});

export const CmsLifecycleErrorCodeSchema = z.enum([
  'PRIORITY_CONFLICT',
  'NOT_FOUND',
  'INVALID_INPUT',
  'ARCHIVED_GUARD',
  'CONFLICT',
  'CEL_VALIDATION',
  'SCHEMA_VALIDATION',
  'PUBLICATION_FAILED',
]);

const PublicationPreflightIssueSchema = z.object({
  code: CmsLifecycleErrorCodeSchema,
  message: z.string().min(1),
  affectedPageCount: z.int().min(0),
  sampleCanonicalUrls: z.array(CanonicalUrlSchema),
  placementKey: z.string().min(1).nullable(),
  priority: z.int().min(0).nullable(),
  variantRevisionIds: z.array(z.string().min(1)),
  operationKinds: z.array(z.enum(['set', 'tombstone', 'order'])),
});

export const CmsPublicationPreflightResultSchema = z.object({
  templateId: z.string().min(1),
  materializationMode: z.enum(['manifest', 'expanded']),
  totalActivePages: z.int().min(0),
  affectedActivePages: z.object({
    count: z.int().min(0),
    sampleCanonicalUrls: z.array(CanonicalUrlSchema),
    truncated: z.boolean(),
  }),
  issues: z.array(PublicationPreflightIssueSchema),
  canPublish: z.boolean(),
  inputHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
  reusesCurrentPublication: z.boolean(),
  manifestReuse: z.object({
    eligibleManifestCount: z.int().min(0),
    reusedManifestCount: z.int().min(0),
    newManifestCount: z.int().min(0),
  }),
  currentPublication: PublicationMetadataSchema.nullable(),
  rollbackTarget: z
    .object({
      publication: PublicationMetadataSchema,
      valid: z.boolean(),
      reason: z.string().min(1).nullable(),
    })
    .nullable(),
  selectorMatchCount: z.int().min(0),
  blockReferenceCount: z.int().min(0),
  logicalExpandedRenderedDocumentBytes: z.int().min(0),
});

export const CmsPublicationPreflightInputSchema = z.object({
  ...PublicationWorkspaceContextShape,
  materializationMode: z.enum(['manifest', 'expanded']).optional(),
  sampleLimit: z.int().min(1).max(100).optional(),
});

export const CmsPublishPublicationInputSchema = z.object({
  ...PublicationWorkspaceContextShape,
  inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedCurrentPublicationId: z.string().min(1).nullable(),
  materializationMode: z.enum(['manifest', 'expanded']).optional(),
});

export const CmsRollbackPublicationInputSchema = z.object({
  ...PublicationWorkspaceContextShape,
  targetPublicationId: z.string().min(1),
  expectedCurrentPublicationId: z.string().min(1),
});

export type CmsPublicationMetadata = z.infer<typeof PublicationMetadataSchema>;
export type CmsPublicationHistoryInput = z.infer<typeof CmsPublicationHistoryInputSchema>;
export type CmsPublicationHistoryRow = z.infer<typeof CmsPublicationHistoryRowSchema>;
export type CmsPublicationHistory = z.infer<typeof CmsPublicationHistorySchema>;
export type CmsPublicationPreflight = z.infer<typeof CmsPublicationPreflightResultSchema>;
export type CmsPublicationPreflightInput = z.infer<typeof CmsPublicationPreflightInputSchema>;
export type CmsPublishPublicationInput = z.infer<typeof CmsPublishPublicationInputSchema>;
export type CmsRollbackPublicationInput = z.infer<typeof CmsRollbackPublicationInputSchema>;
export type CmsLifecycleErrorCode = z.infer<typeof CmsLifecycleErrorCodeSchema>;

const JsonObjectTextSchema = z.string().min(2).max(20_000);
const PlacementKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a lowercase kebab-case placement key.');

export const CmsCommandSchema = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('createVariant'),
      scenarioId: ScenarioIdSchema,
      name: z.string().trim().min(1).max(100),
      selector: z.string().trim().min(1).max(2_000),
      priority: z.int().min(1).max(10_000),
      mode: z.enum(['linked', 'empty', 'duplicate']),
      duplicateSourceScopeId: AuthoringScopeSchema.optional(),
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
      canonicalUrl: CanonicalUrlSchema,
      placementKey: PlacementKeySchema,
      blockTypeKey: z.enum(['navigation', 'hero', 'hero_alt', 'promo', 'footer']),
      contentJson: JsonObjectTextSchema,
      position: z.enum(['start', 'end', 'before', 'after']).optional(),
      referencePlacementKey: PlacementKeySchema.optional(),
    }),
    z.object({
      kind: z.literal('editPlacement'),
      scenarioId: ScenarioIdSchema,
      scopeId: AuthoringScopeSchema,
      canonicalUrl: CanonicalUrlSchema,
      placementKey: PlacementKeySchema,
      blockTypeKey: z.enum(['navigation', 'hero', 'hero_alt', 'promo', 'footer']),
      contentJson: JsonObjectTextSchema,
    }),
    z.object({
      kind: z.literal('movePlacement'),
      scenarioId: ScenarioIdSchema,
      scopeId: AuthoringScopeSchema,
      canonicalUrl: CanonicalUrlSchema,
      placementKey: PlacementKeySchema,
      direction: z.enum(['up', 'down']),
    }),
    z.object({
      kind: z.literal('revertOrder'),
      scenarioId: ScenarioIdSchema,
      scopeId: AuthoringScopeSchema,
      canonicalUrl: CanonicalUrlSchema,
    }),
    z.object({
      kind: z.literal('deletePlacement'),
      scenarioId: ScenarioIdSchema,
      scopeId: AuthoringScopeSchema,
      canonicalUrl: CanonicalUrlSchema,
      placementKey: PlacementKeySchema,
    }),
    z.object({
      kind: z.literal('revertPlacement'),
      scenarioId: ScenarioIdSchema,
      scopeId: AuthoringScopeSchema,
      canonicalUrl: CanonicalUrlSchema,
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
  ])
  .superRefine((command, context) => {
    if (
      command.kind === 'createVariant' &&
      command.mode === 'duplicate' &&
      !command.duplicateSourceScopeId
    ) {
      context.addIssue({
        code: 'custom',
        path: ['duplicateSourceScopeId'],
        message: 'Choose the variation to duplicate.',
      });
    }
  });

export const SelectorPreviewInputSchema = SelectorWorkspacePreviewInputSchema;

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
  readonly affectedPlacementCount: number;
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
  readonly trace: readonly PlacementTraceStep[];
  readonly lineageId: string;
  readonly parentBlockVersionId: string | null;
  readonly versionNumber: number;
  readonly schemaVersion: number;
  readonly contentHash: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly publishedBlockVersionId: string | null;
  readonly draftDifference: 'same' | 'changed' | 'added';
  readonly versionHistory: readonly CmsWorkspaceBlockVersion[];
  readonly fieldInspections: readonly CmsWorkspaceFieldInspection[];
}

export interface CmsWorkspaceBlockVersion {
  readonly id: string;
  readonly parentBlockVersionId: string | null;
  readonly versionNumber: number;
  readonly blockType: string;
  readonly schemaVersion: number;
  readonly contentHash: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface CmsWorkspaceFieldInspection {
  readonly path: string;
  readonly source: string;
  readonly success: boolean;
  readonly dependencies: readonly string[];
  readonly allowedVariables: readonly string[];
  readonly expressionCount: number | null;
  readonly maxAstDepth: number | null;
  readonly evaluatedSample: string | null;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly path?: string;
    readonly expression?: string;
    readonly sourceStart?: number;
    readonly sourceEnd?: number;
  } | null;
}

export interface CmsWorkspaceTombstone {
  readonly placementKey: string;
  readonly sourceRevisionId: string;
  readonly sourcePriority: number;
  readonly trace: readonly PlacementTraceStep[];
  readonly hiddenPlacement: {
    readonly order: number;
    readonly blockType: string;
    readonly blockVersionId: string;
    readonly contentJson: string;
  } | null;
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
  readonly selectorFields: readonly SelectorField[];
  readonly blockTypes: readonly CmsWorkspaceBlockType[];
  readonly placements: readonly CmsWorkspacePlacement[];
  readonly tombstones: readonly CmsWorkspaceTombstone[];
  readonly matchedVariantRevisionIds: readonly string[];
  readonly resolutionStatus: 'resolved' | 'conflict';
  readonly resolutionConflicts: readonly SelectorConflict[];
  readonly publicationBlocked: boolean;
  readonly currentPublicationId: string | null;
  readonly currentDocumentHash: string | null;
  readonly rollbackPublicationId: string | null;
  readonly publicationCount: number;
}

export type SelectorPreviewSnapshot = SelectorWorkspacePreview;

export interface CmsCommandResult {
  readonly ok: true;
  readonly message: string;
  readonly workspace: CmsWorkspaceSnapshot;
}

export type CmsPublicationMutationResult =
  | {
      readonly kind: 'publish';
      readonly message: string;
      readonly publication: CmsPublicationMetadata;
      readonly fromPublication: CmsPublicationMetadata | null;
      readonly workspace: CmsWorkspaceSnapshot;
      readonly preflight: CmsPublicationPreflight;
    }
  | {
      readonly kind: 'rollback';
      readonly message: string;
      readonly publication: CmsPublicationMetadata;
      readonly fromPublication: CmsPublicationMetadata;
      readonly workspace: CmsWorkspaceSnapshot;
      readonly preflight: CmsPublicationPreflight;
    };

export type CmsPublicationMutationResponse =
  | { readonly ok: true; readonly result: CmsPublicationMutationResult }
  | {
      readonly ok: false;
      readonly error: { readonly code: CmsLifecycleErrorCode; readonly message: string };
      readonly preflight: CmsPublicationPreflight | null;
    };
