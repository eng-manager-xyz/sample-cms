---
name: bun-runtime
description: "Bun 1.3.13 runtime APIs for tooling and scripts in mind-palace — Bun.serve, Bun.file, Bun.$, bunx — with the rule that browser code is bundled by Vite, never executed directly by Bun. Triggers on: bun runtime, Bun.serve, Bun.file, Bun.$, bun shell, bunx, bun script."
license: MIT
---

Sub-skill of `bun`. Covers the Bun 1.3.13 runtime surface as it shows up in build scripts, codegen, and one-off tooling. Browser app code is built by Vite — Bun does not execute the React app at runtime.

## When to invoke
- Writing a maintenance script in `scripts/*.ts` that touches the filesystem or shells out.
- Running a tool through `bunx <package>` (the `npx` equivalent).
- Authoring a tiny local-only HTTP helper for tests/fixtures (never the production server — there is no production server).

## Owns
Bun runtime APIs (`Bun.serve`, `Bun.file`, `Bun.$`, FFI), runtime flags, and the rule that browser code is bundled by Vite — Bun is the script/tooling runtime.

## Defers to
- `bun` (parent) — for Bun version pinning and overall routing.
- `bun-package-manager` — for installing the script's dependencies.
- `bun-test` — when the script is actually a test file.
- `nitro` — for the static build output; Bun does not serve the prod app.

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: any script you write to support `bun run check` must exit non-zero on any warning, mirroring the gate's contract.
- The runtime is **tooling-only**. The kid loads the app from GitHub Pages — there is no Bun on the server because there is no server.
- Use `Bun.$` over `child_process.spawn` for cross-platform shell snippets (Bun escapes interpolation safely; Node's `exec` does not).

## Patterns

### Read/write files in scripts
```ts
// scripts/sync-fixtures.ts — runs via `bun run scripts/sync-fixtures.ts`
const manifest = await Bun.file("./fixtures/manifest.json").json();
await Bun.write("./apps/web/public/fixtures.json", JSON.stringify(manifest, null, 2));
```
`Bun.file` is lazy; `Bun.write` accepts strings, bytes, or another `BunFile`.

### Shell out safely with `Bun.$`
```ts
import { $ } from "bun";

const sha = (await $`git rev-parse --short HEAD`.text()).trim();
const { exitCode } = await $`bun run check`.nothrow();
if (exitCode !== 0) process.exit(exitCode);
```
Interpolation is auto-escaped. `nothrow()` returns the exit code instead of throwing — needed when chaining gate steps.

### Run third-party CLIs with `bunx`
```bash
bunx playwright install chromium
bunx @tanstack/router-cli generate
```
`bunx` is the only correct invocation form in this repo. Never `npx`.

### Local-only helper server (rare)
```ts
// dev fixture server — never runs in production
const server = Bun.serve({
  port: 0, // OS-assigned
  routes: {
    "/health": new Response("ok"),
    "/fixture/:id": (req) => Response.json({ id: req.params.id }),
  },
});
console.log(`fixtures on ${server.url}`);
```
Use only for Playwright fixtures or local dev tooling. The mind-palace app itself ships as static files — see `nitro`.

## Anti-patterns
- **Don't run app code through `bun run apps/web/...`** — Vite builds the SPA; Bun's runtime never executes React in this stack.
- **Don't use `node:child_process` for shell commands** — `Bun.$` is cross-platform and escape-safe.
- **Don't reach for `dotenv`/`nodemon`/`tsx`** — Bun loads `.env*` automatically and runs `.ts` natively.
- **Don't write a long-lived `Bun.serve` for production** — the deploy target is GitHub Pages (static); a server contradicts that.

## Triggers on
bun runtime, Bun.serve, Bun.file, Bun.$, bun shell, bunx, bun script
