import {
  createRootRoute,
  type ErrorComponentProps,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CmsQueryProvider } from '@/providers/query-provider';
import '@/styles/index.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Auteur | Wall of Maps' },
      {
        name: 'description',
        content: 'A deterministic slot-and-variant CMS prototype.',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%228%22 fill=%22%2318181a%22/><path d=%22M9 23 15.2 8h2.1L23 23h-3l-1.3-3.7h-5.6L11.8 23H9Zm5-6.3h3.8L16 11.5l-2 5.2Z%22 fill=%22white%22/></svg>',
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootShell,
  errorComponent: RouteError,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <CmsQueryProvider>
      <Outlet />
    </CmsQueryProvider>
  );
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
    <main className="grid min-h-svh place-items-center bg-surface p-6">
      <div className="w-full max-w-md rounded-xl border border-line bg-canvas p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-danger-strong">
          Route error
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.025em]">This map could not load</h1>
        <p className="mt-2 text-sm text-ink-muted">
          The prototype stayed on the safe side and stopped before showing partial state.
        </p>
        <Button onClick={reset} className="mt-5">
          Try again
        </Button>
      </div>
    </main>
  );
}

export function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-surface p-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-faint">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.025em]">Map not found</h1>
        <a
          href="/"
          className="mt-4 inline-flex h-9 items-center rounded-lg bg-ink px-3.5 text-[13px] font-medium text-canvas outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          Return to Wall of Maps
        </a>
      </div>
    </main>
  );
}
