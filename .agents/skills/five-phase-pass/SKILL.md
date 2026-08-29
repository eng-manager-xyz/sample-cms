---
name: five-phase-pass
description: Run the Auteur CMS prototype through its five delivery phases, Linear acceptance evidence, cross-workspace drift audit, and final Bun/Turborepo/SQLite validation. Use when asked for /five-phase-pass, a full project gate, or completion of AUT-514 through AUT-532.
---

# Auteur five-phase pass

Use this workflow to prove the prototype is coherent across the live app, shared packages, SQLite
artifacts, proof scenarios, documentation, and Linear. This repository has no app generator
template; do not import Mind Palace's generator, Pixi, Storybook, Firebase, or deployment phases.

The current [Linear CMS project](https://linear.app/harwood/project/cms-d9fccc6885e7/overview) is the
source of truth. Read the relevant issues before each phase and record actual evidence before moving
them to Done.

## Phase 1 — import and compiling local shell

Owns `AUT-515`.

- Verify `docs/import-provenance.md` still identifies the audited Median PR #15 head.
- Run `bun run skills:verify`; the complete prior-project snapshot must match its recorded file,
  skill, and SHA-256 inventory.
- Keep only the Bun/Turborepo/TanStack/shadcn interface and tooling surfaces needed by the prototype.
- Run a fresh install, migration, deterministic reset/seed, SQLite health integration test,
  typecheck, and CMS build without production credentials.
- Confirm browser code reaches SQLite only through TanStack server functions.

Stop if the shell cannot be reproduced from committed files.

## Phase 2 — relational foundation

Owns `AUT-516` through `AUT-519` and the reusable block foundation in `AUT-521`.

- Apply committed migrations to an empty database.
- Verify canonical URL uniqueness, exactly one default per template, ordered slot constraints,
  route lifecycle rules, independent many-to-many tags, block schema validation, and published block
  immutability.
- Reset and seed twice; compare the committed fixture identity/hash evidence.
- Inspect representative query plans for canonical URL, template pagination, and both tag lookup
  directions.

Do not carry Median route-tree inheritance into the selector-overlay model.

## Phase 3 — authoring, resolution, and publication

Owns `AUT-520`, `AUT-522` through `AUT-525`.

- Run the selector attack corpus and bounded preview/overlap tests.
- Prove default CRUD, reorder-without-new-content-version, copy-on-write, tombstone versus revert,
  block-type replacement, and sparse multi-layer composition.
- Randomize input row order and require byte-stable effective documents, hashes, and provenance.
- Force conflict and write failures; publication must remain atomic and the former pointer active.
- Trace the serving query path and confirm it reads materialized output without selector execution.

## Phase 4 — HUD and proof scenarios

Owns `AUT-526` through `AUT-529`.

- Verify the wall of maps, map detail/projection, priority layer stack, three-pane editor, vertical
  pin inspector, draft/published diff, and publication surface use server-side pagination or bounded
  sampling.
- Run the dense Eligible Vehicles, sparse Store, and structural replacement walkthroughs.
- Require Store class goldens and the configurable million-row seed, preview, generic-service
  publication, idempotent republish, and benchmark.
- Require at least 90% inherited placements in structural replacement and honest manifest/storage
  metrics in dense variation.
- Build and smoke the primary routes with no console errors, failed requests, blank content, or
  inaccessible primary controls.

## Phase 5 — evidence, docs, ADR, and final audit

Owns `AUT-530` through `AUT-532`, then closes `AUT-514`.

- Regenerate the measured benchmark report with environment, row counts, timings, query plans,
  storage, and limitations. Never invent results.
- Generate evidence through `scripts/run-scenario-evidence.ts`; require the exact million-row
  envelope at `docs/evidence/store-1m.json` and validate both bounded and stress artifacts with
  `scripts/verify-evidence.ts`.
- Finish the process-engineering guide and TiDB materialization ADR from measured evidence.
- Audit `README.md`, `AGENTS.md`, promoted skills, migrations, package scripts, routes, and Linear for
  stale Median/Postgres/Supabase/auth/deployment assumptions.
- Run `bun run five-phase-pass`, which must cover lint, typecheck, tests, build, database/scenario
  evidence, and Fallow. Fix introduced findings; report inherited/tooling warnings explicitly.
- Mark issues Done only after their individual acceptance criteria and evidence are present.

## Final report

Report every phase as pass/fail with the owning issue IDs, commands run, measured evidence, remaining
limitations, and any deliberately retained differences. Completion requires all five phases and the
full compile gate to pass; a green UI build alone is insufficient.
