---
name: playwright-app-tests
description: "Playwright end-to-end tests pointed at the running mind-palace app — route workflows under `apps/web/tests/app/`, real IDB hydration via `page.evaluate`, BroadcastChannel cross-tab verification, IDB-seeded fixtures (no mocks). Triggers on: playwright app test, e2e workflow, app-level test, route workflow test, idb seeded test, idb assertion."
license: MIT
---

Sub-skill of `playwright`. Owns Playwright tests pointed at the **running app** (Vite dev or the static `bun run preview` server), not at Storybook. Verifies end-to-end route workflows: navigate, interact, assert visible state, assert real IDB content, observe BroadcastChannel sync. Anything that needs a real browser + real IndexedDB but is bigger than a single story belongs here.

## When to invoke
- Writing a Playwright spec that drives a real route in `apps/web/app/routes/...`.
- Asserting on a route's hydrated content (post-`use(idbHydrationPromise)` Suspense resolution).
- Verifying that a write from one tab triggers re-hydration in another (`BroadcastChannel`).
- Seeding IDB before navigation so the route under test sees pre-existing user state.
- Running an integration smoke that exercises a route end-to-end (open → interact → save → reload → still saved).

## Owns
Playwright end-to-end tests pointed at the built/preview app: route workflows, IDB-seeded fixtures, BroadcastChannel verification.

## Defers to
- `playwright` (parent) — version pin and routing.
- `playwright-conventions` — **the ASK-FIRST rule**, selector strategy, fixture patterns (fresh IDB, seeded IDB, throttled), reduced-motion config, the `playwright.config.ts` shape.
- `playwright-pwa-offline` — for any test that throttles network to offline. The offline contract is that sub-skill's surface; this one stays online (or merely throttled).
- `tanstack-router-routing` — for the route URLs and the routing contract this test workflow exercises. Param schemas live there (and in `zod`).
- `idb` — for the IDB schema + record shapes Playwright reads/writes against, and the root `idbHydrationPromise` the app awaits at startup.
- `bun-test` — for unit-testable logic that does NOT need a browser. The unit/E2E partition is hard.
- `storybook-stories` / `playwright-story-tests` — for any logic that's better verified at the component level. Build small first; reach for app-level only when the workflow needs multiple components composed together.

## Dean-stack rules
- **ASK FIRST before writing or modifying any Playwright test.** Pillar 4 manifestation; canonical detail in `playwright-conventions`. Surface the structural choices (which route, what to assert, IDB seed, network state, reduced-motion) and wait for the user's answer.
- Pillar 3 (IDB-first state) means: app tests verify the iPad-over-LAN scenario — interact, reload, the route resolves from IDB, progress survives. Lose this and the kid loses progress on a hot reload.
- Pillar 4 (CLI-gate-first) means: a failing app test fails `bun run check`. App-level tests are **CI-only** — the pre-push hook runs `bun run check:fast` which restricts Playwright to `--project=storybook` (`vite preview` against `dist/` would re-validate yesterday's bytes locally; not meaningful). Never `test.skip` to make CI green; fix the workflow or the wiring.
- Web-first assertions only — `await expect(locator).toBe…()`. No point-in-time queries inside `expect()`.
- Reduced motion is forced on at the project level (see `playwright-conventions`); animations don't add flake.
- IDB is **never** mocked. Use real browser IndexedDB; seed via `page.addInitScript`; read via `page.evaluate`.
- App tests run against `bun run preview` (the static prerender artifact GH Pages serves), not `bun run dev`, in CI. Inner-loop debugging may use dev.

## Patterns

**ASK FIRST before writing or modifying any Playwright test in this sub-skill** — see `playwright-conventions` for the canonical rule. Surface the structural decisions (which route(s), what to assert, IDB seed, network state, reduced-motion); wait for the user's answer before writing.

### Project pinned to the app
```ts
// apps/web/playwright.config.ts (excerpt) — see playwright-conventions for the full shape
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  projects: [
    {
      name: "app",
      testMatch: /.*\.app\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
        reducedMotion: "reduce", // see `animejs` and `playwright-conventions`
      },
    },
    // …also: storybook (see `playwright-story-tests`), app-offline (see `playwright-pwa-offline`)
  ],
  webServer: [
    {
      command: "bun run preview", // serve the prerendered + bundled output
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```
App tests run against `bun run preview` (the static prerender output served locally). For development inner-loop feedback, point `webServer.command` at `bun run dev` instead — but CI should use `preview` so the test exercises the same artifact GitHub Pages serves.

### Minimal route-workflow test
```ts
// apps/web/tests/maze-level.app.spec.ts
// pinned: @playwright/test ^1.59
import { expect, test } from "@playwright/test";

test("a kid can complete maze level 1 and progress is saved", async ({ page }) => {
  await page.goto("/games/maze/1"); // see `tanstack-router-routing`

  // Wait on hydration via a role-based locator (see `playwright-conventions`).
  await expect(page.getByRole("heading", { name: /level 1/i })).toBeVisible();

  await page.getByRole("button", { name: /complete/i }).click();
  await expect(page.getByText(/saved/i)).toBeVisible();

  // Reload — the route resolves from IDB (see `idb`); progress survives.
  await page.reload();
  await expect(page.getByText(/level 1.*completed/i)).toBeVisible();
});
```
The reload-and-verify-progress is the iPad-over-LAN smoke per AGENTS.md Pillar 3 (IDB-first state) — losing progress on a hot reload is the primary failure mode this skill exists to catch.

### Asserting on real IDB content
```ts
// apps/web/tests/save-and-read-idb.app.spec.ts
test("save writes a row to the progress object store", async ({ page }) => {
  await page.goto("/games/maze/1");
  await page.getByRole("button", { name: /complete/i }).click();
  await expect(page.getByText(/saved/i)).toBeVisible();

  // Real IDB read — no mocks. See `idb` for the schema.
  const rows = await page.evaluate(async () => {
    const open = indexedDB.open("mind-palace");
    return await new Promise<unknown[]>((resolve, reject) => {
      open.onsuccess = () => {
        const tx = open.result.transaction("progress", "readonly");
        const req = tx.objectStore("progress").getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      };
      open.onerror = () => reject(open.error);
    });
  });

  expect(rows).toContainEqual({ id: "maze-1", level: 1, completed: true });
});
```
`page.evaluate` runs in the browser context — the assertion sees the same `indexedDB` the app writes to. Never reach for an `idb` import in the spec; the spec runs in Node, IDB is a browser API.

### Seeded-IDB fixture (canonical pattern lives in `playwright-conventions`)
```ts
// apps/web/tests/with-seeded-idb.app.spec.ts
import { expect, test as base } from "@playwright/test";

const test = base.extend<{ seededPage: typeof base extends never ? never : Awaited<ReturnType<typeof base["page"]["fixture"]>> }>({
  // Note the parameter name is `runFixture`, NOT Playwright's docs-default
  // `use` — see `playwright-conventions/SKILL.md` for the rationale.
  seededPage: async ({ page }, runFixture) => {
    // addInitScript runs BEFORE the page's own scripts — perfect for seeding IDB
    // before the app awaits idbHydrationPromise at the root <Suspense>.
    await page.addInitScript(() => {
      const open = indexedDB.open("mind-palace", 2);
      open.onupgradeneeded = () => {
        open.result.createObjectStore("progress", { keyPath: "id" });
        open.result.createObjectStore("settings", { keyPath: "id" });
      };
      open.onsuccess = () => {
        const tx = open.result.transaction(["progress"], "readwrite");
        tx.objectStore("progress").put({ id: "maze-1", level: 1, completed: true });
      };
    });
    await runFixture(page);
  },
});

test("a previously-completed level shows its completed state on first paint", async ({ seededPage: page }) => {
  await page.goto("/games/maze/1");
  await expect(page.getByText(/level 1.*completed/i)).toBeVisible();
});
```
`page.addInitScript` executes before any page script — it lands the seeded IDB rows before the app's `idbHydrationPromise` resolves. See `playwright-conventions` for the canonical fixture file.

### BroadcastChannel — verify cross-tab re-hydration
```ts
test("a write in tab A re-hydrates tab B via BroadcastChannel", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await a.goto("/games/maze/1");
  await b.goto("/games/maze/1");

  await a.getByRole("button", { name: /complete/i }).click();
  await expect(a.getByText(/saved/i)).toBeVisible();

  // Tab B receives the BroadcastChannel message and re-hydrates the affected store.
  // Assertion is web-first and retries until the message is processed.
  await expect(b.getByText(/level 1.*completed/i)).toBeVisible();
});
```
`context.newPage()` shares a `BrowserContext` (and therefore the `BroadcastChannel`) across pages. See `idb` for the channel name (`mind-palace:idb`) and the message shape.

### Throttled-network test (still online)
```ts
test("interaction during slow network still saves to IDB", async ({ page, context }) => {
  // Slow but online — IDB writes are sync to the browser, so should still complete.
  await context.route("**/*", async (route) => {
    await new Promise((r) => setTimeout(r, 200));
    await route.continue();
  });
  await page.goto("/games/maze/1");
  await page.getByRole("button", { name: /complete/i }).click();
  await expect(page.getByText(/saved/i)).toBeVisible();
});
```
For full offline scenarios (SW + deep-link resolution), see `playwright-pwa-offline`.

### Run the workflow
```bash
bun run test:e2e -- --project=app                    # all app tests
bun run test:e2e -- --project=app --grep @smoke      # smoke only
bun run test:e2e -- --project=app maze-level         # filename filter
```

## Anti-patterns
- **Don't write a Playwright test without ASKING FIRST** — see `playwright-conventions`. The user owns the structural decisions per case.
- **Don't mock IDB** — Playwright drives a real browser with real IndexedDB. Seed with `page.addInitScript` (see `playwright-conventions`); read with `page.evaluate`.
- **Don't reach for an `idb` import in the spec** — the spec runs in Node. The browser is where IDB lives; use `page.evaluate`.
- **Don't insert `page.waitForTimeout(...)`** — fix the locator/assertion. Web-first assertions retry; fixed sleeps mask real flake.
- **Don't write an app-level test for behavior that's already covered by a story-level test** — story-level is faster and more focused. Reach for app-level when the workflow spans multiple components or routes.
- **Don't assert with point-in-time queries inside `expect()`** — `expect(await locator.isVisible()).toBe(true)` doesn't retry. Use `await expect(locator).toBeVisible()`.
- **Don't run app tests against `bun run dev` in CI** — use `bun run preview` so the artifact under test is the same one GitHub Pages serves. Dev-mode HMR can mask production bugs.
- **Don't hand-write IDB seed shapes** — derive seed objects from the same Zod schemas the app uses (see `idb` and `zod`). Hand-written seeds drift from the schema.

## Triggers on
playwright app test, e2e workflow, app-level test, route workflow test, idb seeded test, idb assertion
