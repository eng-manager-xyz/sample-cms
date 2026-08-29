---
name: tanstack-router-pwa-deep-links
description: "TanStack Router's interaction with the Workbox NavigationRoute for mind-palace — the navigation fallback points at the prerendered shell, the router resolves deep links offline from cache without a server round-trip. Triggers on: spa fallback, navigation fallback, deep link offline, NavigationRoute, router pwa, offline route resolution."
license: MIT
---

Sub-skill of `tanstack`. Owns the contract between Workbox's navigation handling and TanStack Router: when the network is gone (or the user lands on a deep URL that the prerender didn't emit), the service worker hands back the prerendered SPA shell from cache, the router boots, and resolves the URL client-side. No server round-trip; no broken offline deep links. Wave 4's `playwright-pwa-offline` will verify the contract end-to-end.

## When to invoke
- Configuring Workbox's `NavigationRoute` / `navigateFallback` in the Vite PWA plugin setup.
- Diagnosing a deep link (`/games/maze/3`) that 404s offline but works online.
- Deciding what HTML the service worker should hand back as the fallback (the answer: a stable prerendered shell).
- Reviewing `apps/web/vite.config.ts` for the PWA plugin's Workbox options.
- Anything about `NavigationRoute`, `navigateFallback`, `navigateFallbackAllowlist`/`Denylist`.

## Owns
TanStack Router's interaction with the Workbox NavigationRoute: navigation fallback points at the prerendered shell, deep-link offline resolution from cache, no server round-trip.

## Defers to
- `tanstack` (parent) — version pin and routing.
- `tanstack-start-spa-prerender` — for *what* the prerendered shell is (SPA + full prerender). This skill consumes the shell; that one produces it.
- `tanstack-router-routing` — for how the router resolves the URL once it boots inside the shell.
- `nitro` — for the actual `404.html` that the `github_pages` preset emits and that the Workbox fallback can also point at.
- `playwright-pwa-offline` (Wave 4, forward) — for the end-to-end test that verifies a deep link resolves while offline. This skill defines the contract; that one verifies it.

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: the offline-deep-link contract is verified by Playwright in `bun run check`. A regression here means a routing change or a Workbox-config change broke the fallback — fix the wiring, not the test.
- The service worker NEVER touches IDB. Assets are the SW's job; IDB is application code (see `idb`).
- Precache only the app shell — HTML, JS, and CSS bundles, the manifest, icons. Do not precache per-route data. Runtime-cache static assets (images, fonts) with `CacheFirst`.
- TanStack Router handles all navigation client-side. The Workbox NavigationRoute fallback points at the prerendered shell, not at per-route HTML files. Per-route HTML files exist (the prerender emits one per route), but the fallback is the *single* shell that always boots the SPA.
- A deep link to a route the prerender did NOT emit must still work offline — because the SW returns the shell, the SPA boots, the router runs `validateSearch`/`params.parse`, and renders the matching component (or the route-tree's not-found component).

## Patterns

### `vite-plugin-pwa` Workbox config
```ts
// apps/web/vite.config.ts (Workbox excerpt) — pinned: vite-plugin-pwa ^1.x, workbox ^7.x
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    // …tanstackStart, tailwindcss…
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      workbox: {
        // Precache only the app shell — JS/CSS/manifest/icons. The SPA shell HTML is matched by globPatterns.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        // Single navigation fallback — every navigation request resolves to the prerendered shell at "/".
        navigateFallback: "/index.html",
        // Don't fall back for asset-shaped URLs; let CacheFirst handle them.
        navigateFallbackDenylist: [/^\/assets\//, /\.(?:png|svg|webp|woff2?)$/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image" || request.destination === "font",
            handler: "CacheFirst",
            options: { cacheName: "static-assets", expiration: { maxEntries: 100 } },
          },
        ],
      },
    }),
  ],
});
```
The `navigateFallback: "/index.html"` is load-bearing: it makes every navigation request — including unknown deep links — resolve to the prerendered shell. The router then takes over inside the shell. The denylist keeps asset URLs from being routed through the fallback.

### What happens on a cold offline deep link
```
1. User opens /games/maze/3 (offline, has visited the app before so SW is installed).
2. Browser issues a navigation request → SW intercepts.
3. Workbox NavigationRoute matches → returns "/index.html" from precache.
4. Browser parses the prerendered shell HTML and runs the bundled JS.
5. TanStack Router sees `location.pathname === "/games/maze/3"`, runs the route tree:
     a. params.parse via Zod — OK
     b. component renders LevelBoard
6. Atoms read from IDB (already hydrated synchronously after the root <Suspense> resolves).
7. Painted, no network round-trip.
```
The contract has three load-bearing pieces: (a) the SW precaches the shell, (b) the navigation fallback points at the shell, (c) the router resolves any URL client-side. Lose any one and the offline deep link breaks.

### Why "fallback to the shell" beats "fallback to the per-route HTML"
The prerender (see `tanstack-start-spa-prerender`) emits one HTML file per route. The Workbox fallback could point at the matching per-route file — but it shouldn't, because:
- Workbox would need to mirror the route tree to know which HTML file to return for an unknown URL.
- The per-route HTML is just the same shell + a different `<title>` and meta. Booting the SPA from the canonical shell is identical for the user once hydration runs.
- A new route added without a redeploy still works offline (the shell boots, the router resolves it).

So: **navigationFallback always points at the canonical shell HTML.** Per-route prerender output is for first-paint on online navigation.

### Service-worker registration in the app shell
```tsx
// apps/web/app/main.tsx (excerpt)
if ("serviceWorker" in navigator) {
  // vite-plugin-pwa generates the registration helper; import once.
  import("virtual:pwa-register").then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}
```
Register at startup; `autoUpdate` strategy keeps the SW current. Versioned precache ensures users on an old SW pick up new shells on next navigation.

### A `NavigationRoute` denylist for the GH Pages 404
```ts
navigateFallback: "/index.html",
navigateFallbackDenylist: [
  /^\/assets\//,        // Vite asset hash dir
  /\.(?:png|svg|webp|woff2?|ico)$/,
  /^\/sw\.js$/,         // never SW-fall-back the SW itself
],
```
The `404.html` produced by Nitro's `github_pages` preset (see `nitro`) is what GH Pages serves on a hard load of an unknown URL — the SW's fallback handles every *subsequent* navigation locally.

## Anti-patterns
- **Don't point `navigateFallback` at a per-route HTML file** — pick the single canonical shell. Otherwise Workbox needs to mirror the route tree and unknown URLs break.
- **Don't precache per-route data** — only HTML, JS, CSS, manifest, icons. Per-route data lives in IDB (see `idb`); the SW is asset-only.
- **Don't put IDB reads in the service worker** — SW context has no access to your atoms or hydration. The SW is asset-only; the app handles state.
- **Don't disable the offline test in Playwright** — the contract is verified end-to-end (see `playwright-pwa-offline` in Wave 4). A failure means a Workbox config or routing change broke the fallback; fix the wiring.
- **Don't omit `navigateFallbackDenylist`** for asset URLs — without it, a cache miss on an asset returns the shell HTML and breaks `<img>` / `<link>` loads.
- **Don't switch to `injectManifest` strategy** unless you have a specific reason — `generateSW` produces the right Workbox config for the mind-palace contract; `injectManifest` requires writing the SW by hand and re-implementing the navigation route.
- **Don't expect server-side redirects to work offline** — there's no server in this repo (see `tanstack-start-spa-prerender`). All redirects are client-side via `<Link>` / `useNavigate`.
- **Don't cache the navigation fallback HTML with stale-while-revalidate** — the precache is the source of truth; SWR makes the shell version unpredictable across reloads.

## Triggers on
spa fallback, navigation fallback, deep link offline, NavigationRoute, router pwa, offline route resolution
