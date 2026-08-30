import type { PreviewPageViewModel } from '@/data/preview-page';
import { PublishedPage } from './published-page';

export function PreviewPage({ page }: Readonly<{ page: PreviewPageViewModel }>) {
  return (
    <div className="preview-shell" data-preview-resolution={page.resolutionHash}>
      <aside className="preview-toolbar" aria-label="Authoring preview status">
        <div className="preview-toolbar__status">
          <span className="preview-toolbar__dot" aria-hidden="true" />
          <div>
            <strong>Unpublished authoring preview</strong>
            <code>{page.canonicalUrl}</code>
          </div>
        </div>
        <dl className="preview-toolbar__facts">
          <div>
            <dt>placements</dt>
            <dd>{page.placements.length}</dd>
          </div>
          <div>
            <dt>variants</dt>
            <dd>{page.matchedVariantRevisionIds.length}</dd>
          </div>
          <div>
            <dt>hidden</dt>
            <dd>{page.tombstones.length}</dd>
          </div>
        </dl>
        <nav className="preview-toolbar__actions" aria-label="Preview actions">
          <a href="/admin">CMS gateway</a>
          <a href={page.canonicalUrl}>View published ↗</a>
        </nav>
      </aside>

      <PublishedPage page={page} />

      <details className="preview-provenance" id="draft-details">
        <summary>
          <span>Draft resolution</span>
          <code>{page.resolutionHash.slice(0, 12)}</code>
          <span>{page.placements.length} visible placements</span>
        </summary>
        <div className="preview-provenance__body">
          <header>
            <p className="site-eyebrow">Current authoring graph</p>
            <h2>Why each block appears here</h2>
            <p>
              Content and order provenance come from the draft resolver. This panel is intentionally
              absent from the public response.
            </p>
          </header>
          <ol>
            {page.placements.map((placement) => (
              <li key={placement.placementKey}>
                <span>{String(placement.order + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{placement.placementKey}</strong>
                  <code>{placement.blockType}</code>
                </div>
                <dl>
                  <div>
                    <dt>content</dt>
                    <dd>
                      {placement.provenance.content.kind} · p
                      {placement.provenance.content.sourcePriority}
                    </dd>
                  </div>
                  <div>
                    <dt>order</dt>
                    <dd>
                      {placement.provenance.order.kind} · p
                      {placement.provenance.order.sourcePriority}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
          {page.tombstones.length > 0 ? (
            <section className="preview-provenance__tombstones">
              <h3>Hidden placements</h3>
              <ul>
                {page.tombstones.map((tombstone) => (
                  <li key={tombstone.placementKey}>
                    <code>{tombstone.placementKey}</code>
                    <span>
                      {tombstone.source.kind} · p{tombstone.source.sourcePriority}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </details>
    </div>
  );
}
