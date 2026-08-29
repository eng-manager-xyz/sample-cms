---
name: react-doctor
description: Use when finishing a feature, fixing a bug, before committing React code, or when the user wants to improve code quality or clean up a codebase. Checks for score regression. Covers lint, dead code, accessibility, bundle size, architecture diagnostics.
version: "1.0.0"
---

# React Doctor

Scans React codebases for security, performance, correctness, and architecture issues. Outputs a 0–100 health score.

## After making React code changes:

Run `npx -y react-doctor@latest . --verbose --diff` and check the score did not regress.

If the score dropped, fix the regressions before committing.

Common mind-palace fixes:

- Do not call JSX-returning helpers from render. Promote repeated JSX to a real Zod-wrapped component and render it with JSX.
- Avoid `flushSync` for normal interaction state. Use ordinary state updates unless there is a proven DOM measurement requirement that cannot be modeled another way.
- Do not keep `will-change` in rendered styles. If a transient compositor hint is truly needed, set and clear it from the animation side channel.
- Use semantic elements before ARIA role overrides. For progress UI, prefer `<progress>` over `role="progressbar"` on a generic element.

## For general cleanup or code improvement:

Run `npx -y react-doctor@latest . --verbose` (without `--diff`) to scan the full codebase. Fix issues by severity — errors first, then warnings.

## Command

```bash
npx -y react-doctor@latest . --verbose --diff
```

| Flag        | Purpose                                       |
| ----------- | --------------------------------------------- |
| `.`         | Scan current directory                        |
| `--verbose` | Show affected files and line numbers per rule |
| `--diff`    | Only scan changed files vs base branch        |
| `--score`   | Output only the numeric score                 |
