# Schema-driven authoring form UX

AUT-556 aligns the Auteur block inspector with the hierarchy of Sanity Studio forms while keeping
Auteur's explicit Save, immutable-version, selector, and publication semantics.

## Design contract

The field wrapper and the value input are separate concerns.

A field wrapper owns:

- the author-facing label and optional description;
- required state and path-scoped validation;
- quiet schema metadata and change status;
- expression assistance when the leaf is CEL-eligible; and
- nesting/disclosure for structured values.

The input owns only the value interaction appropriate to its registered schema type. Fields retain
schema order. Nested object paths use dot notation in the form draft, then reconstruct JSON objects
before the existing server validation and immutable save boundary.

## Supported control mapping

| Registered shape | Primary control |
| --- | --- |
| `string` | Compact text input |
| scalar `enum` | Select with an explicit unset option when optional |
| `number` | Numeric input with any finite step |
| `integer` | Numeric input constrained to whole-number steps |
| `boolean` | Switch with a distinct optional unset action |
| object with declared properties | Collapsible fieldset, one left hierarchy rule, recursively rendered children |
| schema-less object | Monospace JSON fallback |
| array | Monospace JSON fallback that exposes the registered or inferred item kind |

Advanced raw JSON remains available as an escape hatch. It is not the primary happy path.

## Visual hierarchy

- Content fields lead; stable placement identity, registered block type, and insertion controls sit
  in a secondary Block settings disclosure.
- Primitive fields use a label, quiet key/type metadata, optional description, control, and inline
  error. A thin accent gutter appears only for fields changed in the current form session.
- Nested objects use whitespace, a chevron, indentation, and one vertical rule rather than cards
  nested inside cards.
- CEL evaluation remains available for string leaves, but lives under an Expression tools
  disclosure so literal editing remains visually primary.
- The legacy required-only schema adapter is identified in a quiet metadata disclosure; it does not
  present itself as an error.
- History leads with draft/publication state and a revision timeline. IDs and hashes are retained in
  Technical provenance disclosures.

## Inspector rail behavior

Fields and History remain two modes of one right inspector. The shared rail:

- is 390px wide and independently scrollable when expanded;
- collapses to 44px so the website-shaped canvas reclaims the space;
- keeps the same button mounted, focused, and associated through `aria-controls` and
  `aria-expanded`;
- uses an east-resize cursor to collapse and west-resize cursor to expand;
- preserves the active tab, field values, disclosure state, and unsaved-change guard; and
- hides the rail control and forces panel content visible below the desktop breakpoint, where the
  inspector becomes stacked content rather than a competing side rail.

Grid movement uses the existing motion tokens and is disabled by the repository-wide reduced-motion
rule.

## Sanity concepts adopted

The implementation follows these current Sanity Studio concepts:

- schemas determine form order and field types;
- a field contains its label, description, status, validation, and type-specific input;
- nested objects preserve hierarchy through indentation and disclosure;
- booleans use switch-like controls, scalar lists use choices, and arrays communicate their item
  model;
- field groups, fieldsets, and objects are separate concepts; and
- revision history is a distinct inspector concern with technical detail available on demand.

Primary references:

- [Schemas and forms](https://www.sanity.io/docs/studio/schemas-and-forms)
- [Form components](https://www.sanity.io/docs/studio/form-components)
- [Schema types](https://www.sanity.io/docs/studio/schema-types)
- [Object type and collapsible fieldsets](https://www.sanity.io/docs/studio/object-type)
- [Focus and UI state in custom inputs](https://www.sanity.io/docs/studio/focus-and-ui-state-in-custom-inputs)
- [Field groups](https://www.sanity.io/docs/studio/field-groups)
- [Validation](https://www.sanity.io/docs/studio/validation)
- [History experience](https://www.sanity.io/docs/user-guides/history-experience)

## Deliberate differences and remaining limits

- Auteur keeps explicit Save and publication review. It does not adopt Sanity's real-time patch or
  presence model.
- History is block-version and resolution provenance, not a promise of full document diffing.
- Arrays remain typed JSON until the schema contract carries enough item identity and editor
  metadata for safe add, remove, and reorder controls.
- The current registry supports JSON Schema's string, number, integer, boolean, object, array, and
  scalar enum subset. Date, datetime, URL, slug, reference, image, and Portable Text controls are not
  implied.
- The server validator supports additional constraints. Surfacing every constraint beside its input
  is follow-up work and must not weaken the server as the final authority.
- Existing required-only v1 schemas remain immutable and use the compatibility adapter. Richer
  authoring metadata should be introduced through a versioned schema/editor contract, not by
  rewriting historical rows.
