import { createFileRoute, notFound } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { TemplateWorkspace } from '@/components/template-workspace';
import { TemplateWorkspaceSearchSchema } from '@/data/content-explorer';
import {
  getScenarioFixture,
  ScenarioIdSchema,
  TemplateParamsSchema,
} from '@/data/scenario-fixtures';
import { loadCmsWorkspace } from '@/server-functions/cms.functions';

export const Route = createFileRoute('/templates/$templateId')({
  params: {
    parse: (params) => TemplateParamsSchema.parse(params),
  },
  validateSearch: (search) => TemplateWorkspaceSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ canonicalUrl: search.canonicalUrl }),
  loader: async ({ deps, params }) => {
    const scenarioId = ScenarioIdSchema.safeParse(params.templateId);
    if (!scenarioId.success) throw notFound();
    const workspace = await loadCmsWorkspace({
      data: { scenarioId: scenarioId.data, canonicalUrl: deps.canonicalUrl },
    });
    return { scenarioId: scenarioId.data, workspace };
  },
  component: TemplateRoute,
});

function TemplateRoute() {
  const { scenarioId, workspace } = Route.useLoaderData();
  const scenario = getScenarioFixture(scenarioId);

  return (
    <AppShell section="template" breadcrumb={scenario.name} templateId={scenario.id}>
      <TemplateWorkspace
        key={`${scenario.id}:${workspace.pageId}`}
        scenario={scenario}
        initialWorkspace={workspace}
      />
    </AppShell>
  );
}
