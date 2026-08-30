# CEL field expressions

`AUT-539` extends the legacy string interpolation form without adding a second syntax:

```text
Buy now {{ store.name }}
{{ store.isOpen ? "Open: " + store.name : "Closed: " + store.name }}
```

Every `{{ ... }}` segment is a CEL expression. Existing dotted paths remain valid CEL. A segment
must evaluate synchronously to a JSON scalar; objects, lists, missing values, unsafe integers,
non-finite numbers, promises, and non-JSON host values fail with a structured error.

## Approved page context

Preview and publication use the same context builder in `CmsService`:

- `context` is the immutable page context object, and `page.context` is the same data under page
  metadata.
- `page` also exposes `id`, `canonicalUrl`, `externalId`, `status`, `revision`, `slots`, and `tags`.
- `route` exposes canonical URL, external ID, status, and revision.
- `slot` and `slots` expose string, integer, and boolean slot values with their declared types.
- `tag` exposes comma-separated legacy tag values; `tags` exposes sorted arrays.
- Legacy top-level page-context, slot, and tag roots remain available when they do not collide with
  the stable aliases above. Page-context aliases are the deterministic union of keys present on the
  template's non-archived pages, not the keys from one representative page. `context.*` remains the
  canonical form; a legacy alias that is absent from the selected page still fails closed at
  evaluation.

Document/database/network/request/user/SQL/time/random roots and functions are unavailable.
`__proto__`, `prototype`, and `constructor` access is rejected. Source length, expression count,
AST depth, AST node count, aggregate literal size, and call argument count are bounded.

## Authoring API

`@repo/cms-domain` exports `inspectInterpolationSample(source, context, { allowedRoots })`. Its
serializable success result includes dependencies, allowed variables, expression count, maximum AST
depth, and evaluated sample text; failure returns the same metadata plus a structured code, message,
field/expression location, and source offsets.

CMS server code should call
`CmsService.inspectBlockFieldInterpolation(templateId, pageId, source)` instead of rebuilding the
context. This method uses the exact aliases and allowlist shared by preview and publication.

Block-version saves compile every interpolated string leaf. Preview evaluates compiled content and
validates the evaluated object against the registered block schema. Publication repeats those gates
for every page inside the publication transaction, so one failure leaves the current-publication
pointer and all publication rows unchanged.

## Public boundary

Publication persists evaluated values. Manifest-mode page rows contain the
`cms-published-placement-content-v1` payload keyed by stable placement key; expanded mode additionally
stores the complete validated `PublishedDocument`. Public serving loads one expanded row or the page
payload plus its immutable manifest. It does not load block `content_json`, compile CEL, evaluate CEL,
or run selector SQL.

Fresh foundation inserts use the materialized placement-content contract. A repeat seed never drops
the published-page immutability trigger and never rewrites an existing historical document.

Compact-scenario reconciliation handles legacy manifest payloads for Store, Eligible Vehicles, and
the structural-replacement proof by publishing an immutable materialized rollback anchor and then a
materialized current publication. An existing compatible v1 partial upgrade is reused as the anchor.
The resulting current publication advertises a serveable predecessor, historical rows remain byte
for byte unchanged, and replay adds no publication rows. Rollback validates every target document
and stored hash before atomically moving the current pointer.
