---
name: tanstack-devtools
description: "TanStack DevTools for mind-palace — `@tanstack/react-devtools` (the floating dev-only host panel), `@tanstack/react-router-devtools` (router plugin into that host), and `@tanstack/devtools-vite` (the Vite plugin that wires browser-element → editor source-file linking). All three are dev-only AND opt-in via `VITE_ENABLE_TANSTACK_DEVTOOLS=true`; production tree-shakes via `import.meta.env.DEV`. Triggers on: TanStackDevtools, TanStackRouterDevtoolsPanel, devtools-vite, tanstack devtools, click to source, browser to editor, router devtools, dev panel."
license: MIT
---

Sub-skill of `tanstack`. Owns the dev-only, opt-in debugging panel that ships with TanStack: a floating host (`@tanstack/react-devtools`) that other devtools (router today, more later) plug into, plus the Vite plugin (`@tanstack/devtools-vite`) that injects the runtime which makes "click an element in the browser → jump to its source file" work. The point: tighten the iPad-over-LAN debug loop when explicitly requested — see what's broken, click straight to the source line.

## When to invoke
- Adding a new TanStack devtool surface (a Query devtool, a Form devtool, etc.) — they all plug into `<TanStackDevtools>` as a `plugins[]` entry.
- Diagnosing why the floating devtool button isn't showing in `bun run dev`.
- Confirming the production bundle has zero devtool residue (the Pillar 4 / iPad-LAN bundle hygiene check).
- Understanding the lazy + DEV-gate pattern mind-palace uses to keep devtools out of `dist/`.
- Anyone proposing `click-to-react-component`, `@locator/runtime`, or another browser-→-source tool — `@tanstack/devtools-vite` already does this. Don't add a competitor.

## Owns
The dev-only mount of `<TanStackDevtools>` in `apps/web/app/lib/root-shell.tsx`, the opt-in `tanstackDevtools()` Vite plugin in `apps/web/vite.config.ts`, the `import.meta.env.DEV` + `VITE_ENABLE_TANSTACK_DEVTOOLS` + `lazy()` tree-shaking pattern, and the policy that all three devtool packages stay in `devDependencies`.

## Defers to
- `tanstack` (parent) — version pin and dispatch.
- `tanstack-router-routing` — the `<TanStackRouterDevtoolsPanel />` reads its data from the router instance authored there.
- `react-19-primitives` — `lazy()` + `<Suspense fallback={null}>` is the React-19 idiom that makes the dev gate render-safe.
- `react-compiler-rules` — the side-channel rule applies: the devtool host mounts once at the root boundary, never inside a render function.

## Dean-stack rules
- **Devtools are opt-in in dev, and absent in production.** The default `bun run dev` page must stay close to production behavior: no root devtools host, no `@tanstack/devtools-vite` DOM source annotations, and no sidecar event-bus unless `VITE_ENABLE_TANSTACK_DEVTOOLS=true` is set. The pattern in `apps/web/app/lib/root-shell.tsx` is:
  ```tsx
  const TanStackDevtools =
    import.meta.env.DEV && import.meta.env.VITE_ENABLE_TANSTACK_DEVTOOLS === "true"
      ? lazy(async () => { ... })
      : null;
  ```
  Vite's static-replacement of `import.meta.env.DEV` lets dead-code elimination drop the entire `lazy()` branch (and its dynamic imports) from the production bundle. The env flag prevents default dev-load freezes from source-link instrumentation. Verify with `grep -r '@tanstack/react-devtools' apps/web/dist/client/assets/` — must return zero hits.
- **`@tanstack/devtools-vite` is a Vite plugin, not a runtime, and it is opt-in.** It belongs in `vite.config.ts` behind the same `VITE_ENABLE_TANSTACK_DEVTOOLS === "true"` guard. The plugin annotates DOM nodes with source metadata and starts source-linking machinery during `vite dev`; do not enable it by default.
- **Devtool components are NOT mind-palace components and do NOT need a Storybook story (Pillar 1 exemption).** They're third-party panels; the "no component without a story" rule applies to components authored under `apps/<name>/app/components/`, not to dev-time host panels mounted at the root.
- **Devtools introduce zero app-level state (Pillar 3).** Their internal panel-state (open/closed, active tab) lives in the devtool's own scope; never persist any of it through `atomWithIDB`.
- **Pillar 4 (CLI-gate-first):** all three packages are `devDependencies`, never `dependencies`. The gate enforces this by ensuring the production bundle stays free of devtool symbols.
- **`VITE_ENABLE_TANSTACK_DEVTOOLS=true bun run dev` is when devtools live.** Plain `bun run dev` keeps devtools off. `bun run preview` (which Playwright app tests usually drive) runs the production build, so devtools are absent there. That's correct — app tests assert app behavior, not devtool UI.
- **The headliner is browser→source linking.** `@tanstack/devtools-vite`'s `devtools()` plugin is the reason this skill exists: clicking a rendered element in the running browser opens the source file at the exact line in your editor. That's the iPad-LAN debug payoff.

## Patterns

### `vite.config.ts` — opt into the plugin first

```ts
// apps/web/vite.config.ts
import { devtools as tanstackDevtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

function enableTanStackDevtools(): boolean {
  return process.env.VITE_ENABLE_TANSTACK_DEVTOOLS === "true";
}

export default defineConfig({
  plugins: [
    ...(enableTanStackDevtools() ? tanstackDevtools() : []),
    ...sharedPlugins(),
    tanstackStart({ /* ... */ }),
  ],
});
```

Keep the conditional plugin first when enabled. The plugin is a no-op for `vite build`, but it still changes the dev browser runtime, so it must remain opt-in.

### `root-shell.tsx` — lazy + DEV/env-gate the host

```tsx
import { type ReactNode, Suspense, lazy } from "react";

const TanStackDevtools =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_TANSTACK_DEVTOOLS === "true"
    ? lazy(async () => {
        const [{ TanStackDevtools: Host }, { TanStackRouterDevtoolsPanel }] = await Promise.all([
          import("@tanstack/react-devtools"),
          import("@tanstack/react-router-devtools"),
        ]);
        return {
          default: () => (
            <Host
              config={{ position: "bottom-right" }}
              plugins={[{ name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> }]}
            />
          ),
        };
      })
    : null;

function RootComponent(): ReactNode {
  return (
    <html lang="en">
      <head>{/* ... */}</head>
      <body>
        {/* ... app content ... */}
        {TanStackDevtools ? (
          <Suspense fallback={null}>
            <TanStackDevtools />
          </Suspense>
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
```

Why this shape: production sees `null` → the `{TanStackDevtools ? ... : null}` JSX becomes `null` → the dynamic imports never get bundled. Default dev also sees `null` unless the opt-in flag is set, keeping source-link instrumentation away from normal game iteration.

### Adding a new TanStack devtool plugin

When a new package ships (e.g. a Query devtool, a Form devtool), it joins the existing `plugins[]` array on the host:

```tsx
plugins={[
  { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
  { name: "TanStack Query", render: <TanStackQueryDevtoolsPanel /> }, // future, hypothetical
]}
```

Not relevant for mind-palace today (no Query — no server, IDB-first).

### Verifying zero production residue

```bash
bun run build
grep -r '@tanstack/react-devtools' apps/web/dist/client/assets/   # zero hits
grep -r 'TanStackRouterDevtoolsPanel' apps/web/dist/client/assets/ # zero hits
grep -r 'devtools-vite' apps/web/dist/client/assets/              # zero hits
```

If any return hits, the DEV gate isn't tree-shaking — investigate before merging.

## Anti-patterns

- **Don't enable TanStack Devtools by default.** Both the Vite plugin and the React host require `VITE_ENABLE_TANSTACK_DEVTOOLS=true`. Always-on devtools can inject source metadata into the live DOM and stall default dev loads.
- **Don't import the devtool packages at the top of `__root.tsx` or `root-shell.tsx` without the DEV/env gate.** Static imports always end up in the bundle; the lazy + ternary is the only safe shape.
- **Don't put the devtool packages in `dependencies`.** They're dev tools — `devDependencies` only. The gate doesn't catch this on its own; reviewers must.
- **Don't add `click-to-react-component`, `@locator/runtime`, or another browser-→-source tool.** `@tanstack/devtools-vite` already provides this. A second one is duplicate weight in `node_modules` and a new place for source-link logic to drift.
- **Don't mount `<TanStackDevtools>` inside a route component or anywhere besides the root.** Mounting it deeper means it gets unmounted on navigation and loses its panel state.
- **Don't write a Storybook story for the devtool host (Pillar 1 exemption).** Devtools aren't a mind-palace component; they're a third-party panel whose UI is already tested upstream.
- **Don't reach for `useEffect` to mount the host.** The `lazy()` + render shape is the right one — `useEffect` introduces a one-frame mount delay and risks the side-channel rule (devtool mutates DOM).
- **Don't add `<TanStackRouterDevtoolsPanel />` outside of the host's `plugins[]` array.** It's a panel, not a standalone overlay; mounting it bare loses the docked-panel UX.

## Triggers on
TanStackDevtools, TanStackRouterDevtoolsPanel, devtools-vite, tanstack devtools, click to source, browser to editor, router devtools, dev panel
