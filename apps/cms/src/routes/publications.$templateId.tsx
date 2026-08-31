import { createFileRoute, notFound } from '@tanstack/react-router';
import * as z from 'zod';
import { AppShell } from '@/components/app-shell';
import {
  PublicationContextNavigation,
  PublicationHeaderActions,
  PublicationInspection,
} from '@/components/publication-inspection';
import { CanonicalUrlSchema } from '@/data/content-explorer';
import {
  getScenarioFixture,
  ScenarioIdSchema,
  TemplateParamsSchema,
} from '@/data/scenario-fixtures';
import { loadCmsPublicationHistory, loadCmsWorkspace } from '@/server-functions/cms.functions';

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
    const scenarioId = ScenarioIdSchema.safeParse(params.templateId);
    if (!scenarioId.success) throw notFound();
    const workspace = await loadCmsWorkspace({
      data: {
        scenarioId: scenarioId.data,
        ...(deps.canonicalUrl ? { canonicalUrl: deps.canonicalUrl } : {}),
      },
    });
    const history = await loadCmsPublicationHistory({
      data: { scenarioId: scenarioId.data, limit: 50 },
    });
    return { scenarioId: scenarioId.data, workspace, history };
  },
  component: PublicationRoute,
});

function PublicationRoute() {
  const { history, scenarioId, workspace } = Route.useLoaderData();
  const scenario = getScenarioFixture(scenarioId);

  return (
    <AppShell
      section="template"
      templateId={scenario.id}
      headerContent={
        <PublicationContextNavigation
          scenario={scenario}
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
