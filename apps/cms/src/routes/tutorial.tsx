import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { TutorialReport } from '@/components/tutorial/tutorial-report';
import { loadCmsHealth } from '@/server-functions/cms.functions';

export const Route = createFileRoute('/tutorial')({
  head: () => ({
    meta: [
      { title: 'Auteur | Architecture Tutorial' },
      {
        name: 'description',
        content:
          "A progressive field guide to Auteur's selector-scoped content architecture and authoring workflow.",
      },
    ],
  }),
  loader: () => loadCmsHealth(),
  component: TutorialRoute,
});

function TutorialRoute() {
  const health = Route.useLoaderData();

  return (
    <AppShell
      databaseHealthy={health.healthy}
      schemaVersion={health.schemaVersion}
      section="tutorial"
      breadcrumb="Architecture tutorial"
    >
      <TutorialReport health={health} />
    </AppShell>
  );
}
