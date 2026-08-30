import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/cms-preview_')({
  preload: false,
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  head: () => ({
    meta: [
      { name: 'robots', content: 'noindex,nofollow,noarchive' },
      { title: 'Auteur | Authoring preview' },
    ],
  }),
  headers: () => ({
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  }),
  component: Outlet,
});
