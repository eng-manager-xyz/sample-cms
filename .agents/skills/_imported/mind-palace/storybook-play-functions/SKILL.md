---
name: storybook-play-functions
description: "Storybook `play` functions in mind-palace — interaction tests authored INSIDE the story using `@storybook/test` (`expect`, `userEvent`, `within`), executed inside Storybook's iframe at story render. Distinct from external Playwright story tests. Triggers on: play function, @storybook/test, userEvent, interaction test, story interaction, play step."
license: MIT
---

Sub-skill of `storybook`. Owns the `play` function field on `StoryObj` — the interactions that run **inside** Storybook's iframe at story render time, using `@storybook/test`'s `expect`, `userEvent`, and `within` (or the destructured `canvas` / `userEvent` / `step` from the play context). Plays are different from Playwright story tests: a play runs *as part of the story* (and is what an external Playwright test typically *exercises*); a Playwright story test runs *outside the iframe* and asserts on whatever the play produced.

## When to invoke
- Adding interaction(s) to a `*.stories.tsx` (typing, clicking, hovering, asserting on visible state).
- Asserting that an `args.onSomething` callback was called (via `fn()` from `@storybook/test`).
- Grouping interactions into named steps (`step('...', async () => {...})`).
- Choosing between an in-story play function and an external Playwright story test (see the decision section).
- Diagnosing a play function that passes interactively but fails when Playwright drives the same URL.

## Owns
`play` functions, `@storybook/test` (`userEvent`, `expect`), interaction testing inside the story — the surface Playwright drives.

## Defers to
- `storybook` (parent) — version pin and routing.
- `storybook-stories` — for the `Meta`/`StoryObj` shape the play function attaches to (`play` is a field on the `StoryObj`).
- `storybook-config` — for `@storybook/test` install + the global decorators that wrap the iframe.
- `playwright-story-tests` — the **decision** of "play function vs Playwright test" lives here; the canonical decision rule is at the bottom of this skill, but the Playwright sub-skill owns the external-spec authoring.
- `playwright-conventions` — for the ASK-FIRST rule that governs *any* Playwright test design (a play function does NOT require ASK-FIRST; only Playwright tests do).
- `react` (router) — for the component patterns the play function exercises.
- `idb` — when an interaction's outcome is "an IDB record was written"; the play can `await`, but **assertions on real IDB content** belong in Playwright (see decision).

## Dean-stack rules
- Pillar 1 (Storybook-first) means: a play function lives next to the component it exercises. The play is part of the story file and serves both interactive debugging and Playwright story tests.
- Pillar 4 (CLI-gate-first) means: a play function that throws causes the story to render in an error state — caught by Playwright story tests in the gate. A red play in dev (`bun run storybook`) is a failed contract; fix it before continuing.
- `@storybook/test` is the **only** allowed source of `userEvent` / `expect` / `within` inside a story. Never `@storybook/testing-library` (deprecated, removed in 8.x). Never `@testing-library/user-event` directly.
- Mock callbacks with `fn()` from `@storybook/test`, not bare `vi.fn()` / `jest.fn()`. The `fn()` mocks show up in the Interactions panel; raw `vi.fn()` does not.
- Plays run inside the Storybook iframe — they have access to the rendered DOM and can `await` realistic timers, but they do **not** have access to Playwright's network mocking, offline mode, or cross-page navigation.

## Patterns

### Minimal play function — assert on `args.onClick`
```tsx
// apps/web/app/components/button/index.stories.tsx (excerpt)
// pinned: storybook ^10.x, @storybook/test ^10.x
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "@storybook/test";
import { Button } from "./index";

const meta = {
  title: "Components/Button",
  component: Button,
  // `fn()` from @storybook/test produces a mock that shows in the Interactions panel.
  args: { onClick: fn() },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ClicksFire: Story = {
  args: { label: "Click me" },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /click me/i }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};
```
Use `within(canvasElement)` to scope queries to the rendered story (not to the entire iframe, which includes Storybook's chrome). `expect(args.onClick).toHaveBeenCalledOnce()` works because `args.onClick` is the `fn()` mock declared at the meta level.

### Step grouping — readable plays
```tsx
export const Submits: Story = {
  args: { onSubmit: fn() },
  play: async ({ args, canvasElement, step }) => {
    const canvas = within(canvasElement);
    await step("Fill credentials", async () => {
      await userEvent.type(canvas.getByLabelText(/email/i), "kid@example.com");
      await userEvent.type(canvas.getByLabelText(/password/i), "hunter2");
    });
    await step("Submit", async () => {
      await userEvent.click(canvas.getByRole("button", { name: /sign in/i }));
      await expect(args.onSubmit).toHaveBeenCalledTimes(1);
    });
  },
};
```
Steps appear as collapsible groups in the Interactions panel and in Playwright traces (when a Playwright story test drives the same URL). Use them to make multi-step flows scannable; one `step` per logical phase.

### Async waits — prefer `findBy*` over manual timeouts
```ts
play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: /save/i }));
  // findByRole auto-retries until visible OR timeout — no fixed sleep.
  await expect(await canvas.findByRole("status")).toHaveTextContent(/saved/i);
};
```
`findBy*` retries until the element is found or the test timeout expires. Never insert a fixed `setTimeout` / `waitForTimeout` — it hides real flake.

### Querying outside the canvas (portals, modals)
```ts
import { expect, screen, userEvent, within } from "@storybook/test";

play: async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await userEvent.click(canvas.getByRole("button", { name: /open dialog/i }));
  // The dialog renders to document.body via a portal — use `screen` to query it.
  await expect(screen.getByRole("dialog")).toBeVisible();
};
```
`screen` queries the entire document. Use for portals, toasts, tooltips that render outside the story's root.

### `fn()` for callbacks — never bare jest/vi mocks
```tsx
const meta = {
  args: {
    onSelect: fn(),  // CORRECT — appears in the Interactions panel
    // onSelect: vi.fn(),   // WRONG — invisible to the panel
    // onSelect: jest.fn(), // WRONG — invisible to the panel
  },
} satisfies Meta<typeof MyComponent>;
```

### Step → Playwright trace alignment
```ts
play: async ({ step, canvasElement }) => {
  await step("hydrated", async () => {
    const canvas = within(canvasElement);
    await canvas.findByRole("main"); // hydration completed; the rest is post-hydration
  });
};
```
Naming a `step` "hydrated" gives the external Playwright story test (see `playwright-story-tests`) a stable anchor in the trace — handy when an iPad-over-LAN flake report needs to know whether hydration completed before the next interaction.

### Decision — play function vs external Playwright story test
Use a **play function** when:
- The interaction logic is fully inside the story's DOM.
- The assertion is "callback was called," "visible state changed," or "ARIA state updated."
- You want the assertion to run interactively in `bun run storybook` for inner-loop feedback.

Use an **external Playwright story test** (see `playwright-story-tests`) when:
- The assertion needs **real IDB content** (`page.evaluate(() => indexedDB...)` to read records).
- The assertion needs **network mocking**, **offline mode**, **service-worker behavior** — none of which exist inside the iframe.
- The assertion needs cross-iframe / cross-page state.
- The story has a `play` and you want to *verify* its post-conditions externally (the play is the setup; Playwright is the assertion).

The two are not exclusive: a story can have a play (for in-iframe interactions and inner-loop feedback) **and** an external Playwright test (for IDB / network / offline assertions). When you'd write a Playwright test, **ASK FIRST** per Pillar 4 — the user owns the structural decisions for every Playwright test (see `playwright-conventions`). No ASK-FIRST is needed to add or modify a play function — it's part of the story.

### Install
```bash
bun add -D @storybook/test@^10
```
Pin to the same Storybook 10 majors as `@storybook/react-vite` (see `storybook-config`). Do **not** install `@storybook/testing-library` — removed in 8.x, gone in 10.

## Anti-patterns
- **Don't import from `@storybook/testing-library`** — deprecated, removed. Use `@storybook/test` for `userEvent`, `expect`, `within`, `screen`, `fn`.
- **Don't import `userEvent` from `@testing-library/user-event`** — use the re-export from `@storybook/test` so the Interactions panel sees the calls.
- **Don't use bare `vi.fn()` / `jest.fn()` for callback args** — use `fn()` from `@storybook/test`. Bare mocks don't show in the Interactions panel.
- **Don't insert `setTimeout` / `waitForTimeout` to "wait for state"** — use `findBy*` (auto-retry) or `await expect(locator).toBe…()` semantics. Fixed sleeps mask real flake.
- **Don't query the whole iframe with `document.querySelector`** — scope with `within(canvasElement)`. Querying outside the canvas hits Storybook's chrome and breaks isolation.
- **Don't put a Playwright `expect` inside a play function** — `@storybook/test`'s `expect` is the right one (it is jest-compatible and ships with Storybook). Playwright's web-first `expect` only works inside Playwright specs.
- **Don't reach for IDB assertions inside a play function** — assertions on `indexedDB` belong in Playwright (see `playwright-story-tests`). A play can trigger IDB writes; verifying them is Playwright's job.
- **Don't ask the user for permission to write a play function** — the ASK-FIRST rule is Playwright-only. Plays are part of the story authoring surface.
- **Don't write a play function that depends on network calls** — there's no network mocking inside the iframe. If the component needs network, mock at the `args` level or push the assertion to Playwright.

## Triggers on
play function, @storybook/test, userEvent, interaction test, story interaction, play step
