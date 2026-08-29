#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$workspace_root"

required_files=(
  "AGENTS.md"
  "README.md"
  ".agents/skills/five-phase-pass/SKILL.md"
  "docs/import-provenance.md"
  "docs/process-engineering-guide.md"
  "docs/benchmarks.md"
  "docs/adr/0001-tidb-materialization.md"
  "docs/evidence/bounded-report.json"
  "docs/evidence/store-1m.json"
  "packages/cms-db/package.json"
  "packages/cms-domain/package.json"
  "packages/cms-service/package.json"
  "packages/cms-scenarios/package.json"
  "apps/cms/package.json"
  "scripts/run-scenario-evidence.ts"
  "scripts/verify-evidence.ts"
  "scripts/verify-imported-skills.ts"
)

for required_file in "${required_files[@]}"; do
  if [[ ! -f "$required_file" ]]; then
    printf 'five-phase-pass: missing required artifact: %s\n' "$required_file" >&2
    exit 1
  fi
done

printf 'Phase 1/5 — reproducible shell and SQLite baseline\n'
bun install --frozen-lockfile
bun run check:boundaries
bun run skills:verify
bun run db:reset
bun run db:seed

printf 'Phase 2/5 — relational foundation checks\n'
bun run --filter @repo/cms-db test
bun run db:benchmark

printf 'Phase 3/5 — selector, resolution, and publication checks\n'
bun run --filter @repo/cms-domain test
bun run --filter @repo/cms-service test

printf 'Phase 4/5 — HUD and scenario build\n'
bun run --filter cms test
bun run scripts/run-scenario-evidence.ts \
  --output .data/five-phase-scenario-proof.json \
  --database .data/five-phase-scenario.sqlite \
  --pages 1000 \
  --samples 100 \
  --cases 200 \
  --seed 1592639710
bun run scripts/verify-evidence.ts bounded .data/five-phase-scenario-proof.json
bun run build

printf 'Phase 5/5 — cross-workspace audit\n'
bun run evidence:verify:bounded
bun run evidence:verify
bun run check:boundaries
bun run lint
bun run check-types
bun run test
bun run fallow:audit

printf 'five-phase-pass: all phases passed\n'
