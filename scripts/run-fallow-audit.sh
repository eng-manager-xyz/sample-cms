#!/usr/bin/env bash
set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$workspace_root"

status=0
report="$(bun run fallow dead-code --format json --quiet --explain --fail-on-issues 2>/dev/null)" || status=$?
printf '%s\n' "$report"

if [[ "$status" -eq 2 ]]; then
  printf 'fallow-audit: analysis failed to run\n' >&2
  exit 2
fi

if [[ "$status" -ne 0 ]]; then
  printf 'fallow-audit: dead-code or architecture findings failed the gate\n' >&2
  exit 1
fi
