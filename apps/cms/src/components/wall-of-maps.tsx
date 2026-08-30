import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Database,
  Layers3,
  Map as MapIcon,
  MapPin,
  Search,
  Sheet,
  SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonClassName } from '@/components/ui/button-styles';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ConflictState, PublicationState, ScenarioFixture } from '@/data/scenario-fixtures';
import { cn } from '@/lib/cn';

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function getWallPage(
  templates: ScenarioFixture[],
  query: string,
  pageIndex: number,
  pageSize: number
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = normalizedQuery
    ? templates.filter((scenario) =>
        [scenario.name, scenario.domain, scenario.pattern, scenario.description]
          .join(' ')
          .toLocaleLowerCase()
          .includes(normalizedQuery)
      )
    : templates;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  return {
    rows: matches.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize),
    rowCount: matches.length,
    pageCount,
    pageIndex: safePageIndex,
  };
}

function publicationTone(state: PublicationState): 'success' | 'info' | 'neutral' {
  if (state === 'Published') return 'success';
  if (state === 'Ready to publish') return 'info';
  return 'neutral';
}

function conflictTone(state: ConflictState): 'success' | 'danger' | 'warning' {
  if (state === 'Clear') return 'success';
  if (state === '2 conflicts') return 'danger';
  return 'warning';
}

function MapPreview({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  return (
    <div className="map-grid relative h-[148px] overflow-hidden rounded-lg border border-line bg-surface-subtle">
      <div className="absolute inset-x-3 top-3 flex items-center justify-between text-[9px] font-medium text-ink-faint">
        <span>
          {scenario.dimensions.find((dimension) => dimension.id === scenario.defaultAxes[0])?.label}
        </span>
        <span>
          {scenario.dimensions.find((dimension) => dimension.id === scenario.defaultAxes[1])?.label}{' '}
          →
        </span>
      </div>
      <div className="absolute inset-x-3 bottom-3 top-8 border-b border-l border-line-strong/60">
        {scenario.projectionPoints.slice(0, 24).map((point) => {
          const hasOverlay = point.layerIds.length > 1;
          const conflict = point.layerIds.some((layerId) => layerId.includes('conflict'));
          return (
            <span
              key={point.id}
              aria-hidden="true"
              className={cn(
                'absolute -translate-x-1/2 translate-y-1/2 rounded-full border bg-canvas shadow-sm',
                conflict
                  ? 'size-3 border-danger bg-danger-soft'
                  : hasOverlay
                    ? 'size-2.5 border-accent/50 bg-accent-soft'
                    : 'size-2 border-line-strong'
              )}
              style={{ left: `${point.x}%`, bottom: `${point.y}%` }}
            />
          );
        })}
      </div>
      <div className="absolute bottom-2 left-4 rounded border border-line bg-canvas/95 px-1.5 py-1 text-[9px] text-ink-muted shadow-sm">
        {scenario.preview === 'dense'
          ? 'dense variation'
          : scenario.preview === 'sparse'
            ? 'sparse overlays'
            : 'structural override'}
      </div>
      <Badge tone="neutral" className="absolute bottom-2 right-2 h-5 bg-canvas/95 text-[9px]">
        {scenario.scaleCue} scale
      </Badge>
    </div>
  );
}

function TemplateCard({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  const descriptionId = `${scenario.id}-description`;

  return (
    <Card className="group overflow-hidden transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_10px_30px_rgba(22,22,26,0.06)]">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
              {scenario.domain}
            </p>
            <h2 className="mt-1 truncate text-base font-semibold tracking-[-0.018em] text-ink">
              {scenario.name}
            </h2>
          </div>
          {scenario.conflictState === '2 conflicts' ? (
            <CircleAlert
              aria-label="Publication has conflicts"
              className="size-4 shrink-0 text-danger"
            />
          ) : (
            <CheckCircle2
              aria-label="Resolution is deterministic"
              className="size-4 shrink-0 text-success"
            />
          )}
        </div>
        <code className="block truncate rounded-md border border-line bg-surface-subtle px-2.5 py-2 font-mono text-[11px] text-ink-muted">
          {scenario.pattern}
        </code>
      </CardHeader>

      <CardContent className="space-y-4">
        <MapPreview scenario={scenario} />
        <p id={descriptionId} className="min-h-12 text-xs leading-5 text-ink-muted">
          {scenario.description}
        </p>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
              Dimensions
            </p>
            <span className="text-[9px] text-ink-faint">source kind</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scenario.dimensions.map((dimension) => (
              <Badge key={dimension.id} className="font-mono text-[10px]">
                {dimension.id}
                <span className="font-sans text-[9px] opacity-65">
                  · {dimension.kind} · {dimension.kind === 'tag' ? 'multi-valued' : 'scalar'}
                </span>
              </Badge>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-subtle">
          <div className="px-3 py-2.5">
            <dt className="text-[10px] text-ink-faint">Instances</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-ink">
              {compactNumber.format(scenario.instanceCount)}
            </dd>
          </div>
          <div className="px-3 py-2.5">
            <dt className="text-[10px] text-ink-faint">Sheets</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-ink">
              {scenario.variantCount}
            </dd>
          </div>
          <div className="px-3 py-2.5">
            <dt className="text-[10px] text-ink-faint">Inherited</dt>
            <dd className="mt-0.5 text-[13px] font-semibold tabular-nums text-ink">
              {scenario.inheritance}%
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap gap-1.5">
          <Badge dot tone={publicationTone(scenario.publicationState)}>
            {scenario.publicationState}
          </Badge>
          <Badge dot tone={conflictTone(scenario.conflictState)}>
            {scenario.conflictState}
          </Badge>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-3 border-t border-line py-3">
        <span className="truncate text-[10px] text-ink-faint">
          Published {scenario.lastPublished}
        </span>
        <Link
          to="/author/$templateId"
          params={{ templateId: scenario.id }}
          search={{ canonicalUrl: scenario.pin.canonicalUrl }}
          aria-describedby={descriptionId}
          className={buttonClassName({ size: 'sm' })}
        >
          Inspect map <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}

const glossary = [
  { icon: MapIcon, term: 'Map', definition: 'One template and its complete URL space.' },
  { icon: MapPin, term: 'Point', definition: 'One concrete URL instance inside a map.' },
  {
    icon: Sheet,
    term: 'Sheet',
    definition: 'A selector-scoped variant layer applied by priority.',
  },
  { icon: Boxes, term: 'Pin', definition: 'The full resolution trace for one URL.' },
  {
    icon: SlidersHorizontal,
    term: 'Projection',
    definition: 'A selectable two-axis view of higher-dimensional data.',
  },
] as const;

export function WallOfMaps({ templates }: Readonly<{ templates: ScenarioFixture[] }>) {
  const [query, setQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 2;
  const listing = useQuery({
    queryKey: ['wall-of-maps', query, pageIndex, pageSize],
    queryFn: async () => getWallPage(templates, query, pageIndex, pageSize),
    initialData: () => getWallPage(templates, query, pageIndex, pageSize),
  });
  const totalInstances = templates.reduce((sum, scenario) => sum + scenario.instanceCount, 0);
  const totalVariants = templates.reduce((sum, scenario) => sum + scenario.variantCount, 0);

  return (
    <div className="mx-auto w-full max-w-[1540px] px-4 py-5 sm:px-5 sm:py-6 lg:px-7 lg:py-7">
      <section className="mb-6 flex flex-col justify-between gap-4 border-b border-line pb-6 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone="info" className="uppercase tracking-[0.08em]">
              Model proof
            </Badge>
            <Badge tone="warning" className="uppercase tracking-[0.08em]">
              Demo fixtures
            </Badge>
            <span className="text-[11px] text-ink-faint">3 required scenarios</span>
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.035em] text-ink sm:text-[30px]">
            Wall of Maps
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-ink-muted">
            Find a template map, inspect its selector sheets, and pin any concrete URL to explain
            the final document.
          </p>
        </div>
        <label htmlFor="map-search" className="relative block w-full lg:w-[320px]">
          <span className="sr-only">Search maps</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-2.5 size-4 text-ink-faint"
          />
          <Input
            id="map-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setPageIndex(0);
            }}
            placeholder="Search domain, pattern, or scenario"
            className="pl-9"
          />
        </label>
      </section>

      <section aria-label="CMS model overview" className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-faint">
            Concrete points
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.025em] tabular-nums text-ink">
            {compactNumber.format(totalInstances)}
          </p>
          <p className="mt-1 text-[10px] text-ink-faint">
            Fixture cardinality target; cards use categorical scale cues
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-faint">
            Selector sheets
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.025em] tabular-nums text-ink">
            {totalVariants}
          </p>
          <p className="mt-1 text-[10px] text-ink-faint">
            Sparse operations with explicit priority
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-faint">
            Serving model
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Database aria-hidden="true" className="size-4 text-success" />
            <p className="text-sm font-semibold text-ink">Immutable manifests</p>
          </div>
          <p className="mt-1 text-[10px] text-ink-faint">Public reads never execute selector SQL</p>
        </Card>
      </section>

      <section
        aria-label="Template maps"
        aria-busy={listing.isFetching}
        className="grid gap-4 lg:grid-cols-2"
      >
        {listing.data.rows.map((scenario) => (
          <TemplateCard key={scenario.id} scenario={scenario} />
        ))}
      </section>

      {listing.data.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-canvas p-10 text-center">
          <p className="text-sm font-medium text-ink">No maps match “{query}”.</p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="mt-2 text-xs font-medium text-accent-strong underline underline-offset-4"
          >
            Clear search
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between border-b border-line pb-5">
        <p className="text-[11px] text-ink-faint">
          Showing {listing.data.rows.length} of {listing.data.rowCount} maps · page{' '}
          {listing.data.pageIndex + 1} of {listing.data.pageCount}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous map page"
            disabled={listing.data.pageIndex === 0}
            onClick={() => setPageIndex((value) => Math.max(0, value - 1))}
            className={buttonClassName({ variant: 'outline', size: 'icon' })}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next map page"
            disabled={listing.data.pageIndex + 1 >= listing.data.pageCount}
            onClick={() => setPageIndex((value) => Math.min(listing.data.pageCount - 1, value + 1))}
            className={buttonClassName({ variant: 'outline', size: 'icon' })}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <section
        aria-labelledby="glossary-heading"
        className="mt-5 rounded-xl border border-line bg-canvas p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Layers3 aria-hidden="true" className="size-4 text-accent" />
          <h2 id="glossary-heading" className="text-xs font-semibold text-ink">
            Relational legend · how to read this prototype
          </h2>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {glossary.map(({ icon: Icon, term, definition }) => (
            <div key={term} className="rounded-lg bg-surface-subtle p-3">
              <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
                <Icon aria-hidden="true" className="size-3.5 text-accent" />
                {term}
              </dt>
              <dd className="mt-1 text-[10px] leading-4 text-ink-muted">{definition}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
