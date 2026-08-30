import * as z from 'zod';

import { CanonicalUrlSchema } from './content-explorer';
import { ScenarioIdSchema } from './scenario-fixtures';

export const SelectorScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type SelectorScalar = z.infer<typeof SelectorScalarSchema>;

export const SelectorFieldSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['builtin', 'slot', 'tag']),
  cardinality: z.enum(['scalar', 'multi']),
  valueType: z.enum(['string', 'integer', 'boolean']),
  sourceKey: z.string().min(1),
});
export type SelectorField = z.infer<typeof SelectorFieldSchema>;

export const SelectorBuilderClauseSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  operator: z.enum(['=', 'IN']),
  value: z.string(),
});
export type SelectorBuilderClause = z.infer<typeof SelectorBuilderClauseSchema>;

export const SelectorBuilderSchema = z.object({
  combinator: z.enum(['AND', 'OR']),
  clauses: z.array(SelectorBuilderClauseSchema).min(1).max(12),
});
export type SelectorBuilder = z.infer<typeof SelectorBuilderSchema>;

export const SelectorWorkspacePreviewInputSchema = z.object({
  scenarioId: ScenarioIdSchema,
  selector: z.string().trim().min(1).max(2_000),
  priority: z.int().min(1).max(10_000).default(1),
  scopeId: z.string().min(1).max(160).optional(),
  canonicalUrl: CanonicalUrlSchema.optional(),
  sampleLimit: z.int().min(1).max(20).default(10),
});
export type SelectorWorkspacePreviewInput = z.infer<typeof SelectorWorkspacePreviewInputSchema>;

export const SelectorSamplePageSchema = z.object({
  pageId: z.string().min(1),
  canonicalUrl: CanonicalUrlSchema,
  routeStatus: z.enum(['live', 'not_live', 'archived']),
  contextHash: z.string().min(1),
});

export const SelectorOverlapSchema = z.object({
  variantId: z.string().min(1),
  variantRevisionId: z.string().min(1),
  variantName: z.string().min(1),
  priority: z.int().min(1),
  relation: z.enum(['below', 'same', 'above']),
  overlapCount: z.int().min(0),
  sampleUrls: z.array(CanonicalUrlSchema),
  truncated: z.boolean(),
  affectedPlacementCount: z.int().min(0),
  conflictingPlacementKeys: z.array(z.string().min(1)),
});

const SelectorConflictSourceSchema = z.object({
  variantId: z.string().min(1),
  variantRevisionId: z.string().min(1),
  variantName: z.string().min(1),
  operationKinds: z.array(z.enum(['set', 'tombstone', 'order'])).min(1),
});
const SelectorConflictSchema = z.object({
  priority: z.int().min(1),
  placementKey: z.string().min(1),
  overlapCount: z.int().min(1),
  sampleUrls: z.array(CanonicalUrlSchema),
  sources: z.array(SelectorConflictSourceSchema).length(2),
});
export type SelectorConflict = z.infer<typeof SelectorConflictSchema>;

const PlacementTraceStepSchema = z.object({
  kind: z.enum(['default', 'set', 'tombstone', 'order']),
  sourceRevisionId: z.string().min(1),
  sourcePriority: z.int().min(0),
  sourceVariantId: z.string().min(1),
  sourceVariantName: z.string().min(1),
  blockVersionId: z.string().min(1).optional(),
  order: z.int().optional(),
});
export type PlacementTraceStep = z.infer<typeof PlacementTraceStepSchema>;

const SelectorWorkspacePreviewSchema = z.object({
  approvedFields: z.array(SelectorFieldSchema),
  normalizedSelector: z.string().min(1),
  execution: z.object({
    sql: z.string().min(1),
    parameters: z.array(SelectorScalarSchema),
  }),
  totalCount: z.int().min(0),
  templatePageCount: z.int().min(0),
  warnings: z.array(z.enum(['zero_match', 'full_template'])),
  samplePages: z.array(SelectorSamplePageSchema),
  sampleUrls: z.array(CanonicalUrlSchema),
  truncated: z.boolean(),
  selectedPageMatches: z.boolean().nullable(),
  affectedPlacementCount: z.int().min(0),
  overlaps: z.array(SelectorOverlapSchema),
  plan: z.array(
    z.object({
      id: z.int(),
      parent: z.int(),
      detail: z.string().min(1),
    })
  ),
});
export type SelectorWorkspacePreview = z.infer<typeof SelectorWorkspacePreviewSchema>;

const SELECTOR_INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/;

function selectorString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseBuilderValue(value: string, field: SelectorField): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Selector field "${field.name}" requires a value.`);
  }
  if (field.valueType === 'integer') {
    if (!SELECTOR_INTEGER_PATTERN.test(trimmed) || !Number.isSafeInteger(Number(trimmed))) {
      throw new Error(`Selector field "${field.name}" requires a safe integer.`);
    }
    return trimmed;
  }
  if (field.valueType === 'boolean') {
    const normalized = trimmed.toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      throw new Error(`Selector field "${field.name}" requires true or false.`);
    }
    return normalized;
  }
  return selectorString(trimmed);
}

function splitMembershipValues(value: string): readonly string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/** Builds only the same allowlisted predicate grammar accepted by the domain selector parser. */
export function buildGuidedSelector(
  input: SelectorBuilder,
  approvedFields: readonly SelectorField[]
): string {
  const builder = SelectorBuilderSchema.parse(input);
  const fields = new Map(approvedFields.map((field) => [field.name, field] as const));
  const clauses = builder.clauses.map((clause) => {
    const field = fields.get(clause.field);
    if (!field) {
      throw new Error(`Selector field "${clause.field}" is not approved for this template.`);
    }
    if (clause.operator === '=') {
      return `${field.name} = ${parseBuilderValue(clause.value, field)}`;
    }
    const values = splitMembershipValues(clause.value);
    if (values.length === 0) {
      throw new Error(`Selector field "${field.name}" requires at least one IN value.`);
    }
    const formatted = values.map((value) => parseBuilderValue(value, field));
    return `${field.name} IN (${formatted.join(', ')})`;
  });
  return clauses.length === 1 ? (clauses[0] ?? '') : clauses.join(` ${builder.combinator} `);
}
