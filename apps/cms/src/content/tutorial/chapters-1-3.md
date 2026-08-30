# Chapter 1 — Why the Architecture Changes

## 1.1 — The Old Request Path: Route, Resolve, Render

> **Estimated time:** Read 5 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can reconstruct the legacy request path, name the responsibility of each service, and explain why a successful page request did not come from one coherent content model.

Before learning Auteur, it helps to understand the system it is meant to change. The older architecture solved a real problem: Uber-operated sites contain many concrete URLs, while authors need reusable page structures and reusable blocks. The system divided that work across specialized services instead of treating a page as one relational object.

A **template** played two roles at once. It was a URL grammar—something like `/{locale}/store/{store_id}`—and a page blueprint containing an ordered list of block references. Supplying values produced a concrete route such as `/en-US/store/1234`. That distinction is important: the template described the family, while the evaluated route described one member of the family.

The historical request path can be read as three verbs:

```text
route → resolve → render
```

**Route.** Camo Press determined whether the concrete URL existed. Its route data carried a stable identity and lifecycle state. A `live` route was eligible to return content. A `not_live` route still existed in the system but intentionally returned `404`. An `archived` route represented a guarded soft deletion rather than a casual on/off switch. In other words, Camo Press did more than parse a path: it was the authority for whether the path should be served.

**Resolve.** The route row supplied the ordered block identifiers associated with the page. A separate content service, Louvre, received those identifiers through a `multiResolve` call and returned block content. Route storage knew which blocks were needed; block storage knew what those blocks contained. The two stores were useful in their own domains, but neither alone represented the final page.

**Render.** A rendering service folded the template structure together with Louvre's resolved content and produced the response. The effective document therefore emerged during a request from coordination among route data, block references, content resolution, and template code.

The repository's current process guide describes the replacement boundary explicitly: Camo Press remains the route authority during transition, while Auteur owns content resolution and removes Louvre's `multiResolve` from the new content path. See `docs/process-engineering-guide.md`, especially sections 1 and 8. The deliberate removal of Louvre-style block resolution and the prior document/route storage model is also recorded in `docs/import-provenance.md` under “Replaced intentionally.” The more detailed legacy walk-through comes from the design-origin conversation summary; where it and the checked-in guide differ, the checked-in guide is authoritative.

This older division was not irrational. It made route lifecycle a separate concern, allowed blocks to be reused, and kept each service's storage model relatively constrained. It also created a conceptual cost: there was no single persisted record you could point to and say, “This is the exact document served for this URL under this version of the authoring state.” The final answer was assembled across boundaries.

That cost becomes visible when you ask ordinary operational questions:

- Which source won for the hero on this URL?
- If an inherited block changes, exactly which pages change?
- Can two different override paths produce competing answers?
- Which route revision and content revision were combined?
- Can the currently served result be rolled back as one immutable unit?

The legacy path could often answer these questions indirectly, but not through one uniform relational trace. That is the design pressure behind Auteur.

> **Requirement — route truth remains explicit.** The new content model is not allowed to pretend that route existence and content selection are the same concern. During transition, Camo Press still decides the lifecycle outcome.

The first lesson is therefore not “the old system was bad.” It is that its boundaries optimized for a different model. Camo Press routed, Louvre resolved blocks, and the renderer assembled the page. Auteur begins by making the content side relational, inspectable, deterministic, and publishable as one artifact—without silently taking ownership of route policy on day one.

**Digest prompt:** Given `/en-US/store/1234`, say aloud which system answers “Does it exist?”, which system historically answered “What do these block IDs contain?”, and where the final page was assembled. If those three answers are distinct, you have the starting architecture in view.

## 1.2 — Why Route-Tree Inheritance Became a Design Trap

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can separate URL hierarchy from content precedence and explain why a tree that is convenient for a few dimensions becomes difficult to inspect and extend.

The older authoring model organized content overrides hierarchically. Content placed near the root flowed downward; an author could navigate to a branch such as a country and language combination and override a block there. This matched a familiar picture: a page inherited from its ancestors unless a closer node supplied a replacement.

For a small, stable set of dimensions, that picture is attractive. The path itself provides an ordering. “More specific” often means “deeper.” A root value can cover many pages, and a branch can narrow the effect without repeating the whole document. The trouble begins when the business dimensions are not actually one tree.

Consider a Store page. It may have a locale and store ID in its URL, but the content team may also care whether the store is a chain, whether it serves fast food, and which brand it belongs to. Those classifications do not form a single parent-child path:

```text
locale = en-US
store_type = chain_store
category = fast_food
brand = mcdonalds
```

McDonald's is simultaneously a chain, fast food, and a named brand. Making one property the parent of another smuggles a business taxonomy into the route tree. Choosing a different order changes what “inherits from above” means. Worse, the URL may not contain these classifications at all.

Tree inheritance then creates four kinds of friction.

**Origin becomes a navigation problem.** An author sees a hero but may have to climb an unfamiliar hierarchy to discover where it came from. The visible page does not, by itself, explain the winning source.

**The available segmentation is fixed by the tree.** Country and language fit naturally if those are the predefined branches. A later requirement for state, purpose, store type, or an imported tag either distorts the hierarchy or requires a parallel mechanism.

**Impact becomes hard to communicate.** Changing a parent affects descendants, but the set of affected concrete URLs may be irregular. Authors need a match count and representative pages, not merely a statement that “everything below this node inherits it.”

**Precedence becomes accidental.** The tree supplies an implicit notion of specificity. Once cross-cutting rules arrive, it is tempting to break ties using depth, creation time, row order, or selector complexity. Those are implementation details, not an author-approved correctness rule.

Auteur makes a sharp correction: a URL path is still represented by ordered slots, but parent/child path position does **not** determine content precedence. `docs/data-model.md` states this in its opening boundary: there is no route-tree content inheritance. Inheritance comes from one template-owned default plus matching selector variants with explicit integer priority. The same distinction anchors sections 1 and 2 of `docs/process-engineering-guide.md`.

This gives us a clean separation:

| Concern | What determines it? |
| --- | --- |
| Canonical URL shape | The template's ordered path slots |
| Concrete route identity | The page instance and Camo identity |
| Whether the route is served | Camo lifecycle state |
| Which content layers match | Selectors over slots and tags |
| Which matching layer wins | Explicit priority and placement-level conflict rules |

Notice what this table does not say. It does not say the deepest route wins. It does not say the selector with the most clauses wins. It does not say the newest row wins.

> **Requirement — precedence is authored, not inferred.** Same-priority variants may compose when they touch different placements. If they touch the same placement for the same page, publication fails. Creation timestamps, row identifiers, SQL return order, and selector “specificity” never choose a winner.

The new model retains the useful part of inheritance: authors do not clone a whole document for every variation. But it replaces the tree with sparse, independently selectable layers. A chain-store layer can own the footer. A fast-food layer can own the promo. A McDonald's layer can own the hero. One page can receive all three because the rules describe intersecting sets rather than ancestry.

The shift is subtle but profound. In the tree model, an author asks, “Where in the hierarchy should this override live?” In the selector model, the author asks two more direct questions: “Which pages should this layer match?” and “Which placements does it intentionally change?” The first becomes a previewable query; the second becomes a small list of operations.

This is why the route tree is a design trap rather than merely an outdated data structure. Routing remains hierarchical where the URL grammar requires it. Content inheritance no longer borrows that hierarchy as an implicit policy engine.

**Digest prompt:** Imagine adding `has_drive_through = true`. If your first instinct is to decide where “drive through” belongs in a country/language/store tree, pause. In Auteur it is a selectable dimension, and its content effect is an explicit sparse layer.

## 1.3 — A Transition Architecture, Not a Big-Bang Rewrite

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can draw the transitional Camo-to-Auteur request path, distinguish authoring, preview, and public delivery, and identify the revision seam that prevents route state and published content from becoming an untraceable mixture.

Auteur is designed to grow into a larger role, but the prototype deliberately avoids a big-bang migration. The cleanest architecture is not always the safest migration plan. Route existence, route lifecycle, content authoring, publication, and rendering move on different timelines and carry different operational risks.

The transitional public request path is:

```text
public URL
  → Camo Press: route identity, canonical path, lifecycle status, route revision
  → Auteur website: current immutable publication for that page
  → PublishedDocumentSchema: validate the persisted boundary
  → synchronous block registry: deterministic React output
```

Camo Press remains intact. It answers whether the URL exists and whether policy allows a `200` or requires a `404`. Auteur begins owning the relational content model: templates, slots, tags, variants, blocks, effective-document resolution, publications, manifests, and provenance. Louvre is removed from the new content path because Auteur's publication already identifies the exact winning block versions.

The sequence diagram in section 8 of `docs/process-engineering-guide.md` is the canonical picture. For a `not_live` or `archived` route, Camo returns the policy result. For a live route, it passes stable route information to Auteur. `apps/website` opens SQLite read-only, calls `CmsService.serve`, validates the materialized document, and dispatches each placement through the synchronous registry. Manifest mode uses two fixed reads and expanded mode uses one; both execute zero selector statements and never call Louvre `multiResolve`.

The local application topology makes the separation executable. `apps/cms` runs on `http://localhost:3000` and owns authoring, selector inspection, publication controls, and rollback. `apps/website` runs on `http://localhost:3001` and owns reader-facing rendering. A normal canonical route in the website app is always published and non-editable. Even `?edit_mode=true` cannot elevate that route: the public catch-all discards search input and still reads the active publication.

Draft preview has a different, explicit namespace. `/cms-preview_/<canonical-path>` resolves current authoring state and renders it through the same block components, with visible “Unpublished authoring preview” chrome, authoring provenance, `Cache-Control: private, no-store`, and `X-Robots-Tag: noindex, nofollow, noarchive`. `/admin` is a third boundary: it validates the server-only `CMS_ADMIN_ORIGIN` and offers a handoff link to the separate CMS. It is not an iframe, an authentication endpoint, or a blind open redirect. Keeping these routes distinct is how the prototype proves that a convenient query parameter cannot leak draft state onto the public path.

The handoff needs more than a URL string. At minimum it carries:

- a stable external route or page identity;
- the normalized canonical URL;
- lifecycle state;
- a route revision or equivalent source revision.

That final item creates the **revision seam**. A publication records the route input revision it compiled. If Camo later reports a newer or incompatible revision, the system must follow an explicit stale-content policy. It must not silently combine yesterday's content publication with today's route facts and present the result as if it were one traceable version.

The database model supports this seam. `route_ingestions` records one source import attempt and its immutable `source_observed_at`. `page_instances` carries stable identity, canonical path, status, context, and the last ingestion. `route_audit_log` records insert, update, transition, skip, and error actions. These are tables 3, 4, and 8 in `docs/data-model.md`. Their purpose is not merely record keeping: together they let an investigator say which external state Auteur observed and how it transformed that state.

Canonical identity also becomes explicit. One normalized `domain + canonical path` belongs to one page and one template. The stored `canonical_url` is an absolute path; the domain comes from the template. The same path may exist on a different domain, but the same domain/path pair may not have competing owners. This prevents the content system from compiling two equally plausible documents for one public URL.

> **Requirement — one URL, one answer.** One canonical domain/path maps to exactly one template and one page instance, and an active publication maps that page to one immutable effective document.

> **Prototype choice — local route adapter and isolated preview.** The prototype models Camo ingestion and lifecycle through deterministic local inputs and service integration tests. The explicit preview route is enabled for local development and can be deliberately enabled for a controlled proof environment; it is not a production authentication design. `docs/benchmarks.md` lists those boundaries among the known limitations.

> **Open decision — stale-route policy.** Production still needs a policy for Camo revision drift, including what happens when route state changes during a long publication build and whether `not_live` pages are precompiled, retained, or omitted. The unresolved decision appears in section 9 of the process guide and in the TiDB proof spikes in `docs/adr/0001-tidb-materialization.md`.

This staged ownership is a feature. Auteur can replace the content-resolution half while leaving route authority untouched. Later, a different adapter—or an Auteur-owned route subsystem—can implement the same contract. The relational content and publication invariants do not depend on pretending that takeover has already happened, and the preview convenience does not weaken the published request contract.

The transition also clarifies failure domains. An authoring edit does not mutate the current publication. A route ingestion does not automatically rewrite the served document. A failed publication does not advance the current pointer. A rollback repoints Auteur to a retained publication without rewriting Camo state. Each boundary has an owner and an observable revision.

**Digest prompt:** Draw Camo, `apps/cms`, and `apps/website`. Put route identity/status/revision in Camo; put variants, blocks, and publication controls in the CMS; put read-only publication lookup and the registry in the website. Add the explicit preview and admin lanes. If a selector or `edit_mode` query reaches the public request arrow, you have crossed the boundary incorrectly.

## 1.4 — The Prototype as an Evidence Instrument

> **Estimated time:** Read 5 min · Media 0 min · Digest 2 min
> **Learning outcome:** You can classify a statement as a requirement, prototype choice, measured finding, or open decision—and avoid promoting local implementation details into production architecture by accident.

The Auteur repository is an executable architecture prototype. Its primary job is to make a model concrete enough that engineers, authors, and product partners can inspect it, break it, measure it, and argue about the remaining decisions using the same vocabulary. It is not a disguised attempt to ship the full production CMS from a laptop database.

The process guide opens with four labels. They are the reading discipline for the rest of this tutorial.

> **Requirement** — a product invariant that carries forward. Examples include one canonical URL mapping to one effective document, explicit priority, immutable published block versions, selector-free public serving, and atomic publication activation.

> **Prototype choice** — a current implementation selected to prove the model. Bun, local SQLite through `bun:sqlite`, Drizzle migrations, a full-template compiler, and a wireframe TanStack HUD belong here. A production system may implement the same requirement differently.

> **Measured finding** — a result reproduced by an evidence command under a recorded environment. Counts, hashes, query plans, timings, memory, and allocated bytes live in evidence envelopes. A measured local result is not automatically a service-level objective.

> **Open decision** — a production question the prototype exposes but does not settle. TiDB chunk size, cache topology, incremental invalidation, `not_live` materialization, tag ownership policy, and expanded-versus-manifest serving are examples.

This classification prevents a common architecture failure: treating whatever the prototype happens to do as the only acceptable production design. It also prevents the opposite failure: dismissing executable results as “just a prototype” when they demonstrate a genuine invariant.

The application shell has its own provenance. `README.md` and `docs/import-provenance.md` record that Median pull request 15 donated the Bun/Turborepo structure, TanStack Start catch-all routing and server-function boundary, synchronous block-registry pattern, React/TypeScript conventions, and compact administrative visual language. [Profound's hybrid admin-panel proxy guide](https://cms.docs.tryprofound.com/hybrid/setup-admin-panel-proxy) supplied a second useful topology clue: keep the normal route published while reserving explicit `/cms-preview_/*` and admin surfaces for editorial traffic. Auteur adapts those interface ideas to its relational compiler; it does not copy their storage or trust assumptions.

Median did **not** donate the Auteur domain. PostgreSQL/Supabase integration, authentication, deployment surfaces, route-binding inheritance, existing document storage, and Louvre-style resolution were intentionally removed. The prototype also does not pretend to have Profound's framework-specific API/auth proxy: `/admin` is only a validated handoff to `CMS_ADMIN_ORIGIN`, and `/cms-preview_/*` calls Auteur's local draft resolver. The public catch-all never rewrites to preview because `edit_mode` appears in its query string.

That distinction matters when reading the UI. A familiar sidebar or table may have Median ancestry, but the wall of maps, layer stack, vertical provenance pin, selector overlays, and publication trace express the new model. Appearance is not authority; the domain contracts and evidence are.

The stack is intentionally small:

- Bun workspaces and Turborepo coordinate the repository.
- `apps/cms` on port `3000` provides the TanStack authoring HUD; `apps/website` on port `3001` provides the standalone TanStack renderer.
- TanStack Start, Router, Query, and Table provide the application boundaries.
- React and TypeScript implement the HUD.
- SQLite, isolated behind `@repo/cms-db`, makes the relational model locally executable.
- Drizzle definitions and committed SQL migrations own schema change.
- `@repo/cms-domain`, `@repo/cms-service`, and `@repo/cms-scenarios` separate pure rules, transactions, and proofs.

Browser modules never import the database client. Mutations cross a validated TanStack server function and delegate to the same `CmsService` used by integration and scenario proofs. This is both a boundary test and a teaching aid: the HUD does not need a separate, friendlier interpretation of the model.

Evidence is similarly layered. `docs/evidence/bounded-report.json` contains a fast development-scale proof. `docs/evidence/store-1m.json` contains the explicit million-row Store run. Each envelope records its command, Git commit and dirty state, lockfile digest, runtime and SQLite versions, host resources, timings, raw counts, and scenario results. `docs/benchmarks.md` interprets those ledgers without copying host-dependent numbers into architectural promises.

> **Measured finding — evidence is reproducible, not anonymous.** A number without its source commit, invocation, database shape, and host context is not accepted as benchmark evidence.

The repository's five-phase gate reinforces the same idea. A buildable UI is not enough. The shell, schema, domain engine, authoring workflows, scenarios, evidence, documentation, and cross-workspace checks must agree. `README.md` lists those phases. AUT-534 adds the standalone website publication proof, AUT-535 adds isolated preview and admin routes, and AUT-536 keeps this tutorial aligned with the executable result; the earlier issues remain the foundation those proofs exercise.

As you continue, keep asking one question: **What kind of claim is this?** If it is a requirement, look for an invariant and a test. If it is a prototype choice, look for the boundary that permits replacement. If it is a measured finding, look for the evidence path. If it is open, do not let polished UI or confident prose make it sound decided.

**Digest prompt:** Classify “public serving executes zero selector statements” and “production should use exactly two SQL statements.” The first is a requirement in spirit and is measured in the prototype. The second is not a requirement; two statements are the current manifest-mode shape, while an expanded shape uses one.

# Chapter 2 — The Relational Grammar

## 2.1 — Maps, Points, and Dimensions

> **Estimated time:** Read 6 min · Media 1 min · Digest 2 min
> **Learning outcome:** You can translate the wall-of-maps metaphor into templates, page instances, slots, tags, defaults, and variants without treating the metaphor as the data model itself.

Auteur's most memorable picture is a **wall of maps**. Each map represents one URL template. A concrete URL is a point on that map. Transparent sheets cover selected regions, and a vertical pin through one point reveals every sheet that contributes to the final page.

The picture is useful because it corrects two misconceptions at once. First, there is not one global default floating above every page in the company. Each template owns an isolated map and its own default. Second, pages are not forced into a single route tree. They are points described by several dimensions, some visible in the path and some supplied independently.

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

> **Prototype choice — normalized dimensions.** SQLite stores scalar values in `page_slot_values` and memberships in `page_tags`. Production TiDB may use generated columns or wider read surfaces for hot dimensions, but it must preserve ownership, semantics, and selector safety.

The wall-of-maps metaphor is therefore a gateway, not a substitute for precision. It helps you see separate content spaces, high-dimensional page points, and sparse layers. The tables provide the enforceable grammar underneath.

**Digest prompt:** For `/en-US/store/1001`, identify the map, the point, two scalar coordinates, and three independent classifications. Then ask which of those facts actually determine content precedence. The answer is: none by themselves. Matching variants and explicit priority do that work.

## 2.2 — Route Inputs, Lifecycle, and Explicit Classification

> **Estimated time:** Read 6 min · Media 0 min · Digest 2 min
> **Learning outcome:** You can follow one route import from observed source revision to page, slot, tag, and audit rows, and explain why replay and archived-state rules belong to the content contract.

A map is useful only if its points have trustworthy identities and coordinates. Auteur therefore treats route ingestion as a first-class process rather than allowing unrelated code to insert page-shaped rows whenever convenient.

The sequence begins with `route_ingestions`. One row represents one attempt to import a Camo Press or seed revision for one template. Its key includes the template, source, and source revision, which gives the import an idempotency identity. The row also records `source_observed_at`: when the external state was actually observed. That timestamp is immutable because changing it later would rewrite the meaning of the import.

The ingestion moves through a controlled lifecycle. It begins as `running` and closes as `succeeded` or `failed`, with completion shape and row counts checked. Replaying the same source revision with the same input reuses the logical result rather than duplicating pages or memberships. Reusing the revision identifier with different input is an error, because it would make one external revision mean two things.

For each route, `page_instances` stores the stable content-side identity. Important fields include:

- the owning template;
- the normalized absolute canonical path;
- the external Camo route identity;
- lifecycle status;
- route revision;
- immutable-at-publication context;
- hashes representing slot values and context;
- the last ingestion responsible for the current input.

Several uniqueness rules protect the “one URL, one answer” invariant. External route identity is unique. Canonical URL is unique within a template. Domain-plus-path ownership is unique across templates sharing a domain. Slot-value identity is also constrained within its template. `docs/data-model.md`, table 4, lists the exact prototype constraints; migration `packages/cms-db/drizzle/0003_domain_path_canonical_identity.sql` adds the domain/path boundary.

Slots are normalized through `template_slots` and `page_slot_values`. The template declares which dimensions exist, their order in the path when applicable, and whether they are static, variable, or derived. Each page-value row points to both a page and a declared slot inside the same template. The selector index orders by template, slot, normalized value, and page identity, allowing a safe selector compiler to find matching points without author-controlled table names.

Tags use two more tables. `tags` defines a namespace/value pair inside one template, along with label, description, source, and optional parent metadata. `page_tags` records an explicit page-to-tag membership and its assignment source. This separates the meaning of a tag from the fact that one page carries it.

That source matters. A classification may come from a pipeline, an author, or deterministic seed data. The prototype preserves the distinction rather than flattening all memberships into unexplained strings. Production still needs a conflict and freshness policy for imported versus authored classifications; that is an open decision, not something the local seed settles.

Lifecycle changes receive their own immutable evidence in `route_audit_log`. Insert, update, status transition, skip, and error actions can be traced back to the ingestion and page. Update/delete triggers protect the audit rows. The log turns “Why is this route archived?” from guesswork into a question with a recorded source action.

`archived` deserves special attention. It is not merely another display filter. The service rejects casual reactivation because archive represents an intentional soft deletion. `not_live`, by contrast, describes a route that exists but currently returns `404`. The prototype verifies those public outcomes, while leaving the production policy for materializing `not_live` content explicit.

> **Requirement — route status is authoritative input.** Authoring state may exist for a page, but it cannot make Camo's `not_live` or `archived` route serve as live.

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

The process resembles a compiler more than a view. An ordinary database view would recompute joins and selectors when read. Auteur snapshots inputs, checks conflicts, resolves and validates documents, canonicalizes and hashes results, writes a sealed namespace, audits it, and then activates it. This application-owned materialization is the decision recorded in `docs/adr/0001-tidb-materialization.md`.

> **Requirement — atomic visibility.** A failed compile or write must leave the former current pointer active and must not expose partial rows as the live result.

> **Prototype choice — SQLite transaction.** The local service writes a publication transactionally in SQLite. The TiDB ADR proposes chunked hidden namespaces plus a short activation transaction rather than assuming a million-row single transaction is the production answer.

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

This notation separates three questions that route-tree inheritance tended to blend:

1. **Existence:** Is `p` in `P_T`, and what is its route state?
2. **Selection:** For which variants is `p ∈ M_v`?
3. **Resolution:** How do `D_T` and the selected `O_v` produce one document?

Read the symbols as a sentence rather than a proof. “Within template `T`, page `p` belongs to the concrete page set. Variant `v` covers `p` when its selector is true. Its priority tells us when to apply it, and its sparse operations tell us where it acts.” Nothing in that sentence depends on a database engine or a visual layout.

Section 2 of `docs/process-engineering-guide.md` supplies the spatial model, and section 3 supplies the canonical vocabulary. `packages/cms-domain/src/types.ts` supplies the executable shapes for defaults, layers, operations, placements, and resolved documents.

> **Requirement — closure inside one template.** Selectors, operations, block versions, pages, and publications cannot escape `T`. The composite database relationships are enforcement, not mere join convenience.

> **Prototype choice — explicit page set.** SQLite stores concrete page instances and normalized dimensions. A future production read surface may optimize their physical form, but it must preserve the same logical `P_T`, masks, and template boundary.

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

The request follows the pointer, finds the page document for canonical URL `u`, and either returns its expanded payload or reconstructs it from its manifest plus immutable context. In the standalone app, the concrete pipeline is `read-only SQLite → CmsService.serve → PublishedDocumentSchema → synchronous block registry → React`. It performs one expanded read or two manifest reads and zero selector statements. No `S_v`, `M_v`, slots, tags, variants, or operations are evaluated on this path.

That sequence is intentionally ordered. The registry never receives authoring rows, and it never decides precedence. It renders only the already-ordered placement array and keys each component by stable `placementKey`. The schema never “fixes up” gaps or duplicates; it rejects them. A public route cannot choose draft resolution with a query parameter. The separate `/cms-preview_/*` lane may run the draft resolver, but its no-store/noindex response and visible preview chrome prevent it from masquerading as the current publication.

> **Requirement — publication is atomic and rollbackable.** Partial output never becomes current, and the previous immutable result remains addressable.

> **Prototype choice — manifest and expanded modes.** The service can prove a manifest reconstruction path and an expanded-document path. Production must choose or combine them using measured bytes, latency, cache behavior, and TiDB constraints.

> **Measured finding — shared structure is not total storage.** The Store evidence records logical expanded rendered bytes, a manifest-mode page-row estimate, and actual SQLite allocation delta separately. The standalone website additionally proves that both materialization shapes enter one strict publication contract and the same renderer registry. The benchmark explicitly avoids claiming an end-to-end database saving merely because structural manifests deduplicate.

> **Open decision — production compilation shape.** SQLite proves the rules with a full-template transaction. The TiDB ADR proposes chunked hidden namespaces and compare-and-swap activation, and leaves incremental invalidation behind explicit proof spikes.

The algebra now spans the whole system: a map `T`, points `P_T`, masks `M_v`, ordered sparse layers `L_T(p)`, a conflict-checked fold `R_T(p)`, structural equivalence `μ`, immutable publication `Π_n`, and active pointer `C(T)`. The next chapters can examine scenarios and UI workflows without introducing a second mental model.

**Digest prompt:** Explain how two McDonald's pages can satisfy `μ(p) = μ(q)` while `h_p ≠ h_q`. They share the same structural block-version pointers and provenance, but deterministic interpolation uses different immutable page context.
