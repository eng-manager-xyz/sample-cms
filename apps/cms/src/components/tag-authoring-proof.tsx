import { Check, Database, Eye, Tags } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getInstancePage, type ScenarioFixture } from '@/data/scenario-fixtures';

function normalizeTagValue(value: string): string {
  return value
    .toLocaleLowerCase()
    .replaceAll("'", '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function TagAuthoringProof({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  const tagDimensions = scenario.dimensions.filter((dimension) => dimension.kind === 'tag');
  const firstDimension = tagDimensions[0];
  const [dimensionId, setDimensionId] = useState(firstDimension?.id ?? '');
  const selectedDimension =
    tagDimensions.find((dimension) => dimension.id === dimensionId) ?? firstDimension;
  const [selectedValue, setSelectedValue] = useState(firstDimension?.values[0] ?? '');
  const [query, setQuery] = useState('');
  const [auditMessage, setAuditMessage] = useState(
    'No fixture assignment preview has been applied.'
  );

  if (!selectedDimension) {
    return (
      <div className="rounded-lg border border-line bg-canvas p-4 text-[11px] text-ink-muted">
        This template has no multi-valued tag dimensions.
      </div>
    );
  }

  const normalizedValue = normalizeTagValue(selectedValue);
  const selectedTag = `${selectedDimension.id}:${normalizedValue}`;
  const matchingLayer = scenario.layers.find((layer) =>
    layer.selector.toLocaleLowerCase().includes(normalizedValue)
  );
  const candidateRows = Array.from(
    { length: 10 },
    (_, pageIndex) => getInstancePage(scenario, pageIndex, 10).rows
  )
    .flat()
    .filter((row) => row.tags.includes(selectedTag))
    .filter((row) =>
      query.trim()
        ? [row.canonicalUrl, row.dimensionSummary]
            .join(' ')
            .toLocaleLowerCase()
            .includes(query.trim().toLocaleLowerCase())
        : true
    )
    .slice(0, 3);
  const previewCount = matchingLayer?.matchCount ?? candidateRows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-canvas p-3">
        <div>
          <p className="text-[11px] font-semibold text-ink">
            Queryable multi-valued tag dimensions
          </p>
          <p className="mt-0.5 text-[9px] text-ink-faint">
            Membership is independent: removing a brand never removes category or store-type tags.
          </p>
        </div>
        <Badge tone="warning">Demo fixture · no SQLite write</Badge>
      </div>

      <section
        aria-labelledby="tag-catalog-heading"
        className="rounded-lg border border-line bg-canvas p-3"
      >
        <div className="flex items-center gap-2">
          <Tags aria-hidden="true" className="size-4 text-accent" />
          <div>
            <p className="text-[9px] font-semibold uppercase text-ink-faint">Tag catalog</p>
            <h3 id="tag-catalog-heading" className="text-[11px] font-semibold text-ink">
              Usage and assignment source
            </h3>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tagDimensions.flatMap((dimension) =>
            dimension.values.map((value) => {
              const normalized = normalizeTagValue(value);
              const layer = scenario.layers.find((candidate) =>
                candidate.selector.toLocaleLowerCase().includes(normalized)
              );
              return (
                <article
                  key={`${dimension.id}-${value}`}
                  className="rounded-md border border-line bg-surface-subtle p-2.5"
                >
                  <code className="text-[9px] font-semibold text-ink">
                    {dimension.id}:{normalized}
                  </code>
                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[8px] text-ink-faint">
                    <span>{dimension.id === 'campaign' ? 'author' : 'pipeline'} source</span>
                    <span className="tabular-nums">
                      {layer ? `${layer.matchCount.toLocaleString()} uses` : 'fixture sample only'}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      <section
        aria-labelledby="bulk-tag-heading"
        className="overflow-hidden rounded-lg border border-line bg-canvas"
      >
        <div className="border-b border-line p-3">
          <p className="text-[9px] font-semibold uppercase text-accent-strong">
            Bulk assignment flow
          </p>
          <h3 id="bulk-tag-heading" className="mt-0.5 text-[11px] font-semibold text-ink">
            Filter → preview → apply → audit
          </h3>
        </div>
        <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label
                htmlFor="bulk-tag-dimension"
                className="grid gap-1 text-[9px] font-medium text-ink-muted"
              >
                Tag dimension
                <Select
                  id="bulk-tag-dimension"
                  value={selectedDimension.id}
                  onChange={(event) => {
                    const nextId = event.currentTarget.value;
                    const nextDimension = tagDimensions.find(
                      (dimension) => dimension.id === nextId
                    );
                    setDimensionId(nextId);
                    setSelectedValue(nextDimension?.values[0] ?? '');
                  }}
                >
                  {tagDimensions.map((dimension) => (
                    <option key={dimension.id} value={dimension.id}>
                      {dimension.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label
                htmlFor="bulk-tag-value"
                className="grid gap-1 text-[9px] font-medium text-ink-muted"
              >
                Value
                <Select
                  id="bulk-tag-value"
                  value={selectedValue}
                  onChange={(event) => setSelectedValue(event.currentTarget.value)}
                >
                  {selectedDimension.values.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </label>
              <label
                htmlFor="bulk-tag-url-filter"
                className="grid gap-1 text-[9px] font-medium text-ink-muted"
              >
                URL filter
                <Input
                  id="bulk-tag-url-filter"
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder="Optional sample filter"
                />
              </label>
            </div>
            <div className="rounded-md border border-accent/20 bg-accent-soft/45 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye aria-hidden="true" className="size-4 text-accent" />
                  <p className="text-[10px] font-semibold text-ink">Preview {selectedTag}</p>
                </div>
                <Badge tone="info">{previewCount.toLocaleString()} fixture matches</Badge>
              </div>
              <ul className="mt-2 space-y-1">
                {candidateRows.length > 0 ? (
                  candidateRows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded bg-canvas px-2 py-1.5 font-mono text-[8px] text-ink-muted"
                    >
                      {row.canonicalUrl}
                    </li>
                  ))
                ) : (
                  <li className="rounded bg-canvas px-2 py-1.5 text-[8px] text-ink-faint">
                    No deterministic sample rows match this filter.
                  </li>
                )}
              </ul>
            </div>
            <Button
              onClick={() =>
                setAuditMessage(
                  `Fixture apply recorded: ${selectedTag}; ${previewCount.toLocaleString()} matched, ${candidateRows.length} sample rows shown; no database mutation.`
                )
              }
            >
              <Check aria-hidden="true" className="size-3.5" /> Apply fixture preview
            </Button>
          </div>
          <aside className="rounded-md border border-line bg-surface-subtle p-3">
            <div className="flex items-center gap-2">
              <Database aria-hidden="true" className="size-4 text-accent" />
              <p className="text-[10px] font-semibold text-ink">Audit summary</p>
            </div>
            <p role="status" className="mt-2 text-[9px] leading-4 text-ink-muted">
              {auditMessage}
            </p>
            <p className="mt-3 border-t border-line pt-3 text-[8px] leading-4 text-ink-faint">
              Production mutation is owned by the validated service API. This communication surface
              intentionally cannot bypass it.
            </p>
          </aside>
        </div>
      </section>
    </div>
  );
}
