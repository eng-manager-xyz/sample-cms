import * as z from 'zod';

const CANONICAL_URL_PATTERN = /^\/(?!\/)[^\s?#]*$/;

export const FixedTemplateSlugSchema = z.enum(['stores', 'eligible-vehicles', 'structural-proof']);
export type FixedTemplateSlug = z.infer<typeof FixedTemplateSlugSchema>;

export const CanonicalUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .regex(CANONICAL_URL_PATTERN, 'Use an absolute canonical path without a query or hash.');

export const ContentExplorerSearchSchema = z.object({
  view: z.enum(['tree', 'table']).optional().default('tree'),
  template: FixedTemplateSlugSchema.optional().default('stores'),
  q: z.string().trim().max(120).optional().default(''),
  cursor: z.string().max(1_024).optional(),
});
export type ContentExplorerSearch = z.infer<typeof ContentExplorerSearchSchema>;

export const ContentExplorerInputSchema = z.object({
  template: FixedTemplateSlugSchema,
  q: z.string().trim().max(120).default(''),
  cursor: z.string().max(1_024).optional(),
  limit: z.int().min(1).max(50).default(20),
});
export type ContentExplorerInput = z.infer<typeof ContentExplorerInputSchema>;

export const TemplateWorkspaceSearchSchema = z.object({
  canonicalUrl: CanonicalUrlSchema.optional(),
});
export type TemplateWorkspaceSearch = z.infer<typeof TemplateWorkspaceSearchSchema>;

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

export const ContentTemplateSummarySchema = z.object({
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

export const ContentExplorerPageSchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  canonicalUrl: CanonicalUrlSchema,
  routeStatus: z.enum(['live', 'not_live', 'archived']),
  routeRevision: z.string().min(1),
  updatedAt: z.string().min(1),
  segments: z.array(z.string().min(1)).min(1),
  publicationState: z.enum(['published', 'not_published']),
  documentHash: z.string().min(1).nullable(),
});
export type ContentExplorerPage = z.infer<typeof ContentExplorerPageSchema>;

export const ContentExplorerSnapshotSchema = z.object({
  templates: z.array(ContentTemplateSummarySchema).length(3),
  selectedTemplate: FixedTemplateSlugSchema,
  query: z.string().max(120),
  pages: z.array(ContentExplorerPageSchema).max(50),
  filteredCount: z.int().min(0),
  previousCursor: z.string().nullable(),
  nextCursor: z.string().nullable(),
});
export type ContentExplorerSnapshot = z.infer<typeof ContentExplorerSnapshotSchema>;

export function canonicalUrlSegments(canonicalUrl: string): readonly string[] {
  return CanonicalUrlSchema.parse(canonicalUrl).split('/').filter(Boolean);
}
