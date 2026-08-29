---
name: extract-curriculum
description: "Use when turning a GitHub repo or PDF into a typed curriculum for the learning game — abstract a source's knowledge into a graph of flashcard lesson nodes with mapped prerequisite edges, emitted as @mind-palace/curriculum CurriculumSchema-validated data committed to the repo (authoring-time, no backend). Triggers on: extract curriculum, repo to curriculum, pdf to curriculum, build a curriculum, curriculum from a repo, knowledge graph, flashcards from a source, learning path, /extract-curriculum."
license: MIT
---

The game's content pipeline: one **Source** (a GitHub repo or a PDF) → one homogeneously-typed **Curriculum** (a graph of **Flashcard** lesson nodes joined by directed prerequisite **edges**). Extraction happens at authoring time and emits committed, schema-validated TypeScript — there is no backend and nothing is extracted at runtime. The `/extract-curriculum` command drives the end-to-end flow; this skill is the methodology.

## The contract (read it first)

`packages/curriculum/src/schema.ts` is the single source of truth. The emitted data must satisfy `CurriculumSchema`:

- **`Source`** — `{ kind: "github-repo", url, ref? }` | `{ kind: "pdf", href, pages? }`. A curriculum is *coupled* to exactly one source.
- **`Flashcard`** — `{ id, title, content }`. `content` is a discriminated union on `type`:
  - `read` — `{ markdown }` (fully rendered).
  - `multiple-choice` — `{ question, options[≥2], answerIndex }` (interactive; correctness feeds the SRS rating).
  - `video` — `{ src, caption? }` (placeholder renderer today).
  - `card-mini-game` — `{ prompt, pairs? }` — a drag-and-drop practice node that **must** be built on `@mind-palace/cards` (AGENTS.md rule). Use sparingly.
- **`Curriculum`** — `{ id, title, source, nodes: Flashcard[], edges: Edge[] }`. `Edge` = `{ from, to }`, a directed prerequisite.

Do **not** emit scheduling state. Spaced-repetition `CardState` is runtime progress (IDB, keyed by flashcard id via `getCurriculumProgressAtom`) — content and progress are separate, exactly like the static `Card`/`Deck` vs. progress split in `@mind-palace/srs`.

## Method

1. **Acquire** the source (clone the repo / read the PDF pages) and record its canonical `Source`.
2. **Abstract** — fan out subagents over the source's natural divisions (directories, chapters). Each returns atomic concepts: one idea per `Flashcard`, a tight `read` body, and optional `multiple-choice` checks. Atomic nodes make the graph (and SRS) meaningful.
3. **Map the graph** — dedupe into nodes with stable kebab-case `id`s; draw `edges` foundational→advanced. Keep it a DAG; `rootIds` (from `@mind-palace/curriculum`'s `graph.ts`) are the entry points; `layeredTree`/`forceLayout` will lay it out for the PixiJS views.
4. **Emit + register** — write `apps/web/app/data/curricula/<id>.ts` (`... satisfies Curriculum`) and register it in `apps/web/app/data/curriculum-data.ts` (a set of curricula forms a `LearningPath` → `Goal`). Mirror the existing hand-authored example there.
5. **Validate** — `satisfies Curriculum` is the compile-time guarantee; confirm runtime validity with a scratch `CurriculumSchema.parse(...)`, then run `bun run check:fast`.

## Where it plugs in

- Curricula render through the existing routes (`goal.$goalId` → `curriculum.$curriculumId` → `…/node/$nodeId`) and the PixiJS `LearningPathTree` / `CurriculumGraph` — no UI work needed; new data flows straight in.
- Reuse `@mind-palace/curriculum` helpers (`buildCurriculumGraph`, `rootIds`, `prerequisites`, `dueFlashcardIds`) rather than re-deriving graph logic.

## Speech contract (read-aloud)

Every card is also SPOKEN via `app/lib/speech-track.ts` (browsers don't parse SSML — the structured markdown is the speech markup): `##` headings pace the delivery, `==highlights==` become spoken emphasis, list items and sentences become individual utterances, fenced code is skipped aloud, inline `code` is verbalized. Two authoring duties follow:

1. Author read bodies with real structure (headings, lists, highlights) — a wall of prose reads AND sounds worse.
2. **New jargon a TTS voice would mangle (initialisms, crate names, coined terms) gets an entry in `app/lib/speech-lexicon.ts`** — case-sensitive, word-boundary matched, plurals separate. Never embed SSML or pronunciation hacks in card text; display text stays clean.

## Pitfalls
- One source per curriculum — keep them coherent and small; compose breadth via multiple curricula in a `LearningPath`.
- No new runtime dependencies (AGENTS.md) — this pipeline needs none.
- Don't hand-roll drag-and-drop for `card-mini-game`; compose `@mind-palace/cards`.
- Don't put SSML/speech markup in content — see the speech contract above.
