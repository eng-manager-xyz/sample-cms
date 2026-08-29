---
name: animejs
description: "anime.js v4 named-import API for mind-palace — `createTimeline`, `createAnimatable`, `animate`, `stagger`, `engine`; the `useAnime(ref, params, deps)` hook that fronts every animation; `prefers-reduced-motion` short-circuited at the hook level. Triggers on: anime.js, animejs, anime v4, createTimeline, createAnimatable, createScope, createDraggable, useAnime, prefers-reduced-motion, anime utils."
license: MIT
---

The producer of every animation surface. anime.js v4 is the only animation library, and the `useAnime` hook is the only way React mounts an animation — it enforces the side-channel rule (animations never run during render) by construction.

## When to invoke
- Adding any animation to a component (entrance, transition, gesture, scroll-driven, SVG draw).
- Authoring or extending the `useAnime(ref, params, deps)` hook in `apps/web/app/motion/`.
- Wiring `prefers-reduced-motion` short-circuiting for a new motion preset.
- Composing a sequence — reach for `createTimeline`.
- Real-time motion (cursor follow, drag) — reach for `createAnimatable` or `createDraggable`.
- Diagnosing a v3-shaped snippet someone pasted in (`anime(...)`, `targets:`, `easing:` strings, `easeOutQuad`-prefixed names).

## Owns
anime.js v4 named-import API (`createTimeline`, `createAnimatable`, `createDraggable`, `createScope`, `stagger`, `utils`), the `useAnime(ref, params, deps)` hook, and `prefers-reduced-motion` short-circuiting.

## Defers to
- `react-compiler-rules` — for the canonical "anime.js is a side channel; never call during render" rule. This skill provides the hook that enforces it; that skill states the underlying purity contract.
- `react` (router) — for which React skill answers a question about animation lifecycles.
- `bun-package-manager` — for installing `animejs@^4`.
- `stylelint` (CSS side) and `tailwind` — when an animation crosses into CSS (e.g., a `transition-*` utility that anime.js then animates the variable on).

## Dean-stack rules
- Animations are subtle, elegant, and purposeful. They communicate state change; they do not decorate.
- Always honor `prefers-reduced-motion` — short-circuit to no-op or instant transition. The `useAnime` hook does this once so individual components do not re-implement it.
- React Compiler purity (see `react-compiler-rules`) means: anime.js calls live inside `useEffect`/`useLayoutEffect` or event handlers, never in render. Render must not depend on animated values — read them post-mount via refs.
- anime.js v4 named-import API ONLY. The v3 default export `import anime from "animejs"` is gone in v4 and is wrong by definition. Rewrite v3 snippets to v4 named imports on sight.
- Cleanup is mandatory — every `animate(...)`, `createTimeline(...)`, `createDraggable(...)`, `onScroll(...)` returns an instance with a `.cancel()` / `.revert()` method that must run on effect teardown. The `useAnime` hook centralizes this; bypassing the hook means hand-writing the cleanup.

## Patterns

### `useAnime(ref, params, deps)` — the only way to mount an animation
```ts
// apps/web/app/motion/use-anime.ts
// pinned: animejs ^4.x
import { useEffect, type DependencyList, type RefObject } from "react";
import { animate, type AnimationParams } from "animejs";

const PRM = "(prefers-reduced-motion: reduce)";

export function useAnime<T extends Element>(
  ref: RefObject<T | null>,
  params: AnimationParams,
  deps: DependencyList = [],
) {
  useEffect(() => {
    if (!ref.current) return;
    if (typeof window !== "undefined" && window.matchMedia(PRM).matches) {
      // Reduced motion: snap to the final state, no animation.
      // (Apply `params` end-values to the element directly if needed; here we no-op.)
      return;
    }
    const a = animate(ref.current, params);
    return () => { a.cancel(); };
    // KEEP — `deps` is the public parameter the caller owns. biome's
    // useExhaustiveDependencies / eslint's react-hooks/exhaustive-deps
    // can only verify dep arrays they can see statically; a parameter
    // type-erased to DependencyList is opaque to either. This is one of
    // the small set of legitimate API-design escapes (see AGENTS.md
    // "Disable-comment refactor table" — parameterized hooks are the
    // documented exception).
    // biome-ignore lint/correctness/useExhaustiveDependencies: API design — `deps` is a public parameter the caller owns.
  }, deps);
}
```
Render returns JSX; the animation is set up after mount and torn down on cleanup. The `prefers-reduced-motion` check is centralized — every motion site inherits it.

### Calling `useAnime` from a component
```tsx
import { useRef } from "react";
import { useAnime } from "~/motion/use-anime";

export function FadeIn({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useAnime(ref, { opacity: [0, 1], duration: 300, ease: "out(2)" });
  return <div ref={ref}>{children}</div>;
}
```
No anime.js code in render; no manual cleanup; reduced-motion handled. The Compiler is happy because render is pure (see `react-compiler-rules`).

### Sequencing with `createTimeline`
```ts
import { createTimeline, stagger } from "animejs"; // v4 named imports

const tl = createTimeline({ defaults: { duration: 600, ease: "outExpo" } });
tl.add(".title", { y: [-20, 0], opacity: [0, 1] });
tl.add(".items > *", { y: [10, 0], opacity: [0, 1], delay: stagger(40) }, "<+=200");
```
Use the time-position strings (`'<'`, `'<<'`, `'+=200'`, `'-=200'`, `'<+=N'`) instead of nested timeline trees. Timelines are also subject to the side-channel rule — wrap them in `useAnime` (or a sibling hook) inside an effect.

### Real-time motion with `createAnimatable`
```ts
import { useEffect, useRef } from "react";
import { createAnimatable } from "animejs";

export function useCursorFollow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const cursor = createAnimatable(ref.current, { x: 200, y: 200, ease: "out(3)" });
    const onMove = (e: PointerEvent) => { cursor.x(e.clientX); cursor.y(e.clientY); };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return ref;
}
```
`createAnimatable` lets you call methods on properties to update them in real time without re-creating animations. Same effect-lifecycle discipline.

### Stagger
```ts
import { animate, stagger } from "animejs";

animate(".grid > *", { scale: [0, 1], delay: stagger(50, { from: "center" }) });
```
`stagger` works as `delay` and as any animatable value (`x: stagger("10vw", { from: "center" })`). Anchor: `'first' | 'last' | 'center'` or numeric index.

### Engine globals — set once, in app bootstrap
```ts
// apps/web/app/motion/engine-defaults.ts
import { engine } from "animejs";

engine.defaults.duration = 400;
engine.defaults.ease = "out(2)";
engine.pauseOnDocumentHidden = true; // default true; pinned for clarity
```
`engine` is the only top-level export — `defaults` is a property on that instance, NOT a separate named export. Imported once from the app shell. Components inherit these defaults so individual `animate(...)` calls stay terse.

Anti-pattern: do **not** use `utils.set(engine, { defaults: {...} })`. `utils.set` is the animation setter API; it pipes the value through animejs's value parser (`decomposeRawValue`), which throws `str.includes is not a function` on a non-string `defaults` object. Direct property assignment is the only correct path.

### Scope cleanup for stories / route changes
```ts
import { createScope } from "animejs";

const scope = createScope({ root: ".story-stage" }).add(self => {
  // Set up a bunch of animations…
  return () => { /* optional extra cleanup */ };
});

// Anywhere later (story unmount, route leave):
scope.revert(); // cancels every animate/createDraggable/onScroll inside, runs cleanup
```
Use `createScope` when a sub-tree needs a single revert hook (Storybook story teardown, route component unmount). Inside React, equivalent to a `useEffect` that returns `() => scope.revert()`.

## Anti-patterns
- **Don't `import anime from "animejs"`** — v3 default-import. Removed in v4. Use named imports: `import { animate, createTimeline, stagger } from "animejs"`.
- **Don't call `animate(...)`, `createTimeline(...)`, `createAnimatable(...)`, or any anime.js function during render** — render is pure (see `react-compiler-rules`). Animations belong inside `useEffect`/`useLayoutEffect` or event handlers, ideally via `useAnime`.
- **Don't use v3 `targets:` / `easing:` / `easeOutQuad` syntax** — v4 takes targets as the first positional arg, takes `ease:` (not `easing:`), and uses `'outQuad'` / `'out(2)'` / `'outExpo'` (no `ease`-prefix).
- **Don't use `anime.timeline()`, `anime.path()`, `anime.setDashoffset()`** — v3 accessors on the deleted default export. Use `createTimeline()`, `svg.createMotionPath()`, `svg.createDrawable()`.
- **Don't omit cleanup** — every animation instance must be `.cancel()`'d on effect teardown (or use a `createScope` you `.revert()`). The `useAnime` hook does this for you; bypass it and you own the bookkeeping.
- **Don't ignore `prefers-reduced-motion`** — accessibility regression. The `useAnime` hook short-circuits at the call site; component-level animations that bypass the hook must check `matchMedia("(prefers-reduced-motion: reduce)").matches` themselves.
- **Don't read animated values during render** — animated DOM values are mutated outside React. Render-time reads return stale values and break the Compiler's analysis. Read in event handlers or post-effect.
- **Don't pin `@types/animejs`** — types ship inside `animejs` since v4.0. A stale `@types/animejs@^3` package is the most common cause of `targets:` / `easing:` showing up in autocomplete.

## Triggers on
anime.js, animejs, anime v4, createTimeline, createAnimatable, createScope, createDraggable, useAnime, prefers-reduced-motion, anime utils
