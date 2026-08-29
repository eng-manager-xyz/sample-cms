---
name: playwright-pwa-offline
description: "The load-bearing offline-deep-link Playwright contract for mind-palace — install the Workbox SW, go offline with `context.setOffline(true)`, deep-link to a route the prerender did NOT emit, assert the router resolves it from cache without a server round-trip. Triggers on: offline test, pwa offline test, deep link offline test, network offline, service worker test, navigation fallback test."
license: MIT
---

Sub-skill of `playwright`. Owns the **single most important integration test** in mind-palace: the offline-deep-link contract from AGENTS.md (Pillar 4 + the PWA architecture decision). The contract: a previously-installed Workbox service worker hands back the prerendered SPA shell from cache, the bundled JS boots TanStack Router, the router resolves an arbitrary deep URL client-side, and atoms read from IDB — all with `context.setOffline(true)`. Lose this and the iPad-on-the-train scenario breaks.

## When to invoke
- Writing the offline-deep-link Playwright spec.
- Diagnosing "the offline test fails on a fresh browser" (the SW isn't installed yet — first visit must go online to install).
- Wiring `context.setOffline(true)` plus `page.route()` to make the test airtight.
- Verifying the navigation-fallback contract from `tanstack-router-pwa-deep-links` end-to-end.
- Adding a new offline scenario (a different deep route, a route the prerender skipped).

## Owns
The offline-deep-link contract: throttle network to offline, navigate to `/some/deep/route`, assert the router resolves it from cache without a server round-trip.

## Defers to
- `playwright` (parent) — version pin and routing.
- `playwright-conventions` — **the ASK-FIRST rule**, selector strategy, fixture patterns, reduced-motion config, the `playwright.config.ts` shape.
- `tanstack-router-pwa-deep-links` — for *what the contract is*: the navigation fallback points at the prerendered shell, the router resolves the URL client-side. This sub-skill verifies; that one defines.
- `tanstack-start-spa-prerender` — for the prerendered shell that the SW caches.
- `nitro` — for the static output (the `github_pages` preset's `404.html` fallback).
- `idb` — for the IDB content the route reads after hydration. Atoms read from IDB; nothing fetches over the network.
- `playwright-app-tests` — for the online sibling tests (route workflows that don't toggle offline).

## Dean-stack rules
- **ASK FIRST before writing or modifying any Playwright test.** Pillar 4 manifestation; canonical detail in `playwright-conventions`. The offline test has more dials than most (when to install the SW, what to seed in IDB, which routes to verify) — surface the choices and wait for the user's answer.
- Pillar 3 (IDB-first state) + Pillar 4 (CLI-gate-first) together mean: this test is load-bearing. The offline-deep-link contract from AGENTS.md (Workbox + prerendered shell + IDB hydration + client-side routing) is verified end-to-end here. The `app-offline` Playwright project runs in the full `bun run check` (CI), but **NOT** in the pre-push `bun run check:fast` — it needs a fresh `dist/` from `bun run build` to be meaningful, so it's CI-gated by design. A red here means a Workbox or routing change broke the fallback; fix the wiring, not the test.
- The service worker NEVER touches IDB — assets only. IDB is application code (see `idb`).
- The fallback always points at the canonical prerendered shell (see `tanstack-router-pwa-deep-links`), never at per-route HTML.
- The offline test runs against `bun run preview` — Vite dev does NOT register the production SW.
- Reduced motion is forced on at the project level (see `playwright-conventions`); animations don't add flake.
- Web-first assertions only; `context.setOffline(true)` is paired with a `page.route()` backstop so leaks fail loud.

## Patterns

**ASK FIRST before writing or modifying any Playwright test in this sub-skill** — see `playwright-conventions` for the canonical rule. The offline test has more dials than most (when to install the SW, what to seed in IDB, which routes to verify); surface the choices and wait for the user's answer before writing.

### Project pinned to the preview server
```ts
// apps/web/playwright.config.ts (excerpt) — see playwright-conventions for the full shape
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  projects: [
    {
      name: "app-offline",
      testMatch: /.*\.offline\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
        reducedMotion: "reduce",
      },
    },
    // …also: app, storybook
  ],
  webServer: [
    {
      // The OFFLINE test must run against the same artifact GH Pages serves.
      // `bun run preview` serves the static prerender + bundled JS + SW.
      command: "bun run preview",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```
The offline test cannot run against `bun run dev` — Vite's dev server doesn't register the production SW. Always `bun run preview`.

### The canonical offline-deep-link spec
```ts
// apps/web/tests/maze-deep-link.offline.spec.ts
// pinned: @playwright/test ^1.59
import { expect, test } from "@playwright/test";

test("a previously-visited app resolves a deep URL while offline", async ({ page, context }) => {
  // 1. Online first visit — installs the Workbox SW; precaches the shell.
  await page.goto("/");
  // Wait until the SW is registered and active. `context.serviceWorkers()`
  // returns the array once registration completes.
  await page.waitForFunction(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state === "activated";
  });

  // 2. Optional: seed IDB so the offline route renders meaningful content.
  // (See playwright-conventions for the canonical fixture pattern.)
  await page.evaluate(async () => {
    const open = indexedDB.open("mind-palace");
    await new Promise((res, rej) => {
      open.onsuccess = () => {
        const tx = open.result.transaction("progress", "readwrite");
        tx.objectStore("progress").put({ id: "maze-1", level: 1, completed: true });
        tx.oncomplete = () => res(undefined);
        tx.onerror = () => rej(tx.error);
      };
      open.onerror = () => rej(open.error);
    });
  });

  // 3. Go offline. From here, every network request must be served from cache OR fail.
  await context.setOffline(true);

  // 4. Belt and braces — block any remaining requests so a leak fails LOUD.
  await page.route("**/*", async (route) => {
    // Allow same-origin requests that the SW will fulfill from cache; abort the rest.
    const url = new URL(route.request().url());
    if (url.origin !== new URL(page.url()).origin) {
      await route.abort();
    } else {
      await route.continue();
    }
  });

  // 5. Hard navigation to a deep URL the prerender did NOT emit a per-route HTML for.
  await page.goto("/games/maze/1");

  // 6. Assert the route rendered — proves SW returned the shell + router resolved client-side.
  await expect(page.getByRole("heading", { name: /level 1/i })).toBeVisible();
  await expect(page.getByText(/level 1.*completed/i)).toBeVisible(); // from seeded IDB
});
```
Six load-bearing steps: install SW → seed IDB → toggle offline → belt-and-braces network blocker → deep-link → assert. Removing any of them breaks the contract.

### Why both `setOffline(true)` AND `page.route()`?
`context.setOffline(true)` simulates a fully offline network — the browser doesn't issue requests to the OS. But edge cases (subresource hints, beacon-style sends, plugin-injected requests) can sometimes leak. `page.route('**/*', ...)` is the airtight backstop: any request that escapes goes through the route handler, which `abort`s anything cross-origin and lets same-origin pass to the SW. If a route fails offline because of a request that should have been cached, you'll see it in the trace as an `aborted` request — easier to diagnose than "the page is white."

### Verifying the SW returned the shell (not a 404)
```ts
// Inside the offline test, before `page.goto`, hook the navigation response:
const navPromise = page.waitForResponse((r) => r.url() === "http://localhost:3000/games/maze/1");
await page.goto("/games/maze/1");
const nav = await navPromise;
// The SW serves the precached shell (status 200, content-type text/html).
expect(nav.status()).toBe(200);
expect(nav.headers()["content-type"]).toContain("text/html");
```
Useful when debugging "did the SW even handle this navigation?" Once the test is stable, the visible-content assertion (`expect(...).toBeVisible()`) is enough.

### Service-worker installation timing
```ts
// More robust SW-readiness wait — handles the "registered but still installing" state.
await page.waitForFunction(
  async () => {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    if (reg.active?.state === "activated") return true;
    // Force-skip waiting if a new SW is installed but waiting (Workbox autoUpdate normally handles this).
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    return false;
  },
  null,
  { timeout: 10_000 },
);
```
Use this when the test runs on a slow CI runner — the SW lifecycle can take a few seconds.

### A second-load offline scenario
```ts
test("hard reload while offline still resolves the deep URL", async ({ page, context }) => {
  // Install + seed (as above), then:
  await context.setOffline(true);
  await page.goto("/games/maze/1");
  await expect(page.getByRole("heading", { name: /level 1/i })).toBeVisible();

  // Hard reload — bypass any in-memory state, force a fresh navigation through the SW.
  await page.reload();
  await expect(page.getByRole("heading", { name: /level 1/i })).toBeVisible();
});
```
The reload-while-offline is the iPad-asleep-overnight scenario from AGENTS.md. If this passes, the Pillar 3 + PWA architecture decision is genuinely working.

### Run the workflow
```bash
bun run test:e2e -- --project=app-offline             # all offline tests
bun run test:e2e -- --project=app-offline maze-deep   # filename filter
```

## Anti-patterns
- **Don't write a Playwright test without ASKING FIRST** — see `playwright-conventions`. The user owns the structural decisions per case.
- **Don't run the offline test against `bun run dev`** — Vite dev doesn't register the production SW. Always `bun run preview`.
- **Don't toggle offline before the SW is installed** — the first visit must go online so Workbox can precache the shell. Test the SW lifecycle, then go offline.
- **Don't use ONLY `context.setOffline(true)`** — pair it with a `page.route('**/*', ...)` backstop so leaks fail loud, not silent.
- **Don't pick a route the prerender DID emit** — that's a weaker test (the SW might fall back to the per-route HTML, not exercise the navigation fallback). Pick a deep route the SW must answer with the shell.
- **Don't precache per-route data** — see `tanstack-router-pwa-deep-links` and `idb`. The SW handles assets; user state lives in IDB.
- **Don't put IDB reads inside the SW** — the SW context can't see the app's atoms. Application code reads IDB.
- **Don't disable this test to make CI green** — the offline contract is load-bearing. A red here means a Workbox or routing change broke the fallback; fix the wiring.
- **Don't insert `page.waitForTimeout(...)` to "wait for the SW"** — use `waitForFunction` against `navigator.serviceWorker.getRegistration()`.

## Triggers on
offline test, pwa offline test, deep link offline test, network offline, service worker test, navigation fallback test
