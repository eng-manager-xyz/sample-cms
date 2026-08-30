# Prototype correctness and benchmark report

Linear issues: [AUT-530](https://linear.app/harwood/issue/AUT-530/prove-determinism-crud-semantics-selector-safety-and-scale) for the proof ledger, [AUT-533](https://linear.app/harwood/issue/AUT-533/build-the-chaptered-architecture-tutorial-and-reviewed-ui-walkthroughs) for the governed tutorial transfer, [AUT-534–AUT-536](https://linear.app/harwood/issue/AUT-536/update-the-auteur-tutorial-for-the-standalone-publishing-and-hybrid) for the standalone publishing proof and its documented hybrid seams, and [AUT-544](https://linear.app/harwood/issue/AUT-544/prove-the-authoring-journeys-and-preserve-all-production-style-pages) for the production-shaped authoring and publication loop.

This is the human-readable index for two machine-readable evidence envelopes:

- `docs/evidence/bounded-report.json` — the deterministic 1,000-page development proof.
- `docs/evidence/store-1m.json` — the explicit one-million-page Store stress proof.

Each envelope contains the exact invocation, Git commit and pre-run dirty state, `bun.lock` SHA-256,
runtime and SQLite versions, host shape, process resource use, database bytes, scenario timings, raw
counts, query plans, hashes, provenance, and limitations. The Markdown summary intentionally does
not turn local SQLite timings into production SLOs.

## Reproduction and evidence contract

```bash
bun install --frozen-lockfile
bun run scenarios:evidence:bounded
bun run evidence:verify:bounded
bun run scenarios:benchmark:1m
bun run five-phase-pass
```

The scenario commands reset dedicated database files under `.data/`; they never mutate the normal
development database. Long runs emit newline-delimited JSON progress to stderr at 100,000-page
intervals and at every seed/compile/write/republish phase completion. Those progress events are
operational visibility, not a substitute for the completed evidence envelope.

`scripts/verify-evidence.ts` rejects a missing or malformed envelope and checks the acceptance facts
rather than trusting a command's zero exit status. In particular, the million-row proof must:

1. insert exactly `1,000,000` scale pages and retain the two deterministic foundation pages;
2. preserve five independent Store classes without a scenario-specific resolver branch;
3. pass integrity and foreign-key health checks;
4. use indexed canonical lookup, tag lookup, and selector preview plans;
5. publish every eligible page through the generic `CmsService` path;
6. record materialized rows, manifests, placement/byte reuse, and publication storage delta;
7. prove an identical republish reuses the active result without adding page rows; and
8. carry the bounded atomic-failure, rollback-hash, route-status, and selector-safety proofs.

If the million-row run cannot complete, do not manufacture a passing envelope. Record the command,
requested scale, elapsed time, last verified checkpoint, exit status, and exact resource failure in
this file and on `AUT-530`; the acceptance criterion explicitly permits an exact limitation record.
The final gate remains red until Linear accepts that limitation.

## Bounded environment and raw artifact

Generate the committed bounded envelope with:

```bash
bun run scenarios:evidence:bounded
```

The clean AUT-544 provenance run recorded the equivalent explicit invocation with output
`.data/aut544-bounded-report.json` and database `.data/aut544-bounded.sqlite`; the delivery copy is
`docs/evidence/bounded-report.json`.

The envelope's `run` object is the authoritative environment record. It includes:

| Surface | Recorded field |
| --- | --- |
| Source | `gitCommit`, `workingTreeBeforeRun`, `bunLockSha256` |
| Runtime | `packageManagerPin`, actual Bun version, SQLite version |
| Host | OS release, architecture, CPU model/count, physical memory, free disk |
| Process | wall time, user/system CPU, maximum resident bytes |
| Storage | database path, file bytes, SQLite allocated bytes and page size |
| Inputs | page/sample/case counts and deterministic seed in `invocation` |

The current bounded envelope was generated from clean governed commit
`b419baa79dfdbc2369c297e08c145b1510859ff1` between `2026-08-30T07:37:27.673Z` and
`2026-08-30T07:37:28.778Z`. Its recorded wall time is `1,104.948417` ms, its pre-run tree is empty,
and its `bun.lock` SHA-256 is
`f629b6b281247b4953f55e5d2c11fd0400f55726aa5247400e1cb967bb2e5129` with package-manager pin
`bun@1.3.14`.

The evidence runner records the exact pre-run tree state instead of assuming it was clean. The
delivery verifier requires committed evidence to have an empty pre-run dirty-state record and the
same `bun.lock` digest and package-manager pin as the checked-in workspace. Commit the implementation
first, run the envelope command, then commit the generated evidence as a separate evidence-only
change.

## Automated correctness inventory

These commands are part of `bun run five-phase-pass`:

```bash
bun run --filter @repo/cms-db test
bun run --filter @repo/cms-domain test
bun run --filter @repo/cms-service test
bun run --filter @repo/cms-scenarios test
bun run --filter cms test
bun run --filter website test
```

| Invariant | Executable evidence |
| --- | --- |
| Canonical identity | Database and service integration tests reject duplicate route identity and same-domain/path ownership while allowing the same path on a different domain. |
| One default per template | Migration trigger creates default revision `r1`; database/service tests reject a second default and health rejects a missing one. |
| Template isolation | Composite foreign keys and direct-write tests reject cross-template slots, tags, block operations, manifests, and publication pointers. |
| Sparse overlap | Domain and service tests compose same-priority operations when their placement keys differ. |
| Explicit conflict | Domain, service, and dense scenario tests reject same-priority writes to one placement with `PRIORITY_CONFLICT`; no timestamp/row-ID fallback exists. |
| Copy-on-write | Service tests append a child block version with same-lineage parent provenance and leave inherited/default rows unchanged. |
| Hide versus revert | Domain/service tests distinguish a tombstone from omission of the local operation and restore inheritance on revert. |
| Reorder | A pure `order` operation changes order provenance without creating a block content version. |
| Type replacement | Structural proofs retain `primary-hero` while changing `hero` to `hero_alt`. |
| Immutability | Direct update/delete tests cover block versions, variant revisions/operations, route audit, publications, manifests/items, and page documents. |
| Route lifecycle | Service proof returns `200` for `live` and `404` for `not_live` and `archived`; archived reactivation is rejected. |
| Idempotency | Camo source revision import and identical publication input hash both reuse their logical result. |
| Atomic failure | Injected write/conflict failures leave the former current pointer active and create no partial publication rows. |
| Rollback | Store and structural persisted proofs restore the retained baseline document hash exactly. |

## Selector safety

```bash
bun test packages/cms-domain/src/selector.test.ts
bun run --filter @repo/cms-service test
```

The corpus rejects `SELECT`, DDL/DML, `PRAGMA`, `ATTACH`, comments, multiple statements, `UNION`,
unsupported operators, malformed literals, unknown fields, executable-looking identifiers, excess
input length, and excess token count before database execution. Generated identifiers come only
from a template-owned allowlist; author values become parameters; `template_id` is injected outside
the AST. Service tests separately cover zero matches, exact full-template counts independent of
sample limits, bounded previews, indexed plans, overlap diagnostics, and template isolation.

Both measured serving shapes execute zero selector statements and zero CEL evaluations. The
expanded public `CmsService.serve` path uses one prepared materialized-read statement. The
structural-manifest read uses two fixed statements: one current-publication/page lookup and one
ordered manifest/block lookup. Their query text reads only canonical page identity, current and
immutable publication state, manifest items, blocks, and provenance; selector, slot, tag, variant,
operation, and CEL authoring surfaces are absent.

## Generated determinism

The bounded evidence runs `200` generated models using seed `1592639710` and performs `200`
permutation comparisons. The generated dimensions, overlapping layers, operations, and tombstones
assert:

- byte-stable ordered hashes independent of input row/array order;
- no duplicate effective placement keys;
- no tombstoned placement in the visible document;
- exactly one content and one order provenance source per winner; and
- rejection of a duplicate canonical URL without changing the prior publication hash.

The same run includes persisted failure injection so the domain proof is not mistaken for database
transaction evidence. Generated coverage is deterministic and bounded, not exhaustive.

## Scenario A — dense Eligible Vehicles (`AUT-527`)

Pattern: `/{locale}/eligible-vehicles/{state}/{slug}`.

The deterministic bounded report proves:

| Metric | Result |
| --- | ---: |
| Page instances | 24 |
| Active selector variants | 17 |
| Total selector matches | 100 |
| Exact intersection variants/pages | 4 / 4 |
| Placements per document | 7 |
| Materialized page rows | 24 |
| Unique manifests | 24 |
| Expanded/stored placements | 168 / 168 |
| Expanded/stored canonical manifest bytes | 22,024 / 22,024 |
| Exact intersection overrides every placement | true |
| Persisted items with exact operation provenance | 168 |
| Persisted publication rows / estimated serialized bytes | 218 / 16,520 |
| Persisted publication database-byte delta | 114,688 |
| Conflict placement/priority | `legal-notice` / 60 |

This is the expected dense result: every page has a distinct structure, so manifest reuse is `0`
rather than an inferred saving. The representative exact URL records country, language, state,
purpose, and exact-intersection revision IDs through to all seven winning placement rows. The
injected same-priority conflict is rejected before activation and leaves no failed publication rows.

The envelope records both the domain compile timing and a separate persisted service-integration
timing; host-dependent values remain in JSON rather than being copied into prose.

## Scenario B — sparse Stores (`AUT-528`)

Pattern: `/{locale}/store/{store_id}`.

The bounded run requests 1,000 scale pages and retains two foundation pages. Its deterministic
five-way partition contains independent, chain/non-fast-food, generic fast-food chain, McDonald's,
and Burger King outcomes. The last two share every unchanged block pointer while supplying different
brand hero versions. Removing the fast-food tag in the transactional proof leaves brand and
store-type memberships untouched.

| Bounded metric | Result |
| --- | ---: |
| Scale/total pages | 1,000 / 1,002 |
| Scalar slot rows | 4,008 |
| Tag memberships | 1,304 |
| Materialized documents | 1,002 |
| Unique manifests | 5 |
| Reused pages | 997 |
| Deduplicated-page ratio | 99.50% |
| Expanded/stored placements | 4,008 / 20 |
| Saved-placement ratio | 99.50% |
| Expanded/stored canonical structure bytes | 830,021 / 4,214 |
| Logical expanded rendered-document bytes | 1,142,964 |
| Estimated manifest plus page-row bytes | 508,807 |
| Publication database-byte delta | 782,336 |
| Publication bytes per document | 780.77 |
| Raw publications/page documents/manifests/items after republish | 2 / 1,004 / 5 / 20 |
| Five-class golden coverage | true |
| Identical republish reuses current publication | true |
| Manifest serve SQL/selector statements/CEL evaluations per request | 2 / 0 / 0 |
| Expanded serve SQL/selector statements/CEL evaluations per request | 1 / 0 / 0 |

Database bytes, seed/preview/publication/republish timings, document throughput, canonical p50/p95,
tag-count duration, full query-plan steps, and process memory are measurements in the bounded JSON
envelope. They vary with host and cache state and are not copied as fixed expectations.

The replayed seed inserts zero pages, reports the same identity hash, and leaves both page and tag
membership counts unchanged. Database health is `ok` on schema version 6 with zero foreign-key
violations. These are executable idempotency checks, not assumptions derived from a repeatable seed
algorithm.

Four persisted selector demonstrations expose the authored selector, revision, exact full match
count, bounded samples, affected placement, pairwise overlaps, preview plan, and preview timing:

| Selector layer | Priority | Matches | Affected placement | Indexed plan |
| --- | ---: | ---: | --- | --- |
| `store_type = 'chain_store'` | 10 | 501 | `footer` | true |
| `category = 'fast_food'` | 20 | 201 | `category-promo` | true |
| `brand = 'burger_king'` | 30 | 50 | `primary-hero` | true |
| `brand = 'mcdonalds'` | 30 | 51 | `primary-hero` | true |

The two priority-30 brand selectors currently match zero pages in common, while their overlap
diagnostic still identifies `primary-hero` as the placement that would conflict if their match sets
ever intersected. Other pairwise overlaps touch distinct placements and remain composable.

Two McDonald's pages share one structural manifest while interpolation produces different rendered
hero text and document hashes. Mutation proofs also show that a fast-food promo change reaches both
named brands without replacing their brand heroes, while a McDonald's hero edit leaves Burger King
and the default hero unchanged.

The byte measurements intentionally describe different layers. Structural canonicalization removes
825,807 repeated structure bytes, and the manifest-plus-page-row estimate is smaller than fully
expanded rendered documents. The actual SQLite allocation delta is nevertheless larger than either
logical estimate at this bounded scale because it includes immutable page JSON, manifests, table
pages, and index/page overhead. The report therefore does not claim an end-to-end database-byte
saving from manifest reuse.

### One-million Store run

Run this only after stopping the development server and unrelated indexers:

```bash
bun run scenarios:benchmark:1m
```

The authoritative stress run completed successfully from clean governed commit
`b419baa79dfdbc2369c297e08c145b1510859ff1` between `2026-08-30T07:37:35.225Z` and
`2026-08-30T07:56:01.673Z`. That revision includes the AUT-544 implementation and uses the same
clean tree and lockfile as the bounded run. The recorded invocation wrote
`.data/aut544-store-1m.json` against `.data/aut544-store-1m.sqlite`; the byte-identical delivery
source is `docs/evidence/store-1m.json`. Values below are copied from that envelope rather than
inferred from the bounded run.

| Run provenance and host | Measured result |
| --- | --- |
| Git / pre-run tree | `b419baa79dfdbc2369c297e08c145b1510859ff1` / clean |
| Lock SHA-256 / package-manager pin | `f629b6b281247b4953f55e5d2c11fd0400f55726aa5247400e1cb967bb2e5129` / `bun@1.3.14` |
| Runtime | actual Bun `1.3.11`; SQLite `3.43.2` |
| Host | macOS Darwin `24.6.0`, arm64 Apple M4 Max, 16 logical CPUs, 51,539,607,552 bytes (48 GiB) physical memory |
| Wall / CPU | 1,106,440.516 ms wall; 997.504 s user CPU; 109.529 s system CPU |
| Maximum resident memory | 608,944,128 bytes (580.73 MiB) |
| Final database | 2,692,648,960 bytes (2.508 GiB), 657,385 × 4,096-byte pages, zero freelist pages |

| Persisted cardinality | Exact result |
| --- | ---: |
| Requested/inserted scale pages | 1,000,000 / 1,000,000 |
| Total template pages | 1,000,002 |
| Scalar slot rows / tag memberships | 4,000,008 / 1,300,004 |
| Chain / independent | 500,001 / 500,001 |
| Fast food / generic fast-food chain | 200,001 / 100,000 |
| McDonald's / Burger King | 50,001 / 50,000 |
| Chain non-fast-food | 300,000 |
| Publications / page documents | 2 / 1,000,004 |
| Manifests / manifest items | 5 / 20 |

The initial seed took 61,902.738 ms. Replaying the same scale identity took 66.102 ms, inserted zero
rows, reproduced the same SHA-256 identity, and left page and membership counts unchanged. Integrity
was `ok` on schema v6 with zero foreign-key violations.

All inspected read and selector plans used named indexes. Canonical lookup used
`templates_domain_pattern_unique` followed by `page_instances_template_canonical_unique`. Tag lookup
used `page_tags_selector_idx` and `page_instances_id_template_unique`, with a temporary B-tree only
for the requested ordering. Each selector preview used the canonical-page index plus
`tags_template_namespace_value_unique` and the covering `page_tags_selector_idx`:

| Selector | Exact matches | Preview time |
| --- | ---: | ---: |
| `store_type = 'chain_store'` | 500,001 | 774.697 ms |
| `category = 'fast_food'` | 200,001 | 751.022 ms |
| `brand = 'burger_king'` | 50,000 | 710.123 ms |
| `brand = 'mcdonalds'` | 50,001 | 722.047 ms |

The bounded 50-row publication preview over all 1,000,002 eligible pages took 49.440 ms. The full
generic publication took 638,276.277 ms and persisted 1,000,002 documents at a measured local rate
of 1,566.72 documents/second. The identical-input compile took 355,715.793 ms, returned the same
publication ID and input hash, reproduced exactly 1,143,681,174 logical expanded payload bytes, and
added no page-document rows.

| Publication/storage shape | Exact result |
| --- | ---: |
| Published pages / unique manifests | 1,000,002 / 5 |
| Pages reusing a manifest | 999,997 |
| Deduplicated-page ratio | 99.999500001% |
| Logical/stored placements | 4,000,008 / 20 |
| Logical/stored canonical structure bytes | 828,401,621 / 4,214 |
| Saved canonical structure bytes | 828,397,407 |
| Logical fully expanded rendered-document bytes | 1,143,681,174 |
| Estimated manifest plus page-row bytes | 507,791,017 |
| SQLite allocation before/after publication | 1,895,190,528 / 2,692,648,960 bytes |
| Actual publication allocation delta | 797,458,432 bytes (797.46 bytes/document) |

Across 250 full-scale samples, indexed canonical lookup measured 0.007292 ms p50 and 0.008375 ms
p95. Manifest reconstruction measured 0.066667 ms p50 and 0.287417 ms p95, using exactly two SQL
statements, zero selector statements, and zero CEL evaluations per request. The separate expanded
serving fixture used one SQL statement, zero selectors, and zero CEL evaluations, measuring
0.019208 ms p50 and 0.035125 ms p95. These local hot-cache SQLite measurements compare shapes; they
are not production SLOs. No resource limitation occurred.

## Scenario C — structural replacement (`AUT-529`)

The deterministic long-document proof uses 24 default placements and two sparse operations:
`primary-hero` is replaced by `hero_alt` at the same placement identity and
`announcement-promo` is tombstoned.

| Metric | Result |
| --- | ---: |
| Default/effective placements | 24 / 23 |
| Sparse operations | 2 |
| Unchanged default block-version pointers | 22 |
| Pointer inheritance | 91.67% |
| Stable hero placement and lineage | true |
| Revert restores default hero | true |
| Tombstone remains scoped | true |
| Persisted rollback restores baseline hash | true |
| Domain publication pages/manifests/items | 2 / 2 / 47 |
| Persisted publications/page documents/manifests/items | 2 / 4 / 2 / 47 |
| Persisted publication database-byte delta | 28,672 |
| New variant block versions / active sparse operations | 1 / 2 |
| Replacement schemas and renderers differ | true |
| `hero_alt` rejects the old `hero` payload | true |
| Unmatched page retains `hero` | true |

The raw comparison contains all 24 placement keys, before/after block types and version IDs,
content provenance, inherited-pointer flags, and tombstone status. This proves the `>= 90%`
inheritance requirement without describing an in-memory object as persisted evidence. The report's
service-integration section separately proves database publication, exact page/hash lookup,
rollback, row counts, compile timings, and allocated-byte change. Host-dependent timing values stay
in the JSON envelope.

## Shape comparison and interpretation

| Shape | What the measured prototype shows | Production implication |
| --- | --- | --- |
| Dense | 24 pages produce 24 manifests and no structural byte saving. | Manifest indirection is not automatically valuable for highly customized templates. |
| Sparse Store (bounded) | 1,002 pages collapse to five manifests; 99.50% of logical placements are not repeated in manifest rows. | Shared manifests are promising when variants alter few placements, but page context/rendered payload bytes still matter. |
| Structural | 22 of 24 block-version pointers remain inherited while one type changes and one placement is hidden. | Stable placement identity and sparse operations avoid cloning unrelated block content. |

The serving schema supports either a manifest pointer plus per-page context or a deterministic
expanded document payload. The million-row run uses manifest mode; the separate expanded fixture
proves its one-query read. Manifest metrics therefore describe structural-row/canonical-structure
reuse, not a claim that total database bytes shrink by the same ratio. The one-million envelope
records actual allocated bytes before and after publication and bytes per published document so the
ADR can weigh expanded one-query reads against shared structures honestly.

## Production-shaped authoring and publication loop (`AUT-544`)

The 2026-08-30 browser verification used a freshly migrated, deterministically seeded SQLite
database and the separate CMS and website applications. The authoring explorer exposed exactly the
three fixed Store, Eligible Vehicles, and Structural replacement templates, offered no template
creation control, searched the SQLite-backed page tree, and opened each exact canonical page in the
authoring studio.

The Store journey added `browser-proof-promo` to the default layer, evaluated
`Browser offer for {{ store.name }}` as `Browser offer for McDonald's Market`, rejected the forbidden
`store.constructor` property, and saved an immutable first version that survived reload. Before
publication, the draft appeared once in private preview and zero times on the public route. The
preflight reported two active and two changed pages, two new manifests, zero blockers, ten block
references, three selector matches, the current pointer, and the publication input hash. Publishing
created `publication:4265639f-472d-42bf-b796-85ffefb52a3e`; the public ETag changed from
`173f0c8b8cfaff9425c595896e3e1d9f4d39bb5b3f73a358582ba17198d6306d` to
`aa2fa24f76ea8fb550bed0175273257cba1ed0c761fee96213873bbfde83a9bc`. Exact rollback to pointer
`#1` restored `publication-store-1` and the original ETag, while the draft remained available in
preview. Adding `?edit_mode=true` to the public URL never exposed that draft.

A second browser pass edited the default `primary-hero` into immutable version 4 while retaining
versions 1–3, their hashes, and their parent links in History. The identical saved source
`Welcome to {{ store.name }} in {{ store.location }}` evaluated as
`Welcome to McDonald's Market in San Francisco` on Store 1001 and
`Welcome to Neighborhood Kitchen in Oakland` on Store 1002. Save attempts with malformed
`{{ store.name + }}` and forbidden `{{ store.constructor }}` expressions failed with structured
`SYNTAX_ERROR` and `FORBIDDEN_PROPERTY` diagnostics. Reload restored the valid version-4 source,
showed no version 5, and retained `publication-store-1`; the public page still contained neither
the draft headline nor the draft promotion.

The public response remained `200` with
`Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`, an ETag, and
`x-auteur-publication`. Preview remained `private, no-store, max-age=0` with
`x-robots-tag: noindex, nofollow, noarchive`. Cross-application tests exercise all three canonical
journeys with one expanded or two manifest SQL reads, zero selector SQL, and zero CEL evaluations on
the public request path, including stale-input/pointer rejection without partial mutation and exact
predecessor rollback while preserving draft state.

The Structural replacement journey retained the stable `primary-hero` placement while resolving
local `hero_alt` v2, 22 inherited placements, and one scoped tombstone. Copy-on-write editing of
inherited `section-01` created local v2 with a parent link to immutable v1; reverting later operations
restored inheritance without deleting that history. Reorder and revert-order were atomic, and a
hide/revert cycle changed the visible/hidden counts from 23/1 to 22/2 and back without changing
placement identity.

The cascade inspector previewed `route_status = 'live'` against both Store pages with parameterized
bindings, bounded samples, pairwise overlaps, affected placements, and an indexed query plan.
Duplicating the matching McDonald's priority-30 selector produced a publication-blocking
`primary-hero` conflict; changing the duplicate to priority 40 repaired it. An advanced
`DROP TABLE page_instances` expression was rejected before execution and did not replace the saved
selector. The three public proof URLs continued to render their active publications:
`/en-US/store/1001`, `/en-US/eligible-vehicles/ca/premium`, and `/en-US/airport/hero-alt`.

At a 390-pixel viewport, both explorer and studio matched the viewport width with no horizontal
overflow. The mobile navigation and native publication dialog closed with Escape and restored focus
to their exact triggers; the dialog initially focused its Close control, fit the viewport, and
locked dismissal while busy. CMS, public, preview, and mobile browser consoles contained no warnings
or errors.

## Known limitations and untested production assumptions

- SQLite is a single-process local engine; its locks, cache, planner, filesystem, and latency do not
  predict distributed TiDB behavior.
- The bounded report is intentionally small enough for the final gate; only the explicit stress
  command is evidence for one-million scale.
- Full scale publication currently uses a full-template generic service compile. Chunked hidden
  namespaces and compare-and-swap activation are a TiDB design, not implemented by this SQLite
  prototype.
- Atomic write-failure and rollback tests use bounded fixtures; repeating destructive failure
  injection across one million rows would add cost without changing the transaction invariant.
- Camo Press and Louvre are represented by tested transition contracts, not production traffic.
- The standalone website proves a read-only local SQLite serving boundary and deterministic block
  registry. It is not a deployed multi-host service, CDN integration, or production Camo adapter.
- `/cms-preview_/*` proves route and cache isolation, but production authentication and authorization
  are deliberately absent; preview fails closed unless explicitly enabled. `/admin` is a validated
  link gateway, not a reverse proxy, iframe, SSO boundary, or replacement CMS API.
- TiDB selector plans, transaction chunking, partition/global-index behavior, hot keys, constraints,
  and cache topology require the named proof spikes in ADR 0001.
- The production policy for `not_live` precompilation, Camo revision drift, tag freshness/ownership,
  and expanded-versus-manifest serving remains open.

## Final five-phase result

`bun run five-phase-pass` passed on 2026-08-30 from consolidated `main` after the AUT-544 authoring
history and AUT-545 current-architecture tutorial history were joined at merge commit
`3201dd1c`, and the final architecture document and ERD were committed at `68a6f2d`. The tree
contains the fixed-template explorer, production-shaped authoring studio, CEL compilation, cascade
inspection, atomic publication lifecycle, current executable tutorial, standalone website, and
isolated preview/admin seams. The committed bounded and million-row ledgers retain their exact
source commit and lockfile digest; the verifier rejects drift.

| Phase | Result | Owning Linear work |
| --- | --- | --- |
| 1 — shell and SQLite baseline | Frozen install unchanged; boundaries and 71-skill/115-file import digest passed; reset and deterministic schema-v6 seed passed. | AUT-515–AUT-519 |
| 2 — relational foundation | Database suite and populated v1→v6 upgrade passed; health/integrity/foreign-key checks passed. | AUT-516–AUT-519 |
| 3 — selector, resolution, publication | Selector corpus, bounded CEL compilation, domain resolution, service CRUD, authoring preflight, atomic publication, exact rollback, and fixed selector/CEL-free serving passed. | AUT-520–AUT-525, AUT-539, AUT-542–AUT-543 |
| 4 — HUD, website, and scenarios | TanStack HUD/tutorial, fixed-template explorer, three-pane authoring studio, standalone-website tests, fresh bounded proof, evidence verification, and both client/SSR/Nitro production builds passed. Public, preview, and admin route boundaries were exercised independently. | AUT-526–AUT-530, AUT-533–AUT-535, AUT-540–AUT-544 |
| 5 — cross-workspace audit | Committed bounded and one-million ledgers verified; authoring/browser evidence, current-architecture tutorial contract, required artifacts, boundaries, Biome, TypeScript, all tests, build, and Fallow passed with zero findings. | AUT-530–AUT-533, AUT-536–AUT-545 |

The consolidated workspace total was 313 tests and 2,655 assertions: CEL engine 15/50, database
9/60, domain 72/778, service 18/197, scenarios 12/172, CMS UI/router/server/tutorial/authoring
144/1,041, and standalone website 43/357. Fallow reported zero issues across unused files, exports, types,
dependencies, cycles, unresolved imports, boundary/policy violations, and stale suppressions.

Production-browser smoke against the built server rendered `/`, all three template workbenches,
`/publications/stores`, and `/tutorial` with live SQLite schema v6. The Store workbench persisted a fifth block,
published two pages, and retained both the block and second immutable publication after a full
reload. Eligible Vehicles exposed seven editable placements. The structural variant exposed 23
visible placements, one tombstone, one `hero_alt` winner, and 22 inherited placements. The
publication route read the same live pointer, document hash, and two-publication history. Earlier
route/table smoke also advanced the bounded instance page and exercised the unsafe
live-without-document HTTP 503 fixture with no selector SQL; the browser console was clean.

The separate built `website` server rendered the three real canonical examples at
`/en-US/eligible-vehicles/ca/premium`, `/en-US/store/1001`, and `/en-US/airport/hero-alt` from their
active immutable publications. `/admin` and `/cms-preview_/*` rendered as separate seams. The Store
public URL retained publication `publication-store-1` and document hash
`173f0c8b8cfaff9425c595896e3e1d9f4d39bb5b3f73a358582ba17198d6306d` when
`?edit_mode=true` was added, while the preview route alone exposed the newer draft. The browser
console, page, and request failure ledgers were empty, and response headers distinguished public
cacheability from private no-store preview output.

The tutorial browser audit found 65 unique rendered IDs and no duplicates. Its six current native
player instances represent four distinct reviewed capture bundles and each expose MP4, WebM, and a
description track. The Chapter 5 scenario selector swaps one player in place with pressed-state
feedback and no backward player anchors. Media tests verify derivative hashes, byte counts, exact
cue timing and transcript text, manifest/schema-state coherence, the accepted illustration
substitution provenance record, and—on the recorded environment with `ffprobe`
available—the real codecs, pixel formats, frame geometry/rate, audio absence, and durations.

The AUT-538–AUT-544 Linear handoffs name their acceptance evidence and point back to this report;
the parent is closed only after every child is Done and this clean gate is recorded.
