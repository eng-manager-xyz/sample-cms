---
name: pixijs
description: "Use this skill first for ANY PixiJS v8 task; it routes to the right specialized skill for the job. Covers the full PixiJS surface: Application setup, the scene graph (Container, Sprite, Graphics, Text, Mesh, ParticleContainer, DOMContainer, GifSprite), rendering (WebGL/WebGPU/Canvas, render loop, custom shaders, filters, blend modes), assets, events, color, math, ticker, accessibility, performance, environments, migration from v7, and project scaffolding. Triggers on: pixi, pixi.js, pixijs, PixiJS, v8, Application, app.init, Sprite, Container, Graphics, Text, Mesh, ParticleContainer, DOMContainer, GifSprite, Assets, Ticker, renderer, WebGL, WebGPU, scene graph, filter, shader, blend mode, texture, BitmapText, create-pixi, how do I draw, how do I render, how do I animate in pixi."
license: MIT
---

Entry point for the PixiJS v8 skill collection. PixiJS is the fastest library available for the web, working across all devices and allowing you to create rich, interactive graphics and cross-platform applications using WebGL, WebGPU, and Canvas as a fallback.

## mind-palace integration (read before mounting Pixi inside a component)

PixiJS is **first-party** in mind-palace at `pixi.js@^8.18.1` for any canvas-based UI. It is a **side channel** the same way anime.js is — render functions stay pure; everything that touches Pixi (`new Application()`, `Ticker.add(...)`, sprite mutation, scene-graph reads) lives inside `useEffect` / `useLayoutEffect` / event handlers, never during render.

The canonical lifecycle wrapper is **`usePixiApp(canvasRef, setup, deps)`** in `apps/<name>/app/canvas/use-pixi-app.ts`:

- Owns async `Application.init({ canvas, resizeTo, preference: "webgl", autoStart: options.autoStart ?? !reducedMotion })`.
- Calls the user `setup(app, { reducedMotion })` callback once init resolves; the callback registers children and Ticker tasks and may return a cleanup function.
- Tears down on unmount via `app.destroy(true, { children: true, texture: true })`, with cancellation that survives StrictMode double-mount.
- Detects `prefers-reduced-motion: reduce` once at mount and passes it to `setup`; callers must skip Ticker registration when true (static frames still render).
- Static scenes that only update on resize or pointer input should pass `autoStart: false` and call `app.render()` from those handlers.
- React owns the `<canvas>` DOM node; Pixi only paints into it. The wrapping component renders `<canvas ref={canvasRef}>` inside a sized container.

**Pillar mapping (same constraints as the rest of the stack):**

- **Pillar 1 (Storybook-first)** — every Pixi-wrapping component ships with a sibling `*.stories.tsx` and a Playwright story spec.
- **Pillar 2 (Zod-first types)** — Pixi-wrapping component props are still `z.object` schemas wrapped by `defineComponent`. Pixi-internal types (`Texture`, `Container`, etc.) are runtime-only and don't need Zod validation.
- **Pillar 3 (IDB-first state)** — game state (progress, score, settings) stays in `atomWithIDB`. Pixi `DisplayObject`s **never** own data; they read derived values via refs the React component updates from atom subscriptions.
- **Pillar 4 (CLI-gate-first)** — Pixi component story specs run in the Playwright `storybook` project under headless Chromium. WebGL via SwiftShader is reliable; the default `preference: "webgl"` in `usePixiApp` keeps tests deterministic.

Seed example: `apps/web/app/components/pixi-canvas-demo/` (and the same in the generator template) — a rotating square that demonstrates Ticker registration, reduced-motion short-circuit, and the canvas-ref-as-Pixi-canvas pattern.

## How to use this skill

1. Find the specialized skill in the router below that best matches the task.
2. Load that skill's `SKILL.md` and follow its guidance.
3. If no sub-skill fits (the task references a specific class, function, option, or API surface not listed below), **WebFetch `https://pixijs.download/release/docs/llms.txt`**. That file is the auto-generated, always-current index of the full PixiJS API and guides. Each entry links to a `.html.md` page you can WebFetch for the detailed content.

For the long-form description and trigger keywords of every skill, see [references/index.md](references/index.md).

## Skill router

### Foundations

| Skill | Load when... |
|---|---|
| [pixijs-application](../pixijs-application/SKILL.md) | Creating or configuring a PixiJS `Application`, calling `app.init()`, accessing `app.stage`/`renderer`/`canvas`/`screen`, resize/ticker plugins, `app.destroy()`. |
| [pixijs-core-concepts](../pixijs-core-concepts/SKILL.md) | Understanding the renderer pipeline, choosing WebGL/WebGPU/Canvas, render loop internals, systems and pipes. |
| [pixijs-create](../pixijs-create/SKILL.md) | Scaffolding a new project with the `create-pixi` CLI (bundler-vite, creation-web, framework-react templates). |
| [pixijs-environments](../pixijs-environments/SKILL.md) | Running PixiJS in Web Workers, Node/SSR, or strict-CSP contexts (`DOMAdapter`, `WebWorkerAdapter`, `pixi.js/unsafe-eval`). |
| [pixijs-migration-v8](../pixijs-migration-v8/SKILL.md) | Upgrading from v7 to v8 or fixing v7 patterns (`beginFill`/`endFill`, `@pixi/*` packages, `BaseTexture`, `DisplayObject`). |
| [pixijs-scene-core-concepts](../pixijs-scene-core-concepts/SKILL.md) | Understanding the scene graph as a whole: containers vs leaves, transforms, render order, masking, `RenderLayer`. |

### Scene Objects

| Skill | Load when... |
|---|---|
| [pixijs-scene-container](../pixijs-scene-container/SKILL.md) | Working with `Container`: `addChild`/`removeChild`, transforms, `zIndex`, bounds, `toGlobal`/`toLocal`, `destroy`. |
| [pixijs-scene-sprite](../pixijs-scene-sprite/SKILL.md) | Drawing images: `Sprite`, `AnimatedSprite`, `NineSliceSprite`, `TilingSprite`. |
| [pixijs-scene-graphics](../pixijs-scene-graphics/SKILL.md) | Drawing vector shapes or paths: `Graphics`, `GraphicsContext`, `fill`/`stroke`, `FillGradient`, SVG. |
| [pixijs-scene-text](../pixijs-scene-text/SKILL.md) | Rendering text: `Text`, `BitmapText`, `HTMLText`, `SplitText`, `TextStyle`. |
| [pixijs-scene-mesh](../pixijs-scene-mesh/SKILL.md) | Custom geometry: `Mesh`, `MeshSimple`, `MeshPlane`, `MeshRope`, `PerspectiveMesh`. |
| [pixijs-scene-particle-container](../pixijs-scene-particle-container/SKILL.md) | Rendering thousands of lightweight sprites: `ParticleContainer`, `Particle`, `dynamicProperties`. |
| [pixijs-scene-dom-container](../pixijs-scene-dom-container/SKILL.md) | Overlaying HTML elements on the canvas: `DOMContainer`, `pixi.js/dom`. |
| [pixijs-scene-gif](../pixijs-scene-gif/SKILL.md) | Displaying animated GIFs: `GifSprite`, `GifSource`, `pixi.js/gif`. |

### Utilities

| Skill | Load when... |
|---|---|
| [pixijs-assets](../pixijs-assets/SKILL.md) | Loading resources: `Assets.init`, `Assets.load`, bundles, manifests, spritesheets, caching. |
| [pixijs-color](../pixijs-color/SKILL.md) | Creating or converting colors: `Color` class, hex/rgb/hsl, `tint`, `premultiply`. |
| [pixijs-events](../pixijs-events/SKILL.md) | Handling pointer/mouse/touch/wheel input: `eventMode`, `FederatedEvent`, `hitArea`, `cursor`, drag. |
| [pixijs-math](../pixijs-math/SKILL.md) | Points, vectors, matrices, shapes, hit testing: `Point`, `Matrix`, `Rectangle`, `toGlobal`/`toLocal`. |
| [pixijs-ticker](../pixijs-ticker/SKILL.md) | Per-frame logic or controlling the render loop: `Ticker`, `deltaTime`, `UPDATE_PRIORITY`, `maxFPS`. |

### Advanced

| Skill | Load when... |
|---|---|
| [pixijs-accessibility](../pixijs-accessibility/SKILL.md) | Screen reader or keyboard navigation: `AccessibilitySystem`, `accessibleTitle`, `tabIndex`. |
| [pixijs-blend-modes](../pixijs-blend-modes/SKILL.md) | Compositing with blend modes: `add`, `multiply`, `screen`, `overlay`, `pixi.js/advanced-blend-modes`. |
| [pixijs-custom-rendering](../pixijs-custom-rendering/SKILL.md) | Writing custom shaders, uniforms, or batchers: `Shader.from`, `GlProgram`/`GpuProgram`, `UniformGroup`, custom `Filter`. |
| [pixijs-filters](../pixijs-filters/SKILL.md) | Applying visual effects: `BlurFilter`, `ColorMatrixFilter`, `DisplacementFilter`, `Filter.from`, `pixi-filters`. |
| [pixijs-performance](../pixijs-performance/SKILL.md) | Profiling or optimizing FPS, draw calls, GPU memory: culling, `GCSystem`, `cacheAsTexture`, object pooling. |

## Fallback: canonical PixiJS docs

If the task references a class, function, option, or API surface not covered by any sub-skill above, **WebFetch `https://pixijs.download/release/docs/llms.txt`**. It's the auto-generated index of the full PixiJS API and guides, regenerated on every release. Each entry links to a `.html.md` page you can WebFetch for the detailed content. Use this fallback whenever the router table doesn't point at an obvious match.
