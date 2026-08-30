import { createFileRoute, Link } from '@tanstack/react-router';
import { representativePages } from '@/data/public-path';

export const Route = createFileRoute('/cms-preview_/')({
  component: PreviewIndex,
});

function PreviewIndex() {
  return (
    <main className="preview-index">
      <section className="preview-index__card">
        <p className="site-eyebrow">Authoring surface</p>
        <h1>Choose a draft preview.</h1>
        <p>
          Preview resolves current authoring state through an isolated server boundary. These URLs
          are private, uncached, and never substituted for a published page.
        </p>
        <div className="preview-index__links">
          {representativePages.map((page) => (
            <Link
              key={page.canonicalUrl}
              to="/cms-preview_/$"
              params={{ _splat: page.canonicalUrl.slice(1) }}
            >
              <span>{page.title}</span>
              <code>{page.canonicalUrl}</code>
              <i aria-hidden="true">Open preview →</i>
            </Link>
          ))}
        </div>
        <div className="preview-index__actions">
          <Link to="/admin">Open CMS gateway</Link>
          <Link to="/">View published examples</Link>
        </div>
      </section>
    </main>
  );
}
