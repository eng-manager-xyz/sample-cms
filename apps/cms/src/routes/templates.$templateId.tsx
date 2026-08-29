import { createFileRoute, notFound } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { TemplateWorkspace } from '@/components/template-workspace';
import {
  getScenarioFixture,
  ScenarioIdSchema,
  TemplateParamsSchema,
} from '@/data/scenario-fixtures';
import { loadCmsHealth } from '@/server-functions/cms.functions';

export const Route = createFileRoute('/templates/$templateId')({
  params: {
    parse: (params) => TemplateParamsSchema.parse(params),
  },
  loader: async ({ params }) => {
    const scenarioId = ScenarioIdSchema.safeParse(params.templateId);
    if (!scenarioId.success) throw notFound();
    return { health: await loadCmsHealth(), scenarioId: scenarioId.data };
  },
  component: TemplateRoute,
});

function TemplateRoute() {
  const { health, scenarioId } = Route.useLoaderData();
  const scenario = getScenarioFixture(scenarioId);

  return (
    <AppShell
      databaseHealthy={health.healthy}
      schemaVersion={health.schemaVersion}
      section="template"
      breadcrumb={scenario.name}
      templateId={scenario.id}
    >
      <TemplateWorkspace key={scenario.id} scenario={scenario} />
    </AppShell>
  );
}
