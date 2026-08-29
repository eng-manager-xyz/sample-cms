import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { WallOfMaps } from '@/components/wall-of-maps';
import { scenarioFixtures } from '@/data/scenario-fixtures';
import { loadCmsHealth } from '@/server-functions/cms.functions';

export const Route = createFileRoute('/')({
  loader: () => loadCmsHealth(),
  component: WallOfMapsRoute,
});

function WallOfMapsRoute() {
  const health = Route.useLoaderData();

  return (
    <AppShell databaseHealthy={health.healthy} schemaVersion={health.schemaVersion} section="maps">
      <WallOfMaps templates={scenarioFixtures} />
    </AppShell>
  );
}
