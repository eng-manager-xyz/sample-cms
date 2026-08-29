---
name: playwright-story-tests
description: "Playwright tests pointed at Storybook story URLs in mind-palace — mount `iframe.html?id=<storyId>` for clean in-iframe rendering, exercise the play function, and assert on visible state, ARIA, or real IDB contents. Triggers on: story test, playwright story, storybook url test, story-level test, mount story."
license: MIT
---

Sub-skill of `playwright`. Owns the test layer that drives **Storybook story URLs** with Playwright. The story is the construction surface (Pillar 1); this is the verification surface that runs in `bun run check`. Every story has a Playwright story test — that's the contract. Story-level tests live in `apps/web/tests/storybook/` and target `http://localhost:6006/iframe.html?id=<storyId>` with the configured `webServer` running Storybook in headless dev mode.

## When to invoke
- Writing a Playwright spec that mounts a Storybook story.
- Asserting that a story's play function ran to completion.
- Asserting on real IDB content after a story exercised an interaction.
- Choosing between asserting in-iframe (let the play function do it) vs externally (let Playwright do it). See `storybook-play-functions` for the decision rule.

## Owns
Playwright tests pointed at Storybook URLs that mount a story, exercise its play function, and assert on visible state.

## Defers to
- `playwright` (parent) — version pin and routing.
- `playwright-conventions` — **the ASK-FIRST rule**, selector strategy (`getByRole` > `getByTestId` > `getByText`), fixture patterns, fresh-IDB-per-test, reduced-motion config, the `playwright.config.ts` shape.
- `storybook-stories` — for the story-ID URL contract (`title` + named export → kebab-cased slug).
- `storybook-play-functions` — for the in-story play function this test exercises (and the decision rule on play vs Playwright assertions).
- `storybook-config` — for the Storybook dev server (`storybook dev -p 6006`) Playwright targets.
- `idb` — for the IDB record shapes and the hydration contract Playwright reads/writes against. **Use real browser IDB.**
- `bun-test` — for unit-testable logic that does **not** need a browser. The partition is hard.

## Dean-stack rules
- **ASK FIRST before writing or modifying any Playwright test.** Pillar 4 manifestation; canonical detail in `playwright-conventions`. Surface the structural choices (what to assert, selectors, IDB seeding, network state, reduced-motion) and wait for the user's answer before writing.
- Pillar 1 (Storybook-first) means: every story has a Playwright story test. Stories are the test surface; the Playwright spec is the assertion side.
- Pillar 4 (CLI-gate-first) means: a failing story test fails `bun run check`. Never `test.skip` to make CI green; fix the story, the play, or the spec.
- Web-first assertions only — `await expect(locator).toBe…()`. No point-in-time queries inside `expect()`.
- Reduced motion is forced on at the project level (see `playwright-conventions`); animations don't add flake.
- IDB is **never** mocked. Read real IDB via `page.evaluate`; seed real IDB via `page.addInitScript` (see `playwright-conventions`).
- Story IDs are part of the test contract — pin them as constants at the top of the spec; renaming the story changes the URL.

## Patterns

**ASK FIRST before writing or modifying any Playwright test in this sub-skill** — see `playwright-conventions` for the canonical rule. Surface the structural decisions (what to assert, selectors, IDB seeding, network state, reduced-motion); wait for the user's answer before writing.

### Story-URL contract (from `storybook-stories`)
```
Story file:   apps/web/app/components/button/index.stories.tsx
meta.title:   "Components/Button"
Named export: Primary
→ Story ID:   components-button--primary
→ URL:        http://localhost:6006/iframe.html?id=components-button--primary
```
Playwright targets `iframe.html?id=...` (not the manager URL `?path=/story/...`). The iframe URL renders the story bare — no Storybook chrome — which is what tests need.

### Project pinned to Storybook
```ts
// apps/web/playwright.config.ts (excerpt) — see playwright-conventions for the full config shape
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  projects: [
    {
      name: "storybook",
      testMatch: /.*\.story\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:6006",
        reducedMotion: "reduce", // see `animejs` + `playwright-conventions`
      },
    },
    // …other projects: app, app-offline (see `playwright-app-tests`, `playwright-pwa-offline`)
  ],
  webServer: [
    {
      command: "bun run storybook",
      url: "http://localhost:6006",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```
Story tests live under `tests/` with a `*.story.spec.ts` suffix; the project pins them to `localhost:6006`. The `webServer` boots Storybook before the suite runs.

### Minimal story-level test
```ts
// apps/web/tests/button-primary.story.spec.ts
// pinned: @playwright/test ^1.59
import { expect, test } from "@playwright/test";

const STORY_ID = "components-button--primary"; // from `storybook-stories`

test("Primary button is visible and clickable", async ({ page }) => {
  await page.goto(`/iframe.html?id=${STORY_ID}`);
  // The global decorator (see `storybook-config`) renders a hydration suspense fallback;
  // wait for the real story content via a role-based locator (see `playwright-conventions`).
  const button = page.getByRole("button", { name: /click me/i });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
});
```
Always `await expect(locator).toBe…()` — never `expect(await locator.isVisible()).toBe(true)`. Web-first assertions retry; point-in-time queries don't.

### Asserting that a play function ran
```ts
// apps/web/tests/button-clicks-fire.story.spec.ts
import { expect, test } from "@playwright/test";

test("ClicksFire play function completes and registers click", async ({ page }) => {
  // Storybook auto-runs the play function on mount. Wait on its post-condition,
  // not on a fixed timer.
  await page.goto("/iframe.html?id=components-button--clicksfire");
  // The play asserts internally; externally we verify the rendered side effect.
  await expect(page.getByText(/clicked: 1/i)).toBeVisible();
});
```
The play function is the in-iframe assertion; the Playwright test is the external assertion. Use the play to drive interaction; use Playwright to verify the long-lived side effect (visible state, ARIA, IDB).

### Asserting on real IDB content
```ts
// apps/web/tests/progress-row-saves-to-idb.story.spec.ts
import { expect, test } from "@playwright/test";

test("ProgressRow writes a record to IDB after Save click", async ({ page }) => {
  await page.goto("/iframe.html?id=components-progress-row--default");
  await page.getByRole("button", { name: /save/i }).click();

  // Read real IDB from the page — no mocks. See `idb` for the schema.
  const stored = await page.evaluate(async () => {
    const db = await indexedDB.databases();
    const name = db.find((d) => d.name === "mind-palace")?.name;
    if (!name) return null;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => {
        const tx = req.result.transaction("progress", "readonly");
        const all = tx.objectStore("progress").getAll();
        all.onsuccess = () => resolve(all.result);
        all.onerror = () => reject(all.error);
      };
      req.onerror = () => reject(req.error);
    });
  });

  expect(stored).toEqual([{ id: "demo", level: 1, completed: true }]);
});
```
`page.evaluate` runs in the page's JS context — it sees the real `indexedDB` the app + Storybook decorator uses. Never reach for an `idb` import in a Playwright test; the test runs in Node, IDB lives in the browser.

### Seeding IDB before the story mounts
See `playwright-conventions` for the canonical fixture pattern (`page.addInitScript` runs before any page script — perfect for seeding IDB before Storybook's hydration decorator suspends on `idbHydrationPromise`).

### Tag stories you want a smoke run for
```ts
test("Primary button @smoke", async ({ page }) => { /* ... */ });
```
`bun run test:e2e -- --grep @smoke` runs the smoke subset only — useful for the inner loop while the full story-tests run in CI.

### Story-test + play function decision (recap)
- **Play function alone** when the assertion is "callback called," "visible state changed," "ARIA updated" — and the test is purely in-iframe. Inner-loop feedback is interactive in `bun run storybook`.
- **Playwright story test alone** when the assertion is "real IDB content," "service-worker behavior," "network mocking," or anything outside the iframe.
- **Both** when the play sets up the interaction and Playwright verifies the durable side effect. The play's `step('hydrated', ...)` gives the Playwright trace a stable anchor.

See `storybook-play-functions` for the canonical rule.

## Anti-patterns
- **Don't write a Playwright test without ASKING FIRST** — see `playwright-conventions`. The user owns the structural decisions per case.
- **Don't target the manager URL (`?path=/story/...`)** — use `iframe.html?id=...`. The manager wraps the story in chrome that breaks isolation.
- **Don't mock IDB** — Playwright runs against real browser IndexedDB. Use `page.evaluate` to read; use `page.addInitScript` to seed (see `playwright-conventions`).
- **Don't assert with point-in-time queries inside `expect()`** — `expect(await locator.isVisible()).toBe(true)` doesn't retry. Use `await expect(locator).toBeVisible()`.
- **Don't insert `page.waitForTimeout(...)`** — fix the locator/assertion. Web-first assertions retry until passing or timeout.
- **Don't move story tests into `__tests__/`** — keep them in `apps/web/tests/storybook/` (or co-located if your config supports it). The project's `testMatch` regex is the contract.
- **Don't rely on a story's `title` or export name implicitly** — pin the story ID as a constant at the top of the spec; renaming the story changes the URL, which the test must catch.
- **Don't write a story-level test for something better expressed as a unit test** — pure Zod parses and reducer logic go in `bun-test`. Faster.

## Triggers on
story test, playwright story, storybook url test, story-level test, mount story
