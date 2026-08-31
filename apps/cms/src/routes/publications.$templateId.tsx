import { createFileRoute, notFound } from '@tanstack/react-router';
import * as z from 'zod';
import { AppShell } from '@/components/app-shell';
import {
  PublicationContextNavigation,
  PublicationHeaderActions,
  PublicationInspection,
} from '@/components/publication-inspection';
import { CanonicalUrlSchema } from '@/data/content-explorer';
import { TemplateKeySchema, TemplateParamsSchema } from '@/data/scenario-fixtures';
import { loadCmsPublicationHistory, loadCmsWorkspace } from '@/server-functions/cms.functions';
import { loadContentExplorer } from '@/server-functions/content.functions';

const PublicationHistorySearchSchema = z.object({
  canonicalUrl: CanonicalUrlSchema.optional(),
});

export const Route = createFileRoute('/publications/$templateId')({
  params: {
    parse: (params) => TemplateParamsSchema.parse(params),
  },
  validateSearch: (search) => PublicationHistorySearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ canonicalUrl: search.canonicalUrl }),
  loader: async ({ deps, params }) => {
    const scenarioId = TemplateKeySchema.safeParse(params.templateId);
    if (!scenarioId.success) throw notFound();
    const [workspace, history, explorer] = await Promise.all([
      loadCmsWorkspace({
        data: {
          scenarioId: scenarioId.data,
          ...(deps.canonicalUrl ? { canonicalUrl: deps.canonicalUrl } : {}),
        },
      }),
      loadCmsPublicationHistory({ data: { scenarioId: scenarioId.data, limit: 50 } }),
      loadContentExplorer({
        data: {
          template: scenarioId.data,
          q: '',
          limit: 1,
          selectedCanonicalUrl: deps.canonicalUrl,
        },
      }),
    ]);
    return { scenarioId: scenarioId.data, workspace, history, templates: explorer.templates };
  },
  component: PublicationRoute,
});

function PublicationRoute() {
  const { history, scenarioId, templates, workspace } = Route.useLoaderData();
  const loadedTemplate = templates.find((template) => template.slug === scenarioId);
  if (!loadedTemplate) throw new Error(`Template "${scenarioId}" was not loaded.`);
  const scenario = { id: loadedTemplate.slug, name: loadedTemplate.name };
  const templateOptions = templates.map((template) => ({ id: template.slug, name: template.name }));

  return (
    <AppShell
      section="template"
      templateId={scenario.id}
      headerContent={
        <PublicationContextNavigation
          scenario={scenario}
          scenarios={templateOptions}
          canonicalUrl={workspace.canonicalUrl}
          releaseCount={history.total}
        />
      }
      headerActions={
        <PublicationHeaderActions scenarioId={scenario.id} canonicalUrl={workspace.canonicalUrl} />
      }
    >
      <PublicationInspection
        key={scenario.id}
        scenario={scenario}
        workspace={workspace}
        history={history}
      />
    </AppShell>
  );
}
