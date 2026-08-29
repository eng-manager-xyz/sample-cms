---
name: zod
description: "Zod 4 schema authoring for mind-palace — every type comes from `z.infer<typeof Schema>`, every boundary input is parsed (never cast), and the dev-only `defineComponent(schema, fn)` wraps `schema.parse` so production tree-shakes the runtime check. Triggers on: parse, refine, safeParse, schema, transform, z.infer, z.object, zod, zod 4, ZodError."
license: MIT
---

The producer for the schema universe. Owns "how to write a schema" and "how to read its parse failure"; every other Wave 2 skill (`t3-env`, `idb`, `jotai`) imports `z` from here and links back for authoring rules.

## When to invoke
- Authoring a `z.object` for component props, an atom value, an IDB record, an env var, or a route param.
- Diagnosing a `ZodError` surfaced in the browser console during dev.
- Choosing between `z.union`, `z.discriminatedUnion`, `.refine`, `.superRefine`, `.transform`, or `z.codec`.
- Deriving a TypeScript type — must be `z.infer<typeof Schema>`, never hand-written.
- Building or modifying the `defineComponent(schema, fn)` helper.

## Owns
Zod 4 schema authoring, `z.infer`, `z.object`, error formatting, codecs/transforms, JSON schema export, and the `defineComponent(schema, fn)` dev-only parse helper.

## Defers to
- `ts` — for `tsgo --noEmit` strictness and the `import type` rule under `verbatimModuleSyntax`. zod owns the "use `z.infer`" rule; ts owns the compiler config that makes it bite.
- `bun-test` — for unit-testing schema edge cases (`safeParse` failure paths, refinement semantics).

## Dean-stack rules
- Pillar 2 (Zod-first types) means: every props object, atom value, IDB record, env var, and route param starts as `z.object({...})`; the TypeScript type is `z.infer<typeof Schema>`; module-boundary inputs are parsed (never `as`-cast). `defineComponent(schema, fn)` calls `schema.parse(props)` only when `import.meta.env.DEV` so production tree-shakes the call.
- Pillar 4 (CLI-gate-first) means: Zod runtime errors in the dev browser console are gate failures of the same severity as a TS error or a Biome warning — fix before continuing.
- Zod 4 only. v3 syntax (`z.string().email()`, `errorMap`, `err.format()`, `err.flatten()`, `.merge()`, single-arg `z.record()`, `z.nativeEnum()`, `.nonempty()`) is wrong by definition — rewrite to the v4 API.

## Patterns

### Schema → type → parse, the canonical loop
```ts
// pinned: zod 4
import * as z from "zod";

export const ScoreSchema = z.object({
  value: z.int().min(0),
  player: z.string().min(1),
});
export type Score = z.infer<typeof ScoreSchema>; // never hand-written

function loadScore(raw: unknown): Score {
  return ScoreSchema.parse(raw); // throws on invalid; type-narrows the return
}
```
`z.int()` is the safe-integer primitive (preferred over `z.number().int()`). The type comes from the schema — the rule is enforced cooperatively with `ts`.

### `defineComponent(schema, fn)` — dev-only parse, prod tree-shake
```ts
// apps/web/app/lib/define-component.ts
import type { ZodType } from "zod";

export function defineComponent<S extends ZodType, R>(
  schema: S,
  fn: (props: z.infer<S>) => R,
): (props: z.infer<S>) => R {
  if (import.meta.env.DEV) {
    return (props) => fn(schema.parse(props));
  }
  return fn;
}
```
The `if (import.meta.env.DEV)` branch is statically replaced by Vite (`true` in dev, `false` in prod) so the production bundle drops the `schema.parse` call entirely. Component files use it like:
```tsx
const PropsSchema = z.object({ label: z.string().min(1) });
export const Button = defineComponent(PropsSchema, ({ label }) => <button>{label}</button>);
```

### `safeParse` for explicit control flow
```ts
const result = ScoreSchema.safeParse(raw);
if (!result.success) {
  console.error(z.prettifyError(result.error));   // Zod 4 — multi-line, human readable
  for (const issue of result.error.issues) {       // Zod 4 — `.issues`, not `.format()`
    report({ path: issue.path, code: issue.code, message: issue.message });
  }
  return;
}
const score = result.data; // typed as Score
```
Use `z.prettifyError`, `z.treeifyError`, or `z.flattenError` — never the v3 `.format()` / `.flatten()` instance methods.

### Discriminated union (preferred over `z.union` when a tag exists)
```ts
const EventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("score"), value: z.int().min(0) }),
  z.object({ kind: z.literal("levelUp"), to: z.int().min(1) }),
]);
type Event = z.infer<typeof EventSchema>;
```
O(1) routing on the discriminator. Reach for `z.union([...])` only when no shared tag exists.

### Refinement and cross-field check
```ts
const RangeSchema = z
  .object({ min: z.int(), max: z.int() })
  .refine((r) => r.min <= r.max, { error: "min must be ≤ max", path: ["max"] });
```
`.refine` for a single predicate; `.superRefine((val, ctx) => ctx.addIssue({...}))` for multi-issue checks. v3's `.refinement(...)` does not exist.

### Codec for bidirectional boundary transforms
```ts
const dateCodec = z.codec(z.iso.datetime(), z.date(), {
  decode: (s) => new Date(s),
  encode: (d) => d.toISOString(),
});
const RecordSchema = z.object({ id: z.uuid(), at: dateCodec });

// IDB / network read:
const value = z.decode(RecordSchema, raw);          // ISO string → Date
// IDB / network write:
const wire = z.encode(RecordSchema, value);          // Date → ISO string
```
Plain `.transform(...)` is one-way and `z.encode` will throw on it at runtime. Use `z.codec` whenever the schema crosses a boundary in both directions (IDB write/read, network in/out).

### Branded types for nominal IDs
```ts
const UserId = z.uuid().brand<"UserId">();
type UserId = z.infer<typeof UserId>;
const id: UserId = UserId.parse(raw); // a plain string is no longer assignable
```
Brands keep `UserId` and `RoomId` distinct at the type level even though both are strings at runtime.

## Anti-patterns
- **Don't hand-write a TS type that mirrors a schema** — use `z.infer<typeof Schema>` (`ts` enforces the same rule from the compiler side).
- **Don't `as`-cast at a module boundary** — parse with `safeParse` / `parse` and let the failure carry information.
- **Don't use v3 syntax** — `z.string().email()` → `z.email()`; `errorMap` / `invalid_type_error` / `required_error` / `message` → unified `error` param; `.merge()` → `{ ...A.shape, ...B.shape }`; single-arg `z.record(value)` → `z.record(key, value)`; `z.nativeEnum(E)` → `z.enum(E)`; `.nonempty()` → `.min(1)`; `err.format()`/`err.flatten()` → `z.treeifyError`/`z.flattenError`/`z.prettifyError`.
- **Don't call `schema.parse(props)` directly inside a component render** — use `defineComponent(schema, fn)` so production tree-shakes the runtime call.
- **Don't ignore a Zod console error in dev** — Pillar 4 treats it as a gate failure. Fix it.
- **Don't reach for `z.lazy(() => Self)` for recursion** — use the v4 getter form `get children() { return z.array(Self); }`.

## Triggers on
parse, refine, safeParse, schema, transform, z.infer, z.object, zod, zod 4, ZodError
