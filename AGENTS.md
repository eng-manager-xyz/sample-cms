# Repository instructions

These instructions apply to the entire repository.

## Linear is the source of truth

All planning and implementation work for this repository belongs to the
[CMS project in Linear](https://linear.app/harwood/project/cms-d9fccc6885e7/overview).
Treat the current Linear project, milestone, and issue descriptions as the
canonical source for scope, priority, dependencies, acceptance criteria, and
status. If this file conflicts with Linear, follow the latest Linear content
and update this file when the difference represents a lasting convention.

The project starts from:

- [AUT-514 — Slot-and-variant CMS prototype](https://linear.app/harwood/issue/AUT-514/prototype-slot-and-variant-cms-with-deterministic-block-resolution)
- [Requirements and process model](https://linear.app/harwood/document/auteur-slotvariant-cms-prototype-requirements-and-process-model-8a853ac0b63a)

Every substantive change must map to an `AUT-*` issue in the CMS project.
Before coding:

1. Read the latest issue, its parent, milestone, relations, and linked resources.
2. Confirm the requested work matches its acceptance criteria and dependencies.
3. Use Linear's suggested branch name when creating a branch.
4. Move the issue to In Progress when implementation begins, when authorized and
   Linear write access is available.

Keep work scoped to the selected issue. Record material decisions, changed
assumptions, or newly discovered follow-up work in Linear instead of creating a
separate local backlog. Do not silently expand an issue. If no issue matches a
non-trivial request, ask whether to add one to the CMS project.

At handoff, reference the issue ID, report the validation performed, and keep its
status accurate. Mark an issue Done only after its acceptance criteria pass;
otherwise leave a concise status update describing what remains. If Linear is
unavailable or read-only, include the intended status update in the handoff.

## Product contract

Build an executable TypeScript/SQLite prototype of Auteur's relational,
selector-scoped slot-and-variant content model. Authoring state is expressive,
layered, and queryable; publication compiles it into deterministic, immutable,
cacheable documents for serving.

Preserve these invariants:

- One canonical URL maps to exactly one template and one page instance.
- A template owns one default layer; defaults never span templates.
- Variants are template-scoped selectors with sparse block operations and
  explicit precedence.
- Stable placement keys identify document positions across reordering, content
  versions, and block-type replacement.
- Published block versions are immutable. Editing inherited content is
  copy-on-write; hiding it creates a tombstone; reverting removes the local
  operation.
- Same-priority conflicts on the same placement fail publication. Creation time
  and row IDs must never choose a winner.
- Selector SQL runs only during preview or publication, against an approved read
  surface. It never runs on the public request path.
- Publication is atomic and retains a rollback target. Serving reads the
  materialized result and records provenance for each effective placement.
- Camo Press remains the route-existence and serving-status authority at the
  prototype's transition seam.

The prototype must prove all three scenarios defined in Linear: dense Eligible
Vehicles variation, sparse Store variation at million-row scale, and structural
block-type replacement with at least 90% inheritance.

## Technology boundaries

Use the stack specified by Linear:

- Bun workspaces and Turborepo
- TanStack Start, React, and TypeScript
- TanStack Router, Query, and Table where useful
- shadcn/ui for the deliberately wireframe-like interface
- local SQLite through `bun:sqlite`, isolated behind `@repo/cms-db`, with
  Drizzle ORM and committed migrations

Do not add Rust or SQLx to this prototype. Keep selector and publication SQL
visible, inspectable, and portable enough to inform the later TiDB design.
Prefer the smallest dependency that proves the model; do not turn prototype
shortcuts into exceptions to the domain invariants.

## Delivery order

Follow the dependency order represented by the Linear milestones:

1. Model foundation
2. Authoring and resolution engine
3. Visual proof scenarios
4. Validation and handoff

Do not implement later-milestone behavior by bypassing unfinished foundational
contracts. When a task exposes a missing prerequisite, surface it in Linear and
resolve the dependency explicitly.

## Repository workflow

`AUT-515` owns the reduced shell imported from Median PR #15. Use the audited PR
head recorded in `docs/import-provenance.md` as an interface and tooling donor,
not as a domain-model source. Do not reintroduce Median's PostgreSQL/Supabase,
auth, deployment, Rust, or route-tree inheritance surfaces.

Use the checked-in Bun lockfile and root scripts:

- install: `bun install --frozen-lockfile`
- development: `bun run dev`
- build: `bun run build`
- typecheck: `bun run check-types`
- test: `bun run test`
- lint: `bun run lint`
- migrate/reset/seed: `bun run db:migrate`, `bun run db:reset`, and
  `bun run db:seed`
- final cross-surface gate: `bun run five-phase-pass`

TanStack file routes live in `apps/cms/src/routes`. Never hand-edit generated
`routeTree.gen.ts`. Browser code must never import `bun:sqlite` or the database
client; database access crosses a TanStack server-function boundary.

The complete prior skill inventory is preserved under
`.agents/skills/_imported/mind-palace`. Use the promoted stack-relevant skills
from `.agents/skills`, especially `five-phase-pass`, without importing
Mind Palace-specific product, Pixi, Storybook, Firebase, or deployment behavior
into this CMS.

Keep changes reviewable and issue-sized. Preserve unrelated user changes. Add a
Drizzle migration for every schema change; do not mutate a shared SQLite database
by hand. Make seeds repeatable and deterministic.

Tests should emphasize externally visible behavior and the project's invariants,
especially deterministic resolution, selector isolation and safety, conflict
detection, copy-on-write, tombstones, publication atomicity, provenance, and
manifest reuse. Run the narrowest relevant checks while iterating and the full
documented validation suite before handoff.

## Definition of done

Work is complete only when:

- the selected Linear issue's acceptance criteria are satisfied;
- relevant tests, type checks, lint, build, and migrations pass;
- schema, seed, and architectural changes are documented where future work will
  find them;
- the implementation does not weaken the product invariants above; and
- the handoff names the Linear issue and accurately reports status and evidence.
