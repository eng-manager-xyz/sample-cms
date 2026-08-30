import { type PublishedDocument, PublishedPlacementSchema } from '@repo/cms-domain';
import * as z from 'zod';
import { PublicScenarioIdSchema } from './public-path';

export const PublicPageViewModelSchema = z.strictObject({
  scenarioId: PublicScenarioIdSchema,
  templateId: z.string().min(1),
  pageId: z.string().min(1),
  publicationId: z.string().min(1),
  canonicalUrl: z.string().startsWith('/'),
  documentHash: z.string().min(1),
  renderMode: z.literal('published'),
  editable: z.literal(false),
  placements: z.array(PublishedPlacementSchema),
});
export type PublicPageViewModel = z.infer<typeof PublicPageViewModelSchema>;

export type PublicNotFoundReason =
  | 'missing'
  | 'not_live'
  | 'archived'
  | 'unpublished'
  | 'unsupported_pattern';

export type PublicPageLoadResult =
  | { readonly status: 200; readonly page: PublicPageViewModel }
  | { readonly status: 404; readonly reason: PublicNotFoundReason };

export function createPublicPageViewModel(input: {
  readonly scenarioId: PublicPageViewModel['scenarioId'];
  readonly publicationId: string;
  readonly canonicalUrl: string;
  readonly documentHash: string;
  readonly document: PublishedDocument;
}): PublicPageViewModel {
  return PublicPageViewModelSchema.parse({
    scenarioId: input.scenarioId,
    templateId: input.document.templateId,
    pageId: input.document.pageId,
    publicationId: input.publicationId,
    canonicalUrl: input.canonicalUrl,
    documentHash: input.documentHash,
    renderMode: 'published',
    editable: false,
    placements: [...input.document.placements],
  });
}
