---
name: stylelint
description: "Stylelint with the Tailwind v4 plugin for every `.css` file in mind-palace — CSS lint exclusively, `--max-warnings 0` is the gate, and the CLI watcher is the source of truth (not the IDE). Triggers on: stylelint, stylelintrc, stylelint tailwind, stylelint css, stylelint watch, stylelint plugin, max-warnings."
license: MIT
---

Owns CSS linting. Stylelint is the only tool that touches `.css` in this repo; Biome's CSS surface is intentionally disabled.

## When to invoke
- Authoring or editing `stylelint.config.mjs`.
- A CSS file produces an `unknown-at-rule` for `@theme`, `@apply`, `@layer`, or `@import "tailwindcss"`.
- Wiring `stylelint --watch` into `bun run dev` or `--max-warnings 0` into the gate.
- Adding a Stylelint rule or override.

## Owns
Stylelint config with the Tailwind plugin for `.css`, `--max-warnings 0`, CLI watcher (the source of truth, not the IDE), and the rule that Stylelint owns CSS exclusively.

## Defers to
- `biome` — for everything `.ts`/`.tsx`/`.js`/`.json`. Stylelint MUST NOT touch JS/TS.
- `tailwind` (Wave 3, forward) — for what `@theme`, `@apply`, `@layer`, `@variant`, and `@import "tailwindcss"` actually mean; Stylelint just needs to recognise them.
- `turborepo` — for *when* `stylelint` runs in the gate sequence.

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: `stylelint --max-warnings 0` exits non-zero on the first warning. The CLI watcher in `bun run dev` is the source of truth — the IDE plugin is not authoritative and may not be running.
- The format/lint split with Biome is an extension boundary: Stylelint owns `.css`; Biome owns `.ts`/`.tsx`/`.js`/`.json`. Stylelint does not lint JS/TS.
- Tailwind directives are recognized via a syntax-aware plugin, not by blanket-ignoring them in `at-rule-no-unknown`.

## Patterns

### Minimal `stylelint.config.mjs`
```js
/** @type {import('stylelint').Config} */
export default {
  extends: [
    "stylelint-config-standard",
    "@dreamsicle.io/stylelint-config-tailwindcss",
  ],
};
```
ESM only — no `module.exports`. The dreamsicle config teaches Stylelint about every Tailwind v4 directive via `languageOptions.syntax`.

### Workspace script
Stylelint 16 dropped the native `--watch` flag. mind-palace wraps Stylelint in `chokidar-cli` (root `devDependencies`) so the CLI watcher is real and the IDE plugin stays non-authoritative.

```jsonc
// apps/<name>/package.json
{
  "scripts": {
    "stylelint":       "stylelint \"**/*.css\" --max-warnings 0",
    "stylelint:watch": "chokidar \"app/**/*.css\" --initial --debounce 200 -c \"stylelint 'app/**/*.css' --allow-empty-input\""
  }
}
```
The gate uses `stylelint` (top-level script in root `package.json`). `bun run dev` co-runs `stylelint:watch` via Turbo's `with: ["storybook", "biome:watch", "stylelint:watch"]` declared on the `dev` task in root `turbo.json` (see `turborepo`). `--initial` runs Stylelint once on startup; `--debounce 200` collapses bursts of saves. Watch mode drops `--max-warnings 0` so transient findings during edits don't kill the watcher — `--max-warnings 0` is the gate's job.

### Tailwind directives Stylelint must accept
```css
@import "tailwindcss";

@theme {
  --color-brand: oklch(0.7 0.2 280);
}

@layer components {
  .button {
    @apply rounded px-4 py-2;
  }
}
```
The dreamsicle config recognizes `@theme`, `@apply`, `@layer`, `@variant`, `@custom-variant`, `@source`, `@reference`, `@plugin`, and `@config`, plus the `--spacing()` / `--alpha()` functions. No manual `ignoreAtRules` array needed.

### Co-located CSS lints too
```
apps/web/app/components/button/
├── index.tsx
├── stories.tsx
├── schema.ts
└── styles.css   ← also linted by stylelint
```
Stylelint's glob covers every `.css` in the workspace, including component-co-located ones.

## Anti-patterns
- **Don't blanket-ignore Tailwind directives** via `at-rule-no-unknown.ignoreAtRules: ["theme", "apply", ...]` — that hides real CSS errors. Use the syntax-aware plugin instead.
- **Don't use `module.exports`** — Stylelint 16+/17 expects ESM `export default`.
- **Don't lint `.ts`/`.tsx`/`.js`/`.json` with Stylelint** — that's Biome's surface (see `biome`).
- **Don't disable `--max-warnings 0` in CI to make it green** — fix the warning. The gate is zero-warning.
- **Don't introduce `@tailwind base; @tailwind components; @tailwind utilities;`** — that's v3 syntax. Use `@import "tailwindcss";`.

## Triggers on
stylelint, stylelintrc, stylelint tailwind, stylelint css, stylelint watch, stylelint plugin, max-warnings
