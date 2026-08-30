# Chapter 4 — Three executable proof shapes

*Dense → sparse → structural*

## 4.1 Dense Eligible Vehicles

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Explain why dense, intersecting variation is a correctness proof for deterministic precedence—not a manifest-deduplication success story—and trace one page from selector matches to an atomic publication.

Eligible Vehicles is the first place where the algebra becomes an executable product shape. Its canonical pattern is `/{locale}/eligible-vehicles/{state}/{slug}`. A page can be addressed by country, language, state, purpose, and an exact intersection, so several legitimate layers may match one URL. Think of the example `eligible:en-US:CA:premium`: it does not choose a single “most specific” branch. It collects matching template-scoped variants and folds their sparse operations in explicit priority order. The representative fixture contains 24 page instances and 17 active selector variants producing 100 total matches. Four exact-intersection variants each target one page. These are intentionally dense conditions: every published page ends with its own seven-placement structure.

The standalone proof route is `http://localhost:3001/en-US/eligible-vehicles/ca/premium`. After the repeatable compact seed, that URL reads active publication `editable-eligible-publication-1` and document hash `b09fe560f855262f394bb324722fb73c71f386a114882bda3bf2554516f5dfa1`. The reader-facing app does not reproduce the country/language/state/purpose fold: it receives the seven already-published placements and renders them synchronously by block type.

The scenario should be read as a precedence and provenance stress test. The country layer can establish broad copy; language can replace localized placements; state can add legal or regulatory content; purpose can change offer framing; and the exact intersection can override all seven placements. The implementation never derives precedence from a selector’s length, apparent specificity, row ID, or creation time. Only the authored integer priority participates. When two matched variants at priority `60` both write `legal-notice`, the compiler returns `PRIORITY_CONFLICT`. It does not pick whichever row SQLite happens to return first. The failed build creates no partial publication rows, and the prior current-publication pointer remains active. The executable evidence lives in `docs/evidence/bounded-report.json`; the human-readable interpretation is in `docs/benchmarks.md` under “Scenario A — dense Eligible Vehicles.”

> **Requirement** — Same-priority writes to the same placement fail publication. Every visible placement has exactly one content winner and one order winner, with enough provenance to explain both.

Successful compilation makes the density equally visible. The run writes 24 materialized page rows and 24 unique manifests. Across seven placements per document, that is 168 expanded placements and 168 stored placements. Canonical manifest structure occupies 22,024 bytes in either form. All 168 persisted items retain exact operation provenance. The persisted publication comprises 218 rows, has an estimated serialized size of 21,120 bytes, and adds 118,784 allocated database bytes. The exact-intersection page proves that every placement can be locally replaced without losing its source revision or priority.

Those numbers require disciplined interpretation. A content-addressed manifest is still useful because it gives the publication a stable, immutable structure and preserves per-placement lineage. Yet this shape has zero structural reuse: 24 pages produce 24 manifests. Saying “manifests saved space” here would be false. Dense variation is the counterweight to the Store scenario that follows; it prevents a storage strategy from being justified by a single favorable distribution.

> **Prototype choice** — The Bun/SQLite compiler resolves the complete bounded template, canonicalizes each effective document, writes immutable publication rows, and swaps one current pointer inside the local service transaction.
>
> **Measured finding** — 24 pages, 17 active variants, 100 selector matches, four exact intersections, 24 unique manifests, 168/168 expanded/stored placements, and 22,024/22,024 canonical manifest bytes. A `legal-notice` conflict at priority `60` is rejected with no partial rows.
>
> **Open decision** — The production compiler still needs TiDB measurements for dense scalar distributions, chunk sizing, write amplification, and whether an expanded hot-serving payload is preferable when manifest reuse is zero.

In the HUD, open the Eligible Vehicles map from the root Wall of Maps, then choose the two projection axes and filter the remaining dimensions. Selecting a point moves the resolution pin without changing the projection itself. In the right-hand pin, read the Trace from the default layer upward; then compare Selector SQL and Draft diff. The author-facing route is assembled by `apps/cms/src/routes/templates.$templateId.tsx`, while the three-column workspace behavior lives in `apps/cms/src/components/template-workspace.tsx`. The selector text shown in the HUD is an inspected compilation artifact, not SQL that will run during a public request.

For the one-minute media, show the five conceptual layers as labeled sheets—country, language, state, purpose, exact—then lower a vertical pin through `eligible:en-US:CA:premium`. Narrate the labels and winner changes; do not rely on color alone. End on the conflict state: two priority-60 arrows converge on `legal-notice`, publication stops, and the old pointer remains labeled “current.” Captions should state that the exact intersection overrides every placement and that the result has no manifest reuse.

The serving side completes the proof. Camo Press remains responsible for route existence and lifecycle status. Once a route is confirmed `live`, Auteur reads the already-published page and immutable structure. No country, language, state, purpose, or exact selector is evaluated in that request. This boundary is described in `docs/process-engineering-guide.md` and enforced by the service path in `packages/cms-service/src/cms-service.ts`.

> **Digest prompt:** If a future implementation produced only 23 manifests for these 24 pages, what evidence would you request before calling it an optimization? Your answer should distinguish legitimate content identity from accidental canonicalization, and it should name the placement-level provenance that must remain inspectable.

## 4.2 Sparse Stores at one million

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Interpret the Store proof at both development and million-page scale, including selector composition, structural reuse, interpolation, idempotency, and the limits of SQLite byte and latency evidence.

The Store map changes the distribution without changing the resolution rules. Its route pattern is `/{locale}/store/{store_id}`. Most pages inherit nearly everything, while a few tag-defined classes replace one placement each. A chain-store variant at priority `10` writes `footer`; a fast-food variant at `20` writes `category-promo`; disjoint McDonald’s and Burger King variants at `30` each write `primary-hero`. A McDonald’s page therefore composes three non-default layers. A Burger King page follows the same structure with another hero pointer, while an independent store stays on the default. No Store-specific resolver branch exists: the same selector compiler and fold used for Eligible Vehicles handle this sparse shape.

The standalone proof route is `http://localhost:3001/en-US/store/1001`. The compact seed points it at `publication-store-1` with document hash `173f0c8b8cfaff9425c595896e3e1d9f4d39bb5b3f73a358582ba17198d6306d`. The rendered hero contains the page-specific interpolated store context even when multiple Store pages reuse its structural manifest; the public registry sees only the final content and provenance, never tags or selector text.

The bounded fixture makes the five outcomes easy to inspect. It requests 1,000 scale pages and retains two foundation pages, for 1,002 documents. Those pages carry 4,008 scalar slot rows and 1,304 tag memberships. The four selectors match 501 chain stores, 201 fast-food stores, 50 Burger Kings, and 51 McDonald’s stores. Although the two brand layers share priority `30` and both target `primary-hero`, their match sets are disjoint. The overlap diagnostic still names the potential conflict surface. That matters operationally: a future classification error that assigns both brand tags must fail rather than acquire an arbitrary winner.

Only five structural manifests are needed for the 1,002 bounded pages. Thus 997 pages reuse an existing manifest, a 99.50% deduplicated-page ratio. The structure contains 4,008 logical placements but just 20 stored manifest items. Canonical structure falls from 830,021 logical bytes to 4,214 stored bytes, removing 825,807 repeated bytes. Yet the fully expanded rendered documents occupy 1,142,964 logical bytes, the manifest-plus-page estimate is 858,229 bytes, and the actual SQLite publication allocation grows by 1,294,336 bytes, or 1,291.75 per document. Table pages, indexes, immutable page JSON, and context do not disappear when structure is shared.

> **Requirement** — Sparse selectors must compose when they write different placements, and same-priority selectors that ever overlap on one placement must conflict. Publication and serving must preserve the page’s exact structural and interpolation result.
>
> **Prototype choice** — Structural manifest identity excludes page interpolation values. Per-page context supplies deterministic rendered text, so two McDonald’s pages can share a manifest while producing different hero text and document hashes.
>
> **Measured finding** — The bounded proof has 1,002 documents, five manifests, 997 reused pages, 4,008/20 logical/stored placements, and 830,021/4,214 canonical structure bytes. Its actual database delta is 1,294,336 bytes, so the prototype does not claim an end-to-end allocation saving at this scale.

The committed million-page envelope tests whether that relational shape remains executable rather than extrapolating the bounded ratios. It records clean scratch source commit `37b789b26e0116ce1fa95321ad4b6b3d95cd3453`, an ancestor of the AUT-533 transfer source `1c227cf28eabd3a1ddf86768d5767a0fecbbdfe1`, plus lock digest `1a6e0ed8bfdb74dfb8048560186c64bee2eaa5416a0f68442c0ddc609ad46670`, package pin `bun@1.3.14`, actual Bun `1.3.11`, and SQLite `3.43.2`. The governed checkout transfers the artifacts rather than the scratch Git history, so AUT-533 is the durable provenance anchor. The host was an Apple M4 Max with 16 logical CPUs and 48 GiB of memory. The completed process took 995,049.950 ms wall time and reached 591,757,312 bytes—564.34 MiB—maximum resident memory. These provenance fields, not a rounded anecdote, let another reviewer decide whether a comparison is meaningful; see `docs/evidence/store-1m.json`.

The run inserts 1,000,000 scale pages plus two foundation pages, with 4,000,008 slot rows and 1,300,004 tag memberships. Its five classes include 500,001 chain and 500,001 independent pages, 200,001 fast-food pages, 100,000 generic fast-food pages, 50,001 McDonald’s pages, 50,000 Burger Kings, and 300,000 chain/non-fast-food pages. The seed takes 69,115.674 ms. Replaying it takes 188.719 ms, inserts zero pages, and preserves identity and counts. Schema version 6 passes integrity with zero foreign-key violations.

Publishing all 1,000,002 pages takes 594,347.476 ms, or 1,682.52 documents per second locally. An identical republish takes 262,674.584 ms, retains the publication and input hash, and adds no page rows. Five manifests serve every page; 999,997 pages reuse a structure. That is a 99.999500001% deduplication ratio, with 4,000,008 logical placements represented by 20 stored items. Canonical structure is 828,401,621 logical bytes versus 4,214 stored bytes, a difference of 828,397,407. Fully expanded rendered documents total 1,143,681,174 bytes, while the manifest-plus-page estimate is 862,480,639. SQLite nevertheless allocates 1,310,748,672 publication bytes and ends at 3,205,939,200 bytes—2.986 GiB.

The read measurements describe local, hot-cache behavior only. Canonical lookup p50/p95 is 0.007667/0.009417 ms. Manifest reconstruction uses two fixed SQL statements and zero selectors at 0.164250/0.304500 ms p50/p95. The expanded fixture uses one statement and zero selectors at 0.014292/0.019500 ms. The benchmark report at `docs/benchmarks.md` explicitly refuses to turn these values into a production service-level objective.

> **Open decision** — TiDB must compare manifest, expanded, and hybrid payloads with real cache behavior, context sizes, compression, secondary indexes, Region distribution, and hot keys. Local SQLite throughput and latency settle none of those production choices.

In the HUD, select a McDonald’s point and inspect how three sparse layers contribute three different placements while `navigation` remains inherited. Then select another McDonald’s point: the manifest stays shared, but interpolated hero text and the document hash change. The one-minute media should narrate those stable and changing fields explicitly, then zoom out from 1,002 to 1,000,002 pages without implying that tile area represents cardinality. The authoring controls used later are implemented in `apps/cms/src/components/sqlite-authoring-workbench.tsx`; the generic scenario and evidence path is documented by `docs/benchmarks.md`.

> **Digest prompt:** Write one sentence for each of these claims: “structural reuse is real,” “physical database savings are not equal to the logical ratio,” and “the timings are not an SLO.” Include at least one exact measured value in each sentence.

## 4.3 Structural type replacement

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Demonstrate that placement identity survives a block-type change, distinguish replacement from hiding and reverting, and verify sparse inheritance and rollback with hashes and provenance.

The third proof changes the kind of mutation. Eligible Vehicles stressed dense intersections; Stores stressed sparse classification at scale. Structural replacement asks whether a variant can change the schema and renderer at one conceptual document position without cloning the rest of the document or corrupting history. The stable placement is `primary-hero`. The default points it to a block version of type `hero`; the matched variant points the same placement to a new immutable version of type `hero_alt`. The placement key—not the array index, lineage name, or type—is the address that resolution preserves.

The standalone proof route is `http://localhost:3001/en-US/airport/hero-alt`. Its compact-seed publication is `editable-structural-publication-1`, and its document hash is `8acac69732ee309e319332a5d65a0a5a3c7f5cacdc23e0c26c15baa9420592a2`. The synchronous registry receives the same `primary-hero` key but selects the `hero_alt` renderer from the published block type. This is the browser-visible proof that placement identity and renderer type are independent.

This distinction allows the editor and compiler to tell a coherent story. A content edit within the same type creates another immutable version in the appropriate lineage. A type replacement validates a new payload against the new block-type schema and creates a version whose renderer contract is `hero_alt`. The old `hero` payload is not silently accepted by `hero_alt`; the schemas are deliberately different, and the replacement proof rejects the incompatible content. Published block versions remain untouched. The variant contributes a sparse `set` operation at `primary-hero`, and every unrelated placement continues to point to its lower-layer winner.

The same variant also demonstrates absence. It adds a tombstone for `announcement-promo`. Resolution records the lower placement in the trace but omits it from the effective document. A tombstone is a local decision: “keep this inherited placement hidden here.” It is not the same as reverting. Reverting the hero removes the variant’s local hero operation in a new revision, which reveals the default `hero` again; the promo tombstone remains because that separate local decision still exists. The prototype therefore supports three distinct editorial acts—replace, hide, and revert—without deleting immutable history.

> **Requirement** — Stable placement keys survive reordering, content versions, and block-type replacement. Hiding creates a tombstone; reverting removes the local decision and restores inheritance. Published versions and prior revisions are immutable.

The measured scenario begins with 24 default placements and resolves to 23 visible placements. Two sparse operations affect the matched page: the hero replacement and promo tombstone. Twenty-two block pointers remain unchanged, yielding `22/24`, or 91.67%, inheritance. The stable `primary-hero` address changes from `hero` to `hero_alt`; `announcement-promo` is absent from the visible document but present in the trace as hidden. An unmatched page still receives the original `hero`, proving that the change is selector-scoped rather than a mutation of the default.

The persisted proof gives this sparse story a publication boundary. It creates one new variant block version and keeps two active sparse operations. Across the scenario, there are two domain publication pages, two domain manifests, and 47 domain items. The persisted state records two publications, four page documents, two manifests, and 47 manifest items, adding 20,480 allocated database bytes. Rollback moves the current pointer to the retained baseline publication and restores its exact document hash. It does not reconstruct a plausible prior state by undoing rows.

> **Prototype choice** — The SQLite service represents type replacement as a new typed immutable block version plus a `set` operation at the existing placement key. Tombstones and reverts become new variant revisions rather than destructive updates.
>
> **Measured finding** — 24 default placements become 23 effective placements; 22 pointers remain unchanged (`91.67%` inheritance); `primary-hero` changes `hero` → `hero_alt`; two sparse operations are active; persisted rollback restores the baseline hash; publication adds 20,480 allocated bytes.
>
> **Open decision** — Production still needs a policy for block-schema evolution, renderer compatibility, editorial approval, and cache invalidation when a type contract changes. TiDB must also prove that immutable-version and same-template constraints remain enforceable through DDL, service permissions, and audits.

Use the HUD to make the difference visible. Open the Structural map, select the matched point, and inspect the Document tab. The visible count should be 23, the type label for `primary-hero` should be `hero_alt`, and the pin should show 22 inherited winners plus the local decisions. In Block authoring, change the variant scope and compare Hide with Revert: Hide creates the tombstone; Revert removes the current draft’s local operation. The mutation commands cross the server-function boundary in `apps/cms/src/server-functions/cms.functions.ts`, execute through `apps/cms/src/server/sqlite-authoring.server.ts`, and are rendered by `apps/cms/src/components/sqlite-authoring-workbench.tsx`.

The one-minute media should use shape as well as labels: keep a fixed slot outline named `primary-hero`, remove a rectangular `hero` card, and insert a visibly different but equally bounded `hero_alt` card. Next, place a crossed-out marker over `announcement-promo`; then show hero Revert removing only the local hero card while the crossed-out marker remains. A textual transcript should state the counts—24 default, 23 visible, 22 unchanged—and finish with rollback selecting the exact baseline hash.

The result is more than a UI trick. Because manifests store placement key, ordinal, block-version pointer, winning revision, operation, and priority, the serving document remains explainable after the type changes. A renderer can dispatch on the immutable block type while editorial review can trace why that type won. The scenario’s authoritative measurements are in `docs/benchmarks.md` and `docs/evidence/bounded-report.json`; the migration consequences are recorded in `docs/adr/0001-tidb-materialization.md`.

> **Digest prompt:** Describe the final state after the hero has been reverted but the promo has not. Name the visible hero type, the status of `announcement-promo`, and why neither result requires updating or deleting an old block version.

## 4.4 Compare the three shapes

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Select the correct evidence from each scenario, compare their variation distributions without conflating metrics, and identify which architectural claims are invariant versus workload-dependent.

The three scenarios are deliberately unlike one another. Together they form a small test matrix for one architecture, not three bespoke implementations. Eligible Vehicles asks what happens when many layers overlap and every page is structurally distinct. Stores asks what happens when a million pages mostly inherit and a few tag-selected operations create five repeated structures. Structural replacement asks whether a sparse overlay can change a block’s schema and visibility while retaining stable addresses and history. The same template boundary, selector safety rules, deterministic fold, immutable versions, publication pointer, and provenance model must survive all three.

| Shape | Public proof route | Rendered shape | Headline evidence | What it does **not** prove |
| --- | --- | --- | --- | --- |
| Dense Eligible Vehicles | `/en-US/eligible-vehicles/ca/premium` | Seven placements combine dense regional winners into one ordered page | 24 pages, 24 manifests, 168/168 placements, conflict at `legal-notice` priority `60` | That manifests reduce storage for every template |
| Sparse Stores | `/en-US/store/1001` | Shared structure plus page context renders brand hero, category promo, and footer | 1,000,002 pages, five manifests, 999,997 reused pages, zero selectors on serve | A TiDB latency SLO or an end-to-end physical byte saving |
| Structural replacement | `/en-US/airport/hero-alt` | The stable `primary-hero` placement dispatches to `hero_alt` while siblings inherit | `hero` → `hero_alt`, 22/24 unchanged pointers, 91.67% inheritance, exact-hash rollback | A complete production block-schema governance policy |

Start with what is invariant. One canonical URL maps to one template and one page instance. Every template owns exactly one default; variants never cross that boundary. Selectors operate on approved fields, and author literals are bound parameters. A matched layer contributes sparse operations to placement keys. Explicit priority is the only legal precedence input, and a same-priority same-placement collision fails. Publication writes an immutable, content-addressed result and moves a current pointer atomically. Camo remains the route existence and status authority during the transition. Serving reads publication state and executes zero selectors. These requirements are stated in `AGENTS.md` and expanded in `docs/process-engineering-guide.md`.

Now separate the workload-dependent findings. Dense Eligible produces no structural reuse: 22,024 canonical bytes are both logical and stored. Sparse Store produces dramatic structural reuse: at one million, 828,401,621 canonical bytes become 4,214 stored structure bytes, and 4,000,008 logical placements become 20 manifest items. Structural replacement is primarily an inheritance metric: 22 of 24 pointers remain unchanged. None of those ratios can be transferred to another template without measuring its distribution, content size, interpolation context, and serving behavior.

> **Requirement** — Correctness cannot depend on whether a template is dense, sparse, small, large, content-only, or structurally varied. The same inputs must yield byte-stable hashes and provenance independent of database row order.
>
> **Prototype choice** — All three proofs run through the shared domain and service paths, with SQLite-specific migrations, transactions, and evidence runners isolated behind repository boundaries.
>
> **Measured finding** — Dense variation yields zero manifest reuse; sparse Store yields 99.999500001% reused pages at one million; structural replacement yields 91.67% inherited default pointers. These percentages measure different denominators and must never be added or ranked as one score.
>
> **Open decision** — Production must choose payload shape, publication chunking, caching, partitioning, schema governance, and incremental invalidation from workload-specific TiDB proofs—not from whichever prototype ratio looks most impressive.

The comparison also clarifies what “scale” means. Eligible has only 24 pages but is combinatorially difficult because 17 variants create 100 matches and exact intersections can override every placement. Store has 1,000,002 pages but only five effective structural classes. Structural has 24 default placements but tests two semantic operations that could break long-lived content identity. Page count, selector density, unique manifests, block-schema diversity, and write volume are independent axes. A useful architecture review names the axis under discussion instead of using “complex” as a catch-all.

Evidence discipline matters just as much. `docs/benchmarks.md` is the readable index; `docs/evidence/bounded-report.json` and `docs/evidence/store-1m.json` are the machine-readable envelopes. Every local time records a commit, lock digest, runtime, host, and invocation. The Store publication’s 1,682.52 local documents per second and sub-millisecond hot-cache reads describe one run, not a promise to production users. Likewise, saving repeated canonical structure does not mean SQLite allocated fewer bytes overall: at bounded scale its 1,294,336-byte publication delta exceeds the logical estimates.

The rendered comparison has one more invariant: all three pages travel through the same `PublishedDocumentSchema` and synchronous registry. `navigation`, `hero`, `hero_alt`, `promo`, and `footer` are ordinary registered block types, and stable placement keys remain the list identity. An unknown type produces a visible unsupported-block panel, so a missing renderer cannot turn a valid publication placement into silent data loss. This registry is deliberately smaller than the authoring model; it consumes only the immutable publication contract.

The one-minute comparison media should present a table or three aligned lanes, not three differently sized geographic maps. Each lane should narrate the same checkpoints: inputs, matching layers, effective placements, publication artifact, and request read. Provide numeric text alongside any bars. Dense ends with 24 distinct manifest hashes; sparse fans 1,000,002 page pointers into five manifest hashes; structural keeps one `primary-hero` placement while its type label changes. A transcript should explicitly say that the three reuse percentages have different denominators.

This comparison prepares you to operate the HUD. You now know which observations are semantic and which are measurements. On the Wall of Maps, the cards and metrics are entry points into these shapes, not a scoreboard. Once inside a template, the projection, layer stack, resolution pin, document, authoring controls, and publication history expose the same pipeline at different stages. Their component boundaries are visible in `apps/cms/src/components/wall-of-maps.tsx`, `apps/cms/src/components/template-workspace.tsx`, and `apps/cms/src/components/publication-inspection.tsx`.

> **Digest prompt:** For a proposed fourth template, list the minimum measurements needed before choosing structural manifests, expanded payloads, or a hybrid. Include at least one variation metric, one logical-byte metric, one physical-allocation metric, one read-shape metric, and one provenance check.

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
> **Prototype choice** — The root UI renders three deterministic scenario fixtures and uses client-side TanStack Query state for search and pagination. It labels those cards as demo fixtures while linking into server-backed workspaces.
>
> **Measured finding** — The required proof set contains all three shapes already examined: 24 dense Eligible pages, 1,000,002 pages in the committed Store stress envelope, and 91.67% default-pointer inheritance in Structural replacement. The card scale cues summarize these shapes; `docs/benchmarks.md` remains the evidence source.
>
> **Open decision** — A production wall still needs product policy for discovery, permissions, ownership, freshness, and which health or publication metrics belong on a global index. The prototype does not establish a cross-template ranking or operational dashboard.

At the bottom, use the “Relational legend · how to read this prototype” before opening a map if any term is unfamiliar. Its definition list distinguishes Template, Point, Selector sheet, Resolution pin, and Projection. Because the legend is structured as terms and definitions, it remains usable without icon recognition. A projection is a selectable two-axis view of higher-dimensional data; it is not the complete template. A resolution pin explains one point; it is not a stored route-tree path. Those distinctions will determine how you interpret the workspace in the next section.

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
> **Prototype choice** — The HUD resolves deterministic fixture points in the browser for the explanatory projection while its Block authoring tab displays live server-backed SQLite state. The two surfaces are labeled and kept conceptually separate.
>
> **Measured finding** — Store’s bounded selectors match exactly 501 chain, 201 fast-food, 50 Burger King, and 51 McDonald’s pages. Structural exposes 23 visible placements, one tombstone, one `hero_alt`, and 22 inherited pointers. Eligible’s exact-intersection page has provenance for all seven winners.

Switch to **Selector SQL** to inspect the authored expression, normalized form, parameters, match count, and plan cue. Values must remain parameters, and identifiers must come from a template-owned allowlist. The SQL is allowed during bounded preview and publication only. The panel says this explicitly: public requests read the immutable manifest. Use **Draft diff** last to compare the current preview with the publication rather than treating unsaved or unpublished intent as live content.

The pin also crosses the Camo–Auteur seam. Camo supplies lifecycle status; Auteur supplies publication availability. A `live` route with a published document yields `200`. `not_live` and `archived` yield `404`. A `live` route missing an active Auteur document is an unsafe state and yields `503`, not a silent empty page. These outcomes appear as text in the pin, not color alone. Their transition contract is described in `docs/process-engineering-guide.md` and implemented in the service path at `packages/cms-service/src/cms-service.ts`.

> **Open decision** — Production must define how stale Camo revisions, mid-build status changes, tag freshness, and author permissions appear in this trace. It must also decide whether `not_live` pages are precompiled, retained, or omitted; the current `404` behavior does not settle publication policy.

The one-minute media should select one McDonald’s point and narrate the pin top to bottom. Highlight the three matched non-default layers, then read the four final placement sources. Switch to Selector SQL long enough to say “preview/publication only,” and finish on the Camo/Auteur outcome. Every animated highlight needs a spoken label and persistent focus indicator; provide a transcript with the canonical URL and priority sequence.

> **Digest prompt:** For a selected page that returns `503`, write the two facts the pin must show. Then explain why changing selector priority cannot repair a missing active publication on the public request path.

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

> **Prototype choice** — Each authoring command runs in a SQLite transaction, creates immutable revisions and versions, then re-resolves the sample workspace. If resolution reports a conflict, the mutation is rolled back rather than leaving a broken draft partially persisted.
>
> **Measured finding** — The structural workflow proves one new variant block version, two active sparse operations, 22 unchanged pointers, one tombstone, and an exact restoration of the inherited hero after revert. Store mutation tests prove a fast-food promo change reaches both named brands while a McDonald’s hero edit leaves Burger King and default unchanged.

Use priority and selector changes carefully. A priority edit affects every page matching the layer and can expose a same-priority same-placement conflict elsewhere. A selector revision can change its entire match set. The HUD’s bounded point is useful feedback, but publication is the authority because it evaluates every eligible page and rejects conflicts atomically. Tests in `apps/cms/src/server/sqlite-authoring.server.test.ts` cover command validation, transactions, and rollback of conflicting changes; domain and service suites provide the broader invariant proof listed in `docs/benchmarks.md`.

> **Open decision** — Production needs roles, approvals, audit retention, content review, tag-ownership conflict policy, and safe handling for high-impact selector or priority edits. The prototype proves CRUD semantics, not who may perform each operation or when a draft is eligible to publish.

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
> **Prototype choice** — The local SQLite service performs the bounded write and pointer activation transactionally. The inspection page combines clearly labeled scenario communication cards with live server-function actions.
>
> **Measured finding** — Dense conflict injection leaves no failed publication rows; Store and Structural failure proofs retain the prior pointer; persisted Structural rollback restores the exact baseline hash. The million Store identical republish adds no page rows and keeps the same publication/input hash.

Inspect the **Camo Press → Auteur request trace** before rollback. Choose each request case and read the owner, status, publication lookup, and outcome. A `live` Camo route plus an active Auteur page produces `200`. `not_live` or `archived` produces `404`. A `live` route with no active document produces `503`, exposing unsafe drift instead of returning invented content. The trace is a serving explanation: it never runs selector SQL and never invokes Louvre `multiResolve` for Auteur-managed content.

Now verify the same boundary in the two-app interface. Keep `apps/cms` on `http://localhost:3000` and `apps/website` on `http://localhost:3001`, then use the Store route as a controlled comparison:

1. Open `/en-US/store/1001` in the website. It must report published, non-editable state and the active publication hash.
2. Open `/en-US/store/1001?edit_mode=true`. It must return the same published state and hash. The public route's empty search validator means the query cannot elevate the request.
3. Make and save an authoring change without publishing it, then open `/cms-preview_/en-US/store/1001`. The explicit preview must show the draft resolution, matched variants, tombstones, and authoring provenance through the shared renderers while the two public URLs continue to show the old publication.
4. Inspect the preview response for `Cache-Control: private, no-store` and `X-Robots-Tag: noindex, nofollow, noarchive`. The HTML metadata carries the same noindex intent.
5. Open `/admin`. A configured, valid `CMS_ADMIN_ORIGIN` exposes one direct handoff link; missing or malformed production configuration fails closed with an actionable message. The website does not proxy arbitrary paths, embed the CMS in an iframe, or invent `/api/auth` behavior.

Local development permits the explicit preview route. A non-development proof environment must opt in with `CMS_ENABLE_PREVIEW=true` and, only for local-host browser evidence, `CMS_ALLOW_LOCAL_PREVIEW_HOST=true`. Those flags expose a prototype lane; they do not provide user authentication. The public application has an analogous local-host proof switch, but its route still opens SQLite read-only and calls only `CmsService.serve`.

To roll back, open **Preview rollback**. The panel names `workspace.rollbackPublicationId`, the actual retained predecessor. Confirm that it is present and that the expected current publication has not changed. **Confirm rollback** repoints serving to that immutable namespace; no publication page or manifest row is rewritten. After the mutation, verify the active ID and document hash in both the workspace and publication route. The former current publication remains history and can support investigation or a later explicit action.

> **Open decision** — Production must define rollback authorization, retention windows, cleanup, concurrent activation behavior, stale Camo-revision policy, and incident audit requirements. The accepted ADR proposes a compare-and-swap pointer transaction, but TiDB failure, retry, and reader-visibility behavior still requires `TIDB-MAT-01` and `TIDB-CAMO-07`.

The server boundary is part of the safety story. TanStack `createServerFn` endpoints validate command shapes; browser code never imports `bun:sqlite` or a database client. Cross-site request protections and service validation run before the transactional command. The backend path in `apps/cms/src/server/sqlite-authoring.server.ts` delegates to the shared compiler in `packages/cms-service/src/cms-service.ts`, so the HUD does not have a weaker publication implementation than the tests. Website public and preview loaders likewise cross server functions, but only the explicitly named preview function may call draft resolution.

The one-minute media should show a hash-centered workflow. Capture the active ID and hash, preview and confirm publication, verify the new ID/hash and retained predecessor, then preview and confirm rollback. End with the original hash restored. Narrate which cards are illustrative and which line is live persisted state. Provide captions for status changes, and do not use a green/red transition as the only signal of success or failure.

> **Digest prompt:** You lose the network response immediately after confirming publication. Describe the safe verification sequence across the CMS, public route, `edit_mode` query, explicit preview, and active hash before retrying, and explain why neither a draft preview nor a blind second activation proves which publication became current.

# Chapter 6 — Interpret tradeoffs and unfinished production work

*Evidence → decisions*

## 6.1 Expanded payloads versus manifests

> **Estimated time:** Read 5 min · Media 1 min · Digest 3 min
> **Learning outcome:** Compare expanded and manifest serving shapes with the correct logical, physical, and read-path measures, then recommend a hybrid only as an evidence-gated production option.

Publication can store a page in two useful shapes. An expanded row contains the page’s complete rendered document, making a request close to one indexed lookup. A structural manifest stores the ordered placement keys, immutable block-version pointers, and winning provenance once, while each page points to that structure and retains its own context and hash. The request reconstructs the document from the page pointer and manifest. Both shapes obey the same non-negotiable rule: selectors have already run before serving.

The scenarios show why this is a distribution-dependent choice. Dense Eligible Vehicles produces 24 pages and 24 manifests. Its seven placements per document yield 168 logical and 168 stored items; canonical structure is 22,024 bytes either way. Here, manifest indirection preserves content addressing and provenance but removes no repeated structure. A fully expanded hot payload may be attractive because there is nothing structural to share. That is a hypothesis for production measurement, not a conclusion from the bounded fixture.

Sparse Store provides the opposite input. At bounded scale, 1,002 pages collapse to five manifests. Its 4,008 logical placement rows become 20 stored items, and 830,021 canonical structure bytes become 4,214. That removes 825,807 repeated canonical bytes. Yet expanded rendered documents total 1,142,964 logical bytes, the manifest-plus-page estimate is 858,229, and actual SQLite allocation grows by 1,294,336. The physical database includes page context, immutable JSON, indexes, table pages, and allocator overhead that the structural ratio does not count.

At one million scale, the structural pattern is unmistakable: 1,000,002 pages still use five manifests, so 999,997 pages reuse one. There are 4,000,008 logical placements and 20 stored items. Canonical structure is 828,401,621 logical bytes versus 4,214 stored, removing 828,397,407 repeated bytes. Fully expanded rendered documents total 1,143,681,174 bytes; the manifest-plus-page estimate is 862,480,639. Actual publication allocation is 1,310,748,672 bytes, and the database ends at 3,205,939,200 bytes. Structural sharing is real; an end-to-end physical saving equal to 99.999500001% is not.

> **Requirement** — Every canonical URL resolves to one immutable effective result with a stable hash and provenance, and the public request path executes zero selector statements regardless of storage shape.
>
> **Prototype choice** — The baseline stores content-addressed structural manifests plus per-page context and document hashes. A separate expanded fixture proves the one-query read shape, preserving a hybrid option.
>
> **Measured finding** — Million-scale manifest reconstruction uses two fixed SQL statements and zero selectors at 0.164250/0.304500 ms p50/p95 locally. The expanded fixture uses one statement and zero selectors at 0.014292/0.019500 ms. Canonical lookup is 0.007667/0.009417 ms. These hot-cache SQLite timings compare shapes; they are not production SLOs.

The manifest hash intentionally excludes interpolation values that vary by page. Two McDonald’s pages can therefore share the same `primary-hero` block pointer and manifest while their store names produce different rendered hero text and document hashes. This improves structural reuse but means the serving system must apply deterministic interpolation or cache the expanded result with the correct context dependency. A manifest hit alone is not a complete rendered-page hit.

Read complexity is equally concrete. The structural path needs one current-publication/page lookup and one ordered manifest/block lookup before caches. An expanded serving row can be one query. Manifests create two cacheable identities—a page pointer/context and a shared structure—while expansion creates a larger page-specific object. Compression, cache key design, eviction, context size, network transfer, renderer cost, secondary indexes, and update amplification can reverse a result that looks obvious from canonical bytes alone.

> **Open decision** — `TIDB-STO-04` must compare fully expanded, manifest-only, and hybrid rows using real block/context distributions, compression, cache behavior, write amplification, and read latency. Dense and sparse templates may legitimately choose different hot-serving representations while retaining one publication contract.

The accepted direction in `docs/adr/0001-tidb-materialization.md` therefore keeps `expanded_payload_json` optional on `published_pages`. The evidence ledger is `docs/benchmarks.md`, with raw values in `docs/evidence/bounded-report.json` and `docs/evidence/store-1m.json`. A reviewer should request all three layers of evidence: logical structure, actual allocated storage, and request behavior. Reporting only the most favorable ratio is not architecture work.

The one-minute media should present three labeled columns—logical structure, physical allocation, request reads—and move each scenario’s numbers into the proper column. Use text and spoken values, not proportional bars alone. End with two page arrows sharing one Store manifest but carrying different context and document hashes, then show the optional expanded payload as a measured cache/output choice rather than a replacement for immutable publication identity.

> **Digest prompt:** Recommend a serving shape for dense Eligible and sparse Store separately. For each recommendation, cite one exact byte result, one request-shape fact, and one measurement still required before production approval.

## 6.2 Full rebuild versus production publication

> **Estimated time:** Read 6 min · Media 1 min · Digest 3 min
> **Learning outcome:** Explain why a full-template rebuild remains the correctness oracle while production publication uses resumable hidden chunks and a short compare-and-swap activation transaction.

The SQLite prototype compiles a whole template because complete recomputation is the clearest correctness baseline. Given one authoring snapshot, it evaluates approved selectors, detects conflicts, resolves every eligible page, canonicalizes manifests and hashes, writes immutable rows, and activates the result atomically. At one million scale that generic path completed in 594,347.476 ms at a measured local 1,682.52 documents per second. An identical-input compile took 262,674.584 ms, returned the same publication ID and input hash, reproduced 1,143,681,174 expanded logical bytes, and added no page-document rows. This proves executability and idempotency on the recorded host, not a distributed publication SLO.

Production cannot simply wrap the million-page write in one huge transaction. The accepted analysis in `docs/adr/0001-tidb-materialization.md` rechecked TiDB Self-Managed v8.5 documentation on 2026-08-29: ordinary views are virtual, materialized views are unsupported for the assumed contract, and the documented default total transaction limit is 100 MB, configurable with memory consequences. Auteur therefore owns publication tables and refresh lifecycle. Database-side set operations such as `INSERT … SELECT` may help, but they do not own snapshot choice, selector validation, conflict policy, retry, sealing, activation, or rollback.

The production protocol separates building from visibility. First, create a `publication_run` identified by template, canonical input hash, compiler version, route revision, and immutable snapshot metadata. Then compile deterministic page-key ranges into a hidden `publication_id` namespace. Each chunk transaction inserts or verifies rows whose keys include that ID, appends a checkpoint event, and can be retried idempotently. If an existing key has a different hash, the run fails as corruption rather than overwriting it.

After all chunks arrive, validation recomputes page and manifest counts, rejects duplicate canonical URLs or placement keys, checks winner provenance, confirms the intended Camo route revision and authoring snapshot, and samples full hashes. Only a validated run can activate. Activation is a short compare-and-swap transaction on the template’s single current-publication pointer: update from the expected previous ID to the new ID and require exactly one affected row. Readers see either the former complete namespace or the new complete namespace, never a mixture. Rollback performs the same bounded pointer operation to a retained validated predecessor.

> **Requirement** — Partial publications are invisible; activation and rollback are atomic and independent of page cardinality; retries cannot create competing results for identical inputs; failed conflicts and writes leave the current pointer unchanged.
>
> **Prototype choice** — Local SQLite uses a full bounded transaction and current pointer. The repository ADR translates that invariant into an application-orchestrated TiDB protocol rather than claiming the local mechanism ports unchanged.
>
> **Measured finding** — The one-million full rebuild completed with 1,000,002 pages, five manifests, 564.34 MiB maximum resident memory, and a 2.986 GiB final SQLite database. Bounded failure injection and rollback prove pointer behavior; million-scale TiDB chunks and reader visibility remain unmeasured.

The proposed serving schema makes that lifecycle explicit. `canonical_routes` records Camo-owned domain/path identity and revision. `publication_runs` carries input identity, build state, chunks, and validation. `publication_manifests` and `publication_manifest_items` retain shared structure and winner provenance. `published_pages` maps each canonical page to a manifest, context, document hash, and optional expanded payload within a publication namespace. `current_publications` is the one-row activation pointer. `publication_events` records start, chunk, validation, activation, rollback, and failure observations. The detailed column and key proposal is in `docs/adr/0001-tidb-materialization.md`.

Incremental publication comes later. A full rebuild is the oracle because it has no hidden dependency omissions. An incremental compiler must capture selector fields and tags, old and new match sets, placement overlap, interpolation paths, block-version references, route revisions, schema/compiler versions, and inheritance. Every incremental result must be byte-identical to a full rebuild in pages, manifests, hashes, and provenance. If dependency information is absent or ambiguous, the safe fallback is the whole template.

> **Open decision** — Chunk size, concurrency, retry backoff, database-side set-operation boundaries, snapshot isolation, retention, cleanup, partitioning, hot-key mitigation, and activation permissions require the named TiDB spikes. Incremental mode remains blocked on `TIDB-INV-05` equivalence evidence.

The one-minute media should animate two lanes. The first is a full rebuild labeled “correctness oracle.” The second writes three deterministic chunks into a hidden namespace, retries the middle chunk with matching hashes, validates the whole set, and moves one pointer. During every build frame, a reader arrow must continue to the old publication. Only after the pointer move should it reach the new one. Include a transcript and label the 100 MB figure as a documented default reviewed in the ADR, not a measured prototype limit.

> **Digest prompt:** A chunk worker dies after writing half a publication. Describe what is retained, what remains publicly visible, how the worker resumes, which validation gates run, and the exact condition required for activation.

## 6.3 Explicitly unresolved policies

> **Estimated time:** Read 5 min · Media 0 min · Digest 3 min
> **Learning outcome:** Maintain an explicit production decision ledger that separates established invariants and prototype behavior from policies that need owners, evidence, and approval.

A prototype becomes dangerous when its convenient behavior is mistaken for settled policy. Auteur avoids that by carrying unresolved questions as named decisions. The process guide’s four labels are not decorative; they tell a reviewer what may safely carry forward. **Requirement** names an invariant. **Prototype choice** names a local implementation. **Measured finding** names reproducible evidence with provenance. **Open decision** names work that remains. If a sentence cannot be assigned one of those labels, its authority is unclear.

The route seam is the first policy group. Camo remains authoritative for canonical route identity and `live`, `not_live`, or `archived` state. The prototype serves `200` for `live`, `404` for `not_live` and `archived`, and `503` for an unsafe live route with no active Auteur document. It also records the route revision used at publication. Production must still decide whether `not_live` pages are precompiled, retained from an earlier publication, or omitted; what happens when Camo changes status or canonical URL during a build; whether a stale revision blocks activation or only serving; and who may reactivate an archived route. `TIDB-CAMO-07` owns that proof.

Editorial routing is a separate policy group. The prototype borrows the explicit `/cms-preview_/*` and admin topology from Median and Profound, but only as an interface boundary. Preview is no-store/noindex and disabled in production unless explicitly enabled, yet it has no production identity, session, role, or authorization layer. `/admin` validates one HTTP(S) origin with no credentials, path, query, or hash and fails closed when production configuration is absent or invalid. That makes it safer than a blind redirect, but it is still only a handoff link—not the authenticated reverse proxy, cookie policy, or deployment contract a production hybrid CMS requires.

Classification is the next group. Tags are explicit, template-scoped many-to-many memberships with a source such as `pipeline`, `author`, or `seed`; no hierarchy is inferred from naming. The unresolved policy is who owns each namespace, how freshness is measured, whether author and pipeline assignments can conflict, which source wins, and how a stale or corrected tag invalidates affected pages. Store demonstrates mutation isolation—removing a fast-food tag leaves brand and store-type membership—but it does not define organizational ownership.

| Decision area | Established baseline | Production evidence or policy still needed |
| --- | --- | --- |
| Route lifecycle | Camo owns identity/status; Auteur records compiled revision | `not_live` materialization, drift, archived reactivation, mid-build changes |
| Preview and admin access | Explicit no-store/noindex preview; validated `CMS_ADMIN_ORIGIN`; public query cannot elevate | Authentication, authorization, session/cookie boundaries, CSP, trusted-host handling, deployment ownership |
| Tag ownership | Explicit membership and source; no hidden hierarchy | Namespace owner, freshness objective, source conflict and override rules |
| Payload shape | One immutable result; zero selectors on serve | Expanded/manifest/hybrid by measured cache, bytes, and latency |
| Publication mode | Full rebuild is correctness oracle | Complete dependencies and byte-equivalent incremental results |
| Physical layout | Template scope and canonical uniqueness are mandatory | TiDB Region distribution, partitions, global indexes, hot keys |
| Governance | Immutable history and rollback target exist | Roles, approvals, audit retention, rollback authorization, cleanup |

> **Requirement** — Uncertainty may change an implementation plan, but it may not weaken canonical identity, one default per template, explicit priority, selector safety, immutability, provenance, atomic activation, rollback, or selector-free serving.

Storage and computation require separate decisions. `TIDB-STO-04` must choose expanded, manifest, or hybrid serving rows from real cache and compression evidence. `TIDB-INV-05` must prove incremental equivalence for every mutation type in the ADR’s invalidation matrix. Slot and tag storage may remain normalized or gain measured derived/wide read surfaces for hot dimensions, but the authoritative relation and template isolation must stay explicit. Interpolation may happen at publish time, render time, or in a hybrid; its semantics and dependencies must be versioned either way.

Physical TiDB design is not a mechanical Drizzle migration. The selected version must be verified for checks, foreign keys, JSON, partial-unique alternatives, triggers, partitioned uniqueness, and global indexes. The initial proof uses ordinary tables and measures before partitioning. A large or skewed template can create Region or hot-key pressure even when aggregate row counts look acceptable. `TIDB-SEL-02`, `TIDB-IDX-03`, and `TIDB-CON-06` turn these assumptions into named experiments.

Editorial governance is also unfinished product work. Who may enter preview, follow the admin handoff, create a high-priority selector, change a default inherited by every page, replace a renderer contract, publish, or roll back? Which changes require review? How long are failed builds and former publications retained? What author content may appear in diagnostics? The ADR requires useful run, chunk, conflict, validation, pointer, and actor observability while prohibiting unrestricted author content or page context in logs. The local HUD and website prove route isolation and operations, not their authorization model.

> **Prototype choice** — The repository records open items in `docs/process-engineering-guide.md` and makes the accepted technical direction and proof spikes explicit in `docs/adr/0001-tidb-materialization.md`. Linear remains the planning source of truth.
>
> **Measured finding** — The current prototype has enough evidence to expose the tradeoffs: dense zero reuse, sparse 99.999500001% page reuse, 91.67% structural inheritance, bounded failure/rollback proofs, and a completed million-page SQLite run. None resolves ownership or distributed-database policy by itself.
>
> **Open decision** — Every item in the ledger needs an accountable owner, chosen option, decision date, required evidence, rollback/revisit condition, and link to its Linear issue. “Use the prototype behavior” is not an acceptable default rationale. In particular, `CMS_ENABLE_PREVIEW=true` is a proof switch, not permission to expose drafts on the public internet.

There is no media allocation for this section. Make the ledger itself accessible: use real table headers, concise language, text status in addition to color, and links to evidence. During review, read unresolved rows aloud rather than skipping them as caveats. A visible open decision is evidence of engineering control, not failure to finish.

> **Digest prompt:** Choose one row from the ledger and write a decision record stub with owner, options, required proof, invariant guardrails, decision deadline, and a condition that would reopen the choice.

## 6.4 Architecture review and handoff

> **Estimated time:** Read 5 min · Media 0 min · Digest 4 min
> **Learning outcome:** Conduct a traceable architecture review, distinguish prototype completion from production readiness, and hand off the implementation with exact Linear, test, benchmark, browser, and open-decision evidence.

A strong handoff lets another person reconstruct the argument without trusting the presenter. Start with scope: the CMS project in Linear is authoritative, beginning at `AUT-514`, and every substantive change maps to an issue and acceptance criteria. The current delivery slice is `AUT-534` through `AUT-536`: standalone published rendering, isolated preview/admin topology, and documentation alignment. `AGENTS.md` records the repository-wide contract and workflow. `docs/process-engineering-guide.md` explains the model and editorial operations. `docs/benchmarks.md` indexes correctness and scale evidence. `docs/evidence/bounded-report.json` and `docs/evidence/store-1m.json` preserve machine-readable provenance. `docs/adr/0001-tidb-materialization.md` states the accepted production direction and its blockers.

Review one vertical slice before reviewing totals. Choose a canonical URL. Confirm that Camo owns its identity and status, one template owns its page instance and default, and the page’s scalar slots and explicit tags are template-scoped. Inspect each matched selector revision and normalized hash. Fold operations by explicit priority, reject any same-priority write to the same placement, and record content and order winners. Confirm block schemas and immutable version pointers. Follow the page into a sealed publication, manifest, current pointer, and request result. The trace should contain no selector evaluation or Louvre `multiResolve` after activation.

Then answer the process guide’s review questions:

- Can every row in the trace be assigned to one template?
- Can the reviewer explain why Hide and Revert produce opposite outcomes?
- Can a block type change without changing the placement identity?
- Is explicit priority the only precedence input?
- Does every visible placement have one content source and one order source?
- Does a failed publication leave the former current pointer unchanged?
- Can a public request be traced without selector SQL or Louvre `multiResolve`?
- Does `?edit_mode=true` return the same publication as the query-free public URL?
- Is draft resolution reachable only through `/cms-preview_/*`, with no-store/noindex policy?
- Does `/admin` validate `CMS_ADMIN_ORIGIN` and fail closed instead of forwarding arbitrary input?
- Can every claim be identified as a **Requirement**, **Prototype choice**, **Measured finding**, or **Open decision**?

The automated gate supplies broad evidence after that human trace. Run `bun run five-phase-pass` from a clean implementation tree and report its exact test/assertion totals in the handoff rather than freezing them in prose that will drift as coverage grows. The gate verifies the frozen install, skill-import digest, schema-v6 reset and repeatable compact seed, migrations, Biome, TypeScript, database/domain/service/scenario tests, both TanStack applications, evidence envelopes, client/SSR/Nitro builds, Fallow, and cross-workspace boundaries.

The three newest issues add focused acceptance layers. `AUT-534` proves that the compact SQLite seed publishes all three patterns and that `apps/website` reads only active immutable documents through the strict `PublishedDocumentSchema` and synchronous registry. `AUT-535` proves public/draft isolation, including an unpublished edit visible on `/cms-preview_/*` but not on the canonical route or its `edit_mode` query, plus preview headers and the validated `/admin` gateway. `AUT-536` adds tutorial current-content assertions for these routes and contracts, then requires the full gate again.

> **Requirement** — A handoff names the Linear issue, acceptance criteria, validation performed, evidence provenance, known limitations, and accurate status. “Tests pass” cannot replace an invariant-by-invariant review.
>
> **Prototype choice** — The five-phase pass sequences shell and database foundation, relational model, resolution/publication, HUD/scenarios, and cross-workspace audit under Bun and Turborepo.
>
> **Measured finding** — The compact seed deterministically serves `/en-US/eligible-vehicles/ca/premium`, `/en-US/store/1001`, and `/en-US/airport/hero-alt` from their active publications. Focused browser evidence checks the gallery, all three public pages, explicit Store preview, the unchanged Store public page with `edit_mode=true`, `/admin`, response headers, missing-route behavior, and a clean console; the final handoff records the gate's current exact totals.

Browser evidence connects the suites to both an author’s and a reader’s experience. Store persists an authoring edit and preview shows it immediately, while `/en-US/store/1001` and `/en-US/store/1001?edit_mode=true` retain the former publication until activation. Eligible renders seven published placements at `/en-US/eligible-vehicles/ca/premium`. Structural renders `hero_alt` at the stable `primary-hero` key on `/en-US/airport/hero-alt` while unrelated placements remain inherited. The `/admin` state names whether its origin came from validated configuration or the local-development default; an unavailable production state provides no handoff link.

The tutorial audit rendered six native player instances from five distinct reviewed capture bundles: the three scenario proofs, Wall navigation, resolution-pin inspection, and one in-place Chapter 5 replay. Every instance exposed two source formats and one description track; all 65 rendered IDs were unique. Switching the Chapter 5 selector replaced its player in place, retained keyboard-visible pressed state, and left no backward scenario-player links. MP4/WebM probes, monotonic WebVTT timing, exact transcript text, byte counts, SHA-256 integrity, posters, and manifest/schema-state coherence remain checked by the media suite. The clips remain visibly labeled reviewed previews, while approved integration stays fail-closed until explicit final-capture and governed-release approval.

Do not overstate this closure. The clean local gate proves the prototype contract on its recorded environment. It does not prove TiDB throughput, distributed transactions, Region behavior, cache topology, production Camo traffic, operational ownership, or authorization for preview and admin access. The ADR’s seven spikes remain blockers: chunk/activation, selector plans, partition/global index, manifest storage, incremental equivalence, constraints/immutability, and the Camo revision seam. Local timing and allocation numbers remain **Measured finding**, never production SLO. Likewise, no-store/noindex and an environment flag are not substitutes for production authentication.

> **Open decision** — Production readiness depends on completing the named TiDB spikes and policy ledger, then updating Linear and the ADR with results. A prototype issue may be Done while those explicitly separate production issues remain open.

Use a consistent handoff paragraph for each issue: “`AUT-___` — acceptance result; files and migrations changed; focused checks; full-gate result; benchmark/evidence links; browser observation; remaining open decisions; final Linear status.” If Linear is unavailable or read-only, include the exact intended comment and status change rather than silently diverging. Mark Done only after acceptance passes; otherwise leave a concise statement of what remains.

The architecture’s durable conclusion is narrow and valuable. Relational, selector-scoped authoring can remain expressive while publication compiles one deterministic, immutable, cacheable document per URL. A standalone TanStack website can serve that document from local SQLite with one or two reads, zero selectors, and a synchronous registry. Stable placement keys preserve editorial identity across content, order, hiding, and type replacement. Explicit preview and admin routes can support the prototype without allowing a public query to acquire draft state. Camo can remain route authority during the transition. Structural manifests are promising for sparse templates but not dogma. Full rebuild remains the oracle while production publication becomes chunked and pointer-atomic. Everything beyond those claims stays attached to evidence or an owner.

There is no media allocation for this section. The review artifact should be the checklist, evidence links, and decision ledger in accessible Markdown. Read counts and limitations with equal emphasis. A successful handoff is one in which the next team can reproduce the proof, challenge a claim at its source, and continue the remaining work without reverse-engineering hidden assumptions.

> **Digest prompt:** Draft the final review note for one scenario. Include its Linear issue, one invariant, two exact measured results, the relevant repository evidence paths, the validation gate, one browser observation, one open production decision, and the correct issue status.
