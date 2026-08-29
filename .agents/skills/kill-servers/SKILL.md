---
name: kill-servers
description: Use when asked to kill stale mind-palace dev, preview, or Storybook server processes and free ports before `bun run check`, Playwright, or the five-phase-pass skill. Recreates the old /kill-servers command as a Codex skill.
---

<objective>
Stop every local mind-palace dev/preview/storybook server from prior runs and confirm their TCP ports are free. Idempotent and safe to run any time. Use as a pre-step before any gate or test run.
</objective>

<why>
Playwright's `webServer` config launches `bun run storybook` and `bun run preview` as child processes. If a previous run left a process holding port 6006 or 3000 (a backgrounded `bun run dev`, an aborted gate, an unkilled child of a previous test run), the new Playwright run can race against the zombie — Storybook reports "ready" briefly, the first parallel worker connects, the zombie gets reaped or the port-bind contention surfaces, and subsequent workers hit `ERR_CONNECTION_REFUSED`. This is *not* a timeout — it's a process-management race. Pre-killing eliminates it.
</why>

<steps>
Run these in order. Each is safe — `pkill` exits 0 even when nothing matches, and `lsof` exits 1 cleanly when nothing's listening.

```bash
# 1. Kill known mind-palace server processes by command-line pattern.
pkill -f "storybook dev"      || true
pkill -f "vite preview"       || true
pkill -f "vite dev"           || true
pkill -f "biome.*watch"       || true
pkill -f "stylelint.*watch"   || true

# 2. Let the OS reclaim TCP sockets out of TIME_WAIT.
sleep 2

# 3. Verify the gate-relevant ports are free.
#    3000 = vite preview (app, app-offline Playwright projects).
#    5173 = vite dev (Vite default).
#    6006 = storybook dev (storybook Playwright project).
lsof -i :3000 -i :5173 -i :6006 2>/dev/null | grep LISTEN || echo "all clear"

# 4. If anything is STILL listening (rare — usually a child process whose parent
#    was already killed), escalate with port-targeted SIGKILL.
lsof -ti :3000,:5173,:6006 2>/dev/null | xargs kill -9 2>/dev/null || true
```
</steps>

<caveats>
- `pkill -f "storybook dev"` matches **any** storybook dev process on the machine, not just mind-palace's. If you're running another Storybook project simultaneously, this will kill it too. For multi-project safety, use the port-targeted form: `lsof -ti :6006 | xargs kill`. Same caveat for `vite dev` / `vite preview`.
- This does NOT clear caches (Storybook prebundle, Turbo task cache). For that, separately: `rm -rf apps/*/node_modules/.cache/storybook .turbo`.
- This does NOT touch IDB, the SW, or any browser state. It only kills server processes.
</caveats>

<output>
A one-line status: either "all clear" (no listeners on 3000/5173/6006) or the lsof line showing what's still bound after the escalation step.
</output>
