# Self-serve template lifecycle

This prototype flow is owned by AUT-558 and its AUT-559–AUT-565 child issues. It turns one
ordered URL grammar into concrete RouterService-owned pages, a blank default document, sparse
selector variations, and immutable public releases.

## URL slots and CSV inputs

Slots are ordered path segments. The MVP accepts three slot shapes:

- a static segment, such as `profiles`;
- one `locale` variable segment;
- one `slug` variable segment.

The required `tags` dimension is queryable but is not a URL segment and never multiplies route
cardinality. Tags are assigned after route creation from the Content Explorer table.

Variable inputs are UTF-8 CSV documents with exactly one column. A locale file uses the exact
`locale` header:

```csv
locale
en-US
fr-CA
```

A slug file uses the exact `slug` header:

```csv
slug
standard
vip
```

The preview reports normalized values, row-addressable errors, the exact Cartesian product, and a
bounded URL sample. Creation is enabled only for the exact preview fingerprint. The service rejects
blank or duplicate normalized values, malformed CSV, invalid one-segment slugs, duplicate slot
identity, and products above the configured page limit. The complete template, blank default
variant, ordered slots, ingestion evidence, pages, and slot values commit in one transaction or not
at all.

## Authoring and publication

A new template opens on its blank default variation. Adding `avatar`, `hero`, and `footer` creates
three stable placement identities and immutable block versions. Publishing compiles every live page
atomically; the public request path reads only the materialized document and never runs selector
SQL.

Creating a linked selector variation stores its constrained predicate and starts with zero local
block operations. Its blocks remain pointers to lower-layer versions. Saving an edit to one
inherited placement performs copy-on-write: exactly one new immutable block version is created with
the inherited version as its parent, while every untouched placement keeps its existing version
pointer. A later publication renders that fork only on pages matched by the selector.

Production identity is canonical host plus canonical path. Local development may use the explicit
localhost exception only when that path identifies exactly one persisted template; ambiguous paths
fail closed.
