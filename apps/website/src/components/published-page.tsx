import type { PublicPageViewModel } from '@/data/public-page';
import { PublishedBlock } from './block-renderer';
import { PublicationDrawer } from './publication-drawer';

export function PublishedPage({ page }: Readonly<{ page: PublicPageViewModel }>) {
  return (
    <div
      className={`published-page published-page--${page.scenarioId}`}
      data-cms-mode={page.renderMode}
      data-cms-editable={String(page.editable)}
      id="overview"
    >
      <main>
        {page.placements.map((placement) => (
          <PublishedBlock key={placement.placementKey} page={page} placement={placement} />
        ))}
      </main>
      <PublicationDrawer page={page} />
    </div>
  );
}
