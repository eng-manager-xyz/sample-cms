import * as z from 'zod';
import {
  PublicCanonicalPathSchema,
  PublicScenarioIdSchema,
  type PublicTemplateMatch,
  publicHostMatchesTemplate,
} from './public-path';

const JsonObjectSchema = z.record(z.string(), z.json());

export const PreviewPageRequestSchema = z.strictObject({
  canonicalUrl: PublicCanonicalPathSchema,
});

const AuthoringSourceSchema = z.strictObject({
  kind: z.enum(['default', 'variant']),
  sourceRevisionId: z.string().min(1),
  sourcePriority: z.int().min(0),
});
type AuthoringSource = z.infer<typeof AuthoringSourceSchema>;

const AuthoringTraceStepSchema = z.strictObject({
  operationKind: z.enum(['default', 'set', 'tombstone', 'order']),
  source: AuthoringSourceSchema,
  blockVersionId: z.string().min(1).optional(),
  order: z.int().min(0).optional(),
});

const PreviewPlacementSchema = z.strictObject({
  placementKey: z.string().min(1),
  order: z.int().min(0),
  blockType: z.string().min(1),
  blockVersionId: z.string().min(1),
  content: JsonObjectSchema,
  provenance: z.strictObject({
    content: AuthoringSourceSchema,
    order: AuthoringSourceSchema,
    trace: z.array(AuthoringTraceStepSchema),
  }),
});
const PreviewPlacementListSchema = z
  .array(PreviewPlacementSchema)
  .superRefine((placements, ctx) => {
    const placementKeys = new Set<string>();
    for (const [index, placement] of placements.entries()) {
      if (placement.order !== index) {
        ctx.addIssue({
          code: 'custom',
          message: `Preview placement order must be contiguous; expected ${index}.`,
          path: [index, 'order'],
        });
      }
      if (placementKeys.has(placement.placementKey)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Preview placement keys must be unique within a resolved document.',
          path: [index, 'placementKey'],
        });
      }
      placementKeys.add(placement.placementKey);
    }
  });

const PreviewTombstoneSchema = z.strictObject({
  placementKey: z.string().min(1),
  source: AuthoringSourceSchema,
  hiddenBlockType: z.string().min(1).optional(),
  hiddenBlockVersionId: z.string().min(1).optional(),
  trace: z.array(AuthoringTraceStepSchema),
});

export const PreviewPageViewModelSchema = z.strictObject({
  scenarioId: PublicScenarioIdSchema,
  templateId: z.string().min(1),
  pageId: z.string().min(1),
  canonicalUrl: z.string().startsWith('/'),
  resolutionHash: z.string().min(1),
  renderMode: z.literal('preview'),
  editable: z.literal(true),
  matchedVariantRevisionIds: z.array(z.string().min(1)),
  placements: PreviewPlacementListSchema,
  tombstones: z.array(PreviewTombstoneSchema),
});
export type PreviewPageViewModel = z.infer<typeof PreviewPageViewModelSchema>;

export type PreviewNotFoundReason = 'missing' | 'unsupported_pattern';

export type PreviewPageLoadResult =
  | { readonly status: 200; readonly page: PreviewPageViewModel }
  | { readonly status: 404; readonly reason: PreviewNotFoundReason };

const ResolvedSourceInputSchema = z.object({
  kind: z.enum(['default', 'variant']),
  sourceId: z.string().min(1),
  priority: z.int().min(0),
});

const ResolvedTraceInputSchema = z.object({
  kind: z.enum(['default', 'set', 'tombstone', 'order']),
  source: ResolvedSourceInputSchema,
  blockVersionId: z.string().min(1).optional(),
  order: z.int().min(0).optional(),
});

const ResolvedPlacementInputSchema = z.object({
  placementKey: z.string().min(1),
  order: z.int().min(0),
  blockVersion: z.object({
    id: z.string().min(1),
    blockType: z.string().min(1),
  }),
  provenance: z.object({
    content: ResolvedSourceInputSchema,
    order: ResolvedSourceInputSchema,
  }),
  trace: z.array(ResolvedTraceInputSchema),
});

const ResolvedTombstoneInputSchema = z.object({
  placementKey: z.string().min(1),
  source: ResolvedSourceInputSchema,
  hiddenPlacement: z
    .object({
      blockVersion: z.object({
        id: z.string().min(1),
        blockType: z.string().min(1),
      }),
    })
    .optional(),
  trace: z.array(ResolvedTraceInputSchema),
});

const PreviewDraftInputSchema = z.object({
  page: z.object({
    id: z.string().min(1),
    canonicalUrl: z.string().startsWith('/'),
  }),
  document: z.object({
    templateId: z.string().min(1),
    contentHash: z.string().min(1),
    matchedVariantIds: z.array(z.string().min(1)),
    placements: z.array(ResolvedPlacementInputSchema),
    tombstones: z.array(ResolvedTombstoneInputSchema),
  }),
  renderedPlacements: z.array(
    z.object({
      placementKey: z.string().min(1),
      order: z.int().min(0),
      blockType: z.string().min(1),
      blockVersionId: z.string().min(1),
      content: JsonObjectSchema,
    })
  ),
});

function authoringSource(source: z.infer<typeof ResolvedSourceInputSchema>): AuthoringSource {
  return AuthoringSourceSchema.parse({
    kind: source.kind,
    sourceRevisionId: source.sourceId,
    sourcePriority: source.priority,
  });
}

function authoringTrace(
  trace: readonly z.infer<typeof ResolvedTraceInputSchema>[]
): z.infer<typeof AuthoringTraceStepSchema>[] {
  return trace.map((step) =>
    AuthoringTraceStepSchema.parse({
      operationKind: step.kind,
      source: authoringSource(step.source),
      ...(step.blockVersionId === undefined ? {} : { blockVersionId: step.blockVersionId }),
      ...(step.order === undefined ? {} : { order: step.order }),
    })
  );
}

/**
 * Merges rendered (interpolated) content with the resolved authoring document. Identity, resolved
 * sequence, and provenance come from the resolved placements; rendered content is accepted only
 * when its authored order and immutable block version match. The final preview list is then
 * normalized to contiguous ordinals at the same document boundary as publication.
 */
export function createPreviewPageViewModel(input: {
  readonly scenarioId: PreviewPageViewModel['scenarioId'];
  readonly canonicalUrl: string;
  readonly draft: unknown;
}): PreviewPageViewModel {
  const draft = PreviewDraftInputSchema.parse(input.draft);
  if (draft.page.canonicalUrl !== input.canonicalUrl) {
    throw new Error('Preview draft canonical URL does not match the requested route.');
  }

  const renderedByPlacement = new Map(
    draft.renderedPlacements.map((placement) => [placement.placementKey, placement] as const)
  );
  if (
    renderedByPlacement.size !== draft.renderedPlacements.length ||
    renderedByPlacement.size !== draft.document.placements.length
  ) {
    throw new Error('Preview draft requires one rendered placement per resolved placement.');
  }

  const placements = draft.document.placements.map((placement, ordinal) => {
    const rendered = renderedByPlacement.get(placement.placementKey);
    if (
      !rendered ||
      rendered.order !== placement.order ||
      rendered.blockType !== placement.blockVersion.blockType ||
      rendered.blockVersionId !== placement.blockVersion.id
    ) {
      throw new Error(
        `Rendered preview placement "${placement.placementKey}" does not match its resolved authoring placement.`
      );
    }
    return PreviewPlacementSchema.parse({
      ...rendered,
      order: ordinal,
      provenance: {
        content: authoringSource(placement.provenance.content),
        order: authoringSource(placement.provenance.order),
        trace: authoringTrace(placement.trace),
      },
    });
  });

  return PreviewPageViewModelSchema.parse({
    scenarioId: input.scenarioId,
    templateId: draft.document.templateId,
    pageId: draft.page.id,
    canonicalUrl: input.canonicalUrl,
    resolutionHash: draft.document.contentHash,
    renderMode: 'preview',
    editable: true,
    matchedVariantRevisionIds: draft.document.matchedVariantIds,
    placements,
    tombstones: draft.document.tombstones.map((tombstone) => ({
      placementKey: tombstone.placementKey,
      source: authoringSource(tombstone.source),
      ...(tombstone.hiddenPlacement
        ? {
            hiddenBlockType: tombstone.hiddenPlacement.blockVersion.blockType,
            hiddenBlockVersionId: tombstone.hiddenPlacement.blockVersion.id,
          }
        : {}),
      trace: authoringTrace(tombstone.trace),
    })),
  });
}

export function previewHostMatchesTemplate(input: {
  readonly host: string;
  readonly template: PublicTemplateMatch;
  readonly nodeEnv: string | undefined;
  readonly previewEnabled: boolean;
  readonly allowLocalhost?: boolean;
}): boolean {
  const isLocalDevelopment = input.nodeEnv === 'development' || input.nodeEnv === 'test';
  if (!isLocalDevelopment && !input.previewEnabled) return false;
  return publicHostMatchesTemplate(
    input.host,
    input.template,
    isLocalDevelopment ? input.nodeEnv : 'production',
    input.allowLocalhost ?? false
  );
}
