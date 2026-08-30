# Auteur slot-and-variant CMS prototype

An executable architecture prototype for a relational CMS that treats URL templates as isolated
multidimensional maps. Template-local defaults and selector-scoped variants contribute sparse,
versioned operations to stable block placements; publication compiles those layers into one
deterministic, cacheable document per live URL.

The implementation is tracked in the
[Linear CMS project](https://linear.app/harwood/project/cms-d9fccc6885e7/overview), beginning with
[AUT-514](https://linear.app/harwood/issue/AUT-514/prototype-slot-and-variant-cms-with-deterministic-block-resolution).

## Starting point

The application shell and monorepo conventions are deliberately derived from
[Median PR #15](https://github.com/matthewharwood/median/pull/15), audited at commit
`277f9b7c55668a320e52a8e68e136b6ef712ec0b`. Median is an interface and tooling donor, not a domain
model donor. Its production PostgreSQL/Supabase/auth/deployment surfaces are excluded from this
local prototype.

See [the import provenance record](docs/import-provenance.md) for the retained and removed surfaces.

## Stack

- Bun workspaces and Turborepo
- TanStack Start, Router, Query, and Table
- React 19 and TypeScript
- Tailwind CSS 4 and shadcn-style components/blocks
- Lazy Three.js and PixiJS explanatory models
- React Markdown/GFM with vendored Atkinson Hyperlegible Next variable fonts
- Local SQLite through Bun's native driver and Drizzle ORM
- Bun test, Biome, and Fallow

## Commands

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run db:seed
bun run dev
```

The application opens at `http://localhost:3000`. Its SQLite access remains behind TanStack server
functions; browser modules cannot import the database or service packages directly.

Open any `/templates/:templateId` route and choose **Block authoring** for the persisted workbench.
The HUD can add, reorder, version, replace, hide, and revert stable placements; create linked or
explicitly empty variants; preview and revise selectors; change priority; publish atomically; and
roll back the serving pointer. Its inputs are validated at the server-function boundary and then
delegate to the same `CmsService` used by the executable proofs. The Store foundation and bounded
Eligible Vehicles/structural workbenches are real SQLite rows; the projection, comparison, and
million-cardinality panels remain clearly labeled explanatory fixtures.

The chaptered architecture tutorial lives at `/tutorial`. Its typed plan joins six Markdown
chapters to exactly four sections each, enforces a three-hour-or-less uninterrupted path and a
30-minute per-section ceiling, and requires every section to build on the immediately preceding
one. Five reviewed UI-flow capture bundles provide MP4/WebM, posters, timed descriptions, complete
transcripts, and SHA-256 provenance under `apps/cms/public/media/tutorial/flows/`. They are embedded
only as visibly labeled reviewed previews; approved integration remains fail-closed pending final
Linear/source approval. Editorial-image provenance is separate in `illustrations.manifest.json`;
it records the requester's AUT-533 acceptance of the OpenAI-generated illustrations as substitutes
for the originally requested Google Imagen output.

The standard validation commands are:

```bash
bun run lint
bun run check-types
bun run test
bun run build
bun run scenarios:prove
bun run scenarios:evidence:bounded
bun run evidence:verify:bounded
bun run skills:verify
bun run fallow:audit
bun run five-phase-pass
```

The media suite always checks the committed derivatives, hashes, exact description transcripts,
and manifest/schema coherence. When `ffprobe` is available on `PATH` (or through
`FFPROBE_PATH=/absolute/path/to/ffprobe`), it also re-probes every MP4/WebM codec, pixel format,
frame size, frame rate, audio stream count, and measured duration. That probe test reports skipped
on machines without the optional binary rather than making the Bun workspace unreproducible.

`scenarios:evidence:bounded` writes the reproducible 1,000-page proof envelope to
`docs/evidence/bounded-report.json`. Use `bun run scenarios:benchmark:1m` only for the explicit
million-row Store proof. It writes the preserved SQLite database under `.data/` and the
machine-readable evidence ledger to `docs/evidence/store-1m.json`. Each envelope records the Git
commit and dirty state, lockfile hash, runtime/database versions, host resources, command, timings,
raw scenario counts, and known limitations. Local SQLite timings compare implementation shapes;
they are not production SLOs.

Long evidence runs emit newline-delimited JSON progress on stderr for seed, compile, write, and
idempotent-republish phases, throttled to 100,000-page intervals plus phase completion. The final
machine-readable envelope remains the JSON file named by `--output`.

`skills:verify` checks the exact prior-project skill snapshot recorded in the provenance document:
71 `SKILL.md` files across 115 files, including the three untracked skill directories present in the
source worktree. It fails on a missing, added, or changed imported file.

The final gate requires the committed million-row ledger; it intentionally fails if that artifact
is absent or does not prove exact scale, indexed lookup/preview, full generic service publication,
manifest reuse, idempotent republish, atomic failure behavior, and rollback.

## Workspace shape

```text
apps/cms                 TanStack Start authoring, inspection HUD, and architecture tutorial
packages/cms-db          SQLite schema, migrations, repositories, and deterministic fixtures
packages/cms-domain      Selector, resolution, provenance, and publication domain logic
packages/cms-service     Transactional authoring, preview, publish, rollback, and serve boundary
packages/cms-scenarios   Executable dense, sparse, structural, and generated-model proofs
packages/typescript-config
docs                     Process guide, measurements, and production ADR
```

The primary HUD routes are `/`, `/templates/stores`, `/templates/eligible-vehicles`,
`/templates/structural-proof`, and the corresponding `/publications/:templateId` views. UI
authoring and publication controls persist bounded SQLite state. Explanatory projections are
labeled as fixtures, and only the scenario evidence commands above create benchmark evidence.

## Five-phase delivery gate

The repository-specific `five-phase-pass` maps the prior workflow onto this project:

1. Median import and compiling local shell (`AUT-515`)
2. Relational model foundation (`AUT-516`–`AUT-519`, plus block foundations)
3. Authoring, deterministic resolution, and publication (`AUT-520`–`AUT-525`)
4. HUD and all three proof scenarios (`AUT-526`–`AUT-529`)
5. Correctness/scale evidence, process guide, TiDB ADR, and cross-surface audit (`AUT-530`–`AUT-532`)

The project is not complete merely because the UI builds. Every phase must have its acceptance
evidence, and the final workspace must migrate, seed, test, typecheck, lint, and build from a fresh
checkout without production credentials.
