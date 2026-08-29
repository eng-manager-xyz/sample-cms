---
name: t3-env
description: "`@t3-oss/env-core` for mind-palace — client-only `VITE_*` env validation that runs at build time on GitHub Pages, with the `server` slot kept empty so a future move off Pages is a config change, not a refactor. Triggers on: clientPrefix, createEnv, env validation, env-core, env.ts, runtimeEnv, t3 env, t3-env, VITE_."
license: MIT
---

Owns `@t3-oss/env-core` setup in `apps/web/app/env.ts`. Schemas are authored per the `zod` skill; t3-env owns the `createEnv` shape, the `client` / (empty) `server` split, the `VITE_` prefix, and the rule that validation must run at build time — never at first page load.

## When to invoke
- Authoring or editing `apps/web/app/env.ts`.
- Adding a new `VITE_*` variable: schema entry + workflow secret/var injection + dev `.env` line.
- Diagnosing "env var is undefined in production but works in dev" (almost always a missing GitHub Actions `env:` injection).
- A request to add a `server` block — refuse and explain why on a static target.

## Owns
`@t3-oss/env-core` setup with `client` + (empty) `server` slots, `VITE_*` validation at build time, the typed `env` import, and the GH-Pages-only constraint.

## Defers to
- `zod` — for *how to author* a schema (`z.url()`, `z.coerce.number<string>()`, `z.stringbool()`, refinements). t3-env owns the `createEnv` wiring; zod owns the schema.
- `nitro` — for the `baseURL` / project-pages path concern (different file, but the same deploy mental model).
- `turborepo` — for *when* env validation runs in `bun run build` (it runs once when `vite.config.ts` is loaded; turbo caches accordingly).

## Dean-stack rules
- Pillar 2 (Zod-first types) means: every env entry is a Zod schema; the `env` import is typed from `z.infer` shapes via `createEnv`'s inference. No hand-written `Env` interface.
- Pillar 4 (CLI-gate-first) means: env validation runs in `bun run build` (because `vite.config.ts` does `import "./app/env"` as a side effect) and must fail the build before the deploy artifact uploads. Never gate it behind first-page-load.
- GitHub Pages is static-only — the `server` slot stays `{}`. Anything in `client` ends up in the published JS bundle and is publicly visible. Never put a real secret in the schema; if a key must be private, the use case does not belong on GH Pages (push back).
- The `server` slot exists in the file even when empty so a future move off GH Pages is one block away, not a refactor.

## Patterns

### Canonical `apps/web/app/env.ts`
```ts
// pinned: @t3-oss/env-core ^0.13.x, zod ^4.x
import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_GAME_TITLE: z.string().min(1),
    VITE_API_BASE: z.url().optional(),         // Zod 4 top-level format
  },
  server: {
    // Intentionally empty on GitHub Pages.
    // When this app moves off Pages, fill this and add a server runtime.
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,                // unset GH Actions secrets fall through to defaults
});
```
- `clientPrefix: "VITE_"` — Vite only inlines variables with this prefix.
- `runtimeEnv: import.meta.env` — explicit object literal so Vite's static replacement and tree-shaking stay honest.
- `emptyStringAsUndefined: true` — required for new code; an unset secret renders as `""` and would otherwise pass `z.string()`.

### `runtimeEnv` must merge `process.env` AND `import.meta.env`

Vite's config-load subprocess does NOT inherit Bun's auto-loaded `.env` and `import.meta.env` is empty during config evaluation. Browser runtime is the inverse: `process.env` is unavailable, `import.meta.env` is statically replaced. Spread both so the same `env` works in both contexts:

```ts
const runtimeEnv: Record<string, string | undefined> = {
  ...(typeof process !== "undefined" ? process.env : {}),
  ...(typeof import.meta !== "undefined" ? import.meta.env : {}),
};

export const env = createEnv({ clientPrefix: "VITE_", client: { ... }, server: {}, runtimeEnv, emptyStringAsUndefined: true });
```

### Side-effect import in `vite.config.ts` (the build-time gate)
```ts
import { defineConfig } from "vite";
import "./app/env"; // throws on invalid env, before bundling — keeps the broken artifact out of /dist
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  // Base path is env-driven via `BASE_PATH` (set by the deploy workflow from
  // `actions/configure-pages@v5`'s `base_path` output). See the `nitro` skill.
  base: process.env.BASE_PATH ?? "/",
  plugins: [tanstackStart({ /* ... */ })],
});
```
The bare `import "./app/env"` is the load-bearing line. Vite evaluates `vite.config.ts` once per `vite build`; a thrown `ZodError` here aborts the build and the deploy job never runs.

### Consuming `env` in app code
```ts
import { env } from "~/env";

const url = `${env.VITE_API_BASE ?? "/api"}/scores`;
```
The `env` object is fully typed; `env.VITE_GAME_TITLE` is `string`, `env.VITE_API_BASE` is `string | undefined`. No `as`, no `process.env`.

### GitHub Actions injection (must wrap the build job)
```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      VITE_GAME_TITLE: ${{ vars.VITE_GAME_TITLE }}
      VITE_API_BASE:   ${{ vars.VITE_API_BASE }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
```
Without this `env:` block, `import.meta.env.VITE_*` is `undefined` at build time, the schema fails, and the build aborts (which is the correct behavior).

### Adding a new variable — three places to update
1. `apps/web/app/env.ts` — add the schema entry under `client`.
2. `apps/web/.env` (committed dev defaults) and/or `.env.local` (gitignored).
3. `.github/workflows/deploy.yml` — add to the build job's `env:` block, sourced from `vars.*` (public) or `secrets.*` (still public after build, but conventionally tracked separately).

## Anti-patterns
- **Don't add anything to the `server` block on GH Pages** — there is no server runtime to read it. If a real secret is needed, the feature does not belong on GH Pages.
- **Don't import `@t3-oss/env-nextjs`** — it ships `NEXT_PUBLIC_` prefix logic and runtime assumptions that are wrong for a static Vite bundle.
- **Don't omit `emptyStringAsUndefined: true`** — without it, an unset GH Actions secret silently becomes `""` and slips past `z.string()`.
- **Don't validate at first page load** — by then the broken bundle is already on Pages. The `import "./app/env"` from `vite.config.ts` is the only correct gate.
- **Don't put a private key in any `client.VITE_*` field** — every value is shipped in the JS bundle and is publicly visible.
- **Don't write `runtimeEnv: process.env`** in a Vite app — use `import.meta.env`. `process.env` is a Node concept and is not populated in the browser bundle.
- **Don't hand-write an `Env` type** — `createEnv` infers it from the Zod schemas (see `zod`).

## Triggers on
clientPrefix, createEnv, env validation, env-core, env.ts, runtimeEnv, t3 env, t3-env, VITE_
