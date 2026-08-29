---
name: playwright-conventions
description: "The shared conventions every Playwright spec in mind-palace obeys — the load-bearing ASK-FIRST rule (Pillar 4), selector strategy (`getByRole` > `getByTestId` > `getByText`), fixture patterns (fresh IDB, seeded IDB, offline, throttled), reduced-motion forced on, and the `playwright.config.ts` shape. Triggers on: playwright fixture, playwright selector, role selector, getByRole, test-id, fresh idb fixture, reduced motion playwright, ask first test."
license: MIT
---

Sub-skill of `playwright`. The **canonical home of the ASK-FIRST rule** plus every cross-cutting Playwright convention in mind-palace: selector preference order, fixture patterns (fresh IDB / seeded IDB / offline / throttled), reduced-motion forcing, the `playwright.config.ts` shape, and the unit-vs-E2E partition. The four other Playwright sub-skills defer here for these contracts.

## When to invoke
- The user asks "how do I structure this Playwright test" — start by surfacing the ASK-FIRST rule.
- Authoring or editing `apps/web/playwright.config.ts`.
- Creating a fixture (fresh IDB, seeded IDB, offline, throttled, reduced-motion override).
- Choosing a selector for an assertion.
- Routing between `bun test` (unit) and Playwright (browser) — answering "can this be tested without a browser?"

## Owns
Selectors (role-based first, then test-id, then text), fixtures, fresh-IDB-per-test, reduced-motion forcing, retry policy, and the load-bearing **ASK-FIRST** prompt rule for every test design decision.

## Defers to
- `playwright` (parent) — version pin and routing.
- `playwright-story-tests` — the spec-authoring patterns for story-level tests.
- `playwright-app-tests` — the spec-authoring patterns for app-level tests.
- `playwright-pwa-offline` — the offline-deep-link contract this skill's offline fixture supports.
- `bun-test` — for **anything that does not need a real browser**. The unit-vs-E2E partition is hard: pure logic, schema parses, atom reducers, IDB migration transform functions all belong in `bun test`. `bun test` does NOT require ASK-FIRST — go ahead and write the unit test directly. ASK-FIRST is Playwright-only.
- `idb` — for the IDB schema + record shapes the seeded-IDB fixture writes against; for the hydration contract the fresh-IDB fixture resets.
- `animejs` — for why reduced-motion is forced on (animations add flake; the `useAnime` hook short-circuits when `reducedMotion: 'reduce'`).
- `tanstack-router-routing` — for route URLs the app-level fixtures navigate to.

## Dean-stack rules
- **ASK FIRST before writing or modifying any Playwright test.** This is a Pillar 4 (CLI-gate-first) manifestation — the structural choices for every Playwright test belong to the user, not the assistant. The choices include: which level (story-level vs app-level vs offline), what to assert (visible text, ARIA state, screenshot, IDB contents, network calls), which selector strategy, what to seed in IDB, what network state to use (online, throttled, offline), whether to force reduced motion. Surface these options as a short numbered list, wait for the user's answer, **then** write the test. Re-prompt for each new test or substantive modification.
- Pillar 1 (Storybook-first) means: every Storybook story has a Playwright story test (see `playwright-story-tests`). Stories are the test surface, not just visual references.
- Pillar 4 (CLI-gate-first) means: Playwright is the final stage of `bun run check` — `biome ci → stylelint → tsgo --noEmit → bun test → build → playwright (storybook + app + app-offline)`. The pre-push hook runs the lighter `bun run check:fast`, which restricts Playwright to `--project=storybook` (the only project that can run HEAD-validly without a fresh `dist/`). The `app` and `app-offline` projects are CI-gated. A failing Playwright run is a red gate in either flavour. Never disable, never `test.skip` to make CI green.
- Locator-first, web-first assertions only. `await expect(locator).toBe…()`. No point-in-time queries inside `expect()`.
- Reduced motion is **forced on** in every project (`use: { reducedMotion: 'reduce' }`) so animations don't add flake. The `useAnime` hook (see `animejs`) short-circuits when reduced motion is set; tests stay deterministic.
- IDB is **never mocked** — use real browser IndexedDB. Seed with `page.addInitScript`; read with `page.evaluate`. See `idb` for the schema.
- Fresh IDB per test by default — `page.context().clearCookies()` + IDB delete in a fixture, otherwise tests poison each other.

## Patterns

### The ASK-FIRST rule — what to actually do
When the user asks for a Playwright test, **before writing any code**, respond with something like:

> Before I write this Playwright test, I need to confirm a few structural choices that you own per case. Could you tell me:
> 1. Story-level (Storybook URL) or app-level (running app)? Or offline (PWA-deep-link contract)?
> 2. What is the canonical assertion — visible text, ARIA state, screenshot, IDB contents, network calls?
> 3. Selector strategy — role-based first (`getByRole`)? Or do you want a test-id?
> 4. IDB state at test start — fresh, or seeded with what?
> 5. Network state — online, throttled, or offline?
> 6. Reduced motion — forced on (default) or do you need a no-preference variant?

Tailor the list to what the user is actually asking — drop questions whose answers are obvious, add ones the specific scenario raises. Wait for the user's answer; **then** write the test. Re-prompt for each new test or substantive modification.

The rule lives here; the Playwright router (`playwright`) surfaces it on every Playwright prompt; each Playwright sub-skill's Patterns section opens with a one-liner pointing at this rule. **Do NOT invoke this rule for `bun test` unit tests** — those go ahead.

### `playwright.config.ts` — the canonical shape
```ts
// apps/web/playwright.config.ts
// pinned: @playwright/test ^1.59
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    trace: "on-first-retry", // 'retain-on-failure-and-retries' (1.59+) when hunting flake
    screenshot: "only-on-failure",
    reducedMotion: "reduce", // default-on; per-project / per-test override OK
    testIdAttribute: "data-test", // pick one and stick with it
  },

  projects: [
    {
      name: "storybook",
      testMatch: /.*\.story\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:6006" },
    },
    {
      name: "app",
      testMatch: /.*\.app\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3000" },
    },
    {
      name: "app-offline",
      testMatch: /.*\.offline\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:3000" },
    },
  ],

  webServer: [
    // Storybook gets a longer `timeout` because Vite cold-prebundles deps on first
    // start after a `bun install`; parallel test workers can otherwise race the
    // prebundler and get ERR_CONNECTION_REFUSED on the first run after a dep change.
    { command: "bun run storybook", url: "http://localhost:6006", reuseExistingServer: !process.env.CI, timeout: 180_000 },
    { command: "bun run preview",   url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
});
```
Three projects, three URL conventions, three test-name suffixes (`*.story.spec.ts`, `*.app.spec.ts`, `*.offline.spec.ts`). One config; the projects route specs by `testMatch`. Reduced motion is on at the `use` level — overridable per project / per test if a story explicitly tests motion.

### Selector preference order
```ts
// 1. getByRole — interactive elements with an accessible name
await page.getByRole("button", { name: /save/i }).click();
await page.getByRole("heading", { name: /level 1/i });

// 2. getByLabel — form fields tied to a <label>
await page.getByLabel(/email/i).fill("kid@example.com");

// 3. getByPlaceholder — when there's no label
await page.getByPlaceholder(/search/i).fill("maze");

// 4. getByText — assertions on static, visible text
await expect(page.getByText(/saved/i)).toBeVisible();

// 5. getByTestId — when semantics genuinely don't fit
await page.getByTestId("level-progress-bar");

// 6. CSS — last resort, scoped to a parent locator
await page.getByRole("listitem").filter({ hasText: /maze/i }).locator("button.icon-only");

// XPath — only for legacy DOM you can't change. Almost never needed in mind-palace.
```
Role-based first, every time. `getByRole` doubles as accessibility coverage — if your selector finds the element, a screen reader will too. Pepper test-ids (`data-test="..."`) only when the element genuinely has no accessible role/label.

### Fixture: fresh IDB per test
```ts
// apps/web/tests/fixtures.ts
// pinned: @playwright/test ^1.59
import { test as base, expect } from "@playwright/test";

type Fixtures = {
  freshIDB: void;
  seededIDB: (seed: () => Promise<void>) => Promise<void>;
};

// IMPORTANT — name the second callback parameter `runFixture`, NOT
// Playwright's docs-default `use`. `use` is a React 19 hook identifier
// and triggers `react-hooks/rules-of-hooks` (react-doctor 0.1.3+ added
// this rule). Playwright accepts any identifier; only position matters.
export const test = base.extend<Fixtures>({
  freshIDB: [
    async ({ page }, runFixture) => {
      // Wipe IDB (and storage) before the test runs.
      await page.addInitScript(async () => {
        const dbs = (await indexedDB.databases?.()) ?? [];
        await Promise.all(dbs.map((d) => d.name && indexedDB.deleteDatabase(d.name)));
      });
      await runFixture();
    },
    { auto: true },
  ],

  // Seeded IDB — pass a seed callback that runs in the page context.
  seededIDB: async ({ page }, runFixture) => {
    const seed = async (writer: () => Promise<void>) => {
      // The seed callback is serialized into addInitScript; it sees the real `indexedDB`.
      await page.addInitScript(`(async () => { (${writer.toString()})(); })();`);
    };
    await runFixture(seed);
  },
});

export { expect };
```
`auto: true` means every test gets fresh IDB by default. Override per test by importing the seeded fixture instead. The seed runs *before any page script* — perfect for landing rows before the app's `idbHydrationPromise` resolves. See `idb` for the schema and `playwright-app-tests` for usage.

### Fixture: offline (after SW install)
The offline fixture is canonical to the PWA-offline contract — see `playwright-pwa-offline` for the full pattern. The skeleton:
```ts
// apps/web/tests/fixtures-offline.ts
import { test as base } from "./fixtures";

export const test = base.extend({
  offlineAfterInstall: async ({ page, context }, runFixture) => {
    // 1. Online to install SW.
    await page.goto("/");
    await page.waitForFunction(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active?.state === "activated";
    });
    // 2. Toggle offline. Belt + braces below.
    await context.setOffline(true);
    await page.route("**/*", async (route) => {
      const sameOrigin = new URL(route.request().url()).origin === new URL(page.url()).origin;
      if (sameOrigin) await route.continue();
      else await route.abort();
    });
    await runFixture();
  },
});
```

### Fixture: throttled network
```ts
import { test as base } from "./fixtures";

export const test = base.extend({
  throttled: [
    async ({ context }, runFixture) => {
      await context.route("**/*", async (route) => {
        await new Promise((r) => setTimeout(r, 200));
        await route.continue();
      });
      await runFixture();
    },
    { auto: false },
  ],
});
```
For "still online but slow" — verifies the app stays usable while network is degraded. **Not** offline — see `playwright-pwa-offline` for that.

### Web-first assertions — the only kind
```ts
// CORRECT — auto-retries until visible or timeout
await expect(page.getByRole("heading", { name: /level 1/i })).toBeVisible();
await expect(page.getByRole("button", { name: /save/i })).toBeEnabled();
await expect(page).toHaveURL(/games\/maze\/1/);

// WRONG — point-in-time, doesn't retry, hides flake
expect(await page.getByRole("button").isVisible()).toBe(true);
expect(await page.title()).toBe("mind-palace");

// WRONG — fixed sleep
await page.waitForTimeout(500);
```

### Tracing for flake
```ts
// Default: trace on first retry — cheap in green runs.
trace: "on-first-retry",

// When hunting a specific flake: 1.59+ flag that keeps the failing AND the passing-retry trace.
trace: "retain-on-failure-and-retries",

// Open a saved trace:
//   bunx playwright show-trace test-results/.../trace.zip
```

### Per-test reduced-motion override
```ts
test.use({ reducedMotion: "no-preference" });

test("the celebration animation plays after completion", async ({ page }) => {
  await page.goto("/games/maze/1");
  await page.getByRole("button", { name: /complete/i }).click();
  // Now anime.js runs at full speed; assert on a post-animation state.
  await expect(page.locator("[data-test='celebration']")).toHaveAttribute("data-played", "true");
});
```
The default is `reduce` (deterministic, fast). Opt out for the rare test where the animation IS the assertion. See `animejs` for the `useAnime` hook's reduced-motion short-circuit.

### Unit-vs-E2E partition (defer to `bun-test`)
Before writing a Playwright test, ask: "does this need a browser?" If the answer is "no" — pure functions, Zod schema edge cases, atom reducers, IDB migration transform functions, parsers, derived selectors — write a `bun test` instead. See `bun-test`. Faster inner-loop feedback; same gate. **`bun test` does NOT require ASK-FIRST.** ASK-FIRST is Playwright-only.

If the answer is "yes" — DOM, real IDB, real SW, real network — surface the ASK-FIRST prompt before writing the Playwright test.

## Anti-patterns
- **Don't write a Playwright test without surfacing the ASK-FIRST prompt** — the user owns the structural choices per case. Skipping the prompt calcifies a design choice the user wanted to make.
- **Don't surface the ASK-FIRST prompt for a `bun test` unit test** — the rule is Playwright-only. Unit tests go ahead.
- **Don't pick a CSS selector when a role-based selector would work** — `getByRole` doubles as accessibility coverage. Reach for CSS only when the DOM has no semantics to grab onto.
- **Don't assume `prefers-reduced-motion` defaults** — force it explicitly via `use: { reducedMotion: 'reduce' }`. Omitting it lets the browser's default leak into the test, and animations add flake (see `animejs`).
- **Don't mock IDB** — use real browser IndexedDB. Seed via `page.addInitScript`; read via `page.evaluate`.
- **Don't carry IDB state across tests** — the default fixture wipes IDB. Tests must be independent, or parallel runs poison each other.
- **Don't insert `page.waitForTimeout(...)`** — fix the locator/assertion. Web-first assertions retry until passing or timeout.
- **Don't wrap point-in-time methods inside `expect()`** — `expect(await locator.isVisible()).toBe(true)` doesn't retry. Use `await expect(locator).toBeVisible()`.
- **Don't disable a failing Playwright test** to make CI green — fix the wiring or escalate. The gate is zero-warning.
- **Don't use Cypress, Puppeteer, Selenium, or Vitest browser mode** — Playwright is the only browser-tier runner in this stack; `bun test` is the only unit runner.

## Triggers on
playwright fixture, playwright selector, role selector, getByRole, test-id, fresh idb fixture, reduced motion playwright, ask first test
