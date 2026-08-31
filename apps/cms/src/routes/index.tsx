import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { WallOfMaps } from '@/components/wall-of-maps';
import { scenarioFixtures } from '@/data/scenario-fixtures';

export const Route = createFileRoute('/')({
  component: WallOfMapsRoute,
});

function WallOfMapsRoute() {
  return (
    <AppShell section="maps">
      <WallOfMaps templates={scenarioFixtures} />
    </AppShell>
  );
}
