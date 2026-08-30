# Median import provenance

## Audited source

- Pull request: [matthewharwood/median#15](https://github.com/matthewharwood/median/pull/15)
- Title: `Migrate CMS and docs to TanStack Start`
- Head branch: `codex/new-branch`
- Audited head: `277f9b7c55668a320e52a8e68e136b6ef712ec0b`
- Base: `main`
- State at audit: open, merge state `CLEAN`
- Audit date: 2026-08-29
- Temporary checkout: `.tmp/median-pr-15` (ignored; never part of the deliverable)

The temporary checkout and `/Users/matthewharwood/Documents/GitHub/median` both resolved to the
audited pull-request head when the prototype was bootstrapped.

## Reused intentionally

- Bun workspace and Turborepo task structure.
- TanStack Start's Vite plugin, generated file-route tree, router registration, document hydration,
  and server-function boundary.
- The compact fixed sidebar, full-height work surface, dense data HUD, restrained motion, and
  neutral/zinc design language from Median's admin interface.
- React 19, TypeScript, Tailwind CSS 4, Bun test, Biome, and Fallow conventions.
- Relevant domain-independent UI patterns such as cards, badges, tables, tabs, dialogs, sheets,
  comboboxes, tooltips, and compact navigation.
- Median's standalone renderer flow: a file-based public catch-all feeds a server assembly boundary,
  then synchronously dispatches typed blocks through a small registry. The audited donors were
  `apps/docs/src/routes/$.tsx`, `apps/renderer/lib/proxy-core.ts`, and
  `apps/renderer/lib/tanstack/proxy.ts`; Auteur reimplements the flow over an active SQLite
  publication instead of Median's services.
- Median's reserved preview-route topology in `apps/docs/src/routes/[cms-preview_].tsx`,
  `[cms-preview_].index.tsx`, and `[cms-preview_].$.tsx`. Auteur retains the explicit prefix so a
  public route and an authoring preview cannot become the same request mode.
- Median's CEL wrapper shape at the same audited head: compile and evaluate return discriminated
  structured results, native CEL parsing supplies dependency metadata, and integer values are
  normalized before crossing JSON. Auteur reimplements that shape in `@repo/cel-engine` with the
  exact audited runtime version `@marcbachmann/cel-js@7.6.1` and its own page-only capability
  policy, bounds, reusable compiled expressions, and deterministic output normalization.

The implementation is pared down and recomposed from shadcn-style primitives instead of copying
Median's entire product-specific component graph.

The HUD was also checked against the current official
[shadcn blocks catalog](https://ui.shadcn.com/blocks). Its closest composition reference is
`dashboard-01`: an inset/sidebar shell, compact site header, section cards, and a bounded data
table. This prototype keeps that composition vocabulary while replacing the example chart and
generic dashboard data with the wall of maps, projection controls, layer stack, instance table,
vertical provenance pin, and publication trace. Components remain checked-in source primitives;
there is no runtime dependency on the catalog or its CLI.

The [Profound hybrid admin-panel proxy guide](https://cms.docs.tryprofound.com/hybrid/setup-admin-panel-proxy)
was used as an additional topology reference: keep the authoring entry point separate, reserve an
explicit preview namespace, and leave ordinary storefront routes in their published mode. Auteur's
standalone TanStack application implements that intent as `/admin`, `/cms-preview_/*`, and a public
catch-all. It does **not** copy the guide as a framework-specific proxy recipe.

## Replaced intentionally

- PostgreSQL, Supabase/PostgREST, RLS, Supavisor, and route-binding inheritance.
- WorkOS authentication and organization/website tenancy.
- Median's CEL document-fetch surface, asynchronous dependency resolution, clock helpers, and
  request/user capabilities. Auteur CEL receives only approved synchronous page JSON, while
  selectors remain the constrained, template-scoped DSL compiled by `@repo/cms-service`; public
  rendering evaluates neither CEL nor selector SQL.
- Vercel, Bunny, ImageKit, Sentry, GitHub deployment, and production API integrations.
- Rust image/MCP/translation services, TensorZero, Terraform, and Docker deployment surfaces.
- Louvre-style block multi-resolve and Median's existing document/route storage model.
- Lexical, Monaco, media management, translation, and AI features that do not prove this model.
- Median's `edit_mode` public-route rewrite, blind proxying, and Supabase/WorkOS-backed admin/API/auth
  path. `/cms-preview_/*` is the only draft renderer, and `/admin` is a validated-origin handoff
  page—not an iframe, reverse proxy, `/api` surface, or authentication implementation.

The replacement is a local SQLite database whose schema is owned by committed Drizzle definitions
and migrations. The selector-overlay Auteur domain remains authoritative even when a Median type or
screen appears superficially similar.

The standalone website reads that database with `readonly: true` and `create: false`. Public
requests call the immutable `CmsService.serve` boundary and validate its `PublishedDocumentSchema`
before a shared `navigation`/`hero`/`hero_alt`/`promo`/`footer` registry renders stable placement
keys. Preview reads the current authoring resolution only under `/cms-preview_/*`; the two result
types are deliberately discriminated and cannot be selected by a public query parameter.

## SQLite driver decision

The revised user direction explicitly makes Bun part of the prototype stack. The implementation
uses `bun:sqlite` behind `@repo/cms-db` for deterministic local execution and million-row fixture
performance. SQL, migrations, and domain interfaces remain portable; the production ADR must call
out the driver boundary and the TiDB differences. Browser code never imports the database driver.

## Prior-project skills

The Median repository contains no checked-in `.agents`, `.claude`, `.codex`, or `SKILL.md` files.
The most recently active prior Bun/Turborepo/TanStack project is `mind-palace` at commit
`5ab3b4df77c37358f8ce578a0aac482c7b8f4635`. The source worktree had three untracked skill
directories at that commit—`extract-curriculum`, `litertjs`, and `source-command-kill-servers`—and
they are included because the request is to preserve every current source skill, not only the
Git-tracked subset.

The complete working-tree `.agents/skills` snapshot is preserved under
`.agents/skills/_imported/mind-palace` for traceability: 71 `SKILL.md` files and 115 files total. The
deterministic tree digest is
`c8c2ae9948af945230ae352400ba8124a7130ecd3945de8119d989b07ace0b17`; it hashes each
byte-lexicographically sorted relative path, a NUL separator, its bytes, and another NUL with
SHA-256. `bun run skills:verify` enforces the count and digest without depending on the source
checkout.

Stack-relevant skills are promoted into `.agents/skills`; the repository-specific
`five-phase-pass` is rewritten for Auteur instead of retaining game, generator, Storybook, Pixi,
Firebase, or deployment claims that do not apply here.

This preserves every source skill while preventing unrelated app-specific skills from being
mistaken for CMS requirements.
