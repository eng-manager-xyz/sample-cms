---
name: tanstack-router-preload
description: "TanStack Router's `defaultPreload: \"intent\"` policy for mind-palace — modulepreload of route JS chunks plus loader execution on `touchstart`/hover, additive to (and distinct from) the Workbox SW precache. Triggers on: defaultPreload, modulepreload, intent preload, viewport preload, link preload, tanstack router preload, route preload."
license: MIT
---

Sub-skill of `tanstack`. Owns the project's preload policy: `defaultPreload: "intent"` is set in `getRouter()`, every `<Link>` in `apps/web/app/` warms its target on hover or `touchstart`, and the Workbox SW precache from `tanstack-router-pwa-deep-links` is a separate (additive) layer. Preloading is the SPA-runtime optimization that complements the SSG build output.

## When to invoke
- Editing `defaultPreload` in `apps/web/app/router.tsx` or the matching `turbo/generators/templates/app/app/router.tsx`.
- Authoring or reviewing a `<Link preload="intent" | "viewport" | "render" | false>` per-link override.
- Diagnosing a slow first-click navigation when the SW is already installed (the route loader, not the chunk fetch, is usually the lag).
- Deciding whether to bump `defaultPreloadStaleTime` (default: don't).
- Anyone proposing `quicklink`, `react-quicklink`, or a `<link rel=prefetch>` polyfill — the answer lives here.

## Owns
The project-wide `defaultPreload` value, the per-`<Link>` override pattern, the iPad/`touchstart` rationale for `intent` over `viewport`, and the relationship to the Workbox SW precache (additive, different layer).

## Defers to
- `tanstack` (parent) — version pin and dispatch.
- `tanstack-router-routing` — for the `<Link>` API itself; the `preload` prop *value* is owned here, but the `<Link>` surface (typed `to`, `params`, `search`, `Register` declaration) lives there.
- `tanstack-router-pwa-deep-links` — for the SW precache that complements preload (preload warms the next route in the current session; SW precache hands the same chunk back offline / on repeat visits).
- `tanstack-start-spa-prerender` — for *what* the SSG output looks like (prerendered shell + per-route chunks). This skill consumes that output's chunk graph.
- `playwright-conventions` — for the load-bearing **ASK-FIRST** rule before any preload-behavior verification test.

## Dean-stack rules
- **SSG describes the build; SPA describes the runtime.** Dean-stack ships static HTML/JS/CSS to GH Pages (SSG), but every navigation is client-side via TanStack Router (SPA). `defaultPreload` operates at the SPA-runtime layer: it preloads the **route's code-split JS chunk** via `<link rel=modulepreload>` and runs the route's **loader** early. It does **not** prefetch HTML — there is no per-route HTML to prefetch beyond the prerendered shell.
- **Belt + suspenders with the Workbox SW precache.** The SW (see `tanstack-router-pwa-deep-links`) precaches every JS/CSS bundle on first visit. Preload warms the next chunk *during* a session before precache completes, runs route loaders ahead of the click event, and on some browsers bypasses the SW fetch handler (direct from disk cache → memory). The two layers serve different cases — keep both.
- **`quicklink` was considered and rejected.** `quicklink` (and the abandoned `react-quicklink` wrapper) prefetches `<link rel=prefetch>` for visible link `href`s — the **HTML** at the URL. In an SPA-runtime app, every URL resolves to the same prerendered shell, which is already in the SW precache; the prefetch is redundant. The right primitive is `modulepreload` of the route chunk + loader execution on intent — exactly what `defaultPreload: "intent"` does. Do not reintroduce `quicklink`.
- **iPad reason for `intent` over `viewport`.** `intent` fires on `touchstart` (iOS) and `mouseenter` (desktop) — only the link the user is about to tap, ~100ms before the click. `viewport` fires when the link enters the viewport; on a 12.9" iPad, that can mean a dozen visible links per scroll, warming chunks the user will never tap and wasting battery and bandwidth. `intent` is the project default; promote a link to `viewport` only when a hero/primary action genuinely warrants it.
- **Pillar 4 (CLI-gate-first):** `defaultPreload`'s value is typed by TanStack Router as `'intent' | 'viewport' | 'render' | false`. A typo fails `tsgo --noEmit` for free. Same applies to per-`<Link>` `preload` props.

## Patterns

### Project default — already wired
```tsx
// apps/web/app/router.tsx — pinned: @tanstack/react-router ^1.x
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
  });
}
```
This is the project-wide policy. Every `<Link>` inherits `intent` unless its own `preload` prop overrides it. The same option is set in `turbo/generators/templates/app/app/router.tsx` so a freshly generated app starts with the same policy.

### Per-link override
```tsx
import { Link } from "@tanstack/react-router"; // see `tanstack-router-routing`

// Hero CTA — warm the chunk as soon as it scrolls into view.
<Link to="/games/maze/$level" params={{ level: 1 }} preload="viewport">
  Start the maze
</Link>

// Heavy / rarely-clicked link — opt out entirely.
<Link to="/about" preload={false}>About</Link>

// Aggressive — preload on first render. Use sparingly; defeats code-splitting if overused.
<Link to="/games" preload="render">All games</Link>
```
Override values: `'intent' | 'viewport' | 'render' | false`. Default to project-`intent`; document the reason next to any override.

### `defaultPreloadStaleTime` — leave at default
TanStack Router caches preloaded route data for a short window; a click within that window reuses the warm result. Tune only if a Playwright run shows a stale loader result reaching the user. Default is fine for IDB-backed loaders — state changes propagate via the `BroadcastChannel` re-hydration path owned by `idb`, not via stale-timer expiry.

### Verifying a preload fired (manual)
DevTools → Network → "JS" filter; hover a `<Link>` (or `touchstart` on iPad over LAN) — a `<link rel=modulepreload>` for the next route's chunk appears before the `click` event. If it doesn't fire, either: (a) the route's chunk is already in the initial bundle (no preload needed), (b) the link is `preload={false}`, or (c) the `Register` declaration is missing from `router.tsx` and `<Link>` fell back to plain `<a>` (see `tanstack-router-routing`).

## Anti-patterns
- **Don't set `defaultPreload: "viewport"` as the project default.** iPad scroll would warm every visible link; `intent` is the right default. Per-link `viewport` for a single hero CTA is fine.
- **Don't set `defaultPreload: "render"` as the project default.** Renders every route's chunk on initial paint — defeats code-splitting and bloats first-paint.
- **Don't introduce `quicklink` / `react-quicklink` / a `<link rel=prefetch>` polyfill.** The router primitive is the right tool for this stack; HTML prefetch is redundant with the SW precache. See "Dean-stack rules" above.
- **Don't preload routes the user can never reach from the current view.** Per-link `preload={false}` for off-flow admin or debug links keeps the chunk graph honest.
- **Don't `useMemo` around `<Link>` to avoid re-preload.** The Compiler memoizes (see `react-compiler-rules`); manual memo is noise.
- **Don't skip the `Register` declaration in `router.tsx`.** Without it, `<Link>` falls back to `<a>` and the preload never fires. See `tanstack-router-routing`.
- **Don't write a Playwright test for preload behavior without asking the user first.** Surface structural choices (story-level vs app-level, fixture, what to assert — `<link rel=modulepreload>` DOM presence vs. timing, reduced-motion) and wait for the answer; **ASK FIRST** is load-bearing (see `playwright-conventions`).

## Triggers on
defaultPreload, modulepreload, intent preload, viewport preload, link preload, tanstack router preload, route preload
