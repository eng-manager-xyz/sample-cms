---
name: five-phase-pass
description: "Use when asked to propagate a mind-palace monorepo change through the five-phase pass: P1 apps/web, P2 generator template, P3 regenerated test-project plus gate, P4 docs/owning skill, and P5 cross-skill audit. Also use when the user asks for the old /five-phase-pass command or passes `--baseline` to run only the cumulative skill audit."
argument-hint: "[change description] | --baseline"
---

<objective>
Drive a change through the mind-palace five-phase pass so the live app, the generator template, the regenerated test-project, the docs, and every skill stay coherent. P1 ships the change; P2 prevents new apps from being born stale; P3 proves the generator still works; P4 keeps the docs/skill that owns the change honest; P5 catches dangling pointers in the rest of the skill ecosystem.
</objective>

<args>
Treat the user's request after the skill trigger as the arguments.

If the arguments start with `--baseline`, run **P5 only** — audit all skills against the *cumulative* current stack (read AGENTS.md + README.md + `git log --oneline` to understand what the stack currently is). Skip P1–P4. Treat known prior changes (TS 7 / tsgo, asdf/Volta cleanup, PixiJS 8.18.1 first-party, TurboRepo generator, jotai-family removal) as already-shipped facts — the question is whether the skill ecosystem reflects them.

Otherwise treat the arguments as the change description (e.g. "remove jotai-family", "upgrade tsgo to 7.5", "add immer beside jotai"). If empty or ambiguous, ask before proceeding.
</args>

<phases>

### P1 — apps/web
Implement the change in `apps/web/`. Use the matching specialized skill from `.agents/skills/`. Source-code edits only.

### P2 — generator template
Mirror P1's source-level changes into `turbo/generators/templates/app/`. Diffs must be literally identical except for `{{name}}` token substitution. New apps must be born clean.

### P3 — regenerate test-project + gate
Regenerate `apps/test-project` from the updated template (or update in place if simpler). **`apps/test-project/` is gitignored — never commit it.** It's the local materialization of the generator template, kept on disk as a sanity-check artifact for the pass. Committing it makes CI run a duplicate Playwright suite that races for the same Storybook port (6006) as `apps/web` and tears Storybook down with `script "storybook" exited with code 1`.

**Before `bun run check`, run the `kill-servers` skill (or its inlined steps below) — leftover dev/preview/storybook processes from prior runs are the documented cause of intermittent `ERR_CONNECTION_REFUSED` on Playwright's parallel storybook workers. This is the single highest-yield way to make the gate go green on the first try.**

```bash
pkill -f "storybook dev" || true; pkill -f "vite preview" || true; pkill -f "vite dev" || true
sleep 2
lsof -i :3000 -i :5173 -i :6006 2>/dev/null | grep LISTEN || echo "all clear"
```

Then run `bun run check`. Must be green before P4. Retry once on a known infra flake (cold prebundle cache, port race); a real failure stops the pass — do NOT silently `.skip`.

### P3.4 — Dev fan-out smoke (dev orchestration changes only)
If P1 modified any of: root `turbo.json`, root `package.json`'s `dev` script, any per-app `package.json` `dev` / `storybook` / `biome:watch` / `stylelint:watch` scripts, or `turbo/generators/templates/app/package.json` — smoke `bun run dev` and confirm all four co-runners actually stay alive. The gate (`bun run check`) does NOT exercise the dev workflow, so a broken watcher script (e.g. a tool that no longer ships `--watch`) or an inverted Turbo `with` direction passes the gate but breaks the iPad-over-LAN inner loop on next `bun run dev`.

```bash
pkill -f "storybook dev" 2>/dev/null; pkill -f "vite dev" 2>/dev/null; pkill -f "chokidar" 2>/dev/null; pkill -f "biome check" 2>/dev/null; pkill -f "stylelint" 2>/dev/null; sleep 2
(bun run dev > /tmp/dean-dev.log 2>&1 &) ; sleep 25; pgrep -af "vite dev|storybook dev|chokidar" | head -10; lsof -i :5173 -i :6006 2>/dev/null | grep LISTEN; pkill -f "turbo run dev"; pkill -f "vite dev"; pkill -f "storybook dev"; pkill -f "chokidar"
```

Pass criteria — all four must be true after 25s:
1. `vite dev` process alive, port 5173 LISTEN
2. `storybook dev` process alive, port 6006 LISTEN
3. `chokidar ... biome check` process alive (biome:watch wrapper)
4. `chokidar ... stylelint` process alive (stylelint:watch wrapper)

If any of the four exited or its port is silent, dev is broken. Inspect `/tmp/dean-dev.log` for the failure mode and fix at the orchestration source — `with`-direction in `turbo.json` (must be on the task you invoke, e.g. `dev`, NOT on the watcher), the per-app script (Biome 2.x and Stylelint 16 both ship NO native `--watch` — both are wrapped in `chokidar-cli`), or the root filter.

Skip this step for changes that don't touch dev orchestration (component edits, schemas, tests, docs).

### P3.4.1 — Dev browser-console smoke (any P1 change)
The gate's Playwright runs against `bun run preview` (the production build), so dev-only runtime errors are invisible to it: `react-scan` is gated to `import.meta.env.DEV`, top-level-await module evaluation runs in dev only, side channels (anime.js, PixiJS) initialize via dev paths, and Vite's prebundle cache is dev-only. A broken `applyEngineDefaults` or a stale `.vite/deps` entry passes the gate green and reveals itself only when a human opens the browser.

**An empty error log is NOT proof the page works.** A blank page can render without throwing — React rendered into an empty body, hydration silently no-op'd because the target element is missing, etc. The smoke MUST also assert visible content.

After P3 (and P3.4 if applicable), with `bun run dev` already up:

```js
// /tmp/dean-smoke.mjs — adjust the playwright path to match the workspace install
import { chromium } from "/abs/path/to/node_modules/playwright/index.js";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errs = []; const failed = [];
page.on("pageerror", (e) => errs.push(`PAGE: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errs.push(`[${m.type()}] ${m.text()}`); });
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
// Don't use `networkidle` — Vite HMR and opt-in TanStack DevTools can keep
// websockets open and the wait would never resolve. DOM + an explicit h1-wait
// is the contract: every mind-palace route renders an h1.
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector("h1", { timeout: 15000 });
await page.waitForTimeout(1500);
const innerText = await page.evaluate(() => document.body.innerText);
const innerHtmlLen = await page.evaluate(() => document.body.innerHTML.length);
const title = await page.title();
const h1 = await page.$$eval("h1", (els) => els.map((e) => e.textContent));
console.log("ERRORS:", errs.length || "(none)", errs.join("\n"));
console.log("FAILED:", failed.length || "(none)", failed.join("\n"));
console.log("TITLE:", title, "H1:", JSON.stringify(h1), "BODY_LEN:", innerHtmlLen);
console.log("BODY:", innerText.slice(0, 200));
await browser.close();
const blank = innerText.trim().length < 5;
process.exit(errs.length + failed.length === 0 && !blank ? 0 : 1);
```

```bash
bun /tmp/dean-smoke.mjs   # exit 0 = pass; non-zero = fix the cause
```

Pass criteria — ALL must be true:
1. `pageerror` list empty
2. No `error` / `warning` console messages
3. No 4xx/5xx responses
4. **`document.body.innerText.trim().length >= 5`** — proves the page actually rendered something visible, not just an empty React shell

The most common failure modes:
1. **Stale Vite prebundle cache** after a renamed import — `rm -rf apps/<name>/node_modules/.vite` and restart dev
2. **Side-channel API misuse** — e.g. `utils.set(engine, ...)` instead of `engine.defaults.foo = ...` (animejs); `app.stage.addChild(...)` called during render instead of inside `usePixiApp`'s `setup` (PixiJS)
3. **Broken module evaluation chain** — a top-level throw in `client.tsx` (or any module imported by it) breaks `hydrateRoot` and surfaces unrelated downstream errors like "react-scan failed to load"
4. **Hydration target mismatch** — TanStack Start in SPA mode renders the full document via `__root__`'s `<html>...</html>`. `client.tsx` must `hydrateRoot(document, <StartClient />)` (importing `StartClient` from `@tanstack/react-start/client` — the **subpath** export, NOT the main entry). `hydrateRoot(document.getElementById("root"), ...)` silently no-ops because no `<div id="root">` exists in the SSR output, leaving the page blank with NO error.
5. **Two React copies via Bun's hashed `.bun/...@<hash>` cache** — produces "Invalid hook call" / "null useContext" errors. Add `resolve.dedupe: ["react", "react-dom", "@tanstack/react-router"]` to `vite.config.ts`.
6. **react-scan v0.5.x + TanStack Router's `HeadContent`** — react-scan's React-19 instrumentation breaks `useContext` inside `HeadContent`'s `useRouter`. Symptom: app renders the route's error UI ("Something went wrong / Cannot read properties of null"). Mitigation: keep react-scan in Storybook only; do NOT load it in the app's `client.tsx` or via `__root__`'s `head.scripts`.
7. **Missing static asset** — typically `/favicon.ico`. mind-palace's `__root__` route ships an inline data-URI favicon via `head.links`; verify it's still present.

Re-run after fixing — must reach exit 0 before P4.

### P3.5 — Render-quality visual check (UI-touching changes only)
If P1 modified any `*.tsx` file (component, route, hook that fronts a side channel), after the gate passes, run a Playwright session with `react-scan` loaded — **point at the affected story** — and inspect for highlighted re-render boxes. `react-scan` is loaded automatically in Storybook dev via `.storybook/preview.tsx` (gated by `import.meta.env.DEV`); the Storybook Playwright project hits dev mode, so render highlights are live there. **Not loaded in the app dev server** — react-scan v0.5.x crashes TanStack Router's `HeadContent`; component-level re-render diagnostics happen in Storybook only until that incompatibility is resolved upstream. Unexpected highlights are real bugs — typically a side-channel violation (anime.js / PixiJS in render), an unstable atom return, or a nested component definition. Fix the cause; never add manual `useMemo` / `useCallback` / `React.memo` (forbidden — see `react-compiler-rules`). Skip this step for non-UI changes (docs, configs, schemas). There is intentionally **no skill for `react-scan`** — it has no version-specific deprecations or opinionated patterns.

### P3.6 — React-doctor scanner pass (UI-touching changes only)
If P1 modified any `*.tsx` file, after the gate passes, run:

```bash
npx -y react-doctor@latest . --verbose --diff --fail-on error
```

`--fail-on error` blocks on real lint errors; score regressions are informational and surface in the final report (a 0–100 health score). Owned by the `react-doctor` skill — see `.agents/skills/react-doctor/SKILL.md`. Skip for non-UI changes. Deliberately NOT in `bun run check` — it's `npx`-resolved (not pinned), score-based (not pass/fail), and phones home by default — so it lives at the post-gate workflow tier instead. CI runs this advisory via `.github/workflows/react-doctor.yml` on PRs.

### P4 — docs / owning skill
Update `AGENTS.md`, `README.md`, and the `.agents/skills/<name>/SKILL.md` that owns the changed tech (front-matter description, "Defers to", "When to invoke", patterns, anti-patterns, "Triggers on"). Update mermaid diagrams and known-gap entries in README if names changed.

**Append to the `<sweep-tokens>` table below if this change introduces a new "we no longer use X" / "we renamed Y to Z" / "we excluded W" rule.** That makes the change discoverable to all future P5 runs.

### P5 — cross-skill audit (two roles, run in this order)

**P5.0 — Mechanical sweep (orchestrator runs `grep` directly).**
Run `grep -rn -E '<pattern>' .agents/skills/ AGENTS.md README.md` for every entry in `<sweep-tokens>` below — exclude `potential_skills/`, `node_modules`, `.turbo`, `dist/`. Build a flat `file:line:token` list. For each hit, classify as either:
- **Stale** — token outside its allow-context (e.g. `atomFamily` not adjacent to "don't use" wording).
- **Deliberate** — token inside its allow-context (e.g. `@pixi/` inside `pixijs-migration-v8/SKILL.md`).

Mechanical sweep covers *literal substring* drift exhaustively. Do NOT delegate this to agents — they skim and miss occurrences in cross-cutting boilerplate (the `Pillar 4 means: bun run check runs … → tsc --noEmit → …` line, "Defers to" lists, trigger word tables). The grep is bulletproof; the LLM is not.

For per-change runs: sweep only for the token(s) introduced by THIS change. For `--baseline`: sweep the full table.

**P5.1 — Narrative agents (parallel Explore subagents).**
Spawn one agent per topic family (state: jotai+idb; build: vite+nitro+turborepo+biome+stylelint+tailwind+t3-env; types: ts+zod; testing: bun-test+playwright-*+storybook-*; canvas: pixijs-*; framework: tanstack-*+react-*+animejs; runtime: bun*+node). Pass each agent the P5.0 sweep findings for files in its scope so it does NOT duplicate the mechanical pass. Each agent's job is **narrative only**:
- Conceptual drift (e.g. "this skill frames PixiJS as third-party when it's first-party now")
- Self-contradictions (rule on L34 vs example on L164)
- Wrong package names (`@tanstack/start` vs `@tanstack/react-start`)
- Stale ownership claims, dead "Defers to" links, removed APIs in trigger lists
- Patterns inconsistent with the current Pillars

**P5.2 — Aggregate + classify.**
Merge P5.0 stale-list + P5.1 findings, dedupe. For per-change runs: trivial substitutions (renamed token in a list, version bump in a `pinned:` comment) apply immediately and are reported. Narrative or load-bearing findings escalate to a punch list with `file:line` and proposed text — wait for user review. For `--baseline` runs: everything is a punch list, grouped by topic. Do not auto-edit.

</phases>

<sweep-tokens>
The known-stale-token table. Each row: regex pattern, why it's stale, allow-context (if any). Append rows here every time P4 introduces a new "we no longer use X" rule. Order doesn't matter — grep them all.

| Pattern | Why stale | Allow-context |
|---|---|---|
| `tsc --noEmit` | TS 7 / tsgo migration — binary is `tsgo` now | none — always stale |
| `\btsc -p\b` | Same — TS 7 binary | none |
| `jotai-family` | Package removed — replaced by module-scope `Map<id, atom>` + `selectAtom` | OK adjacent to "don't use" / "not used" / "excluded" wording; OK in `jotai/SKILL.md` anti-patterns; OK in `README.md` known-gap historical context |
| `\batomFamily\b` | Same as `jotai-family` | Same as above; also OK in `_OWNERSHIP_MATRIX.md` jotai inventory IF qualified with "intentionally excluded" |
| `@pixi/` | Deprecated v7 sub-packages — single `pixi.js` package only in v8 | OK in `pixijs-migration-v8/SKILL.md` (its job); OK in AGENTS.md "never the deprecated" callout |
| `\.tool-versions` | Cleaned up — `.nvmrc` is the only Node pin | OK in `node/SKILL.md` "we don't use" callout; OK in trigger word tables |
| `\bvolta\b` | Cleaned up — see above | Same as `.tool-versions` |
| `\basdf\b` | Cleaned up — see above | Same as `.tool-versions` |
| `"pipeline"\s*:` | Turbo v1 syntax — Turbo v2 renamed to `"tasks"` | none — always stale in `turbo.json` and skill examples |
| `@tanstack/start[^-]` | Wrong package — actual is `@tanstack/react-start` | none |
| `@storybook/react-webpack` | Wrong builder — `@storybook/react-vite` is pinned | OK in deliberate "don't use" callouts |
| `\bvitest\b` | Wrong unit-test runner — `bun:test` is pinned | OK in deliberate "don't use" callouts |
| `\bjest\b` | Same as `vitest` | Same |
| `Provider initialValues` | Removed in Jotai 2.0 | OK in deliberate "don't use" callouts |
| `\bloadable\b` *(from `jotai/utils`)* | Deprecated since Jotai 2.17 — use `unwrap` | OK in deliberate "don't use" callouts |
| `from ['"]lodash` | Forbidden by `micro-utilities` — use native ECMAScript or `just-*` | OK in `micro-utilities/SKILL.md` "don't import" callouts, in `_OWNERSHIP_MATRIX.md` row description, or in AGENTS.md guidance |
| `JSON\.parse\(JSON\.stringify` | Forbidden by `micro-utilities` — use `structuredClone` (handles `Date`/`Map`/`Set`/`RegExp`/cycles, won't break IDB records) | OK in `micro-utilities/SKILL.md` anti-pattern callout |
| `biome\s+check[^"]*--watch` | Biome 2.x ships **no** native CLI watcher — `--watch` is not a flag on `biome check`. mind-palace wraps Biome in `chokidar-cli` for `biome:watch`. | OK in `biome/SKILL.md` "ships no native CLI watcher" explanation; OK in this command's docs/history |
| `stylelint\s+[^"]*--watch` | Stylelint 16 dropped the native `--watch` flag. mind-palace wraps Stylelint in `chokidar-cli` for `stylelint:watch`. | OK in `stylelint/SKILL.md` "dropped the native --watch flag" explanation; OK in this command's docs/history |
| `"with":\s*\["dev"\]` | Inverted `with` direction — Turbo's `with` is directional from the task you invoke. Putting `with: ["dev"]` on a watcher means the watcher only co-runs `dev` if you invoke the watcher directly, which is backwards for `bun run dev`. The correct shape is `with: ["storybook", "biome:watch", "stylelint:watch"]` on the `dev` task. | OK in `turborepo/SKILL.md` "would only co-run dev when you explicitly invoke a watcher" anti-pattern explanation |
| `utils\.set\s*\(\s*engine` | Misuse of animejs's animation API as an engine-config setter. `utils.set` pipes values through animejs's value parser (`decomposeRawValue`), which throws `str.includes is not a function` on a non-string `defaults` object. The documented v4 path is direct property assignment: `engine.defaults.duration = 400; engine.defaults.ease = "out(2)"`. | OK in `animejs/SKILL.md` anti-pattern callout; OK in this command's docs/history |
| `import\s*\{[^}]*\bdefaults\b[^}]*\}\s*from\s*['"]animejs['"]` | `defaults` is **not** a top-level animejs export — only `engine` is, and `defaults` is a property on the `engine` instance. Use `engine.defaults.<key> = value` instead. | OK in `animejs/SKILL.md` "not a separate named export" callout |
| `GITHUB_PAGES\s*===?\s*["']true["']` | Deploy workflow no longer uses a `GITHUB_PAGES=true` toggle. Base path is now driven by the `BASE_PATH` env var (sourced from `actions/configure-pages@v5`'s `base_path` output). | OK in `nitro/SKILL.md` migration callout; OK in `README.md` "we used to" historical context |
| `isProjectPages` | Old vite.config helper — deleted with the `BASE_PATH` migration. Use the `resolveBase()` helper that reads `process.env.BASE_PATH`. | none — always stale |
| `base:\s*["']/(mind-palace\|test-project\|web)/?["']` | Hardcoded base path — deploy must derive `BASE_PATH` from `actions/configure-pages@v5` so the workflow is portable across forks, renames, and custom domains. | OK in `nitro/SKILL.md` example output ("emits `/mind-palace/...` when `BASE_PATH=/mind-palace`"); OK in CI fixtures |
| `nitro\.config\.ts` | mind-palace does not ship a standalone `nitro.config.ts`. TanStack Start drives Nitro internally via `tanstackStart({ spa, prerender })`. | OK in `nitro/SKILL.md` "there is no nitro.config.ts" callout; OK in `tanstack-start-spa-prerender/SKILL.md` "no" callout |
| `\.output/public` | mind-palace's static artifact lives at `apps/<app>/dist/client/`, not `.output/public/`. The latter is upstream Nitro's default; TanStack Start SPA mode overrides it. | OK in `nitro/SKILL.md` anti-pattern callout |
| `upload-pages-artifact@v[12]` | Stale GH Pages action revs — must be `@v3`. | OK in `nitro/SKILL.md` anti-pattern callout |
| `deploy-pages@v[123]` | Stale GH Pages action revs — must be `@v4`. | OK in `nitro/SKILL.md` anti-pattern callout |
| `diff:\s*main` *(in `react-doctor.yml`)* | Hardcoded base branch in workflow inputs — use `${{ github.base_ref }}` so the diff matches the PR's actual target branch and survives default-branch renames or fork repos with a different default. | none — always stale |
| `branches:\s*\[\s*master\s*\]` | mind-palace's default branch is **`main`** (renamed from `master`). New workflows should target `[main]`. | OK in `nitro/SKILL.md` migration callout; OK in deliberate "we used to" historical context |
| `(?s)playwright test.*?(?<!playwright install[^\n]{0,120})\Zubuntu-latest` *(conceptual: a CI job that runs Playwright without `bunx playwright install`)* | Playwright's browser binary is NOT bundled with the npm package. A CI job that calls `bun run check` or any `playwright test` invocation MUST first run `bunx playwright install --with-deps chromium` (the `--with-deps` is needed on `ubuntu-latest` for headless Chromium's apt deps). Without it the runner errors with `browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/...`. | OK in `playwright/SKILL.md` "CI install" pattern; OK in this command's docs |
| `apps/test-project` *(in `git ls-files` — i.e. tracked by git)* | `apps/test-project/` is a generator-validation artifact regenerated by five-phase-pass skill; it MUST be gitignored. Committing it makes CI run a duplicate Playwright suite that races for the same Storybook port (6006) as `apps/web`, tearing Storybook down with `script "storybook" exited with code 1` on the second invocation. The template at `turbo/generators/templates/app/` is the source of truth. | none — tracking it is always a regression. Verify with `git ls-files apps/test-project \| head -1` (must be empty) |
| *(workflow shape regression)* `check\.yml` containing `push:` AND `deploy\.yml` containing `push:.*main` simultaneously | Two workflows triggering on push to main produces side-by-side CI runs with no gate-before-deploy ordering, violating Pillar 4 (CLI-gate-first). Canonical shape: `check.yml` = `pull_request:` only; `deploy.yml` = `push: branches:[main]` + `workflow_dispatch`, with `bun run check` as the FIRST step of its `build` job (before the prod `vite build` and the `upload-pages-artifact`). | OK in `nitro/SKILL.md` example YAML showing the gate-first deploy job |
| `storybook dev -p 6006` *(in `turbo/generators/templates/app/package.json`)* | Generated apps must use a non-canonical Storybook port (`6010` is mind-palace's chosen offset) so they can run their Playwright suite alongside `apps/web` (which owns port 6006) without resource-saturating chromium contention or `script "storybook" exited with code 1`. Canonical: `apps/web` → 6006/3000; template → 6010/3010. | OK in template comments referencing "apps/web (6006/3000)" as historical context; OK in `apps/web/package.json` |
| `turbo run check"` *(in root `package.json`'s `check` script — i.e. unfiltered)* | The workspace gate must filter `test:e2e` to `@mind-palace/web` only, otherwise both apps' Playwright invocations spawn `4 workers × 2` chromium instances simultaneously and exhaust local/CI memory. Canonical shape: `turbo run typecheck test:unit && turbo run test:e2e --filter=@mind-palace/web`. test-project's `test:e2e` exists for standalone use; the gate skips it. | none — always a regression once test-project ships an `e2e` task |
| `\}, use\) =>` *(Playwright fixture callback parameter named `use`)* | `use` is a React 19 hook identifier; react-doctor 0.1.3+ added a `react-hooks/rules-of-hooks` rule that fires on the literal name regardless of context (Playwright, util fn, etc). The fix is to rename the parameter to `runFixture`. Playwright accepts any identifier — the position is what matters, not the name. | OK inside `playwright/SKILL.md` or `playwright-conventions/SKILL.md` "do NOT use `use`" anti-pattern callouts; OK in AGENTS.md disable-comment refactor table |
| `useState\(\s*[a-z][A-Za-z]*\.glyph\b\|useState\(\s*[a-z][A-Za-z]*\.level\b\|useState\(\s*props\.` *(useState initialized from a prop value — `no-derived-useState`)* | When state needs to lag behind a prop (animation timing, capture-on-mount), the canonical refactor is `useReducer`, not `useState(propValue)`. The reducer's initial state argument is opaque to react-doctor's rule. See `react-compiler-rules/SKILL.md` "Cascading setState → useReducer state machine" pattern. | OK in `react-compiler-rules/SKILL.md` anti-pattern callouts; OK in AGENTS.md disable-comment refactor table |
| `useEffect\([^;]*\}, \[[a-zA-Z_]+\?\.id\]\)` *(effect with a single `[xx?.id]` trigger-only dep — pilot-change reset, enemy-change reset, etc)* | When an effect ONLY runs to reset state on prop change, biome's `useExhaustiveDependencies` flags the dep as "more dependencies than necessary" because the body doesn't read it. The fix is to lift the reset to the parent via `<Foo key={x?.id} />`; React remounts on key change and useState/useRef defaults re-initialize. See `react-compiler-rules/SKILL.md` "Trigger-only useEffect deps → key-prop remount" pattern. | OK in `react-compiler-rules/SKILL.md` anti-pattern callouts; OK in AGENTS.md disable-comment refactor table |
| `eslint-disable-next-line react-doctor/no-array-index-as-key` *(except inline on a `key=` JSX attribute with a same-line `--` reason)* | The canonical fix is a content-derived stable id (e.g. `id: \`c-${i}\`` generated at construction time, or a constant tuple like `TEN_FRAME_CELL_IDS`). Disable comments here are a smell — every site we kept one had a follow-up cleanup task. New code MUST generate ids at construction. | OK in `react-compiler-rules/SKILL.md` "use stable ids" anti-pattern; OK in AGENTS.md disable-comment refactor table |
| `\.map\([^)]+\)\.filter\(` *(`.map().filter()` chain — `js-combine-iterations`)* | Two passes when one suffices. Canonical fix is `.flatMap((x) => keep(x) ? [transform(x)] : [])` — single iteration, equivalent semantics. Test files are not exempt; the pattern is just as readable as flatMap. | OK in `react-compiler-rules/SKILL.md` "single-pass" anti-pattern; OK in `bun-test/SKILL.md` clarity callouts |
| `fallow-ignore-next-line\s+circular-dependency` *(suppression of the circular-deps rule)* | A circular import is a real bug surface (initialization-order issues, harder reasoning). Suppressing it doesn't fix it. The canonical refactor is to extract the shared symbol(s) into a leaf module and have BOTH original modules depend on the leaf — see AGENTS.md "No circular imports" rule and `attack-fx/textures.ts` for the worked example. | OK in `fallow/SKILL.md` "anti-pattern" callouts; OK in this command's docs |
| `fallow\s+(?!dead-code\|--diff\|--changed)` *(running full `fallow` in a gate, not the scoped `dead-code` subcommand)* | The default `fallow` invocation also runs `dupes` + `health`, both of which are advisory in mind-palace (complexity hotspots are intrinsic to the game's switch-heavy domain logic). The CI/local gate must call `fallow dead-code --fail-on-issues` so only the structural checks block; the advisory `health` report is captured as a workflow artifact, not a gate signal. | OK in `fallow/SKILL.md` "Common Workflows" examples that run the full scan exploratorily; OK in this command's docs |
| `sonar[- ]?scanner\|sonarqube[- ]?scanner\|@sonar/scan\|sonar\.host\.url\|sonar\.token` | mind-palace uses `eslint-plugin-sonarjs` ONLY (local rule pack). It explicitly does NOT run SonarQube/SonarCloud — there's no server, no `sonar-scanner` CLI, no project token. Recommending these in skill examples or CI fixtures imports a service the stack doesn't have. | OK in `eslint-plugin-sonarjs/SKILL.md` "no-server" callouts and anti-pattern table |
| `eslint-plugin-sonarjs` *(in skills/AGENTS outside the sonar skill or sonar-related callouts)* | This is the only eslint plugin mind-palace ships. If a skill mentions it outside the `eslint-plugin-sonarjs` skill or a sonar-specific gate callout, that skill is probably claiming ownership it doesn't have or recommending a non-canonical wiring. | OK in `eslint-plugin-sonarjs/SKILL.md`; OK in AGENTS.md gate-chain description; OK in `_OWNERSHIP_MATRIX.md` row |
| `@eslint/js\|eslint-config-prettier\|@typescript-eslint/recommended\|eslint-plugin-react\b\|eslint-plugin-import\b\|eslint-plugin-jsx-a11y\b` *(in mind-palace's `eslint.sonar.config.mjs` or any deps that imply a parallel ESLint stack)* | The sonar config loads ONLY `sonarjs.configs.recommended`. Adding any other ESLint plugin or recommended preset re-introduces dual-linter drift with Biome — the failure mode the narrow-scope policy exists to prevent. React-specific signal goes through `react-doctor`, not eslint-plugin-react. | OK in `eslint-plugin-sonarjs/SKILL.md` "no Biome overlap" anti-pattern table; OK in AGENTS.md disable-comment refactor table if discussed |
| `// eslint-disable-next-line sonarjs/(no-nested-conditional\|no-nested-functions\|cognitive-complexity)` *(in app code — not in `tests/**`)* | These three rules have canonical refactors (extracted helper, lookup table, IIFE, dispatch table, hoisted Promise wrapper). Suppressions in app code accumulate; the policy is to refactor instead. The `tests/**` glob is exempt for `no-nested-functions` only — see `eslint-plugin-sonarjs/SKILL.md` calibrated rule policy. | OK in `eslint-plugin-sonarjs/SKILL.md` anti-pattern table and refactor recipe; OK in AGENTS.md disable-comment refactor table |
| `eslint --watch\|eslint-watch` | ESLint 10 ships no native CLI watcher. mind-palace does not run ESLint in `bun run dev` — sonarjs is gate-only (per the `check:sonar` task). If a skill recommends an ESLint watcher, it is either suggesting a deprecated tool or mis-framing sonar as a watch-loop concern. | OK in `eslint-plugin-sonarjs/SKILL.md` "gate-only" callout if the question comes up |

</sweep-tokens>

<subagents>
For P5.1 only. Spawn parallel Explore subagents — one per topic family. Pass each agent (a) its scoped skill file paths, (b) the ground-truth current stack (read from AGENTS.md), (c) the P5.0 sweep findings for files in its scope. Tell each agent **explicitly NOT to redo the mechanical token search** — that's already done — and to focus on narrative drift, contradictions, wrong package names, and stale conceptual framings.

Do not spawn subagents for P1/P2/P4 single-file edits or P3 single gate run.
</subagents>

<acceptance_criteria>
- P3: `bun run check` green.
- P4: zero canonical references to the old name in AGENTS.md / README.md / the owning skill, except deliberate "we don't use X" callouts. If P4 introduced a new "we no longer use X" rule, the `<sweep-tokens>` table above gained a row.
- P5.0: mechanical sweep complete; every hit classified Stale or Deliberate.
- P5.1: every `.agents/skills/**/SKILL.md` examined by a topical agent for narrative drift.
- P5.2: per-finding punch list with `file:line` + proposed fix; trivial fixes already applied (per-change runs only).
- Final report: phase-by-phase status, gate result, sweep summary (N tokens scanned, M stale hits found), narrative-finding count, list of fixes applied, list of fixes deferred for review.
</acceptance_criteria>

<verification>
- After P3 (and again after any P5 code-block edits): `bun run check`.
- After P5: re-run the P5.0 sweep — surviving Stale hits must be zero. Surviving Deliberate hits must each match an allow-context in the table.
- Sanity grep for the SPECIFIC old name introduced by THIS change (per-change runs):
  `grep -rn "<old-name>" --include='*.md' --include='*.ts' --include='*.tsx' --include='*.json' .` — surviving hits must be deliberate or in `potential_skills/`.
</verification>

<output>
File edits scoped per phase as listed above. Final summary printed to the conversation, not to a file (per mind-palace: don't create planning docs unless asked).
</output>

<maintenance>
This command's `<sweep-tokens>` table is the durable artifact of every prior P4. When a future change retires a package, renames a binary, replaces an idiom, or excludes an API, append a row in P4 — that's the "make this discoverable to all future P5 runs" step. The table is append-only; never remove rows even after the codebase has long since stopped containing the old token, because the trigger words live on in skill docs and matrix entries.
</maintenance>
