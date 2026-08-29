---
name: react-19-primitives
description: "React 19 primitive APIs for mind-palace — `use(promise)`, `useTransition`, `useDeferredValue`, `useOptimistic`, `useActionState`, `useFormStatus`, and the `<Suspense>` boundary. Owns the API surface; idb owns the mind-palace root-hydration usage. Triggers on: use(promise), useTransition, useDeferredValue, useOptimistic, useActionState, useFormStatus, Suspense, react 19 hook."
license: MIT
---

Sub-skill of `react`. Owns the React-19-only hooks and the `<Suspense>` API surface — what each one accepts, what it returns, what it suspends, and when to reach for it. The mind-palace-specific wiring of `<Suspense>` + `use(idbHydrationPromise)` at the app shell is owned by `idb` (which produces the promise and the Suspense pattern); this skill just describes the API the integration uses.

## When to invoke
- Reading a value out of a promise inside render — `use(promise)`.
- Splitting an update into urgent + non-urgent parts — `useTransition`, `useDeferredValue`.
- Showing an instant UI update before the real mutation lands — `useOptimistic`.
- Wiring a form action and reading its pending/result state — `useActionState`, `useFormStatus`.
- Authoring or moving a `<Suspense>` boundary that isn't the mind-palace root one (which `idb` owns — it produces `idbHydrationPromise` and the Suspense wiring at the app shell).

## Owns
React 19 primitives encouraged by the stack: `use(promise)`, `useTransition`, `useDeferredValue`, `useOptimistic`, `useActionState`, `useFormStatus`, and `<Suspense>` boundaries.

## Defers to
- `react` (parent) — version pin and routing.
- `react-compiler-rules` — for "no `useMemo` around a `use(promise)` read"; the Compiler memoizes already.
- `idb` — for the mind-palace root `<Suspense>` + `use(idbHydrationPromise)` *integration*. This skill describes what `use(promise)` does; `idb` owns the promise itself, the Suspense pattern at the app shell, the debounced write-through, and the `BroadcastChannel` re-hydration.
- `jotai` — for the `atomWithIDB` factory contract that consumes the hydrated state once `use(idbHydrationPromise)` resolves.
- `tanstack-router-routing` — for `<Suspense>` boundaries inside route components / loaders.

## Dean-stack rules
- Pillar 3 (IDB-first state) means: there is exactly one root `<Suspense>` boundary that calls `use(idbHydrationPromise)` once at the app shell. After it resolves, every `atomWithIDB` reads its initial value synchronously — no per-atom suspense (see `idb` for the mind-palace hydration contract that produces this promise; `jotai` consumes it).
- Pillar 4 (CLI-gate-first) means: a `use(promise)` that throws an unhandled rejection bubbles to the nearest error boundary; in dev that surface counts as a gate failure of the same severity as a TS error. Wrap risky promises in error boundaries.
- React Compiler purity (see `react-compiler-rules`) means: `useTransition`'s start callback is fine in render path; `useOptimistic`'s reducer is a pure function of `(state, action)` — same purity rule as Jotai derivations.
- Server components are not used (SPA-only). `useFormStatus` works inside client `<form>` elements driven by an action prop; there is no RSC form integration in this repo.

## Patterns

### `use(promise)` — read a stable Promise inline
```tsx
// pinned: react ^19.x
import { use, Suspense } from "react";

function Inner({ promise }: { promise: Promise<string> }) {
  // `use` suspends until the Promise resolves, then returns its value.
  const value = use(promise);
  return <span>{value}</span>;
}

export function Outer({ promise }: { promise: Promise<string> }) {
  return (
    <Suspense fallback={<span>Loading…</span>}>
      <Inner promise={promise} />
    </Suspense>
  );
}
```
The Promise must be **stable across renders** (created at module scope, in a parent atom, or in a parent's effect — never `new Promise()` in a child render). The mind-palace pattern is to create the Promise once at module load and `use()` it at the root shell — see `idb` for the canonical wiring (it produces `idbHydrationPromise` and the root Suspense boundary; `jotai` consumes the resolved snapshot).

### `useTransition` — mark an update non-urgent
```tsx
import { useTransition } from "react";
import { useSetAtom } from "jotai";
import { queryAtom } from "~/state/atoms";

export function SearchBox() {
  const [pending, startTransition] = useTransition();
  const setQuery = useSetAtom(queryAtom);
  return (
    <>
      <input
        onChange={(e) => startTransition(() => setQuery(e.target.value))}
        aria-busy={pending}
      />
      {pending ? <span role="status">Filtering…</span> : null}
    </>
  );
}
```
The input update is urgent (typing should be instant); the downstream filter recompute is non-urgent (React can interrupt it). `pending` is the right signal for an `aria-busy` attribute.

### `useDeferredValue` — read a slightly-stale derived value
```tsx
import { useDeferredValue } from "react";
import { useAtomValue } from "jotai";
import { queryAtom } from "~/state/atoms";

export function Results() {
  const query = useAtomValue(queryAtom);
  const deferredQuery = useDeferredValue(query); // may lag the live query
  return <FilterableList query={deferredQuery} />;
}
```
The fast surface (the input) reads `query`; the expensive surface (the list) reads `deferredQuery`. React renders the input first, then catches up the list when there's idle time.

### `useOptimistic` — show the result before the write commits
```tsx
import { useOptimistic } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { progressAtom } from "~/state/atoms";

export function CompleteButton() {
  const progress = useAtomValue(progressAtom);
  const setProgress = useSetAtom(progressAtom);
  const [optimistic, setOptimistic] = useOptimistic(progress, (state, completed: boolean) => ({
    ...state,
    completed,
  }));
  return (
    <button
      onClick={() => {
        setOptimistic(true);
        setProgress((p) => ({ ...p, completed: true })); // jotai write-through (debounced ~150ms — see `idb`)
      }}
    >
      {optimistic.completed ? "Completed" : "Complete"}
    </button>
  );
}
```
The reducer `(state, action) => newState` is a pure function — same purity discipline as Jotai derived atoms (see `react-compiler-rules`). On commit, React reverts `optimistic` to the real `progress` value.

### `useActionState` — bind a form action and read its result
```tsx
import { useActionState } from "react";

async function submitScore(_prev: number | null, formData: FormData): Promise<number | null> {
  const value = Number(formData.get("score"));
  // ... write to IDB via jotai's set; return the new value or null on failure
  return Number.isFinite(value) ? value : null;
}

export function ScoreForm() {
  const [score, formAction, pending] = useActionState(submitScore, null);
  return (
    <form action={formAction}>
      <input name="score" inputMode="numeric" />
      <button type="submit" disabled={pending}>Save</button>
      {score !== null ? <output>Saved {score}</output> : null}
    </form>
  );
}
```
The action is a `(prevState, formData) => Promise<nextState>` reducer. `pending` is true for the duration of the action; `score` is the latest returned value.

### `useFormStatus` — read the parent form's pending state from a child
```tsx
import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</button>;
}
```
`useFormStatus` reads from the nearest `<form action={...}>` ancestor — must be rendered *inside* the form, not in the same component that owns it. Lives in `react-dom`, not `react`.

### `<Suspense>` — boundary for any `use(promise)` or async-atom read
```tsx
import { Suspense } from "react";

export function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <AsyncContent />
    </Suspense>
  );
}
```
For the mind-palace root hydration boundary, see `idb` — there is exactly one of those at the app shell (with `fallback={null}` because the prerendered HTML shell *is* the fallback). `jotai` consumes the resolved snapshot afterward.

### `useId` — stable IDs for ARIA wiring
```tsx
import { useId } from "react";

export function Field() {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>Name</label>
      <input id={id} />
    </>
  );
}
```
Stable across renders, unique per call site. Useful for `aria-labelledby`, `aria-describedby`, `htmlFor`.

## Anti-patterns
- **Don't pass a freshly-allocated Promise into `use()` from a child render** — `use(fetch(url))` creates a new Promise every render and loops. Allocate the Promise at module scope, in a parent atom, or in a parent's effect, and pass it down.
- **Don't add a per-component `<Suspense>` for IDB hydration** — the root `<Suspense>` + `use(idbHydrationPromise)` runs once. Per-atom suspense breaks the synchronous-read guarantee (see `idb` for the hydration contract).
- **Don't `useMemo` around a `use(promise)` call** — the React Compiler handles memoization (see `react-compiler-rules`); manual memo can mask a stale-Promise bug.
- **Don't use `useTransition` for urgent updates** — typing into a controlled input must stay urgent; only wrap the *downstream* derivation in `startTransition`.
- **Don't use `useFormStatus` in the same component that owns the `<form>`** — it returns `{ pending: false, data: null, ... }` because there's no parent form. Move it into a child.
- **Don't write a `useEffect` that polls a Promise** — `use(promise)` + `<Suspense>` is the React-19 way; the effect+poll pattern is a React-17 idiom that doesn't belong here.
- **Don't import `Suspense` from somewhere other than `react`** — there is exactly one `Suspense` and it lives in `react`. `react-dom` exports `useFormStatus` only.

## Triggers on
use(promise), useTransition, useDeferredValue, useOptimistic, useActionState, useFormStatus, Suspense, react 19 hook
