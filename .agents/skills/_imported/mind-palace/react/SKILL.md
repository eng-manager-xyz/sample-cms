---
name: react
description: "Router skill for React 19 + React Compiler in mind-palace — pins the React major and dispatches to the Compiler-rules sub-skill or the React-19-primitives sub-skill based on the question. Triggers on: react, react 19, react overview, which react skill."
license: MIT
---

Entry point for any React-shaped question in mind-palace. React 19 with the React Compiler enabled is the only allowed React mode for this repo; the framework half (TanStack Start) is owned by the `tanstack` router. This skill exists to dispatch — it never answers patterns directly; the sub-skill carries the rules.

## When to invoke
- The user types `react` with no further specifier and you need to route them.
- The user asks "which React skill," "React overview," or how React is set up for this repo.
- A question mixes Compiler purity + a 19 primitive (e.g. "should I `useMemo` around a `use(promise)` read?") — pick the sub-skill whose rule decides the answer.
- A question about a React idiom that is owned by another tech (atoms → `jotai`; routes → `tanstack-router-routing`; animations → `animejs`) — defer to the producer.

## Owns
Entry point that routes React questions to the Compiler-rules sub-skill or the React-19-primitives sub-skill, and pins React 19.

## Defers to
- `react-compiler-rules` — anything about purity, memoization (or the absence of it), `useMemo`/`useCallback`/`React.memo`, render-time side channels, the Compiler audit.
- `react-19-primitives` — anything about `use(promise)`, `useTransition`, `useDeferredValue`, `useOptimistic`, `useActionState`, `useFormStatus`, or `<Suspense>` API surface.
- `jotai` — atoms, `useAtomValue`, `useSetAtom`, and the `atomWithIDB` factory contract that consumes hydrated state. The root `<Suspense>` + `use(idbHydrationPromise)` *integration* itself is owned by `idb` (which produces the promise and the Suspense pattern); `react-19-primitives` describes the API.
- `idb` — for the mind-palace root hydration contract (`idbHydrationPromise`, root Suspense, debounced write-through, `BroadcastChannel`).
- `tanstack-router-routing` — file-based routes, `createFileRoute`, route params, `Link`/`navigate`/`useRouter`.
- `animejs` — animations and the never-in-render side-channel rule (`animejs` defers back here for the purity statement).
- `react-doctor` — the upstream `npx react-doctor` CLI scanner (millionco/react-doctor). Owns *enforcement* of 60+ runtime-checked rules across state-and-effects, performance, architecture, bundle size, security, correctness, and accessibility — covering categories this skill, `react-compiler-rules`, and `react-19-primitives` never enumerate as prose. Triggered when finishing a feature or before commit; complementary to (not a substitute for) the in-skill rules.

## Dean-stack rules
- Pillar 1 (Storybook-first) means: every React component file ships with a sibling story file. The router doesn't enforce this; the sub-skills assume it.
- Pillar 2 (Zod-first types) means: every component declares its props as a `z.object` schema and infers the type via `z.infer`; runtime parsing is dev-only via `defineComponent(schema, fn)` (see `zod`).
- Pillar 3 (IDB-first state) means: persistent state is `atomWithIDB`, never `useState` (see `jotai`). Plain `useState` is for ephemeral UI only.
- Pillar 4 (CLI-gate-first) means: a render-purity violation surfaces as a Compiler audit failure or a TS error and blocks `bun run check`. Fix at the source.
- React 19 + Compiler are non-optional. Server components are not used (SPA-only); RSC syntax is wrong by definition for this repo.

## Routing
- **use `react-compiler-rules` when** the question is about purity, manual `useMemo`/`useCallback`/`React.memo`, why a memo is unnecessary, side-channel APIs (anime.js, refs, mutations), Compiler audit findings, or "is this safe to put in render?"
- **use `react-19-primitives` when** the question is about `use(promise)`, `useTransition`, `useDeferredValue`, `useOptimistic`, `useActionState`, `useFormStatus`, `<Suspense>` boundaries, or any other React-19-only hook/API surface.

### Routing table
| Question shape | Sub-skill |
|---|---|
| "Should I `useCallback` around this handler?" | `react-compiler-rules` |
| "How do I read the IDB hydration promise inside the shell?" | `react-19-primitives` (API) + `idb` (mind-palace wiring) |
| "Why is the Compiler complaining about this render?" | `react-compiler-rules` |
| "How do I show a pending state during a non-urgent update?" | `react-19-primitives` |
| "Where should I call anime.js?" | `react-compiler-rules` (rule) + `animejs` (hook) |
| "How do I declare the type for a component's props?" | `zod` |
| "How do I add a route?" | `tanstack-router-routing` |

## Anti-patterns
- **Don't suggest React 18 patterns** — `useMemo`/`useCallback` for "perf," manual `React.memo` wrappers, or class components. The Compiler removes the need for the first two; class components were never in scope.
- **Don't use server components or RSC syntax** — this is an SPA (Pillar 1 + the SPA + prerender architecture decision). RSC imports/`"use server"` directives are wrong here.
- **Don't answer purity / 19-primitive questions inside this router** — route to the sub-skill so the answer carries the right rule.
- **Don't introduce a state library other than Jotai** — see `jotai`. No Zustand, no Redux, no Recoil, no Context-as-state.

## Triggers on
react, react 19, react overview, which react skill
