import * as z from 'zod';

const LearningIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const ChapterNumberSchema = z.int().min(1).max(6);
const SectionIdSchema = LearningIdSchema;

function addDuplicateIssue(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string
): void {
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: 'custom',
        message: `duplicate ${label} ${value}`,
        path: [...path, index],
      });
    }
    seen.add(value);
  }
}

export const ComprehensionQuestionSchema = z
  .object({
    kind: z.literal('comprehension'),
    id: LearningIdSchema,
    chapterId: LearningIdSchema,
    chapterNumber: ChapterNumberSchema,
    sourceSectionIds: z.array(SectionIdSchema).min(1),
    prompt: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(3).max(5),
    answerIndex: z.int().min(0),
    explanation: z.string().trim().min(1),
  })
  .superRefine((question, context) => {
    if (question.answerIndex >= question.options.length) {
      context.addIssue({
        code: 'custom',
        message: 'answerIndex must identify one of the authored options',
        path: ['answerIndex'],
      });
    }
    addDuplicateIssue(
      question.options.map((option) => option.toLocaleLowerCase('en-US')),
      context,
      ['options'],
      'option'
    );
    addDuplicateIssue(question.sourceSectionIds, context, ['sourceSectionIds'], 'source section');
  });
export const ChapterQuestionnaireSchema = z
  .object({
    id: LearningIdSchema,
    chapterId: LearningIdSchema,
    chapterNumber: ChapterNumberSchema,
    title: z.string().trim().min(1),
    questions: z.array(ComprehensionQuestionSchema).length(3),
  })
  .superRefine((questionnaire, context) => {
    addDuplicateIssue(
      questionnaire.questions.map((question) => question.id),
      context,
      ['questions'],
      'question id'
    );
    for (const [index, question] of questionnaire.questions.entries()) {
      if (question.chapterId !== questionnaire.chapterId) {
        context.addIssue({
          code: 'custom',
          message: 'question chapterId must match its questionnaire',
          path: ['questions', index, 'chapterId'],
        });
      }
      if (question.chapterNumber !== questionnaire.chapterNumber) {
        context.addIssue({
          code: 'custom',
          message: 'question chapterNumber must match its questionnaire',
          path: ['questions', index, 'chapterNumber'],
        });
      }
    }
  });
export type ChapterQuestionnaire = z.infer<typeof ChapterQuestionnaireSchema>;

const TeachBackCriterionSchema = z.object({
  id: LearningIdSchema,
  label: z.string().trim().min(1),
});
export const TeachBackCardSchema = z
  .object({
    kind: z.literal('teach-back'),
    id: LearningIdSchema,
    chapterId: LearningIdSchema,
    chapterNumber: ChapterNumberSchema,
    sourceSectionIds: z.array(SectionIdSchema).min(1),
    title: z.string().trim().min(1),
    prompt: z.string().trim().min(1),
    modelAnswer: z.string().trim().min(1),
    successCriteria: z.array(TeachBackCriterionSchema).min(3).max(6),
  })
  .superRefine((card, context) => {
    addDuplicateIssue(card.sourceSectionIds, context, ['sourceSectionIds'], 'source section');
    addDuplicateIssue(
      card.successCriteria.map((criterion) => criterion.id),
      context,
      ['successCriteria'],
      'success criterion id'
    );
  });
export type TeachBackCard = z.infer<typeof TeachBackCardSchema>;

export const TutorialLearningContentSchema = z
  .object({
    questionnaires: z.array(ChapterQuestionnaireSchema).length(6),
    teachBackCards: z.array(TeachBackCardSchema).length(12),
  })
  .superRefine((content, context) => {
    const chapterIds = new Map<number, string>();
    const learningCardIds: string[] = [];

    for (const [index, questionnaire] of content.questionnaires.entries()) {
      const expectedChapter = index + 1;
      if (questionnaire.chapterNumber !== expectedChapter) {
        context.addIssue({
          code: 'custom',
          message: `questionnaire at index ${index} must be chapter ${expectedChapter}`,
          path: ['questionnaires', index, 'chapterNumber'],
        });
      }
      if (chapterIds.has(questionnaire.chapterNumber)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate questionnaire chapter ${questionnaire.chapterNumber}`,
          path: ['questionnaires', index, 'chapterNumber'],
        });
      }
      chapterIds.set(questionnaire.chapterNumber, questionnaire.chapterId);
      learningCardIds.push(...questionnaire.questions.map((question) => question.id));
    }

    const teachBackCountByChapter = new Map<number, number>();
    for (const [index, card] of content.teachBackCards.entries()) {
      teachBackCountByChapter.set(
        card.chapterNumber,
        (teachBackCountByChapter.get(card.chapterNumber) ?? 0) + 1
      );
      if (chapterIds.get(card.chapterNumber) !== card.chapterId) {
        context.addIssue({
          code: 'custom',
          message: 'teach-back chapter identity must match its questionnaire',
          path: ['teachBackCards', index, 'chapterId'],
        });
      }
      learningCardIds.push(card.id);
    }

    for (let chapterNumber = 1; chapterNumber <= 6; chapterNumber += 1) {
      if (teachBackCountByChapter.get(chapterNumber) !== 2) {
        context.addIssue({
          code: 'custom',
          message: `chapter ${chapterNumber} must have exactly two teach-back cards`,
          path: ['teachBackCards'],
        });
      }
    }

    addDuplicateIssue(learningCardIds, context, [], 'learning card id');
  });
const learningContent = TutorialLearningContentSchema.parse({
  questionnaires: [
    {
      id: 'chapter-1-comprehension',
      chapterId: 'trace-current-system',
      chapterNumber: 1,
      title: 'Trace the current system',
      questions: [
        {
          kind: 'comprehension',
          id: 'chapter-1-server-boundary',
          chapterId: 'trace-current-system',
          chapterNumber: 1,
          sourceSectionIds: ['repository-map'],
          prompt: 'Which code is allowed to open the SQLite client?',
          options: [
            'Any browser component that needs fresh data',
            'Validated server-side code behind the application boundary',
            'The synchronous website block renderer',
          ],
          answerIndex: 1,
          explanation:
            'Browser modules call TanStack server functions. The SQLite client and CmsService stay in server and package code, while rendered components receive validated data.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-1-explicit-precedence',
          chapterId: 'trace-current-system',
          chapterNumber: 1,
          sourceSectionIds: ['canonical-url-trace'],
          prompt: 'What determines precedence when several active variants match one page?',
          options: [
            'Explicit integer priority, with equal-priority placement collisions rejected',
            'The number of conditions in each selector',
            'Creation time followed by row ID',
          ],
          answerIndex: 0,
          explanation:
            'Selectors choose matching pages; priority orders sparse layers. If equal-priority matches touch the same placement, resolution fails instead of inventing a winner.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-1-public-lane',
          chapterId: 'trace-current-system',
          chapterNumber: 1,
          sourceSectionIds: ['runtime-boundaries', 'evidence-workflow'],
          prompt: 'Which sequence describes the current public website lane?',
          options: [
            'Catch-all route → read-only server function → CmsService.serve → PublishedDocumentSchema → block registry',
            'Catch-all route → selector preview SQL → draft resolver → block registry',
            'Catch-all route → CMS browser state → publication mutation → block registry',
          ],
          answerIndex: 0,
          explanation:
            'The website reads the active materialized publication through a read-only server path, validates the strict published contract, and renders it synchronously without authoring resolution.',
        },
      ],
    },
    {
      id: 'chapter-2-comprehension',
      chapterId: 'relational-grammar',
      chapterNumber: 2,
      title: 'The relational grammar',
      questions: [
        {
          kind: 'comprehension',
          id: 'chapter-2-map-point',
          chapterId: 'relational-grammar',
          chapterNumber: 2,
          sourceSectionIds: ['maps-points-dimensions', 'route-classification-inputs'],
          prompt: 'In the wall-of-maps model, what is a point?',
          options: [
            'A concrete page instance with explicit route, slot, and classification inputs',
            'The highest-priority variant for a template',
            'A block version shared by every canonical URL',
          ],
          answerIndex: 0,
          explanation:
            'A page instance is the point. Its scalar coordinates and explicit tag memberships are inputs to selection; they do not create hidden precedence by themselves.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-2-stable-placement',
          chapterId: 'relational-grammar',
          chapterNumber: 2,
          sourceSectionIds: ['placements-content'],
          prompt: 'A hero changes from `hero` to `hero_alt`. Which identity must remain stable?',
          options: [
            'The block type',
            'The block-version row ID',
            'The placement key such as `primary-hero`',
          ],
          answerIndex: 2,
          explanation:
            'The placement key names the document position across reordering, content versions, and block-type replacement. Block versions remain immutable history.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-2-compiler-boundary',
          chapterId: 'relational-grammar',
          chapterNumber: 2,
          sourceSectionIds: ['authoring-serving'],
          prompt: 'Which statement correctly describes the compiler boundary?',
          options: [
            'Variant operations are serving facts consumed by the block registry',
            'Authoring rows compile into immutable ordered placements with provenance',
            'Public rendering may consult draft rows when `edit_mode=true`',
          ],
          answerIndex: 1,
          explanation:
            'Variants and operations are expressive authoring instructions. Publication compiles them into a strict immutable document that the public renderer consumes without crossing back into authoring state.',
        },
      ],
    },
    {
      id: 'chapter-3-comprehension',
      chapterId: 'wall-algebra',
      chapterNumber: 3,
      title: 'The wall-of-maps algebra',
      questions: [
        {
          kind: 'comprehension',
          id: 'chapter-3-variant-tuple',
          chapterId: 'wall-algebra',
          chapterNumber: 3,
          sourceSectionIds: ['define-algebra'],
          prompt: 'What do the three parts of `v = (S_v, π_v, O_v)` answer?',
          options: [
            'Which pages, at what precedence, and which placement operations',
            'Which route, which renderer, and which HTTP cache',
            'Which database, which transaction, and which deployment',
          ],
          answerIndex: 0,
          explanation:
            'The selector chooses pages, explicit priority chooses precedence, and sparse operations describe where the layer acts.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-3-selector-safety',
          chapterId: 'wall-algebra',
          chapterNumber: 3,
          sourceSectionIds: ['safe-mask'],
          prompt: "How is `brand = 'mcdonalds'` compiled safely?",
          options: [
            'The whole expression is pasted into SQL after escaping quotes',
            'The field is allowlisted, the value is bound, and template scope is injected',
            'The browser runs it against publication rows before every render',
          ],
          answerIndex: 1,
          explanation:
            'Authors control a bounded expression and literal values. Trusted metadata supplies identifiers, values become parameters, and the service enforces the owning template.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-3-conflict-predicate',
          chapterId: 'wall-algebra',
          chapterNumber: 3,
          sourceSectionIds: ['deterministic-fold', 'publication-projection'],
          prompt:
            'Two matching priority-20 variants touch `primary-hero`, one with `set` and one with `order`. What happens?',
          options: [
            'The newer variant wins',
            'The operations compose because their kinds differ',
            'Publication rejects the ambiguity and leaves the current pointer unchanged',
          ],
          answerIndex: 2,
          explanation:
            'Same priority plus the same placement is ambiguous across operation kinds. Failure is deterministic and cannot replace the active publication.',
        },
      ],
    },
    {
      id: 'chapter-4-comprehension',
      chapterId: 'proof-shapes',
      chapterNumber: 4,
      title: 'Three executable proof shapes',
      questions: [
        {
          kind: 'comprehension',
          id: 'chapter-4-dense-proof',
          chapterId: 'proof-shapes',
          chapterNumber: 4,
          sourceSectionIds: ['dense-eligible'],
          prompt: 'What is Dense Eligible Vehicles primarily designed to prove?',
          options: [
            'Maximum manifest reuse',
            'Deterministic precedence under dense intersecting variation',
            'That every page should receive its own template',
          ],
          answerIndex: 1,
          explanation:
            'Dense variation is a correctness stress case for overlap and precedence. Low reuse is expected and is not a failure of that proof.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-4-sparse-proof',
          chapterId: 'proof-shapes',
          chapterNumber: 4,
          sourceSectionIds: ['sparse-stores'],
          prompt: 'Why can many Store pages share one manifest yet render different store names?',
          options: [
            'The renderer reruns selectors to choose each name',
            'They share structural pointers and provenance while interpolation uses immutable page context',
            'The manifest contains a separate expanded document for every store',
          ],
          answerIndex: 1,
          explanation:
            'Manifest identity captures shared structure. Deterministic interpolation can still produce page-specific rendered values without changing the winning block-version pointers.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-4-structural-proof',
          chapterId: 'proof-shapes',
          chapterNumber: 4,
          sourceSectionIds: ['structural-replacement', 'compare-shapes'],
          prompt: 'What makes the structural-replacement scenario successful?',
          options: [
            'The placement gets a new key whenever the block type changes',
            'The replacement mutates the default block version in place',
            'The block type changes at a stable placement while at least 90% of placements stay inherited',
          ],
          answerIndex: 2,
          explanation:
            'The scenario proves identity and inheritance: `primary-hero` survives a type replacement, and unrelated placements retain their lower-layer winners.',
        },
      ],
    },
    {
      id: 'chapter-5-comprehension',
      chapterId: 'operate-hud',
      chapterNumber: 5,
      title: 'Operate the HUD as an author',
      questions: [
        {
          kind: 'comprehension',
          id: 'chapter-5-authoritative-state',
          chapterId: 'operate-hud',
          chapterNumber: 5,
          sourceSectionIds: ['navigate-wall', 'inspect-layers'],
          prompt: 'What should an author trust when a gallery summary and workspace detail differ?',
          options: [
            'The persisted workspace state and its inspectable revisions',
            'The nearest rounded demo metric',
            'Whichever card was rendered most recently',
          ],
          answerIndex: 0,
          explanation:
            'Gallery cues help navigation, but selectors, revisions, points, layers, and publication records in the workspace are the authoritative persisted state.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-5-copy-on-write',
          chapterId: 'operate-hud',
          chapterNumber: 5,
          sourceSectionIds: ['crud'],
          prompt: 'How should an inherited hero be edited for one matching variant?',
          options: [
            'Mutate the inherited block version',
            'Append a new block version and a local `set` operation in a new revision',
            'Delete the default placement and recreate it globally',
          ],
          answerIndex: 1,
          explanation:
            'Copy-on-write preserves immutable history and limits the change to the selected layer. Unrelated pages continue to inherit the prior winner.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-5-rollback',
          chapterId: 'operate-hud',
          chapterNumber: 5,
          sourceSectionIds: ['publish-rollback'],
          prompt: 'What does rollback do?',
          options: [
            'Recompile every page using the former selector text',
            'Mutate current page-document rows back to their old values',
            'Repoint the current-publication pointer to a retained validated predecessor',
          ],
          answerIndex: 2,
          explanation:
            'Publications are immutable namespaces. Rollback is a bounded pointer change, not recompilation or row mutation.',
        },
      ],
    },
    {
      id: 'chapter-6-comprehension',
      chapterId: 'verify-current-system',
      chapterNumber: 6,
      title: 'Verify the executable architecture',
      questions: [
        {
          kind: 'comprehension',
          id: 'chapter-6-serving-shapes',
          chapterId: 'verify-current-system',
          chapterNumber: 6,
          sourceSectionIds: ['payloads-manifests'],
          prompt: 'What invariant do expanded and manifest serving shapes share?',
          options: [
            'They both resolve selectors on the request path',
            'They reconstruct the same strict immutable published document without selector SQL',
            'They always require exactly two SQLite reads',
          ],
          answerIndex: 1,
          explanation:
            'Expanded mode reads one payload and manifest mode uses two reads to reconstruct it. Read count is a shape choice; the validated logical document and selector-free path are invariant.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-6-publication-transaction',
          chapterId: 'verify-current-system',
          chapterNumber: 6,
          sourceSectionIds: ['publication-transaction'],
          prompt: 'What happens inside the current publication transaction?',
          options: [
            'CmsService changes current_publications before it validates every page row',
            'CmsService resolves every non-archived page, validates rendered output, writes immutable rows, and then swaps one pointer',
            'The website resolves authoring variants again after activation',
          ],
          answerIndex: 1,
          explanation:
            'CmsService.publish runs synchronously inside one SQLite transaction. Partial writes roll back, and the current-publication pointer changes only after the complete namespace validates.',
        },
        {
          kind: 'comprehension',
          id: 'chapter-6-runtime-boundary',
          chapterId: 'verify-current-system',
          chapterNumber: 6,
          sourceSectionIds: ['verify-boundaries', 'review-handoff'],
          prompt: 'Which claim matches the executable selector and interpolation boundaries?',
          options: [
            'Only preview runs compiled selector SQL; publication evaluates selector ASTs, expanded serve reads rendered JSON, and manifest serve interpolates immutable context',
            'Publication sends authored selector text to the public renderer',
            'The public block registry evaluates dotted-path interpolation for every request',
          ],
          answerIndex: 0,
          explanation:
            'Preview SQL is bounded and parameterized. Draft resolution and publication evaluate validated selector structures in server code. Expanded serve parses stored rendered JSON; manifest serve deterministically interpolates stored block content against immutable page context before schema validation.',
        },
      ],
    },
  ],
  teachBackCards: [
    {
      kind: 'teach-back',
      id: 'teach-back-current-code-path',
      chapterId: 'trace-current-system',
      chapterNumber: 1,
      sourceSectionIds: ['repository-map', 'canonical-url-trace'],
      title: 'Trace the running code',
      prompt:
        'Trace `/en-US/store/1001` from persisted authoring rows through deterministic resolution, publication, and the rendered website.',
      modelAnswer:
        'The Store template owns the page instance, slots, tags, default, and selector variants in SQLite. CmsService loads normalized inputs, evaluates validated selectors, rejects equal-priority placement conflicts, folds sparse operations, evaluates bounded interpolation, and validates the exact page output. Publication writes immutable rows inside one transaction before changing the current pointer. The website catch-all calls a read-only server function. CmsService.serve either parses stored expanded JSON or reconstructs a manifest with immutable context, PublishedDocumentSchema validates the result, and the synchronous registry renders each placement.',
      successCriteria: [
        {
          id: 'starts-with-authoring-rows',
          label: 'Starts with template-scoped SQLite authoring rows',
        },
        {
          id: 'traces-resolution',
          label: 'Explains selector matching, conflict failure, and the sparse fold',
        },
        {
          id: 'traces-publication',
          label: 'Explains immutable writes followed by one pointer activation',
        },
        {
          id: 'ends-at-registry',
          label: 'Ends at the validated public document and synchronous registry',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-runtime-lanes',
      chapterId: 'trace-current-system',
      chapterNumber: 1,
      sourceSectionIds: ['runtime-boundaries', 'evidence-workflow'],
      title: 'Separate the runtime lanes',
      prompt:
        'Draw the current authoring, publication, public serving, preview, and admin lanes and name the code boundary for each.',
      modelAnswer:
        'The CMS browser calls validated server functions for authoring and publication. CmsService resolves drafts and publishes through the SQLite package. The website public catch-all calls its read-only published-page server function and never consults draft state. Only `/cms-preview_/*` calls the draft resolver and returns private no-store output. `/admin` validates CMS_ADMIN_ORIGIN and renders a handoff link. Requirement, prototype-choice, and measured-evidence labels keep every explanation tied to a current contract or reproducible result.',
      successCriteria: [
        { id: 'draws-server-boundary', label: 'Places browser code outside the SQLite boundary' },
        {
          id: 'separates-runtime-lanes',
          label: 'Separates authoring, publication, public, preview, and admin behavior',
        },
        {
          id: 'names-public-chain',
          label: 'Names serve, strict validation, and registry dispatch on the public lane',
        },
        {
          id: 'anchors-to-evidence',
          label: 'Anchors each claim to code, a contract test, or measured evidence',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-map-point-dimensions',
      chapterId: 'relational-grammar',
      chapterNumber: 2,
      sourceSectionIds: ['maps-points-dimensions', 'route-classification-inputs'],
      title: 'Map, point, and dimensions',
      prompt:
        'Use `/en-US/store/1001` to explain the map, the point, scalar coordinates, explicit classifications, and what actually chooses precedence.',
      modelAnswer:
        'The Store template is the map and the concrete page instance for `/en-US/store/1001` is the point. Locale and store ID are scalar coordinates; chain, fast-food, and McDonald’s are explicit tag memberships with provenance. Those facts make selector matches possible but do not choose a winner. Active matching variants contribute sparse operations, and their authored integer priorities determine fold order inside the Store template.',
      successCriteria: [
        { id: 'names-template-map', label: 'Names the template as the map' },
        { id: 'names-page-point', label: 'Names the canonical page instance as the point' },
        {
          id: 'separates-slots-tags',
          label: 'Separates scalar slots from explicit tag memberships',
        },
        {
          id: 'states-precedence-rule',
          label: 'States that selector matches plus explicit priority drive precedence',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-placement-and-compiler',
      chapterId: 'relational-grammar',
      chapterNumber: 2,
      sourceSectionIds: ['placements-content', 'authoring-serving'],
      title: 'Stable identity through compilation',
      prompt:
        'Explain how a placement survives content edits, reordering, hiding, reverting, and block-type replacement, then cross the publication boundary.',
      modelAnswer:
        'A stable placement key names the document position independently from its current block type, version, order, or visibility. Editing inherited content appends a block version and local set operation. Hiding adds a tombstone; reverting removes the local operation in a new revision so the lower winner returns. Publication compiles those authoring instructions into contiguous immutable placements and tombstone provenance. The public registry receives only that validated result.',
      successCriteria: [
        {
          id: 'separates-key-version',
          label: 'Separates placement identity from block version and type',
        },
        { id: 'explains-copy-on-write', label: 'Explains copy-on-write without mutating history' },
        {
          id: 'contrasts-hide-revert',
          label: 'Contrasts tombstone hiding with reverting a local decision',
        },
        { id: 'crosses-compiler-boundary', label: 'Ends with immutable validated serving state' },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-selector-mask',
      chapterId: 'wall-algebra',
      chapterNumber: 3,
      sourceSectionIds: ['define-algebra', 'safe-mask'],
      title: 'From selector text to a mask',
      prompt:
        'Derive `M_v` and `L_T(p)` in plain English, then trace an authored selector through the safe compilation pipeline.',
      modelAnswer:
        '`M_v` is the set of pages in template `T` for which selector `S_v` is true. `L_T(p)` is the active matching layers for one page. Authored text is tokenized, parsed, normalized, checked against template-owned fields, compiled with bound literal parameters and injected template scope, then previewed with bounded samples, exact counts, plan steps, and overlap diagnostics. The selector never gains access to arbitrary tables or the public request path.',
      successCriteria: [
        { id: 'defines-mask', label: 'Defines the mask as a set of matching pages' },
        { id: 'defines-layer-set', label: 'Defines the active matching layer set for one page' },
        {
          id: 'traces-selector-pipeline',
          label: 'Names tokenize, parse, normalize, validate, compile, and preview',
        },
        {
          id: 'states-safety-boundary',
          label: 'Explains allowlisted fields, bound values, and injected template scope',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-conflict-fold-publication',
      chapterId: 'wall-algebra',
      chapterNumber: 3,
      sourceSectionIds: ['deterministic-fold', 'publication-projection'],
      title: 'Conflict, fold, and atomic activation',
      prompt:
        'Walk a page from conflict detection through the placement fold, canonical publication, activation, serving, and rollback.',
      modelAnswer:
        'First reject any matching variants with equal priority that touch the same placement, regardless of operation kind. Then start from defaults and apply canonically ordered sparse operations from low to high priority, retaining separate content and order provenance. Canonicalize and validate the resolved document, write an immutable publication and reusable manifests, and atomically move the current pointer only after all checks pass. Serving follows that pointer with zero selector SQL; rollback points to a retained predecessor.',
      successCriteria: [
        { id: 'detects-before-fold', label: 'Detects ambiguity before applying operations' },
        {
          id: 'folds-explicit-priority',
          label: 'Folds sparse operations using explicit priority only',
        },
        { id: 'keeps-two-provenances', label: 'Keeps content and order provenance distinct' },
        {
          id: 'activates-atomically',
          label: 'Explains immutable write, validation, pointer activation, and rollback',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-dense-and-sparse-proofs',
      chapterId: 'proof-shapes',
      chapterNumber: 4,
      sourceSectionIds: ['dense-eligible', 'sparse-stores', 'compare-shapes'],
      title: 'Dense correctness versus sparse reuse',
      prompt:
        'Compare Eligible Vehicles and Store without using one scenario’s success metric to judge the other.',
      modelAnswer:
        'Eligible Vehicles is intentionally dense: many pages match intersecting selectors and many placements vary, so it tests explicit precedence, conflict handling, and deterministic full-document resolution. Store is sparse at million-page scale: a few variants touch separate placements, most pages share structural manifests, and immutable context supplies page-specific interpolation. Dense low reuse and sparse high reuse are workload facts, not contradictory architecture verdicts.',
      successCriteria: [
        {
          id: 'names-dense-purpose',
          label: 'Frames dense variation as a precedence correctness proof',
        },
        {
          id: 'names-sparse-purpose',
          label: 'Frames Store as a composition and structural-reuse proof',
        },
        {
          id: 'explains-interpolation',
          label: 'Explains how shared manifests allow page-specific values',
        },
        {
          id: 'avoids-metric-conflation',
          label: 'Keeps workload-dependent metrics separate from invariants',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-structural-inheritance',
      chapterId: 'proof-shapes',
      chapterNumber: 4,
      sourceSectionIds: ['structural-replacement', 'compare-shapes'],
      title: 'Structural replacement with inheritance',
      prompt:
        'Explain why the structural scenario is more than a cosmetic hero swap and show how provenance proves the result.',
      modelAnswer:
        'The variant changes the winning block type at the stable `primary-hero` placement, proving that placement identity is not block-type identity. It also tombstones an announcement while inheriting more than 90% of the remaining placements unchanged. The published document records the replacement and tombstone traces plus each inherited winner. Rollback restores the prior immutable publication without rewriting either result.',
      successCriteria: [
        {
          id: 'stable-key-type-change',
          label: 'Keeps the placement key stable across a block-type change',
        },
        {
          id: 'separates-tombstone',
          label: 'Separates type replacement from the announcement tombstone',
        },
        {
          id: 'states-inheritance-proof',
          label: 'States the at-least-90% inheritance requirement',
        },
        {
          id: 'uses-provenance-hashes',
          label: 'Uses provenance or hashes to explain verification and rollback',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-author-inspection',
      chapterId: 'operate-hud',
      chapterNumber: 5,
      sourceSectionIds: ['navigate-wall', 'inspect-layers'],
      title: 'Inspect one point on the wall',
      prompt:
        'Teach a new author how to move from the Wall of Maps to one trustworthy explanation of a page’s content.',
      modelAnswer:
        'Choose the template from the wall, treating summary cards as navigation cues rather than persisted truth. Project the template by useful dimensions, select one concrete point, inspect its route state and inputs, then read matched selector revisions and the low-to-high layer stack. At a resolution pin, identify each placement’s content winner, order winner, trace, and final request outcome. The explanation should end at the current publication, not a draft assumption.',
      successCriteria: [
        {
          id: 'distinguishes-summary-state',
          label: 'Distinguishes gallery cues from persisted workspace state',
        },
        { id: 'selects-concrete-point', label: 'Selects and identifies one concrete page point' },
        {
          id: 'reads-layer-stack',
          label: 'Reads selector revisions and layers in explicit priority order',
        },
        {
          id: 'explains-resolution-pin',
          label: 'Names content, order, provenance, and request outcome',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-author-change-publication',
      chapterId: 'operate-hud',
      chapterNumber: 5,
      sourceSectionIds: ['crud', 'publish-rollback'],
      title: 'Change safely, publish deliberately',
      prompt:
        'Describe the full author workflow for changing inherited content, previewing it, publishing it, checking isolation, and rolling it back.',
      modelAnswer:
        'Confirm template scope and selector matches, then use copy-on-write to append a block version and local operation in a new variant revision. Preview only through `/cms-preview_/*`; the public URL and `?edit_mode=true` must remain on the current publication. Publish the persisted revisions, inspect the strict document and provenance, and atomically activate it. If necessary, rollback by repointing to the retained predecessor. Hiding uses a tombstone; reverting removes the local operation.',
      successCriteria: [
        { id: 'scopes-before-change', label: 'Checks template and selector scope before editing' },
        { id: 'uses-immutable-revisions', label: 'Uses copy-on-write block and variant revisions' },
        {
          id: 'checks-preview-isolation',
          label: 'Keeps explicit preview separate from both public URL forms',
        },
        {
          id: 'publishes-and-rolls-back',
          label: 'Explains validation, atomic activation, inspection, and pointer rollback',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-serving-and-publication',
      chapterId: 'verify-current-system',
      chapterNumber: 6,
      sourceSectionIds: ['payloads-manifests', 'publication-transaction'],
      title: 'Serving shape and publication transaction',
      prompt:
        'Compare the two current serving shapes, then trace the synchronous SQLite publication transaction that produces them.',
      modelAnswer:
        'Expanded mode stores the complete rendered document for a one-query read. Manifest mode stores immutable page context plus a content-addressed structural manifest, then calls interpolateJson while reconstructing the same PublishedDocumentSchema value in two queries. CmsService.publish begins one immediate transaction, snapshots inputs, resolves every non-archived page, evaluates interpolation to validate the page output, writes immutable rows, and only then replaces current_publications. Any error rolls back the entire transaction and leaves the active pointer unchanged.',
      successCriteria: [
        {
          id: 'compares-serving-shapes',
          label: 'Compares expanded and manifest reads, bytes, and reuse',
        },
        {
          id: 'keeps-logical-equivalence',
          label: 'Requires the same strict logical published document',
        },
        {
          id: 'traces-current-transaction',
          label: 'Traces the synchronous resolve, validate, write, and activate sequence',
        },
        {
          id: 'states-rollback-behavior',
          label: 'States that failure rolls back rows and preserves the active pointer',
        },
      ],
    },
    {
      kind: 'teach-back',
      id: 'teach-back-verify-current-system',
      chapterId: 'verify-current-system',
      chapterNumber: 6,
      sourceSectionIds: ['verify-boundaries', 'review-handoff'],
      title: 'Verify the architecture from code',
      prompt:
        'Give the current architecture explanation you would present to the team and point to the code or test that verifies every step.',
      modelAnswer:
        'Start at the Drizzle schema and migrations, then follow selector and resolution unit tests, CmsService integration tests, publication evidence, the website public server function, PublishedDocumentSchema, and the block registry. Show that preview SQL is bounded and parameterized, publication evaluates validated selector structures and validates bounded interpolation, equal-priority placement collisions fail, and writes activate atomically. Then show that expanded serve parses stored rendered JSON while manifest serve deterministically interpolates immutable context, with one or two reads and no selector evaluation. Finish by running the focused tutorial suite and repository gate and reporting their actual results.',
      successCriteria: [
        {
          id: 'traces-vertical-slice',
          label: 'Traces one URL through current authoring, publication, and serving code',
        },
        {
          id: 'names-evidence',
          label: 'Names Linear scope, validation, benchmark, and browser evidence',
        },
        {
          id: 'names-runtime-guards',
          label: 'Names selector, interpolation, conflict, and public-serving guards',
        },
        {
          id: 'reports-actual-results',
          label: 'Reports focused and full validation results without inventing numbers',
        },
      ],
    },
  ],
});

export const chapterQuestionnaires = learningContent.questionnaires;
export const teachBackCards = learningContent.teachBackCards;
export const tutorialLearningCardIds = [
  ...chapterQuestionnaires.flatMap((questionnaire) =>
    questionnaire.questions.map((question) => question.id)
  ),
  ...teachBackCards.map((card) => card.id),
];

const QuestionnaireAnswersSchema = z.record(LearningIdSchema, z.int().min(0));

const QuestionnaireQuestionResultSchema = z.object({
  questionId: LearningIdSchema,
  selectedIndex: z.int().min(0).nullable(),
  answered: z.boolean(),
  correct: z.boolean(),
  explanation: z.string().min(1),
});
const QuestionnaireScoreSchema = z.object({
  questionnaireId: LearningIdSchema,
  answered: z.int().min(0),
  correct: z.int().min(0),
  incorrect: z.int().min(0),
  unanswered: z.int().min(0),
  total: z.int().positive(),
  percentage: z.int().min(0).max(100),
  complete: z.boolean(),
  mastered: z.boolean(),
  results: z.array(QuestionnaireQuestionResultSchema),
});
export type QuestionnaireScore = z.infer<typeof QuestionnaireScoreSchema>;

export function scoreQuestionnaire(
  questionnaireInput: ChapterQuestionnaire,
  answersInput: unknown
): QuestionnaireScore {
  const questionnaire = ChapterQuestionnaireSchema.parse(questionnaireInput);
  const answers = QuestionnaireAnswersSchema.parse(answersInput);
  const questionsById = new Map(
    questionnaire.questions.map((question) => [question.id, question] as const)
  );

  for (const [questionId, selectedIndex] of Object.entries(answers)) {
    const question = questionsById.get(questionId);
    if (!question) throw new Error(`unknown questionnaire question ${questionId}`);
    if (selectedIndex >= question.options.length) {
      throw new Error(`answer ${selectedIndex} is outside the options for ${questionId}`);
    }
  }

  const results = questionnaire.questions.map((question) => {
    const selectedIndex = answers[question.id] ?? null;
    return {
      questionId: question.id,
      selectedIndex,
      answered: selectedIndex !== null,
      correct: selectedIndex === question.answerIndex,
      explanation: question.explanation,
    };
  });
  const answered = results.filter((result) => result.answered).length;
  const correct = results.filter((result) => result.correct).length;
  const total = questionnaire.questions.length;

  return QuestionnaireScoreSchema.parse({
    questionnaireId: questionnaire.id,
    answered,
    correct,
    incorrect: answered - correct,
    unanswered: total - answered,
    total,
    percentage: Math.round((correct / total) * 100),
    complete: answered === total,
    mastered: correct === total,
    results,
  });
}

const TeachBackScoreSchema = z.object({
  cardId: LearningIdSchema,
  met: z.int().min(0),
  total: z.int().positive(),
  percentage: z.int().min(0).max(100),
  readyToExplain: z.boolean(),
  missingCriteriaIds: z.array(LearningIdSchema),
});
export type TeachBackScore = z.infer<typeof TeachBackScoreSchema>;

export function scoreTeachBack(
  cardInput: TeachBackCard,
  metCriteriaInput: unknown
): TeachBackScore {
  const card = TeachBackCardSchema.parse(cardInput);
  const metCriteriaIds = z.array(LearningIdSchema).parse(metCriteriaInput);
  const authoredCriteriaIds = new Set(card.successCriteria.map((criterion) => criterion.id));
  const uniqueMetCriteriaIds = new Set(metCriteriaIds);

  if (uniqueMetCriteriaIds.size !== metCriteriaIds.length) {
    throw new Error(`teach-back score for ${card.id} contains duplicate criteria`);
  }
  for (const criterionId of metCriteriaIds) {
    if (!authoredCriteriaIds.has(criterionId)) {
      throw new Error(`unknown teach-back criterion ${criterionId}`);
    }
  }

  const missingCriteriaIds: string[] = [];
  for (const criterion of card.successCriteria) {
    if (!uniqueMetCriteriaIds.has(criterion.id)) missingCriteriaIds.push(criterion.id);
  }
  const total = card.successCriteria.length;
  const met = uniqueMetCriteriaIds.size;
  return TeachBackScoreSchema.parse({
    cardId: card.id,
    met,
    total,
    percentage: Math.round((met / total) * 100),
    readyToExplain: met === total,
    missingCriteriaIds,
  });
}
