import { createFileRoute, notFound } from '@tanstack/react-router';
import { useState } from 'react';

import { AuthoringStudio } from '@/components/authoring/authoring-studio';
import { AuthoringStudioSearchSchema } from '@/data/authoring-studio';
import {
  getScenarioFixture,
  ScenarioIdSchema,
  TemplateParamsSchema,
} from '@/data/scenario-fixtures';
import { loadCmsWebsiteOrigin, loadCmsWorkspace } from '@/server-functions/cms.functions';
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
    const [websiteOrigin, workspace, explorer] = await Promise.all([
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
      scenarioId: scenarioId.data,
      websiteOrigin,
      workspace,
      pageNavigation: explorer.pageNavigation,
    };
  },
  component: AuthoringRoute,
});

function AuthoringRoute() {
  const { pageNavigation, scenarioId, websiteOrigin, workspace } = Route.useLoaderData();
  const search = Route.useSearch();
  const scenario = getScenarioFixture(scenarioId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  return (
    <AuthoringStudio
      key={`${workspace.pageId}:${workspace.scopeId}`}
      scenario={scenario}
      initialWorkspace={workspace}
      initialInspectorTab={search.panel ?? 'fields'}
      pageNavigation={pageNavigation}
      websiteOrigin={websiteOrigin}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
    />
  );
}
