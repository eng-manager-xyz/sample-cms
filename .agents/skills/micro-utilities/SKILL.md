---
name: micro-utilities
description: "Zero-dependency TypeScript utilities for mind-palace — native ECMAScript first (`structuredClone`, `Object.groupBy`, `Map.groupBy`, `toSorted`, `replaceAll`, `Intl.NumberFormat`), then Bun built-ins (`Bun.deepEquals`, `Bun.escapeHTML`, `Bun.password`, `Bun.file`) for tooling/scripts only, then a one-line typed inline helper, then `just-*` micro-packages, then `memoize-one` (module scope only). Calibrated for Bun 1.3.13 / Node 25 / TypeScript 7 with React 19 + Compiler. Triggers on: structuredClone, deep clone, deep merge, deep equality, group by, partition, pick omit, debounce, throttle, memoize-one, just-extend, micro utilities, lodash alternative."
license: MIT
---

Zero-dependency utilities for common TypeScript operations in mind-palace. Decision order — apply top-down, stop at the first match:

1. **Native ECMAScript / Web API** → use it (no install).
2. **`Bun.*` built-in** (tooling/scripts only — never in browser code).
3. **One-line typed inline helper** co-located with the call site.
4. **`just-*` micro-package** (`bun add`).
5. **`memoize-one`** for "cache the last call" — module scope only.

This is a cross-cutting authoring policy, not a tech. Anything that touches an owned mind-palace tech (state, storage, schemas, animation, canvas, routing, motion) defers to that tech's skill.

## When to invoke
- Reaching for `lodash`, `lodash-es`, `ramda`, `underscore`, `moment`, or `uuid` — almost always there's a native or `just-*` answer.
- Manipulating objects (deep merge, deep clone, deep diff), arrays (group, partition, dedupe, sort, set ops), strings (case conversion, padding), numbers (clamp, format), or functions (debounce, throttle, memoize) in plain TS.
- Merging user input or generator answers over a defaults object.
- Choosing between `useMemo` and `memoize-one` for caching an expensive transform.

## When NOT to invoke
- **Schema validation** → `zod` (Pillar 2). No Valibot, Yup, Joi, AJV.
- **React state** → `jotai`. No Zustand, Redux, Recoil, TanStack Query.
- **Persistence** → `idb`. No localForage, Dexie.
- **Animation** → `animejs` via `useAnime`.
- **Canvas / 2D** → `pixijs` via `usePixiApp`.
- **Date arithmetic** — no date library is pinned in mind-palace. Surface a stack-pin decision with the user before adding `date-fns` or anything else; `Intl.DateTimeFormat` covers display-only needs.

## Owns
The decision order above, the native-first preference, the `just-*` adoption rules, the `memoize-one`-vs-Compiler call, and the anti-patterns that flag `lodash` / `JSON.parse(JSON.stringify(…))` / `moment` / `node-fetch` / `dotenv` / `bcrypt`.

## Defers to
- `zod` — every boundary input is parsed by a Zod schema; this skill does not validate.
- `jotai` — atom authoring + the `atomWithIDB` factory; state helpers live there.
- `idb` — IDB primitives + the root hydration promise; persistence helpers live there.
- `react-compiler-rules` — the "no manual `useMemo` / `useCallback` / `React.memo`" rule. `memoize-one` inside a component body is forbidden by that rule.
- `react-19-primitives` — `useMemo` / `useTransition` / `useDeferredValue` are the right answer when the cache is component-scoped.
- `bun-runtime` — the `Bun.*` API surface; tooling/scripts only, never in Vite-bundled browser code.
- `bun-package-manager` — for `bun add` invocations and the workspace `packageManager` pin.
- `ts` — strict-mode rules every helper must satisfy (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- `biome` — every helper file is linted; no exemption.

## Dean-stack rules
- **Pillar 4 (CLI-gate-first):** every helper must compile under `tsgo --noEmit` strict and lint clean under Biome before `bun run check` will pass. No `any`, no `as` casts at module boundaries (Pillar 2 — parse with Zod instead).
- **Bundle hygiene matters more than usual.** Dean-stack ships static to GH Pages and reloads live on iPad over LAN. Prefer the native API or a 3-line inline helper over a 1KB `just-*` package; prefer a 1KB `just-*` package over a 70KB `lodash` import.
- **`Bun.*` is browser-forbidden.** `Bun.deepEquals`, `Bun.escapeHTML`, `Bun.password`, `Bun.file`, `Bun.$`, `Bun.serve` are tooling/scripts only (see `bun-runtime`). Vite bundles browser code; `Bun.*` symbols don't exist there. For browser code use the native column or write inline.
- **Side-channel rule applies to debounce/throttle.** `just-debounce-it` / `just-throttle` mutate captured-ref state across calls — same shape as anime.js / PixiJS (see `react-compiler-rules`). Hoist them to module scope or wrap in a `useEffect`-only pattern; never recreate the debounced function in render. Do NOT reach for `useCallback` to stabilize them — let the Compiler memoize the JSX and keep the function reference stable via module scope.
- **`memoize-one` only at module scope.** Inside a component, the Compiler memoizes; manual `memoize-one` is forbidden by Pillar 4. The legitimate use is `const computeStyles = memoizeOne(buildStyles)` once at the top of a file.
- **No date library is pinned.** Adding `date-fns`, `dayjs`, `moment`, or anything else is a stack-pin change — surface it with the user first. Display-only formatting goes through `Intl.DateTimeFormat`.

## Patterns

### Native-first reference (use these before any package)

| API | Use case |
|---|---|
| `structuredClone(obj)` | Deep clone — handles `Date` / `Map` / `Set` / `RegExp` / cycles. Replaces `JSON.parse(JSON.stringify(...))`. |
| `Object.groupBy(arr, fn)` | Group array by string key |
| `Map.groupBy(arr, fn)` | Same, key can be any type (returns `Map`) |
| `arr.toSorted(fn)` / `arr.toReversed()` / `arr.toSpliced(...)` / `arr.with(i, v)` | Immutable array ops |
| `arr.at(-1)` / `arr.findLast(fn)` | Tail access |
| `arr.flat(depth)` | Flatten nested arrays |
| `arr.filter(Boolean)` | Drop falsy |
| `[...new Set(arr)]` | Dedupe primitives |
| `Object.hasOwn(obj, key)` | Safer `hasOwnProperty` |
| `Object.fromEntries(Object.entries(obj).map(...))` | Map values / keys |
| `str.replaceAll(find, replace)` | Replace all |
| `str.padStart(n, ch)` / `str.padEnd(n, ch)` | Padding |
| `obj?.a?.b?.c` | Safe nested get |
| `Promise.withResolvers()` | External resolve/reject |
| `AbortSignal.timeout(ms)` | Cancellation |
| `new Intl.NumberFormat(locale, opts).format(n)` | Currency / compact / unit display |
| `new Intl.DateTimeFormat(locale, opts).format(d)` | Date display (NOT arithmetic) |

### `Bun.*` reference (tooling/scripts only — `bun-runtime`)

| Bun API | Replaces |
|---|---|
| `Bun.deepEquals(a, b)` *(strict mode: third arg `true`)* | `lodash.isEqual`, `just-compare` |
| `Bun.escapeHTML(str)` | `he`, `escape-html` |
| `Bun.semver.satisfies(v, range)` / `Bun.semver.order(a, b)` | `semver` |
| `Bun.file(path).text()` / `.json()` / `.bytes()` | `fs.readFile` |
| `Bun.write(path, data)` | `fs.writeFile` |
| `` Bun.$`cmd` `` | `execa`, `zx` |

For Vite-bundled browser code (`apps/web/app/...`), use the native column or write a typed helper inline.

### Type-safe helpers (preferred over `just-pick` / `just-omit` when types must stay precise)

```ts
export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) if (key in obj) result[key] = obj[key];
  return result;
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) delete result[key];
  return result as Omit<T, K>;
}

export function groupBy<T, K extends PropertyKey>(
  arr: readonly T[],
  getKey: (item: T) => K,
): Partial<Record<K, T[]>> {
  return arr.reduce<Partial<Record<K, T[]>>>((acc, item) => {
    const key = getKey(item);
    (acc[key] ??= []).push(item);
    return acc;
  }, {});
}

export function dedupeBy<T, K>(arr: readonly T[], getKey: (item: T) => K): T[] {
  const seen = new Set<K>();
  return arr.filter((x) => {
    const k = getKey(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
```

These compile clean under `tsgo --noEmit` strict. Co-locate with the call site; only promote to a shared file when ≥2 callers exist with identical signatures.

### `just-*` packages — when to add

| Need | Package | Notes |
|---|---|---|
| Deep merge user config over defaults | `just-extend` | `extend(true, {}, defaults, user)` (deep). |
| Deep diff (JSON-patch ops) | `just-diff` + `just-diff-apply` | |
| Multi-key sort | `just-order-by` | When `toSorted` ergonomics aren't enough. |
| Shuffle | `just-shuffle` | Fisher-Yates. |
| Debounce / throttle | `just-debounce-it` / `just-throttle` | See side-channel rule above. |
| Run-once | `just-once` | |
| Last-call cache (module scope) | `memoize-one` | Forbidden inside components — Compiler memoizes. |
| Case conversion | `just-camel-case`, `just-kebab-case`, `just-snake-case`, `just-pascal-case` | One per case. |
| Truncate | `just-truncate` (chars) / `just-prune` (word boundary) | |
| Statistics | `just-median`, `just-percentile`, `just-variance`, `just-standard-deviation` | One per stat. |

`bun add <package>`. Each is <1KB minified, zero deps. If two workspaces use the same `just-*`, pin via the root `package.json` so versions stay in sync (see `bun-package-manager`).

### Dean-stack patterns

**Deep clone an IDB record before mutating** — `structuredClone` handles `Date` / `Map` / `Set`, which IDB records can contain. Never `JSON.parse(JSON.stringify(...))`.

**Merge generator answers over template defaults** (in `turbo/generators/config.ts`):

```ts
import extend from "just-extend";
const merged = extend(true, {}, templateDefaults, userAnswers);
```

**Debounce a search input inside a route component** — declare at module scope, not in the component body:

```tsx
// At module scope.
import debounce from "just-debounce-it";
import { useSetAtom } from "jotai"; // see `jotai`
import { searchAtom } from "./atoms";

const queueSearch = debounce((query: string, set: (q: string) => void) => {
  set(query);
}, 300);

function SearchInput() {
  const setQuery = useSetAtom(searchAtom);
  return <input onChange={(e) => queueSearch(e.target.value, setQuery)} />;
}
```

The Compiler memoizes the JSX; `queueSearch` is reference-stable because it's at module scope. Don't wrap in `useCallback` (see `react-compiler-rules`).

**Module-scope `memoize-one` for an expensive transform:**

```ts
import memoizeOne from "memoize-one";
const computeTokens = memoizeOne((mode: "light" | "dark", accent: string) => buildTokens(mode, accent));
```

Defined once at the top of a file. `useMemo` would re-cache per-component; module scope caches across the whole app.

## Anti-patterns

- **Don't `JSON.parse(JSON.stringify(obj))`** — drops `Date` / `Map` / `Set` / `RegExp`, throws on functions/symbols, breaks IDB records. Use `structuredClone(obj)`.
- **Don't import `lodash` / `lodash-es`** — too heavy for the iPad-LAN budget; everything is now native or `just-*`.
- **Don't import `moment`** — not pinned in this stack; surface a date-library decision with the user first.
- **Don't `arr.sort()` when you don't intend to mutate** — use `arr.toSorted()`.
- **Don't use `Bun.*` in browser code** — Vite bundles it and the symbol won't exist at runtime. Tooling/scripts only (see `bun-runtime`).
- **Don't put `memoize-one` inside a component body** — Compiler memoizes; manual memo is forbidden (see `react-compiler-rules`). Module scope is the only valid use.
- **Don't recreate `debounce(...)` / `throttle(...)` in render** — module scope or `useEffect`-mounted only. Same side-channel rule as anime.js / PixiJS.
- **Don't reach for `useCallback` to stabilize a debounced function** — hoist it to module scope; the Compiler handles the rest.
- **Don't import `node-fetch` / `cross-fetch`** — `fetch` is global on Bun and Node 21+.
- **Don't import `dotenv`** — Bun loads `.env` automatically; build-time vars go through `t3-env`.
- **Don't import `bcrypt` / `argon2`** — there is no server in mind-palace; auth doesn't apply on GH Pages.
- **Don't validate with anything other than Zod** — Pillar 2; Valibot / Yup / Joi / AJV are forbidden (see `zod`).
- **Don't grow a shared `utils/` graveyard** — co-locate small helpers with their call sites; only promote to a shared file when ≥2 callers exist with identical signatures.

## Triggers on
structuredClone, deep clone, deep merge, deep equality, group by, partition, pick omit, debounce, throttle, memoize-one, just-extend, micro utilities, lodash alternative
