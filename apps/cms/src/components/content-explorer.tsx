import { Link, useNavigate } from '@tanstack/react-router';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  ListTree,
  Search,
  Table2,
} from 'lucide-react';
import * as z from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  type ContentExplorerPage,
  type ContentExplorerSearch,
  ContentExplorerSearchSchema,
  ContentExplorerSnapshotSchema,
  type ContentTemplateSummary,
} from '@/data/content-explorer';
import { cn } from '@/lib/cn';

const ContentExplorerPropsSchema = z.object({
  snapshot: ContentExplorerSnapshotSchema,
  search: ContentExplorerSearchSchema,
});
type ContentExplorerProps = z.infer<typeof ContentExplorerPropsSchema>;

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestampFormatter.format(timestamp);
}

function routeTone(status: ContentExplorerPage['routeStatus']): 'success' | 'warning' | 'neutral' {
  if (status === 'live') return 'success';
  if (status === 'not_live') return 'warning';
  return 'neutral';
}

function draftLabel(state: ContentTemplateSummary['draftState']): string {
  if (state === 'current') return 'No draft changes';
  if (state === 'changes') return 'Draft changes';
  return 'Not published';
}

function selectedTemplate(
  templates: readonly ContentTemplateSummary[],
  selectedSlug: ContentExplorerSearch['template']
): ContentTemplateSummary {
  const selected = templates.find((template) => template.slug === selectedSlug);
  if (!selected) throw new Error(`Selected fixed template "${selectedSlug}" was not loaded.`);
  return selected;
}

function pathSegments(segments: readonly string[]): readonly { segment: string; path: string }[] {
  let path = '';
  return segments.map((segment) => {
    path = `${path}/${segment}`;
    return { segment, path };
  });
}

function TemplateSummary({
  template,
  active,
  view,
}: Readonly<{
  template: ContentTemplateSummary;
  active: boolean;
  view: ContentExplorerSearch['view'];
}>) {
  return (
    <Link
      to="/content"
      search={{ view, template: template.slug, q: '', cursor: undefined }}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'block min-w-0 rounded-lg border p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus',
        active
          ? 'border-accent/35 bg-accent-soft/60'
          : 'border-line bg-canvas hover:border-line-strong hover:bg-surface-muted'
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">{template.name}</p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-ink-faint">
            {template.urlPattern}
          </p>
        </div>
        <Badge tone={template.publicationState === 'published' ? 'success' : 'warning'} dot>
          {template.publicationState === 'published' ? 'Published' : 'Unpublished'}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-muted">
        <span>{template.pageCount.toLocaleString()} pages</span>
        <span>{template.variantCount.toLocaleString()} variants</span>
        <span>{template.livePageCount.toLocaleString()} live</span>
        <span>{draftLabel(template.draftState)}</span>
      </div>
    </Link>
  );
}

function PagePath({ page }: Readonly<{ page: ContentExplorerPage }>) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {pathSegments(page.segments).map(({ segment, path }, index) => {
        const leaf = index === page.segments.length - 1;
        return (
          <span key={`${page.id}:${path}`} className="contents">
            {index > 0 ? (
              <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-ink-faint" />
            ) : null}
            <span className={cn('flex min-w-0 items-center gap-1', leaf && 'font-medium text-ink')}>
              {leaf ? (
                <FileText aria-hidden="true" className="size-3.5 shrink-0 text-accent-strong" />
              ) : (
                <Folder aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
              )}
              <span className="truncate">{segment}</span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

function PageLink({
  page,
  templateSlug,
}: Readonly<{
  page: ContentExplorerPage;
  templateSlug: ContentExplorerSearch['template'];
}>) {
  return (
    <Link
      to="/author/$templateId"
      params={{ templateId: templateSlug }}
      search={{ canonicalUrl: page.canonicalUrl }}
      aria-label={`Open ${page.canonicalUrl} in the authoring studio`}
      className="min-w-0 flex-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <PagePath page={page} />
    </Link>
  );
}

function TreeView({
  snapshot,
  view,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  view: ContentExplorerSearch['view'];
}>) {
  return (
    <nav
      aria-label="Canonical URL tree — navigation only, with no content inheritance"
      aria-describedby="content-tree-description"
    >
      <p id="content-tree-description" className="mb-3 text-xs leading-5 text-ink-muted">
        Folder rows explain URL grammar only. They do not inherit content; every page retains one
        canonical template and page identity.
      </p>
      <ul className="space-y-2">
        {snapshot.templates.map((template) => {
          const active = template.slug === snapshot.selectedTemplate;
          return (
            <li key={template.templateId}>
              <details
                open={active || undefined}
                className="group rounded-lg border border-line bg-canvas open:border-line-strong"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
                  <FolderOpen aria-hidden="true" className="size-4 shrink-0 text-accent-strong" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">
                      {template.name}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-ink-faint">
                      {template.domain}
                    </span>
                  </span>
                  <span className="text-[11px] tabular-nums text-ink-muted">
                    {template.pageCount.toLocaleString()} pages
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-90"
                  />
                </summary>

                <div className="border-t border-line px-3 py-3">
                  <ol
                    aria-label={`${template.name} URL grammar`}
                    className="flex flex-wrap gap-1.5"
                  >
                    {template.grammar.map((segment, index) => (
                      <li key={segment.key} className="flex items-center gap-1.5">
                        {index > 0 ? (
                          <ChevronRight aria-hidden="true" className="size-3 text-ink-faint" />
                        ) : null}
                        <span
                          className={cn(
                            'rounded-md border px-2 py-1 font-mono text-[10px]',
                            segment.kind === 'variable'
                              ? 'border-accent/25 bg-accent-soft text-accent-strong'
                              : 'border-line bg-surface-muted text-ink-muted'
                          )}
                          title={`${segment.label} · ${segment.kind}`}
                        >
                          {segment.value}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {active ? (
                    snapshot.pages.length > 0 ? (
                      <ul
                        aria-label={`${template.name} canonical pages`}
                        className="mt-3 space-y-1"
                      >
                        {snapshot.pages.map((page) => (
                          <li
                            key={page.id}
                            className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2 text-xs text-ink-muted hover:border-line hover:bg-surface-muted"
                          >
                            <PageLink page={page} templateSlug={template.slug} />
                            <Badge tone={routeTone(page.routeStatus)} dot>
                              {page.routeStatus.replace('_', ' ')}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 rounded-md border border-dashed border-line p-4 text-xs text-ink-muted">
                        No canonical URLs match this search.
                      </p>
                    )
                  ) : (
                    <Link
                      to="/content"
                      search={{ view, template: template.slug, q: '', cursor: undefined }}
                      className="mt-3 inline-flex rounded-md text-xs font-medium text-accent-strong outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      Browse this template
                    </Link>
                  )}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function TableView({
  snapshot,
  template,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  template: ContentTemplateSummary;
}>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[860px] border-collapse text-left text-xs">
        <caption className="sr-only">Persisted canonical pages for {template.name}</caption>
        <thead className="bg-surface-muted text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          <tr>
            <th scope="col" className="px-3 py-2.5">
              Canonical URL
            </th>
            <th scope="col" className="px-3 py-2.5">
              Route
            </th>
            <th scope="col" className="px-3 py-2.5">
              Draft
            </th>
            <th scope="col" className="px-3 py-2.5">
              Publication
            </th>
            <th scope="col" className="px-3 py-2.5">
              Last modified
            </th>
            <th scope="col" className="px-3 py-2.5">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {snapshot.pages.map((page) => (
            <tr key={page.id} className="border-t border-line bg-canvas hover:bg-surface-muted">
              <th scope="row" className="max-w-[360px] px-3 py-3 font-mono font-medium text-ink">
                <span className="block truncate" title={page.canonicalUrl}>
                  {page.canonicalUrl}
                </span>
              </th>
              <td className="px-3 py-3">
                <Badge tone={routeTone(page.routeStatus)} dot>
                  {page.routeStatus.replace('_', ' ')}
                </Badge>
              </td>
              <td className="px-3 py-3 text-ink-muted">{draftLabel(template.draftState)}</td>
              <td className="px-3 py-3">
                <Badge tone={page.publicationState === 'published' ? 'success' : 'warning'}>
                  {page.publicationState === 'published' ? 'Published' : 'Not published'}
                </Badge>
              </td>
              <td className="px-3 py-3 text-ink-muted">{formatTimestamp(page.updatedAt)}</td>
              <td className="px-3 py-3">
                <Link
                  to="/author/$templateId"
                  params={{ templateId: template.slug }}
                  search={{ canonicalUrl: page.canonicalUrl }}
                  className="inline-flex h-8 items-center rounded-md border border-line-strong bg-canvas px-3 font-medium text-ink outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
                >
                  Open studio
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {snapshot.pages.length === 0 ? (
        <p className="border-t border-line bg-canvas px-4 py-10 text-center text-xs text-ink-muted">
          No canonical URLs match this search.
        </p>
      ) : null}
    </div>
  );
}

function Pagination({
  search,
  previousCursor,
  nextCursor,
  visibleCount,
  totalCount,
}: Readonly<{
  search: ContentExplorerSearch;
  previousCursor: string | null;
  nextCursor: string | null;
  visibleCount: number;
  totalCount: number;
}>) {
  return (
    <nav aria-label="Canonical page pagination" className="flex items-center justify-between gap-3">
      <p className="text-[11px] text-ink-muted" aria-live="polite">
        Showing {visibleCount.toLocaleString()} of {totalCount.toLocaleString()} matching pages
      </p>
      <div className="flex items-center gap-2">
        {previousCursor ? (
          <Link
            to="/content"
            search={{ ...search, cursor: previousCursor }}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-canvas px-3 text-xs font-medium text-ink outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
          >
            <ChevronLeft aria-hidden="true" className="size-3.5" />
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface-muted px-3 text-xs font-medium text-ink-faint"
          >
            <ChevronLeft aria-hidden="true" className="size-3.5" />
            Previous
          </span>
        )}
        {nextCursor ? (
          <Link
            to="/content"
            search={{ ...search, cursor: nextCursor }}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-canvas px-3 text-xs font-medium text-ink outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus"
          >
            Next
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface-muted px-3 text-xs font-medium text-ink-faint"
          >
            Next
            <ChevronRight aria-hidden="true" className="size-3.5" />
          </span>
        )}
      </div>
    </nav>
  );
}

export function ContentExplorer({ snapshot, search }: Readonly<ContentExplorerProps>) {
  const navigate = useNavigate({ from: '/content' });
  const template = selectedTemplate(snapshot.templates, snapshot.selectedTemplate);

  return (
    <section className="mx-auto w-full max-w-[1480px] space-y-4 p-4 sm:p-5 lg:p-6">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            SQLite content
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">
            Content explorer
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-muted">
            Browse the three provisioned templates and open a concrete canonical page in the
            authoring studio.
          </p>
        </div>

        <search className="w-full max-w-xl">
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const nextSearch = ContentExplorerSearchSchema.parse({
                ...search,
                q: formData.get('q'),
                cursor: undefined,
              });
              void navigate({ search: nextSearch });
            }}
          >
            <label htmlFor="content-search" className="sr-only">
              Search canonical URLs in {template.name}
            </label>
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
              />
              <Input
                key={`${snapshot.selectedTemplate}:${search.q}`}
                id="content-search"
                name="q"
                type="search"
                maxLength={120}
                defaultValue={search.q}
                placeholder={`Search ${template.name} URLs`}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
        </search>
      </header>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Fixed templates" className="min-w-0 space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Templates
            </h2>
            <span className="text-[10px] text-ink-faint">Fixed · 3</span>
          </div>
          {snapshot.templates.map((candidate) => (
            <TemplateSummary
              key={candidate.templateId}
              template={candidate}
              active={candidate.slug === snapshot.selectedTemplate}
              view={search.view}
            />
          ))}
        </aside>

        <Card className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-col justify-between gap-3 border-b border-line pb-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold text-ink">{template.name}</h2>
                <Badge tone={template.status === 'active' ? 'success' : 'neutral'} dot>
                  {template.status}
                </Badge>
                <Badge tone={template.draftState === 'changes' ? 'warning' : 'neutral'}>
                  {draftLabel(template.draftState)}
                </Badge>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-ink-muted">
                {template.domain}
                {template.urlPattern}
              </p>
            </div>

            <nav aria-label="Explorer view" className="flex rounded-lg bg-surface-muted p-1">
              <Link
                to="/content"
                search={{ ...search, view: 'tree', cursor: undefined }}
                aria-current={search.view === 'tree' ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  search.view === 'tree'
                    ? 'bg-canvas text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                <ListTree aria-hidden="true" className="size-3.5" />
                Tree
              </Link>
              <Link
                to="/content"
                search={{ ...search, view: 'table', cursor: undefined }}
                aria-current={search.view === 'table' ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  search.view === 'table'
                    ? 'bg-canvas text-ink shadow-sm'
                    : 'text-ink-muted hover:text-ink'
                )}
              >
                <Table2 aria-hidden="true" className="size-3.5" />
                Table
              </Link>
            </nav>
          </div>

          {search.view === 'tree' ? (
            <TreeView snapshot={snapshot} view={search.view} />
          ) : (
            <TableView snapshot={snapshot} template={template} />
          )}

          <div className="mt-4 border-t border-line pt-4">
            <Pagination
              search={search}
              previousCursor={snapshot.previousCursor}
              nextCursor={snapshot.nextCursor}
              visibleCount={snapshot.pages.length}
              totalCount={snapshot.filteredCount}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
