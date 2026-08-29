---
name: jotai
description: "Jotai 2.19+ atom authoring for mind-palace — `useAtomValue` / `useSetAtom` for read/write splits, derived async atoms with `await get(...)`, parameterized atoms via the `atomWithIDB` key (or `selectAtom` for derived per-id slices — no `atomFamily`), and the `atomWithIDB(schema, key, default)` factory contract (the parse-on-set wrapping; the IDB primitives, root suspense, debounced write-through and `BroadcastChannel` are all owned by `idb`). Triggers on: atom, atomWithIDB, derived atom, jotai, jotai Provider, jotai store, parameterized atom, selectAtom, useAtom, useAtomValue, useSetAtom."
license: MIT
---

The in-memory cache layer atop the IDB source of truth (AGENTS.md Pillar 3). Owns the `atomWithIDB(schema, key, default)` factory contract — parse-on-set via Zod, then hand the value to the IDB-side persist helper. The root `<Suspense>` + `use(idbHydrationPromise)` pattern, the debounced write-through (~150ms), and the `BroadcastChannel` re-hydration broadcast are all owned by `idb`; this skill just consumes them. Atoms read their initial value synchronously from already-hydrated state — no per-atom suspense.

## When to invoke
- Authoring an atom for game progress, settings, content, or anything else AGENTS.md Pillar 3 defines as persistent state.
- Writing the `atomWithIDB(schema, key, default)` factory (or extending it). The IDB primitives + root suspense pattern this factory plugs into are owned by `idb`.
- Choosing between `useAtom`, `useAtomValue`, and `useSetAtom`.
- Adding a derived atom (sync or async), or a per-id parameterized atom (use the `atomWithIDB` key or `selectAtom` — not `atomFamily`).
- Consuming the cross-tab change broadcast (the channel itself is owned by `idb`) to refresh affected atoms.

Jotai atom authoring, hooks (`useAtom`, `useAtomValue`, `useSetAtom`), derived atoms, parameterized atoms (via the `atomWithIDB` key or `selectAtom` — *not* `atomFamily`), store/Provider, and the `atomWithIDB` factory contract — the parse-on-set wrapping that hands the value to `idb`'s persist helper. The IDB primitives, the root `idbHydrationPromise`, the debounced write-through, and the `BroadcastChannel` re-hydration broadcast are all owned by `idb`.

## Defers to
- `zod` — for *how to author* the schema each `atomWithIDB(schema, key, default)` validates against. The schema is the producer; the atom's job is to call `schema.parse` on every set and surface the failure.
- `idb` — for IDB primitives: the singleton `getDB()`, the typed `IDBPDatabase<AppDB>`, the root `idbHydrationPromise` this skill's atoms `use()`, and the debounced write-through + `BroadcastChannel` plumbing the factory wires into.
- `react-19-primitives` (Wave 3, forward) — for the `<Suspense>` boundary and the `use(promise)` call that fronts `idbHydrationPromise`.
- `bun-test` — for unit-testing pure atom *reducers* with `createStore()`.

## Dean-stack rules
- Pillar 3 (IDB-first state) means: `atomWithIDB` is the only atom factory for persistent state. The hydration promise (owned by `idb`) resolves once at startup and every `atomWithIDB` then reads its initial value *synchronously* from the in-memory snapshot — never a per-atom suspense. Schema migrations finish before the suspense resolves.
- Pillar 2 (Zod-first types) means: every `atomWithIDB` takes a Zod schema; on `set`, the factory validates with `schema.parse` (`zod`-owned authoring) and only then writes through to IDB. Atom value type is `z.infer<typeof Schema>` — never hand-written.
- Pillar 4 (CLI-gate-first) means: a Zod parse failure on atom set throws and surfaces in the dev console — fix it like any other gate failure. The atom reducer's *pure* logic is unit-tested in `bun test`; a real Provider + a real component subscribing is Playwright (Wave 4).
- React Compiler purity means: Jotai hooks are pure subscribers — safe to call directly in render with no `useMemo`/`useCallback` wrapping (compiler handles memoization).
- Ephemeral UI state (focus, hover, transient toggles) stays in plain `useState` — `atomWithIDB` is for things the kid would notice losing.

## Patterns

### Define an atom at module scope (never in render)
```ts
// pinned: jotai ^2.19.x
import { atom } from "jotai";

export const transientToggleAtom = atom(false);          // ephemeral — fine here for symmetry, also fine as useState
export const doubledAtom = atom((get) => get(transientToggleAtom) ? 2 : 1);
```
Atoms in render would create a new identity every commit and loop. Always module-scope.

### Read-only via `useAtomValue`; write-only via `useSetAtom`
```tsx
import { useAtomValue, useSetAtom } from "jotai";
import { progressAtom } from "~/state/atoms";

function Score() {
  const progress = useAtomValue(progressAtom);   // re-renders only on read
  return <span>{progress.level}</span>;
}

function NextLevelButton() {
  const setProgress = useSetAtom(progressAtom);  // never re-renders on read
  return <button onClick={() => setProgress((p) => ({ ...p, level: p.level + 1 }))}>Next</button>;
}
```
`useAtom` only when the same component genuinely needs both. The split is what keeps re-renders surgical.

### `atomWithIDB(schema, key, default)` — the mind-palace persistence factory
```ts
// apps/web/app/lib/atom-with-idb.ts
import { atom, type WritableAtom } from "jotai";
import type { z, ZodType } from "zod";
import { persist, readSync } from "~/state/persist"; // owned by `idb`
import type { idbHydrationPromise } from "~/state/hydration";

type Hydrated = Awaited<typeof idbHydrationPromise>;

export function atomWithIDB<S extends ZodType>(
  schema: S,
  store: keyof Hydrated,
  key: string,
  fallback: z.infer<S>,
): WritableAtom<z.infer<S>, [z.infer<S> | ((prev: z.infer<S>) => z.infer<S>)], void> {
  // Hydration has already resolved before this atom is ever read — read sync.
  const initial = readSync(store, key) ?? fallback;
  const valueAtom = atom<z.infer<S>>(initial);

  return atom(
    (get) => get(valueAtom),
    (get, set, update) => {
      const next = typeof update === "function"
        ? (update as (p: z.infer<S>) => z.infer<S>)(get(valueAtom))
        : update;
      const parsed = schema.parse(next);          // mind-palace: always validate on write
      set(valueAtom, parsed);
      void persist(store, key, parsed);           // ~150ms debounce + BroadcastChannel post — owned by `idb`
    },
  );
}
```
The factory: parse-on-set, write-through to IDB (debounced), broadcast for other tabs. The schema itself comes from `zod`; the IDB primitives come from `idb`. The atom never opens an IDB connection on its own.

### Root `<Suspense>` + `use(idbHydrationPromise)` — the only suspense for hydration
```tsx
// apps/web/app/routes/__root.tsx (or wherever the app shell mounts)
import { Suspense, use } from "react";
import { Provider } from "jotai";
import { idbHydrationPromise } from "~/state/hydration"; // owned by `idb`

function Hydrated({ children }: { children: React.ReactNode }) {
  use(idbHydrationPromise); // suspends once; schema migrations have already run inside `idb`
  return <>{children}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Provider>
      <Suspense fallback={null /* the prerendered shell is the fallback */}>
        <Hydrated>{children}</Hydrated>
      </Suspense>
    </Provider>
  );
}
```
A *single* root suspense. After it resolves, every `atomWithIDB` reads its initial value synchronously — no per-atom suspense, no waterfalls. The `<Provider>` is here so tests / Storybook can swap in a fresh store; in production the implicit default store would also work.

### Cross-tab re-hydration (Storybook iframe ↔ app, second window)
```ts
// apps/web/app/state/atoms.ts
import { atom } from "jotai";
import { subscribeRemoteWrites } from "~/state/persist"; // `idb`

const versionAtom = atom(0);  // bump to invalidate dependents

if (typeof window !== "undefined") {
  subscribeRemoteWrites(() => {
    // Replace the impl per store as needed — for many cases, re-reading the affected
    // atom's IDB row and `set`-ing it on the default store is enough.
  });
}
```
The `BroadcastChannel` itself lives in `idb`; jotai subscribes and applies the resulting state delta.

### Derived atom — sync
```ts
import { atom } from "jotai";
import { progressAtom } from "./atoms";

export const completedCountAtom = atom((get) =>
  Array.from(get(progressAtom).values()).filter((p) => p.completed).length,
);
```
Pure derivation; the React Compiler memoizes the consuming render — no `useMemo`.

### Derived async atom — `await get(...)`
```ts
const remoteAtom = atom(async (_get, { signal }) => {
  const res = await fetch("/data.json", { signal });
  return res.json();
});

const remoteCountAtom = atom(async (get) => (await get(remoteAtom)).length);
```
In Jotai 2.x, `get(asyncAtom)` returns a Promise; you must `await` (or `.then`) it inside the read function. Wrap a consuming component in `<Suspense>` if it reads the result via `useAtomValue`.

### Parameterized atoms — prefer the IDB key or `selectAtom`
For *persistent* per-id state, the `key` parameter on `atomWithIDB` already IS the family — the IDB row is the cache, and a tiny module-scope `Map<id, atom>` memoizes the atom *instance* so two components calling `getProgressAtom(id)` share subscription state. Bounded by IDB row count (game progress, settings — not user-generated content), so no `setShouldRemove` policy is needed.

```ts
// apps/web/app/state/atoms.ts
import { type Progress, ProgressSchema } from "@mind-palace/schemas";
import type { WritableAtom } from "jotai";
import { atomWithIDB } from "~/lib/atom-with-idb";
import { persistProgress } from "./persist";

type ProgressAtom = WritableAtom<Progress, [Progress | ((prev: Progress) => Progress)], void>;
const progressAtoms = new Map<string, ProgressAtom>();

export function getProgressAtom(id: string): ProgressAtom {
  let cached = progressAtoms.get(id);
  if (!cached) {
    cached = atomWithIDB(ProgressSchema, (snapshot) => snapshot.progress.get(id), persistProgress, {
      id, level: 1, completed: false,
    });
    progressAtoms.set(id, cached);
  }
  return cached;
}
```

For *derived* per-id slices over a collection atom, use `selectAtom` from `jotai/utils` — it gives per-id subscription correctness (referential stability, equality fn) and ships with core jotai:

```ts
import { selectAtom } from "jotai/utils";
import { progressCollectionAtom } from "./atoms";

export const progressForIdAtom = (id: string) =>
  selectAtom(progressCollectionAtom, (c) => c.get(id));
```

If neither pattern fits — rare for kid-software — flag it for review before reaching for `atomFamily` / `jotai-family`. Dean-stack does not use `atomFamily`.

### Provider + `createStore` for tests / Storybook isolation
```tsx
import { createStore, Provider } from "jotai";

const store = createStore();
// in a story or test:
<Provider store={store}>{ui}</Provider>;
// assertions:
store.set(progressAtom, { level: 3, completed: true });
store.get(progressAtom); // → { level: 3, completed: true }
```
Fresh store per story/test gives total isolation — the BroadcastChannel still fires, but a fresh IDB fixture (Playwright concern) keeps stories clean.

## Anti-patterns
- **Don't put persistent state in `useState`** — Pillar 3. The iPad-over-LAN reload erases it. Use `atomWithIDB`.
- **Don't open a per-atom suspense for IDB hydration** — the root `<Suspense>` + `use(idbHydrationPromise)` runs once. Per-atom suspense breaks the synchronous-read guarantee and slows mount.
- **Don't `useMemo`/`useCallback` around Jotai hooks** — React Compiler handles memoization; manual memo is noise that can mask purity bugs.
- **Don't use `atomFamily` at all in mind-palace** — the IDB key + a module-scope `Map<id, atom>` is the family for persistent state; `selectAtom(coll, c => c.get(id))` covers derived per-id slices. See the parameterized-atoms pattern above. The deprecated `jotai/utils` export and the `jotai-family` package are both excluded.
- **Don't wrap `atomWithIDB` in `atomFamily`** — `atomWithIDB` already keys by `id` (the IDB row IS the family). Wrapping it in another family creates a second cache layer that disagrees with IDB, leaks unbounded, and breaks the synchronous-read guarantee on remount. Use `getProgressAtom(id)` (Map memoization) instead.
- **Don't import `loadable` from `jotai/utils`** — deprecated since 2.17. Use `unwrap` for the rare case where a non-Suspense fallback is needed.
- **Don't define atoms inside a component** — module scope only. Render-defined atoms get a new identity every commit and loop.
- **Don't write through to IDB on every set without debouncing** — `~150ms` per AGENTS.md Pillar 3. The factory's `persist` helper (owned by `idb`) handles it; don't bypass.
- **Don't validate atom values with hand-written checks** — every `atomWithIDB` runs `schema.parse` on set; the schema is the contract (see `zod`).

## Triggers on
atom, atomWithIDB, derived atom, jotai, jotai Provider, jotai store, parameterized atom, selectAtom, useAtom, useAtomValue, useSetAtom
