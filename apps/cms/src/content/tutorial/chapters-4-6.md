# Chapter 4 — Three executable proof shapes

*Dense → sparse → structural*

## 4.1 Dense Eligible Vehicles

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Explain why dense, intersecting variation is a correctness proof for deterministic precedence—not a manifest-deduplication success story—and trace one page from selector matches to an atomic publication.

Eligible Vehicles is the first place where the algebra becomes an executable product shape. Its canonical pattern is `/{locale}/eligible-vehicles/{state}/{slug}`. A page can be addressed by country, language, state, purpose, and an exact intersection, so several legitimate layers may match one URL. Think of the example `eligible:en-US:CA:premium`: it does not choose a single “most specific” branch. It collects matching template-scoped variants and folds their sparse operations in explicit priority order. The representative fixture contains 24 page instances and 17 active selector variants producing 100 total matches. Four exact-intersection variants each target one page. These are intentionally dense conditions: every published page ends with its own seven-placement structure.

The standalone proof route is `http://localhost:3001/en-US/eligible-vehicles/ca/premium`. After the repeatable compact seed, that URL reads active publication `editable-eligible-publication-2` and document hash `b09fe560f855262f394bb324722fb73c71f386a114882bda3bf2554516f5dfa1`. The reader-facing app does not reproduce the country/language/state/purpose fold: it receives the seven already-published placements and renders them synchronously by block type.

The scenario should be read as a precedence and provenance stress test. The country layer can establish broad copy; language can replace localized placements; state can add legal or regulatory content; purpose can change offer framing; and the exact intersection can override all seven placements. The implementation never derives precedence from a selector’s length, apparent specificity, row ID, or creation time. Only the authored integer priority participates. When two matched variants at priority `60` both write `legal-notice`, the compiler returns `PRIORITY_CONFLICT`. It does not pick whichever row SQLite happens to return first. The failed build creates no partial publication rows, and the prior current-publication pointer remains active. The executable evidence lives in `docs/evidence/bounded-report.json`; the human-readable interpretation is in `docs/benchmarks.md` under “Scenario A — dense Eligible Vehicles.”

> **Requirement** — Same-priority writes to the same placement fail publication. Every visible placement has exactly one content winner and one order winner, with enough provenance to explain both.

Successful compilation makes the density equally visible. The run writes 24 materialized page rows and 24 unique manifests. Across seven placements per document, that is 168 expanded placements and 168 stored placements. Canonical manifest structure occupies 22,024 bytes in either form. All 168 persisted items retain exact operation provenance. The persisted publication comprises 218 rows, has an estimated serialized size of 21,120 bytes, and adds 118,784 allocated database bytes. The exact-intersection page proves that every placement can be locally replaced without losing its source revision or priority.

Those numbers require disciplined interpretation. A content-addressed manifest is still useful because it gives the publication a stable, immutable structure and preserves per-placement lineage. Yet this shape has zero structural reuse: 24 pages produce 24 manifests. Saying “manifests saved space” here would be false. Dense variation is the counterweight to the Store scenario that follows; it prevents a storage strategy from being justified by a single favorable distribution.

> **Current implementation** — The Bun/SQLite compiler resolves the complete bounded template, canonicalizes each effective document, writes immutable publication rows, and swaps one current pointer inside the local service transaction.
>
> **Measured finding** — 24 pages, 17 active variants, 100 selector matches, four exact intersections, 24 unique manifests, 168/168 expanded/stored placements, and 22,024/22,024 canonical manifest bytes. A `legal-notice` conflict at priority `60` is rejected with no partial rows.
>
> **Current evidence boundary** — The dense fixture demonstrates correctness and zero manifest reuse for its exact inputs. It does not generalize that distribution to another template.

In the HUD, open the Eligible Vehicles map from the root Wall of Maps, then choose the two projection axes and filter the remaining dimensions. Selecting a point moves the resolution pin without changing the projection itself. In the right-hand pin, read the Trace from the default layer upward; then compare Selector SQL and Draft diff. The author-facing route is assembled by `apps/cms/src/routes/templates.$templateId.tsx`, while the three-column workspace behavior lives in `apps/cms/src/components/template-workspace.tsx`. The selector text shown in the HUD is an inspected compilation artifact, not SQL that will run during a public request.

For the one-minute media, show the five conceptual layers as labeled sheets—country, language, state, purpose, exact—then lower a vertical pin through `eligible:en-US:CA:premium`. Narrate the labels and winner changes; do not rely on color alone. End on the conflict state: two priority-60 arrows converge on `legal-notice`, publication stops, and the prior pointer remains labeled “current.” Captions should state that the exact intersection overrides every placement and that the result has no manifest reuse.

The serving side completes the proof. `page_instances.route_status` supplies the persisted lifecycle value. For a published `live` page, `CmsService.serve` reads the active immutable structure; for `not_live` or `archived`, it returns `404`. No country, language, state, purpose, or exact selector is evaluated in that request. The executable branch is `serveWithEvidence` in `packages/cms-service/src/cms-service.ts`.

> **Digest prompt:** If a fresh run produced only 23 manifests for these 24 pages, what current inputs, hashes, and placement winners would you inspect before accepting the result? Distinguish legitimate shared structure from accidental canonicalization, and name the placement-level provenance that must remain inspectable.

## 4.2 Sparse Stores at one million

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Interpret the Store proof at both development and million-page scale, including selector composition, structural reuse, interpolation, idempotency, and the limits of SQLite byte and latency evidence.

The Store map changes the distribution without changing the resolution rules. Its route pattern is `/{locale}/store/{store_id}`. Most pages inherit nearly everything, while a few tag-defined classes replace one placement each. A chain-store variant at priority `10` writes `footer`; a fast-food variant at `20` writes `category-promo`; disjoint McDonald’s and Burger King variants at `30` each write `primary-hero`. A McDonald’s page therefore composes three non-default layers. A Burger King page follows the same structure with another hero pointer, while an independent store stays on the default. No Store-specific resolver branch exists: the same selector compiler and fold used for Eligible Vehicles handle this sparse shape.

The standalone proof route is `http://localhost:3001/en-US/store/1001`. The compact seed retains `publication-store-1` as its rollback target and points the current Store snapshot at `publication-store-2`, with document hash `173f0c8b8cfaff9425c595896e3e1d9f4d39bb5b3f73a358582ba17198d6306d` for this page. The rendered hero contains the page-specific interpolated store context even when multiple Store pages reuse its structural manifest; the public registry sees only the final content and provenance, never tags or selector text.

The bounded fixture makes the five outcomes easy to inspect. It requests 1,000 scale pages and retains two foundation pages, for 1,002 documents. Those pages carry 4,008 scalar slot rows and 1,304 tag memberships. The four selectors match 501 chain stores, 201 fast-food stores, 50 Burger Kings, and 51 McDonald’s stores. Although the two brand layers share priority `30` and both target `primary-hero`, their match sets are disjoint. The overlap diagnostic still names the potential conflict surface: assigning both brand tags to one page causes conflict failure rather than an arbitrary winner.

Only five structural manifests are needed for the 1,002 bounded pages. Thus 997 pages reuse an existing manifest, a 99.50% deduplicated-page ratio. The structure contains 4,008 logical placements but just 20 stored manifest items. Canonical structure falls from 830,021 logical bytes to 4,214 stored bytes, removing 825,807 repeated bytes. Yet the fully expanded rendered documents occupy 1,142,964 logical bytes, the manifest-plus-page estimate is 858,229 bytes, and the actual SQLite publication allocation grows by 1,294,336 bytes, or 1,291.75 per document. Table pages, indexes, immutable page JSON, and context do not disappear when structure is shared.

> **Requirement** — Sparse selectors must compose when they write different placements, and same-priority selectors that ever overlap on one placement must conflict. Publication and serving must preserve the page’s exact structural and interpolation result.
>
> **Current implementation** — Structural manifest identity excludes page interpolation values. Per-page context supplies deterministic rendered text, so two McDonald’s pages can share a manifest while producing different hero text and document hashes.
>
> **Measured finding** — The bounded proof has 1,002 documents, five manifests, 997 reused pages, 4,008/20 logical/stored placements, and 830,021/4,214 canonical structure bytes. Its actual database delta is 1,294,336 bytes, so the prototype does not claim an end-to-end allocation saving at this scale.

The committed million-page envelope tests whether that relational shape remains executable rather than extrapolating the bounded ratios. `docs/evidence/store-1m.json` records the exact command, source commit and dirty state, lockfile digest, Bun and SQLite versions, host resources, elapsed time, memory, database size, counts, hashes, and scenario results. Read those fields directly when comparing runs; a copied number without its envelope is not evidence.

The run inserts 1,000,000 scale pages plus two foundation pages, with 4,000,008 slot rows and 1,300,004 tag memberships. Its five classes include 500,001 chain and 500,001 independent pages, 200,001 fast-food pages, 100,000 generic fast-food pages, 50,001 McDonald’s pages, 50,000 Burger Kings, and 300,000 chain/non-fast-food pages. The seed takes 69,115.674 ms. Replaying it takes 188.719 ms, inserts zero pages, and preserves identity and counts. Schema version 6 passes integrity with zero foreign-key violations.

Publishing all 1,000,002 pages takes 594,347.476 ms, or 1,682.52 documents per second locally. An identical republish takes 262,674.584 ms, retains the publication and input hash, and adds no page rows. Five manifests serve every page; 999,997 pages reuse a structure. That is a 99.999500001% deduplication ratio, with 4,000,008 logical placements represented by 20 stored items. Canonical structure is 828,401,621 logical bytes versus 4,214 stored bytes, a difference of 828,397,407. Fully expanded rendered documents total 1,143,681,174 bytes, while the manifest-plus-page estimate is 862,480,639. SQLite nevertheless allocates 1,310,748,672 publication bytes and ends at 3,205,939,200 bytes—2.986 GiB.

The read measurements describe the recorded local, hot-cache run. Manifest reconstruction uses two fixed SQL statements and zero selectors; the expanded fixture uses one statement and zero selectors. Consult the current envelope for its p50/p95 values and `docs/benchmarks.md` for their interpretation instead of memorizing host-specific timings.

> **Current evidence boundary** — Logical structural reuse, SQLite file allocation, and local read timing are different measurements. The report preserves all three so the tutorial does not substitute one favorable ratio for another.

In the HUD, select a McDonald’s point and inspect how three sparse layers contribute three different placements while `navigation` remains inherited. Then select another McDonald’s point: the manifest stays shared, but interpolated hero text and the document hash change. The one-minute media should narrate those stable and changing fields explicitly, then zoom out from 1,002 to 1,000,002 pages without implying that tile area represents cardinality. The authoring controls used later are implemented in `apps/cms/src/components/sqlite-authoring-workbench.tsx`; the generic scenario and evidence path is documented by `docs/benchmarks.md`.

> **Digest prompt:** Write one sentence for each of these claims: “structural reuse is real,” “physical database savings are not equal to the logical ratio,” and “the timings are not an SLO.” Include at least one exact measured value in each sentence.

## 4.3 Structural type replacement

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Demonstrate that placement identity survives a block-type change, distinguish replacement from hiding and reverting, and verify sparse inheritance and rollback with hashes and provenance.

The third proof changes the kind of mutation. Eligible Vehicles stressed dense intersections; Stores stressed sparse classification at scale. Structural replacement asks whether a variant can change the schema and renderer at one conceptual document position without cloning the rest of the document or corrupting history. The stable placement is `primary-hero`. The default points it to a block version of type `hero`; the matched variant points the same placement to a new immutable version of type `hero_alt`. The placement key—not the array index, lineage name, or type—is the address that resolution preserves.

The standalone proof route is `http://localhost:3001/en-US/airport/hero-alt`. Its compact-seed publication is `editable-structural-publication-2`, and its document hash is `8acac69732ee309e319332a5d65a0a5a3c7f5cacdc23e0c26c15baa9420592a2`. The synchronous registry receives the same `primary-hero` key but selects the `hero_alt` renderer from the published block type. This is the browser-visible proof that placement identity and renderer type are independent.

This distinction allows the editor and compiler to tell a coherent story. A content edit within the same type creates another immutable version in the appropriate lineage. A type replacement validates a new payload against the new block-type schema and creates a version whose renderer contract is `hero_alt`. The old `hero` payload is not silently accepted by `hero_alt`; the schemas are deliberately different, and the replacement proof rejects the incompatible content. Published block versions remain untouched. The variant contributes a sparse `set` operation at `primary-hero`, and every unrelated placement continues to point to its lower-layer winner.

The same variant also demonstrates absence. It adds a tombstone for `announcement-promo`. Resolution records the lower placement in the trace but omits it from the effective document. A tombstone is a local decision: “keep this inherited placement hidden here.” It is not the same as reverting. Reverting the hero removes the variant’s local hero operation in a new revision, which reveals the default `hero` again; the promo tombstone remains because that separate local decision still exists. The prototype therefore supports three distinct editorial acts—replace, hide, and revert—without deleting immutable history.

> **Requirement** — Stable placement keys survive reordering, content versions, and block-type replacement. Hiding creates a tombstone; reverting removes the local decision and restores inheritance. Published versions and prior revisions are immutable.

The measured scenario begins with 24 default placements and resolves to 23 visible placements. Two sparse operations affect the matched page: the hero replacement and promo tombstone. Twenty-two block pointers remain unchanged, yielding `22/24`, or 91.67%, inheritance. The stable `primary-hero` address changes from `hero` to `hero_alt`; `announcement-promo` is absent from the visible document but present in the trace as hidden. An unmatched page still receives the original `hero`, proving that the change is selector-scoped rather than a mutation of the default.

The persisted proof gives this sparse story a publication boundary. It creates one new variant block version and keeps two active sparse operations. Across the scenario, there are two domain publication pages, two domain manifests, and 47 domain items. The persisted state records two publications, four page documents, two manifests, and 47 manifest items, adding 20,480 allocated database bytes. Rollback moves the current pointer to the retained baseline publication and restores its exact document hash. It does not reconstruct a plausible prior state by undoing rows.

> **Current implementation** — The SQLite service represents type replacement as a new typed immutable block version plus a `set` operation at the existing placement key. Tombstones and reverts become new variant revisions rather than destructive updates.
>
> **Measured finding** — 24 default placements become 23 effective placements; 22 pointers remain unchanged (`91.67%` inheritance); `primary-hero` changes `hero` → `hero_alt`; two sparse operations are active; persisted rollback restores the baseline hash; publication adds 20,480 allocated bytes.
>
> **Current boundary** — The checked-in registry supports `navigation`, `hero`, `hero_alt`, `promo`, and `footer`. An unsupported published block type renders an explicit unsupported-block panel instead of disappearing silently.

Use the HUD to make the difference visible. Open the Structural map, select the matched point, and inspect the Document tab. The visible count should be 23, the type label for `primary-hero` should be `hero_alt`, and the pin should show 22 inherited winners plus the local decisions. In Block authoring, change the variant scope and compare Hide with Revert: Hide creates the tombstone; Revert removes the current draft’s local operation. The mutation commands cross the server-function boundary in `apps/cms/src/server-functions/cms.functions.ts`, execute through `apps/cms/src/server/sqlite-authoring.server.ts`, and are rendered by `apps/cms/src/components/sqlite-authoring-workbench.tsx`.

The one-minute media should use shape as well as labels: keep a fixed slot outline named `primary-hero`, remove a rectangular `hero` card, and insert a visibly different but equally bounded `hero_alt` card. Next, place a crossed-out marker over `announcement-promo`; then show hero Revert removing only the local hero card while the crossed-out marker remains. A textual transcript should state the counts—24 default, 23 visible, 22 unchanged—and finish with rollback selecting the exact baseline hash.

The result is more than a UI trick. Because manifests store placement key, ordinal, block-version pointer, winning `set` revision, operation, and priority, the serving document remains explainable after the type changes. A renderer can dispatch on the immutable block type while the authoring trace retains the richer hide and order story. The scenario’s authoritative measurements are in `docs/benchmarks.md` and `docs/evidence/bounded-report.json`.

> **Digest prompt:** Describe the final state after the hero has been reverted but the promo has not. Name the visible hero type, the status of `announcement-promo`, and why neither result requires updating or deleting an old block version.

## 4.4 Compare the three shapes

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Select the correct evidence from each scenario, compare their variation distributions without conflating metrics, and identify which architectural claims are invariant versus workload-dependent.

The three scenarios are deliberately unlike one another. Together they form a small test matrix for one architecture, not three bespoke implementations. Eligible Vehicles asks what happens when many layers overlap and every page is structurally distinct. Stores asks what happens when a million pages mostly inherit and a few tag-selected operations create five repeated structures. Structural replacement asks whether a sparse overlay can change a block’s schema and visibility while retaining stable addresses and history. The same template boundary, selector safety rules, deterministic fold, immutable versions, publication pointer, and provenance model must survive all three.

| Shape | Public proof route | Rendered shape | Headline evidence | What it does **not** prove |
| --- | --- | --- | --- | --- |
| Dense Eligible Vehicles | `/en-US/eligible-vehicles/ca/premium` | Seven placements combine dense regional winners into one ordered page | 24 pages, 24 manifests, 168/168 placements, conflict at `legal-notice` priority `60` | That manifests reduce storage for every template |
| Sparse Stores | `/en-US/store/1001` | Shared structure plus page context renders brand hero, category promo, and footer | 1,000,002 pages, five manifests, 999,997 reused pages, zero selectors on serve | That logical reuse equals SQLite file-byte savings |
| Structural replacement | `/en-US/airport/hero-alt` | The stable `primary-hero` placement dispatches to `hero_alt` while siblings inherit | `hero` → `hero_alt`, 22/24 unchanged pointers, 91.67% inheritance, exact-hash rollback | A renderer beyond the five registered block types |

Start with what is invariant. One canonical URL maps to one template and one page instance. Every template owns exactly one default; variants never cross that boundary. Selectors operate on approved fields, and author literals are bound parameters. A matched layer contributes sparse operations to placement keys. Explicit priority is the only legal precedence input, and a same-priority same-placement collision fails. Publication writes an immutable, content-addressed result and moves a current pointer atomically. Persisted route status gates the response, while serving reads publication state and executes zero selectors. These requirements are stated in `AGENTS.md` and expanded in `docs/process-engineering-guide.md`.

Now separate the workload-dependent findings. Dense Eligible produces no structural reuse: 22,024 canonical bytes are both logical and stored. Sparse Store produces dramatic structural reuse: at one million, 828,401,621 canonical bytes become 4,214 stored structure bytes, and 4,000,008 logical placements become 20 manifest items. Structural replacement is primarily an inheritance metric: 22 of 24 pointers remain unchanged. None of those ratios can be transferred to another template without measuring its distribution, content size, interpolation context, and serving behavior.

> **Requirement** — Correctness cannot depend on whether a template is dense, sparse, small, large, content-only, or structurally varied. The same inputs must yield byte-stable hashes and provenance independent of database row order.
>
> **Current implementation** — All three proofs run through the shared domain and service paths, with SQLite-specific migrations, transactions, and evidence runners isolated behind repository boundaries.
>
> **Measured finding** — Dense variation yields zero manifest reuse; sparse Store yields 99.999500001% reused pages at one million; structural replacement yields 91.67% inherited default pointers. These percentages measure different denominators and must never be added or ranked as one score.
>
> **Current comparison rule** — Choose between the executable expanded and manifest modes from the template's measured distribution. Do not treat the most impressive ratio from one scenario as a universal result.

The comparison also clarifies what “scale” means. Eligible has only 24 pages but is combinatorially difficult because 17 variants create 100 matches and exact intersections can override every placement. Store has 1,000,002 pages but only five effective structural classes. Structural has 24 default placements but tests two semantic operations that could break long-lived content identity. Page count, selector density, unique manifests, block-schema diversity, and write volume are independent axes. A useful architecture review names the axis under discussion instead of using “complex” as a catch-all.

Evidence discipline matters just as much. `docs/benchmarks.md` is the readable index; `docs/evidence/bounded-report.json` and `docs/evidence/store-1m.json` are the machine-readable envelopes. Every local time records a commit, lock digest, runtime, host, and invocation. Read the current throughput and latency from that envelope. Saving repeated canonical structure does not itself mean SQLite allocated fewer bytes overall, so the report keeps logical and physical measures separate.

The rendered comparison has one more invariant: all three pages travel through the same `PublishedDocumentSchema` and synchronous registry. `navigation`, `hero`, `hero_alt`, `promo`, and `footer` are ordinary registered block types, and stable placement keys remain the list identity. An unknown type produces a visible unsupported-block panel, so a missing renderer cannot turn a valid publication placement into silent data loss. This registry is deliberately smaller than the authoring model; it consumes only the immutable publication contract.

The one-minute comparison media should present a table or three aligned lanes, not three differently sized geographic maps. Each lane should narrate the same checkpoints: inputs, matching layers, effective placements, publication artifact, and request read. Provide numeric text alongside any bars. Dense ends with 24 distinct manifest hashes; sparse fans 1,000,002 page pointers into five manifest hashes; structural keeps one `primary-hero` placement while its type label changes. A transcript should explicitly say that the three reuse percentages have different denominators.

This comparison prepares you to operate the HUD. You now know which observations are semantic and which are measurements. On the Wall of Maps, the cards and metrics are entry points into these shapes, not a scoreboard. Once inside a template, the projection, layer stack, resolution pin, document, authoring controls, and publication history expose the same pipeline at different stages. Their component boundaries are visible in `apps/cms/src/components/wall-of-maps.tsx`, `apps/cms/src/components/template-workspace.tsx`, and `apps/cms/src/components/publication-inspection.tsx`.

> **Digest prompt:** For a fourth local template, list the measurements needed to choose between the current manifest and expanded modes. Include one variation metric, one logical-byte metric, one physical-allocation metric, one read-shape metric, and one provenance check.

# Chapter 5 — Operate the HUD as an author

*See → change → publish*

## 5.1 Navigate the Wall of Maps

> **Estimated time:** Read 5 min · Media 1 min · Digest 2 min
> **Learning outcome:** Use the Wall of Maps to find the correct template, interpret its scale and publication cues, and enter a workspace without mistaking demo-card metrics for the authoritative persisted state.

The root route is an orientation surface, not a content tree. It presents each template as an isolated map with its own domain, URL pattern, dimensions, variants, page instances, and publication state. Begin at `/` and read the heading “Wall of Maps.” The first instruction—“Find a template map, inspect its selector sheets, and pin any concrete URL to explain the final document”—describes the navigation model precisely. You are choosing an authoring boundary before you choose a URL. That order prevents a default or variant from drifting across templates.

Across the top, three summary cards establish the vocabulary. “Concrete points” totals the fixture cardinality represented by the cards. “Selector sheets” counts sparse layers with explicit priority. “Serving model” says “Immutable manifests” and repeats the critical request-path rule: public reads never execute selector SQL. These are orientation cues, not production telemetry. The badges “Model proof” and “Demo fixtures” make that status visible. Their implementation is in `apps/cms/src/components/wall-of-maps.tsx`, and the canonical definitions behind the labels are in `docs/process-engineering-guide.md`.

Use the search field when the map is not immediately visible. It accepts a domain, URL pattern, or scenario term. Searching for `eligible-vehicles`, `store`, or `structural` narrows the template cards; clearing the query restores the full result. The listing is paginated two cards at a time, with Previous and Next buttons that expose accessible labels and disable at the boundaries. The line below the cards reports the number shown, the total matches, and the current page. Search and pagination are ordinary UI state backed by a TanStack Query listing; they do not query selector matches or alter authoring state.

Read a template card in a fixed sequence. First confirm its name, domain, and route pattern. Next inspect its dimension chips and source kind. Then compare Instances, Variants, and block or placement cues. Finally read the publication-state badge and “Published” timestamp before opening the map. For Eligible Vehicles, the dense count prepares you to expect distinct effective structures. For Stores, a high page count paired with few effective classes prepares you to look for manifest reuse. For Structural, the small instance count and replacement language prepare you to inspect placement identity rather than scale. The card gives you a hypothesis; the workspace and persisted controls provide evidence.

> **Requirement** — A map is a template boundary. One canonical URL belongs to one template and one page instance, and the template owns exactly one default layer.
>
> **Current implementation** — The root UI renders three deterministic scenario fixtures and uses client-side TanStack Query state for search and pagination. It labels those cards as demo fixtures while linking into server-backed workspaces.
>
> **Measured finding** — The required proof set contains all three shapes already examined: 24 dense Eligible pages, 1,000,002 pages in the committed Store stress envelope, and 91.67% default-pointer inheritance in Structural replacement. The card scale cues summarize these shapes; `docs/benchmarks.md` remains the evidence source.
>
> **Current boundary** — The Wall of Maps is a three-scenario orientation surface. It does not rank templates or present itself as an operational monitoring dashboard.

At the bottom, use the “Relational legend · how to read this prototype” before opening a map if any term is unfamiliar. Its definition list distinguishes Template, Point, Selector sheet, Resolution pin, and Projection. Because the legend is structured as terms and definitions, it remains usable without icon recognition. A projection is a selectable two-axis view of higher-dimensional data; it is not the complete template. A resolution pin is a current resolution explanation for one point. Those distinctions will determine how you interpret the workspace in the next section.

To enter, activate the template card’s map link. The destination follows `/templates/$templateId`, defined by `apps/cms/src/routes/templates.$templateId.tsx`. That route loads health and authoring-workspace data through server functions before it renders the template shell. The root never imports the SQLite client, and the browser does not gain database access by following the link. Data crosses the same validated server boundary used by tests.

The one-minute media should demonstrate keyboard and pointer navigation together. Focus the search field, type `store`, announce the result count, move through the visible card’s labeled facts, activate it, then return and clear search. Do not represent scale solely through card area or color; speak the exact count and publication label. Include captions and a text transcript that identifies which information is a fixture cue and which link opens persisted authoring state.

> **Digest prompt:** Before opening a template, name the five card facts you would verify and explain why “1,000,002 instances” does not by itself tell you whether the template is structurally dense or sparse.

## 5.2 Inspect selectors, layers, and points

> **Estimated time:** Read 5 min · Media 1 min · Digest 2 min
> **Learning outcome:** Project a high-dimensional template into an inspectable view, select one concrete point, and use the layer stack and resolution pin to explain its content, order, selector, and request outcome.

Inside `/templates/$templateId`, the workspace is organized left to right as cause, selected surface, and explanation. The left column is the layer stack. The center is the map workspace. The right column is the resolution pin. On narrower screens the regions stack, but their semantic headings remain. This layout is implemented in `apps/cms/src/components/template-workspace.tsx`; it is a deliberate authoring HUD, not a visual imitation of database tables.

Start in **Projection**. Choose two axes from the available dimensions, then filter the dimensions not shown on those axes. The grid is a bounded view of the relation; changing axes changes the view, not the underlying pages. In Eligible Vehicles, you might show state by purpose while holding locale fixed. In Stores, you might compare a tag-derived classification with store identity. Select a labeled point to make it the active page. If a point is not visible because a filter excludes it, change the filter rather than assuming the page does not exist.

Next use the center tabs with a question in mind. **Instances** is the row-oriented view and supports inspecting a concrete canonical URL. **Document** shows effective visible placements. **Block authoring** exposes persisted SQLite mutations. **Tags** explains explicit classification memberships. The tabs implement correct tab roles, selected state, keyboard focus, and arrow-key behavior. A user who cannot perceive the grid can reach the same page through the instance table and then inspect its textual pin.

The layer stack names the default and non-default variants, shows priority, matches, and operations, and allows a local preview of ordering. Treat that preview as a draft hypothesis. Moving a layer in the fixture visualization demonstrates how priority order affects winners; persisted priority changes occur only through the live authoring controls. The default stays at priority `0`. A non-default priority must be a positive integer. No drag position, selector specificity, creation timestamp, or visual vertical order is an independent precedence rule.

Now read the resolution pin. **Trace** begins with the canonical URL, scalar dimensions, explicit tags, matched layers, route status, and final placement winners. Each placement can expose full provenance, including content source, order source, revision, operation, and priority. On a McDonald’s Store page, `navigation` comes from default, `primary-hero` from the priority-30 brand layer, `category-promo` from priority-20 fast food, and `footer` from priority-10 chain store. On the Structural page, the pin should show `hero_alt`, one scoped tombstone, and 22 inherited pointers.

> **Requirement** — Every effective placement must have one content source and one order source. The trace must explain inheritance, local operations, tombstones, and conflicts without relying on row order.
>
> **Current implementation** — The HUD resolves deterministic fixture points in the browser for the explanatory projection while its Block authoring tab displays live server-backed SQLite state. The two surfaces are labeled and kept conceptually separate.
>
> **Measured finding** — Store’s bounded selectors match exactly 501 chain, 201 fast-food, 50 Burger King, and 51 McDonald’s pages. Structural exposes 23 visible placements, one tombstone, one `hero_alt`, and 22 inherited pointers. Eligible’s exact-intersection page has provenance for all seven winners.

Switch to **Selector SQL** to inspect the authored expression, normalized form, parameters, match count, and plan cue. Values remain parameters, and identifiers come from a template-owned allowlist. This SQL path is preview-only. Draft resolution and publication evaluate the already-validated selector AST in Bun; public requests read the immutable publication. Use **Draft diff** last to compare the current preview with the publication rather than treating unsaved or unpublished intent as live content.

The pin also combines the two persisted facts used by serving: `page_instances.route_status` and active publication availability. A `live` page with a published document yields `200`. Missing, `not_live`, `archived`, and live-but-unpublished pages yield `404` with distinct service reasons. These outcomes appear as text in the pin, not color alone. The exact branches live in `CmsService.serveWithEvidence`.

> **Current implementation** — Publication compiles `live` and `not_live` pages and omits `archived` pages. Serving checks the current route status before returning a schema-valid published document.

The one-minute media should select one McDonald’s point and narrate the pin top to bottom. Highlight the three matched non-default layers, then read the four final placement sources. Switch to Selector SQL long enough to say “preview only,” and finish on route status plus publication availability. Every animated highlight needs a spoken label and persistent focus indicator; provide a transcript with the canonical URL and priority sequence.

> **Digest prompt:** For a selected live page that returns `404` with reason `unpublished`, write the two facts the pin must show. Then explain why changing selector priority cannot repair a missing active publication on the public request path.

## 5.3 Perform block and variant CRUD

> **Estimated time:** Read 5 min · Media 1 min · Digest 3 min
> **Learning outcome:** Safely create and revise variants and placements through copy-on-write, distinguish default deletion from variant hiding and reversion, and verify selector scope before publishing.

Open **Block authoring** only after the selected point and its current winners make sense. The green-tinted “Live SQLite authoring” panel is the persisted surface. Its status line names the template, current publication, canonical URL, visible-placement count, tombstone count, and publication count. Every control delegates through a validated TanStack server function to the same immutable block, selector, resolution, and publication services exercised by tests. The browser component is `apps/cms/src/components/sqlite-authoring-workbench.tsx`; server-function schemas live in `apps/cms/src/server-functions/cms.functions.ts`; database work stays in `apps/cms/src/server/sqlite-authoring.server.ts`.

First choose **Authoring scope**. The list includes the default and each variant with its `P` priority; a zero-match variant is labeled. Default editing changes the layer every page inherits. Variant editing creates local operations that affect only matching pages. If the selected non-default selector currently matches zero pages, the panel warns you and disables page-dependent copy-on-write actions. That guard prevents an author from mistaking a valid but irrelevant selector for a visible result.

To create a variant, enter a name, start mode, priority, and selector. **Linked / inherit** creates a sparse layer with no placement operations, so the resolved lower document remains visible and no block content is cloned. **Blank / tombstones** is an explicitly empty presentation: inherited placements receive local absence decisions. These modes are not synonyms. Choose linked for gradual overrides; choose blank only when the product intends an empty starting document. Preview the selector before creation or revision. The preview reports exact matches out of the template total, normalized selector text, bounded sample URLs, and plan. A sample is not the count.

> **Requirement** — Selectors are a restricted DSL over approved fields, with template scope injected by the service. Linked inheritance must not clone content; a deliberate blank must not be mistaken for a new linked variant.

Once scope is correct, select a resolved placement. The editor shows its stable key, block type, immutable version payload, inheritance badge, and separate content/order provenance. Editing JSON and pressing **Save new version** never updates the old version. The service validates the payload against the selected block type and appends an immutable version; editing inherited content adds a local `set` through copy-on-write. Changing `hero` to `hero_alt` uses the same stable key while validating a different schema.

Order is independent from content. **Move up** and **Move down** add an order decision without manufacturing another content version. The status badges can therefore show content inherited while order comes from a local priority. When adding a placement, provide a stable key, a block type, and valid JSON. Placement identity should describe the conceptual position—such as `primary-hero`—rather than its current ordinal or renderer.

Deletion depends on scope. In the default, **Delete** removes the placement from the new default revision’s effective document; it does not delete historic published versions. In a non-default variant, the same action is labeled **Hide here** and creates a tombstone. A hidden placement appears in “Scoped tombstones,” where selecting its revert control removes the local absence decision in a new revision. **Revert override** on a visible local winner likewise removes that local operation and exposes the lower winner. Revert is not a compensating content write and does not erase history.

> **Current implementation** — Each authoring command runs in a SQLite transaction, creates immutable revisions and versions, then re-resolves the sample workspace. If resolution reports a conflict, the mutation is rolled back rather than leaving a broken draft partially persisted.
>
> **Measured finding** — The structural workflow proves one new variant block version, two active sparse operations, 22 unchanged pointers, one tombstone, and an exact restoration of the inherited hero after revert. Store mutation tests prove a fast-food promo change reaches both named brands while a McDonald’s hero edit leaves Burger King and default unchanged.

Use priority and selector changes carefully. A priority edit affects every page matching the layer and can expose a same-priority same-placement conflict elsewhere. A selector revision can change its entire match set. The HUD’s bounded point is useful feedback, but publication is the authority because it evaluates every eligible page and rejects conflicts atomically. Tests in `apps/cms/src/server/sqlite-authoring.server.test.ts` cover command validation, transactions, and rollback of conflicting changes; domain and service suites provide the broader invariant proof listed in `docs/benchmarks.md`.

> **Current boundary** — These controls prove CRUD and transactional semantics. The local HUD does not implement user identity, roles, approvals, or an editorial review workflow.

The one-minute media should perform one narrow sequence: create a linked Store variant, preview its exact match count, edit an inherited placement to create a new version, move it, hide it, then revert the tombstone. Keep the stable placement key on screen and announce every content and order source change. Do not compress the sequence so much that Hide and Revert look interchangeable; captions should name the new immutable revision created at each step.

> **Digest prompt:** A linked variant inherits `primary-hero`. An author edits its content, moves it down, hides it, and then reverts only the tombstone. Describe the final content source and order source, and list which historic objects must remain immutable.

## 5.4 Publish, inspect, and roll back

> **Estimated time:** Read 5 min · Media 1 min · Digest 3 min
> **Learning outcome:** Publish the current persisted revisions, verify the isolated public, preview, and admin lanes, inspect the immutable result and request seam, and roll back by repointing to a retained predecessor without recompilation or row mutation.

Publishing turns the draft relation into the serving contract. In **Block authoring**, the “Atomic publication” card offers **Publish now** and **Roll back pointer**. Publishing compiles every bounded eligible page for the scenario, validates selectors and block schemas, detects conflicts, canonicalizes winners and provenance, writes immutable manifests and page documents, and only then moves the serving pointer. The UI disables controls while a mutation is pending and returns a textual status. A failure leaves the former pointer current.

Before publishing, check four things: the selected authoring scope is intentional; selector preview reports the expected exact count; the resolution pin has one content and one order source for every visible placement; and Draft diff shows only the intended changes. Then publish. The returned workspace should display a new current publication ID, current document hash, publication count, and retained predecessor. Re-running publication with identical inputs is idempotent: the Store evidence retains the same publication/input hash and adds no page rows.

Follow **Inspect publication and rollback** to `/publications/$templateId`. That file route is defined in `apps/cms/src/routes/publications.$templateId.tsx` and renders `apps/cms/src/components/publication-inspection.tsx`. The heading badge says “Live SQLite publication controls.” This wording is important: the action card operates on actual current revisions. Elsewhere on the page, candidate, active, and rollback cards from the explanatory scenario fixture help communicate the lifecycle, but they do not substitute for the live workspace line naming the active ID, immutable snapshot count, and current hash.

The history area lets you select candidate, active, and retained rollback snapshots and compare a selected fixture with the active fixture. Use it to understand expected changes in pages, manifests, duration labels, and hashes. Use the live action controls to mutate persisted state. **Preview publication** explains that the command compiles current SQLite revisions, not the illustrative candidate card. **Confirm publish** performs the real action. This separation prevents a polished mock candidate from being mistaken for an already-built artifact.

> **Requirement** — Publication is atomic, immutable, versioned, and reversible. A conflict or write failure exposes no partial result. Rollback restores an existing validated publication and its exact hashes; it never recompiles an approximation.
>
> **Current implementation** — The local SQLite service performs the bounded write and pointer activation transactionally. The inspection page combines clearly labeled scenario communication cards with live server-function actions.
>
> **Measured finding** — Dense conflict injection leaves no failed publication rows; Store and Structural failure proofs retain the prior pointer; persisted Structural rollback restores the exact baseline hash. The million Store identical republish adds no page rows and keeps the same publication/input hash.

Inspect the **Route status → publication request trace** before rollback. Choose each request case and read the persisted status, publication lookup, and outcome. A `live` page plus an active publication produces `200`. Missing, `not_live`, `archived`, and live-but-unpublished pages produce `404` with distinct reasons. The trace is a serving explanation: it calls the materialized `CmsService.serve` path and never runs selector SQL.

Now verify the same boundary in the two-app interface. Keep `apps/cms` on `http://localhost:3000` and `apps/website` on `http://localhost:3001`, then use the Store route as a controlled comparison:

1. Open `/en-US/store/1001` in the website. It must report published, non-editable state and the active publication hash.
2. Open `/en-US/store/1001?edit_mode=true`. It must return the same published state and hash. The public route's empty search validator means the query cannot elevate the request.
3. Make and save an authoring change without publishing it, then open `/cms-preview_/en-US/store/1001`. The explicit preview must show the draft resolution, matched variants, tombstones, and authoring provenance through the shared renderers while the two public URLs continue to show the active publication.
4. Inspect the preview response for `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow, noarchive`. The HTML metadata carries the same noindex intent.
5. Open `/admin`. A configured, valid `CMS_ADMIN_ORIGIN` exposes one direct handoff link; missing or malformed production configuration fails closed with an actionable message. The website does not proxy arbitrary paths, embed the CMS in an iframe, or invent `/api/auth` behavior.

Local development permits the explicit preview route. A non-development proof environment must opt in with `CMS_ENABLE_PREVIEW=true` and, only for local-host browser evidence, `CMS_ALLOW_LOCAL_PREVIEW_HOST=true`. Those flags expose a prototype lane; they do not provide user authentication. The public application has an analogous local-host proof switch, but its route still opens SQLite read-only and calls only `CmsService.serve`.

To roll back, open **Preview rollback**. The panel names `workspace.rollbackPublicationId`, the actual retained predecessor. Confirm that it is present and that the expected current publication has not changed. **Confirm rollback** repoints serving to that immutable namespace; no publication page or manifest row is rewritten. After the mutation, verify the active ID and document hash in both the workspace and publication route. The former current publication remains history and can support investigation or a later explicit action.

> **Current boundary** — Rollback selects the retained `previous_publication_id` and repoints `current_publications` transactionally. The local command does not add an approval or authorization workflow around that operation.

The server boundary is part of the safety story. TanStack `createServerFn` endpoints validate command shapes; browser code never imports `bun:sqlite` or a database client. Cross-site request protections and service validation run before the transactional command. The backend path in `apps/cms/src/server/sqlite-authoring.server.ts` delegates to the shared compiler in `packages/cms-service/src/cms-service.ts`, so the HUD does not have a weaker publication implementation than the tests. Website public and preview loaders likewise cross server functions, but only the explicitly named preview function may call draft resolution.

The one-minute media should show a hash-centered workflow. Capture the active ID and hash, preview and confirm publication, verify the new ID/hash and retained predecessor, then preview and confirm rollback. End with the original hash restored. Narrate which cards are illustrative and which line is live persisted state. Provide captions for status changes, and do not use a green/red transition as the only signal of success or failure.

> **Digest prompt:** You lose the network response immediately after confirming publication. Describe the safe verification sequence across the CMS, public route, `edit_mode` query, explicit preview, and active hash before retrying, and explain why neither a draft preview nor a blind second activation proves which publication became current.

# Chapter 6 — Verify the Executable Architecture

*Inspect → test → explain*

## 6.1 Expanded Documents and Shared Manifests

> **Estimated time:** Read 5 min · Media 1 min · Digest 3 min
> **Learning outcome:** You can compare the two materialization modes implemented by `CmsService`, explain their exact read shapes, and verify that both return the same strict published-document contract.

Auteur implements two publication storage shapes: `expanded` and `manifest`. The caller selects the mode through `CmsService.publish`. Both begin with the same template-scoped authoring state, selector evaluation, deterministic fold, bounded interpolation, block-schema checks, and public-document validation. They differ in what is persisted and how `CmsService.serve` reconstructs the validated result.

In **expanded mode**, each `published_page_documents` row carries `rendered_document_json`. `CmsService.serve` reads the active publication and parses that JSON after one SQLite statement.

In **manifest mode**, pages that have the same ordered structural winners point to one `document_manifests` row. `document_manifest_items` stores the stable placement key, ordinal, immutable block-version pointer, and winning `set` provenance for each structural position. The page document links that manifest to one page and stores its immutable `resolved_data_json` context. Serving reads the page/publication row and shared manifest in two statements, calls `interpolateJson` for each winning block against that context, then constructs the same strict document value.

The public boundary is smaller than draft resolution. `PublishedDocumentSchema` contains visible placements in one ordered list:

```text
templateId
pageId
placements[]:
  placementKey, contiguous order, blockType, blockVersionId,
  materialized content,
  winning set revision/operation/priority
```

It does not contain matching selector text, tombstones, the full resolution trace, or separate order provenance. Those remain available in authoring and preview models, where they explain how the effective list was formed. Public rendering needs the final visible list and the exact content winner for each placement.

The Store scenario demonstrates structural sharing. Many pages can point to the same manifest because they select the same stable block-version structure. In `packages/cms-domain/src/interpolation.ts`, `interpolateJson` uses immutable page context to evaluate bounded `{{ dotted.path }}` expressions. Publication evaluates and validates the page-specific result for both modes. Expanded mode stores it; manifest serving deterministically reproduces it from immutable context. Shared structure therefore does not erase page-specific rendered values.

Eligible Vehicles demonstrates the opposite distribution: each representative page can have a distinct manifest. The structural scenario shows why the same machinery is useful at small scale: it preserves the `primary-hero` placement while the winning block type changes to `hero_alt` and unrelated pointers stay unchanged.

> **Current serving contract** — The request path performs one expanded read or two manifest reads. In the evidence vocabulary, that is `1–2 SQLite reads and zero selector statements`. Both modes return a `PublishedDocumentSchema` value and dispatch through `apps/website/src/components/block-renderer.tsx`.

The evidence files keep unlike measurements separate. Logical expanded placements count repeated structure per page. Stored manifest items count unique structure. Serialized document bytes include materialized page content. SQLite allocation includes table pages and indexes. Read the current values in `docs/evidence/bounded-report.json`, `docs/evidence/store-1m.json`, and `docs/benchmarks.md`; do not use a structural-reuse percentage as a file-size claim.

For the one-minute media, place one schema-valid document above two storage lanes. The expanded lane should show the complete JSON on the page row and one read arrow. The manifest lane should show several page rows pointing to one ordered manifest and two read arrows. End with both lanes feeding the same `PublishedDocumentSchema` card and the same block registry. Label every count as text rather than relying on color or geometry.

**Digest prompt:** Compare the expanded and manifest path for `/en-US/store/1001`. Name the persistence rows, SQL statement count, interpolation point, schema boundary, excluded draft-only fields, and final renderer. Then explain why manifest reuse and page-specific rendered content are compatible.

## 6.2 The Synchronous Publication Transaction

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** You can walk through `CmsService.publish` in execution order and explain compilation, idempotency, atomic activation, failure behavior, and rollback using the tables the code writes today.

The complete database publisher is the `publish` method in `packages/cms-service/src/cms-service.ts`. It is synchronous and runs inside one SQLite transaction. Its `batchSize` controls how many page inputs are prepared at a time; it does not create independent commits or background jobs.

Read the method in this order:

1. `requireTemplate` confirms that the template exists and has an active default.
2. `prepareResolutionState` loads the default, active variant revisions, validated selector expressions, operations, block versions, and schema information once for the template.
3. `publicationPageBatches` visits every `page_instances` row whose status is not `archived`. Both `live` and `not_live` pages are compiled.
4. Publication calls `evaluateSelector` for each prepared page and active selector AST, then calls the deterministic resolver.
5. `interpolateJson` materializes bounded expressions from immutable page context and the block schema validates the result.
6. `preparedMaterializedPlacements` requires an exact winning `set` operation for each visible placement. Missing provenance is a conflict, not a best-effort result.
7. `publishedDocumentValue` creates and parses the strict public document before it can be stored.
8. Canonical hashes identify the complete input, each structural manifest, each page document, and the publication.
9. Immutable publication, manifest, manifest-item, and page-document rows are inserted, then `current_publications` changes to the completed publication.

Selector SQL is for bounded preview only. `packages/cms-service/src/selector-sql.ts` compiles approved expressions into parameterized preview queries that return counts, sample URLs, and an inspectable plan. Publication calls `evaluateSelector` from `packages/cms-domain/src/selector.ts`; public serving performs neither SQL preview nor AST evaluation.

The pure scenario compiler is also worth reading. `compilePublication` in `packages/cms-domain/src/publication.ts` canonicalizes resolved page inputs, rejects duplicate page/canonical identities and cross-template input, creates shared manifests, and reports structural metrics. Scenario proofs call it directly. `CmsService.publish` applies the database transaction and serving-table behavior around the same published invariants.

Input hashing makes an unchanged current publication request idempotent. The hash includes the template, materialization mode, active revisions, page identity and status, route revision, context/slot hashes, explicit tags, resolved content hash, and manifest hash. When that complete input matches the current publication, the service returns the current immutable result instead of inserting another set of page rows.

Atomicity is visible at the database boundary. The mutable seam is one `current_publications` pointer per template. That pointer changes only after every non-archived page compiles, every conflict check passes, every block payload validates, every public document parses, and all immutable rows exist. Any thrown error rolls back the transaction, so public readers continue to see the prior complete publication.

Rollback is another synchronous transaction. It validates the requested retained publication, then repoints `current_publications`; it does not rerun selector evaluation, rebuild documents, or mutate either publication. This is why comparing the active document hash before publication, after publication, and after rollback is a strong browser proof.

> **Current transaction contract** — One call either commits a complete immutable publication and its active pointer or commits nothing. Batch iteration is an in-transaction memory detail, not a separate visibility boundary.

The one-minute media should follow a single Store publication call. Show active revision IDs entering the input hash, non-archived pages passing through `evaluateSelector` and resolution, `PublishedDocumentSchema` accepting each page, immutable rows filling, and the pointer moving last. Then inject a same-priority conflict and show the whole transaction roll back while the prior pointer and hash remain current. Finish with rollback selecting the retained predecessor.

**Digest prompt:** A conflict appears on the final page in the last batch. Explain why no partial page set becomes visible, which pointer stays current, why `batchSize` does not weaken atomicity, and what a successful retry must change in the authored input.

## 6.3 Current Runtime Guardrails

> **Estimated time:** Read 5 min · Media 0 min · Digest 3 min
> **Learning outcome:** You can verify the current database, host, route-status, preview, admin, schema, and browser-import guardrails directly in the two TanStack applications.

The public website starts with `apps/website/src/routes/$.tsx` and `apps/website/src/server-functions/published-page.functions.ts`. `PublicPageRequestSchema` accepts only a canonical path. `resolvePublicTemplate` recognizes the three checked-in URL patterns, and `publicHostMatchesTemplate` checks the configured canonical host while allowing loopback during development. The loader opens SQLite read-only with creation disabled.

`CmsService.serveWithEvidence` implements the response matrix from persisted state:

| Stored state | Current result |
| --- | --- |
| No matching page row | `404 missing` |
| `archived` page | `404 archived` |
| `not_live` page | `404 not_live` |
| Live page without a complete active document | `404 unpublished` |
| Live page with an active schema-valid document | `200` plus publication ID, hash, and document |

The repository models external route identity, status, and revision in SQLite and deterministic inputs. No public request performs a network call to obtain those values. The service reads the persisted page state and active publication together.

Public query parameters cannot change lanes. `?edit_mode=true` is not part of `PublicPageRequestSchema`, so the query cannot elevate the request. The catch-all still calls only `CmsService.serve`, and `CmsService.serve` reads the active publication. A successful response is parsed through `PublishedDocumentSchema`, gets public cache headers plus an ETag and publication header, and renders with `editable: false`.

Draft rendering starts at the explicit `/cms-preview_/<canonical-path>` route. Its server function applies host/environment checks, opens SQLite read-only, and calls `resolveDraftByCanonicalUrl`. Preview responses set `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow, noarchive`. Their view model can include matched variants, tombstones, and authoring provenance because it is not the public published-document shape.

The `/admin` route calls `readAdminGatewayState`. `CMS_ADMIN_ORIGIN` must be a bare absolute HTTP(S) origin with no credentials, path, query, or fragment. In required environments, missing or malformed production configuration fails closed and produces no handoff link. A valid value produces one direct link; the page does not proxy requests or embed the CMS.

The package boundary is enforced structurally. Browser modules do not import `bun:sqlite`, `@repo/cms-db`, or `@repo/cms-service`. Server functions dynamically import server-only database, domain, and service code. `bun run five-phase-pass` includes cross-workspace checks for these import boundaries.

> **Current boundary — isolation is observable.** Preview host and header checks, public read-only serving, and the validated admin handoff are implemented and tested. They are route-separation mechanisms; the repository does not turn them into a user-account or role system.

There is no media allocation for this section. Verify the guardrails with code and tests: `apps/website/src/data/public-path.test.ts`, `server-functions/published-page.integration.test.tsx`, `server/preview-page.server.test.ts`, `server-functions/preview-page.functions.test.ts`, and `components/admin-gateway.test.tsx`.

**Digest prompt:** Explain why `/en-US/store/1001?edit_mode=true`, `/cms-preview_/en-US/store/1001`, and `/admin` are three different contracts. Name each loader, database mode, content source, response policy, and failure shape.

## 6.4 Verify and Re-explain the Code

> **Estimated time:** Read 5 min · Media 0 min · Digest 4 min
> **Learning outcome:** You can verify one vertical slice across schema, service, applications, tests, evidence, and browser output, then re-explain the architecture using only implemented components.

Begin every review with one canonical page. `/en-US/store/1001` is useful because three sparse variants compose while a default placement remains visible. `/en-US/eligible-vehicles/ca/premium` stresses dense precedence. `/en-US/airport/hero-alt` proves type replacement under a stable placement key. All three end at the same `PublishedDocumentSchema` and block renderer.

For one route, reconstruct this chain:

```text
selector-driven authoring → atomic immutable publication → read-only public serve → synchronous block registry

Drizzle schema + deterministic seed
  → template/page/slot/tag/variant/block rows
  → evaluateSelector + resolveDocument + interpolateJson
  → CmsService.publish transaction
  → publication/manifests/page documents/current pointer
  → read-only CmsService.serve
  → PublishedDocumentSchema
  → PublishedPage + PublishedBlock
```

Ask concrete questions at each boundary:

- Can every authoring row be assigned to one template?
- Does the template have exactly one default at priority `0`?
- Are non-default priorities positive and explicit?
- Do same-priority operations on the same placement fail for an overlapping page?
- Does every visible resolved placement have one content winner and one order winner?
- Does every published placement have a unique key, contiguous order, immutable block-version pointer, materialized content, and winning `set` provenance?
- Are tombstones, full trace, and separate order provenance absent from the strict public document?
- Does publication include `live` and `not_live`, omit `archived`, and move the pointer only after complete validation?
- Does serving return `404 unpublished` for a live page without an active document?
- Do expanded and manifest serving use one and two statements respectively, with zero selector SQL?
- Does the explicit preview show an unpublished edit while both canonical URLs retain the active publication?
- Does rollback restore a retained exact hash without rewriting publication rows?

Run focused checks while following the code. `packages/cms-domain/src/selector.test.ts`, `packages/cms-domain/src/resolution.test.ts`, `packages/cms-domain/src/publication.test.ts`, `packages/cms-domain/src/published-document.test.ts`, and `packages/cms-domain/src/interpolation.test.ts` isolate pure behavior. `packages/cms-service/src/cms-service.integration.test.ts` covers transactions, lifecycle, publication, serving, and rollback. CMS server tests exercise validated authoring commands. Website integration tests exercise public/preview isolation and block dispatch. Scenario tests prove the three distributions.

Then run the repository gate:

```bash
bun run five-phase-pass
```

The gate resets and seeds a fresh database, runs formatting and type checks, exercises database/domain/service/scenario/application tests, verifies committed evidence, builds both TanStack applications, and checks workspace boundaries. Report the command's current totals rather than copying numbers into the tutorial, because the suite grows with the code.

Browser verification connects those checks to what a teammate can see. Confirm the Store public route and its `edit_mode` query share the same publication hash. Save a draft change and confirm only the explicit preview changes. Confirm Eligible renders seven placements. Confirm Structural renders `hero_alt` at `primary-hero`. Publish, inspect the new active ID/hash, roll back, and confirm the retained hash returns.

Use this teach-back structure:

1. **Invariant:** state the rule in one sentence.
2. **Mechanism:** name the current schema and function that enforce it.
3. **Evidence:** name the focused test, scenario report field, or browser observation.
4. **Boundary:** state exactly what data is excluded from the next runtime lane.

For example: “Public requests never evaluate selectors. `loadPublishedPage` opens SQLite read-only and calls `CmsService.serve`; `serveWithEvidence` reports zero selector SQL and parses the active published document. Website integration tests exercise all three representative routes. Selector text, tags, tombstones, and the full draft trace never cross `PublishedDocumentSchema`.”

> **Current review contract — every claim has a path.** A useful explanation names the current table or schema, implementation function, validation evidence, and runtime boundary. If one is missing, return to the code before teaching the claim.

**Digest prompt:** Give a five-minute architecture explanation using one Store page. Include the authoring rows, selector AST, deterministic fold, interpolation, synchronous publication transaction, strict public schema, one/two-read serving modes, block registry, explicit preview isolation, rollback, and the exact tests you would run to verify the story.
