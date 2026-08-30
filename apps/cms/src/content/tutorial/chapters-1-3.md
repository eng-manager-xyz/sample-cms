# Chapter 1 — Trace the Current System

## 1.1 — The Executable Repository Map

> **Estimated time:** Read 5 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can locate each runtime responsibility in the repository, start both applications, and explain why SQLite access stays behind server-only boundaries.

Auteur is a Bun workspace with two TanStack Start applications and four domain packages. Start by learning those boundaries as executable code, not as abstract boxes:

| Path | Current responsibility |
| --- | --- |
| `apps/cms` | Authoring HUD, selector preview, publication controls, rollback, and this tutorial |
| `apps/website` | Published page delivery, explicit draft preview, admin handoff, and block rendering |
| `packages/cms-db` | SQLite client, Drizzle schema, migrations, reset, and deterministic seed |
| `packages/cms-domain` | Selector parsing/evaluation, resolution, hashing, interpolation, and published-document schemas |
| `packages/cms-service` | Validated authoring operations, draft resolution, publication transactions, rollback, and serving reads |
| `packages/cms-scenarios` | Store, Eligible Vehicles, and structural proof fixtures and evidence |

The repository root scripts make that map runnable. `bun run db:reset` recreates the local database from committed migrations. `bun run db:seed` writes repeatable representative data and publishes the three proof templates. `bun run dev:cms` serves the HUD at `http://localhost:3000`; `bun run dev:website` serves webpages at `http://localhost:3001`.

The CMS file routes live in `apps/cms/src/routes`. `/` renders the Wall of Maps, `/templates/$templateId` opens one template workspace, `/publications/$templateId` inspects immutable publication history, and `/tutorial` renders this course. Their browser components call functions declared in `apps/cms/src/server-functions/cms.functions.ts`. Those functions validate inputs and dynamically load `apps/cms/src/server/sqlite-authoring.server.ts`, where `CmsService` receives a database client.

The website has an equally direct route map:

```text
apps/website/src/routes/$.tsx                    public catch-all
apps/website/src/routes/[cms-preview_].$.tsx    explicit draft preview
apps/website/src/routes/admin.tsx                CMS-origin handoff
```

Each route calls a TanStack server function. Server-only modules open SQLite; browser modules receive parsed view models. The public loader in `apps/website/src/server-functions/published-page.functions.ts` opens the database with `{ readonly: true, create: false }`, calls `CmsService.serve`, parses the returned document, and closes the connection. The browser never imports `bun:sqlite`, `@repo/cms-db`, or the database client.

Within the packages, dependencies flow in one direction. `@repo/cms-db` owns persistence. `@repo/cms-domain` owns pure rules and strict data contracts. `@repo/cms-service` combines those rules with transactions. Both applications consume the service through server-only code. `@repo/cms-scenarios` exercises the same public domain and service APIs used by the applications.

> **Current contract — one implementation path.** The HUD, seed, integration tests, scenario reports, preview, publication, and public website all meet at the same domain and service code. A UI panel does not carry a second interpretation of selection or resolution.

The local database contains route identity, status, and revision fields, but this repository does not make a network call to an external route service. Deterministic seed and integration inputs exercise that seam locally. When explaining what runs today, point to the committed adapter, tables, and tests rather than implying an unimplemented remote dependency.

**Digest prompt:** Starting at `apps/cms/src/routes/templates.$templateId.tsx`, trace the import boundary into a server function, the SQLite authoring adapter, `CmsService`, the domain package, and `@repo/cms-db`. Then trace `apps/website/src/routes/$.tsx` to its read-only serving call. Name the first file in each path that is allowed to open SQLite.

## 1.2 — Trace One Canonical URL

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can trace `/en-US/store/1001` from route matching and relational authoring rows through publication validation to the exact React block components that render it.

Use the seeded Store representative as a concrete thread:

```text
http://localhost:3001/en-US/store/1001
```

`apps/website/src/routes/$.tsx` converts the TanStack splat into `/en-US/store/1001` and calls `loadPublishedPage`. In `apps/website/src/data/public-path.ts`, `resolvePublicTemplate` matches the path to scenario `stores`, template `tpl-store`, and canonical host `www.ubereats.com`. Local development accepts a loopback host; the normal host check requires the template's configured canonical host.

The page's authoring identity lives in normalized SQLite rows. `packages/cms-db/src/schema/index.ts` defines `templates`, `template_slots`, `page_instances`, `page_slot_values`, `tags`, and `page_tags`. For this URL, the template supplies the path grammar, the page instance supplies stable identity and lifecycle, scalar slot values include locale and store ID, and explicit tag memberships can describe store type, category, and brand.

Those facts answer different questions:

| Current fact | What it controls |
| --- | --- |
| Template and ordered slots | Canonical URL shape and template boundary |
| Page instance | Stable identity, canonical URL, route status, revision, and immutable context |
| Slot values and tags | Approved selector inputs |
| One template default | Baseline placements for every page in the template |
| Active variant revisions | Sparse `set`, `tombstone`, and `order` decisions |
| Variant priority | The order in which matching layers are folded |

The Store page can match independent chain, fast-food, and brand selectors at the same time. `packages/cms-domain/src/selector.ts` parses, normalizes, validates, and evaluates their approved expressions. `packages/cms-domain/src/resolution.ts` starts with the template default, rejects same-priority operations that touch the same placement, then applies the matching sparse operations in ascending explicit priority. Creation time, row ID, selector length, and iteration order never choose a winner.

Stable placement keys such as `primary-hero` identify document positions. A winning `set` points to an immutable block version and carries source revision, operation, and priority provenance. An `order` operation changes position without changing content. The HUD's Hide action writes a `tombstone` operation in draft resolution; a higher-priority `set` can reintroduce that placement. Revert removes the local operation so the lower winner is visible again.

Publication turns the resolved draft into a smaller serving contract. `CmsService.publish` compiles every non-archived page in the template, including both `live` and `not_live` rows. It evaluates each validated selector AST in Bun, resolves placements, evaluates bounded `{{ dotted.path }}` expressions from immutable page context, and validates the exact page output. Expanded mode persists that rendered document; manifest mode persists shared structural winners plus the page's immutable context. The exact output crosses `PublishedDocumentSchema` from `packages/cms-domain/src/published-document.ts` during compilation.

That schema is intentionally narrow. A published document contains the template ID, page ID, and an ordered placement list. Each placement contains a unique stable key, contiguous order, block type, immutable block-version ID, materialized content, and the provenance of the winning `set`. Tombstones, the full resolution trace, and separate order provenance remain authoring/debug information; they are not part of the public document.

On request, `CmsService.serve` reads the active publication. Expanded mode uses one SQLite query and parses the stored rendered JSON. Manifest mode reads the page row and shared manifest in two queries, then calls `interpolateJson` against the stored immutable page context before validating the same document shape. Both paths execute zero selector SQL or AST evaluation. A missing, archived, `not_live`, or unpublished page returns `404`. A successful result is parsed through `PublishedDocumentSchema`, transformed into a website view model, and rendered by `apps/website/src/components/published-page.tsx` and `block-renderer.tsx`. The registry selects `navigation`, `hero`, `hero_alt`, `promo`, or `footer` synchronously from the published `blockType`.

> **Current contract — one URL, one document.** One canonical domain/path belongs to one template and page instance. When that live page has an active publication, the request returns one schema-valid immutable document whose placements identify their exact winning block versions.

**Digest prompt:** Trace `/en-US/store/1001` aloud using eight nouns: route pattern, template, page instance, selector inputs, matching variants, resolved placements, active publication, and block renderer. At each step, name the file or table that makes the claim inspectable.

## 1.3 — Authoring, Publication, Serving, and Preview

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can separate the four executable runtime lanes, identify where selectors are evaluated, and explain why a draft edit cannot appear on a public URL before publication.

The current system has four lanes with distinct inputs and outputs:

```text
authoring mutation → normalized SQLite authoring rows
draft preview      → current resolved authoring document
publication        → validated immutable documents + active pointer
public serve       → active document → synchronous React blocks
```

**Authoring.** `apps/cms` runs on port `3000`. The template workspace submits validated commands through `executeCmsMutation` in `apps/cms/src/server-functions/cms.functions.ts`. `executeCmsCommand` in `apps/cms/src/server/sqlite-authoring.server.ts` delegates to `CmsService` methods that create revisions instead of editing published values. Authors can add or version blocks, replace a block type under a stable placement key, hide or revert a variant placement, reorder, edit selectors and priorities, publish, and roll back.

**Draft preview.** Selector preview in the CMS compiles approved selector text to parameterized SQL and returns a bounded count, sample URLs, warnings, and query plan. A full draft page uses `CmsService.resolveDraftByCanonicalUrl`, which evaluates the validated selector AST and calls the domain resolver. The website exposes that result only below `/cms-preview_/<canonical-path>`. `apps/website/src/server/preview-page.server.ts` opens the database read-only and creates a preview view model from current authoring state.

**Publication.** `CmsService.publish` runs synchronously inside one SQLite transaction. It prepares template-scoped resolution state, compiles every non-archived page, evaluates interpolation to validate each exact public document, writes immutable publication/manifests/page rows, and changes `current_publications` only after the complete result is valid. Expanded rows keep the rendered JSON; manifest rows keep immutable context for deterministic reconstruction. A conflict or validation failure rolls back the transaction and leaves the current pointer unchanged. An input identical to the current publication reuses that result instead of adding duplicate page rows.

**Public serving.** The website's canonical catch-all opens SQLite read-only and calls only `CmsService.serve`. It never resolves authoring layers and never executes selector SQL. The request's search input is not part of `PublicPageRequestSchema`, so `/en-US/store/1001?edit_mode=true` returns the same active publication as `/en-US/store/1001`.

The preview response is deliberately private. Its server function sets:

```text
Cache-Control: private, no-store
X-Robots-Tag: noindex, nofollow, noarchive
```

Preview is available automatically in development and tests. Outside those environments it requires `CMS_ENABLE_PREVIEW=true`, a matching canonical host, and an explicit localhost exception only for a local production-mode smoke test. These checks isolate the prototype route, but they do not implement user identity, roles, sessions, or authorization.

`/admin` is a separate no-store handoff page. `apps/website/src/server/admin-gateway.server.ts` accepts `CMS_ADMIN_ORIGIN` only when it is a bare absolute HTTP(S) origin with no credentials, path, query, or hash. It renders a direct link to the CMS; it does not proxy, iframe, or authenticate the authoring application.

Route status is also local and explicit. The seeded `page_instances.route_status` value controls the serving result: `live` may return `200` when published, `not_live` and `archived` return `404`, and a live page without an active document returns `404` with reason `unpublished`. Publication includes `not_live` pages so their compiled result can share the immutable publication, but serving still enforces their status.

The four lanes share block schemas and renderers without sharing authority. Preview may show draft provenance and tombstones. Publication validates the narrow `PublishedDocumentSchema`; expanded mode stores it directly, while manifest mode stores the immutable inputs required to reconstruct it. The React registry receives only the final validated placement list. Rollback moves the active pointer to a retained immutable publication; it does not mutate either snapshot.

> **Current contract — draft state has one explicit entrance.** Authoring resolution is reachable through CMS tools and the `/cms-preview_/*` namespace. A canonical public route, with or without query parameters, reads only the active publication.

**Digest prompt:** Draw four arrows for authoring, draft preview, publication, and public serving. Label selector SQL as preview-only, selector AST evaluation as draft/publication work, expanded serving as a stored-document read, and manifest serving as deterministic interpolation from immutable context. Then explain where an unpublished hero edit is visible and where it is impossible to observe.

## 1.4 — Learn from Contracts and Executable Evidence

> **Estimated time:** Read 5 min · Media 0 min · Digest 2 min
> **Learning outcome:** You can verify an architectural claim by locating its schema, implementation, focused test, scenario proof, and cross-workspace gate instead of relying on tutorial prose alone.

Treat the repository as a connected learning instrument. Every important sentence in this tutorial should lead to executable evidence. A useful reading order is:

1. **Start at a boundary.** Open `packages/cms-domain/src/published-document.ts`, `packages/cms-domain/src/types.ts`, or `packages/cms-db/src/schema/index.ts` and state what values are legal.
2. **Follow the implementation.** Read the corresponding method in `packages/cms-service/src/cms-service.ts`, then follow its calls into selector, resolution, hashing, interpolation, or publication helpers.
3. **Read the focused test.** Domain tests isolate pure invariants; service integration tests prove transactions and SQL behavior; application tests prove route and rendering boundaries.
4. **Run a representative scenario.** `packages/cms-scenarios` assembles Store, Eligible Vehicles, and structural replacement through the same service APIs.
5. **Finish with the gate.** `bun run five-phase-pass` checks migrations, seed repeatability, formatting, types, tests, evidence, both TanStack builds, and cross-workspace boundaries.

Use four evidence labels while reading:

> **Invariant** — a rule enforced by schemas or behavior, such as unique placement keys, explicit priority, immutable published versions, atomic activation, or zero selector SQL on public serving.

> **Implementation** — the checked-in mechanism that satisfies an invariant today, such as Bun workspaces, `bun:sqlite`, Drizzle migrations, one synchronous publication transaction, or the TanStack server-function boundary.

> **Measured result** — output tied to a command, commit, database shape, runtime, and host. `docs/evidence/bounded-report.json` and `docs/evidence/store-1m.json` preserve those facts; `docs/benchmarks.md` interprets them.

> **Runtime boundary** — an explicit limit visible in current code. Examples include browser-local tutorial progress, read-only website connections, preview environment/host checks, and the fact that the admin gateway is a link rather than an authorization system.

These labels keep explanations precise. “Public serving executes zero selector statements” is an invariant with service evidence. “Manifest serving executes two SQLite statements” is the current implementation and a measured result. “Every published page must use two statements” would be inaccurate because expanded mode uses one.

The strongest way to learn a mechanism is to triangulate it. To understand conflict handling, read `detectVariantConflicts` and `resolveDocument` in `packages/cms-domain/src/resolution.ts`, then the permutation and conflict cases in `resolution.test.ts`, then a service publication failure test. To understand public rendering, read `PublishedDocumentSchema`, `CmsService.serveWithEvidence`, `loadPublishedPage`, and `block-renderer.tsx`, then run the website integration tests.

The checked-in evidence envelopes make scale claims reproducible. They record invocation, commit and dirty state, lockfile digest, Bun and SQLite versions, host resources, scenario counts, timings, and hashes. Never detach a benchmark number from that provenance. The compact seed is the fastest way to understand behavior; the evidence envelopes show that the same contracts were exercised at their recorded scale.

When re-explaining Auteur to a teammate, use one vertical slice before summarizing the whole repository. Start with `/en-US/store/1001`, point to its template/page/selector inputs, resolve its placements, publish its immutable document, serve it read-only, and name the React component for each block type. Then use the Eligible Vehicles and structural routes to show how the same code handles different variation shapes.

> **Current contract — prose is a map, code is the authority.** If this tutorial, a test, and an implementation disagree, inspect the shared schemas and current executable path, correct the stale explanation, and keep the test guarding the contract that users actually run.

**Digest prompt:** Choose one claim—same-priority conflict failure, copy-on-write, selector-free serving, preview isolation, or rollback. Name the schema or type, implementation function, focused test, proof route, and final command you would use to teach and verify it.

# Chapter 2 — The Relational Grammar

## 2.1 — Maps, Points, and Dimensions

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can translate the wall-of-maps metaphor into templates, page instances, slots, tags, defaults, and variants without treating the metaphor as the data model itself.

Auteur's most memorable picture is a **wall of maps**. Each map represents one URL template. A concrete URL is a point on that map. Transparent sheets cover selected regions, and a vertical pin through one point reveals every sheet that contributes to the final page.

The picture makes two current rules visible at once. Each template owns an isolated map and exactly one default. Each page is a first-class point described by several independent dimensions, some visible in the path and some supplied as explicit classifications.

Take the Store template:

```text
domain:      www.ubereats.com
url pattern: /{locale}/store/{store_id}
```

A concrete point might be:

```text
canonical path: /en-US/store/1001
locale:         en-US
store_id:       1001
store_type:     chain_store
category:       fast_food
brand:          mcdonalds
```

The first three values participate directly in route shape and identity. The classifications beneath them are equally useful for content selection, even though they are not parent path segments. That is why the model needs both **slots** and **tags**.

A slot is a declared scalar dimension. It may be a static path segment, a variable path segment, or a derived non-path value. One page has one normalized value for a declared slot. A tag is a template-scoped classification with explicit many-to-many membership. One page may have several tag values, including several values in one namespace if the product permits it.

The relational distinction prevents convenient fiction from becoming hidden behavior. If a page is tagged `brand=mcdonalds`, the database does not silently infer `category=fast_food` or `store_type=chain_store`. Those memberships must be present explicitly, with their own source. The model can represent a hierarchy between tag definitions for navigation or explanation, but parentage does not manufacture membership.

The sheet is sparse for the same reason. It stores only the placement decisions made at that layer, not a photographed copy of every block underneath it. A point can therefore sit under several sheets while each sheet remains independently understandable: one selection rule, one priority, and a small set of intended changes.

Now map the visual language to rows:

| Visual idea | Relational entity |
| --- | --- |
| One map | `templates` |
| One dimension | `template_slots`, `tags` |
| One point | `page_instances` |
| Coordinates | `page_slot_values`, `page_tags`, page context |
| Base sheet | the template's default `variant` and active revision |
| Overlay sheet | a non-default `variant`, active revision, and sparse operations |
| Vertical pin | preview or publication resolution for one page |

This mapping comes directly from sections 2 and 3 of `docs/process-engineering-guide.md`. The full relationship graph appears in `docs/data-model.md` under “Relational overview.”

The word **map** should not be taken too literally. A template with locale and store ID is not necessarily a complete rectangle where every possible combination exists. Page instances are the concrete points that actually exist. Different templates may have radically different cardinalities, so physical area in the HUD cannot represent them faithfully. A million-point map and a two-point map are still peers in the product model.

The same restraint applies to a two-dimensional projection. The HUD can plot two selected dimensions to make a large relation visible, but omitted dimensions continue to constrain the data. A projection is an inspection tool, not proof that the underlying model has only two axes.

> **Requirement — template isolation.** A template owns its slots, page instances, tags, block lineages, variants, publications, and exactly one default. A Store default can never flow into an Eligible Vehicles page.

> **Current implementation — normalized dimensions.** SQLite stores scalar values in `page_slot_values` and explicit memberships in `page_tags`. Template foreign keys, unique constraints, and service validation preserve ownership and selector safety.

The wall-of-maps metaphor is therefore a gateway, not a substitute for precision. It helps you see separate content spaces, high-dimensional page points, and sparse layers. The tables provide the enforceable grammar underneath.

**Digest prompt:** For `/en-US/store/1001`, identify the map, the point, two scalar coordinates, and three independent classifications. Then ask which of those facts actually determine content precedence. The answer is: none by themselves. Matching variants and explicit priority do that work.

## 2.2 — Route Inputs, Lifecycle, and Explicit Classification

> **Estimated time:** Read 6 min · Media 0 min · Digest 2 min
> **Learning outcome:** You can follow one route import from observed source revision to page, slot, tag, and audit rows, and explain why replay and archived-state rules belong to the content contract.

A map is useful only if its points have trustworthy identities and coordinates. Auteur therefore treats route ingestion as a first-class process rather than allowing unrelated code to insert page-shaped rows whenever convenient.

The sequence begins with `route_ingestions`. One row represents one attempt to apply a route or seed revision for one template. Its key includes the template, source, and source revision, which gives the import an idempotency identity. The row also records `source_observed_at`: when the input state was observed. That timestamp is immutable because changing it later would rewrite the meaning of the import.

The ingestion moves through a controlled lifecycle. It begins as `running` and closes as `succeeded` or `failed`, with completion shape and row counts checked. Replaying the same source revision with the same input reuses the logical result rather than duplicating pages or memberships. Reusing the revision identifier with different input is an error, because it would make one external revision mean two things.

For each route, `page_instances` stores the stable content-side identity. Important fields include:

- the owning template;
- the normalized absolute canonical path;
- the external route identity recorded by the adapter;
- lifecycle status;
- route revision;
- immutable-at-publication context;
- hashes representing slot values and context;
- the last ingestion responsible for the current input.

Several uniqueness rules protect the “one URL, one answer” invariant. External route identity is unique. Canonical URL is unique within a template. Domain-plus-path ownership is unique across templates sharing a domain. Slot-value identity is also constrained within its template. `docs/data-model.md`, table 4, lists the exact prototype constraints; migration `packages/cms-db/drizzle/0003_domain_path_canonical_identity.sql` adds the domain/path boundary.

Slots are normalized through `template_slots` and `page_slot_values`. The template declares which dimensions exist, their order in the path when applicable, and whether they are static, variable, or derived. Each page-value row points to both a page and a declared slot inside the same template. The selector index orders by template, slot, normalized value, and page identity, allowing a safe selector compiler to find matching points without author-controlled table names.

Tags use two more tables. `tags` defines a namespace/value pair inside one template, along with label, description, source, and optional parent metadata. `page_tags` records an explicit page-to-tag membership and its assignment source. This separates the meaning of a tag from the fact that one page carries it.

That source matters. A classification may come from a pipeline, an author, or deterministic seed data. The current rows preserve the distinction rather than flattening all memberships into unexplained strings. Selector evaluation consumes the explicit memberships that are actually stored; it does not infer a source winner or derive one tag from another.

Lifecycle changes receive their own immutable evidence in `route_audit_log`. Insert, update, status transition, skip, and error actions can be traced back to the ingestion and page. Update/delete triggers protect the audit rows. The log turns “Why is this route archived?” from guesswork into a question with a recorded source action.

`archived` deserves special attention. It is not merely another display filter. The service rejects casual reactivation because archive represents an intentional soft deletion. `not_live`, by contrast, describes a route that exists but currently returns `404`. Publication compiles `live` and `not_live` pages and excludes `archived` pages; serving returns `404` for both non-live statuses.

> **Current contract — route status gates serving.** Authoring state may exist for a page, but it cannot make a `not_live` or `archived` page serve as live.

> **Measured finding — deterministic replay is executable.** The committed Store evidence replays the same scale seed, inserts zero additional pages, reproduces its seed identity, and leaves page and tag-membership counts unchanged. The exact evidence is under `scenarioReport.store.seedReplay` in both JSON ledgers; consult the files rather than memorizing host timings.

The first eight domain tables—templates, slots, ingestions, pages, slot values, tags, page tags, and route audit—form the input side of the model. They say which page points exist, how they are described, and where those facts came from. They do not yet say what content wins. That is the job of blocks, variants, and operations.

**Digest prompt:** Trace one classification from source to selector: an ingestion observes a route revision; a page row establishes identity; a tag definition names `category=fast_food`; a membership assigns it to the page; a later selector may match it. No step should require guessing from brand hierarchy.

## 2.3 — Stable Placements and Immutable Block Versions

> **Estimated time:** Read 6 min · Media 0 min · Digest 2 min
> **Learning outcome:** You can distinguish placement identity, block type, lineage, and version, then explain copy-on-write, type replacement, tombstone, order, and revert without mutating history.

Page content needs two kinds of stability that are easy to confuse. Authors need a stable name for a conceptual position such as `primary-hero`. The system also needs immutable records of the content values that have occupied that position. Auteur models those needs separately.

A **placement key** names the position. It is not the array index, block type, or current block version. `primary-hero` remains the same placement even if the hero moves in display order, receives new copy, or changes from `hero` to `hero_alt`. This stable identity makes diffs and provenance legible across structural change.

A **block type** defines a schema and editor/rendering contract. It answers “What shape of JSON is valid here?” A type such as `hero_alt` may require fields that ordinary `hero` does not. Type contracts are registered in `block_types`; their key and schema contract are immutable, while preview metadata may evolve without rewriting pinned content.

A **block lineage** is the stable identity stream for related content inside one template. A **block version** is one immutable typed JSON value in that lineage. Versions append; they are not edited in place. An optional parent-version reference records copy-on-write ancestry. Content hash and version constraints prevent the lineage from becoming an untraceable list of mutable blobs.

The default document uses the same variant/revision/operation machinery as every other layer. Its `variants` row is special only because it is the one template default, has priority zero, and matches the whole template. Its active `variant_revision` contains `set` and `order` operations that establish the initial visible placements.

Non-default variants are sparse. A McDonald's layer does not clone navigation, hero, promo, and footer. It can contain one operation: set `primary-hero` to a new block version. The other placements continue to resolve from lower layers.

The three operation forms are deliberately small:

| Operation | Meaning |
| --- | --- |
| `set` | Introduce or replace the content winner at a placement |
| `tombstone` | Make the lower placement absent at this layer |
| `order` | Change display order without creating a new content version |

Editing inherited content is **copy-on-write**. The service reads the current lower winner, validates the new JSON against the chosen block type, appends a block version, and adds a local `set` operation in a new variant revision. The default operation and inherited version remain unchanged. `docs/data-model.md` shows this exact row shape in “Copy-on-write,” while `packages/cms-domain/src/resolution.ts` exposes the corresponding `copyOnWritePlacement` behavior.

Hiding is not deletion. A tombstone records an explicit local decision that a lower placement should remain absent. Resolution keeps the hidden lower value in the trace even though it omits it from the visible document. A higher-priority `set` may intentionally reintroduce the placement.

Revert is not a fourth operation type. A new immutable revision simply omits the local `set` or tombstone for that placement. With the local decision gone, the lower winner becomes visible again. This difference is essential:

```text
hide   = “I decide that this placement is absent here.”
revert = “I make no local content decision here.”
```

Structural replacement uses the same stable key. A new typed version can change `primary-hero` from `hero` to `hero_alt` while retaining the placement and, when intentional, the lineage. An independent order operation can move it without pretending that content changed. The structural scenario later proves that schema and renderer contracts differ and that an old hero payload is invalid for `hero_alt`.

> **Requirement — immutable authoring history.** Block versions, variant revisions, and operations append. Published versions cannot be edited under an existing identifier.

> **Requirement — one content decision and one order decision per revision/placement.** The database payload checks and domain validation reject malformed or duplicate operations.

Tables 9 through 14 in `docs/data-model.md` give the precise ownership and constraints for variants, revisions, block types, lineages, block versions, and operations. Their TypeScript representation lives in `packages/cms-domain/src/types.ts`. Together they form a vocabulary in which content can evolve without losing the identity of the page position or rewriting earlier decisions.

**Digest prompt:** If an author changes the McDonald's hero text, name the rows that remain unchanged: the placement key, default operation, inherited block version, and unrelated placements. Then name what is appended: a new block version and a new variant revision containing a local `set`.

## 2.4 — The Compiler Boundary: Authoring Rows In, Serving Rows Out

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can partition every major table into authoring input or published serving state and trace publication, public serving, and rollback without crossing that boundary.

The normalized authoring model is expressive because it retains all the pieces that may influence a page: slots, tags, selectors, priorities, block versions, operations, route revisions, and context. That expressiveness also makes it the wrong shape for a public request. The request path should not re-evaluate a miniature content-management system.

Publication is the boundary between the two worlds.

On the authoring side, a publisher reads the required snapshot of:

- template and slot definitions;
- page identities, statuses, context, slot values, and tags;
- active variant revisions and validated selectors;
- default and sparse operations;
- block schemas, lineages, and immutable versions.

On the serving side, it writes five kinds of rows.

`publications` records one immutable compilation attempt and result for a template. It includes a sequence, input hash, counts, prior publication, creator, and publication time. The prior link retains a rollback target.

`document_manifests` records a content-addressed structural document within a template. Pages with the same ordered placement keys, winning block-version pointers, and source provenance can share a manifest.

`document_manifest_items` stores each ordered placement in that manifest, including the winning block version and exact source revision, operation, and priority. A database trigger proves that the recorded source operation is the same-template `set` that selected the version.

`published_page_documents` maps one page in one publication to canonical URL, route status, immutable context, document hash, and a manifest. Depending on materialization mode it may also carry the fully rendered document. At the TypeScript boundary, `PublishedDocumentSchema` is the strict contract for that rendered value: it requires template and page identity, unique stable placement keys, contiguous order, immutable block-version pointers, typed content, and exact source revision, operation, and priority provenance. The service parses the value when compiling and again when serving, so malformed persisted JSON cannot quietly become a webpage.

`current_publications` is the small mutable seam: one active publication pointer per template. Activation changes this pointer only after the immutable result is complete and validated. Rollback changes it to a retained prior publication; it does not rebuild or mutate either publication.

Tables 15 through 19 in `docs/data-model.md` define these rows. The “Authoring versus serving access” matrix in the same file is an especially useful review tool. Template setup, ingestion, selector preview, and block edits work on authoring rows. Publication reads authoring and appends serving rows. Public serving reads only the current pointer and immutable materialized data. Rollback touches only the pointer.

This boundary produces two critical safety properties.

First, **draft work does not leak**. An author can create block versions, revise selectors, or introduce a conflict without changing the active publication. Until a compile succeeds and activates, public reads stay on the former immutable result.

Second, **serving is selector-free**. The inspection SQL in `docs/data-model.md` joins the current publication, published page document, manifest items, block versions, and block types. It can return the ordered winner and provenance for one canonical URL without consulting variants, operations, slots, tags, or selector text. `apps/website` demonstrates the executable boundary with a read-only database connection and one `CmsService.serve(templateId, canonicalUrl)` call. The public budget is **1–2 SQLite reads and zero selector statements**: expanded publication takes one read and manifest reconstruction takes two, and both return the same validated page contract.

The website turns that contract into React without another data model. Its public page view model fixes `renderMode` to `published` and `editable` to `false`, and each ordered placement is dispatched synchronously by `blockType`. Stable `placementKey` supplies both document identity and the React key. Known types such as `navigation`, `hero`, `hero_alt`, `promo`, and `footer` have renderers; an unknown published type is visible as an unsupported-block fallback instead of disappearing silently. Preview uses a discriminated sibling model with authoring provenance, but it is loaded only from the explicit preview namespace.

The process resembles a compiler more than a view. An ordinary database view would recompute joins and selectors when read. Auteur snapshots inputs, checks conflicts, resolves and validates documents, canonicalizes and hashes results, writes immutable publication rows, and then activates one complete result. The executable path is `CmsService.publish` in `packages/cms-service/src/cms-service.ts`.

> **Requirement — atomic visibility.** A failed compile or write must leave the former current pointer active and must not expose partial rows as the live result.

> **Current implementation — SQLite transaction.** `CmsService.publish` writes the complete publication and changes `current_publications` inside one synchronous SQLite transaction. Any thrown conflict, schema error, or write failure rolls back the transaction.

> **Measured finding — fixed public read shapes.** The evidence records a two-statement manifest reconstruction and a one-statement expanded-document fixture, both with zero selector statements. The requirement is selector isolation and bounded reads, not that every implementation use one particular statement count.

The boundary also explains why authoring can be expensive without making every request expensive. Preview may parse a selector, execute an indexed query, calculate full match counts, and report overlaps. Publication may resolve every eligible page. Public serving performs the work already compiled for its URL. A public query such as `?edit_mode=true` is discarded by route validation; it cannot select the preview model or make a placement editable.

At this point the data model has all its nouns: maps, points, dimensions, layers, operations, block versions, publications, manifests, and pointers. The next chapter turns those nouns into a small algebra—an exact procedure for deciding what one page means.

**Digest prompt:** Place `variant_operations` and `document_manifest_items` on opposite sides of a line. The first is an authoring instruction; the second is a compiled winning fact. Put `PublishedDocumentSchema` and the synchronous registry on the serving side, then explain why neither `edit_mode` nor a renderer may cross back into authoring state.

# Chapter 3 — The Wall-of-Maps Algebra

## 3.1 — Turn the Metaphor into Sets

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** You can express templates, pages, selectors, priorities, and sparse operations with a compact notation and use it to describe which layers are relevant to one page.

The wall of maps becomes more powerful when we can state its rules without relying on pictures. We do not need advanced mathematics. A few sets and functions are enough to distinguish selection, precedence, resolution, and publication.

Let `T` be one template. Everything that follows stays inside that template boundary.

Let `P_T` be the set of concrete page instances owned by `T`:

$$
P_T = \{p \mid \operatorname{template}(p)=T\}
$$

Each page `p` has scalar slot values, explicit tag memberships, immutable-at-publication context, canonical identity, and route state. Together those values describe the point on the map. They do not yet decide content.

Let `K_T` be the set of stable placement keys that may appear in the template's document, such as `navigation`, `primary-hero`, `category-promo`, and `footer`.

The template owns one default document `D_T`. You can think of it as a partial mapping from placement key to an initial content-and-order pair:

$$
D_T : K_T \rightharpoonup (\text{block version},\ \text{order})
$$

The hooked arrow reminds us that not every conceivable placement key must be present. In the database, the default is the special template-owned variant at priority zero with an active revision and operations. In the algebra, `D_T` is simply the base state from which resolution begins.

A non-default variant is a tuple:

$$
v = (S_v,\ \pi_v,\ O_v)
$$

where:

- `S_v` is the validated selector;
- `π_v` is the explicit positive integer priority;
- `O_v` is the sparse set of placement operations in the active revision.

The selector defines a **mask** over the template's pages:

$$
M_v = \{p \in P_T \mid S_v(p)=\text{true}\}
$$

This is the precise version of a transparent sheet covering part of a map. A page may lie beneath no non-default mask, one mask, or several intersecting masks.

For one page `p`, collect its matching layers:

$$
L_T(p)=\{v \mid p \in M_v \land v\text{ is active}\}
$$

Resolution starts with `D_T`, then considers the members of `L_T(p)` in ascending priority order. Importantly, `L_T(p)` is a **set of applicable layers**, not a declaration that the page belongs to exactly one variant.

The Store example makes this concrete. Suppose page `p_m` carries explicit memberships for chain store, fast food, and McDonald's. Then:

$$
p_m \in M_{chain} \cap M_{fast} \cap M_{mcd}
$$

The three layers can compose because their operations are sparse: the chain layer sets `footer`, the fast-food layer sets `category-promo`, and the McDonald's layer sets `primary-hero`. `navigation` remains in `D_T`. The page is not assigned to one “most specific variant.” It is a point where three masks overlap.

This notation keeps three current questions separate:

1. **Existence:** Is `p` in `P_T`, and what is its route state?
2. **Selection:** For which variants is `p ∈ M_v`?
3. **Resolution:** How do `D_T` and the selected `O_v` produce one document?

Read the symbols as a sentence rather than a proof. “Within template `T`, page `p` belongs to the concrete page set. Variant `v` covers `p` when its selector is true. Its priority tells us when to apply it, and its sparse operations tell us where it acts.” Nothing in that sentence depends on a database engine or a visual layout.

Section 2 of `docs/process-engineering-guide.md` supplies the spatial model, and section 3 supplies the canonical vocabulary. `packages/cms-domain/src/types.ts` supplies the executable shapes for defaults, layers, operations, placements, and resolved documents.

> **Requirement — closure inside one template.** Selectors, operations, block versions, pages, and publications cannot escape `T`. The composite database relationships are enforcement, not mere join convenience.

> **Current implementation — explicit page set.** SQLite stores concrete page instances and normalized dimensions. The selectors, resolver, publication loop, and serving rows all preserve the same logical `P_T`, masks, and template boundary.

The notation is intentionally modest. It does not prescribe SQL, indexes, or storage engines. It gives us a shared language for the invariant: one page may match many sparse layers, but resolution must still produce one deterministic effective document.

**Digest prompt:** Write `v = (S_v, π_v, O_v)` from memory. For each component, answer one question: Which pages? At what precedence? Which placements? If you can keep those answers separate, the remaining algebra becomes mechanical.

## 3.2 — Compile a Selector into a Safe Mask

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can follow selector text through parsing, normalization, validation, parameterized SQL, and bounded preview, while identifying which parts an author may and may not control.

In the algebra, `S_v(p)` looks like a simple Boolean function. In the product, an author needs to write, preview, save, and revise it safely. That means the system must turn human-readable selector text into the mask `M_v` without granting arbitrary SQL access.

The selector language is intentionally smaller than SQL. It supports approved field comparisons, `IN`, `AND`, `OR`, and parentheses. A Store selector may look like:

```text
category = 'fast_food'
```

or combine dimensions:

```text
locale = 'en-US' AND state IN ('CA', 'NY')
```

The author controls the expression and literal values, but not table names, joins, template scope, or executable SQL structure.

The compilation pipeline is:

$$
\text{text}
\rightarrow \text{tokens}
\rightarrow \text{AST}
\rightarrow \text{normalized AST}
\rightarrow (\text{SQL},\ \text{parameters})
$$

**Tokenize.** The tokenizer applies length and token-count limits before expensive work. It recognizes only the language's supported identifiers, literals, operators, commas, and parentheses. Comments, statement separators, and executable-looking input are rejected rather than ignored.

**Parse.** The parser builds an abstract syntax tree. Operator precedence and grouping become explicit structure instead of relying on string manipulation. Malformed input fails here with a selector error.

**Normalize.** Equivalent commutative expressions receive a stable ordering, formatted form, and hash. This makes revisions comparable and supports deterministic inputs. Normalization must not change meaning; it is canonical representation, not optimization by guesswork.

**Validate fields.** Every identifier must appear in the template-owned allowlist. A template may expose `locale`, `state`, or a tag projection such as `brand`; an author cannot name `publications`, `sqlite_master`, or an unrelated template's field.

**Compile.** Approved identifiers come from trusted metadata. Every authored value becomes a bound parameter. Template ownership is injected outside the author AST. In simplified form:

$$
Q_T(S_v)=\{p\in P_T \mid \operatorname{Eval}(S_v,p)=\text{true}\}
$$

The generated query always includes the fixed `T` boundary even though the author did not type it. A multi-valued tag field can lower to an indexed membership `EXISTS` query; it never becomes hidden hierarchy inference.

**Preview.** The service returns a bounded sample, the exact full match count, truncation state, query-plan steps, and overlap diagnostics. Sample size and total cardinality are separate facts. An author can inspect representative pages without pretending the sample is the complete set.

Saving the selector also preserves its authored input, normalized representation, stable hash, validation result, and revision identity. That history matters when a publication later explains why a page matched: it can name the exact selector revision rather than merely repeating whatever text happens to be current in an editor. Revising a selector appends a new authoring snapshot; it does not reinterpret an earlier publication.

The complete behavior is specified in section 5.3 and the selector-safety boundary of `docs/process-engineering-guide.md`. Parsing and normalization live in `packages/cms-domain/src/selector.ts`; SQL lowering lives in `packages/cms-service/src/selector-sql.ts`. The selector test corpus is authoritative evidence for rejected keywords, DDL/DML, `PRAGMA`, comments, multiple statements, unsupported operators, unknown fields, excessive input, and excessive tokens.

> **Requirement — selectors execute only at preview or publication time.** They are authoring/compiler inputs. The public request path reads materialized results and executes zero selector statements.

> **Requirement — values are data, never code.** Author literals become SQL parameters. Only allowlisted metadata can become an identifier.

> **Measured finding — plans are inspectable.** The Store evidence records the saved selector, revision, exact match count, sample, affected placement, pairwise overlap, timing, and full `EXPLAIN` plan for each persisted layer. The exact records live at `scenarioReport.store.selectorDemonstrations` in the evidence ledgers.

This pipeline preserves the simple algebraic meaning while making it operationally safe. `M_v` is still the set of pages for which the selector is true. The machinery ensures that the function can only observe approved properties of pages in `P_T`, within bounded authoring workflows.

One subtle point follows: selector complexity does not imply precedence. A selector with five clauses may produce a smaller mask than one with one clause, but that fact does not grant it a higher `π_v`. The UI may warn or suggest; only explicit priority enters resolution.

**Digest prompt:** In `brand = 'mcdonalds'`, classify the pieces. `brand` must come from the template allowlist. `'mcdonalds'` becomes a parameter. The owning template is injected by the service. Nothing the author typed can introduce a table name or second statement.

## 3.3 — Reject Ambiguity, Then Fold the Layers

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** You can state the conflict predicate, execute the low-to-high placement fold, and explain why content provenance and order provenance are separate.

Once selectors have produced `L_T(p)`, the resolver must turn the default and matching operations into one document. The crucial order is: **detect ambiguity first, then fold**. If the input does not define one answer, the system must not manufacture one through iteration order.

For a variant `v` and placement key `k`, write:

$$
\operatorname{touch}(v,k)=
\begin{cases}
1 & \text{if } O_v \text{ contains any operation on } k\\
0 & \text{otherwise}
\end{cases}
$$

Two matching variants conflict for page `p` when they have the same priority and both touch the same placement:

$$
\exists v\neq w,\ k:\quad
v,w\in L_T(p)
\land \pi_v=\pi_w
\land \operatorname{touch}(v,k)=1
\land \operatorname{touch}(w,k)=1
$$

The implementation treats any cross-variant operation kinds on that priority/placement as ambiguous. Two variants at equal priority may still compose if their touched placement sets are disjoint.

Why reject before applying? Suppose two variants at priority 30 both set `primary-hero`. Sorting by variant ID would yield repeatable output, but the identifier would have become a hidden business rule. Sorting by creation time would make deployment timing choose content. Letting SQL row order decide would be worse: the result could change with a plan. Determinism means the authored inputs define one answer, not merely that the implementation happens to repeat an accidental answer.

After conflict validation, initialize one state record for every default placement. For each key `k`, the state contains:

$$
\operatorname{State}(k)=
(\text{block},\ \text{order},\ \text{visible},\ \text{content source},\ \text{order source},\ \text{trace})
$$

Then sort matching variants by ascending explicit priority and apply their canonically sorted operations.

**Set.** `set(k, b)` assigns block version `b`, makes the placement visible, clears any hidden-lower snapshot, records the variant as content source, and appends a trace step. A set may replace an existing placement or introduce a new one.

**Tombstone.** `tombstone(k)` records the currently visible lower placement as hidden when one exists, marks the placement absent, records the variant as content source, and appends a trace step. It does not delete the lower version.

**Order.** `order(k, n)` changes only the order and its provenance. It requires a visible target. Ordering an absent placement fails instead of creating a half-defined document.

Content and order provenance remain separate because they may have different winners. A default can supply the block while a variant moves it. Reporting only “the winning variant” would erase that distinction.

When the fold is complete, remove invisible placements from the effective list, retain their tombstone traces separately, and sort visible placements by:

$$
(\text{order},\ \text{placement key})
$$

The placement key is the stable secondary order, so equal order values do not reintroduce row-order dependence. Tombstones are sorted by placement key. The canonical resolved value includes block identity, type, schema version, content, order, matched revisions, and provenance.

This algorithm lives in `packages/cms-domain/src/resolution.ts`, particularly `detectVariantConflicts` and `resolveDocument`. Section 6 of `docs/process-engineering-guide.md` provides the normative step sequence. The resolution tests cover permutation stability, sparse overlap, conflicts, copy-on-write, tombstones, revert, ordering, and structural replacement.

> **Requirement — failure is a valid deterministic outcome.** If the conflict predicate is true, publication fails and the prior current publication stays active. “No document” is safer than an undocumented winner.

> **Requirement — hide and revert are opposites.** A tombstone is an explicit higher-layer absence; revert removes the local decision in a new revision so the lower winner reappears.

> **Measured finding — generated order independence.** The bounded evidence runs deterministic generated cases and input permutations, requiring byte-stable hashes, unique visible placement keys, absent tombstones, and one content plus one order source per winner. See `scenarioReport.generatedDeterminism` in `docs/evidence/bounded-report.json`.

The fold is “CSS for content” only up to a point. Like CSS, several selectors can contribute to one computed result. Unlike CSS, selector specificity never resolves a tie, and publication refuses an ambiguous same-priority placement rather than relying on a cascade rule the author did not choose.

**Digest prompt:** A priority-20 variant orders `primary-hero`; another priority-20 variant sets `primary-hero`. Do they compose? No. They are different operation kinds, but both touch the same priority/placement group. Give one an explicit different priority or combine the intended decisions in one authored layer.

## 3.4 — Canonicalize, Materialize, and Activate

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can describe publication as a deterministic projection from layered authoring state to immutable page results, including manifest sharing, interpolation, idempotency, atomic activation, and selector-free serving.

Resolution gives us one effective document for one page. Publication applies that result across the eligible page set and turns it into a durable serving namespace.

```text
selector-driven authoring → atomic immutable publication → read-only public serve → synchronous block registry
```

Let `R_T(p)` be the resolved, provenance-rich document produced by the fold. Canonical encoding removes incidental input ordering, and hashing gives the document a stable content identity:

$$
h_p = H(\operatorname{canonical}(R_T(p)))
$$

The hash is not a substitute for the document; it is a compact identity for verifying that the same logical result produced the same bytes.

Auteur also derives a structural manifest signature. A manifest contains ordered placement keys, winning block-version pointers, and exact source provenance. Page-specific context does not force a new structural manifest when those pointers remain the same. Define:

$$
\mu(p)=H(\operatorname{canonical}(\text{structural placements of }R_T(p)))
$$

Two pages may share a manifest when:

$$
p \sim q \iff \mu(p)=\mu(q)
$$

This is an equivalence relation over publication structure. It does **not** claim that the fully rendered page values are identical. A shared hero block can contain restricted interpolation such as a store name. The compiler evaluates that expression against each page's immutable context, so two pages can share `μ` while retaining different `h_p` and rendered output.

The publication protocol now has a clear sequence:

1. Snapshot template, route, selector, variant, block, tag, and page-input revisions.
2. Evaluate active selectors on the approved surface.
3. Detect same-priority/same-placement conflicts.
4. Resolve every eligible page and retain full provenance.
5. Validate block schemas and interpolation dependencies.
6. Canonicalize documents and identify reusable manifests.
7. Write the immutable publication, manifests, items, and page documents.
8. Audit counts, hashes, routes, and reads.
9. Atomically advance the template's current-publication pointer.

Section 5.9 and the publication flow in section 6 of `docs/process-engineering-guide.md` state this process. The pure manifest compiler lives in `packages/cms-domain/src/publication.ts`; the transactional implementation lives in `packages/cms-service/src/cms-service.ts`.

Publication itself has an input identity. Conceptually:

$$
I_T = H(\operatorname{canonical}(\text{active revisions and page inputs}))
$$

If `I_T` equals the current publication's input hash, an idempotent publish reuses the current result rather than appending duplicate page rows. It still compiles enough to verify the identity and reproduce measured logical payload bytes.

Activation is intentionally tiny compared with compilation. Let `C(T)` be the current-publication pointer. A successful publish changes:

$$
C(T) \leftarrow \Pi_n
$$

where `Π_n` is the newly validated immutable namespace. A failed compile leaves `C(T)` unchanged. Rollback assigns `C(T)` to a retained earlier `Π_{n-1}`; it does not edit either publication.

Public serving can now be written as a lookup rather than a resolution:

$$
\operatorname{Serve}_T(u)=\Pi_{C(T)}[u]
$$

The request follows the pointer, finds the page document for canonical URL `u`, and either returns its expanded payload or reconstructs it from its manifest plus immutable context. In the standalone app, the concrete pipeline is `read-only SQLite → CmsService.serve → PublishedDocumentSchema → synchronous block registry → React`. It performs one expanded read or two manifest reads and zero selector statements or AST evaluations. Manifest reconstruction calls `interpolateJson` against the stored immutable context; it does not consult authoring slots, tags, variants, or operations.

That sequence is intentionally ordered. The registry never receives authoring rows, and it never decides precedence. It renders only the already-ordered placement array and keys each component by stable `placementKey`. The schema never “fixes up” gaps or duplicates; it rejects them. A public route cannot choose draft resolution with a query parameter. The separate `/cms-preview_/*` lane may run the draft resolver, but its no-store/noindex response and visible preview chrome prevent it from masquerading as the current publication.

> **Requirement — publication is atomic and rollbackable.** Partial output never becomes current, and the previous immutable result remains addressable.

> **Current implementation — manifest and expanded modes.** `CmsService.publish` accepts either materialization mode. `serveWithEvidence` reads an expanded document in one statement or reconstructs a manifest-backed document in two, validates the result, and reports zero selector SQL executions.

> **Measured finding — shared structure is not total storage.** The Store evidence records logical expanded rendered bytes, a manifest-mode page-row estimate, and actual SQLite allocation delta separately. The standalone website additionally proves that both materialization shapes enter one strict publication contract and the same renderer registry. The benchmark explicitly avoids claiming an end-to-end database saving merely because structural manifests deduplicate.

> **Current boundary — synchronous full-template publication.** The checked-in publisher compiles every non-archived page inside one SQLite transaction and changes the active pointer only after the full result validates.

The algebra now spans the whole system: a map `T`, points `P_T`, masks `M_v`, ordered sparse layers `L_T(p)`, a conflict-checked fold `R_T(p)`, structural equivalence `μ`, immutable publication `Π_n`, and active pointer `C(T)`. The next chapters can examine scenarios and UI workflows without introducing a second mental model.

**Digest prompt:** Explain how two McDonald's pages can satisfy `μ(p) = μ(q)` while `h_p ≠ h_q`. They share the same structural block-version pointers and provenance, but deterministic interpolation uses different immutable page context.
