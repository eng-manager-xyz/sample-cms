---
name: idb
description: "Jake Archibald's `idb` v8 wrapper for IndexedDB in mind-palace — owns the IDB primitives (`openDB`, `IDBPDatabase<Schema>`, transactions, indexes, cursors), schema-versioned `upgrade` migrations, the root `idbHydrationPromise` consumed by `use()` at the app shell, and the `BroadcastChannel` re-hydration broadcast that keeps tabs/iframes in sync. Triggers on: atomWithIDB storage, BroadcastChannel sync, idb, IDBPDatabase, idb hydration, idb migration, idb migration test, IndexedDB, object store, openDB, upgrade callback."
license: MIT
---

The producer of the IDB-first state contract per AGENTS.md Pillar 3. Owns every byte that touches IndexedDB. `jotai` consumes this skill via the `atomWithIDB` factory and re-exports the hydration promise; nothing else opens an IDB connection in this app.

## When to invoke
- Authoring `apps/web/app/state/db.ts` (the singleton `openDB<AppDB>` call).
- Adding a new object store or index, or bumping the schema version with a migration.
- Wiring the root `idbHydrationPromise` into the `<Suspense>` boundary that fronts the whole app.
- Wiring the `BroadcastChannel` that re-hydrates other tabs / Storybook iframes after a write.
- Diagnosing a "transaction has finished" error or a migration that ran on the wrong oldVersion.
- Writing a unit test (in `bun test`) for a migration's *transform function*. The integration runs in Playwright.

## Owns
The `idb` library wrapper around IndexedDB: `openDB`, object stores, indexes, transactions, schema-versioned `upgrade` migrations, the `atomWithIDB` storage adapter, and the root hydration promise consumed by `use()`.

## Defers to
- `zod` — for *how to author* the record schemas this skill validates. Each object store has a `z.object` per record shape; `safeParse` runs inside the `upgrade` callback to rescue or drop bad rows.
- `jotai` — for the `atomWithIDB(schema, key, default)` factory itself. `idb` owns the IDB primitives the factory calls; `jotai` owns the atom contract.
- `bun-test` — for unit-testing migration *transform functions* (pure `(oldRow) => newRow` logic). The real `openDB` upgrade path is Playwright.

## Dean-stack rules
- Pillar 3 (IDB-first state) means: every byte of game progress, settings, or content lives in an object store first; in-memory atoms are caches. The single root `idbHydrationPromise` resolves once at startup and the schema migration runs inside that promise — no atom resolves until IDB is the source of truth at the current schema version.
- Pillar 2 (Zod-first types) means: every record's TS type is `z.infer<typeof RecordSchema>` (see `zod`). The `upgrade` callback re-parses old rows against the new schema and treats parse failure as data loss to surface (not silently swallow).
- Pillar 4 (CLI-gate-first) means: a Zod parse failure during hydration or a thrown migration in dev surfaces in the browser console and blocks `bun run dev`. Migration *transforms* are unit-tested in `bun test`; the real upgrade is exercised in Playwright (`playwright-app-tests`, forward).
- The service worker never touches IDB. IDB is application code.
- Never `await` a non-IDB Promise (fetch, setTimeout, postMessage) inside an open transaction — the tx auto-closes on the next microtask turn with no IDB work pending.

## Patterns

### Singleton open with typed schema, version, and all four lifecycle callbacks
```ts
// apps/web/app/state/db.ts
// pinned: idb ^8.x, zod ^4.x
import { type DBSchema, type IDBPDatabase, openDB } from "idb";

export interface AppDB extends DBSchema {
  progress: { key: string; value: { id: string; level: number; completed: boolean } };
  settings: { key: string; value: { id: "settings"; theme: "light" | "dark"; reducedMotion: boolean } };
}

const DB_NAME = "mind-palace";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<AppDB>> | undefined;

export function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      // Fall-through is intentional — do not `break`.
      switch (oldVersion) {
        case 0: {
          db.createObjectStore("progress", { keyPath: "id" });
        }
        // falls through
        case 1: {
          const settings = db.createObjectStore("settings", { keyPath: "id" });
          // backfill from existing rows is allowed — `tx` is the live versionchange transaction
          void settings.put({ id: "settings", theme: "light", reducedMotion: false });
        }
      }
    },
    blocked() { console.warn("idb: blocked by an older connection"); },
    blocking() { void getDB().then((db) => db.close()); dbPromise = undefined; },
    terminated() { dbPromise = undefined; },
  });
  return dbPromise.catch((err) => { dbPromise = undefined; throw err; });
}
```
**Two equivalent forms; pick one** — both run every hop cumulatively:

- `switch (oldVersion)` with deliberate fall-through (canonical, but trips Biome's `noFallthroughSwitchClause` — needs a `// biome-ignore` comment).
- **`if (oldVersion < N)` cascading checks** (Biome-clean, what mind-palace uses today). Each `if` runs for every user below that version, achieving the same cumulative effect.

Never use `if (oldVersion === N)` — that fails users on older versions.

### Root hydration promise — resolves the *whole* in-memory cache once
```ts
// apps/web/app/state/hydration.ts
import * as z from "zod";
import { getDB } from "./db";

const ProgressRecord = z.object({
  id: z.string().min(1),
  level: z.int().min(1),
  completed: z.boolean(),
});
const SettingsRecord = z.object({
  id: z.literal("settings"),
  theme: z.enum(["light", "dark"]),
  reducedMotion: z.boolean(),
});

export type HydratedState = {
  progress: ReadonlyMap<string, z.infer<typeof ProgressRecord>>;
  settings: z.infer<typeof SettingsRecord>;
};

// Single promise, started once at module load — every atom reads sync from this after it resolves.
export const idbHydrationPromise: Promise<HydratedState> = (async () => {
  const db = await getDB();
  const [rawProgress, rawSettings] = await Promise.all([
    db.getAll("progress"),
    db.get("settings", "settings"),
  ]);
  const progress = new Map(
    rawProgress
      .map((r) => ProgressRecord.safeParse(r))
      .filter((r) => r.success)
      .map((r) => [r.data.id, r.data] as const),
  );
  const settings = SettingsRecord.parse(rawSettings ?? { id: "settings", theme: "light", reducedMotion: false });
  return { progress, settings };
})();
```
Started at import time so the promise is already in flight before React mounts. The `<Suspense>` boundary at the app shell calls `use(idbHydrationPromise)` once; after that, every `atomWithIDB` reads its initial value synchronously from this snapshot — see `jotai`.

### Debounced write-through (~150ms) + BroadcastChannel re-hydration
```ts
// apps/web/app/state/persist.ts
import { getDB } from "./db";

const channel = new BroadcastChannel("mind-palace:idb");
const pending = new Map<string, NodeJS.Timeout>();

export function persistProgress(value: { id: string; level: number; completed: boolean }) {
  const key = `progress:${value.id}`;
  clearTimeout(pending.get(key));
  pending.set(
    key,
    setTimeout(async () => {
      const db = await getDB();
      await db.put("progress", value);
      channel.postMessage({ store: "progress", key: value.id });
    }, 150),
  );
}

// Other tabs / the Storybook iframe listen and re-hydrate.
export function subscribeRemoteWrites(onChange: (msg: { store: string; key: string }) => void) {
  const handler = (e: MessageEvent) => onChange(e.data);
  channel.addEventListener("message", handler);
  return () => channel.removeEventListener("message", handler);
}
```
`~150ms` debounce per AGENTS.md Pillar 3. The `BroadcastChannel` name is stable across tabs/iframes; `jotai` subscribes via `subscribeRemoteWrites` and re-runs hydration for the affected store.

### Atomic multi-store write
```ts
const tx = db.transaction(["progress", "settings"], "readwrite");
await Promise.all([
  tx.objectStore("progress").put({ id, level, completed }),
  tx.objectStore("settings").put({ id: "settings", theme, reducedMotion }),
  tx.done, // commit signal — must be in the Promise.all or awaited explicitly
]);
```
`tx.done` is the only signal that all writes committed. If any operation rejects, the whole transaction aborts.

### Async iteration on an index
```ts
const tx = db.transaction("progress");
const since = IDBKeyRange.lowerBound(1);
for await (const cursor of tx.store) {
  if (cursor.value.level < 1) cursor.delete();
}
await tx.done;
```
v8 ships async iterators in the default build — never import from `idb/with-async-ittr` (removed in 8.x).

### Migration transform — unit-testable function (Playwright runs the integration)
```ts
// apps/web/app/state/migrations/v1-to-v2.ts
export function migrateProgressV1toV2(old: { id: string; level: number }) {
  return { ...old, completed: false };
}
```
The pure function ships with a sibling `*.test.ts` file (see `bun-test`). The real `upgrade(db, 1, 2, tx)` calling this function over a real IDB lives in Playwright (`idb migration test`).

## Anti-patterns
- **Don't open more than one connection** — `getDB()` is a module-level singleton. Multiple connections fight over the version-change lock.
- **Don't `await` `fetch` (or any non-IDB Promise) inside an open transaction** — the tx auto-closes on the next microtask, and the next IDB call throws "transaction has finished." Read → close tx → fetch → open new tx → write.
- **Don't write `if (oldVersion === N)` in `upgrade`** — use `switch (oldVersion)` with intentional fall-through so a user upgrading 1→3 runs the 1→2 *and* 2→3 paths.
- **Don't open a fresh transaction inside `upgrade`** — use the `tx` argument; it's the live `versionchange` transaction.
- **Don't import from `idb/with-async-ittr`** — removed in v8. Async iterators are bundled in `idb`.
- **Don't put state in `useState` if losing it on a hot reload would be noticed** — that's the iPad-over-LAN failure mode AGENTS.md Pillar 3 calls out. Use `atomWithIDB` (see `jotai`).
- **Don't touch IDB from the service worker** — assets are the SW's job; IDB is application code.
- **Don't validate IDB records with hand-written types** — every record is parsed against a `z.object` schema (see `zod`); a `safeParse` failure on hydration is data loss to surface.

## Triggers on
atomWithIDB storage, BroadcastChannel sync, idb, IDBPDatabase, idb hydration, idb migration, idb migration test, IndexedDB, object store, openDB, upgrade callback
