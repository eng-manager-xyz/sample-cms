---
name: tanstack-router-routing
description: "TanStack Router file-based routing for mind-palace — `createFileRoute`, route trees, route params, search params, `Link` / `useNavigate` / `useRouter`, and Zod-validated params via `validateSearch` (defers to zod for the schemas). Triggers on: tanstack router, file-based routing, createRoute, route param, search params, useNavigate, Link, route tree."
license: MIT
---

Sub-skill of `tanstack`. Owns the routing surface — file-based routes under `apps/web/app/routes/`, the `createFileRoute` API, route params, search params, the `Link` / `useNavigate` / `useRouter` hooks. Every route param/search param schema goes through `zod` (this skill defers there).

## When to invoke
- Adding or renaming a file under `apps/web/app/routes/`.
- Authoring a route's `component`, `loader` (build-time only), `validateSearch`, or `params.parse`.
- Wiring `<Link>`, `useNavigate`, `useRouter`, `useParams`, `useSearch`, or `useLoaderData`.
- Diagnosing a stale `routeTree.gen.ts`, a broken type inference on params, or a `Link` that points at a route that doesn't prerender.
- Choosing between `validateSearch: zodValidator(...)` and a hand-rolled parser (use the Zod path).

## Owns
File-based routing in `app/routes/`, route trees, route params, search params, link/navigate APIs, and Zod-validated route params (deferring to the zod skill for schema authoring).

## Defers to
- `tanstack` (parent) — version pin and routing.
- `zod` — for *how to author* every route param / search param schema. The integration shape lives here; the schema authoring rules (`z.object`, `z.infer`, `z.coerce`, `safeParse`) are zod's surface.
- `tanstack-start-spa-prerender` — for the prerender enumeration of every route file this skill creates.
- `tanstack-router-pwa-deep-links` — for what the navigation fallback resolves to when a route is hit offline.
- `tanstack-router-preload` — for the `defaultPreload` policy, per-`<Link preload="...">` overrides, and the `quicklink`-rejected position. The `<Link>` API itself lives here; the `preload` prop *value* is owned there.
- `react-19-primitives` — for `<Suspense>` boundaries inside route components and `use(promise)` reads of stable promises.
- `jotai` — for state read inside a route component.
- `t3-env` — for `env.VITE_*` access inside a route component.

## Dean-stack rules
- Pillar 1 (Storybook-first) means: a route file is an integration site, not a construction site. Build the inner pieces in Storybook first; the route file composes them.
- Pillar 2 (Zod-first types) means: every route param and every search param is parsed through a `z.object` schema. The TS type comes from `z.infer` — never hand-written. See `zod`.
- Pillar 3 (IDB-first state) means: routes never fetch user state at runtime (there is no runtime). Reads come from atoms (which read from IDB after hydration); writes go through `useSetAtom`.
- Pillar 4 (CLI-gate-first) means: a route that fails to prerender (param parser throws, loader throws) fails the build. Don't suppress; fix.
- The generated `routeTree.gen.ts` is owned by the plugin and lives at **`apps/<name>/app/routeTree.gen.ts`** (one level above `routes/`, not inside it — putting it in `routes/` makes the plugin warn "does not export a Route"). Never hand-edit it; commit it (or `.gitignore` it — pick one and stick to it).
- The router factory exports **`getRouter()`**, not `createRouter()` — TanStack Start's plugin generates the `Register { router: Awaited<ReturnType<typeof getRouter>> }` declaration block expecting that name.

## Patterns

### File-based route layout
```
apps/web/app/routes/
├── __root.tsx          # createRootRoute — html shell, head, scripts
├── index.tsx           # /
├── games/
│   ├── index.tsx       # /games
│   └── maze/
│       ├── index.tsx   # /games/maze
│       └── $level.tsx  # /games/maze/$level (param)
└── routeTree.gen.ts    # generated; do NOT hand-edit
```
File names map to URLs. `$param` segments become route params; `_layout` prefix denotes a layout (non-rendered) route.

### Root route — html shell
```tsx
// apps/web/app/routes/__root.tsx — pinned: @tanstack/react-router ^1.x
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "mind-palace" },
    ],
  }),
  component: RootComponent,
  errorComponent: RouteError,        // see "Error & notFound boundaries" below
  notFoundComponent: NotFound,       // see "Error & notFound boundaries" below
});

function RootComponent() {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
```
The shell is what the prerender writes to disk; the client hydrates and reads from IDB to fill it in.

### Error & notFound boundaries — load-bearing for Pillar 3
Every mind-palace app MUST wire BOTH a per-route boundary on `__root__` AND a router-level fallback. A render throw from a deeper route bubbles up to the closest `errorComponent`; if a route doesn't declare one, it falls through to root; if root somehow doesn't render (route-resolution itself throws, loader rejects), the router's `defaultErrorComponent` catches. Same shape for `notFoundComponent` / `defaultNotFoundComponent` for `notFound()` calls.

The contract is **gate-asserted** in `app/router.test.ts` — removing any of the four wirings turns `bun run check` red.

```tsx
// __root__.tsx — exports both fallbacks for router.tsx to wire as defaults
export function NotFound() { /* 404 UI */ }
export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  // Re-throw on the server so prerender.failOnError aborts the build
  // instead of baking a "Something broke" page into static HTML for a
  // route that should have failed.
  if (typeof window === "undefined") throw error;

  if (import.meta.env.DEV) console.error("[Route error boundary caught]", error);
  return (
    <main>
      <h1>Something broke</h1>
      {import.meta.env.DEV ? <pre>{error.message}</pre> : null}
      <button type="button" onClick={reset}>Try again</button>
      <a href="/">Go home</a>
    </main>
  );
}
```

```ts
// router.tsx — wires both as router-level defaults
import { NotFound, RouteError } from "./routes/__root";

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: NotFound,
  });
}
```

```ts
// router.test.ts — Pillar-adjacent contract; failure turns the gate red
test("__root__ wires per-route boundaries", () => {
  expect(RootRoute.options.errorComponent).toBe(RouteError);
  expect(RootRoute.options.notFoundComponent).toBe(NotFound);
});
test("router.tsx wires router-level fallbacks", () => {
  const router = getRouter();
  expect(router.options.defaultErrorComponent).toBe(RouteError);
  expect(router.options.defaultNotFoundComponent).toBe(NotFound);
});
test("RouteError re-throws on the server (prerender failOnError gate)", () => {
  expect(() => RouteError({ error: new Error("kaboom"), reset: () => {} })).toThrow("kaboom");
});
```

What this catches in mind-palace specifically:
- **Pillar 3 — IDB-corrupt-state recovery.** A schema-mismatch in IDB (manual DevTools edit, half-applied migration on a flaky iPad reload) throws inside `use(idbHydrationPromise)` or atom getters → the kid sees the recovery UI on the iPad, not a blank page.
- **Pillar 2 — Zod parse-on-set throws.** An atom set with bad data throws synchronously; the boundary renders the error UI, React still logs to console (Pillar 2 stays loud in dev).
- **Side-channel setup throws.** A bug inside `usePixiApp`'s `setup` callback or `useAnime`'s anime params throws → boundary renders, side channel disposes via the hook's cleanup.
- **Per-route component throws** isolated to the route — a render bug in `/games/maze/$level` doesn't crash `/games` listings.

Per-route games SHOULD declare their own `errorComponent` for tighter recovery UIs (e.g. "this level is broken — pick another"). The root-level boundary is the safety net.

### File route with Zod-parsed params
```tsx
// apps/web/app/routes/games/maze/$level.tsx
import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod"; // schema authoring per `zod`

const ParamsSchema = z.object({
  level: z.coerce.int().min(1).max(99),
});

export const Route = createFileRoute("/games/maze/$level")({
  // `params.parse` runs on every navigation; throws → router error boundary.
  params: { parse: (raw) => ParamsSchema.parse(raw) },
  component: MazeLevel,
});

function MazeLevel() {
  const { level } = Route.useParams(); // typed as `{ level: number }` via `z.infer`
  return <main>Level {level}</main>;
}
```
The schema lives in `zod`'s surface; this skill shows the integration shape. `Route.useParams()` returns the parsed type — no `as`-cast.

### Zod-validated search params
```tsx
import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";

const SearchSchema = z.object({
  sort: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.int().min(1).default(1),
});

export const Route = createFileRoute("/games")({
  validateSearch: (raw) => SearchSchema.parse(raw),
  component: GamesIndex,
});

function GamesIndex() {
  const { sort, page } = Route.useSearch(); // typed
  return <main>Sort: {sort}, page {page}</main>;
}
```
`validateSearch` runs on every URL change; the result is the typed search object the route exposes via `useSearch()`. See `zod` for `z.coerce`, defaults, and discriminated unions.

### `Link` — typed navigation, no string typos
```tsx
import { Link } from "@tanstack/react-router";

export function MazeMenu() {
  return (
    <nav>
      <Link to="/games/maze/$level" params={{ level: 1 }}>Level 1</Link>
      <Link to="/games" search={{ sort: "desc", page: 1 }}>All games</Link>
    </nav>
  );
}
```
The `to` string is checked against the generated route tree; `params` and `search` are checked against the schemas. A typo or a missing param fails `tsgo --noEmit`.

### `useNavigate` — programmatic transitions
```tsx
import { useNavigate } from "@tanstack/react-router";

export function NextLevelButton({ level }: { level: number }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate({ to: "/games/maze/$level", params: { level: level + 1 } })}>
      Next level
    </button>
  );
}
```
Same shape as `Link` — typed `to` + typed `params`/`search`. Compiler-friendly: no `useCallback` needed (see `react-compiler-rules`).

### Router setup
```ts
// apps/web/app/router.tsx
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent", // hover/focus = preload
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```
The `Register` declaration is what wires per-route type inference into `Link` / `useParams` / `useSearch`. Without it, every `to` is `string` and the gate doesn't catch typos.

### `<Suspense>` inside a route — defer to react-19-primitives
```tsx
import { Suspense } from "react"; // see `react-19-primitives`
import { Route } from "./$level";

function MazeLevel() {
  const { level } = Route.useParams();
  return (
    <main>
      <Suspense fallback={<Skeleton />}>
        <LevelBoard level={level} />
      </Suspense>
    </main>
  );
}
```
`<Suspense>` API is owned by `react-19-primitives`; this skill just notes the integration site.

## Anti-patterns
- **Don't hand-write the param/search type** — every shape comes from a `z.object` and `z.infer<typeof Schema>`. See `zod`. A hand-written type can silently drift from the schema.
- **Don't use `as`-cast on `useParams()` / `useSearch()` returns** — if the type isn't right, the schema or the `Register` declaration is wrong; fix the source.
- **Don't define routes outside the `app/routes/` tree** — file-based routing is the single source of truth. Programmatic routes drift from the generated tree and break `Link` type inference.
- **Don't hand-edit `routeTree.gen.ts`** — the plugin regenerates it on save. Edits are clobbered.
- **Don't use TanStack Router's loader to fetch user state** — there is no runtime. Loaders that need user data should read atoms (which read IDB after hydration). Build-time loaders are fine for genuinely static data.
- **Don't import `@tanstack/router-vite-plugin`** — legacy. The plugin is now `@tanstack/react-start/plugin/vite` (see `tanstack-start-spa-prerender`).
- **Don't use `Meta` from the old `@tanstack/start` package** — head metadata is `head: () => ({ meta: [...] })` on the route + `<HeadContent />` in the root, both from `@tanstack/react-router`.
- **Don't `useMemo` around `useParams()` / `useSearch()`** — the React Compiler memoizes (see `react-compiler-rules`).

## Triggers on
tanstack router, file-based routing, createRoute, route param, search params, useNavigate, Link, route tree
