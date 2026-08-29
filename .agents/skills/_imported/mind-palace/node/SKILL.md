---
name: node
description: "Node 25 in mind-palace — installed only for tools that refuse to run on Bun, pinned via `.nvmrc` (the single source of truth). The repo does NOT ship `.tool-versions` or a `volta` block; the per-developer version manager is each contributor's choice. Node is a tooling runtime, never an application target. Triggers on: node 25, node version, .nvmrc, .tool-versions, volta, asdf, node tooling, node toolchain."
license: MIT
---

Owns the Node 25 install used by tools that don't run on Bun. The mind-palace app itself never executes on Node — it ships as static files to GitHub Pages. Node exists here strictly to host build/CI tools that haven't been ported to Bun.

## When to invoke
- Asked to set Node version for the repo (`.nvmrc`, `engines.node`).
- A tool refuses to run on Bun and you need to confirm it can run on Node 25.
- CI workflow needs `actions/setup-node`.
- Diagnosing a "tool requires Node X" error during install or build.
- Someone asks whether to add `.tool-versions`, a `volta` block, or otherwise "enforce" a version manager — see below.

## Owns
Node 25 install, version pinning via `.nvmrc`, the `actions/setup-node` invocation in CI, and the rule that Node is **only** for tooling — never a runtime target.

## Defers to
- `bun` — for everything that *can* run on Bun (almost everything in this stack).
- `bun-package-manager` — for installing deps (`bun install`, not `npm install`).
- `nitro` — for build-time tooling that may bridge through Node (CI uses Node 20+ per the upstream Nitro doc).
- `turborepo` — for orchestrating Node-hosted tools alongside Bun-hosted ones.

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: if a Node-hosted tool is in the gate, its CLI must obey the same zero-warning rule (no warnings, non-zero on any finding).
- Node is **tooling-only**. The app runtime is the browser; the script runtime is Bun. Do not introduce a `node` server, a `node:test` suite, or a Node-hosted dev server.
- **`.nvmrc` is the single source of truth for the Node version.** CI reads it (`actions/setup-node@v4` with `node-version-file: ".nvmrc"`); locally, contributors use `nvm`. The repo does NOT ship a parallel `.tool-versions` file or a `volta` block in `package.json` — adding either would create a second pin to keep in sync.
- The version manager itself is a **per-developer concern**, not a project dep — it's a shell tool installed globally, never an npm dependency.

## Patterns

### `.nvmrc` for the repo (the only Node pin)
```
25
```
A single major number. CI's `actions/setup-node` reads this; local `nvm` reads it via `nvm use`. Don't add a second pin elsewhere.

### CI: install Node alongside Bun
```yaml
# .github/workflows/check.yml (excerpt)
- uses: actions/setup-node@v4
  with: { node-version-file: ".nvmrc" }
- uses: oven-sh/setup-bun@v2
  with: { bun-version-file: "package.json" }
- run: bun install --frozen-lockfile
- run: bun run check
```
Both runtimes coexist. Bun is the executor for `bun run check`; Node is available for any tool the gate invokes that demands it. CI doesn't use any version-manager wrapper — `actions/setup-node` reads `.nvmrc` directly.

### When a tool demands Node
1. Verify it actually fails on Bun (try `bunx <tool>` first).
2. If it does, invoke it via a Node binary explicitly: `node ./node_modules/<tool>/bin/<tool>`.
3. Wrap that in a `bun run`-able npm script so Turbo still orchestrates it.
4. Document the Node-dependency in a script comment.

## Anti-patterns
- **Don't add a `.tool-versions` file** — `.nvmrc` already pins Node, and asdf-nodejs supports `.nvmrc` natively via its `legacy_version_file` setting. A second pin file is a maintenance hazard, not a feature.
- **Don't add a `"volta": {...}` block to `package.json`** — Volta reads `.nvmrc` for the Node version on its own, and Bun is already pinned via `packageManager`. The block would duplicate both pins.
- **Don't add asdf, Volta, nvm, fnm, or any version manager to `package.json` deps** — they're shell tools installed globally per developer, not npm packages. They cannot be `peerDependencies` and should not be `devDependencies`.
- **Don't write a `node` server** — the app is static (see `nitro` for the GH Pages preset).
- **Don't use `node:test`** — `bun test` is the unit-test runner (see `bun-test`).
- **Don't use `npm`/`pnpm`/`yarn`** to install — Bun owns the package manager (see `bun-package-manager`).
- **Don't pin Node below 22** — Node 22 LTS is the floor; 25 Current is the target.
- **Don't recommend `nodemon`/`tsx`/`dotenv`** — Bun covers these. If the user has Node-only tooling, use Node directly, but don't reach for the Node convenience wrappers.

## Triggers on
node 25, node version, .nvmrc, .tool-versions, volta, asdf, node tooling, node toolchain
