import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { ContentExplorer } from '@/components/content-explorer';
import { ContentExplorerSearchSchema } from '@/data/content-explorer';
import { loadCmsHealth } from '@/server-functions/cms.functions';
import { loadContentExplorer } from '@/server-functions/content.functions';

export const Route = createFileRoute('/content')({
  validateSearch: (search) => ContentExplorerSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    view: search.view,
    template: search.template,
    canonicalUrl: search.canonicalUrl,
    q: search.q,
    cursor: search.cursor,
  }),
  loader: async ({ deps }) => {
    const [health, snapshot] = await Promise.all([
      loadCmsHealth(),
      loadContentExplorer({
        data: {
          template: deps.template,
          q: deps.q,
          cursor: deps.cursor,
          limit: 20,
          selectedCanonicalUrl: deps.canonicalUrl,
          includeSelectors: deps.view === 'selectors',
        },
      }),
    ]);
    return { health, snapshot };
  },
  component: ContentExplorerRoute,
});

function ContentExplorerRoute() {
  const { health, snapshot } = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <AppShell
      databaseHealthy={health.healthy}
      schemaVersion={health.schemaVersion}
      section="content"
      breadcrumb="Content explorer"
      templateId={search.template}
    >
      <ContentExplorer snapshot={snapshot} search={search} />
    </AppShell>
  );
}
