---
name: storybook-config
description: "Storybook 10 with the Vite builder for mind-palace — shares the app's Vite, Tailwind, and alias config from a single source (never forked), wires `@storybook/react-vite` in `main.ts`, and registers global decorators in `preview.tsx`. Triggers on: storybook config, storybook vite builder, storybook main.ts, storybook preview.ts, shared vite config, storybook addon."
license: MIT
---

Sub-skill of `storybook`. Owns `.storybook/main.ts`, `.storybook/preview.tsx`, the `viteFinal` hook that re-uses the app's Vite config, and the addon registration list. The single load-bearing rule: Storybook's Vite/Tailwind/alias config is **the same config the app uses** — imported, not duplicated.

## When to invoke
- Authoring or editing `apps/web/.storybook/main.ts` or `.storybook/preview.tsx`.
- Diagnosing "Tailwind doesn't work in stories," "alias `@/...` doesn't resolve in stories," or "the app builds but Storybook errors on the same import."
- Adding a Storybook addon (a11y, docs, themes, the TanStack Start integration).
- Wiring `viteFinal` to merge in app plugins or path aliases.
- Setting the story-glob pattern so co-located `*.stories.tsx` files are discovered.

## Owns
Storybook 10 with the Vite builder, **shared Vite + Tailwind + alias config from a single source** (never forked), `main.ts`/`preview.tsx`, addons.

## Defers to
- `storybook` (parent) — version pin and routing.
- `tailwind` — for `@tailwindcss/vite` itself. Storybook re-uses the app's Vite config, which already has the Tailwind plugin; Storybook **never** adds its own copy.
- `tanstack-router-routing` — for the `routeTree.gen.ts` that route-aware stories may need (via `storybook-addon-tanstack-start`).
- `react-19-primitives` — for `<Suspense>` boundaries used by global decorators that wrap stories.
- `idb` — for the root `idbHydrationPromise` that a global decorator may need to feed `use(...)` so stories see hydrated state.
- `biome` — `.storybook/main.ts`, `.storybook/preview.tsx`, and any `*.stories.tsx` are linted by Biome like any other TS/TSX. Story files are not exempt from `bun run check`.
- `bun-package-manager` — for installing `storybook`, `@storybook/react-vite`, addons.

## Dean-stack rules
- Pillar 1 (Storybook-first) means: Storybook must boot, render, and lint before any feature lands. A broken `main.ts` blocks the whole construction surface.
- Pillar 4 (CLI-gate-first) means: `.storybook/*.ts` and `*.stories.tsx` go through `biome ci`, `tsgo --noEmit`, and Playwright story tests in `bun run check`. Config typos surface in the gate, not just in the IDE.
- **Shared Vite config is load-bearing.** Storybook imports the app's `vite.config.ts` and merges it via `viteFinal`. Adding `@tailwindcss/vite`, `vite-tsconfig-paths`, or `tanstackStart()` separately in `.storybook/main.ts` is a bug — it causes drift the first time the app config changes.
- TypeScript-first config: `.storybook/main.ts` and `.storybook/preview.tsx` (never `.js`).
- ESM only (`"type": "module"`); Storybook 10 is ESM-only.
- Node `>=20.19 || >=22.12` for Storybook 10 (the mind-palace pin is Node 25 — fine).

## Patterns

### `.storybook/main.ts` — framework, stories glob, addons, `viteFinal`
```ts
// apps/web/.storybook/main.ts
// pinned: storybook ^10.x, @storybook/react-vite ^10.x
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import path from "node:path";

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },

  // Co-located stories — glob walks the components tree only.
  stories: ["../app/components/**/*.stories.@(ts|tsx)"],

  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    // Route-aware stories use this addon's decorator + plugin (see tanstack-router-routing).
    "storybook-addon-tanstack-start",
  ],

  // Re-use the app's Vite config so Tailwind, aliases, and the React plugin all "just work".
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      // Only project-specific aliases that aren't already in the imported config go here.
      // Prefer vite-tsconfig-paths to keep the alias source the same across app + stories.
      resolve: {
        alias: { "@": path.resolve(__dirname, "../app") },
      },
    });
  },
};

export default config;
```
The `framework` block pins `@storybook/react-vite`. The `stories` glob walks the *components* tree (Pillar 1: stories live next to components, not in a parallel `__stories__/` tree). The `viteFinal` hook is where the *app's* Vite config (Tailwind v4 plugin, React plugin, path aliases) flows into Storybook — never a duplicate copy.

### `.storybook/preview.tsx` — global decorators, parameters, hydration
```tsx
// apps/web/.storybook/preview.tsx
// pinned: storybook ^10.x
import type { Preview } from "@storybook/react-vite";
import { Suspense, use } from "react"; // see `react-19-primitives`
import { Provider } from "jotai";       // see `jotai`
import { idbHydrationPromise } from "../app/state/hydration"; // see `idb`
// Tailwind entry — exact same file the app imports; ensures every story has the design tokens.
import "../app/styles/index.css";       // see `tailwind`

function HydrateThenRender({ children }: { children: React.ReactNode }) {
  use(idbHydrationPromise); // suspends once at the iframe root; Pillar 3 contract holds in stories too.
  return <>{children}</>;
}

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/ } },
    layout: "centered",
    // Reduced-motion default for Storybook — per-story can opt out.
    // (The Playwright project that drives stories enforces reduce as well; see `playwright-conventions`.)
  },
  decorators: [
    (Story) => (
      <Suspense fallback={<div data-test="story-hydrating">…</div>}>
        <HydrateThenRender>
          <Provider>
            <Story />
          </Provider>
        </HydrateThenRender>
      </Suspense>
    ),
  ],
};

export default preview;
```
The decorator stack mirrors the app shell so a story sees the same world a route does: the IDB hydration promise resolves once, then the Jotai `<Provider>` wraps the story. Use `.tsx` (not `.ts`) because the decorator returns JSX.

### Why the shared Vite config is non-negotiable
```ts
// WRONG — duplicate plugin in .storybook/main.ts
import tailwindcss from "@tailwindcss/vite"; // duplicate!
async viteFinal(viteConfig) {
  return mergeConfig(viteConfig, { plugins: [tailwindcss()] }); // breaks Tailwind v4 token extraction
}
```
The app already has `@tailwindcss/vite` in `apps/web/vite.config.ts` (see `tailwind`). Adding it again in `.storybook/main.ts` runs the plugin twice on the same CSS, which silently corrupts token extraction and causes "works in app, broken in stories." The fix: import nothing in `viteFinal` that's already in the app config.

### Path aliases — single source via `vite-tsconfig-paths`
```ts
// apps/web/vite.config.ts (relevant excerpt)
import viteTsConfigPaths from "vite-tsconfig-paths";
export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] }), /* tailwindcss(), react() */],
});
```
`vite-tsconfig-paths` reads the same `tsconfig.json` `paths` map that `tsgo --noEmit` uses (see `ts`). Storybook re-uses this via `viteFinal` — one source of truth for both the app and stories.

### Story discovery glob
```ts
stories: [
  "../app/components/**/*.stories.@(ts|tsx)",
  // No MDX docs in the mind-palace story glob — keep it minimal. Add `*.mdx` only when a docs-only page exists.
];
```
Co-located, walking the `components/` tree only. **Do not** glob `app/routes/**` — route-level stories are an anti-pattern (build the inner pieces; the route is a composition site).

### Addon registration order
```ts
addons: [
  "@storybook/addon-docs",                    // autodocs from CSF metadata
  "@storybook/addon-a11y",                    // axe checks at story render
  "storybook-addon-tanstack-start",           // router decorator + server-stub plugin (only for route-aware stories)
];
```
Addons load in order. Keep the list minimal — every addon adds boot time and a surface to maintain. Add `@storybook/addon-themes` only if a theme toggle is shown in the toolbar.

### Workspace install
```bash
bun add -D \
  storybook@^10 \
  @storybook/react-vite@^10 \
  @storybook/addon-docs@^10 \
  @storybook/addon-a11y@^10 \
  storybook-addon-tanstack-start
```
Pinned to Storybook 10 majors; `@storybook/react-vite` is the only allowed framework. See `bun-package-manager`.

### Scripts
```jsonc
// apps/web/package.json (excerpt)
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```
`storybook dev` is the local construction surface and the URL Playwright story tests target (`http://localhost:6006/iframe.html?id=...`). `storybook build` produces `storybook-static/` — never commit it; add to `.gitignore`.

## Anti-patterns
- **Don't fork the Vite config in `.storybook/main.ts`** — re-use the app's via `viteFinal`. Adding `@tailwindcss/vite` separately is the canonical way to break Tailwind in stories.
- **Don't author `.storybook/main.js` or `.storybook/preview.js`** — TypeScript only. JS configs lose autocomplete and type checking.
- **Don't put `*.stories.tsx` in a `__stories__/` parallel tree** — co-locate next to the component. The glob walks the components tree directly.
- **Don't use `@storybook/react`, `@storybook/react-webpack5`, `@storybook/nextjs`, or `@storybook/nextjs-vite`** — only `@storybook/react-vite` is correct for this stack.
- **Don't import the `Meta`/`StoryObj` types from `@storybook/react`** — use `@storybook/react-vite` (the framework path). The renderer-only path is wrong here.
- **Don't add `webpackFinal`** — there is no Webpack here. Configuration goes through `viteFinal`.
- **Don't commit `storybook-static/`** — `.gitignore` it. It's a build artifact.
- **Don't enable test-runner addons** for this repo — Playwright drives stories. See `playwright-story-tests`.
- **Don't omit the Tailwind CSS import in `preview.tsx`** — without it, stories render unstyled and the visual debug loop breaks. Import the same `app/styles/index.css` the app uses.

## Triggers on
storybook config, storybook vite builder, storybook main.ts, storybook preview.ts, shared vite config, storybook addon
