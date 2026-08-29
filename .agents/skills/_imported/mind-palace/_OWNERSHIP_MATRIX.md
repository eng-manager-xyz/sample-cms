# Ownership Matrix — mind-palace skill system

Authoritative contract for the mind-palace skill collection. Every later prompt that builds a `SKILL.md` must read and obey this file. AGENTS.md owns the Four Pillars and stack pins; skills do not restate Pillar text — they reference Pillars by name only.

The techs in `potential_skills/` map onto a mix of **narrow** skills (one `SKILL.md` covers the whole tech) and **broad** skills (a `<tech>` router skill plus several `<tech>-<topic>` sub-skills, mirroring the pixijs collection pattern). Final inventory is **37 skills** (36 tech-bound + 1 cross-cutting authoring policy: `micro-utilities`).

---

## Section 1 — Skill inventory

| name | type | parent | owned surface (one sentence) | primary trigger keywords |
|---|---|---|---|---|
| zod | narrow | — | Zod 4 schema authoring, `z.infer`, `z.object`, error formatting, codecs/transforms, JSON schema export, and the `defineComponent(schema, fn)` dev-only parse helper. | zod, z.object, z.infer, schema, parse, safeParse, zod 4, transform, refine, ZodError |
| idb | narrow | — | The `idb` library wrapper around IndexedDB: `openDB`, object stores, indexes, transactions, schema-versioned `upgrade` migrations, the `atomWithIDB` storage adapter, and the root hydration promise consumed by `use()`. | idb, IndexedDB, openDB, object store, IDBPDatabase, idb migration, upgrade callback, atomWithIDB storage, idb hydration, BroadcastChannel sync, idb migration test |
| t3-env | narrow | — | `@t3-oss/env-core` setup with `client` + (empty) `server` slots, `VITE_*` validation at build time, the typed `env` import, and the GH-Pages-only constraint. | t3 env, t3-env, env-core, createEnv, VITE_, env validation, env.ts, runtimeEnv, clientPrefix |
| jotai | narrow | — | Jotai atom authoring, hooks (`useAtom`, `useAtomValue`, `useSetAtom`), derived atoms, atom families, store/Provider, and the `atomWithIDB` factory that mirrors writes to IDB and listens on a BroadcastChannel. | jotai, atom, useAtom, useAtomValue, useSetAtom, atomWithIDB, atom family, jotai store, jotai Provider, derived atom |
| biome | narrow | — | Biome 2.x config, formatter + linter for `.ts`/`.tsx`/`.js`/`.json`, `biome ci` gate behavior, watch-mode integration with `bun run dev`, and the rule that Biome **does not** touch CSS. | biome, biome.json, biome ci, biome lint, biome format, biome watch, biome rule |
| stylelint | narrow | — | Stylelint config with the Tailwind plugin for `.css`, `--max-warnings 0`, CLI watcher (the source of truth, not the IDE), and the rule that Stylelint owns CSS exclusively. | stylelint, stylelintrc, stylelint tailwind, stylelint css, stylelint watch, stylelint plugin, max-warnings |
| animejs | narrow | — | anime.js v4 named-import API (`createTimeline`, `createAnimatable`, `createDraggable`, `createScope`, `stagger`, `utils`), the `useAnime(ref, params, deps)` hook, and `prefers-reduced-motion` short-circuiting. | anime.js, animejs, anime v4, createTimeline, createAnimatable, createScope, createDraggable, useAnime, prefers-reduced-motion, anime utils |
| turborepo | narrow | — | `turbo.json` task graph, `dependsOn`, cache keys, workspace topology for `apps/web` + `packages/*`, and orchestration of every `bun run` script. | turbo, turborepo, turbo.json, turbo task, turbo cache, dependsOn, turbo pipeline, workspace orchestration |
| symphony | narrow | — | OpenAI Symphony reference-runner integration: ignored local install under `tmp/symphony`, workflow/spec package `@mind-palace/symphony-first-five`, Linear env wiring, generated-app-safe `bun run symphony` / `bun run dev:symphony`, and `.symphony/` runtime artifacts. | symphony, OpenAI Symphony, Linear orchestrator, dev:symphony, WORKFLOW.md, first-five backlog |
| nitro | narrow | — | Nitro v3 driven internally by TanStack Start (no standalone `nitro.config.ts`); owns the GH Pages `BASE_PATH` env contract sourced from `actions/configure-pages@v5`, the post-build `cp index.html → 404.html` and `.nojekyll`, the deploy workflow's app selector, and the `dist/client/` upload path. | nitro, github_pages, BASE_PATH, baseURL, prerender, SPA fallback 404, .nojekyll, GH Pages deploy |
| node | narrow | — | Node 25 install via `.nvmrc` only (the single source of truth — no `.tool-versions`, no `volta` block in package.json), and the rule that Node is **only** for tooling — never a runtime target. Routes questions about asdf/Volta to the "we don't use these" callout. | node 25, node version, .nvmrc, .tool-versions, volta, asdf, node tooling, node toolchain |
| ts | narrow | — | TypeScript 7 strict config, `tsconfig` bases in `packages/tsconfig`, `tsgo --noEmit` gate behavior, and the "no hand-written type when a Zod schema exists" rule. | typescript 7, ts strict, tsconfig, tsgo --noEmit, ts compiler, isolatedDeclarations, ts project references |
| tailwind | narrow | — | Tailwind v4 install via Vite plugin, `@theme` design tokens, `@import "tailwindcss"`, and the single shared Vite config consumed by the app and Storybook. | tailwind, tailwind v4, tailwindcss, @theme, @import "tailwindcss", tailwind vite plugin, design tokens |
| micro-utilities | narrow | — | Cross-cutting authoring policy: native ECMAScript first (`structuredClone`, `Object.groupBy`, `toSorted`, `replaceAll`, `Intl.NumberFormat`), then `Bun.*` (tooling-only), then a typed inline helper, then `just-*` micro-packages, then `memoize-one` (module scope only). Forbids `lodash` / `moment` / `JSON.parse(JSON.stringify(...))`. | structuredClone, deep clone, deep merge, deep equality, group by, partition, pick omit, debounce, throttle, memoize-one, just-extend, micro utilities, lodash alternative |
| bun | router | — | Entry point that routes Bun questions to the right sub-skill (runtime, test runner, package manager) and pins Bun 1.3.13 via `packageManager`. | bun, bun 1.3.13, packageManager, which bun, bun overview |
| bun-runtime | sub | bun | Bun runtime APIs (`Bun.serve`, `Bun.file`, `Bun.$`, FFI), runtime flags, and the rule that browser code is bundled by Vite — Bun is the script/tooling runtime. | bun runtime, Bun.serve, Bun.file, Bun.$, bun shell, bunx, bun script |
| bun-test | sub | bun | `bun test` unit-test runner: matchers, mocks, snapshot, watch mode, coverage, and the partition rule "no DOM = bun test, DOM = playwright". | bun test, bun:test, bun matcher, bun mock, bun snapshot, bun coverage, bun watch test, unit test |
| bun-package-manager | sub | bun | `bun install`, `bun add`, lockfile (`bun.lockb`), workspace resolution, `packageManager` pin, and overrides/resolutions. | bun install, bun add, bun remove, bun.lockb, bun workspace, bun overrides, bun lockfile |
| react | router | — | Entry point that routes React questions to the Compiler-rules sub-skill or the React-19-primitives sub-skill, and pins React 19. | react, react 19, react overview, which react skill |
| react-compiler-rules | sub | react | React Compiler purity rules: no `useMemo`/`useCallback`/`React.memo`, the side-channel rule for anime.js, and how to keep render functions pure. | react compiler, useMemo, useCallback, React.memo, manual memoization, render purity, side channel, compiler audit |
| react-19-primitives | sub | react | React 19 primitives encouraged by the stack: `use(promise)`, `useTransition`, `useDeferredValue`, `useOptimistic`, `useActionState`, `useFormStatus`, and `<Suspense>` boundaries. | use(promise), useTransition, useDeferredValue, useOptimistic, useActionState, useFormStatus, Suspense, react 19 hook |
| tanstack | router | — | Entry point that routes TanStack questions to the SPA-prerender sub-skill, the routing sub-skill, or the PWA-deep-links sub-skill. | tanstack, tanstack start, tanstack router overview, which tanstack skill |
| tanstack-start-spa-prerender | sub | tanstack | TanStack Start in **SPA mode with full prerender**, integration with Nitro's `github_pages` preset, no server functions, no server loaders, prerender-the-shell strategy. | tanstack start spa, tanstack prerender, ssr false, spa mode, prerender route, server functions disabled, server loaders disabled |
| tanstack-router-routing | sub | tanstack | File-based routing in `app/routes/`, route trees, route params, search params, link/navigate APIs, and Zod-validated route params (deferring to the zod skill for schema authoring). | tanstack router, file-based routing, createRoute, route param, search params, useNavigate, Link, route tree |
| tanstack-router-pwa-deep-links | sub | tanstack | TanStack Router's interaction with the Workbox NavigationRoute: navigation fallback points at the prerendered shell, deep-link offline resolution from cache, no server round-trip. | spa fallback, navigation fallback, deep link offline, NavigationRoute, router pwa, offline route resolution |
| tanstack-router-preload | sub | tanstack | TanStack Router's `defaultPreload: "intent"` policy: modulepreload of route JS chunks + loader execution on `touchstart`/hover, additive to (and distinct from) the Workbox SW precache. | defaultPreload, modulepreload, intent preload, viewport preload, link preload, tanstack router preload, route preload |
| tanstack-devtools | sub | tanstack | TanStack DevTools dev-only, opt-in host (`@tanstack/react-devtools`) + Router plugin (`@tanstack/react-router-devtools`) + Vite plugin (`@tanstack/devtools-vite`) for browser-element → editor source linking. Lazy + `import.meta.env.DEV` + `VITE_ENABLE_TANSTACK_DEVTOOLS=true` gates keep default dev loads production-like and the production bundle free of devtool symbols. | TanStackDevtools, TanStackRouterDevtoolsPanel, devtools-vite, tanstack devtools, click to source, browser to editor, router devtools, dev panel |
| storybook | router | — | Entry point that routes Storybook questions to the config sub-skill, the stories-authoring sub-skill, or the play-functions sub-skill; enforces the Storybook-first Pillar at the routing level. | storybook, storybook overview, which storybook skill, storybook-first |
| storybook-config | sub | storybook | Storybook 10 with the Vite builder, **shared Vite + Tailwind + alias config from a single source** (never forked), `main.ts`/`preview.ts`, addons. | storybook config, storybook vite builder, storybook main.ts, storybook preview.ts, shared vite config, storybook addon |
| storybook-stories | sub | storybook | Authoring `*.stories.tsx` co-located with the component, CSF 3 `Meta`/`StoryObj`, args/argTypes, and the rule "no component without a story". | story, stories.tsx, CSF 3, Meta, StoryObj, args, argTypes, story file, co-located story |
| storybook-play-functions | sub | storybook | `play` functions, `@storybook/test` (`userEvent`, `expect`), interaction testing inside the story — the surface Playwright drives. | play function, @storybook/test, userEvent, interaction test, story interaction, play step |
| playwright | router | — | Entry point that routes Playwright questions to the story-tests, app-tests, PWA-offline, or conventions sub-skill; enforces the **ASK-FIRST** rule before writing any Playwright test. | playwright, playwright overview, which playwright skill, ask first playwright |
| playwright-story-tests | sub | playwright | Playwright tests pointed at Storybook URLs that mount a story, exercise its play function, and assert on visible state. | story test, playwright story, storybook url test, story-level test, mount story |
| playwright-app-tests | sub | playwright | Playwright end-to-end tests pointed at the built/preview app: route workflows, IDB-seeded fixtures, BroadcastChannel verification. | playwright app test, e2e workflow, app-level test, route workflow test, idb seeded test, idb assertion |
| playwright-pwa-offline | sub | playwright | The offline-deep-link contract: throttle network to offline, navigate to `/some/deep/route`, assert the router resolves it from cache without a server round-trip. | offline test, pwa offline test, deep link offline test, network offline, service worker test, navigation fallback test |
| playwright-conventions | sub | playwright | Selectors (role-based first, then test-id, then text), fixtures, fresh-IDB-per-test, reduced-motion forcing, retry policy, and the load-bearing **ASK-FIRST** prompt rule for every test design decision. | playwright fixture, playwright selector, role selector, getByRole, test-id, fresh idb fixture, reduced motion playwright, ask first test |
| eslint-plugin-sonarjs | narrow | — | Local-only second-opinion ESLint pass via `eslint-plugin-sonarjs`: cognitive-complexity, code-smell, bug-pattern rules layered on top of Biome. Owns `apps/<name>/eslint.sonar.config.mjs` (sonar-only flat config, NO Biome/eslint-recommended overlap), the calibrated rule policy with rationale comments (`pseudo-random` off, `void-use` off, `cognitive-complexity` ≥50, `no-nested-functions` off for tests), the `check:sonar` per-app turbo task, and `.github/workflows/sonarjs.yml`. Explicitly NOT SonarQube/SonarCloud — no `sonar-scanner`, no project token, no server. | sonar, sonarjs, eslint-plugin-sonarjs, cognitive-complexity, pseudo-random, no-nested-conditional, no-nested-functions, void-use, second-opinion lint, eslint.sonar.config.mjs |

**Totals:** 19 techs + 1 cross-cutting authoring policy → 15 narrow skills + 5 router skills + 17 sub-skills = **37 skills**.

---

## Section 2 — Overlap resolution

Resolution rule: **producer owns the API surface; consumer owns the integration usage and links back to the producer.** Cross-link with `[skill-name](../skill-name/SKILL.md)` from the consumer side.

### Zod ↔ T3-env (env validation)
- Owner: t3-env
- Defers to owner: zod
- Rationale: Schemas-as-types are Zod's surface, but the `createEnv({ client, server, runtimeEnv })` shape, `VITE_` prefix rules, and build-time validation are t3-env-specific; the env skill imports `z` and points back to zod for schema authoring patterns.

### Zod ↔ Jotai (atomWithIDB validation)
- Owner: jotai
- Defers to owner: zod
- Rationale: Jotai owns the `atomWithIDB(schema, key, default)` factory contract including the on-set `schema.parse` step; zod owns how to author the schema itself.

### Zod ↔ IDB (record + migration validation)
- Owner: idb
- Defers to owner: zod
- Rationale: IDB owns the record-shape contract per object store and the `upgrade` callback that re-parses old records against the new schema during migration; zod owns the schema authoring + `safeParse` semantics those migrations depend on.

### Zod ↔ TS (`z.infer` vs hand-written types)
- Owner: zod
- Defers to owner: ts
- Rationale: The "every type comes from `z.infer`" rule is a zod-skill rule; ts owns `tsgo --noEmit` strictness and tsconfig but explicitly says "if a Zod schema exists, use `z.infer` — see zod."

### Zod ↔ TanStack Router (route param validation)
- Owner: tanstack-router-routing
- Defers to owner: zod
- Rationale: The router exposes the `validateSearch` / param-parser hook; the actual schema is authored per zod's rules. The routing sub-skill shows the integration shape and links to zod for schema authoring.

### IDB ↔ Jotai (source-of-truth contract, hydration suspense, BroadcastChannel sync)
- Owner: idb
- Defers to owner: jotai
- Rationale: The IDB-first Pillar is enforced by the idb skill: idb owns the root `idbHydrationPromise`, the `use(idbHydrationPromise)` Suspense pattern, debounced write-through (~150ms), and the `BroadcastChannel` re-hydration broadcast. Jotai consumes that promise via its `atomWithIDB` factory and links back to idb for the hydration contract.

### Biome ↔ Stylelint (file-extension boundary)
- Owner per extension: biome owns `.ts`/`.tsx`/`.js`/`.json`; stylelint owns `.css`.
- Defers to owner: biome explicitly **does not** enable its CSS linter and points at stylelint; stylelint **does not** touch JS/TS and points at biome.
- Rationale: AGENTS.md hard-codes the split. The biome skill must include a "Do not enable Biome's CSS linter" warning; the stylelint skill must include a "Stylelint does not lint JS/TS" warning.

### Storybook ↔ Playwright (story tests run in Playwright)
- Owner: playwright-story-tests
- Defers to owner: storybook-play-functions (story-side interactions) and storybook-config (story URL routing)
- Rationale: Storybook authors the play function (the in-story interactions); Playwright owns the test harness that drives the story URL and asserts. The story sub-skill shows how to write the play function; the playwright story-tests sub-skill shows how to drive it from a Playwright spec.

### Storybook ↔ React (component-first development)
- Owner: storybook-stories
- Defers to owner: react-19-primitives (`<Suspense>` boundaries inside a story), react-compiler-rules (purity in story components)
- Rationale: The Storybook-first Pillar is enforced at the story level — every component file ships with a sibling stories file. React skills own how the component itself is written; Storybook owns the story file format.

### Storybook ↔ Tailwind (shared Vite config, never forked)
- Owner: storybook-config
- Defers to owner: tailwind
- Rationale: storybook-config explicitly imports the same Vite/Tailwind/alias config the app uses; tailwind owns the Vite plugin and `@theme` setup. Forking the Tailwind config in Storybook is a bug — storybook-config calls this out and links to tailwind for the canonical config.

### TanStack ↔ Nitro (SPA + prerender + static `github_pages` preset)
- Owner: tanstack-start-spa-prerender
- Defers to owner: nitro
- Rationale: TanStack Start configures Nitro under the hood. The SPA+prerender sub-skill owns the **app-level decision** ("SPA mode, full prerender, no server functions"); nitro owns the **preset wiring** (`preset: "github_pages"`, `prerender.routes`, `baseURL`). The tanstack sub-skill links to nitro for preset details.

### TanStack ↔ React (router vs framework boundary)
- Owner per surface: tanstack-router-routing owns routing APIs; react-19-primitives owns React-level concurrency and `<Suspense>` boundaries used inside route components.
- Defers to owner: tanstack-router-routing defers to react-19-primitives for `use(promise)` and `<Suspense>` patterns inside loader/route boundaries.
- Rationale: The router is its own producer; React-level idioms used inside route components are React's surface.

### TanStack ↔ PWA / Workbox (navigation fallback to prerendered shell)
- Owner: tanstack-router-pwa-deep-links
- Defers to owner: nitro (for what the prerendered shell looks like)
- Rationale: Workbox's `NavigationRoute` is configured to point at the prerendered shell; the router resolves the actual route client-side from cache. The pwa-deep-links sub-skill owns this integration; the offline-test contract is co-owned with playwright-pwa-offline (which only verifies the behavior).

### TurboRepo ↔ Bun (orchestration vs execution)
- Owner per role: turborepo owns the task graph and cache; bun-package-manager owns workspace install and the `packageManager` pin; bun-runtime owns the actual command execution.
- Defers to owner: turborepo defers to bun for "what `bun run <task>` does"; bun-package-manager defers to turborepo for "how tasks are sequenced and cached."
- Rationale: Turbo schedules; Bun executes. Each skill links to the other at the boundary.

### React ↔ animejs (purity rule: anime.js never runs in render)
- Owner: animejs
- Defers to owner: react-compiler-rules
- Rationale: The "anime.js is a side channel — never call during render, always inside `useEffect`/`useLayoutEffect` or event handlers" rule is enforced by animejs (which owns the `useAnime(ref, params, deps)` hook that makes this safe by construction). react-compiler-rules states the general purity rule and links to animejs for the canonical animation hook.

### React Compiler ↔ React 19 primitives
- Owner per role: react-compiler-rules owns the "no manual memo" rule; react-19-primitives owns `use`/`useTransition`/`useDeferredValue`/`useOptimistic`/`useActionState`/`useFormStatus`.
- Defers to owner: react-compiler-rules links to react-19-primitives whenever it says "use a 19 primitive instead of memoizing."
- Rationale: They are complementary halves of the same React-19-with-Compiler story; the router skill (`react`) sends prompts to whichever half matches.

### Bun-test ↔ Playwright (unit vs E2E partition)
- Owner per role: bun-test owns "no DOM, no browser → bun test"; playwright-app-tests / playwright-story-tests own anything that needs a real browser or real IndexedDB.
- Defers to owner: bun-test states the partition rule and links to the relevant playwright sub-skill for browser-tier tests; playwright-conventions states the inverse and links to bun-test for fast unit-testable logic.
- Rationale: AGENTS.md is explicit — `bun test` for pure functions, schema edge cases, atom reducers, IDB migration logic, parsers, derived selectors; Playwright for everything else. Both layers run in `bun run check`.

### Additional overlaps surfaced by research

#### Tailwind ↔ Stylelint (Tailwind directives in CSS)
- Owner: stylelint
- Defers to owner: tailwind
- Rationale: stylelint owns the `stylelint-config-tailwindcss` plugin setup that teaches Stylelint about `@apply`, `@theme`, `@layer`, and `@import "tailwindcss"`; tailwind owns the directives themselves and links to stylelint for the lint config that allows them.

#### TanStack ↔ T3-env (typed `env` import inside route components)
- Owner: t3-env
- Defers to owner: tanstack-router-routing
- Rationale: The `env` import is the same everywhere; routes are just one consumer. tanstack-router-routing links to t3-env when an example needs `env.VITE_*`.

#### TurboRepo ↔ Biome / Stylelint / TS / bun-test / Playwright (CLI gate composition)
- Owner: turborepo
- Defers to owner: each tool skill for its own CLI invocation
- Rationale: turborepo owns the ordering and `dependsOn` chain that makes `bun run check` run `biome ci → stylelint --max-warnings 0 → tsgo --noEmit → bun test → build → playwright (storybook + app + app-offline)` in order; the parallel `check:fast` task drops `build` and runs only `--project=storybook` for the pre-push hook (`scripts/install-hooks.sh` writes `.git/hooks/pre-push`). Each tool skill owns its own flags and exit-code semantics.

#### Nitro ↔ Vite PWA / Workbox (build-output assumptions)
- Owner: nitro
- Defers to owner: tanstack-router-pwa-deep-links (for the navigation-fallback contract)
- Rationale: nitro produces the static output that Workbox precaches; the navigation-fallback wiring lives in tanstack-router-pwa-deep-links (because it's a router decision). nitro links to that sub-skill for the PWA integration shape.

#### Storybook ↔ Biome / Stylelint (story files are still TS/CSS)
- Owner per extension: biome (story `.tsx`), stylelint (story `.css`)
- Defers to owner: storybook-stories defers to biome for lint conventions inside story files
- Rationale: Story files are not exempt from the CLI gate. storybook-stories includes a one-liner reminder that `bun run check` lints stories too.

---

## Section 3 — Trigger-keyword index

Alphabetical. Each keyword maps to **exactly one** skill. No collisions.

| keyword | owning skill |
|---|---|
| `@import "tailwindcss"` | tailwind |
| `@storybook/test` | storybook-play-functions |
| `@theme` | tailwind |
| `.nvmrc` | node |
| `addChild` | (out of scope — pixijs collection, not mind-palace) |
| `anime v4` | animejs |
| `anime utils` | animejs |
| `anime.js` | animejs |
| `animejs` | animejs |
| `app-level test` | playwright-app-tests |
| `args` | storybook-stories |
| `argTypes` | storybook-stories |
| `ask first playwright` | playwright |
| `ask first test` | playwright-conventions |
| `atom` | jotai |
| `atom family` | jotai |
| `atomWithIDB` | jotai |
| `atomWithIDB storage` | idb |
| `baseURL` | nitro |
| `biome` | biome |
| `biome ci` | biome |
| `biome format` | biome |
| `biome lint` | biome |
| `biome rule` | biome |
| `biome watch` | biome |
| `biome.json` | biome |
| `BroadcastChannel sync` | idb |
| `Bun.$` | bun-runtime |
| `Bun.file` | bun-runtime |
| `Bun.serve` | bun-runtime |
| `bun` | bun |
| `bun 1.3.13` | bun |
| `bun add` | bun-package-manager |
| `bun coverage` | bun-test |
| `bun install` | bun-package-manager |
| `bun lockfile` | bun-package-manager |
| `bun matcher` | bun-test |
| `bun mock` | bun-test |
| `bun overrides` | bun-package-manager |
| `bun overview` | bun |
| `bun remove` | bun-package-manager |
| `bun runtime` | bun-runtime |
| `bun script` | bun-runtime |
| `bun shell` | bun-runtime |
| `bun snapshot` | bun-test |
| `bun test` | bun-test |
| `bun watch test` | bun-test |
| `bun workspace` | bun-package-manager |
| `bun.lockb` | bun-package-manager |
| `bun:test` | bun-test |
| `bunx` | bun-runtime |
| `clientPrefix` | t3-env |
| `co-located story` | storybook-stories |
| `compiler audit` | react-compiler-rules |
| `createAnimatable` | animejs |
| `createDraggable` | animejs |
| `createEnv` | t3-env |
| `createRoute` | tanstack-router-routing |
| `createScope` | animejs |
| `createTimeline` | animejs |
| `CSF 3` | storybook-stories |
| `debounce` | micro-utilities |
| `dependsOn` | turborepo |
| `deep clone` | micro-utilities |
| `deep equality` | micro-utilities |
| `deep link offline` | tanstack-router-pwa-deep-links |
| `deep merge` | micro-utilities |
| `deep link offline test` | playwright-pwa-offline |
| `defaultPreload` | tanstack-router-preload |
| `derived atom` | jotai |
| `design tokens` | tailwind |
| `e2e workflow` | playwright-app-tests |
| `env validation` | t3-env |
| `env-core` | t3-env |
| `env.ts` | t3-env |
| `file-based routing` | tanstack-router-routing |
| `fresh idb fixture` | playwright-conventions |
| `getByRole` | playwright-conventions |
| `github_pages preset` | nitro |
| `group by` | micro-utilities |
| `idb` | idb |
| `IDBPDatabase` | idb |
| `idb hydration` | idb |
| `idb migration` | idb |
| `idb migration test` | idb |
| `idb seeded test` | playwright-app-tests |
| `idb assertion` | playwright-app-tests |
| `IndexedDB` | idb |
| `intent preload` | tanstack-router-preload |
| `interaction test` | storybook-play-functions |
| `isolatedDeclarations` | ts |
| `jotai` | jotai |
| `jotai Provider` | jotai |
| `jotai store` | jotai |
| `just-extend` | micro-utilities |
| `Link` | tanstack-router-routing |
| `link preload` | tanstack-router-preload |
| `lodash alternative` | micro-utilities |
| `manual memoization` | react-compiler-rules |
| `max-warnings` | stylelint |
| `memoize-one` | micro-utilities |
| `Meta` | storybook-stories |
| `micro utilities` | micro-utilities |
| `modulepreload` | tanstack-router-preload |
| `mount story` | playwright-story-tests |
| `NavigationRoute` | tanstack-router-pwa-deep-links |
| `navigation fallback` | tanstack-router-pwa-deep-links |
| `navigation fallback test` | playwright-pwa-offline |
| `network offline` | playwright-pwa-offline |
| `nitro` | nitro |
| `nitro preset` | nitro |
| `nitro.config` | nitro |
| `node 25` | node |
| `node toolchain` | node |
| `node tooling` | node |
| `node version` | node |
| `object store` | idb |
| `offline test` | playwright-pwa-offline |
| `openDB` | idb |
| `packageManager` | bun |
| `parse` | zod |
| `partition` | micro-utilities |
| `pick omit` | micro-utilities |
| `play function` | storybook-play-functions |
| `play step` | storybook-play-functions |
| `playwright` | playwright |
| `playwright app test` | playwright-app-tests |
| `playwright fixture` | playwright-conventions |
| `playwright overview` | playwright |
| `playwright selector` | playwright-conventions |
| `playwright story` | playwright-story-tests |
| `prefers-reduced-motion` | animejs |
| `prerender` | nitro |
| `prerender route` | nitro |
| `pwa offline test` | playwright-pwa-offline |
| `react` | react |
| `react 19` | react |
| `react 19 hook` | react-19-primitives |
| `react compiler` | react-compiler-rules |
| `React.memo` | react-compiler-rules |
| `react overview` | react |
| `reduced motion playwright` | playwright-conventions |
| `refine` | zod |
| `render purity` | react-compiler-rules |
| `role selector` | playwright-conventions |
| `route param` | tanstack-router-routing |
| `route preload` | tanstack-router-preload |
| `route tree` | tanstack-router-routing |
| `route workflow test` | playwright-app-tests |
| `router pwa` | tanstack-router-pwa-deep-links |
| `runtimeEnv` | t3-env |
| `safeParse` | zod |
| `schema` | zod |
| `search params` | tanstack-router-routing |
| `service worker test` | playwright-pwa-offline |
| `shared vite config` | storybook-config |
| `side channel` | react-compiler-rules |
| `spa fallback` | tanstack-router-pwa-deep-links |
| `SPA fallback 404` | nitro |
| `spa mode` | tanstack-start-spa-prerender |
| `ssr false` | tanstack-start-spa-prerender |
| `stagger` | animejs |
| `static preset` | nitro |
| `story` | storybook-stories |
| `story file` | storybook-stories |
| `story interaction` | storybook-play-functions |
| `story-level test` | playwright-story-tests |
| `story test` | playwright-story-tests |
| `stories.tsx` | storybook-stories |
| `structuredClone` | micro-utilities |
| `storybook` | storybook |
| `storybook addon` | storybook-config |
| `storybook config` | storybook-config |
| `storybook main.ts` | storybook-config |
| `storybook overview` | storybook |
| `storybook preview.ts` | storybook-config |
| `storybook url test` | playwright-story-tests |
| `storybook vite builder` | storybook-config |
| `storybook-first` | storybook |
| `StoryObj` | storybook-stories |
| `stylelint` | stylelint |
| `stylelint css` | stylelint |
| `stylelint plugin` | stylelint |
| `stylelint tailwind` | stylelint |
| `stylelint watch` | stylelint |
| `stylelintrc` | stylelint |
| `Suspense` | react-19-primitives |
| `t3 env` | t3-env |
| `t3-env` | t3-env |
| `tailwind` | tailwind |
| `tailwind v4` | tailwind |
| `tailwind vite plugin` | tailwind |
| `tailwindcss` | tailwind |
| `tanstack` | tanstack |
| `tanstack prerender` | tanstack-start-spa-prerender |
| `tanstack router` | tanstack-router-routing |
| `tanstack router overview` | tanstack |
| `tanstack router preload` | tanstack-router-preload |
| `tanstack start` | tanstack |
| `tanstack start spa` | tanstack-start-spa-prerender |
| `test-id` | playwright-conventions |
| `throttle` | micro-utilities |
| `transform` | zod |
| `ts compiler` | ts |
| `ts project references` | ts |
| `ts strict` | ts |
| `tsgo --noEmit` | ts |
| `tsconfig` | ts |
| `turbo` | turborepo |
| `turbo cache` | turborepo |
| `turbo pipeline` | turborepo |
| `turbo task` | turborepo |
| `turbo.json` | turborepo |
| `turborepo` | turborepo |
| `typescript 7` | ts |
| `unit test` | bun-test |
| `upgrade callback` | idb |
| `use(promise)` | react-19-primitives |
| `useActionState` | react-19-primitives |
| `useAnime` | animejs |
| `useAtom` | jotai |
| `useAtomValue` | jotai |
| `useCallback` | react-compiler-rules |
| `useDeferredValue` | react-19-primitives |
| `userEvent` | storybook-play-functions |
| `useFormStatus` | react-19-primitives |
| `useMemo` | react-compiler-rules |
| `useNavigate` | tanstack-router-routing |
| `useOptimistic` | react-19-primitives |
| `useSetAtom` | jotai |
| `useTransition` | react-19-primitives |
| `validateSearch` | tanstack-router-routing |
| `viewport preload` | tanstack-router-preload |
| `VITE_` | t3-env |
| `volta` | node |
| `which bun` | bun |
| `which playwright skill` | playwright |
| `which react skill` | react |
| `which storybook skill` | storybook |
| `which tanstack skill` | tanstack |
| `workspace orchestration` | turborepo |
| `z.infer` | zod |
| `z.object` | zod |
| `zod` | zod |
| `zod 4` | zod |
| `ZodError` | zod |

(Note: the row for `addChild` is intentionally listed as out-of-scope to flag a potential collision with the existing `pixijs-scene-container` skill — that keyword stays with pixijs and is not claimed by any mind-palace skill.)

---

## Section 4 — Wave plan

Each wave is gated by green `bun run check` of every prior wave's output. No skill in a later wave references a skill that has not yet shipped.

### Wave 1 — Toolchain & language (11 skills)
**Skills:** bun (router), bun-runtime, bun-test, bun-package-manager, turborepo, biome, stylelint, ts, node, nitro, micro-utilities
**Count:** 11
**Pillar mapping:**
- **Pillar 4 (CLI-gate-first, zero-warning)** is enforced primarily by this wave: biome, stylelint, ts, bun-test, and turborepo together implement `bun run check` (the Playwright link comes in Wave 4).
- node + nitro provide the runtime/build floor SPA-prerender will need.

**Rationale:** Nothing else can be checked in green without the gate, the package manager, the workspace orchestrator, and the language baseline. nitro is included here even though it's consumed by tanstack later — its preset config is a static-build concern that ts and the toolchain need to reference paths-wise, and placing it earlier means the Wave 3 tanstack-start-spa-prerender skill can link to a finished nitro skill.

### Wave 2 — Schema & state (4 skills)
**Skills:** zod, t3-env, idb, jotai
**Count:** 4
**Pillar mapping:**
- **Pillar 2 (Zod-first types)** is enforced by zod (producer) and t3-env (consumer of zod for env vars).
- **Pillar 3 (IDB-first state)** is enforced by idb (producer of the hydration contract and `BroadcastChannel` sync) and jotai (consumer that mirrors writes to IDB via `atomWithIDB`).

**Rationale:** Schemas are the source of truth for every later type; state is the second source of truth (IDB) plus its in-memory cache (Jotai). Both must exist before any UI can declare props or persist progress. Order within the wave: zod first (other three import `z`), then t3-env (consumes zod), then idb (depends on zod for record validation), then jotai (depends on idb for the hydration promise).

### Wave 3 — UI core & framework (11 skills)
**Skills:** react (router), react-compiler-rules, react-19-primitives, tailwind, animejs, tanstack (router), tanstack-start-spa-prerender, tanstack-router-routing, tanstack-router-pwa-deep-links, tanstack-router-preload, tanstack-devtools
**Count:** 11
**Pillar mapping:**
- All four Pillars now have first-class consumers; the Compiler purity rules (react-compiler-rules) and the side-channel rule (animejs) are the closest thing to Pillar enforcement at the React layer.
- tanstack-start-spa-prerender + nitro (Wave 1) together realize the "no server, prerender everything" architecture decision.

**Rationale:** The UI framework consumes Wave 1's toolchain and Wave 2's state/schema layers. tanstack sub-skills land here because they need react and nitro to already exist. tailwind lands here because it's a UI-time concern but is consumed by Storybook in Wave 4.

### Wave 4 — Stories & tests (9 skills)
**Skills:** storybook (router), storybook-config, storybook-stories, storybook-play-functions, playwright (router), playwright-story-tests, playwright-app-tests, playwright-pwa-offline, playwright-conventions
**Count:** 9
**Pillar mapping:**
- **Pillar 1 (Storybook-first)** is enforced by storybook-stories (every component needs a co-located story) and at the routing level by storybook (the router skill repeats "no component without a story" once).
- **Pillar 4 (CLI-gate-first)** is completed here: the Playwright sub-skills add the final two stages (`playwright test` story + app) of `bun run check`.
- The PWA deep-link contract from AGENTS.md is verified end-to-end by playwright-pwa-offline.

**Rationale:** Stories test the components built in Wave 3; Playwright tests both stories (Wave 4 storybook surface) and full app routes (Wave 3 tanstack surface). Lands last because every other wave must already be green for these tests to be writable. The **ASK-FIRST** rule for Playwright tests is owned by playwright (router) and detailed in playwright-conventions.

**Wave totals:** 11 + 4 + 11 + 9 = **35 skills** (matches Section 1 inventory exactly; no skill orphaned, no skill double-assigned).

**Pillar coverage check:**
- Pillar 1 (Storybook-first) → storybook, storybook-stories, storybook-play-functions, storybook-config, playwright-story-tests
- Pillar 2 (Zod-first types) → zod, t3-env, idb, jotai, ts, tanstack-router-routing
- Pillar 3 (IDB-first state) → idb, jotai
- Pillar 4 (CLI-gate-first, zero-warning) → biome, stylelint, ts, bun-test, turborepo, playwright-story-tests, playwright-app-tests, playwright-pwa-offline
- Every Pillar has ≥1 enforcing skill. ✓

---

## Section 5 — Research notes

What the latest version of each tech requires the SKILL.md to reflect. These are the load-bearing facts; details belong inside each skill, not here.

### zod (Zod 4)
- New `z.codec()` for two-way transforms; `z.transform()` is one-way.
- `safeParse` / `parse` API unchanged for the common case, but `ZodError` surface is restructured (use `error.issues`, `z.prettifyError(error)`, `z.treeifyError(error)` instead of v3's `.format()`/`.flatten()` for new code).
- JSON Schema export is built-in (`z.toJSONSchema`).
- `.refine` and `.superRefine` are stable; `.check` chains added.
- Tree-shakable subpath: `import { z } from "zod/v4-mini"` for the small build.
- Performance: ~3× faster than v3; no runtime cost when used only at boundaries.
- **mind-palace rule:** runtime parsing is dev-only via `defineComponent(schema, fn)`; production tree-shakes the parse call.

### idb (jakearchibald/idb v8)
- `openDB(name, version, { upgrade, blocked, blocking, terminated })` is the only entry point worth using.
- Promises everywhere; no callback-style fallbacks.
- TypeScript: `IDBPDatabase<MySchema>` where `MySchema extends DBSchema` gives type-safe `.get`/`.put`.
- Migrations: switch on `oldVersion` inside `upgrade`; never assume linear hops.
- `BroadcastChannel` is a browser primitive (not part of `idb`); the skill must own the multi-tab re-hydration pattern explicitly.
- **mind-palace rule:** the root `idbHydrationPromise` resolves once; `atomWithIDB` reads sync after that.

### t3-env (`@t3-oss/env-core` latest)
- `createEnv({ clientPrefix, client, server, runtimeEnv, emptyStringAsUndefined })`.
- Build-time validation only on GH Pages; `server` slot stays empty `{}` so a future move off GH Pages is a config change, not a refactor.
- `runtimeEnv: import.meta.env` for Vite consumers; explicit object literal to keep tree-shaking honest.
- Zod 4 compatible; pass `z` instances directly.

### jotai (latest 2.x)
- `atom`, `useAtom`, `useAtomValue`, `useSetAtom`, `useStore`, `Provider`, `atomWithStorage`, `loadable`, `unwrap`, `useHydrateAtoms`. (`atomFamily` is intentionally excluded — mind-palace uses the `atomWithIDB` key + module-scope `Map<id, atom>` pattern; see `jotai/SKILL.md` parameterized-atoms section.)
- Async atoms integrate with React 19 `<Suspense>` and `use(promise)` natively — no extra `loadable` wrap required.
- `atomWithStorage` accepts a custom storage adapter; `atomWithIDB` is built on top of this contract.
- BroadcastChannel cross-tab sync is application code, not a Jotai feature — owned by the idb skill.

### biome (Biome 2.x)
- `biome.json` v2 schema; `biome migrate` upgrades from 1.x.
- `biome ci` is the gate command (formatter check + linter, exit non-zero on any diff/finding).
- New domains in 2.x: `nursery`, `correctness`, `style`, `suspicious`, `complexity`, `performance`, `a11y`.
- `assist` (organize imports) replaces 1.x `organizeImports`.
- **No CSS linter enabled** — Stylelint owns CSS.

### stylelint (latest)
- `stylelint --max-warnings 0` is the gate.
- Tailwind v4 plugin is `stylelint-config-tailwindcss` (or the maintained alternative); knows `@apply`, `@theme`, `@layer`, `@import "tailwindcss"`.
- Watch mode via `--watch`; CLI watcher is the source of truth, the IDE is not.

### animejs (anime.js v4)
- Named-import API only: `createTimeline`, `createAnimatable`, `createScope`, `createDraggable`, `createSpring`, `stagger`, `utils`, `eases`, `engine`.
- v3's default `anime()` import is **gone**; any reference material using it is wrong by definition.
- Scopes (`createScope`) replace v3's "anime instance" lifecycle for cleanup.
- `prefers-reduced-motion` is application code — short-circuit at the `useAnime` hook level.

### turborepo (latest)
- `turbo.json` v2 schema (`tasks` instead of `pipeline`); `turbo migrate` upgrades.
- `dependsOn` with `^` for upstream-package dependencies, `$` for env vars (`$VITE_FOO`).
- Remote cache via `turbo login` / `turbo link` (optional; local cache only is fine for this project).
- `outputs` arrays must be exhaustive or the cache is invalidated.

### nitro (Nitro v3)
- `defineNitroConfig({ preset: "github_pages", baseURL: "/mind-palace/", prerender: { routes: [...] } })`.
- The `github_pages` preset writes `404.html` as the SPA fallback automatically.
- v3 prerender uses the new crawl algorithm; pass explicit route arrays for islands the crawler can't reach.
- Static-only output; no `serverHandlers`, no `nitroApp` runtime in this project.

### node (Node 25)
- Required only for tools that don't run on Bun (rare in this stack — most things run on Bun 1.3.13).
- `--experimental-strip-types` is stable; `node --run` reads `package.json` scripts (we use bun for this, but the option exists).
- Test runner (`node:test`) is stable but unused — we use `bun test`.
- Pin via `.nvmrc` or Volta.

### ts (TypeScript 7)
- Strict everywhere (`"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`).
- `isolatedDeclarations` enables faster project builds and is required for the future of monorepo type-emit.
- `verbatimModuleSyntax` is on; use `import type { ... }` for type-only imports.
- `tsgo --noEmit` is the gate; emit is handled by Bun/Vite.
- **mind-palace rule:** every type that has a Zod schema is `z.infer<typeof Schema>` — never hand-written.

### tailwind (Tailwind v4)
- Vite plugin: `@tailwindcss/vite`; install plugin and add `@import "tailwindcss"` to one CSS entry.
- Design tokens declared in CSS via `@theme { --color-brand: ...; }`; auto-generates utility classes.
- No `tailwind.config.js` for the common case (CSS-first config). A JS config is still supported via `@config`.
- `@apply`, `@layer`, and `@variant` still work; the lint plugin must understand all three.

### bun (Bun 1.3.13, pinned via `packageManager`)
- Runtime: `Bun.serve`, `Bun.file`, `Bun.$`, FFI, SQLite, S3 client, Redis client (latter three irrelevant here).
- Test runner (`bun test`): Jest-compatible matchers, `mock`, snapshot, watch (`--watch`), coverage (`--coverage`), DOM via `happy-dom` opt-in.
- Package manager: `bun install` is the lockfile producer; `bun add`, `bun remove`, workspace globs in `package.json`, overrides via `"overrides"` field. `bun.lockb` is binary; commit it.
- `bunx` is the equivalent of `npx`.

### react (React 19 + React Compiler)
- Compiler does the memoization; `useMemo`, `useCallback`, `React.memo` are noise and can mask purity bugs.
- `use(promise)` for inline async reads inside a `<Suspense>` boundary.
- `useTransition` / `useDeferredValue` for non-urgent updates.
- `useOptimistic` for mutation UIs; `useActionState` and `useFormStatus` for form flows.
- Server components are not used here (SPA-only). React 19's ref-as-prop and the new metadata hoisting still apply.

### tanstack (TanStack Start latest, in SPA + full prerender mode)
- `@tanstack/react-start` with Vite plugin; `ssr: false` configured to mean "no runtime SSR" while still allowing build-time prerender.
- File-based routing in `app/routes/`; `createFileRoute` per file.
- `validateSearch` and route-param parsers accept Zod schemas directly.
- Nitro is the build engine; configure `preset: "github_pages"` and `prerender.routes` to enumerate every route.
- No server functions, no server loaders, no `createServerFn` — would silently introduce a server dep on a static target.

### storybook (Storybook 10 with Vite builder)
- `main.ts` framework: `@storybook/react-vite` (or the TanStack-Start integration when shipped).
- Shared Vite config: import the app's Vite config and spread it into Storybook's `viteFinal`. Tailwind v4 is automatically picked up because it's a Vite plugin.
- CSF 3: `Meta<typeof Component>` + `StoryObj<typeof meta>`.
- Play functions use `@storybook/test` (`userEvent`, `expect`, `within`).
- Storybook test runner is **not** used here — Playwright drives stories directly per Pillar 1 + the testing rule in AGENTS.md.

### playwright (Playwright latest)
- Fixtures via `test.extend`; per-test isolation; parallel workers.
- `page.context().route()` for network mocking; `browser.newContext({ offline: true })` or `context.setOffline(true)` for offline.
- `page.evaluate(() => indexedDB...)` for IDB seeding/assertion.
- Reduced motion: `context: { reducedMotion: 'reduce' | 'no-preference' }` per project or per test.
- Selectors: prefer `getByRole`, then `getByTestId`, then `getByText`; never raw CSS for assertions.
- Service worker: `context.serviceWorkers()` and `context.waitForEvent('serviceworker')`.
- **mind-palace rule:** ASK FIRST before writing any Playwright test. The user owns the structural decisions.
