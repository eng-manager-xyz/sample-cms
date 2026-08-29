import { createFileRoute, notFound } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { PublicationInspection } from '@/components/publication-inspection';
import {
  getScenarioFixture,
  ScenarioIdSchema,
  TemplateParamsSchema,
} from '@/data/scenario-fixtures';
import { loadCmsHealth } from '@/server-functions/cms.functions';

export const Route = createFileRoute('/publications/$templateId')({
  params: {
    parse: (params) => TemplateParamsSchema.parse(params),
  },
  loader: async ({ params }) => {
    const scenarioId = ScenarioIdSchema.safeParse(params.templateId);
    if (!scenarioId.success) throw notFound();
    return { health: await loadCmsHealth(), scenarioId: scenarioId.data };
  },
  component: PublicationRoute,
});

function PublicationRoute() {
  const { health, scenarioId } = Route.useLoaderData();
  const scenario = getScenarioFixture(scenarioId);

  return (
    <AppShell
      databaseHealthy={health.healthy}
      schemaVersion={health.schemaVersion}
      section="publications"
      breadcrumb={`${scenario.name} / Publications`}
      templateId={scenario.id}
    >
      <PublicationInspection key={scenario.id} scenario={scenario} />
    </AppShell>
  );
}
