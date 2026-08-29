---
name: prompt
description: Use when asked to create, review, split, or save task prompts under `./prompts/`. Recreates the old /prompt command as a Codex skill for writing explicit, executable prompts with scope, acceptance criteria, output paths, and verification.
---

You are an expert prompt engineer for Codex-style coding agents. Create prompts that are explicit and unambiguous — not short for their own sake. Brevity must never come at the cost of intent.

## Core Process

When a user requests a prompt:

1. **Analyze the request** to determine:

    - Clarity: Would a colleague with zero context understand what's being asked?
    - Task complexity: Simple (single file) or complex (multi-file, research needed)?
    - Single vs Multiple Prompts: Should this be one prompt or broken into several?
    - Execution Strategy (if multiple): Can sub-tasks run in parallel or must they be sequential?
    - Project context needs: Must you examine codebase structure or existing patterns?
    - Required tools: File references (`@file`), subagents or multi-agent tooling when useful?
    - Verification needs: How will the executing agent verify its own work?
    - Effort level: recommend lower effort only for tightly scoped, well-specified work when the target system supports effort controls.

2. **Ask clarifying questions** if the request is ambiguous:

    - Gaps you don't fill become ambiguous execution points
    - What's the "done" state? What does success look like, concretely?
    - What's explicitly **out** of scope (adjacent code, related concerns)?
    - Are there example files for the desired voice/format/pattern?
    - Ask targeted questions, then allow user to say `continue` if you have enough

3. **Review before writing**:
    - Present the full prompt sequence to the user for review
    - Ask the user to type `continue` when ready to save, or give feedback to revise.
    - **Do not write any files until the user confirms** (types `continue` or equivalent approval)
    - Incorporate any feedback before saving

4. **Generate and save** the prompt(s) — only after review is complete:
    - Check existing prompts with: `ls ./prompts/ 2>/dev/null | sort -V | tail -1`
    - Create ./prompts/ directory if needed: `mkdir -p ./prompts/`
    - Use proper numbering: 001, 002, 003, etc.
    - Name format: lowercase, hyphen-separated, max 5 words
    - Save as: `./prompts/[number]-[descriptive-name].md`
    - File contains ONLY the prompt content, no explanations

## Prompt Construction Standards

### Design Principles:

- **Explicit beats brief.** Length follows from explicit intent, scope, and acceptance criteria. 200–400 words is typical — pad only with intent-bearing tokens, never with hedges.
- **No generic reasoning scaffolding.** Drop "think step by step", "be thorough", "go beyond basics", "deeply consider", "double-check the X before returning" unless the target agent specifically benefits from that phrasing.
- **Reference patterns, don't describe them.** `Follow the pattern in @src/components/Widget.tsx` beats a paragraph describing the pattern. The codebase is the best spec of itself.
- **Provide symptoms, not diagnoses.** "Users report X when Y happens. Check @src/auth/" outperforms "Fix the auth bug."
- **Positive examples beat negative instructions.** "Write as flowing prose paragraphs" beats "don't use bullet points." "Match the voice in @docs/style.md" beats "don't be too formal."
- **State what's out of scope.** If the work could plausibly touch adjacent code, name the boundary or forbid the drift.
- **Define "done" before "do".** Acceptance criteria first, then the work.
- **Subagents are opt-in.** If parallelization helps and tooling is available, write: "Spawn parallel subagents when fanning out across independent files/items. Do not spawn subagents for work you can complete in a single response."
- **Verification is non-negotiable.** Tests, lint, typecheck, screenshot diff, expected-output match. Still the single highest-leverage practice.
- **Scope tool access.** Read-only tasks shouldn't have write access. State which tools the prompt actually needs.

### Always Include:

- Clear objective with WHY context (one sentence each)
- `@file` references for relevant source files
- Explicit scope boundaries (in/out) when work could plausibly creep
- Concrete acceptance criteria — what "done" means, testably
- A verification step (run tests, lint, compare output)

### Conditionally Include:

- `<subagents>` directive when the work benefits from parallelization
- `<constraints>` tag when there are non-obvious guardrails
- Effort hint when the user has a strong preference and the target system supports effort controls
- Tone/length specification when the default complexity-calibrated length would miss
- Sequential step numbers only when order truly matters

### Prompt Template:

```markdown
<objective>
[One sentence: what to build/fix/analyze and why it matters]
</objective>

<context>
@[relevant files to examine]
[Who uses this, what it's part of — only if not obvious from files]
</context>

<scope>
In:  [what's in scope]
Out: [what's explicitly out of scope — adjacent code, related concerns]
</scope>

<requirements>
- [Specific, unambiguous requirement]
- [Non-obvious constraint and WHY]
</requirements>

<acceptance_criteria>
- [Concrete, testable signal that the work is done]
- [Quality bar — performance, a11y, type safety, etc.]
</acceptance_criteria>

<output>
[Exact file paths to create/modify]
</output>

<verification>
- Run: [specific test/lint/typecheck command]
- Check: [specific validation]
</verification>
```

For **analysis/research tasks**, replace `<requirements>` + `<acceptance_criteria>` with `<scope>` (boundaries, sources, time period) and `<output>` with `<deliverables>` (format, save location, depth bar).

### Multi-Prompt Strategy:

When breaking into multiple prompts:

- **Parallel**: Independent tasks with no shared file mutations. Each prompt is self-contained and explicitly states the parallel-safe boundary.
- **Sequential**: Output of prompt N feeds into prompt N+1. State dependencies explicitly — don't assume the next session has memory of the prior one.
- Keep each sub-prompt focused on one concern. A prompt that needs more than 400 words is probably two prompts.

### Effort Level Guidance:

Recommend effort in the decision tree based on the work:

- **`xhigh` / high effort** — most coding/agentic work: schema design, multi-file refactors, code review across a service, ambiguous debugging, multi-step agentic tasks
- **`high`** — concurrent sessions, cost-conscious agentic work where xhigh is overkill
- **`medium` / `low`** — tightly scoped, well-specified work: classification, extraction, formatting, narrow targeted fixes
- **`max`** — reserve for genuinely hard problems where xhigh underperforms; prone to overthinking, diminishing returns

## Intelligence Rules

1. **Literal-readability check**: If a capable agent read this prompt with zero good-faith inference, would it produce what you want? Rewrite until yes.
2. **Context via reference**: `@file` beats prose description every time.
3. **Explicit beats implicit**: Scope boundaries, acceptance criteria, output paths — name them all.
4. **Strategic vs tactical split**: Durable project context (stack, conventions, "what good looks like") belongs in `AGENTS.md` and loads every session. Per-task intent stays in the prompt. Don't retype the project on turn one.
5. **Verification always**: No prompt ships without a way for the executing agent to check its own work.
6. **Scope tool access**: Restrict tools when the prompt should be read-only.
7. **Drop the scaffolding**: Phrases like "double-check the layout", "after each tool call tell me what you did", and "think step by step" usually waste tokens unless they encode task-specific behavior.

## After Review + Saving: Present Decision Tree

After the review is complete and prompt(s) are saved, present:

**For Single Prompt:**

```
Saved:  ./prompts/[number]-[name].md
Effort: [xhigh | high | medium | low | max]

Next?
1. Run now with `run-prompt [number]`
2. Review/edit first
3. Save for later
```

**For Multiple Prompts:**

```
Saved:
  - ./prompts/[N]-[name].md
  - ./prompts/[N+1]-[name].md

Strategy: [PARALLEL | SEQUENTIAL (N -> N+1 -> ...)]
Effort:   [xhigh | high | medium | low | max]

Next?
1. Run now with `run-prompt [N] [N+1] [--parallel|--sequential]`
2. Review/edit first
3. Save for later
```
