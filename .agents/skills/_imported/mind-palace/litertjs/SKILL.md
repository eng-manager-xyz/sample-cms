---
name: litertjs
description: Add and operate LiteRT.js 2.5 browser-local inference in mind-palace. Use for `.tflite` model loading, Wasm asset hosting, WebGPU or WebNN accelerator selection, tensor preprocessing and cleanup, model-pipeline testing, or diagnosing LiteRT.js loading and inference failures.
---

# LiteRT.js

Use `@litertjs/core` for bounded, on-device inference that preserves the repository's static GitHub Pages architecture. Keep Wasm as the compatibility baseline and treat hardware acceleration as an optional optimization.

## Project contract

- Keep `@litertjs/core` in the app's production dependencies. Do not add TensorFlow.js or `@litertjs/tfjs-interop` unless the feature already needs a TFJS preprocessing pipeline.
- Run `bun run sync:litert` after install changes. The app's dev, build, and Storybook commands already run it; it copies the package's Wasm directory into ignored `public/litert/wasm/`.
- Self-host Wasm and `.tflite` files. Never use the LiteRT CDN in app code: it breaks the offline/privacy contract and makes runtime behavior depend on a third party.
- Build every public URL from `import.meta.env.BASE_URL`. Root-relative `/litert/...` paths break GitHub project Pages.
- Load through `app/lib/litert-runtime.ts`. It dynamically imports the package, validates runtime options in dev, loads the base-path-safe Wasm directory, and reuses LiteRT's app-session singleton.
- Start LiteRT from an effect, event handler, or lazy async feature boundary. Never initialize Wasm, compile a model, or run inference during React render or TanStack prerender.
- Keep model/tensor/GPU objects out of React state, Jotai, and IDB. Persist only durable domain outcomes through `atomWithIDB`.

## Build a model pipeline

1. Validate the model before UI work. Inspect input/output names, static shapes, and dtypes; run fake input through the official model tester when practical:

   ```bash
   bunx --package @litertjs/model-tester model-tester
   ```

2. Put the versioned model under `public/<feature>/models/`. Do not commit generated LiteRT Wasm files; the npm package and `bun.lock` own those.
3. Define Zod schemas for model metadata, preprocessing configuration, and decoded output. Check the model's tensor details at runtime when a mismatch would corrupt behavior.
4. Load the runtime and model only when the feature becomes active:

   ```ts
   const [{ Tensor, isWebGPUSupported }, { loadLiteRtRuntime }] = await Promise.all([
     import("@litertjs/core"),
     import("~/lib/litert-runtime"),
   ]);

   const runtime = await loadLiteRtRuntime();
   const accelerator = isWebGPUSupported() ? "webgpu" : "wasm";
   const model = await runtime.loadAndCompile(
     `${import.meta.env.BASE_URL}feature/models/model-v1.tflite`,
     { accelerator },
   );

   try {
     const input = new Tensor(new Float32Array(expectedSize), expectedShape);
     try {
       const outputs = await model.run(input);
       try {
         // Decode and Zod-parse outputs here.
       } finally {
         for (const output of outputs) output.delete();
       }
     } finally {
       input.delete();
     }
   } finally {
     model.delete();
   }
   ```

5. Keep preprocessing and decoding as pure functions and cover them with `bun:test`. For a UI surface, follow Storybook-first and ask the user before authoring the Playwright contract.
6. Profile on the target iPad. Accelerator availability is not proof that it is faster for a specific model or that every operator delegates.

## Select a backend

| Backend | Use | Constraints |
|---|---|---|
| `wasm` | Default correctness and compatibility path | CPU execution; still requires the self-hosted Wasm assets |
| `webgpu` | Opt-in after `isWebGPUSupported()` and real-device profiling | Operator coverage varies; keep a full Wasm fallback |
| `webnn` | Experiments where a dedicated NPU path is explicitly requested | Experimental browser flags/JSPI; never make product behavior depend on it |

Call `loadLiteRtRuntime({ jspi: true })` only after verifying JSPI support and only when WebNN or mixed WebGPU/Wasm execution requires it. Do not combine `jspi` and `threads`. Do not enable `threads` on GitHub Pages: the threaded Wasm build requires cross-origin isolation headers Pages cannot supply.

## Resource ownership

- Reuse the runtime singleton for the page session. The first load chooses the Wasm variant.
- Call `.delete()` on every compiled model, input tensor, moved/copied tensor, and output tensor. Put cleanup in `finally`; React unmount cleanup alone is too easy to bypass on errors.
- Avoid synchronous readback on accelerated paths. Prefer async tensor data access and minimize GPU-to-CPU copies.
- Treat inference as derived computation. Persist a user-visible decision or progress change, not the runtime object or raw scratch buffers.
- Keep Wasm and model files out of Workbox precache. If offline inference is required, use versioned runtime caching and verify both first-load-online and warm-cache-offline behavior.

## Diagnose failures

- A 404 for `litert_wasm_*`: run `bun run sync:litert`, then verify the request includes `import.meta.env.BASE_URL`.
- Unsupported operation: retry the complete model with `wasm`; do not assume partial delegation is available in every browser/variant.
- Shape or dtype mismatch: compare `model.getInputDetails()` / `getOutputDetails()` with the Zod-owned pipeline contract. Browser-facing input/output buffers must match the model's supported types.
- Load-time allocation failure: use a smaller or quantized model while preserving supported float32/int32 I/O; do not hide the failure behind a retry loop.
- Duplicate-load error: use `loadLiteRtRuntime()` instead of calling `loadLiteRt()` directly.

Use the official guide and API reference as source of truth: <https://developers.google.com/edge/litert/web/get_started>.
