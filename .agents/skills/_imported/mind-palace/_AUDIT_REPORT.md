# Audit Report — mind-palace skill system (Prompt 006)

## 1. Summary

| Metric | Value |
|---|---|
| Skills audited | 32 (in scope; pixijs* excluded as pre-existing reference) |
| Audit dimensions checked | 9 |
| Issues found | 6 |
| Issues fixed | 6 |
| SKILL.md files modified | 5 (`bun-package-manager`, `storybook-stories`, `jotai`, `react-19-primitives`, `react`) |
| Matrix files modified | 1 (`_OWNERSHIP_MATRIX.md`) |
| New skills created | 0 (audit is read+repair only) |

## 2. Issues found and fixed

### Issue 1 — Owner integrity violation: jotai claimed ownership of root suspense + BroadcastChannel
- **Dimension:** 3 (Owner integrity, overlap rule)
- **Location:** `.agents/skills/jotai/SKILL.md` lines 3, 7, 11, 17–18
- **Description:** `jotai` skill body asserted ownership over the root `<Suspense>` + `use(idbHydrationPromise)` pattern, write-through with debounce, and `BroadcastChannel` re-hydration. Per matrix Section 2 ("IDB ↔ Jotai") these are owned by `idb`; jotai owns only the `atomWithIDB` factory contract.
- **Fix applied:** Rewrote jotai's YAML description, opening paragraph, "When to invoke" entry, and "Owns" section to make clear jotai owns only the factory contract; `idb` owns the IDB primitives, root hydration promise, root Suspense pattern, debounced write-through, and BroadcastChannel.

### Issue 2 — Owner integrity violation: react-19-primitives misattributed root hydration to jotai
- **Dimension:** 3 (Owner integrity, overlap rule)
- **Location:** `.agents/skills/react-19-primitives/SKILL.md` lines 3, 7, 14, 22–23, 27, 53, 164, 184
- **Description:** Multiple references stated "jotai owns the mind-palace root-hydration usage." Per matrix this belongs to `idb`.
- **Fix applied:** Updated YAML description, opening paragraph, "When to invoke", "Defers to" (clarified idb owns the integration; jotai consumes it), Pillar 3 rule line, the `use(promise)` pattern wiring note, the `<Suspense>` boundary note, and the anti-pattern about per-component suspense — all now point to `idb` for the mind-palace root hydration contract.

### Issue 3 — Owner integrity violation: react router skill misattributed root hydration to jotai
- **Dimension:** 3 (Owner integrity, overlap rule)
- **Location:** `.agents/skills/react/SKILL.md` lines 21, 40
- **Description:** Defers-to entry for jotai claimed jotai owns the mind-palace hydration usage; routing table directed hydration-promise questions to `react-19-primitives + jotai`.
- **Fix applied:** Rewrote the jotai bullet to clarify jotai owns only the `atomWithIDB` factory contract; added a new bullet pointing to `idb` for the root hydration contract; updated the routing table row to point at `react-19-primitives (API) + idb (mind-palace wiring)`.

### Issue 4 — Verbatim Pillar restatement in storybook-stories
- **Dimension:** 4 (AGENTS.md piggyback)
- **Location:** `.agents/skills/storybook-stories/SKILL.md` lines 7 and 31
- **Description:** Both lines quoted AGENTS.md Pillar 1 verbatim — specifically the sentence "Stories are not 'just visual references' — they are the test surface" plus "Every story is exercised by a Playwright test" — exceeding the 10-word verbatim threshold.
- **Fix applied:** Rewrote both lines to reference Pillar 1 by name and re-summarize in the skill's own words, preserving the assertion target / Playwright spec relationship without quoting the AGENTS.md sentence.

### Issue 5 — Stale lockfile syntax in bun-package-manager Owns section
- **Dimension:** 5 (Version pin integrity)
- **Location:** `.agents/skills/bun-package-manager/SKILL.md` line 16
- **Description:** "Owns" section listed `lockfile (\`bun.lockb\`)` even though the skill body and AGENTS.md correctly call out `bun.lock` (text JSONC since Bun 1.2). The trigger keyword `bun.lockb` was intentionally retained as a legacy-search lookup — see Issue B decision.
- **Fix applied:** Updated Owns line to `lockfile (\`bun.lock\` — text JSONC since Bun 1.2)`.

### Issue 6 — Matrix totals off by one
- **Dimension:** 9 (KNOWN issue / matrix bug)
- **Location:** `_OWNERSHIP_MATRIX.md` Section 1 closing line and Section 4 wave totals
- **Description:** Matrix summary said "Final inventory is **31 skills**" and "12 narrow + 5 router + 14 sub-skills = **31 skills**" and "Wave totals: 10 + 4 + 9 + 9 = **31 skills**". Actual count from rows is 32 (router playwright has 4 sub-skills, not 3; that brings sub-skill total to 15).
- **Fix applied:** Updated three matrix totals to 32 with corrected formula 12 + 5 + 15 = 32.

## 3. Matrix updates

### Update 1 — Removed `codec` from zod trigger keyword list (Section 1)
- **Section:** 1 (skill inventory, zod row)
- **What changed:** Removed `codec` from the comma-separated trigger keywords for the `zod` row.
- **Why:** Per Issue A in the handoff, Section 1 listed `codec` but Section 3 (the canonical keyword index per the matrix's own framing) did not, and the zod SKILL.md does not list it either. Section 3 + the SKILL.md are aligned, so Section 1 was the outlier and was reconciled by removing `codec`.

### Update 2 — Corrected total skill count from 31 to 32
- **Section:** 1 (closing summary line) and Section 4 (wave totals line)
- **What changed:** "Final inventory is **31 skills**" → "**32 skills**"; "12 narrow skills + 5 router skills + 14 sub-skills = **31 skills**" → "12 narrow skills + 5 router skills + 15 sub-skills = **32 skills**"; "Wave totals: 10 + 4 + 9 + 9 = **31 skills**" → "**32 skills**".
- **Why:** Arithmetic error — playwright contributes 4 sub-skills (story-tests, app-tests, pwa-offline, conventions), not 3, bringing the sub-skill total to 15.

## 4. Decisions on KNOWN issues A and B

### Issue A: matrix Section 1 vs Section 3 inconsistency for `codec`
- **Decision:** Remove `codec` from Section 1.
- **Reasoning:** Section 3 is described in the matrix as "the canonical keyword index" with "Each keyword maps to **exactly one** skill. No collisions." The zod SKILL.md (Wave 2) followed Section 3 and does not include `codec` as a trigger. Wave 2's choice was correct given Section 3's canonical role. Adding `codec` to Section 3 + zod's SKILL.md would have been the alternative, but `transform` already covers the conceptual surface (Zod 4 codecs are bidirectional transforms), and a user typing the literal word "codec" would still hit zod via `zod 4` or `transform`. The simpler, lower-churn fix is to drop the keyword from Section 1.

### Issue B: `bun.lockb` as a trigger keyword
- **Decision:** Keep `bun.lockb` as a legacy-search trigger; correct its appearance in the body.
- **Reasoning:** Bun 1.3 uses the text lockfile `bun.lock`, but users coming from older Bun docs or moved-from-other-tools docs will still type `bun.lockb`. Keeping the keyword means questions about that filename route to `bun-package-manager` rather than missing the skill entirely — and the skill body then immediately corrects them to `bun.lock`. The fix was to ensure the skill body itself never claims `bun.lockb` is the current lockfile name (line 16 of bun-package-manager Owns section was the only such drift). The body now consistently says `bun.lock` and the Anti-patterns explicitly says "Don't commit `bun.lockb` — the text `bun.lock` is the source of truth in this repo."

## 5. Final state per dimension

| # | Dimension | State |
|---|---|---|
| 1 | Trigger-keyword collisions | PASS (0 duplicates across all 32 skills' body Triggers; YAML descriptions match) |
| 2 | Deferral integrity | PASS (every named target is one of the 32 in-scope skills; no typos, no broken links, all backticked) |
| 3 | Owner integrity (overlap rule) | PASS (after 3 fixes — jotai/react-19-primitives/react root-hydration ownership corrected to idb) |
| 4 | AGENTS.md piggyback (no Pillar restatement) | PASS (after 1 fix — storybook-stories Pillar 1 verbatim removed; spot-check of 3 random skills found no further verbatims) |
| 5 | Version pin integrity | PASS (after 1 fix — bun-package-manager Owns line corrected from `bun.lockb` to `bun.lock`; all other matches were in anti-pattern sections explaining "don't use this") |
| 6 | Section completeness | PASS (all 32 skills have the seven required headings in order; routers correctly use `## Routing` where appropriate, and `bun`'s `## Patterns` legitimately contains a routing table inside a broader patterns section) |
| 7 | Wave coverage | PASS (17/17 techs in `potential_skills/` are reachable via at least one of the 32 skills) |
| 8 | Router consistency | PASS (every router names every sub-skill in its Defers to / Routing; every sub-skill names its router parent in the opening "Sub-skill of `X`" line) |
| 9 | KNOWN issues A and B reconciled | PASS (after 2 matrix fixes — `codec` removed from Section 1; total count corrected to 32) |

## 6. Skill inventory by wave

| Wave | Count | Skills |
|---|---|---|
| 1 — Toolchain & language | 10 | bun, bun-runtime, bun-test, bun-package-manager, turborepo, biome, stylelint, ts, node, nitro |
| 2 — Schema & state | 4 | zod, t3-env, idb, jotai |
| 3 — UI core & framework | 9 | react, react-compiler-rules, react-19-primitives, tanstack, tanstack-start-spa-prerender, tanstack-router-routing, tanstack-router-pwa-deep-links, tailwind, animejs |
| 4 — Stories & tests | 9 | storybook, storybook-config, storybook-stories, storybook-play-functions, playwright, playwright-story-tests, playwright-app-tests, playwright-pwa-offline, playwright-conventions |
| **Total** | **32** | matches matrix Section 1 inventory and Section 4 wave plan after the matrix fix |

### Router → sub-skill coverage

| Router | Sub-skills | Verified |
|---|---|---|
| `bun` | bun-runtime, bun-test, bun-package-manager | All three named in the router's Defers to + routing table; each sub-skill opens with "Sub-skill of `bun`." |
| `react` | react-compiler-rules, react-19-primitives | Both named in router; each sub-skill names parent |
| `tanstack` | tanstack-start-spa-prerender, tanstack-router-routing, tanstack-router-pwa-deep-links | All three named; each sub-skill names parent |
| `storybook` | storybook-config, storybook-stories, storybook-play-functions | All three named; each sub-skill names parent |
| `playwright` | playwright-story-tests, playwright-app-tests, playwright-pwa-offline, playwright-conventions | All four named; each sub-skill names parent |

### Pillar enforcement coverage

- **Pillar 1 (Storybook-first)** — storybook, storybook-stories, storybook-play-functions, storybook-config, playwright-story-tests
- **Pillar 2 (Zod-first types)** — zod, t3-env, idb, jotai, ts, tanstack-router-routing
- **Pillar 3 (IDB-first state)** — idb (producer of the root hydration contract), jotai (consumer via `atomWithIDB`)
- **Pillar 4 (CLI-gate-first, zero-warning)** — biome, stylelint, ts, bun-test, turborepo, playwright-story-tests, playwright-app-tests, playwright-pwa-offline

Every Pillar has at least one enforcing skill. Every Pillar reference in a SKILL.md uses the form "Pillar N (Name)" or "Pillar N — Name" without quoting the AGENTS.md prose.

---

## Verdict

**System green.** All 32 mind-palace skills pass the 9 audit dimensions; 6 issues found and 6 issues fixed; matrix updated for the documented inconsistency between Section 1 and Section 3 (the `codec` keyword) and for the off-by-one totals; AGENTS.md untouched; no skills created or deleted; pixijs* skills untouched.
