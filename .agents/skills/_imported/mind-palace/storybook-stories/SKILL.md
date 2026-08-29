---
name: storybook-stories
description: "Authoring `*.stories.tsx` co-located with the component for mind-palace — CSF 3 `Meta` / `StoryObj`, typed `args` / `argTypes`, the \"no component without a story\" rule (Pillar 1), and the story-ID contract Playwright consumes by URL. Triggers on: story, stories.tsx, CSF 3, Meta, StoryObj, args, argTypes, story file, co-located story."
license: MIT
---

Sub-skill of `storybook`. Owns the `*.stories.tsx` file format itself: where it lives (next to the component, never in a parallel tree), what it exports (CSF 3 `Meta` default + named `StoryObj`s), how `args` / `argTypes` shape the controls panel, and how the story ID becomes the URL Playwright targets. **Pillar 1 — Storybook-first** is enforced here: a component file does not exist without a sibling story file, and the story is the assertion target a Playwright spec drives (see `playwright-story-tests`).

## When to invoke
- Adding a new component under `apps/web/app/components/<name>/` and authoring its `<name>.stories.tsx`.
- Renaming or moving a component — the story moves with it (co-location).
- Choosing the right `Meta`/`StoryObj` shape, default args, controls, parameters.
- Naming a story so the resulting story ID is stable and Playwright-targetable.
- Diagnosing "my new story doesn't appear in Storybook" (likely a glob mismatch — see `storybook-config`).

## Owns
Authoring `*.stories.tsx` co-located with the component, CSF 3 `Meta`/`StoryObj`, args/argTypes, and the rule "no component without a story".

## Defers to
- `storybook` (parent) — version pin and routing.
- `storybook-config` — for the discovery glob, framework setup, and global decorators that wrap every story.
- `storybook-play-functions` — for the `play` function inside a story (the in-iframe interaction surface).
- `playwright-story-tests` — for the external Playwright spec that mounts the story by URL and asserts on it. Story-ID contract:
  the story file's path + named export collapses into the slug Playwright targets.
- `react` (router) — for the component patterns (Compiler purity, React 19 primitives) used inside the component the story is for.
- `zod` — for the `z.object` schema that types the component props (per Pillar 2). The story's `args` shape comes from `z.infer<typeof PropsSchema>`.
- `tanstack-router-routing` + `storybook-config` — when a story needs route context (rare; pure components should not).
- `biome` — `*.stories.tsx` is linted by Biome like any other TSX. Story files are not exempt from `bun run check`.

## Dean-stack rules
- **Pillar 1 — Storybook-first** is enforced *here*: every component file has a sibling `*.stories.tsx`, and the story is the assertion target a Playwright spec drives (see `playwright-story-tests`). Story files are part of the test surface, not decoration.
- Pillar 2 (Zod-first types) means: the component's props are a `z.object` schema (see `zod`); the story's `args` are typed as `z.infer<typeof PropsSchema>`. Hand-written prop types in a story file are forbidden.
- Pillar 4 (CLI-gate-first) means: a broken story (missing default export, malformed `Meta`, type mismatch) fails `tsgo --noEmit` *and* the Playwright story-tests stage of `bun run check`.
- CSF 3 (`Meta<typeof Component>` + `StoryObj<typeof meta>`) is the canonical format. Don't mix CSF Factories in the same project — pick one.
- Co-location is non-negotiable: `Button.tsx` ships with `Button.stories.tsx` in the same directory. Never put stories in `__stories__/`, never under `app/routes/**`.
- Type imports come from `@storybook/react-vite` (the framework path), never `@storybook/react` (renderer path).

## Patterns

### Co-located component layout
```
apps/web/app/components/button/
├── index.tsx          # the component
├── schema.ts          # z.object props schema (see `zod`)
├── styles.css         # optional co-located CSS (see `tailwind`)
└── index.stories.tsx  # the story file
```
The `index.tsx` + `index.stories.tsx` pair is the unit of construction. Tests (Playwright story tests, plus optional `bun test` for any pure helper) live beside them.

### Minimal CSF 3 story file
```tsx
// apps/web/app/components/button/index.stories.tsx
// pinned: storybook ^10.x, @storybook/react-vite ^10.x
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./index";

const meta = {
  // The title controls the sidebar grouping AND the story ID slug Playwright targets.
  title: "Components/Button",
  component: Button,
  // `autodocs` for pure UI components; omit for route-level / page-level.
  tags: ["autodocs"],
  // Centered layout matches the global parameter; reaffirm here for clarity.
  parameters: { layout: "centered" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Each named export is a story. The slug is `kebab-cased(title) + "--" + kebab-cased(name)`.
// For the example above + `Primary`, the iframe URL is:
//   http://localhost:6006/iframe.html?id=components-button--primary
export const Primary: Story = {
  args: { label: "Click me", variant: "primary" },
};

export const Secondary: Story = {
  args: { label: "Click me", variant: "secondary" },
};

export const Disabled: Story = {
  args: { label: "Click me", variant: "primary", disabled: true },
};
```
The default export is `Meta<typeof Component>`. Each named export is a `StoryObj<typeof meta>`. The story ID Playwright consumes is deterministic: kebab-case the `title`, join with `--`, kebab-case the export name. **Pin the title and the export name** — changing them changes URLs and breaks Playwright story tests.

### Props schema → `args` typing
```tsx
// schema.ts
import * as z from "zod"; // see `zod`
export const ButtonProps = z.object({
  label: z.string().min(1),
  variant: z.enum(["primary", "secondary"]).default("primary"),
  disabled: z.boolean().default(false),
  onClick: z.function().args().returns(z.void()).optional(),
});

// index.tsx
import type { z } from "zod";
import type { ButtonProps as ButtonPropsSchema } from "./schema";
import { defineComponent } from "@/lib/define-component"; // see `zod`
type ButtonProps = z.infer<typeof ButtonPropsSchema>;
export const Button = defineComponent(ButtonPropsSchema, (p: ButtonProps) => /* ... */);

// index.stories.tsx (excerpt)
// `args` is typed as `Partial<ButtonProps>` automatically via `Meta<typeof Button>`.
// No hand-written prop type anywhere in the story file.
```
The component's prop type comes from `z.infer<typeof ButtonProps>` (see `zod` and the Pillar 2 rule). The story's `args` are inferred from `Meta<typeof Button>` — never declare `args: ButtonProps` by hand.

### `argTypes` — control configuration
```tsx
const meta = {
  title: "Components/Button",
  component: Button,
  argTypes: {
    variant: {
      control: { type: "radio" },
      options: ["primary", "secondary"],
    },
    onClick: { action: "clicked" }, // shows in the Actions panel without needing a play function
    disabled: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;
```
`argTypes` shapes the controls panel. Use `control: { type: "radio" }` for finite enums (mirrors the Zod enum); use `action: "name"` to log calls in the Actions panel without writing a play function. `argTypes` is also the place to add `description`s that flow into autodocs.

### Story IDs as the Playwright contract
```
Story file:           apps/web/app/components/button/index.stories.tsx
meta.title:           "Components/Button"
Named export:         Primary
→ Story ID:           components-button--primary
→ Iframe URL:         http://localhost:6006/iframe.html?id=components-button--primary
```
Playwright story tests target this URL exactly (see `playwright-story-tests`). When a story is renamed, its URL changes and any Playwright spec referencing it must update. Treat `meta.title` and named-export names as **part of the test contract**.

### Composition via `args` + render
```tsx
export const InMenu: Story = {
  render: (args) => (
    <nav>
      <Button {...args} label="One" />
      <Button {...args} label="Two" />
    </nav>
  ),
  args: { variant: "secondary" },
};
```
Use `render` only when the story needs more than the default single-component render. Keep render bodies small — large compositions belong in their own component (with their own story).

### Decorators per story
```tsx
export const InsideCard: Story = {
  decorators: [
    (Story) => <div className="rounded-card bg-white p-4 shadow-md"><Story /></div>,
  ],
  args: { label: "Inside a card" },
};
```
Per-story decorators stack on top of the global decorators from `.storybook/preview.tsx` (see `storybook-config`). Use them sparingly — most framing should live in the component itself.

### Pillar 1 enforcement check
Before merging a new component, run through this checklist:
1. `index.tsx` exists.
2. `index.stories.tsx` exists in the same directory.
3. The default export is a `Meta<typeof Component>`.
4. At least one named `StoryObj<typeof meta>` is exported.
5. The story renders in `bun run storybook` without console errors.
6. A Playwright story test (see `playwright-story-tests`) targets the resulting story URL.

If 1 is true but any of 2–6 is false, the change is incomplete — Pillar 1 is not satisfied.

## Anti-patterns
- **Don't add a component without a sibling `*.stories.tsx`** — Pillar 1 violation. The story is the construction surface; build it first.
- **Don't write the story for a component that doesn't have a Playwright story test** — every story is exercised. See `playwright-story-tests` and ASK FIRST per the Pillar 4 rule before writing the test (see `playwright-conventions`).
- **Don't put stories in `__stories__/`, `apps/web/stories/`, or any parallel tree** — co-locate. The discovery glob (see `storybook-config`) walks `app/components/**`.
- **Don't import `Meta` / `StoryObj` from `@storybook/react`** — use `@storybook/react-vite`. The renderer-only path is wrong here.
- **Don't hand-write prop types in the story file** — `Meta<typeof Component>` infers them. Hand-written types drift from the schema (Pillar 2 violation).
- **Don't author `*.stories.mdx`** — keep the story-glob to `.ts`/`.tsx`. MDX is fine for one-off documentation pages but not the default.
- **Don't use CSF 2 (`storiesOf(...)`) or pre-CSF formats** — Storybook 10 is CSF 3. The `storiesOf` API is removed.
- **Don't change `meta.title` or a named export name without checking Playwright story tests** — both are part of the URL contract.
- **Don't make a story for a route-level component as the *primary* coverage** — build the inner pieces first. A route-level story exists only when the route itself is the unit of design.

## Triggers on
story, stories.tsx, CSF 3, Meta, StoryObj, args, argTypes, story file, co-located story
