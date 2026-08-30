import {
  createRootRoute,
  type ErrorComponentProps,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import '@/styles/index.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Auteur | Published websites' },
      {
        name: 'description',
        content: 'Block-rendered public pages served from immutable SQLite publications.',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%2216%22 fill=%22%23141414%22/><circle cx=%2216%22 cy=%2216%22 r=%227%22 fill=%22%23d7ff4f%22/></svg>',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootShell,
  errorComponent: RouteError,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return <Outlet />;
}

function RootShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

export function RouteError({ error, reset }: Readonly<ErrorComponentProps>) {
  if (typeof window === 'undefined') throw error;

  return (
    <main className="system-state">
      <div className="system-state__card">
        <span className="system-state__code">Publication error</span>
        <h1>This page could not be rendered.</h1>
        <p>The public renderer stopped instead of showing an invalid publication.</p>
        <div className="system-state__actions">
          <button type="button" onClick={reset}>
            Try again
          </button>
          <Link to="/">View examples</Link>
        </div>
      </div>
    </main>
  );
}

export function NotFound() {
  return (
    <main className="system-state">
      <div className="system-state__card">
        <span className="system-state__code">404 · Published routes only</span>
        <h1>This page is not live.</h1>
        <p>
          No active materialized publication exists for this canonical URL, or RouterService does
          not mark the route live.
        </p>
        <div className="system-state__actions">
          <Link className="system-state__primary" to="/">
            View examples
          </Link>
        </div>
      </div>
    </main>
  );
}
