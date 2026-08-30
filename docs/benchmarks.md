# Prototype correctness and benchmark report

Linear issues: [AUT-530](https://linear.app/harwood/issue/AUT-530/prove-determinism-crud-semantics-selector-safety-and-scale) for the proof ledger, [AUT-533](https://linear.app/harwood/issue/AUT-533/build-the-chaptered-architecture-tutorial-and-reviewed-ui-walkthroughs) for the governed tutorial transfer, and [AUT-534–AUT-536](https://linear.app/harwood/issue/AUT-536/update-the-auteur-tutorial-for-the-standalone-publishing-and-hybrid) for the standalone publishing proof and its documented hybrid seams.

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
`0d02c761e9a3941ad22ffded83dadf8397c53448`; the revision resolves directly in the AUT-536
branch and uses the current website-enabled lockfile.

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

Both measured serving shapes execute zero selector statements. The expanded public
`CmsService.serve` path uses one prepared materialized-read statement. The structural-manifest
read uses two fixed statements: one current-publication/page lookup and one ordered manifest/block
lookup. Their query text reads only canonical page identity, current and immutable publication
state, manifest items, blocks, and provenance; selector, slot, tag, variant, and operation tables
are absent.

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
| Persisted publication rows / estimated serialized bytes | 218 / 21,120 |
| Persisted publication database-byte delta | 118,784 |
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
| Estimated manifest plus page-row bytes | 858,229 |
| Publication database-byte delta | 1,294,336 |
| Publication bytes per document | 1,291.75 |
| Raw publications/page documents/manifests/items after republish | 2 / 1,004 / 5 / 20 |
| Five-class golden coverage | true |
| Identical republish reuses current publication | true |
| Manifest serve SQL/selector statements per request | 2 / 0 |
| Expanded serve SQL/selector statements per request | 1 / 0 |

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
`6d02c0de16b3745b32df22b42fe0afca559300f6`. That revision includes the AUT-536 implementation and
bounded evidence commit, resolves locally in this branch, and uses the current lockfile. The
machine-readable source is `docs/evidence/store-1m.json`; values below are copied from that envelope
rather than inferred from the bounded run.

| Run provenance and host | Measured result |
| --- | --- |
| Git / pre-run tree | `6d02c0de16b3745b32df22b42fe0afca559300f6` / clean |
| Lock SHA-256 / package-manager pin | `3df8a64cc151ce6315f378f312eaef4d1e876e9e7097023c9411d8f937ee51cc` / `bun@1.3.14` |
| Runtime | actual Bun `1.3.11`; SQLite `3.43.2` |
| Host | macOS Darwin `24.6.0`, arm64 Apple M4 Max, 16 logical CPUs, 51,539,607,552 bytes (48 GiB) physical memory |
| Wall / CPU | 941,377.622 ms wall; 813.432 s user CPU; 105.358 s system CPU |
| Maximum resident memory | 580,419,584 bytes (553.53 MiB) |
| Final database | 3,205,939,200 bytes (2.986 GiB), 782,700 × 4,096-byte pages, zero freelist pages |

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

The initial seed took 61,272.986 ms. Replaying the same scale identity took 63.238 ms, inserted zero
rows, reproduced the same SHA-256 identity, and left page and membership counts unchanged. Integrity
was `ok` on schema v6 with zero foreign-key violations.

All inspected read and selector plans used named indexes. Canonical lookup used
`templates_domain_pattern_unique` followed by `page_instances_template_canonical_unique`. Tag lookup
used `page_tags_selector_idx` and `page_instances_id_template_unique`, with a temporary B-tree only
for the requested ordering. Each selector preview used the canonical-page index plus
`tags_template_namespace_value_unique` and the covering `page_tags_selector_idx`:

| Selector | Exact matches | Preview time |
| --- | ---: | ---: |
| `store_type = 'chain_store'` | 500,001 | 764.465 ms |
| `category = 'fast_food'` | 200,001 | 767.889 ms |
| `brand = 'burger_king'` | 50,000 | 704.737 ms |
| `brand = 'mcdonalds'` | 50,001 | 715.465 ms |

The bounded 50-row publication preview over all 1,000,002 eligible pages took 48.222 ms. The full
generic publication took 562,129.470 ms and persisted 1,000,002 documents at a measured local rate
of 1,778.95 documents/second. The identical-input compile took 247,391.290 ms, returned the same
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
| Estimated manifest plus page-row bytes | 862,480,639 |
| SQLite allocation before/after publication | 1,895,190,528 / 3,205,939,200 bytes |
| Actual publication allocation delta | 1,310,748,672 bytes (1,310.75 bytes/document) |

Across 250 full-scale samples, indexed canonical lookup measured 0.006750 ms p50 and 0.008000 ms
p95. Manifest reconstruction measured 0.173500 ms p50 and 0.324666 ms p95, using exactly two SQL
statements and zero selector statements per request. The separate expanded serving fixture used one
SQL statement and zero selectors, measuring 0.017000 ms p50 and 0.023500 ms p95. These local
hot-cache SQLite measurements compare shapes; they are not production SLOs. No resource limitation
occurred.

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
| Persisted publication database-byte delta | 20,480 |
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

`bun run five-phase-pass` passed on 2026-08-29 from the final implementation tree after the
persisted authoring HUD, governed tutorial, standalone website, and isolated preview/admin seams
were completed. The committed bounded and million-row ledgers retain their own exact source
commits and lockfile digests; the verifier rejects drift.

| Phase | Result | Owning Linear work |
| --- | --- | --- |
| 1 — shell and SQLite baseline | Frozen install unchanged; boundaries and 71-skill/115-file import digest passed; reset and deterministic schema-v6 seed passed. | AUT-515–AUT-519 |
| 2 — relational foundation | Database suite and populated v1→v6 upgrade passed; health/integrity/foreign-key checks passed. | AUT-516–AUT-519 |
| 3 — selector, resolution, publication | Selector corpus, domain resolution, service CRUD, atomic publication, rollback, and fixed selector-free serving passed. | AUT-520–AUT-525 |
| 4 — HUD, website, and scenarios | TanStack HUD/tutorial and standalone-website tests, fresh bounded proof, evidence verification, and both client/SSR/Nitro production builds passed. Public, preview, and admin route boundaries were exercised independently. | AUT-526–AUT-530, AUT-533–AUT-535 |
| 5 — cross-workspace audit | Committed bounded and one-million ledgers verified; tutorial contract, required artifacts, boundaries, Biome, TypeScript, all tests, build, and Fallow passed. | AUT-530–AUT-533, AUT-536 |

The workspace total was 176 tests and 1,808 assertions: database 8/57, domain 66/756, service
11/128, scenarios 11/137, CMS UI/router/server/tutorial 42/552, and standalone website 38/178.
Fallow reported zero issues across unused files, exports, dependencies, cycles, unresolved imports,
boundary/policy violations, and stale suppressions.

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
player instances represent five distinct reviewed capture bundles and each expose MP4, WebM, and a
description track. The Chapter 5 scenario selector swaps one player in place with pressed-state
feedback and no backward player anchors. Media tests verify derivative hashes, byte counts, exact
cue timing and transcript text, manifest/schema-state coherence, the accepted illustration
substitution provenance record, and—on the recorded environment with `ffprobe`
available—the real codecs, pixel formats, frame geometry/rate, audio absence, and durations.

Linear closure follows the clean gate. Each AUT-514–AUT-536 handoff names its acceptance evidence
and points back to this report; the parent remains closed only while every child is Done.
