---
name: nitro
description: "Nitro v3 in mind-palace — driven internally by TanStack Start, NOT via a standalone `nitro.config.ts`. Owns the GH Pages base-path env contract (`BASE_PATH`), the SPA-fallback `404.html`, the `.nojekyll` marker, and the prerender→`dist/client/` output. Triggers on: nitro, github_pages, BASE_PATH, baseURL, prerender, SPA fallback 404, .nojekyll, GH Pages deploy."
license: MIT
---

Owns the static-build contract that emits `apps/<app>/dist/client/` for upload to GitHub Pages. **There is no `apps/<app>/nitro.config.ts` file in mind-palace** — Nitro v3 is driven internally by TanStack Start's Vite plugin via `tanstackStart({ spa: …, prerender: … })`. This skill owns the GH-Pages-specific concerns layered on top.

## When to invoke
- Touching `.github/workflows/deploy.yml`, `apps/<app>/package.json`'s `build` script, or `apps/<app>/vite.config.ts`'s `base` resolution.
- Adding or fixing the `BASE_PATH` env contract for project pages / user-org pages / custom domains.
- Diagnosing a missing `404.html`, missing `.nojekyll`, or 404'd asset paths in the deployed site.
- Deciding which app in the monorepo gets published.

## Owns
- The `BASE_PATH` env contract — the single channel that drives Vite's `base` and therefore every emitted asset URL. Set canonically by `actions/configure-pages@v5`'s `base_path` output in CI.
- The post-Vite-build steps that turn `dist/client/` into a GH-Pages-compliant payload: `cp dist/client/index.html dist/client/404.html` for the SPA fallback, `touch dist/client/.nojekyll` for the Jekyll opt-out marker.
- The deploy workflow's `APP` selector — `inputs.app` (workflow_dispatch) → `vars.PAGES_APP` (repo var fallback) → `web` (default), feeding both the Turbo filter and the upload path.
- The `prerender.failOnError: true` invariant — a missing prerender route fails CI (Pillar 4).

## Defers to
- `tanstack-start-spa-prerender` (Wave 3, forward) — for the *application-level* SPA + prerender switch (`tanstackStart({ spa: { enabled: true, prerender: { outputPath: "/index" } }, prerender: { enabled: true, crawlLinks: true } })`).
- `tanstack-router-pwa-deep-links` (Wave 3, forward) — for the Workbox navigation-fallback contract that resolves deep links offline against the prerendered shell.
- `vite` — for `vite.config.ts`'s `resolveBase()` helper that consumes `BASE_PATH`.
- `turborepo` — for `turbo run build --filter=@mind-palace/<app>` task ordering and the build cache.
- `bun-runtime` — for invoking `bun run build` and `bun install --frozen-lockfile` in CI.

## Dean-stack rules
- **There is no `apps/<app>/nitro.config.ts`.** TanStack Start's Vite plugin owns Nitro configuration. Don't introduce a standalone Nitro config — it duplicates and races with the framework-level config.
- **The static artifact lives at `apps/<app>/dist/client/`, NOT `.output/public/`.** Vite writes there directly via TanStack Start's SPA + prerender pipeline. The `apps/<app>/package.json` `build` script is `vite build && cp dist/client/index.html dist/client/404.html && touch dist/client/.nojekyll` — that's the entire post-build contract.
- **Pillar 4 (CLI-gate-first):** the build is part of `bun run build` and any prerender error MUST fail the gate (`tanstackStart({ prerender: { failOnError: true } })`).
- **The deploy workflow MUST drive `BASE_PATH` from `actions/configure-pages@v5`'s `base_path` output** — never hardcode `/mind-palace/` or any repo name. The output is `/<repo>` for project pages and `/` (or empty) for user-org pages and custom domains. `vite.config.ts`'s `resolveBase()` normalizes the trailing slash.
- The package is `nitro` (v3), not `nitropack` (v2). Imports come from `nitro` / `nitro/vite` / `nitro/storage` if you ever need them — but you generally won't, because TanStack Start mediates.
- The deploy workflow publishes ONE app per run. The selector is `inputs.app` (workflow_dispatch) → `vars.PAGES_APP` → `'web'`. To publish a different app, either trigger workflow_dispatch with `app: <name>` or set the `PAGES_APP` repo variable.

## Patterns

### `apps/<app>/vite.config.ts` — base-path resolver
```ts
function resolveBase(): string {
  const raw = process.env.BASE_PATH;
  if (!raw || raw === "/") return "/";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export default defineConfig(async ({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  await import("./app/env");
  return {
    base: resolveBase(),
    plugins: [
      tanstackStart({
        srcDirectory: "app",
        spa: { enabled: true, prerender: { outputPath: "/index" } },
        prerender: {
          enabled: true,
          crawlLinks: true,
          autoSubfolderIndex: true,
          failOnError: true,
        },
      }),
      // ... VitePWA, Tailwind, etc.
    ],
  };
});
```
Local dev: `BASE_PATH` unset → `/`. CI: `BASE_PATH=/mind-palace` (project pages) → `/mind-palace/`. Custom domain: `BASE_PATH=/` (or unset) → `/`.

### `apps/<app>/package.json` — build script
```json
"build": "vite build && cp dist/client/index.html dist/client/404.html && touch dist/client/.nojekyll"
```
The `cp` provides the SPA fallback GH Pages serves on any 404. The `touch .nojekyll` opts out of Jekyll's underscore-folder stripping (Vite emits `_metadata.json` and similar). Both are load-bearing.

### `.github/workflows/deploy.yml` — selector + base path + upload
```yaml
on:
  push: { branches: [main] }
  workflow_dispatch:
    inputs:
      app:
        description: "App to publish (folder name under apps/)"
        required: false
        default: web
        type: string

env:
  APP: ${{ github.event.inputs.app || vars.PAGES_APP || 'web' }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: ".nvmrc" }
      - uses: oven-sh/setup-bun@v2
        with: { bun-version-file: "package.json" }

      - id: pages
        uses: actions/configure-pages@v5

      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium

      # Pillar 4 — gate runs BEFORE the prod build, so we never deploy
      # code that fails lint/types/unit/e2e. This is the only CI surface
      # that runs on push to main; check.yml is PR-only.
      - run: bun run check

      - name: Build ${{ env.APP }}
        env:
          BASE_PATH: ${{ steps.pages.outputs.base_path }}
        run: bun run build --filter=@mind-palace/${{ env.APP }}

      - name: Verify SSG output
        run: |
          set -euo pipefail
          dir="apps/${APP}/dist/client"
          test -f "$dir/index.html" && test -f "$dir/404.html" && test -f "$dir/.nojekyll"

      - uses: actions/upload-pages-artifact@v3
        with:
          path: apps/${{ env.APP }}/dist/client
```
The `actions/configure-pages@v5` step runs **before** the build so `BASE_PATH` is in scope. Its `base_path` output is GitHub's canonical answer — handles project pages, user-org pages, and custom domains without local logic. Use `upload-pages-artifact@v3` and `deploy-pages@v4` — older revs no longer pass the deploy gate.

### Add a route to the prerender list
Crawled links from the home page are picked up automatically (`crawlLinks: true`). For routes the crawler can't reach (islands, dynamic links), pass them explicitly via TanStack Start's `prerender.routes`:
```ts
tanstackStart({
  prerender: {
    enabled: true,
    crawlLinks: true,
    failOnError: true,
    routes: ["/games/maze", "/games/maze/level-1"],
  },
});
```

### Custom domain (no project base path)
Set the custom domain in repo settings → Pages. `actions/configure-pages@v5` will then return an empty `base_path`, `BASE_PATH` is unset/empty in the build env, and `resolveBase()` returns `/`. No code change required.

## Anti-patterns
- **Don't create `apps/<app>/nitro.config.ts`** — TanStack Start drives Nitro; a standalone config duplicates and races with framework-level config.
- **Don't reference `.output/public`** — that's the upstream Nitro doc default, but TanStack Start's SPA mode writes to `dist/client/` instead. The deploy workflow uploads from `apps/<app>/dist/client/`, not `.output/public/`.
- **Don't import from `nitropack`** — that's v2; v3 is `nitro` / `nitro/vite` / `nitro/storage`.
- **Don't hardcode `/mind-palace/` (or any repo name) in `vite.config.ts`'s `base`.** The base must come from `BASE_PATH` so the workflow is portable across forks, renames, custom domains, and user-org pages.
- **Don't omit the `cp index.html → 404.html` step** — without it, GH Pages serves its own ugly 404 on deep links instead of the SPA shell.
- **Don't omit `touch .nojekyll`** — without it, Jekyll on Pages strips folders that start with `_` (Vite emits these) and the deploy silently breaks.
- **Don't introduce `serverHandlers`, `routeRules.cache`, `routeRules.swr`, `routeRules.proxy`, or `useStorage`** — there is no server on GH Pages; these silently no-op or break the build.
- **Don't set `prerender.failOnError: false`** to make a build pass — the missing route is the bug, fix the route.
- **Don't trust upstream Nitro doc YAML verbatim** — its `actions/upload-pages-artifact@v1` and `actions/deploy-pages@v1` revs are stale and fail the deploy gate. Use `@v3` / `@v4`.

## Triggers on
nitro, github_pages, BASE_PATH, baseURL, prerender, SPA fallback 404, .nojekyll, GH Pages deploy, dist/client, configure-pages, deploy-pages, upload-pages-artifact
