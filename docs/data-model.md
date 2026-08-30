# Auteur prototype data model

Linear issue: [AUT-516](https://linear.app/harwood/issue/AUT-516/design-the-generic-relational-schema-and-authoring-serving-boundary)

Executable delivery proofs:
[AUT-534](https://linear.app/harwood/issue/AUT-534/prove-sqlite-publication-with-a-standalone-tanstack-website-renderer)
and
[AUT-535](https://linear.app/harwood/issue/AUT-535/add-the-hybrid-admin-gateway-and-isolated-website-preview-route)

This reference describes the current SQLite/Drizzle foundation in
`packages/cms-db/drizzle/0000_slot_variant_foundation.sql`,
`packages/cms-db/drizzle/0001_authoring-contract.sql`,
`packages/cms-db/drizzle/0002_block-version-parent-provenance.sql`,
`packages/cms-db/drizzle/0003_domain-path-canonical-identity.sql`,
`packages/cms-db/drizzle/0004_selector-validation-and-preview-metadata.sql`,
`packages/cms-db/drizzle/0005_route-source-observed-at.sql`, and
`packages/cms-db/src/schema/index.ts`. It is the table-level companion to the
[process-engineering guide](./process-engineering-guide.md).

## The boundary in one sentence

Normalized template, route, slot, tag, variant, operation, and block rows are authoring inputs;
publication compiles them into immutable manifests and page documents selected by one mutable
current-publication pointer.

There is **no route-tree content inheritance** in this model. A URL path is represented by ordered
slots, but parent/child path position never determines content precedence. Inheritance comes only
from one template-owned default plus matching selector variants with explicit integer priority.
RouterService remains the route identity/status authority at the transition seam.

### Executable publication-document contract

The relational rows are not passed loose to React. `packages/cms-domain/src/published-document.ts`
defines the strict `PublishedDocumentSchema` used at publication persistence and at both expanded
and manifest serving boundaries:

```text
PublishedDocument
  templateId
  pageId
  placements[]
    placementKey       stable document position
    order              zero-based and contiguous
    blockType          registry dispatch key
    blockVersionId     immutable content version
    content            rendered JSON object
    provenance
      sourceRevisionId
      sourceOperationId
      sourcePriority
```

Unknown fields, duplicate placement keys, gaps in order, and missing provenance fail parsing rather
than becoming partially rendered public output. `apps/website` then consumes the validated value
through one shared block registry. Block-type replacement changes `blockType` and
`blockVersionId` at the same `placementKey`; it does not invent a new page position or clone the
unaffected placements.

## Relational overview

```mermaid
classDiagram
  direction LR

  class templates {
    +TEXT id
    +TEXT key
    +TEXT url_pattern
  }
  class template_slots {
    +TEXT id
    +TEXT template_id
    +TEXT key
  }
  class route_ingestions {
    +TEXT id
    +TEXT template_id
    +TEXT source_revision
  }
  class page_instances {
    +TEXT id
    +TEXT template_id
    +TEXT canonical_url
  }
  class route_audit_log {
    +TEXT id
    +TEXT ingestion_id
    +TEXT page_instance_id
  }
  class page_slot_values {
    +TEXT page_instance_id
    +TEXT slot_id
    +TEXT normalized_value
  }
  class tags {
    +TEXT id
    +TEXT template_id
    +TEXT namespace
    +TEXT value
  }
  class page_tags {
    +TEXT page_instance_id
    +TEXT tag_id
  }
  class variants {
    +TEXT id
    +TEXT template_id
    +TEXT active_revision_id
  }
  class variant_revisions {
    +TEXT id
    +TEXT variant_id
    +TEXT selector_sql
  }
  class variant_operations {
    +TEXT id
    +TEXT variant_revision_id
    +TEXT block_version_id
  }
  class block_types {
    +TEXT id
    +TEXT key
    +INTEGER schema_version
  }
  class block_lineages {
    +TEXT id
    +TEXT template_id
    +TEXT key
  }
  class block_versions {
    +TEXT id
    +TEXT lineage_id
    +TEXT block_type_id
  }
  class publications {
    +TEXT id
    +TEXT template_id
    +TEXT previous_publication_id
  }
  class document_manifests {
    +TEXT id
    +TEXT template_id
    +TEXT content_hash
  }
  class document_manifest_items {
    +TEXT manifest_id
    +TEXT placement_key
    +TEXT block_version_id
    +TEXT source_variant_revision_id
    +TEXT source_operation_id
  }
  class published_page_documents {
    +TEXT publication_id
    +TEXT page_instance_id
    +TEXT manifest_id
  }
  class current_publications {
    +TEXT template_id
    +TEXT publication_id
  }

  templates "1" --> "0..*" template_slots : declares
  templates "1" --> "0..*" route_ingestions : imports
  templates "1" --> "0..*" page_instances : owns
  route_ingestions "0..1" --> "0..*" page_instances : last ingestion
  route_ingestions "1" --> "0..*" route_audit_log : records
  page_instances "0..1" --> "0..*" route_audit_log : explains
  page_instances "1" --> "0..*" page_slot_values : has
  template_slots "1" --> "0..*" page_slot_values : defines
  templates "1" --> "0..*" tags : defines
  page_instances "1" --> "0..*" page_tags : assigned
  tags "1" --> "0..*" page_tags : classifies
  templates "1" --> "0..*" variants : owns
  variants "1" --> "0..*" variant_revisions : versions
  variant_revisions "1" --> "0..*" variant_operations : contributes
  templates "1" --> "0..*" block_lineages : owns
  block_types "1" --> "0..*" block_versions : types
  block_lineages "1" --> "0..*" block_versions : versions
  block_versions "0..1" --> "0..*" variant_operations : selected by
  templates "1" --> "0..*" publications : compiles
  templates "1" --> "0..*" document_manifests : owns
  document_manifests "1" --> "0..*" document_manifest_items : orders
  block_versions "1" --> "0..*" document_manifest_items : points to
  variant_revisions "1" --> "0..*" document_manifest_items : proves source
  variant_operations "1" --> "0..*" document_manifest_items : proves exact set
  publications "1" --> "0..*" published_page_documents : contains
  page_instances "1" --> "0..*" published_page_documents : materializes
  document_manifests "1" --> "0..*" published_page_documents : shared by
  templates "1" --> "0..1" current_publications : activates
  publications "1" --> "0..1" current_publications : current
```

The class fields shown here are the identifiers and main relationship keys, not every column. An
arrow runs from the referenced or owning table to its dependent table; the multiplicities show how
many rows may participate. The table catalog below contains the complete responsibilities and
constraints.

### How the final page is assembled

The class diagram shows individual table relationships. This
[Mermaid block diagram](https://mermaid.ai/open-source/syntax/block.html) groups those tables by
responsibility and follows the data from authoring through the immutable publication boundary to
the React renderer.

```mermaid
block-beta
  columns 3

  routes["Route inputs<br/>page_instances<br/>slots + tags"]
  rules["Selection rules<br/>variants + revisions<br/>operations"]
  content["Immutable block content<br/>block_versions.content_json"]

  compiler["Publication compiler<br/>resolve winners + validate<br/>PublishedDocumentSchema"]:3

  publication["Release snapshot<br/>publications.id<br/>= publication_id"]
  page["Page snapshot<br/>published_page_documents<br/>evaluated placement JSON + manifest_id<br/>or rendered_document_json"]
  manifest["Shared identity recipe<br/>document_manifests.id<br/>= manifest_id<br/>items record type/version/provenance"]

  current["Active release pointer<br/>current_publications.publication_id"]
  service["Public serving<br/>CmsService<br/>one expanded or two manifest reads"]
  renderer["Final page<br/>validated PublishedDocument<br/>React block registry"]

  routes --> compiler
  rules --> compiler
  content --> compiler
  compiler --> publication
  compiler --> page
  compiler --> manifest
  publication --> current
  publication --> page
  page --> manifest
  current --> service
  page --> service
  manifest --> service
  service --> renderer
```

For `/en-US/store/1001`, `current_publications.publication_id` selects
`publication-store-1`. Its page snapshot supplies `resolved_data_json` and
`manifest-store-mcd-v1`; that manifest supplies ordered block identity and provenance, while the
page snapshot supplies the already-evaluated content keyed by stable placement key. `CmsService`
combines those materialized pieces into the final validated document. Authoring
`block_versions.content_json` is not read or evaluated on this public path; `manifest_id` and
`publication_id` remain immutable pointers rather than final page content themselves.

The migration uses composite foreign keys containing `template_id` where a cross-template pointer
would violate the product model. Application services must keep that boundary even when a future
database cannot express one of the prototype constraints identically.

## All 19 domain tables

The “owner” column names the subsystem allowed to create or change the row. Direct SQL is useful for
tests, but is not an alternate ownership path.

| # | Table | Row meaning and owner | Lifecycle | Primary relationships, constraints, and indexes |
| ---: | --- | --- | --- | --- |
| 1 | `templates` | One domain plus URL grammar/content map. Template administration owns it. | Mutable metadata and active/archived status; stable identity. | PK `id`; unique `key` and `(domain,url_pattern)`; normalized bare-host domain plus pattern/status checks; every dependent content row stays template-scoped. |
| 2 | `template_slots` | One static, variable, or derived scalar dimension. Template administration owns it. | Mutable model input; changes can require route re-ingestion/publication. | PK `id`; FK `template_id`; unique template/key and template/path position; kind-shape and non-negative-position checks; `(template_id,path_position)` lookup. |
| 3 | `route_ingestions` | One idempotent RouterService or seed import attempt. Route ingestion owns it. | Append-oriented; immutable `source_observed_at` records when the source state was observed; `running` closes as `succeeded` or `failed`. | PK `id`; FK template; unique `(template_id,source,source_revision)`; required source-observation timestamp; template/status index; completion-shape and row-count checks. |
| 4 | `page_instances` | One stable RouterService route identity and canonical path inside a template/domain. Route ingestion owns it. | Mutable authoring input; lifecycle status changes by authoritative import. | PK `id`; FK template and last ingestion; unique external ID, `(template_id,canonical_url)`, and `(template_id,slot_value_hash)`; domain-plus-path uniqueness triggers; JSON context and absolute-path checks; `(template_id,route_status)` index. |
| 5 | `page_slot_values` | One page's normalized value for one declared slot. Route ingestion derives it. | Replaceable when route inputs change. | PK `(page_instance_id,slot_id)`; composite page/template and slot/template FKs; selector index `(template_id,slot_id,normalized_value,page_instance_id)`. |
| 6 | `tags` | One template-local namespace/value definition with label, description, and source. Tag pipeline or authoring owns it. | Mutable display metadata; stable semantic identity. | PK `id`; FK template; optional same-template parent; unique `(template_id,namespace,value)`; namespace/value index. Parent rows do not imply membership. |
| 7 | `page_tags` | One explicit page-to-tag membership and source. Tag pipeline or authoring owns it. | Add/remove when classifications change. | PK `(page_instance_id,tag_id)`; composite same-template FKs; `(template_id,tag_id,page_instance_id)` selector index. |
| 8 | `route_audit_log` | One immutable import action for a route. Route ingestion appends it. | Immutable by update/delete triggers. | PK `id`; FKs ingestion and optional page; same-template trigger; ingestion/time and page/time indexes; JSON detail and status checks. |
| 9 | `variants` | One template default or selector-overlay container. Variant authoring owns it. | Mutable metadata, priority/status, and active-revision pointer. | PK `id`; FK template; unique template/key; at most one default by partial unique index; default must be priority 0 and other variants positive; resolution-order index. Database health supplies the “at least one default” half. |
| 10 | `variant_revisions` | One selector revision and immutable authoring snapshot. Variant authoring appends it only after validation. | Immutable by update/delete triggers. | PK `id`; FK variant; unique variant/revision number; original selector input, normalized selector SQL/hash, and valid matching validation-result JSON; positive revision; default-selector trigger; revision-order index. |
| 11 | `block_types` | One named block schema/version contract plus optional preview-renderer metadata. Block platform owns it. | Key/schema contract is immutable; preview-renderer metadata may change without rewriting pinned block versions. | PK `id`; unique key; positive schema version; valid JSON schema and optional valid preview-renderer JSON; contract-immutability trigger. |
| 12 | `block_lineages` | One stable block identity stream inside a template. Block authoring creates it. | Stable identity; versions append. | PK `id`; FK template; unique template/key; template index. |
| 13 | `block_versions` | One typed immutable JSON content value. Block authoring or copy-on-write appends it. | Immutable by update/delete triggers. | PK `id`; FKs lineage/type and optional earlier same-lineage parent; unique lineage/version and lineage/content hash; valid JSON/positive version checks; type and parent indexes. |
| 14 | `variant_operations` | One `set`, `tombstone`, or `order` decision for one placement in one revision. Variant authoring creates it. | Immutable by update/delete triggers; a change creates another revision. | PK `id`; FKs revision and optional block; one content op and one order op per revision/placement; payload-shape check; same-template block trigger; revision and block indexes. |
| 15 | `publications` | One published or failed compile record for a template, with counts/input hash and rollback predecessor. Publisher creates it. | Immutable by update/delete triggers. | PK `id`; FK template and prior publication; unique template/sequence; prior target must be published in same template; result-shape/count checks; template/time index. |
| 16 | `document_manifests` | One immutable structural document hash within a template. Compiler creates it. | Immutable by update/delete triggers. | PK `id`; FK template; unique `(template_id,content_hash)`; placement-count check. |
| 17 | `document_manifest_items` | One ordered placement, winning block version, and exact source operation/revision/priority in a manifest. Compiler creates it. | Immutable by update/delete triggers. | PK `(manifest_id,placement_key)`; unique manifest/ordinal; FKs manifest, block version, source revision and source operation; trigger proves the operation is the same-template `set` that selected that version; block/source indexes. |
| 18 | `published_page_documents` | One immutable page/context/manifest result inside one publication. Compiler creates it. | Immutable by update/delete triggers. | PK `(publication_id,page_instance_id)`; composite same-template FKs to publication/page/manifest; unique publication/URL; valid JSON/hash/status checks; serve and manifest indexes. |
| 19 | `current_publications` | The one active publication pointer for a template. Publisher changes it. | Mutable only for atomic activation or rollback. | PK template; unique publication; composite FK/trigger requires a published result for the same template. |

The migration table `_cms_migrations` is operational metadata and is not one of the 19 domain
tables.

## Key row shapes

### Template-owned default

The default document is represented by the same revision/operation mechanism as other layers, with
two special constraints:

```text
variants
  id              = tpl-store:default
  template_id     = tpl-store
  is_default      = 1
  priority        = 0
  active_revision = tpl-store:default:r1

variant_revisions
  id              = tpl-store:default:r1
  variant_id      = tpl-store:default
  revision_number = 1
  selector        = match the whole tpl-store template

variant_operations
  navigation     → set block-store-navigation-v1 + order 0
  primary-hero   → set block-store-hero-v1       + order 1
  category-promo → set block-store-promo-v1      + order 2
  footer         → set block-store-footer-v1     + order 3
```

The partial unique index prevents two defaults for `tpl-store`; database health reports a template
that has none. Nothing in this representation lets the Store default apply to another template.

### Non-conflicting overlap

The seeded McDonald's route `/en-US/store/1001` has three independent memberships:

```text
store_type = chain_store
category   = fast_food
brand      = mcdonalds
```

Three matching layers compose because they target different placement keys:

| Priority | Revision | Operation | Resulting winner |
| ---: | --- | --- | --- |
| 10 | `revision-store-chain-1` | set `footer` | `block-store-footer-v2-chain` |
| 20 | `revision-store-fast-food-1` | set `category-promo` | `block-store-promo-v2-fast` |
| 30 | `revision-store-mcdonalds-1` | set `primary-hero` | `block-store-hero-v2-mcd` |

`navigation` remains from the default. If two matching variants at the same priority touched the
same placement, the domain resolver must fail publication. Creation time and row ID are never
tiebreakers.

### Copy-on-write

The McDonald's hero is the representative copy-on-write shape:

```text
inherited lineage     = lineage-store-primary-hero
inherited version     = block-store-hero-v1
new immutable version = block-store-hero-v2-mcd
parent version        = block-store-hero-v1
local operation       = revision-store-mcdonalds-1 / set primary-hero
```

The default row and inherited block version remain unchanged. The local selector changes only
matching pages. A content edit creates a block version; a pure `order` operation does not.

### Tombstone and revert

The foundation seed contains no tombstone, so the following is an illustrative valid row shape, not
a claim about seeded data:

```text
variant_revision_id = revision-store-mcdonalds-2
placement_key       = category-promo
operation_kind      = tombstone
block_version_id    = NULL
order_index         = NULL
```

Resolution would omit `category-promo` for matching pages while retaining the lower placement in
the provenance trace as hidden. Revert is **not** another operation kind: a later immutable variant
revision simply omits the local tombstone/set for that placement, revealing the lower winner.

The migration's payload check rejects malformed tombstones that carry a block version or order.

## Authoring versus serving access

| Operation | Reads/writes normalized authoring tables | Reads/writes published tables |
| --- | --- | --- |
| Template/slot setup | Write templates/slots/default rows | None until publish |
| RouterService ingestion | Write ingestion/page/slot/tag/audit rows | None; current publication remains stable |
| Selector preview | Read approved page/slot/tag projection and variant revisions | Optionally compare current published document |
| Explicit website preview (`/cms-preview_/*`) | Resolve current draft by template and canonical URL through a read-only connection | None; response is no-store and never activates a publication |
| Block edit | Append block version and variant revision/operations | None until publish |
| Publication | Snapshot/read all required authoring inputs | Insert immutable publication, manifest, item, and page rows; then update pointer |
| Standalone public serve | No authoring-table or selector read | Read current pointer and immutable page/manifest/block rows through `CmsService.serve`, then validate `PublishedDocumentSchema` |
| Rollback | No authoring mutation | Point `current_publications` at a retained prior publication |

The standalone public catch-all and the explicit preview prefix are separate TanStack routes and
separate discriminated view models. A public query parameter—including `edit_mode=true`—is ignored
by the public route validator and cannot select authoring state. The `/admin` route holds no content
rows; it is only a validated-origin handoff to the separately running CMS.

### Concrete Store public-render sequence (`AUT-534`)

The compact seed serves `http://localhost:3001/en-US/store/1001#overview` through the manifest
lane shown below. The URL fragment stays in the browser and is never sent with the HTTP request.
Development permits the loopback host, while the selected template retains its canonical
`www.ubereats.com` domain.

```mermaid
sequenceDiagram
  autonumber
  actor Browser
  participant Route as TanStack public catch-all
  participant Service as CmsService
  participant DB as SQLite read-only
  participant Schema as PublishedDocumentSchema
  participant Registry as React block registry

  Note over Browser,Route: #overview remains in the browser
  Browser->>Route: GET /en-US/store/1001
  Route->>Route: Validate host/path and select tpl-store
  Route->>Service: serve(tpl-store, /en-US/store/1001)
  Service->>DB: Query 1: page + current publication + page document
  DB-->>Service: live + publication-store-1 + manifest-store-mcd-v1 + evaluated placement content
  Note over Service,DB: rendered_document_json is NULL, so use the manifest lane
  Service->>DB: Query 2: ordered manifest identities + provenance
  DB-->>Service: navigation, hero, promo, footer identities + winners
  Note over Service,DB: 2 indexed reads; 0 selector, CEL, or authoring-content queries
  Service->>Service: Join materialized content by stable placement key
  Service->>Schema: Validate order, keys, types, versions, and provenance
  Schema-->>Route: Validated PublishedDocument
  Route->>Registry: Dispatch placements by blockType
  Registry-->>Route: React block tree
  Route-->>Browser: 200 rendered page
  Browser->>Browser: Scroll to #overview
```

The following literal queries make this fixture easy to inspect in a read-only SQLite console.
`CmsService` executes the same shapes with bound `templateId`, `canonicalUrl`, and `manifestId`
parameters rather than constructing SQL from request text.

#### How Query 1 feeds Query 2

Query 1 locates the active immutable page and returns its `manifest_id` plus page-specific,
publish-time-evaluated placement content. Query 2 uses that manifest ID to load the four ordered
block identities and their provenance. The service combines both materialized results; neither
query evaluates selectors, CEL, or mutable authoring content.

```mermaid
sequenceDiagram
  autonumber
  actor Learner as You in WebStorm
  participant DB as auteur.db
  participant Render as CmsService + React

  Learner->>DB: Query 1<br/>template_id = tpl-store<br/>canonical_url = /en-US/store/1001
  DB-->>Learner: route_status = live<br/>publication_id = publication-store-1<br/>manifest_id = manifest-store-mcd-v1<br/>resolved_data_json = evaluated placements
  Note over Learner: Copy manifest_id from the Query 1 result
  Learner->>DB: Query 2<br/>template_id = tpl-store<br/>manifest_id = manifest-store-mcd-v1
  DB-->>Learner: Row 0 navigation<br/>Row 1 McDonald's hero<br/>Row 2 fast-food promo<br/>Row 3 chain-store footer
  Learner->>Render: Join evaluated content to four ordered identities by placement key
  Render-->>Learner: Render input for /en-US/store/1001
```

#### Query 1 — current publication and page document

```sql
SELECT
  pages.route_status AS current_route_status,
  current.publication_id,
  documents.page_instance_id,
  documents.manifest_id,
  documents.document_hash,
  documents.rendered_document_json,
  documents.resolved_data_json
FROM page_instances AS pages
LEFT JOIN current_publications AS current
  ON current.template_id = pages.template_id
LEFT JOIN published_page_documents AS documents
  ON documents.template_id = pages.template_id
  AND documents.page_instance_id = pages.id
  AND documents.publication_id = current.publication_id
WHERE pages.template_id = 'tpl-store'
  AND pages.canonical_url = '/en-US/store/1001';
```

This returns the live route, `publication-store-1`, `page-store-1001`,
`manifest-store-mcd-v1`, the immutable document hash, and the page's
`cms-published-placement-content-v1` map of already-evaluated placement content.
`rendered_document_json` is `NULL`, selecting the manifest lane and its second identity read.

#### Query 2 — ordered manifest blocks and provenance

```sql
SELECT
  items.ordinal,
  items.placement_key,
  items.block_version_id,
  types.key AS block_type,
  items.source_variant_revision_id AS source_revision_id,
  items.source_operation_id,
  items.source_priority
FROM document_manifest_items AS items
JOIN document_manifests AS manifests
  ON manifests.id = items.manifest_id
JOIN block_versions AS versions
  ON versions.id = items.block_version_id
JOIN block_lineages AS lineages
  ON lineages.id = versions.lineage_id
JOIN block_types AS types
  ON types.id = versions.block_type_id
WHERE manifests.template_id = 'tpl-store'
  AND manifests.id = 'manifest-store-mcd-v1'
  AND lineages.template_id = manifests.template_id
ORDER BY items.ordinal;
```

This returns four identity rows in render order: default navigation, McDonald's hero, fast-food
promo, and chain-store footer. Each row includes the block type, exact immutable block version, and
winning operation, revision, and priority used as publication provenance. It intentionally omits
authoring `content_json`.

For this fixture, `rendered_document_json` is `NULL`, so the first read returns the page pointer,
manifest ID, and materialized content map, and the second returns four ordered manifest identities.
An expanded publication would stop after the first read. Neither shape evaluates selectors or CEL,
and neither reads mutable block content on the public path.

## Effective page and provenance inspection SQL

This SQLite query follows only the materialized serving path for one canonical URL. It returns each
ordered placement, winning block type/version, and the variant revision/priority recorded as
provenance. It executes no selector SQL.

```sql
SELECT
  documents.canonical_url,
  documents.route_status,
  documents.document_hash,
  documents.publication_id,
  documents.manifest_id,
  items.ordinal,
  items.placement_key,
  block_types.key AS block_type,
  block_versions.id AS block_version_id,
  block_versions.content_hash AS block_content_hash,
  items.source_variant_revision_id,
  items.source_operation_id,
  items.source_priority
FROM current_publications AS current
JOIN published_page_documents AS documents
  ON documents.publication_id = current.publication_id
  AND documents.template_id = current.template_id
JOIN document_manifest_items AS items
  ON items.manifest_id = documents.manifest_id
JOIN block_versions
  ON block_versions.id = items.block_version_id
JOIN block_types
  ON block_types.id = block_versions.block_type_id
WHERE current.template_id = ?
  AND documents.canonical_url = ?
ORDER BY items.ordinal;
```

For the foundation fixture, bind `tpl-store` and `/en-US/store/1001`. The expected source priorities
in ordinal order are `0`, `30`, `20`, and `10`, matching default navigation, McDonald's hero,
fast-food promo, and chain-store footer.

`CmsService.serveWithEvidence` records the bounded read shape used by the standalone renderer: an
expanded page needs one fixed SQL statement, while a shared-manifest page needs two. Both report
`selectorSqlExecutions: 0`; selector complexity therefore cannot alter public request cost.

To inspect the selected page's scalar dimensions and explicit tag memberships separately:

```sql
SELECT
  pages.canonical_url,
  slots.key AS dimension,
  values_table.value,
  values_table.normalized_value,
  'slot' AS source
FROM page_instances AS pages
JOIN page_slot_values AS values_table
  ON values_table.page_instance_id = pages.id
  AND values_table.template_id = pages.template_id
JOIN template_slots AS slots
  ON slots.id = values_table.slot_id
  AND slots.template_id = pages.template_id
WHERE pages.template_id = ?
  AND pages.canonical_url = ?
UNION ALL
SELECT
  pages.canonical_url,
  tags.namespace AS dimension,
  tags.value,
  tags.value AS normalized_value,
  memberships.source
FROM page_instances AS pages
JOIN page_tags AS memberships
  ON memberships.page_instance_id = pages.id
  AND memberships.template_id = pages.template_id
JOIN tags
  ON tags.id = memberships.tag_id
  AND tags.template_id = pages.template_id
WHERE pages.template_id = ?
  AND pages.canonical_url = ?
ORDER BY dimension, value;
```

This second query is an authoring/inspection query. It belongs in preview and provenance tooling,
not the public request path.

## Constraint notes

- Canonical identity is the template domain plus canonical path. Paths may repeat on different
  domains, but same-domain path duplication cannot silently map to two templates or page instances.
  The service always supplies both template/domain scope and path for authoring or serving lookups.
- The database enforces *at most* one default per template; `inspectDatabaseHealth` enforces *at
  least* one for every configured template.
- Composite foreign keys keep pages, slots, tags, block pointers, manifests, and publications in
  one template.
- Published block versions, route audit rows, variant revisions, publications, manifests, manifest
  items, and published page documents have update/delete immutability triggers.
- Copy-on-write block versions may point to an earlier parent in the same lineage; the parent
  trigger rejects cross-lineage or forward references so fork provenance remains explicit.
- `variant_operations` are immutable with their revision; update/delete triggers force authoring
  changes, tombstone removal, and reordering to create a new revision.
- Every materialized placement records `source_operation_id`; a trigger verifies it names the exact
  same-template `set` operation for the recorded revision and block version.
- A `tombstone` must have neither `block_version_id` nor `order_index`; a `set` must have a block and
  no order; an `order` must have a non-negative order and no block.
- A publication row records the prior published result as a rollback target. The current pointer is
  the only serving-state row intended to change during activation/rollback.
- `published_page_documents.route_status` is the compiled status snapshot; RouterService remains the
  live route authority during transition.

## Validation

The narrow schema evidence commands are:

```bash
bun run db:reset
bun run db:seed
bun run --filter @repo/cms-db test
bun run --filter website test
bun run check:boundaries
```

Final acceptance also requires selector/resolution/publication tests and the evidence in
[`docs/benchmarks.md`](./benchmarks.md); a successful migration alone does not prove the model.
