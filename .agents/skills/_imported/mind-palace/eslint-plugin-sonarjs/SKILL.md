---
name: eslint-plugin-sonarjs
description: "Local-only second-opinion lint pass via `eslint-plugin-sonarjs` — code-smell, cognitive-complexity, and bug-pattern rules layered on top of Biome (which owns formatting + the bulk of lint). NO SonarQube server, NO `sonar-scanner`, NO project token. Runs as `bun run check:sonar` (the workspace task) and as the standalone `.github/workflows/sonarjs.yml` workflow. Triggers on: sonar, sonarjs, eslint-plugin-sonarjs, cognitive-complexity, pseudo-random, no-nested-conditional, no-nested-functions, void-use, second-opinion lint, eslint.sonar.config.mjs."
license: MIT
---

Owns the second-opinion code-smell scan. Layered on top of Biome (which owns formatting + the bulk of lint) and Stylelint (which owns CSS). Sonarjs's job is the narrow set of patterns Biome doesn't cover: cognitive complexity, dead-branch detection, redundant-assignment, nested-conditional/function depth, and a small set of bug patterns.

**This is a local lint pass. No SonarQube server, no `sonar-scanner` CLI, no `host.url` / project token.** The full Sonar product would require a self-hosted SonarQube instance or SonarCloud account; mind-palace deliberately stops at the eslint-plugin layer because the GitHub Pages stack has no backend and the gate is local-first.

## When to invoke
- Authoring or editing `apps/<name>/eslint.sonar.config.mjs`.
- Diagnosing a `bun run check:sonar` (or `.github/workflows/sonarjs.yml`) failure.
- Deciding whether a sonarjs finding is a real bug, an intrinsic domain pattern, or a candidate for rule-policy adjustment.
- Adding a new sonarjs rule disable or a new rule override (must include rationale).
- Triaging a freshly-discovered category of finding (the user wants to add sonarjs to a new app, or upgrade the plugin and re-baseline).

## Owns
- The `eslint-plugin-sonarjs` flat config file at `apps/<name>/eslint.sonar.config.mjs`.
- The calibrated rule policy: which rules are off, which thresholds are raised, which are scoped to specific file globs, and the **rationale comment** for every deviation from the recommended preset.
- The `check:sonar` workspace script and its `--max-warnings 0` exit contract.
- The `.github/workflows/sonarjs.yml` workflow shape (PR-only, `head_ref` pinned, `bun --filter=@mind-palace/web run check:sonar`).
- The refactor patterns for the rules that fire most often in this codebase (table below).

## Defers to
- `biome` — for formatter + the bulk of lint (`.ts`/`.tsx`/`.js`/`.json`). Sonarjs MUST NOT overlap with Biome — that's why the config loads ONLY `sonarjs.configs.recommended`, no `@eslint/js` recommended rules.
- `stylelint` — for everything `.css`. Sonarjs is JS/TS only.
- `react-doctor` — for React-specific patterns (heading weight, `useState(prop)`, barrel imports, etc.). Sonarjs and react-doctor have separate ownership; both run in the gate.
- `fallow` — for cross-cutting structural checks (unused files/exports/types/deps, circular dependencies, boundary violations). Sonarjs is rule-based per-file; fallow is graph-based.
- `turborepo` — for *when* `check:sonar` runs in the gate sequence (it's a per-app turbo task; the root `check` / `check:fast` scripts depend on it).

## Dean-stack rules

- **Pillar 4 (CLI-gate-first) means**: `eslint --config eslint.sonar.config.mjs --max-warnings 0` exits non-zero on any finding, and any warning is a failure (zero-warning policy). Local pre-push gate (`bun run check:fast`) and CI both run it. The IDE is not the source of truth — the CLI is.
- **NO server side.** Never reach for `sonar-scanner-cli`, `sonarqube-scanner`, or `@sonar/scan`; they all require a SonarQube/SonarCloud server. The local eslint-plugin gives ~95% of the rule signal with 0% of the infra.
- **NO Biome overlap.** The flat config loads ONLY `sonarjs.configs.recommended`. Do NOT add `@eslint/js` recommended, `typescript-eslint`'s recommended sets, or any other eslint plugin. Dual-linter drift with Biome is the failure mode you're trying to avoid; keeping the surface narrow is the protection.
- **Every rule deviation from `sonarjs.configs.recommended` MUST carry a rationale comment** in `eslint.sonar.config.mjs`. The current deviations and their reasons live there — read them before adding a new one.
- **Disable comments are a code smell** (per AGENTS.md). If you find yourself reaching for `// eslint-disable-next-line sonarjs/<rule>`, refactor instead — the patterns table below is the menu of canonical fixes.

## Calibrated rule policy (for mind-palace's domain)

These deviations from `sonarjs.configs.recommended` are deliberate and live in `apps/web/eslint.sonar.config.mjs` with rationale comments. Read those before changing the policy.

| Rule | Setting | Why this codebase deviates |
|---|---|---|
| `sonarjs/pseudo-random` | `off` (global) | Math.random drives card shuffles, particle jitter, attack-fx variation, audio detune. Nothing security-sensitive. Swapping to `crypto.getRandomValues` would add ceremony without buying anything. |
| `sonarjs/void-use` | `off` (global) | Fire-and-forget Promises in `sound/use-sound.ts` (audio unlock listeners), `sound/player.ts` (one-shot SFX dispatch), `state/db.ts` (BroadcastChannel + IDB persistence callbacks), and `attack-fx/kinds/vortex.ts` are intentional. `void doThing()` documents that the caller doesn't await; `.catch(() => undefined)` is noisier and just as untyped. |
| `sonarjs/cognitive-complexity` | `["error", 50]` | Game state machines (`auto-assist.applyAutoAssist`, `hints.generateHints`, `deal.dealRound`, `AddingGame` route component, drag pointer handlers, `dive-in/round-complete` ticker callbacks) are intrinsically branchy on comparator/operator/shape. The default `15` flagged 11 sites all in this category. Mechanically splitting them produces helper soup that's harder to read; `50` still flags egregious cases. |
| `sonarjs/no-nested-functions` | `off` for `tests/**/*.ts` | Playwright IDB seeding uses promise-wrapped `indexedDB.open` + transaction-completion callbacks (`addInitScript(async () => { ... openDb().then(...) })`). The depth limit can't accommodate IDB's required callback shape; flattening would mean inventing a Promise-returning IDB helper just for tests. App code keeps the rule. |

## Refactor patterns — apply these instead of disabling

When sonarjs fires on app code, prefer the canonical refactor over a disable comment. Each pattern below has a worked example committed to the repo.

| Rule | Refactor | Worked example |
|---|---|---|
| `sonarjs/no-nested-conditional` | Extract a single-purpose helper (`comparisonGlyph`, `dotClass`, `firstLocked`); use a lookup table (`COMPARATOR_VERB: Record<Comparator, string>`); split a nested `?:` chain into independent `&&` blocks; wrap a multi-branch expression in an IIFE that returns the value. | `apps/web/app/components/hint-tooltip/index.tsx` (`comparisonGlyph`); `apps/web/app/games/adding-game/auto-assist.ts` (`firstLocked`); `apps/web/app/games/adding-game/hints.ts` (`COMPARATOR_VERB`); `apps/web/app/routes/adding-game.tsx` (independent `&&` blocks). |
| `sonarjs/no-redundant-assignments` | Restructure the `if`/`else` ladder so the initial value of the variable IS the fallback (drop the redundant `else var = initial;`). | `apps/web/app/components/round-complete-fx/index.tsx` (`alpha = 0` initial, then `if (t >= 400 && t < 1600) alpha = ...`). |
| `sonarjs/no-unused-vars` (e.g. unused destructured key) | Switch to the iterator that doesn't expose the unused half — `Object.values()` instead of `for (const [_id, entry] of Object.entries())`. | `apps/web/app/sound/registry.test.ts`. |
| `sonarjs/concise-regex` | Use the canonical character-class shortcut (`\w` for `[a-zA-Z0-9_]`, `\d` for `[0-9]`, `\s` for whitespace). | `apps/web/app/env.ts` (Twitter handle regex). |
| `sonarjs/no-nested-functions` (in app code) | Hoist the inner function declaration out of the closure; if it needs closure state, use a Promise-returning helper at module scope and call it. (Tests/ are exempt — see policy table.) | `apps/web/tests/adding-game-poster-progression.app.spec.ts` (`openDb` + `awaitTx` Promise wrappers). |
| `sonarjs/cognitive-complexity` (above the 50 threshold, when raised) | Extract sub-state-machines as their own `useReducer`s, extract pure helpers to module scope, replace big switches with `Record<Kind, Runner>` dispatch tables. (Same pattern fallow's circular-deps fix for `attack-fx/runtime.ts` used.) | `apps/web/app/games/adding-game/attack-fx/runtime.ts` (`KIND_RUNNERS` dispatch table replacing a 10-case switch). |

## Anti-patterns

- **Adding `eslint-plugin-react`, `eslint-plugin-import`, `@typescript-eslint/recommended`, or `@eslint/js` to `eslint.sonar.config.mjs`.** Sonar config is sonar-only; adding more plugins re-introduces dual-linter drift with Biome. If you want React-specific signal, that's `react-doctor`'s job.
- **`sonar-scanner`, `sonarqube-scanner`, `@sonar/scan`, `host.url`, `sonar.token`.** All require a SonarQube/SonarCloud server. mind-palace is server-less.
- **Disabling a rule globally without a rationale comment.** Future-you (or a future agent) will not know whether the disable is load-bearing. Always inline the WHY.
- **Inline `// eslint-disable-next-line sonarjs/<rule>` for `no-nested-conditional`, `no-nested-functions`, or `cognitive-complexity` in app code.** These have canonical refactors (see the table). Suppressions in app code accumulate; one-off becomes pattern.
- **Adding sonarjs as a separate `"check:sonar"` step at the root `package.json` level instead of as a per-app turbo task.** It's a per-workspace lint; let turborepo orchestrate it via the `check:sonar` task in `turbo.json` so cache + filter + future workspace fan-out work.
- **Pinning the `.github/workflows/sonarjs.yml` checkout to the merge SHA (the default).** Use `ref: ${{ github.head_ref }}` so the scan reflects the PR branch's actual state, not a synthetic merge with main. Same pattern as `react-doctor.yml` and `fallow.yml`.

## Setup recipe (new app)

1. Add devDeps to `apps/<name>/package.json`:
   ```json
   "eslint": "^10.3.0",
   "eslint-plugin-sonarjs": "^4.0.3",
   "typescript-eslint": "^8.59.2"
   ```
2. Copy `apps/web/eslint.sonar.config.mjs` (or scaffold from `turbo/generators/templates/app/eslint.sonar.config.mjs`).
3. Add the `check:sonar` script to `apps/<name>/package.json`:
   ```json
   "check:sonar": "eslint --config eslint.sonar.config.mjs --no-warn-ignored --max-warnings 0 \"app/**/*.{ts,tsx}\" \"tests/**/*.ts\" \"scripts/**/*.ts\""
   ```
4. Add the task to `turbo.json` (already done — task name is `check:sonar`, no `dependsOn`):
   ```json
   "check:sonar": { "outputs": [] }
   ```
5. The root `check` and `check:fast` scripts already include `check:sonar` in their turbo `dependsOn`. New apps automatically get gated.
6. Run `bun --filter=@mind-palace/<name> run check:sonar` once and triage findings: real bugs first, then refactor patterns from the table above, then policy adjustments (with rationale comments) for irreducible cases.

## Plugin pin

`eslint-plugin-sonarjs` `^4.0.3` (LGPL-3.0). The plugin is bundled with the recommended preset; no peer-plugin dance required. The `eslint` and `typescript-eslint` peers must be installed at the consuming workspace's `package.json` (workspace hoisting won't satisfy ESLint's plugin-resolution path).
