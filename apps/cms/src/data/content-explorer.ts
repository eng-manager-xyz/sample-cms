import * as z from 'zod';

const CANONICAL_URL_PATTERN = /^\/(?!\/)[^\s?#]*$/;

export const CONTENT_EXPLORER_PAGE_OPTION_LIMIT = 100;
export const CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT = 10;
export const CONTENT_EXPLORER_TAG_SELECTION_LIMIT = 50;
export const CONTENT_EXPLORER_TEMPLATE_LIMIT = 100;

export const FixedTemplateSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
    'Use a lowercase template key with letters, numbers, dashes, or underscores.'
  );
export type FixedTemplateSlug = z.infer<typeof FixedTemplateSlugSchema>;

const SELECTOR_FOCUS_PATTERN = /^selector:(?:[A-Za-z0-9:._~-]|%[0-9A-Fa-f]{2})+$/;

export const CanonicalUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .regex(CANONICAL_URL_PATTERN, 'Use an absolute canonical path without a query or hash.');

const ContentExplorerFocusSchema = z
  .union([
    z.enum(['template', 'pages', 'page', 'selectors']),
    z.string().max(8_192).regex(SELECTOR_FOCUS_PATTERN),
  ])
  .optional();
export type ContentExplorerFocus = z.infer<typeof ContentExplorerFocusSchema>;

export function contentSelectorFocus(selectorId: string): ContentExplorerFocus {
  const encodedSelectorId = encodeURIComponent(selectorId).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return ContentExplorerFocusSchema.parse(`selector:${encodedSelectorId}`);
}

export function selectorIdFromExplorerFocus(focus: ContentExplorerFocus): string | undefined {
  if (!focus?.startsWith('selector:')) return undefined;
  try {
    const selectorId = decodeURIComponent(focus.slice('selector:'.length));
    return selectorId.length > 0 && selectorId.length <= 2_048 ? selectorId : undefined;
  } catch {
    return undefined;
  }
}

export const ContentExplorerSearchSchema = z.object({
  view: z.enum(['tree', 'table', 'selectors']).optional().default('tree'),
  template: FixedTemplateSlugSchema.optional().default('stores'),
  mode: z.enum(['browse', 'create']).optional(),
  createStep: z.enum(['identity', 'slots', 'sources', 'review']).optional(),
  canonicalUrl: CanonicalUrlSchema.optional(),
  focus: ContentExplorerFocusSchema,
  q: z.string().trim().max(120).optional().default(''),
  cursor: z.string().max(1_024).optional(),
});
export type ContentExplorerSearch = z.infer<typeof ContentExplorerSearchSchema>;

export const ContentExplorerInputSchema = z.object({
  template: FixedTemplateSlugSchema,
  q: z.string().trim().max(120).default(''),
  cursor: z.string().max(1_024).optional(),
  limit: z.int().min(1).max(50).default(20),
  selectedCanonicalUrl: CanonicalUrlSchema.optional(),
  includeSelectors: z.boolean().optional(),
  selectorMetricsFor: z.string().min(1).max(2_048).optional(),
});
export type ContentExplorerInput = z.infer<typeof ContentExplorerInputSchema>;

export const TemplateWorkspaceSearchSchema = z.object({
  canonicalUrl: CanonicalUrlSchema.optional(),
});

const ContentTemplateSlotSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['static', 'variable', 'derived']),
  pathPosition: z.int().min(0).nullable(),
  staticValue: z.string().nullable(),
});

const ContentGrammarSegmentSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['static', 'variable']),
  value: z.string().min(1),
});

const ContentTemplateSummarySchema = z.object({
  slug: FixedTemplateSlugSchema,
  templateId: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  urlPattern: CanonicalUrlSchema,
  description: z.string(),
  status: z.enum(['active', 'archived']),
  updatedAt: z.string().min(1),
  slots: z.array(ContentTemplateSlotSchema),
  grammar: z.array(ContentGrammarSegmentSchema).min(1),
  pageCount: z.int().min(0),
  livePageCount: z.int().min(0),
  notLivePageCount: z.int().min(0),
  archivedPageCount: z.int().min(0),
  variantCount: z.int().min(0),
  activeVariantCount: z.int().min(0),
  draftVariantCount: z.int().min(0),
  publicationState: z.enum(['published', 'unpublished']),
  currentPublicationId: z.string().min(1).nullable(),
  publishedAt: z.string().min(1).nullable(),
  publishedPageCount: z.int().min(0),
  draftState: z.enum(['current', 'changes', 'unpublished']),
});
export type ContentTemplateSummary = z.infer<typeof ContentTemplateSummarySchema>;

const ContentPageTagSchema = z.object({
  id: z.string().min(1),
  namespace: z.string().min(1),
  value: z.string().min(1),
  label: z.string().min(1),
});
const ContentExplorerPageSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  canonicalUrl: CanonicalUrlSchema,
  routeStatus: z.enum(['live', 'not_live', 'archived']),
  routeRevision: z.string().min(1),
  updatedAt: z.string().min(1),
  segments: z.array(z.string().min(1)).min(1),
  publicationState: z.enum(['published', 'not_published']),
  documentHash: z.string().min(1).nullable(),
  slotValues: z.record(z.string().min(1), z.string()),
  tags: z.array(ContentPageTagSchema),
});
export type ContentExplorerPage = z.infer<typeof ContentExplorerPageSchema>;

const ContentPageNavigationSegmentSchema = z.object({
  slotId: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['static', 'variable']),
  pathPosition: z.int().min(0),
  staticValue: z.string().nullable(),
  defaultValue: z.string().nullable(),
  selectedValue: z.string().nullable(),
});
const ContentPageNavigationOptionSchema = z.object({
  pageId: z.string().min(1),
  canonicalUrl: CanonicalUrlSchema,
  routeStatus: z.enum(['live', 'not_live', 'archived']),
  slotValues: z.record(z.string().min(1), z.string()),
});
export type ContentPageNavigationOption = z.infer<typeof ContentPageNavigationOptionSchema>;

export const ContentPageNavigationSchema = z.object({
  segments: z.array(ContentPageNavigationSegmentSchema),
  defaultPage: ContentPageNavigationOptionSchema.nullable(),
  selectedPage: ContentPageNavigationOptionSchema.nullable(),
  options: z.array(ContentPageNavigationOptionSchema).max(CONTENT_EXPLORER_PAGE_OPTION_LIMIT),
  totalCount: z.int().min(0),
  truncated: z.boolean(),
});
export type ContentPageNavigation = z.infer<typeof ContentPageNavigationSchema>;

export const ContentSelectorSummarySchema = z.object({
  id: z.string().min(1).max(2_048),
  activeRevisionId: z.string().min(1),
  name: z.string().min(1),
  isDefault: z.boolean(),
  priority: z.int().min(0),
  status: z.enum(['draft', 'active']),
  selector: z.string().trim().min(1).max(4_096),
  metricsLoaded: z.boolean(),
  exactMatchCount: z.int().min(0).nullable(),
  affectedPlacementCount: z.int().min(0),
  selectedPageMatches: z.boolean().nullable(),
  sampleCanonicalUrls: z.array(CanonicalUrlSchema).max(CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT),
  sampleUrlsTruncated: z.boolean(),
});
export type ContentSelectorSummary = z.infer<typeof ContentSelectorSummarySchema>;

export const ContentExplorerSnapshotSchema = z.object({
  templates: z.array(ContentTemplateSummarySchema).min(1).max(CONTENT_EXPLORER_TEMPLATE_LIMIT),
  templateCount: z.int().min(1),
  templatesTruncated: z.boolean(),
  selectedTemplate: FixedTemplateSlugSchema,
  query: z.string().max(120),
  pageNavigation: ContentPageNavigationSchema,
  selectedPageDetail: ContentExplorerPageSchema.nullable(),
  selectors: z.array(ContentSelectorSummarySchema),
  pages: z.array(ContentExplorerPageSchema).max(50),
  filteredCount: z.int().min(0),
  previousCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
});
export type ContentExplorerSnapshot = z.infer<typeof ContentExplorerSnapshotSchema>;

const TemplateProvisioningIdSchema = z.string().trim().max(128);

const TemplateProvisioningSlotKeySchema = z.string().trim().max(64);

const TemplateProvisioningStaticSlotSchema = z.object({
  id: TemplateProvisioningIdSchema,
  key: TemplateProvisioningSlotKeySchema,
  label: z.string().trim().max(80),
  kind: z.literal('static'),
  staticValue: z.string().trim().max(240),
});

const TemplateProvisioningVariableSlotSchema = z.object({
  id: TemplateProvisioningIdSchema,
  key: TemplateProvisioningSlotKeySchema,
  label: z.string().trim().max(80),
  kind: z.literal('variable'),
  variableKind: z.enum(['locale', 'slug']),
});

const TemplateProvisioningSlotSchema = z.discriminatedUnion('kind', [
  TemplateProvisioningStaticSlotSchema,
  TemplateProvisioningVariableSlotSchema,
]);
export type TemplateProvisioningSlot = z.infer<typeof TemplateProvisioningSlotSchema>;

export const TemplateCreationInputSchema = z.object({
  template: z.object({
    id: TemplateProvisioningIdSchema,
    key: z.string().trim().max(64),
    name: z.string().trim().max(120),
    domain: z.string().trim().max(253),
    description: z.string().trim().max(500).optional(),
  }),
  slots: z.array(TemplateProvisioningSlotSchema).min(1).max(24),
  localeCsv: z.string().max(5_000_000).optional(),
  slugCsv: z.string().max(50_000_000).optional(),
});
export type TemplateCreationInput = z.infer<typeof TemplateCreationInputSchema>;

const TemplateProvisioningErrorSchema = z.object({
  path: z.string().min(1),
  message: z.string().min(1),
});

export const TemplateCreationPreviewSchema = z.object({
  fingerprint: z.string().min(1),
  urlPattern: CanonicalUrlSchema,
  cardinality: z.int().min(0),
  sampleCanonicalUrls: z.array(CanonicalUrlSchema).max(20),
  errors: z.array(TemplateProvisioningErrorSchema),
  localeCount: z.int().min(0),
  slugCount: z.int().min(0),
});
export type TemplateCreationPreview = z.infer<typeof TemplateCreationPreviewSchema>;

export const TemplateCreationCommitSchema = z.object({
  input: TemplateCreationInputSchema,
  previewFingerprint: z.string().min(1),
});
export type TemplateCreationCommit = z.infer<typeof TemplateCreationCommitSchema>;

export const TemplateCreationResultSchema = z.object({
  templateId: z.string().min(1),
  templateKey: FixedTemplateSlugSchema,
  defaultVariantId: z.string().min(1),
  pageCount: z.int().min(0),
  firstCanonicalUrl: CanonicalUrlSchema.nullable(),
});
export type TemplateCreationResult = z.infer<typeof TemplateCreationResultSchema>;

export const TemplatePageTagMutationInputSchema = z.object({
  template: FixedTemplateSlugSchema,
  pageIds: z.array(z.string().min(1).max(512)).min(1).max(CONTENT_EXPLORER_TAG_SELECTION_LIMIT),
  mode: z.enum(['add', 'remove']),
  values: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(120)
        .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use a simple tag value.')
    )
    .min(1)
    .max(50)
    .transform((values) => [...new Set(values.map((value) => value.toLowerCase()))]),
});
export type TemplatePageTagMutationInput = z.infer<typeof TemplatePageTagMutationInputSchema>;

export const CONTENT_EXPLORER_TAG_SELECTOR_IMPACT_LIMIT = 50;

const TemplatePageTagSelectorImpactSchema = z.object({
  selectorId: z.string().min(1),
  selectorName: z.string().min(1),
  priority: z.int().min(1),
  beforeMatchCount: z.int().min(0),
  afterMatchCount: z.int().min(0),
  beforeSelectedPageMatchCount: z.int().min(0).max(CONTENT_EXPLORER_TAG_SELECTION_LIMIT),
  afterSelectedPageMatchCount: z.int().min(0).max(CONTENT_EXPLORER_TAG_SELECTION_LIMIT),
});
export type TemplatePageTagSelectorImpact = z.infer<typeof TemplatePageTagSelectorImpactSchema>;

export const TemplatePageTagMutationResultSchema = z.object({
  selectedPageCount: z.int().min(1).max(CONTENT_EXPLORER_TAG_SELECTION_LIMIT),
  tagCount: z.int().min(1),
  changedAssignmentCount: z.int().min(0),
  unchangedAssignmentCount: z.int().min(0),
  selectorImpacts: z
    .array(TemplatePageTagSelectorImpactSchema)
    .max(CONTENT_EXPLORER_TAG_SELECTOR_IMPACT_LIMIT),
  selectorImpactTotalCount: z.int().min(0),
  selectorImpactsTruncated: z.boolean(),
});
export type TemplatePageTagMutationResult = z.infer<typeof TemplatePageTagMutationResultSchema>;

export function templateProvisioningCsvHint(kind: 'locale' | 'slug'): string {
  return kind === 'locale'
    ? 'Header: locale. One unique locale per row, for example en-US.'
    : 'Header: slug. One unique URL-safe slug per row, for example downtown-seattle.';
}

export function parseTagValues(value: string): readonly string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

export function canonicalUrlSegments(canonicalUrl: string): readonly string[] {
  return CanonicalUrlSchema.parse(canonicalUrl).split('/').filter(Boolean);
}
