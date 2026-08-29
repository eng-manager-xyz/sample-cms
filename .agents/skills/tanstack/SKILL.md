---
name: tanstack
description: "Router skill for TanStack Start (`@tanstack/react-start`) in mind-palace — dispatches to the SPA-prerender sub-skill, the routing sub-skill, or the PWA-deep-links sub-skill. SPA mode + full prerender targets GitHub Pages; no server functions, no server loaders. Triggers on: tanstack, tanstack start, tanstack router overview, which tanstack skill."
license: MIT
---

Entry point for any TanStack-shaped question in mind-palace. The framework is TanStack Start running in **SPA mode with full prerender** for GitHub Pages — there is no runtime server in production. This skill exists to dispatch; sub-skills carry the rules.

## When to invoke
- The user types `tanstack` with no further specifier and you need to route them.
- The user asks "which TanStack skill," "TanStack router overview," or how TanStack Start is wired in this repo.
- A question mixes routing + prerender + PWA concerns and the right sub-skill is ambiguous — pick after reading the routing table.
- A question about a TanStack-adjacent surface owned by another tech (Nitro preset → `nitro`; route param schemas → `zod`; `<Suspense>` API → `react-19-primitives`) — defer to the producer.

## Owns
Entry point that routes TanStack questions to the SPA-prerender sub-skill, the routing sub-skill, the preload sub-skill, or the PWA-deep-links sub-skill.

## Defers to
- `tanstack-start-spa-prerender` — anything about the SPA-mode + full-prerender configuration, `ssr: false`, the absence of server functions/loaders, the build output shape.
- `tanstack-router-routing` — anything about file-based routes, `createFileRoute`, route params, search params, `Link`/`useNavigate`/`useRouter`.
- `tanstack-router-preload` — anything about `defaultPreload`, per-`<Link preload="...">` overrides, modulepreload of route chunks, intent vs viewport vs render, the `quicklink`-considered-and-rejected position.
- `tanstack-router-pwa-deep-links` — anything about the Workbox NavigationRoute, the navigation fallback resolving to the prerendered shell, deep-link offline behavior.
- `nitro` — for the GH-Pages-specific concerns: the `BASE_PATH` env contract (sourced from `actions/configure-pages@v5`'s `base_path` output), the post-build `cp index.html → 404.html` and `.nojekyll`, the deploy workflow's app selector, and the `dist/client/` upload path. TanStack Start *uses* Nitro internally — there is no standalone `nitro.config.ts`.
- `zod` — for any route param / search param validation schema.
- `react-19-primitives` — for `<Suspense>` boundaries inside route components.
- `jotai` — for state read inside a route component.
- `t3-env` — for `env.VITE_*` inside a loader or route component.

## Dean-stack rules
- Pillar 1 (Storybook-first) means: route components are composed from smaller components built in Storybook first. The route file itself is the integration site, never the construction site.
- Pillar 2 (Zod-first types) means: every route param and search param goes through a Zod schema (see `zod`). Hand-written param types are forbidden.
- Pillar 3 (IDB-first state) means: routes read state from atoms (which read from IDB after hydration); no per-route loader fetches user state at runtime — there is no runtime.
- Pillar 4 (CLI-gate-first) means: a missing prerendered route, an unhandled async, or a server-function import surfaces as a build failure and blocks `bun run check`.
- TanStack Start is in **SPA mode + full prerender** only. No `createServerFn`, no server loaders, no `routeRules` that imply a server. If a use case appears that needs a server, that use case does not belong on GH Pages — surface the constraint.

## Routing
- **use `tanstack-start-spa-prerender` when** the question is about `tanstackStart` plugin options, `prerender.enabled`, `ssr: false`, the build output (`dist/client/`), opting a route in/out of prerender, or "why is there no server?"
- **use `tanstack-router-routing` when** the question is about adding a route file, `createFileRoute`, params, search, `validateSearch`, `Link`, `useNavigate`, `useRouter`, `useLoaderData`, route trees, or the generated `routeTree.gen.ts`.
- **use `tanstack-router-preload` when** the question is about `defaultPreload`, per-`<Link preload="...">` overrides, why `intent` is the project default, modulepreload of route chunks, or whether to introduce a third-party prefetch library (`quicklink` etc.).
- **use `tanstack-router-pwa-deep-links` when** the question is about Workbox's `NavigationRoute`, `navigateFallback`, the prerendered shell, offline deep-link resolution, or what the service worker should hand back when the network is gone.

### Routing table
| Question shape | Sub-skill |
|---|---|
| "Add a `/games/maze/$level` route" | `tanstack-router-routing` |
| "Why is `dist/server/` empty?" | `tanstack-start-spa-prerender` |
| "How do I prerender every level page at build time?" | `tanstack-start-spa-prerender` (decide) + `nitro` (preset) |
| "Loading `/games/maze/3` while offline shows 404" | `tanstack-router-pwa-deep-links` |
| "Should I add `quicklink` for prefetch?" / "Why `defaultPreload: 'intent'`?" | `tanstack-router-preload` |
| "Override preload on this hero `<Link>` to viewport" | `tanstack-router-preload` |
| "Validate `?sort=asc` with Zod" | `tanstack-router-routing` (integration) + `zod` (schema) |
| "Where do I set the GH Pages base path?" | `nitro` |

## Anti-patterns
- **Don't suggest `createServerFn` / server functions** — there is no runtime server. The flag for SPA mode is on; server functions break the static-only output.
- **Don't suggest server loaders or `getServerSideProps`-shaped APIs** — same reason.
- **Don't introduce `@tanstack/start` (the old package name)** — it's `@tanstack/react-start` now.
- **Don't fork the Vite config in Storybook to add TanStack plugins** — Storybook re-uses the app's Vite config wholesale (see `tailwind` and `storybook-config` Wave 4).
- **Don't answer routing/prerender/PWA questions inside this router** — route to the sub-skill so the answer carries the right rules.

## Triggers on
tanstack, tanstack start, tanstack router overview, which tanstack skill
