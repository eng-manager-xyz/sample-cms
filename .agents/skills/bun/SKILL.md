---
name: bun
description: "Router skill for Bun 1.3.13 in mind-palace — pins the runtime via `packageManager` and dispatches to a sub-skill (runtime, test, package manager) based on the question. Triggers on: bun, bun 1.3.13, packageManager, which bun, bun overview."
license: MIT
---

Entry point for any Bun-shaped question in mind-palace. Bun 1.3.13 is the only allowed runtime/toolchain for this repo and is pinned via the root `packageManager` field.

## When to invoke
- The user types `bun` with no further specifier and you need to route them.
- The user asks "which Bun skill," "Bun overview," or how Bun is installed/pinned for this repo.
- A question mixes runtime + test + install concerns and the right sub-skill is ambiguous — pick after reading the patterns table below.

## Owns
Entry point that routes Bun questions to the right sub-skill (runtime, test runner, package manager) and pins Bun 1.3.13 via `packageManager`.

## Defers to
- `bun-runtime` — anything about executing scripts (`Bun.serve`, `Bun.file`, `Bun.$`, `bunx`, runtime flags).
- `bun-test` — anything about unit tests (`bun test`, `bun:test` matchers, mocks, coverage, watch).
- `bun-package-manager` — anything about installing/adding/removing deps, the lockfile, workspaces, or overrides.
- `turborepo` — for *which task runs when* (`bun run check` ordering, `dependsOn`); Bun is the executor, Turbo is the scheduler.

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: every script in `package.json` is invoked as `bun run <name>` and must be reachable through Turbo — no direct `npx`/`pnpm`/`npm` invocations slip in.
- Pillar 3 (IDB-first state) is unaffected at the Bun layer (state lives in the browser), but Bun is what runs the migration unit tests in `bun test`.
- The `packageManager` pin is load-bearing: a contributor on a different Bun version will get reproducible installs only if this field is honored by `corepack`/CI.

## Patterns

### Pin Bun via `packageManager`
```jsonc
// package.json (repo root)
{
  "packageManager": "bun@1.3.13",
  "engines": { "bun": ">=1.3.13" }
}
```
The pin is the single source of truth — no `.bun-version`, no Volta entry. CI reads `packageManager` and installs the matching Bun.

### Routing table
| Question shape | Sub-skill |
|---|---|
| "How do I write a unit test for an atom reducer?" | `bun-test` |
| "Add `idb` to the web app" | `bun-package-manager` |
| "Run a script that shells out to `git`" | `bun-runtime` |
| "Why is `bun install` slow in CI?" | `bun-package-manager` |
| "Cap test runner at 1 thread for IDB" | `bun-test` |
| "Read a JSON file in a build script" | `bun-runtime` |

### One Bun, three roles
```bash
bun install           # bun-package-manager
bun run check         # bun-runtime executes the script Turbo orchestrates
bun test app/state    # bun-test
```
Each command lives in a different sub-skill; pick the one whose surface owns the verb.

## Anti-patterns
- **Don't suggest `npm`, `pnpm`, `yarn`, or `npx`** — the repo is Bun-only; `bunx` replaces `npx`.
- **Don't unpin `packageManager`** — a floating range (`bun@*`) defeats reproducibility.
- **Don't answer test/install/runtime questions inside this router** — route to the sub-skill so the answer carries the right rules.
- **Don't introduce `node` as a runtime target** — see `node` skill: Node 25 exists only for tools that refuse to run on Bun.

## Triggers on
bun, bun 1.3.13, packageManager, which bun, bun overview
