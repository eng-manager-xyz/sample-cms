import type { PublicPageViewModel } from '@/data/public-page';

function compactHash(hash: string): string {
  return hash.length > 18 ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}

export function PublicationDrawer({ page }: Readonly<{ page: PublicPageViewModel }>) {
  return (
    <details className="publication-drawer" id="publication-details">
      <summary>
        <span className="publication-drawer__pulse" />
        Published page
        <code>{compactHash(page.documentHash)}</code>
        <span className="publication-drawer__chevron" aria-hidden="true">
          ↑
        </span>
      </summary>
      <div className="publication-drawer__panel">
        <header>
          <div>
            <p className="site-eyebrow">Read-only delivery trace</p>
            <h2>Materialized publication</h2>
          </div>
          <span className="publication-drawer__badge">Selector SQL: 0</span>
        </header>
        <dl>
          <div>
            <dt>Canonical URL</dt>
            <dd>{page.canonicalUrl}</dd>
          </div>
          <div>
            <dt>Template</dt>
            <dd>{page.templateId}</dd>
          </div>
          <div>
            <dt>Publication</dt>
            <dd>{page.publicationId}</dd>
          </div>
          <div>
            <dt>Document hash</dt>
            <dd>{page.documentHash}</dd>
          </div>
        </dl>
        <div className="publication-drawer__placements">
          {page.placements.map((placement) => (
            <article key={placement.placementKey}>
              <span>{placement.order}</span>
              <div>
                <strong>{placement.placementKey}</strong>
                <small>
                  {placement.blockType} · priority {placement.provenance.sourcePriority}
                </small>
              </div>
              <code>{compactHash(placement.blockVersionId)}</code>
            </article>
          ))}
        </div>
      </div>
    </details>
  );
}
