---
name: run-prompt
description: Use when asked to execute one or more saved prompts from `./prompts/`, including the old /run-prompt command syntax. Supports sequential execution by default and parallel execution when multi-agent tooling is available.
---

Execute prompt(s) from the ./prompts/ directory.

## Usage

Arguments: $ARGUMENTS

Parse the arguments to determine:
- **Prompt number(s)**: One or more 3-digit numbers (e.g., 001, 002, 003)
- **Execution mode**: `--parallel` or `--sequential` (default: sequential)
- **Model override**: `--model ...` (accepted for compatibility; ignore unless the available execution tool supports model selection)
- **Effort override**: `--effort low|medium|high|xhigh|max` (accepted for compatibility; treat as advisory unless the available execution tool supports effort controls)
- **Auto mode**: `--auto` (accepted for compatibility; Codex has no slash-command auto mode, so report that it is unavailable and continue manually)

## Execution Steps

1. **Parse arguments** to extract prompt numbers, execution mode, model override, effort override, and auto flag
2. **Locate prompt files** in ./prompts/ matching the pattern `[number]-*.md`
3. **Read each prompt file** to get the prompt content. **Effort precedence:** CLI flag > prompt-file hint (e.g., `Run at xhigh` or YAML frontmatter `effort:`) > session default.
4. **Execute prompts** according to the specified mode

### Sequential (default):
- Execute one at a time, wait for completion before starting next
- Between prompts, check context utilization. For multi-step chains where decisions or file paths must carry forward, write a state-handoff note to `./prompts/.state/[number]-handoff.md` before any compaction or handoff, capturing: decisions made, files modified, assumptions, and any deferred work.
- If a prompt fails, report what failed and ask whether to continue.

### Parallel:
- Launch each prompt as a separate subagent when multi-agent tooling is available. State the parallel intent explicitly when invoking.
- If `--model` or `--effort` overrides are specified and the tool supports them, pass them through to each subagent.
- Collect and report results as subagents complete

### Auto mode (`--auto`):
- Codex has no slash-command auto mode in this environment.
- Warn once, then continue in manual sequential or parallel mode according to the other flags.

## Examples

```
/run-prompt 001                                # Single prompt at session default effort
/run-prompt 001 002 003                        # Run sequentially
/run-prompt 001 002 --parallel                 # Parallel via subagents
/run-prompt 001 002 003 --sequential           # Explicitly sequential
/run-prompt 005 --model haiku                  # Specific model
/run-prompt 005 --effort low                   # Lower effort for narrow well-specified work
/run-prompt 010 011 --parallel --effort high   # Parallel subagents at high effort
/run-prompt 020 021 022 --auto                 # Specified chain, no check-ins
```

## Execution

First, list the ./prompts/ directory to find matching files:

```bash
ls ./prompts/ 2>/dev/null | grep -E "^[0-9]{3}-" | sort -V
```

For each prompt number provided:
1. Find the file matching pattern `[number]-*.md`
2. Read the prompt content
3. Capture any effort hint declared in the file
4. Resolve effort using precedence (CLI flag > file hint > session default)
5. Execute the prompt content as instructions, applying the resolved effort level

For **parallel mode**: use available multi-agent tooling to launch each prompt as a separate subagent, with explicit fan-out language ("Spawn parallel subagents, one per prompt; do not consolidate"). If no such tooling is available, report that and ask whether to run sequentially.

For **sequential mode**: execute prompts in order. Between prompts where the prior step did heavy file reading, exploration, or produced state the next prompt depends on:
1. Write `./prompts/.state/[N]-handoff.md` with decisions, file paths, assumptions, deferred items
2. If compaction or a new session is needed, use that handoff note as the durable summary
3. The next prompt's first action is to read its handoff note

For **auto mode**: Codex does not expose slash-command auto mode here. Warn once and continue manually.

## Effort Level Reference

When the user has not specified `--effort`, suggest one based on the prompt's scope:

- **`xhigh` / high effort** — most agentic coding: schema design, multi-file refactors, code review across a service, ambiguous debugging, multi-step agentic chains
- **`high`** — concurrent sessions, cost-sensitive agentic work where xhigh is overkill
- **`medium` / `low`** — narrow, well-specified tasks: classification, extraction, format conversion, single-file targeted fixes
- **`max`** — only for genuinely hard problems where xhigh underperforms; prone to overthinking, diminishing returns

If a prompt's task is clearly narrow on read, prompt the user: `This looks tightly scoped. Run with --effort low to save tokens? (y/N)`.

## Error Handling

- If `./prompts/` directory doesn't exist: `No ./prompts/ directory found. Run /prompt to create prompts first.`
- If prompt number not found: List available prompts with numbers and names, ask which to run
- If no arguments provided: List all available prompts and ask which to run
- If a prompt fails during execution: Report the specific error, what was attempted, what succeeded before the failure, and any state-handoff notes already written. Ask whether to continue with remaining prompts.
- If `--auto` is requested: warn that Codex auto mode is unavailable in this environment and fall back to manual mode
- If `--effort` is set to a value the current model doesn't support: warn and use the closest supported level

## After Execution

Report concisely:
- Which prompts ran, pass/fail status, and effort level applied to each
- Files created or modified (list paths)
- Verification results (test output, lint, typecheck)
- State-handoff notes written (paths)
- Suggested next action if applicable

For long chains, optionally wire a hook-based completion notification (sound, desktop notification) if the user asks.
