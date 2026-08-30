import type { AdminGatewayState } from '@/data/admin-gateway';

type AdminGatewayProps = Readonly<{
  state: AdminGatewayState;
}>;

const unavailableCopy = {
  'invalid-config': {
    title: 'The configured origin was rejected.',
    body: 'Use one absolute HTTP(S) origin with no credentials, path, query, or hash.',
  },
  'missing-config': {
    title: 'The authoring origin is not configured.',
    body: 'Set CMS_ADMIN_ORIGIN on the website server before exposing this production gateway.',
  },
} as const;

function AuteurMark() {
  return (
    <span className="index-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function AdminGateway({ state }: AdminGatewayProps) {
  return (
    <main className="admin-gateway">
      <nav className="admin-gateway__nav">
        <a href="/" className="index-nav__brand">
          <AuteurMark />
          <span>Auteur Websites</span>
        </a>
        <a href="/">Published examples</a>
      </nav>

      <section className="admin-gateway__hero">
        <header>
          <p className="site-eyebrow">Hybrid authoring boundary</p>
          <h1>Author here. Publish there.</h1>
          <p>
            The website and CMS remain separate applications. This gateway exposes one validated
            authoring origin without proxying API or authentication traffic through a public page.
          </p>
        </header>

        <article className="admin-gateway__status" data-admin-status={state.status}>
          {state.status === 'ready' ? (
            <>
              <div className="admin-gateway__status-heading">
                <span className="admin-gateway__status-dot" aria-hidden="true" />
                <span>Authoring available</span>
              </div>
              <h2>Open the isolated Auteur CMS.</h2>
              <p>
                {state.source === 'local-development-default'
                  ? 'Using the local CMS development server.'
                  : 'Using the server-validated CMS_ADMIN_ORIGIN.'}
              </p>
              <a
                className="admin-gateway__open"
                data-admin-open="true"
                href={state.origin}
                target="_blank"
                rel="noreferrer"
              >
                Open authoring <span aria-hidden="true">↗</span>
              </a>
              <code>{state.origin}</code>
            </>
          ) : (
            <>
              <div className="admin-gateway__status-heading">
                <span
                  className="admin-gateway__status-dot admin-gateway__status-dot--quiet"
                  aria-hidden="true"
                />
                <span>Authoring unavailable</span>
              </div>
              <h2>{unavailableCopy[state.reason].title}</h2>
              <p>{unavailableCopy[state.reason].body}</p>
              <code>CMS_ADMIN_ORIGIN</code>
            </>
          )}
        </article>
      </section>

      <section className="admin-gateway__contract" aria-labelledby="gateway-contract-title">
        <div>
          <p className="site-eyebrow">Gateway contract</p>
          <h2 id="gateway-contract-title">A deliberate seam, not a hidden proxy.</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <p>Only an exact HTTP(S) origin can become the authoring action.</p>
          </li>
          <li>
            <span>02</span>
            <p>Public pages continue to read immutable SQLite publications.</p>
          </li>
          <li>
            <span>03</span>
            <p>Preview uses its own isolated, non-cacheable route surface.</p>
          </li>
        </ol>
      </section>
    </main>
  );
}
