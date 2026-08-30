import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import * as z from 'zod';
import { PreviewPage } from '@/components/preview-page';
import { canonicalPathFromSplat } from '@/data/public-path';
import { loadPreviewPage } from '@/server-functions/preview-page.functions';

const PreviewSplatParamsSchema = z.object({
  _splat: z.string().min(1),
});

export const Route = createFileRoute('/cms-preview_/$')({
  params: {
    parse: (params) => PreviewSplatParamsSchema.parse(params),
  },
  validateSearch: () => ({}),
  loader: async ({ params }) => {
    const result = await loadPreviewPage({
      data: { canonicalUrl: canonicalPathFromSplat(params._splat) },
    });
    if (result.status === 404) throw notFound();
    return result.page;
  },
  component: PreviewWebsiteRoute,
  notFoundComponent: PreviewNotFound,
});

function PreviewWebsiteRoute() {
  return <PreviewPage page={Route.useLoaderData()} />;
}

function PreviewNotFound() {
  return (
    <main className="system-state system-state--preview">
      <div className="system-state__card">
        <span className="system-state__code">404 · Preview unavailable</span>
        <h1>This draft cannot be previewed.</h1>
        <p>
          The route is unsupported, the authoring page is missing, or preview access is disabled for
          this environment and host.
        </p>
        <div className="system-state__actions">
          <Link className="system-state__primary" to="/cms-preview_">
            View preview examples
          </Link>
          <Link to="/admin">Check CMS gateway</Link>
        </div>
      </div>
    </main>
  );
}
