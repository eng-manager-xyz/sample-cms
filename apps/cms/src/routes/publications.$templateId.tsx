import { createFileRoute, notFound } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { PublicationInspection } from '@/components/publication-inspection';
import {
  getScenarioFixture,
  ScenarioIdSchema,
  TemplateParamsSchema,
} from '@/data/scenario-fixtures';
import { loadCmsWorkspace } from '@/server-functions/cms.functions';

export const Route = createFileRoute('/publications/$templateId')({
  params: {
    parse: (params) => TemplateParamsSchema.parse(params),
  },
  loader: async ({ params }) => {
    const scenarioId = ScenarioIdSchema.safeParse(params.templateId);
    if (!scenarioId.success) throw notFound();
    const workspace = await loadCmsWorkspace({ data: { scenarioId: scenarioId.data } });
    return { scenarioId: scenarioId.data, workspace };
  },
  component: PublicationRoute,
});

function PublicationRoute() {
  const { scenarioId, workspace } = Route.useLoaderData();
  const scenario = getScenarioFixture(scenarioId);

  return (
    <AppShell
      section="publications"
      breadcrumb={`${scenario.name} / Publications`}
      templateId={scenario.id}
    >
      <PublicationInspection key={scenario.id} scenario={scenario} initialWorkspace={workspace} />
    </AppShell>
  );
}
