import * as z from 'zod';
import { PreviewPageViewModelSchema } from './preview-page';
import { PublicPageViewModelSchema } from './public-page';

export const WebsitePageViewModelSchema = z.discriminatedUnion('renderMode', [
  PublicPageViewModelSchema,
  PreviewPageViewModelSchema,
]);

export type WebsitePageViewModel = z.infer<typeof WebsitePageViewModelSchema>;
export type WebsitePlacement = WebsitePageViewModel['placements'][number];
