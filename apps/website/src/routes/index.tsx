import { createFileRoute, Link } from '@tanstack/react-router';
import { representativePages } from '@/data/public-path';

export const Route = createFileRoute('/')({
  component: WebsiteIndex,
});

function IndexMark() {
  return (
    <span className="index-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function WebsiteIndex() {
  return (
    <main className="website-index">
      <nav className="index-nav">
        <Link to="/" className="index-nav__brand">
          <IndexMark />
          <span>Auteur Websites</span>
        </Link>
        <Link to="/admin" className="index-nav__admin">
          Open CMS <span aria-hidden="true">↗</span>
        </Link>
      </nav>

      <section className="index-hero">
        <div className="index-hero__copy">
          <p className="site-eyebrow">SQLite → publication → webpage</p>
          <h1>
            One block model.
            <br />
            Three live patterns.
          </h1>
          <p>
            These routes do not resolve selectors or inspect drafts. TanStack reads the active,
            immutable publication and synchronously dispatches each placement through a small block
            registry.
          </p>
        </div>
        <aside className="index-hero__proof" aria-label="Public delivery contract">
          <span>Public request</span>
          <i aria-hidden="true">→</i>
          <span>1–2 SQLite reads</span>
          <i aria-hidden="true">→</i>
          <span>React blocks</span>
          <strong>0 selector queries</strong>
        </aside>
      </section>

      <section className="example-grid" aria-labelledby="examples-title">
        <header>
          <p className="site-eyebrow">Published examples</p>
          <h2 id="examples-title">Choose a route pattern</h2>
        </header>
        <div className="example-grid__cards">
          {representativePages.map((page, index) => (
            <Link
              className={`example-card example-card--${page.accent}`}
              to="/$"
              params={{ _splat: page.canonicalUrl.slice(1) }}
              key={page.canonicalUrl}
            >
              <span className="example-card__number">0{index + 1}</span>
              <div className="example-card__visual" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className="example-card__copy">
                <p>{page.scenarioId.replaceAll('-', ' ')}</p>
                <h3>{page.title}</h3>
                <span>{page.summary}</span>
                <code>{page.canonicalUrl}</code>
              </div>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </section>

      <footer className="index-footer">
        <p>Serving only active, Camo-authorized publications.</p>
        <code>apps/website · TanStack Start · Bun · SQLite</code>
      </footer>
    </main>
  );
}
