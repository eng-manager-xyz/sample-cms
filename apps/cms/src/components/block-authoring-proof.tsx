import { Braces, Copy, GitBranch, History, Pencil, Replace, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ScenarioFixture } from '@/data/scenario-fixtures';
import { cn } from '@/lib/cn';

interface BlockTypeProof {
  key: string;
  displayName: string;
  schemaVersion: number;
  fields: Array<{ key: string; label: string; required: boolean }>;
  schema: Record<string, unknown>;
}

const blockTypes: BlockTypeProof[] = [
  {
    key: 'hero',
    displayName: 'Hero',
    schemaVersion: 3,
    fields: [
      { key: 'headline', label: 'Headline', required: true },
      { key: 'body', label: 'Body', required: false },
    ],
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['headline'],
      properties: { headline: { type: 'string' }, body: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    key: 'hero_alt',
    displayName: 'Hero · split layout',
    schemaVersion: 1,
    fields: [
      { key: 'headline', label: 'Headline', required: true },
      { key: 'mapAssetKey', label: 'Pickup map asset key', required: true },
    ],
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['headline', 'mapAssetKey'],
      properties: { headline: { type: 'string' }, mapAssetKey: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    key: 'promo',
    displayName: 'Promo',
    schemaVersion: 2,
    fields: [{ key: 'message', label: 'Message', required: true }],
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['message'],
      properties: { message: { type: 'string' } },
      additionalProperties: false,
    },
  },
  {
    key: 'footer',
    displayName: 'Footer',
    schemaVersion: 1,
    fields: [{ key: 'legal', label: 'Legal text', required: true }],
    schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      required: ['legal'],
      properties: { legal: { type: 'string' } },
      additionalProperties: false,
    },
  },
];

export function BlockAuthoringProof({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  const initialPlacement = scenario.pin.placements[0];
  const initialType =
    blockTypes.find((candidate) => candidate.key === initialPlacement?.blockType) ?? blockTypes[0];
  const [selectedTypeKey, setSelectedTypeKey] = useState(initialType?.key ?? 'hero');
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [headline, setHeadline] = useState(initialPlacement?.draftValue ?? 'Untitled block');
  const [rawJson, setRawJson] = useState(() =>
    JSON.stringify({ headline: initialPlacement?.draftValue ?? 'Untitled block' }, null, 2)
  );
  const [actionStatus, setActionStatus] = useState(
    'This communication guide explains the lifecycle; use the live SQLite workbench above to persist it.'
  );
  const selectedType =
    blockTypes.find((candidate) => candidate.key === selectedTypeKey) ?? blockTypes[0];

  if (!selectedType || !initialPlacement) return null;

  const interpolated = headline
    .replaceAll('{{ store.name }}', scenario.id === 'stores' ? "McDonald's" : scenario.shortName)
    .replaceAll(
      '{{ store.location }}',
      scenario.id === 'stores' ? 'Market Street' : 'selected URL'
    );

  function validateRawJson() {
    const blockType =
      blockTypes.find((candidate) => candidate.key === selectedTypeKey) ?? blockTypes[0];
    if (!blockType) return;
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      const missingRequired = blockType.fields.some(
        (field) => field.required && typeof parsed[field.key] !== 'string'
      );
      setActionStatus(
        missingRequired
          ? `Invalid ${blockType.key} payload: a required string field is missing.`
          : `Valid ${blockType.key} schema-v${blockType.schemaVersion} fixture payload.`
      );
    } catch {
      setActionStatus('Invalid JSON. The draft would be rejected before a version is created.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-canvas p-3">
        <div>
          <p className="text-[11px] font-semibold text-ink">
            Block registry and immutable versions
          </p>
          <p className="mt-0.5 text-[9px] text-ink-faint">
            JSON Schema drives the form; saving creates a forked version, never an in-place edit.
          </p>
        </div>
        <Badge tone="neutral">Communication guide</Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        <section
          aria-labelledby="block-catalog-heading"
          className="rounded-lg border border-line bg-canvas p-3"
        >
          <h3
            id="block-catalog-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint"
          >
            Block-type catalog
          </h3>
          <div className="mt-2 space-y-1.5">
            {blockTypes.map((blockType) => (
              <button
                key={blockType.key}
                type="button"
                aria-pressed={selectedType.key === blockType.key}
                onClick={() => setSelectedTypeKey(blockType.key)}
                className={cn(
                  'w-full rounded-md border p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  selectedType.key === blockType.key
                    ? 'border-accent/35 bg-accent-soft'
                    : 'border-line bg-surface-subtle hover:border-line-strong'
                )}
              >
                <span className="block text-[10px] font-semibold text-ink">
                  {blockType.displayName}
                </span>
                <span className="mt-0.5 block font-mono text-[8px] text-ink-faint">
                  {blockType.key} · schema-v{blockType.schemaVersion}
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <section
            aria-labelledby="block-editor-heading"
            className="overflow-hidden rounded-lg border border-line bg-canvas"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-3">
              <div>
                <p className="text-[9px] font-semibold uppercase text-accent-strong">
                  Stable placement
                </p>
                <h3
                  id="block-editor-heading"
                  className="mt-0.5 font-mono text-[11px] font-semibold text-ink"
                >
                  {initialPlacement.placementKey} · {selectedType.key}
                </h3>
              </div>
              <div className="flex rounded-md border border-line bg-surface-subtle p-0.5">
                {(['form', 'json'] as const).map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    aria-pressed={mode === candidate}
                    onClick={() => setMode(candidate)}
                    className={cn(
                      'h-7 rounded px-2 text-[9px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      mode === candidate ? 'bg-canvas text-ink shadow-sm' : 'text-ink-faint'
                    )}
                  >
                    {candidate === 'form' ? 'Schema form' : 'Raw JSON'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 p-3 lg:grid-cols-2">
              <div>
                {mode === 'form' ? (
                  <div className="space-y-3">
                    {selectedType.fields.map((field, index) => (
                      <label
                        key={field.key}
                        htmlFor={`block-field-${selectedType.key}-${field.key}`}
                        className="grid gap-1 text-[9px] font-medium text-ink-muted"
                      >
                        {field.label}{' '}
                        {field.required ? (
                          <span className="text-danger-strong">required</span>
                        ) : null}
                        {index === 0 ? (
                          <Input
                            id={`block-field-${selectedType.key}-${field.key}`}
                            value={headline}
                            placeholder={field.key}
                            onChange={(event) => setHeadline(event.currentTarget.value)}
                          />
                        ) : (
                          <Input
                            id={`block-field-${selectedType.key}-${field.key}`}
                            defaultValue=""
                            placeholder={field.key}
                          />
                        )}
                      </label>
                    ))}
                    <div className="rounded-md border border-line bg-surface-subtle p-2">
                      <p className="text-[8px] font-semibold uppercase text-ink-faint">
                        Evaluated for selected URL
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-ink-muted">{interpolated}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="grid gap-1 text-[9px] font-medium text-ink-muted">
                      Raw payload
                      <textarea
                        value={rawJson}
                        onChange={(event) => setRawJson(event.currentTarget.value)}
                        rows={8}
                        spellCheck={false}
                        className="w-full rounded-md border border-line-strong bg-surface-subtle p-2 font-mono text-[9px] leading-4 text-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      />
                    </label>
                    <Button variant="outline" size="sm" onClick={validateRawJson}>
                      <Braces aria-hidden="true" className="size-3.5" /> Validate fixture payload
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-[8px] font-semibold uppercase text-ink-faint">
                  Inspectible JSON Schema
                </p>
                <pre className="max-h-[260px] overflow-auto rounded-md bg-ink p-3 font-mono text-[8px] leading-4 text-canvas">
                  <code>{JSON.stringify(selectedType.schema, null, 2)}</code>
                </pre>
              </div>
            </div>
          </section>

          <section
            aria-labelledby="version-history-heading"
            className="rounded-lg border border-line bg-canvas p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] font-semibold uppercase text-ink-faint">
                  Immutable lineage
                </p>
                <h3
                  id="version-history-heading"
                  className="mt-0.5 text-[11px] font-semibold text-ink"
                >
                  Version history and references
                </h3>
              </div>
              <History aria-hidden="true" className="size-4 text-accent" />
            </div>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              <li className="rounded-md border border-accent/25 bg-accent-soft p-2">
                <p className="font-mono text-[9px] font-semibold text-accent-strong">draft fork</p>
                <p className="mt-1 text-[8px] text-ink-muted">
                  parent → {initialPlacement.version}
                </p>
              </li>
              <li className="rounded-md border border-line bg-surface-subtle p-2">
                <p className="font-mono text-[9px] font-semibold text-ink">
                  {initialPlacement.version}
                </p>
                <p className="mt-1 text-[8px] text-ink-muted">active publication · immutable</p>
              </li>
              <li className="rounded-md border border-line bg-surface-subtle p-2">
                <p className="font-mono text-[9px] font-semibold text-ink">references</p>
                <p className="mt-1 text-[8px] text-ink-muted">
                  up to {scenario.instanceCount.toLocaleString()} pages
                </p>
              </li>
            </ol>
            <fieldset className="mt-3 flex flex-wrap gap-1.5 border-0 p-0">
              <legend className="sr-only">Draft block commands</legend>
              <Button
                size="sm"
                onClick={() =>
                  setActionStatus('Save preview: would create a new immutable child version.')
                }
              >
                <Save aria-hidden="true" className="size-3" /> Save new version
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setActionStatus('Copy-on-write preview: inherited content would fork once.')
                }
              >
                <GitBranch aria-hidden="true" className="size-3" /> Edit inherited
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setActionStatus('Duplicate preview: a distinct lineage would be created.')
                }
              >
                <Copy aria-hidden="true" className="size-3" /> Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setActionStatus(
                    `Type replacement preview: ${initialPlacement.blockType} → ${selectedType.key}; placement key unchanged.`
                  )
                }
              >
                <Replace aria-hidden="true" className="size-3" /> Replace type
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setActionStatus('Hide-here preview: would add a tombstone over the lower value.')
                }
              >
                <Trash2 aria-hidden="true" className="size-3" /> Hide here
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setActionStatus(
                    'Revert preview: would remove only the local operation and reveal the lower value.'
                  )
                }
              >
                <Pencil aria-hidden="true" className="size-3" /> Revert override
              </Button>
            </fieldset>
            <p
              role="status"
              className="mt-3 rounded-md bg-surface-subtle p-2 text-[9px] leading-4 text-ink-muted"
            >
              {actionStatus}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
