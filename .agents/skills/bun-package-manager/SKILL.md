---
name: bun-package-manager
description: "Bun 1.3.13 package manager for the mind-palace monorepo — `bun install`, `bun add`, the text lockfile `bun.lock`, workspace globs, the `packageManager` pin, and overrides. Triggers on: bun install, bun add, bun remove, bun.lockb, bun workspace, bun overrides, bun lockfile."
license: MIT
---

Sub-skill of `bun`. Owns dependency installation, lockfile, and workspace topology for the mind-palace TurboRepo monorepo.

## When to invoke
- Adding/removing a package to `apps/web` or any `packages/*`.
- Setting up the workspace globs in the root `package.json`.
- Diagnosing a lockfile diff in CI or a slow `bun install`.
- Pinning a transitive dep via `overrides`.

## Owns
`bun install`, `bun add`, lockfile (`bun.lock` — text JSONC since Bun 1.2), workspace resolution, `packageManager` pin, and overrides/resolutions.

## Defers to
- `bun` (parent) — for the version pin contract.
- `turborepo` — for "how installed deps are sequenced into tasks" (`turbo` orchestrates; bun installs).
- `bun-runtime` — for actually executing scripts after install.

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: CI runs `bun install --frozen-lockfile` so a stale `bun.lock` fails the gate. Local dev uses plain `bun install`.
- The lockfile in this repo is **`bun.lock`** (text JSONC since Bun 1.2). Do not commit `bun.lockb`. Do not delete the lockfile to "fix" install issues — find the actual conflict.
- Workspace deps use the `workspace:*` protocol; never a published version range pointing at a local package.

## Patterns

### Root `package.json` workspace shape
```jsonc
// package.json (repo root)
{
  "name": "mind-palace",
  "private": true,
  "packageManager": "bun@1.3.13",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "check": "turbo run check",
    "dev": "turbo run dev",
    "build": "turbo run build"
  }
}
```
`workspaces` is the only place workspace globs live. Per-package `package.json` files reference siblings via `workspace:*`.

### Adding deps to a specific workspace
```bash
bun add --cwd apps/web jotai idb
bun add --cwd packages/schemas zod
bun add -d --cwd apps/web @types/node
```
Always use `--cwd` to target the correct workspace. Adding at the root pulls in a tool that *every* workspace shares (rare).

### Workspace-internal dep
```jsonc
// apps/web/package.json
{
  "dependencies": {
    "@mind-palace/schemas": "workspace:*"
  }
}
```
Then `bun install` from the root resolves it to the local `packages/schemas`.

### Frozen install in CI
```bash
bun install --frozen-lockfile
```
Used by GitHub Actions and by the pre-commit hook. Fails if `bun.lock` would have to change — which is exactly what you want before `bun run check`.

### Pin a transitive dep with overrides
```jsonc
// package.json (repo root)
{
  "overrides": {
    "react": "19.0.0"
  }
}
```
Use sparingly — overrides defeat the lockfile contract for that dep.

## Anti-patterns
- **Don't commit `bun.lockb`** — the text `bun.lock` is the source of truth in this repo; the binary form is older.
- **Don't run `npm install` / `pnpm install` / `yarn install`** — they will not honor `packageManager` and will produce a non-Bun lockfile.
- **Don't use `link:` or `file:` for in-monorepo deps** — `workspace:*` is the only correct form.
- **Don't reach for `nodemon`/`dotenv`/`tsx`/`rimraf`/`cross-env`/`concurrently`** — Bun's runtime covers all of these natively (see `bun-runtime`).
- **Don't bypass `--frozen-lockfile` in CI** to "make it pass" — fix the lockfile locally and commit.

## Triggers on
bun install, bun add, bun remove, bun.lockb, bun workspace, bun overrides, bun lockfile
