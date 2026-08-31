import { CMS_RENDERED_PAGE_CLASS } from '@repo/cms-renderer';
import type { WebsitePageViewModel } from '@/data/website-page';
import { PublishedBlock } from './block-renderer';
import { PublicationDrawer } from './publication-drawer';

export function PublishedPage({ page }: Readonly<{ page: WebsitePageViewModel }>) {
  return (
    <div
      className={`${CMS_RENDERED_PAGE_CLASS} published-page published-page--${page.scenarioId}`}
      data-cms-mode={page.renderMode}
      data-cms-editable={String(page.editable)}
      id="overview"
    >
      <main>
        {page.placements.map((placement) => (
          <PublishedBlock key={placement.placementKey} page={page} placement={placement} />
        ))}
      </main>
      {page.renderMode === 'published' ? <PublicationDrawer page={page} /> : null}
    </div>
  );
}
