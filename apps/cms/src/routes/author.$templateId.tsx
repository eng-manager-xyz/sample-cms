import { createFileRoute, notFound } from '@tanstack/react-router';
import { useState } from 'react';

import { AuthoringStudio } from '@/components/authoring/authoring-studio';
import { AuthoringStudioSearchSchema } from '@/data/authoring-studio';
import { TemplateKeySchema, TemplateParamsSchema } from '@/data/scenario-fixtures';
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
    const templateKey = TemplateKeySchema.safeParse(params.templateId);
    if (!templateKey.success) throw notFound();
    const [websiteOrigin, workspace, explorer] = await Promise.all([
      loadCmsWebsiteOrigin(),
      loadCmsWorkspace({
        data: {
          scenarioId: templateKey.data,
          ...(deps.canonicalUrl ? { canonicalUrl: deps.canonicalUrl } : {}),
          ...(deps.scopeId ? { scopeId: deps.scopeId } : {}),
        },
      }),
      loadContentExplorer({
        data: {
          template: templateKey.data,
          q: '',
          limit: 1,
          selectedCanonicalUrl: deps.canonicalUrl,
          includeSelectors: false,
        },
      }),
    ]);
    return {
      scenarioId: templateKey.data,
      websiteOrigin,
      workspace,
      pageNavigation: explorer.pageNavigation,
      templates: explorer.templates,
    };
  },
  component: AuthoringRoute,
});

function AuthoringRoute() {
  const { pageNavigation, scenarioId, templates, websiteOrigin, workspace } = Route.useLoaderData();
  const search = Route.useSearch();
  const loadedTemplate = templates.find((template) => template.slug === scenarioId);
  if (!loadedTemplate) throw new Error(`Template "${scenarioId}" was not loaded.`);
  const scenario = { id: loadedTemplate.slug, name: loadedTemplate.name };
  const templateOptions = templates.map((template) => ({
    id: template.slug,
    name: template.name,
  }));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  return (
    <AuthoringStudio
      key={`${workspace.pageId}:${workspace.scopeId}`}
      scenario={scenario}
      scenarios={templateOptions}
      initialWorkspace={workspace}
      initialInspectorTab={search.panel ?? 'fields'}
      pageNavigation={pageNavigation}
      websiteOrigin={websiteOrigin}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
      inspectorCollapsed={inspectorCollapsed}
      onInspectorCollapsedChange={setInspectorCollapsed}
    />
  );
}
