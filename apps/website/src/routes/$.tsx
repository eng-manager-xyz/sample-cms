import { createFileRoute, notFound } from '@tanstack/react-router';
import * as z from 'zod';
import { PublishedPage } from '@/components/published-page';
import { canonicalPathFromSplat } from '@/data/public-path';
import { loadPublishedPage } from '@/server-functions/published-page.functions';

const SplatParamsSchema = z.object({
  _splat: z.string().min(1),
});

export const Route = createFileRoute('/$')({
  params: {
    parse: (params) => SplatParamsSchema.parse(params),
  },
  validateSearch: () => ({}),
  loader: async ({ params }) => {
    const result = await loadPublishedPage({
      data: { canonicalUrl: canonicalPathFromSplat(params._splat) },
    });
    if (result.status === 404) throw notFound();
    return result.page;
  },
  component: PublishedWebsiteRoute,
});

function PublishedWebsiteRoute() {
  const page = Route.useLoaderData();
  return <PublishedPage page={page} />;
}
