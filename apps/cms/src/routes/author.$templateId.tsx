import { createFileRoute, notFound } from '@tanstack/react-router';

import { AppShell } from '@/components/app-shell';
import { AuthoringStudio } from '@/components/authoring/authoring-studio';
import { AuthoringStudioSearchSchema } from '@/data/authoring-studio';
import {
  getScenarioFixture,
  ScenarioIdSchema,
  TemplateParamsSchema,
} from '@/data/scenario-fixtures';
import {
  loadCmsHealth,
  loadCmsWebsiteOrigin,
  loadCmsWorkspace,
} from '@/server-functions/cms.functions';
import { loadContentExplorer } from '@/server-functions/content.functions';

export const Route = createFileRoute('/author/$templateId')({
  params: {
    parse: (params) => TemplateParamsSchema.parse(params),
  },
  validateSearch: (search) => AuthoringStudioSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    canonicalUrl: search.canonicalUrl,
    scopeId: search.scopeId,
  }),
  loader: async ({ deps, params }) => {
    const scenarioId = ScenarioIdSchema.safeParse(params.templateId);
    if (!scenarioId.success) throw notFound();
    const [health, websiteOrigin, workspace, explorer] = await Promise.all([
      loadCmsHealth(),
      loadCmsWebsiteOrigin(),
      loadCmsWorkspace({
        data: {
          scenarioId: scenarioId.data,
          ...(deps.canonicalUrl ? { canonicalUrl: deps.canonicalUrl } : {}),
          ...(deps.scopeId ? { scopeId: deps.scopeId } : {}),
        },
      }),
      loadContentExplorer({
        data: {
          template: scenarioId.data,
          q: '',
          limit: 1,
          selectedCanonicalUrl: deps.canonicalUrl,
          includeSelectors: false,
        },
      }),
    ]);
    return {
      health,
      scenarioId: scenarioId.data,
      websiteOrigin,
      workspace,
      pageNavigation: explorer.pageNavigation,
    };
  },
  component: AuthoringRoute,
});

function AuthoringRoute() {
  const { health, pageNavigation, scenarioId, websiteOrigin, workspace } = Route.useLoaderData();
  const search = Route.useSearch();
  const scenario = getScenarioFixture(scenarioId);
  return (
    <AppShell
      databaseHealthy={health.healthy}
      schemaVersion={health.schemaVersion}
      section="template"
      breadcrumb={`${scenario.name} · Authoring`}
      templateId={scenario.id}
    >
      <AuthoringStudio
        key={`${workspace.pageId}:${workspace.scopeId}`}
        scenario={scenario}
        initialWorkspace={workspace}
        initialInspectorTab={search.panel ?? 'fields'}
        pageNavigation={pageNavigation}
        websiteOrigin={websiteOrigin}
      />
    </AppShell>
  );
}
