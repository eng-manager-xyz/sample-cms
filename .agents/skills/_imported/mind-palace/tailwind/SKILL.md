---
name: tailwind
description: "Tailwind v4 with the Vite plugin for mind-palace — CSS-first config via `@theme`, `@import \"tailwindcss\"` as the only entry point, `@apply` for component composition, and a single shared Vite config that Storybook reuses. Triggers on: tailwind, tailwind v4, tailwindcss, @theme, @import \"tailwindcss\", tailwind vite plugin, design tokens."
license: MIT
---

Tailwind v4 is the only allowed styling layer. There is no `tailwind.config.js`, no `postcss.config.js`, no Sass/Less; the CSS file *is* the config. The Vite plugin is wired once and reused by Storybook in Wave 4 — never forked.

## When to invoke
- Authoring or editing `apps/web/app/styles/index.css` (the single Tailwind entry).
- Defining a design token in `@theme { ... }`.
- Composing utilities with `@apply` inside a co-located component CSS file.
- Wiring `@tailwindcss/vite` into `apps/web/vite.config.ts`.
- Diagnosing a missing utility, a stale class, or a forked Storybook config.

## Owns
Tailwind v4 install via Vite plugin, `@theme` design tokens, `@import "tailwindcss"`, and the single shared Vite config consumed by the app and Storybook.

## Defers to
- `stylelint` — for *how the linter validates Tailwind directives*. The dreamsicle Tailwind plugin teaches Stylelint about `@theme`, `@apply`, `@layer`, `@variant`, `@source`, etc.; this skill just emits the directives that Stylelint must accept.
- `biome` — for everything `.ts`/`.tsx`/`.js`/`.json`. Tailwind class strings inside JSX are still Biome's surface; Tailwind's surface stops at the `.css` file.
- `bun-package-manager` — for installing `tailwindcss` and `@tailwindcss/vite`.
- `storybook-config` (Wave 4, forward) — Storybook re-uses the app's Vite config, which already has `@tailwindcss/vite`. Storybook MUST NOT add its own copy.

## Dean-stack rules
- Pillar 1 (Storybook-first) means: Storybook reads the *same* Vite config the app uses (Tailwind v4 is a Vite plugin, so it just works). Forking Tailwind config in `.storybook/` is a bug — see `storybook-config` (forward).
- Pillar 4 (CLI-gate-first) means: Tailwind directives are recognized by Stylelint via the syntax-aware plugin (see `stylelint`); a stylelint warning fails `bun run check`.
- Tailwind v4 only. v3 syntax (`@tailwind base; @tailwind components; @tailwind utilities;`, `tailwind.config.js`'s `content`/`theme.extend`/`plugins`, `bg-opacity-*`, `flex-grow-*`, `decoration-clone`, `start-*`/`end-*`) is wrong by definition — rewrite to v4.
- No CSS preprocessors (Sass/Less/Stylus). Tailwind v4 + Lightning CSS *is* the preprocessor.
- No `postcss-import` / `autoprefixer`. Lightning CSS handles imports and prefixing.
- The `important` modifier is end-of-class in v4 (`bg-red-500!`), not start-of-class.

## Patterns

### The single CSS entry
```css
/* apps/web/app/styles/index.css — pinned: tailwindcss ^4.x */
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.62 0.20 260);
  --color-brand-900: oklch(0.30 0.10 260);
  --font-display: "Satoshi", ui-sans-serif, system-ui, sans-serif;
  --breakpoint-3xl: 120rem;
  --spacing: 0.25rem; /* base unit; utilities like p-4 = calc(var(--spacing) * 4) */
}

@custom-variant dark (&:where(.dark, .dark *));
```
The `@theme` block produces both utilities (`bg-brand-500`, `font-display`, `3xl:grid-cols-4`) and CSS variables (`var(--color-brand-500)`) automatically. There is no separate `tailwind.config.js`.

### Vite plugin wiring (single source of truth)
```ts
// apps/web/vite.config.ts — pinned: @tailwindcss/vite ^4.x
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
});
```
Storybook re-uses this config wholesale (see `storybook-config` in Wave 4) — **do not** add `@tailwindcss/vite` to `.storybook/main.ts` separately. Forks drift; the lint catches the symptoms but not the cause.

### Co-located component CSS with `@apply`
```css
/* apps/web/app/components/button/styles.css */
@reference "../../styles/index.css"; /* makes @theme tokens visible to this file's @apply */

.button {
  @apply rounded px-4 py-2 bg-brand-500 text-white font-display;
}
.button:hover {
  @apply bg-brand-900;
}
```
`@reference` (v4) gives the file visibility into the design tokens declared in the entry without re-emitting the framework. Use `@apply` sparingly — utility classes in JSX are the default; `@apply` is for the rare composition that needs a real selector (focus-within trees, third-party-overridable surfaces).

### Custom utility via `@utility`
```css
@utility scroll-shadow {
  background:
    linear-gradient(white 30%, transparent),
    radial-gradient(at top, rgba(0, 0, 0, 0.1), transparent 70%);
}
```
Generates a real utility class (`scroll-shadow`) that participates in variants (`hover:scroll-shadow`, `dark:scroll-shadow`). Prefer `@utility` over a raw selector when the visual effect is reusable.

### Design tokens — namespace recap
```css
@theme {
  /* Colors auto-generate bg-/text-/border-/ring-/accent-/caret-/divide-/outline-/from-/via-/to-/fill-/stroke- utilities. */
  --color-success: oklch(0.65 0.18 145);

  /* Spacing/Radius/Width/Height — auto-generate p-/m-/w-/h-/etc. */
  --radius-card: 1rem;

  /* Font family / weight / leading / tracking. */
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Breakpoints — extend the responsive scale. */
  --breakpoint-3xl: 120rem;
}
```
Token namespaces in v4: `--color-*`, `--font-*`, `--text-*`, `--font-weight-*`, `--leading-*`, `--tracking-*`, `--spacing-*`, `--radius-*`, `--shadow-*`, `--breakpoint-*`, `--container-*`, `--ease-*`, `--animate-*`. Anything you put under one of these auto-generates utilities.

### Class strings in JSX
```tsx
// Tailwind class strings in TSX are Biome's surface (linting), not Stylelint's.
export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card bg-brand-500 p-4 text-white shadow-md hover:bg-brand-900">
      {children}
    </div>
  );
}
```
Use the parenthesized CSS-variable shorthand for one-offs: `className="bg-(--brand-500)"`. The `important` modifier goes at the end of the class: `bg-red-500!`.

### Workspace install
```bash
bun add -D tailwindcss@^4 @tailwindcss/vite@^4
# NOTE: do NOT install postcss-import or autoprefixer — Lightning CSS handles both.
```
The plugin is the only Tailwind dep needed for the app. Stylelint adds its own Tailwind plugin (`@dreamsicle.io/stylelint-config-tailwindcss`) — see `stylelint`.

## Anti-patterns
- **Don't write `@tailwind base; @tailwind components; @tailwind utilities;`** — that's v3. v4 is `@import "tailwindcss";`.
- **Don't author `tailwind.config.js`** — design tokens go in `@theme { ... }` inside CSS. JS config via `@config "./tailwind.config.js"` is for legacy migrations only and ignores `corePlugins`/`safelist`/`separator` anyway.
- **Don't install `postcss-import` or `autoprefixer`** — Lightning CSS handles both. Adding them duplicates work and breaks v4's source-map output.
- **Don't fork the Tailwind config in Storybook** — Storybook re-uses the app's Vite config. Adding `@tailwindcss/vite` to `.storybook/main.ts` causes drift and is the canonical way to land "works in app, broken in stories."
- **Don't use Sass/Less/Stylus alongside Tailwind v4** — Tailwind *is* the preprocessor. A `.scss` file with Tailwind directives is wrong by construction.
- **Don't use deprecated/removed v4 utilities** — `bg-opacity-*` (use `bg-red-500/50`), `flex-grow-*`/`flex-shrink-*` (use `grow-*`/`shrink-*`), `decoration-clone` (use `box-decoration-clone`), `overflow-ellipsis` (use `text-ellipsis`), `start-*`/`end-*` deprecated in 4.2 (use `inline-s-*`/`inline-e-*`).
- **Don't disable a Stylelint warning to make a directive pass** — the warning means the syntax-aware plugin isn't loaded. Fix `stylelint.config.mjs` (see `stylelint`); do not blanket-ignore.
- **Don't put the `!` important modifier at the start** — `!bg-red-500` is v3. v4 is `bg-red-500!`.
- **Don't reach for `theme(colors.red.500)` in new code** — deprecated. Use the generated CSS variable: `var(--color-red-500)`. In media queries use `theme(--breakpoint-xl)` (variable form).

## Triggers on
tailwind, tailwind v4, tailwindcss, @theme, @import "tailwindcss", tailwind vite plugin, design tokens
