---
name: ts
description: "TypeScript 7 (Go-based `tsgo` compiler from `@typescript/native-preview`, source at microsoft/typescript-go) for mind-palace — strict configuration with `tsconfig` bases in `packages/tsconfig`, `tsgo --noEmit` is the gate, and any type that has a Zod schema MUST use `z.infer` instead of a hand-written shape. Triggers on: typescript, typescript 7, tsgo, native-preview, ts strict, tsconfig, tsgo --noEmit, ts compiler, isolatedDeclarations, ts project references."
license: MIT
---

Owns the TypeScript 7 strict-mode configuration, the shared `tsconfig` bases in `packages/tsconfig/`, and the `tsgo --noEmit` gate stage. Pinned to **`@typescript/native-preview`** — the Go-based native compiler ([microsoft/typescript-go](https://github.com/microsoft/typescript-go)). The binary is `tsgo` (replaces `tsc`); same `tsconfig.json` shape, same flags, same diagnostics on TypeScript files (parity per upstream's status table). Emit is handled by Bun/Vite — `tsgo` only checks.

`isolatedDeclarations: true` is the eventual target but is left **off** in the base today: the t3-env `createEnv` return type is generic-heavy and not yet annotated for fast .d.ts emit. Turn it on once the env wiring is annotated and surface the change in AGENTS.md.

## When to invoke
- Authoring or editing a `tsconfig.json` (root, base, or workspace).
- Diagnosing a `tsgo --noEmit` failure during the gate.
- Setting up project references between `apps/web` and `packages/*`.
- A user asks for a hand-written interface — redirect to `z.infer<typeof Schema>`.

## Owns
TypeScript 7 strict config, `tsconfig` bases in `packages/tsconfig`, `tsgo --noEmit` gate behavior, and the "no hand-written type when a Zod schema exists" rule.

## Defers to
- `zod` (Wave 2, forward) — for *how to author* a schema. Once it exists, the type is `z.infer<typeof Schema>`. The "always use `z.infer`" rule is owned by zod; ts enforces it through "don't hand-write types that mirror an existing schema."
- `biome` — for lint/format of `.ts`/`.tsx`. ts owns type-checking; Biome owns syntactic concerns.
- `turborepo` — for *when* `tsgo --noEmit` runs in the gate sequence (after Stylelint, before `bun test`).
- `bun-test` — for testing the runtime behavior of types' boundary parses.

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: `tsgo --noEmit` exits non-zero on any error; the gate has zero tolerance.
- Pillar 2 (Zod-first types) means: every type with a corresponding Zod schema is `z.infer<typeof Schema>`; ts does not own the schema authoring (zod does), but it does refuse hand-written duplicates.
- Project-wide settings: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"verbatimModuleSyntax": true`. (`isolatedDeclarations` is the eventual target but currently OFF — see overview paragraph above for why.)
- Use `import type { ... }` for type-only imports — required by `verbatimModuleSyntax`.

## Patterns

### Shared base in `packages/tsconfig/base.json`
```jsonc
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    // "isolatedDeclarations": true, // eventual target — currently off (t3-env createEnv return type not yet annotated for fast .d.ts emit)
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2024",
    "lib": ["es2024", "dom", "dom.iterable"],
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```
Every workspace `tsconfig.json` extends this base — never duplicate compiler options across workspaces.

### Workspace `tsconfig.json`
```jsonc
// apps/web/tsconfig.json
{
  "extends": "@mind-palace/tsconfig/base.json",
  "compilerOptions": {
    "types": ["bun", "vite/client"],
    "paths": { "~/*": ["./app/*"] }
  },
  "include": ["app/**/*", "*.config.ts"],
  "references": [{ "path": "../../packages/schemas" }]
}
```
Every `tsconfig` extends the base; per-workspace overrides are minimal.

### Boundary parsing replaces casts
```ts
import { z } from "zod";

// schema is the source of truth for the type
export const ScoreSchema = z.object({ value: z.number().int().min(0) });
export type Score = z.infer<typeof ScoreSchema>; // never hand-written

// at the boundary, parse — never cast
function loadScore(raw: unknown): Score {
  return ScoreSchema.parse(raw);
}
```
`as` casts at module boundaries are forbidden by AGENTS.md. Parse with Zod instead — see `zod` for the schema authoring rules.

### Type-only imports under `verbatimModuleSyntax`
```ts
import type { ReactNode } from "react";
import { z } from "zod";

import type { Score } from "./schema";
```
Without `import type`, type-only specifiers leak into runtime imports and `verbatimModuleSyntax` errors.

### Gate invocation
```bash
tsgo --noEmit          # third stage of `bun run check`
tsgo --noEmit --watch  # local inner loop alongside `bun run dev`
```
`tsgo` only checks; emit is Bun's/Vite's job. If a script reaches for `tsc` directly, it's referencing a binary that no longer exists in this repo — swap to `tsgo`.

## Anti-patterns
- **Don't hand-write a type that mirrors a Zod schema** — use `z.infer<typeof Schema>` (see `zod`).
- **Don't use `as` to cross a module boundary** — parse with Zod and let `safeParse` carry the failure.
- **Don't use `any`** — `unknown` plus a Zod parse is the only correct way through an opaque value.
- **Don't disable `noUncheckedIndexedAccess` or `exactOptionalPropertyTypes`** — they catch IDB-shape bugs that the runtime would silently swallow.
- **Don't use `import` for a type-only specifier** — `verbatimModuleSyntax` errors on it; use `import type`.
- **Don't run `tsgo` (or `tsc`) to emit** — the build is Bun/Vite; the TypeScript compiler only type-checks here.
- **Don't depend on the `typescript` package by name** — this repo ships `@typescript/native-preview` instead. Tools that look up `typescript` in `node_modules` may need a peer/fallback shim if they refuse to resolve through the native-preview package.

## Triggers on
typescript 7, ts strict, tsconfig, tsgo --noEmit, ts compiler, isolatedDeclarations, ts project references
