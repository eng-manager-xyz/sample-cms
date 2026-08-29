---
name: storybook
description: "Router skill for Storybook with the Vite builder in mind-palace — pins the framework to `@storybook/react-vite`, enforces Pillar 1 at the routing level (no component without a story), and dispatches to the config, stories, or play-functions sub-skill. Triggers on: storybook, storybook overview, which storybook skill, storybook-first."
license: MIT
---

Entry point for any Storybook-shaped question in mind-palace. Storybook is the **construction surface** for every component (Pillar 1 — Storybook-first); a component file does not exist until a sibling `*.stories.tsx` exists. This skill exists to dispatch — it never answers patterns directly; the sub-skill carries the rules.

## When to invoke
- The user types `storybook` with no further specifier and you need to route them.
- The user asks "which Storybook skill," "Storybook overview," "how is Storybook wired in mind-palace," or "where do stories live."
- A question mixes config + story authoring (e.g. "I added a story but Tailwind classes don't apply") — pick the sub-skill whose rule decides the answer.
- A question about the testing surface that drives stories — defer to `playwright-story-tests` (the story is here; the test that drives it is there).
- A user says "no component without a story" or invokes the Storybook-first Pillar — confirm and dispatch to the sub-skill that addresses their specific concern.

## Owns
Entry point that routes Storybook questions to the config sub-skill, the stories-authoring sub-skill, or the play-functions sub-skill; enforces the Storybook-first Pillar at the routing level.

## Defers to
- `storybook-config` — anything about `.storybook/main.ts`, `.storybook/preview.tsx`, the **shared** Vite + Tailwind + alias config (never forked from the app), addons, `viteFinal`.
- `storybook-stories` — anything about `*.stories.tsx` co-location, CSF 3 `Meta`/`StoryObj`, `args` / `argTypes`, story IDs (the contract Playwright consumes).
- `storybook-play-functions` — `play` functions inside the story, `@storybook/test` (`expect`, `userEvent`, `within`), interaction testing that runs inside Storybook's iframe.
- `playwright-story-tests` — the external Playwright spec that mounts a story by URL and asserts on it. Stories live here; their test surface lives there.
- `tailwind` — for the `@tailwindcss/vite` plugin Storybook re-uses via the shared Vite config.
- `react` — for component patterns (Compiler purity + React 19 primitives) used inside story components.
- `biome` — for lint of `*.stories.tsx` and `.storybook/*.ts` (not Storybook-specific; same Biome gate as the rest of the repo).

## Dean-stack rules
- Pillar 1 (Storybook-first) means: every `*.tsx` component file in `apps/web/app/components/` ships with a sibling `*.stories.tsx`. No component exists without a story. Build the smallest piece in isolation in Storybook **before** composing it into a route.
- Pillar 4 (CLI-gate-first) means: a Storybook config error or a broken story breaks the Playwright story-tests stage of `bun run check`. Story files are linted by `biome` like any other TSX. The IDE is not the source of truth.
- Storybook 10 with the `@storybook/react-vite` framework only. Webpack 5, `@storybook/react`, `@storybook/nextjs` — wrong for this repo by definition.
- Storybook re-uses the app's Vite config (Tailwind, aliases, plugins) via `viteFinal`. **Never** fork the Tailwind config or the alias map into `.storybook/`.
- The TanStack Start integration is via `storybook-addon-tanstack-start` when a story needs route context; pure UI components do **not** need it (pass props instead).

## Routing
- **use `storybook-config` when** the question is about `.storybook/main.ts`, `.storybook/preview.tsx`, addons, `viteFinal`, the shared Vite/Tailwind/alias config, the story-glob pattern, the framework setting, or "Tailwind works in the app but not in Storybook."
- **use `storybook-stories` when** the question is about authoring a `*.stories.tsx`, CSF 3 `Meta` / `StoryObj`, `args` / `argTypes`, default exports, co-location with the component, the story ID contract Playwright consumes, or "where do I put this story."
- **use `storybook-play-functions` when** the question is about a `play` function inside the story, `@storybook/test` imports (`userEvent`, `expect`, `within`), interaction tests that run inside the Storybook iframe, step grouping (`step`), or "should this be a play function or a Playwright test."

### Routing table
| Question shape | Sub-skill |
|---|---|
| "Tailwind classes don't apply in my story" | `storybook-config` (shared Vite config not wired) |
| "How do I write a story for `<Button>`?" | `storybook-stories` |
| "Where does the story file go?" | `storybook-stories` (co-located) |
| "How do I assert that clicking the button calls `onClick`?" | `storybook-play-functions` (in-story) or `playwright-story-tests` (external) — see the play-functions skill for the decision |
| "Storybook can't resolve `@/components/...`" | `storybook-config` (alias not shared) |
| "I added an addon and Storybook won't boot" | `storybook-config` |
| "Should I drive this assertion from Playwright or a play function?" | `storybook-play-functions` (decision) |
| "How do I test a story from a Playwright spec?" | `playwright-story-tests` |
| "How do I write a component with Zod-typed props?" | `zod` (schema) + `react` (component shape); add the story per `storybook-stories` |

## Anti-patterns
- **Don't author a component without a sibling `*.stories.tsx`** — Pillar 1 violation. Build the story first; it's the construction surface, not a documentation afterthought.
- **Don't fork the Vite or Tailwind config in `.storybook/`** — see `storybook-config`. This is the canonical way to land "works in the app, broken in stories." Forks drift; the shared config is load-bearing.
- **Don't answer config / story / play-function questions inside this router** — route to the sub-skill so the answer carries the right rule.
- **Don't recommend `@storybook/test-runner`** for this repo — Playwright drives stories directly per AGENTS.md's Testing rule. See `playwright-story-tests`.
- **Don't recommend `@storybook/react-webpack5`, `@storybook/nextjs`, or `@storybook/nextjs-vite`** — wrong framework for this stack. Use `@storybook/react-vite` only.
- **Don't tell the user "stories are just visual references"** — every story is exercised by a Playwright test (see `playwright-story-tests`). They are the test surface.

## Triggers on
storybook, storybook overview, which storybook skill, storybook-first
