---
name: tanstack-start-spa-prerender
description: "TanStack Start configured for SPA mode + full prerender on GitHub Pages — `@tanstack/react-start/plugin/vite`, `prerender.enabled: true`, `ssr: false` per-route opt-out semantics, no server functions, no server loaders. Triggers on: tanstack start spa, tanstack prerender, ssr false, spa mode, prerender route, server functions disabled, server loaders disabled."
license: MIT
---

Sub-skill of `tanstack`. Owns the framework-level decision: TanStack Start runs in SPA mode and full-prerenders every route at build time. There is no runtime server in production. **Nitro is driven internally by the `tanstackStart` Vite plugin** — there is no `apps/<app>/nitro.config.ts`. The GH-Pages-specific concerns (`BASE_PATH` env contract, `cp index.html → 404.html`, `.nojekyll`, the deploy workflow's app selector) live in the `nitro` skill — this skill defers there.

## When to invoke
- Authoring `apps/web/vite.config.ts` for the TanStack Start plugin.
- Setting or fixing `prerender.enabled`, `crawlLinks`, `routes`, or `failOnError`.
- Opting a route in or out of prerender.
- Diagnosing a "server function not allowed" or `dist/server/server.js` produced when it shouldn't be.
- Fielding a request that wants `createServerFn`/server loaders — surface the conflict with the static target.

## Owns
TanStack Start in **SPA mode with full prerender**, integration with Nitro's `github_pages` preset, no server functions, no server loaders, prerender-the-shell strategy.

## Defers to
- `tanstack` (parent) — version pin and routing.
- `nitro` — for the GH-Pages-specific concerns: the `BASE_PATH` env contract that drives `vite.config.ts`'s `base`, the post-build `cp index.html → 404.html` and `.nojekyll`, the deploy workflow's app selector, and the `actions/configure-pages@v5` integration. There is **no** `apps/<app>/nitro.config.ts` — TanStack Start drives Nitro internally.
- `tanstack-router-routing` — for the route files this skill prerenders.
- `tanstack-router-pwa-deep-links` — for what the prerendered shell does at runtime when a deep link is hit offline.
- `react-19-primitives` — for `<Suspense>` boundaries inside prerendered route components.
- `jotai` + `idb` — for the runtime state hydration that fills the prerendered shell after JS executes.

## Dean-stack rules
- Pillar 1 (Storybook-first) means: route files are integration sites that compose Storybook-built components — they are not the place to construct UI.
- Pillar 3 (IDB-first state) means: prerender the *shell* of every route. Real content (game progress, settings) is read from IDB after hydration — there is no per-route data fetch at build time for user state.
- Pillar 4 (CLI-gate-first) means: `prerender.failOnError: true` (default in current Start) — a failed prerender fails `bun run build` and therefore `bun run check`.
- TanStack Start in SPA + prerender mode emits the deployable artifact at `dist/client/`. A `dist/server/server.js` file ALSO appears as part of the prerender pipeline (it's used internally to render the shell), but ONLY `dist/client/` ships. The build script copies `dist/client/index.html` → `404.html` and `touch`es `.nojekyll` for GitHub Pages.
- Set **`srcDirectory: "app"`** in `tanstackStart({...})` — the plugin defaults to `src/`. Without this, the plugin can't resolve the router entry.
- Set **`spa: { prerender: { outputPath: "/index" } }`** so the prerender writes `index.html` (not the default `_shell.html`) — GitHub Pages serves `index.html` as the directory default, and Workbox's `navigateFallback: "/index.html"` matches.
- The router factory exports **`getRouter()`** (not `createRouter()`); the plugin's auto-generated `routeTree.gen.ts` declares `Register { router: Awaited<ReturnType<typeof getRouter>> }` against that name.
- React Compiler is NOT wired through `tanstackStart({ react: { babel: ... } })` — that option does not exist. To enable, install `@vitejs/plugin-react` separately and pass `babel.plugins: [["babel-plugin-react-compiler", { target: "19" }]]` to it (deconfliction with the framework's own React handling required).
- The package is `@tanstack/react-start` (not `@tanstack/start`); the Vite plugin is `@tanstack/react-start/plugin/vite`. The legacy `app.config.ts` and Vinxi setup is gone.

## Patterns

### `vite.config.ts` — SPA + full prerender
```ts
// apps/web/vite.config.ts — pinned: @tanstack/react-start ^1.x, vite ^7.x
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({
      // SPA + full prerender mode — no SSR, no server functions, every route to static HTML.
      spa: { enabled: true },
      prerender: {
        enabled: true,
        crawlLinks: true,
        autoSubfolderIndex: true, // /about → /about/index.html (GH Pages directory routing)
        failOnError: true,
        // Add explicit routes for any param-based pages the crawler can't reach via <Link>.
        // The Nitro preset (`github_pages`) is configured separately; see `nitro`.
      },
    }),
  ],
});
```
The `tanstackStart` plugin invokes Nitro under the hood — there is **no** `apps/<app>/nitro.config.ts`. GH-Pages-specific concerns (the `BASE_PATH` env contract, the post-build `cp index.html → 404.html`, the `.nojekyll` marker, the deploy-workflow app selector) live in the `nitro` skill. No `app.config.ts`. No `vinxi`.

### Per-route opt-out of SSR (still prerenders the shell)
```tsx
// apps/web/app/routes/dashboard.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  ssr: false, // shell prerendered; client hydrates and reads from IDB
  component: Dashboard,
});

function Dashboard() {
  // reads from atoms (jotai) which read from IDB after hydration
  return <main>{/* … */}</main>;
}
```
In mind-palace every route effectively behaves this way — the shell is static, the client fills in real content from IDB. `ssr: false` makes that explicit per-route when needed.

### Build output (what to expect)
```
apps/web/dist/
└── client/
    ├── index.html             # /
    ├── 404/index.html         # /404 — used by GH Pages SPA fallback (see nitro)
    ├── games/maze/index.html  # /games/maze
    ├── games/maze/level-1/index.html
    └── assets/                # hashed JS + CSS chunks
```
Only `dist/client/` ships. If `dist/server/` exists with a `server.js`, the build slipped a server function or server-only import — find and remove it before deploying. The `github_pages` preset (see `nitro`) writes the SPA-fallback `404.html`.

### Workspace install
```bash
bun add @tanstack/react-router @tanstack/react-start react@^19 react-dom@^19
bun add -D @tanstack/react-start vite@^7 @vitejs/plugin-react @tailwindcss/vite
```
The plugin import path is `@tanstack/react-start/plugin/vite`, not `@tanstack/router-vite-plugin` (legacy).

### Env access inside a route
```tsx
import { createFileRoute } from "@tanstack/react-router";
import { env } from "~/env"; // see `t3-env`

export const Route = createFileRoute("/")({
  component: () => <span>Build sha: {env.VITE_BUILD_SHA}</span>,
});
```
`env.VITE_*` is build-time validated by `@t3-oss/env-core` (see `t3-env`) — there is no runtime env on GH Pages.

## Anti-patterns
- **Don't use `createServerFn` / `createServerOnlyFn`** — server functions need a runtime server. There is none. Move the work to build-time (a Vite plugin, a static fixture file) or to client-side (an atom backed by IDB).
- **Don't use server loaders** — same reason. Use `loader`-as-a-pure-build-time-fetch only when the data is genuinely static (e.g., a content collection); never read user state at build time.
- **Don't import from `@tanstack/start`** — it's `@tanstack/react-start` now. Same for `@tanstack/start-static-server-functions`.
- **Don't author `app.config.ts`** — gone in current TanStack Start. Configuration lives in `vite.config.ts` via the `tanstackStart` plugin.
- **Don't use Vinxi** — gone. The plugin uses Vite + Nitro directly.
- **Don't set `prerender.failOnError: false`** to push a build through — the missing route is the bug. Add it to `routes`, fix the loader that throws, or remove the unreachable link.
- **Don't import `Meta` / `Scripts` from `@tanstack/start`** — they come from `@tanstack/react-router` now (`HeadContent`, `Scripts`).
- **Don't introduce `getRequest` / `getRequestHeader` / `setResponseHeaders`** from `@tanstack/react-start/server` — these are runtime-server-only and break SSG.
- **Don't deploy `dist/server/`** — if it exists, the build is wrong. Only `dist/client/` is the GH Pages artifact (see `nitro`).

## Triggers on
tanstack start spa, tanstack prerender, ssr false, spa mode, prerender route, server functions disabled, server loaders disabled
