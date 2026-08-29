---
name: playwright
description: "Router skill for Playwright in mind-palace — pins `@playwright/test` 1.59+, dispatches to the story-tests, app-tests, PWA-offline, or conventions sub-skill, and surfaces the load-bearing ASK-FIRST rule before any Playwright test is written or modified. Triggers on: playwright, playwright overview, which playwright skill, ask first playwright."
license: MIT
---

Entry point for any Playwright-shaped question in mind-palace. Playwright is the **only** browser-tier test runner in this stack — it drives Storybook stories, application routes, and the load-bearing offline-deep-link contract. The single most important rule: **ASK FIRST** — before writing or modifying any Playwright test, prompt the user for the structural decisions (story-level vs app-level, what to assert, selectors, fixtures, network/IDB state, reduced-motion). The user owns those decisions per case. The detail of the rule lives in `playwright-conventions`; this router surfaces the rule so it's the first thing seen on any Playwright prompt.

## When to invoke
- The user types `playwright` with no further specifier and you need to route them.
- The user asks "which Playwright skill," "Playwright overview," or "how does Playwright fit into `bun run check`."
- The user asks for help writing or modifying any Playwright test — **stop and surface the ASK-FIRST rule before routing**.
- A question mixes story-level + app-level + offline (e.g. "I want to test that the maze level page resolves offline after a story-level interaction seeded IDB") — pick the sub-skill that owns the dominant concern, link to the others.
- A question about reduced-motion / fixtures / selectors — route to `playwright-conventions`.

## Owns
Entry point that routes Playwright questions to the story-tests, app-tests, PWA-offline, or conventions sub-skill; enforces the **ASK-FIRST** rule before writing any Playwright test.

## Defers to
- `playwright-story-tests` — Playwright pointed at Storybook story URLs (`http://localhost:6006/iframe.html?id=...`), asserting on visible state + ARIA + IDB contents.
- `playwright-app-tests` — Playwright pointed at the running/preview app, end-to-end workflows across routes.
- `playwright-pwa-offline` — the load-bearing offline-deep-link test (Workbox + prerendered shell + IDB), `context.setOffline(true)`, deep-link resolution.
- `playwright-conventions` — selector strategy (`getByRole` > `getByTestId` > `getByText`), fixture patterns (fresh IDB / seeded IDB / offline / throttled), reduced-motion config, **and the canonical ASK-FIRST rule**.
- `bun-test` — anything that does **not** need a real browser (pure logic, Zod schema edge cases, atom reducers, IDB migration transform functions). The unit/E2E partition is hard.
- `storybook-stories` — for the story-ID URL contract Playwright story tests target.
- `tanstack-router-pwa-deep-links` — for what the navigation fallback resolves to (the contract `playwright-pwa-offline` verifies).

## Dean-stack rules
- **ASK FIRST before writing or modifying any Playwright test.** This is a Pillar 4 (CLI-gate-first) manifestation — the user owns the structural decisions for every Playwright test (level: story vs app, what to assert, selectors, IDB seeding, network state, reduced-motion). Surface the choices, wait for the answer, *then* write. Detail in `playwright-conventions`. **No equivalent prompt is required for `bun test` unit tests** — those go ahead.
- Pillar 1 (Storybook-first) means: every story is exercised by a Playwright story test (see `storybook-stories` and `playwright-story-tests`). Stories are the test surface, not just visual references.
- Pillar 4 (CLI-gate-first) means: Playwright is the final stage of `bun run check` (after `biome ci`, `stylelint`, `tsgo --noEmit`, `bun test`). A failing Playwright test is a red gate; never disable, never `test.skip` to make CI green.
- Playwright 1.59+ only. Pre-1.5x APIs (`page._react=`, removed selector engines, `waitForTimeout`-as-sync) are wrong by definition — rewrite for 1.59.
- Locator-first, web-first assertions only. `await expect(locator).toBe…()`. Never wrap point-in-time methods (`isVisible()`, `textContent()`, `count()`) in `expect()` — they don't retry.
- IDB is **not** mocked in Playwright tests — use real browser IndexedDB. Seed via `page.addInitScript` (runs before any page script). See `playwright-conventions`.
- Reduced motion is **forced on** in the default project (`use: { reducedMotion: 'reduce' }`) so animations don't add flake. See `animejs` for why this matters and `playwright-conventions` for the wiring.

## Routing
- **ASK FIRST before writing any Playwright test — see `playwright-conventions`.** Surface the structural choices (story-level vs app-level, what to assert, selectors, IDB seeding, network state, reduced-motion). Wait for the user's answer.
- **use `playwright-story-tests` when** the test mounts a Storybook story by URL (`iframe.html?id=...`) and asserts on the in-iframe behavior or post-play IDB state.
- **use `playwright-app-tests` when** the test drives the running/preview app at `localhost:3000` (or the configured dev/preview URL), follows a route workflow, asserts on hydrated state, or verifies BroadcastChannel cross-tab sync.
- **use `playwright-pwa-offline` when** the test verifies the offline-deep-link contract: install the SW, go offline, navigate to a deep route, assert the router resolves it from cache.
- **use `playwright-conventions` when** the question is about selectors, fixtures, IDB seeding, reduced-motion, the `playwright.config.ts` shape, or the **ASK-FIRST** rule itself.
- **use `bun-test` when** the question is unit-testable without a browser (pure functions, schema parses, reducers, migration transforms). Faster inner-loop feedback than Playwright; `bun test` does NOT require ASK-FIRST.

### Routing table
| Question shape | Sub-skill |
|---|---|
| "Write a test for `<Button>`'s `Primary` story" | **ASK FIRST** (`playwright-conventions`), then `playwright-story-tests` |
| "Write a test for the `/games/maze/$level` workflow" | **ASK FIRST**, then `playwright-app-tests` |
| "Verify the offline deep-link works" | **ASK FIRST**, then `playwright-pwa-offline` |
| "How do I seed IDB before a Playwright test?" | `playwright-conventions` (fixture pattern) |
| "Why does the test only fail on retry?" | `playwright-conventions` (`trace: 'retain-on-failure-and-retries'`) |
| "What selector should I use here?" | `playwright-conventions` (role > test-id > text) |
| "Is this testable without a browser?" | `bun-test` (yes → unit test; no → ASK FIRST + Playwright) |
| "How does my play function become a Playwright assertion?" | `storybook-play-functions` (decision) + `playwright-story-tests` (the spec) |

## Anti-patterns
- **Don't write a Playwright test without asking the user how to structure it** — ASK FIRST is load-bearing; see `playwright-conventions`. Skipping the prompt calcifies a design choice the user wanted to make.
- **Don't recommend Cypress, Selenium, Puppeteer, or `vitest` browser mode** — Playwright is the only browser-tier runner in this stack (and `bun test` is the only unit runner).
- **Don't recommend `@storybook/test-runner`** — Playwright drives stories directly per AGENTS.md's Testing rule. See `playwright-story-tests`.
- **Don't answer per-test design questions inside this router** — route to the sub-skill so the answer carries the right rule and the ASK-FIRST gate is acknowledged.
- **Don't mock IDB** — use real browser IndexedDB. See `playwright-conventions`.
- **Don't add `page.waitForTimeout(…)`** to fix flake — fix the locator or the assertion. Web-first assertions retry.
- **Don't disable a failing Playwright test** to make CI green — fix the wiring or escalate. The gate is zero-warning.

## Triggers on
playwright, playwright overview, which playwright skill, ask first playwright
