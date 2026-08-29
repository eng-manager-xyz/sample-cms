---
name: bun-test
description: "Bun 1.3.13 unit-test runner for mind-palace — pure-logic tests (atom reducers, IDB migration logic, Zod edge cases, parsers) using `bun:test` matchers, mocks, and snapshots. Anything that touches a real DOM or IndexedDB belongs in Playwright. Triggers on: bun test, bun:test, bun matcher, bun mock, bun snapshot, bun coverage, bun watch test, unit test."
license: MIT
---

Sub-skill of `bun`. Owns the unit-test layer that runs as the fourth stage of `bun run check`. The partition is hard: no DOM, no browser, no IndexedDB → `bun test`; otherwise → Playwright.

## When to invoke
- Writing tests for a pure function, a Zod schema edge case, an atom reducer, or an IDB migration's transform logic.
- Adding a `*.test.ts` file co-located with its source.
- Setting up coverage, watch mode, or sharding for the unit-test stage.

## Owns
`bun test` unit-test runner: matchers, mocks, snapshot, watch mode, coverage, and the partition rule "no DOM = bun test, DOM = playwright".

## Defers to
- `bun` (parent) — version pin and routing.
- `playwright-app-tests` (Wave 4, forward) — anything that needs a real browser, real IndexedDB, or a service worker.
- `playwright-story-tests` (Wave 4, forward) — anything that mounts a Storybook story.
- `zod` (Wave 2, forward) — for what a schema parse failure looks like (the test asserts on it; the schema itself lives in zod's surface).

## Dean-stack rules
- Pillar 4 (CLI-gate-first) means: `bun test` exits non-zero if any test fails, and runs ahead of Playwright in `bun run check`. Faster feedback first.
- Pillar 2 (Zod-first types) means: every schema-validating function gets a unit test for the *invalid-input* path, not just the happy path. `safeParse` returning `success: false` is testable here without a browser.
- Pillar 3 (IDB-first state) means: the *logic* of an IDB migration (the function that transforms an old record into a new one) is unit-tested here; the *integration* (real `openDB`, real upgrade) is Playwright.

## Patterns

### Co-located test files
```
apps/web/app/lib/
├── parse-score.ts
└── parse-score.test.ts
```
`bun test` discovers `*.test.ts` and `*.spec.ts` recursively. Match the source file 1:1 — never split into `__tests__/`.

### Schema-edge-case test
```ts
import { describe, expect, test } from "bun:test";
import { ScoreSchema } from "./parse-score";

describe("ScoreSchema", () => {
  test("rejects negative scores", () => {
    const result = ScoreSchema.safeParse({ value: -1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["value"]);
  });
});
```
The schema lives in the zod skill's surface; this test asserts on its `safeParse` shape. Use `error.issues` (Zod 4), not the v3 `.format()`.

### Atom reducer test
```ts
import { expect, test } from "bun:test";
import { reduceProgress } from "./progress-reducer";

test("reduceProgress increments level on completion", () => {
  const next = reduceProgress({ level: 1, completed: false }, { type: "complete" });
  expect(next).toEqual({ level: 2, completed: true });
});
```
Pure reducer, no Jotai store, no IDB — fits cleanly in `bun test`.

### IDB migration logic (the function, not the integration)
```ts
import { expect, test } from "bun:test";
import { migrateV1toV2 } from "./migrations";

test("v1 → v2 fills missing settings.theme", () => {
  const v1 = { id: "a", settings: {} };
  expect(migrateV1toV2(v1)).toEqual({ id: "a", settings: { theme: "light" } });
});
```
The real `upgrade` callback running against a real IDB is a Playwright test (forward to `playwright-app-tests`).

### Mocks and spies
```ts
import { expect, mock, spyOn, test } from "bun:test";

test("calls onSet once per change", () => {
  const onSet = mock(() => {});
  apply({ onSet });
  expect(onSet).toHaveBeenCalledTimes(1);
});
```
Use `mock()` for fresh fakes; use `spyOn(obj, "fn")` to wrap an existing method.

### CLI invocations
```bash
bun test                          # full run; used by `bun run check`
bun test apps/web/app/state       # path filter
bun test -t "rejects negative"    # name filter
bun test --watch                  # local inner loop
bun test --coverage               # CI report
```

## Anti-patterns
- **Don't reach for `happy-dom` or `jsdom`** — if a DOM is needed, the test belongs in Playwright (real browser), not a fake DOM.
- **Don't call `openDB` in a `bun test` file** — IDB integration is Playwright's job; here, test the migration *function*.
- **Don't use Jest/Vitest** — `bun:test` is the only unit runner in this stack and it ships with Bun.
- **Don't skip the unit test for things that *also* have a Playwright test** — inner-loop speed comes from `bun test`; both layers run in `bun run check`.
- **Don't ask permission to write a `bun test` test** — the ASK-FIRST rule is Playwright-only.

## Triggers on
bun test, bun:test, bun matcher, bun mock, bun snapshot, bun coverage, bun watch test, unit test
