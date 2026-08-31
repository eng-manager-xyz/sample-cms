import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  GitBranch,
  Layers3,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type { TemplateKey } from '@/data/scenario-fixtures';
import {
  buildGuidedSelector,
  type SelectorBuilder,
  type SelectorBuilderClause,
  type SelectorWorkspacePreviewInput,
} from '@/data/selector-workspace';
import type {
  CmsCommand,
  CmsCommandResult,
  CmsWorkspaceSnapshot,
  SelectorPreviewSnapshot,
} from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';

export type SelectorWorkspaceRunCommand = (command: CmsCommand) => Promise<CmsCommandResult>;
export type SelectorWorkspacePreviewSelector = (
  input: SelectorWorkspacePreviewInput
) => Promise<SelectorPreviewSnapshot>;

export type SelectorWorkspaceProps = Readonly<{
  scenarioId: TemplateKey;
  workspace: CmsWorkspaceSnapshot;
  pending: boolean;
  mode?: 'inspect' | 'create';
  runCommand: SelectorWorkspaceRunCommand;
  previewSelector: SelectorWorkspacePreviewSelector;
}>;

type EditorMode = 'guided' | 'advanced';
type CreationMode = 'linked' | 'empty';
type CreationStep = 'identity' | 'predicate' | 'review';

const textareaClassName =
  'min-h-28 w-full resize-y rounded-lg border border-line-strong bg-canvas px-3 py-2 font-mono text-xs leading-5 text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The selector operation failed.';
}

function initialClause(
  fields: CmsWorkspaceSnapshot['selectorFields'],
  id = 'selector-clause-1'
): SelectorBuilderClause {
  const field = fields.find((candidate) => candidate.name === 'route_status') ?? fields[0];
  return {
    id,
    field: field?.name ?? 'route_status',
    operator: '=',
    value: field?.name === 'route_status' ? 'live' : '',
  };
}

function selectorForEditor(
  editorMode: EditorMode,
  advancedSelector: string,
  builder: SelectorBuilder,
  workspace: CmsWorkspaceSnapshot
): string {
  return editorMode === 'advanced'
    ? advancedSelector.trim()
    : buildGuidedSelector(builder, workspace.selectorFields);
}

function relationLabel(relation: 'below' | 'same' | 'above'): string {
  if (relation === 'below') return 'applies before';
  if (relation === 'above') return 'applies after';
  return 'same priority';
}

function GuidedSelectorBuilder({
  builder,
  fields,
  disabled,
  onChange,
}: Readonly<{
  builder: SelectorBuilder;
  fields: CmsWorkspaceSnapshot['selectorFields'];
  disabled: boolean;
  onChange: (next: SelectorBuilder) => void;
}>) {
  const updateClause = (id: string, patch: Partial<SelectorBuilderClause>): void => {
    onChange({
      ...builder,
      clauses: builder.clauses.map((clause) =>
        clause.id === id ? { ...clause, ...patch } : clause
      ),
    });
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-ink" htmlFor="selector-combinator">
          Match clauses with
        </label>
        <Select
          id="selector-combinator"
          value={builder.combinator}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...builder,
              combinator: event.currentTarget.value === 'OR' ? 'OR' : 'AND',
            })
          }
        >
          <option value="AND">All clauses (AND)</option>
          <option value="OR">Any clause (OR)</option>
        </Select>
      </div>
      <div className="space-y-2">
        {builder.clauses.map((clause, index) => {
          const field = fields.find((candidate) => candidate.name === clause.field);
          return (
            <div
              key={clause.id}
              className="grid gap-2 rounded-lg border border-line bg-surface-muted/45 p-2 md:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)_2rem]"
            >
              <label className="sr-only" htmlFor={`selector-field-${clause.id}`}>
                Clause {index + 1} field
              </label>
              <Select
                id={`selector-field-${clause.id}`}
                value={clause.field}
                disabled={disabled}
                onChange={(event) =>
                  updateClause(clause.id, { field: event.currentTarget.value, value: '' })
                }
              >
                {fields.map((candidate) => (
                  <option key={candidate.name} value={candidate.name}>
                    {candidate.name} · {candidate.kind}
                  </option>
                ))}
              </Select>
              <label className="sr-only" htmlFor={`selector-operator-${clause.id}`}>
                Clause {index + 1} operator
              </label>
              <Select
                id={`selector-operator-${clause.id}`}
                value={clause.operator}
                disabled={disabled}
                onChange={(event) =>
                  updateClause(clause.id, {
                    operator: event.currentTarget.value === 'IN' ? 'IN' : '=',
                  })
                }
              >
                <option value="=">equals</option>
                <option value="IN">is one of</option>
              </Select>
              <label className="sr-only" htmlFor={`selector-value-${clause.id}`}>
                Clause {index + 1} value
              </label>
              <Input
                id={`selector-value-${clause.id}`}
                value={clause.value}
                disabled={disabled}
                placeholder={
                  clause.operator === 'IN'
                    ? 'Comma-separated values'
                    : field?.valueType === 'boolean'
                      ? 'true or false'
                      : 'Value'
                }
                onChange={(event) => updateClause(clause.id, { value: event.currentTarget.value })}
              />
              <Button
                size="icon"
                variant="ghost"
                disabled={disabled || builder.clauses.length === 1}
                aria-label={`Remove selector clause ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...builder,
                    clauses: builder.clauses.filter((candidate) => candidate.id !== clause.id),
                  })
                }
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || builder.clauses.length >= 12}
        onClick={() =>
          onChange({
            ...builder,
            clauses: [...builder.clauses, initialClause(fields, globalThis.crypto.randomUUID())],
          })
        }
      >
        <Plus aria-hidden="true" className="size-3.5" /> Add clause
      </Button>
    </div>
  );
}

function SelectorPreviewResults({ preview }: Readonly<{ preview: SelectorPreviewSnapshot }>) {
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Exact impact
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {preview.totalCount.toLocaleString()}
            <span className="text-xs font-normal text-ink-muted">
              {' '}
              / {preview.templatePageCount.toLocaleString()} pages
            </span>
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Selected page
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">
            {preview.selectedPageMatches === null
              ? 'Not checked'
              : preview.selectedPageMatches
                ? 'Matches selector'
                : 'Does not match'}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Local placements
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">
            {preview.affectedPlacementCount.toLocaleString()}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="info">Normalized</Badge>
          {preview.warnings.map((warning) => (
            <Badge key={warning} tone="warning">
              {warning === 'zero_match' ? 'Matches no pages' : 'Matches the full template'}
            </Badge>
          ))}
        </div>
        <code className="block overflow-x-auto rounded-lg border border-line bg-ink px-3 py-2 font-mono text-[11px] leading-5 text-canvas">
          {preview.normalizedSelector}
        </code>
        <p className="mt-1 break-all font-mono text-[10px] text-ink-faint">
          exact match-set fingerprint: {preview.matchSetFingerprint}
        </p>
      </div>

      <details className="rounded-lg border border-line bg-canvas" open>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink">
          Parameterized SQLite execution
        </summary>
        <div className="border-t border-line p-3">
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-surface-muted p-3 font-mono text-[10px] leading-5 text-ink-muted">
            {preview.execution.sql}
          </pre>
          <p className="mt-2 break-all font-mono text-[10px] text-ink-faint">
            bindings: {JSON.stringify(preview.execution.parameters)}
          </p>
          <p className="mt-1 text-[10px] text-ink-faint">
            This read-only form runs only for authoring preview and publication.
          </p>
        </div>
      </details>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
          <caption className="sr-only">Bounded selector sample pages</caption>
          <thead className="bg-surface-muted text-[10px] uppercase tracking-[0.1em] text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-semibold">Canonical URL</th>
              <th className="px-3 py-2 font-semibold">Route</th>
              <th className="px-3 py-2 font-semibold">Context hash</th>
            </tr>
          </thead>
          <tbody>
            {preview.samplePages.map((page) => (
              <tr key={page.pageId} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-[11px] text-ink">{page.canonicalUrl}</td>
                <td className="px-3 py-2 text-ink-muted">{page.routeStatus}</td>
                <td className="max-w-36 truncate px-3 py-2 font-mono text-[10px] text-ink-faint">
                  {page.contextHash}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {preview.truncated ? (
          <p className="border-t border-line px-3 py-2 text-[10px] text-ink-faint">
            Sample truncated; the exact impact count above is not truncated.
          </p>
        ) : null}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-ink">Active layer overlaps</h4>
        <div className="mt-2 space-y-2">
          {preview.overlaps.map((overlap) => (
            <div
              key={overlap.variantId}
              className={cn(
                'rounded-lg border p-3',
                overlap.conflictingPlacementKeys.length > 0 && overlap.overlapCount > 0
                  ? 'border-danger/30 bg-danger-soft/45'
                  : 'border-line bg-surface-muted/35'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-ink">
                    P{overlap.priority} · {overlap.variantName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-faint">
                    {relationLabel(overlap.relation)} · {overlap.affectedPlacementCount} affected
                    placements
                  </p>
                </div>
                <Badge tone={overlap.overlapCount > 0 ? 'info' : 'neutral'}>
                  {overlap.overlapCount.toLocaleString()} overlapping pages
                </Badge>
              </div>
              {overlap.conflictingPlacementKeys.length > 0 && overlap.overlapCount > 0 ? (
                <p className="mt-2 text-[11px] font-medium text-danger-strong">
                  Publication conflict on {overlap.conflictingPlacementKeys.join(', ')}
                </p>
              ) : null}
              {overlap.sampleUrls.length > 0 ? (
                <p className="mt-2 truncate font-mono text-[10px] text-ink-muted">
                  {overlap.sampleUrls.join(' · ')}
                  {overlap.truncated ? ' · …' : ''}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <details className="rounded-lg border border-line bg-canvas">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink">
          EXPLAIN QUERY PLAN ({preview.plan.length})
        </summary>
        <ol className="space-y-1 border-t border-line p-3 font-mono text-[10px] text-ink-muted">
          {preview.plan.map((step) => (
            <li key={`${step.id}:${step.parent}:${step.detail}`}>{step.detail}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function CascadeInspector({ workspace }: Readonly<{ workspace: CmsWorkspaceSnapshot }>) {
  const selectedVariant = workspace.variants.find((variant) => variant.id === workspace.scopeId);
  return (
    <Card>
      <CardHeader className="border-b border-line">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Draft cascade
            </p>
            <h3 className="mt-1 text-sm font-semibold text-ink">Layers and provenance</h3>
          </div>
          <Badge tone={workspace.publicationBlocked ? 'danger' : 'success'} dot>
            {workspace.publicationBlocked ? 'Publish blocked' : 'Deterministic'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <ol className="space-y-1" aria-label="Variant layers in low-to-high priority order">
          {workspace.variants
            .slice()
            .sort(
              (left, right) => left.priority - right.priority || left.id.localeCompare(right.id)
            )
            .map((variant) => (
              <li
                key={variant.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs',
                  variant.id === selectedVariant?.id
                    ? 'border-accent/35 bg-accent-soft/45'
                    : 'border-line bg-surface-muted/30'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    P{variant.priority} · {variant.name}
                  </p>
                  <p className="truncate font-mono text-[10px] text-ink-faint">
                    {variant.selector}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge tone={variant.matchesSamplePage ? 'success' : 'neutral'}>
                    {variant.matchesSamplePage ? 'matches page' : 'not matched'}
                  </Badge>
                  <Badge>{variant.affectedPlacementCount} placements</Badge>
                </div>
              </li>
            ))}
        </ol>

        {workspace.resolutionConflicts.length > 0 ? (
          <div className="space-y-2" role="alert">
            {workspace.resolutionConflicts.map((conflict) => (
              <div
                key={`${conflict.priority}:${conflict.placementKey}:${conflict.sources.map((source) => source.variantId).join(':')}`}
                className="rounded-lg border border-danger/30 bg-danger-soft/50 p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 text-danger-strong" />
                  <div>
                    <p className="text-xs font-semibold text-danger-strong">
                      P{conflict.priority} conflict on {conflict.placementKey}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {conflict.sources
                        .map(
                          (source) => `${source.variantName} (${source.operationKinds.join(' + ')})`
                        )
                        .join(' and ')}{' '}
                      both affect {conflict.overlapCount.toLocaleString()} page
                      {conflict.overlapCount === 1 ? '' : 's'}.
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-ink">Placement winners</h4>
          {workspace.placements.map((placement) => (
            <details
              key={placement.placementKey}
              className="rounded-lg border border-line bg-canvas"
            >
              <summary className="cursor-pointer px-3 py-2 text-xs text-ink">
                <span className="font-semibold">{placement.placementKey}</span>
                <span className="ml-2 text-ink-faint">
                  content P{placement.sourcePriority} · order P{placement.orderSourcePriority}
                </span>
              </summary>
              <ol className="space-y-2 border-t border-line p-3">
                {placement.trace.map((step) => (
                  <li
                    key={`${step.sourceRevisionId}:${step.kind}`}
                    className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 text-[10px]"
                  >
                    <span className="font-mono text-ink-faint">P{step.sourcePriority}</span>
                    <span className="text-ink-muted">
                      <strong className="font-semibold text-ink">{step.sourceVariantName}</strong>{' '}
                      {step.kind}
                      {step.blockVersionId ? ` · ${step.blockVersionId}` : ''}
                      {step.order === undefined ? '' : ` · order ${step.order}`}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          ))}
          {workspace.tombstones.map((tombstone) => (
            <details
              key={`tombstone:${tombstone.placementKey}`}
              className="rounded-lg border border-warning/30 bg-warning-soft/30"
            >
              <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-ink">
                {tombstone.placementKey} · hidden at P{tombstone.sourcePriority}
              </summary>
              <div className="border-t border-warning/20 p-3 text-[10px] text-ink-muted">
                {tombstone.hiddenPlacement ? (
                  <p>
                    Hidden lower value: {tombstone.hiddenPlacement.blockType} ·{' '}
                    {tombstone.hiddenPlacement.blockVersionId} · order{' '}
                    {tombstone.hiddenPlacement.order}
                  </p>
                ) : (
                  <p>No lower placement existed before this tombstone.</p>
                )}
              </div>
            </details>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type LocalRunCommand = (command: CmsCommand | (() => CmsCommand)) => Promise<void>;

function selectorKeyForName(name: string): string {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function SelectorCreationWizard({
  scenarioId,
  workspace,
  pending,
  runCommand,
  previewSelector,
}: Readonly<{
  scenarioId: TemplateKey;
  workspace: CmsWorkspaceSnapshot;
  pending: boolean;
  runCommand: SelectorWorkspaceRunCommand;
  previewSelector: SelectorWorkspacePreviewSelector;
}>) {
  const [step, setStep] = useState<CreationStep>('identity');
  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantKey, setNewVariantKey] = useState('');
  const [keyEdited, setKeyEdited] = useState(false);
  const [creationMode, setCreationMode] = useState<CreationMode>('linked');
  const [priority, setPriority] = useState(50);
  const [editorMode, setEditorMode] = useState<EditorMode>('guided');
  const [advancedSelector, setAdvancedSelector] = useState("route_status = 'live'");
  const [builder, setBuilder] = useState<SelectorBuilder>({
    combinator: 'AND',
    clauses: [initialClause(workspace.selectorFields)],
  });
  const [preview, setPreview] = useState<{
    readonly signature: string;
    readonly snapshot: SelectorPreviewSnapshot;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let selector = '';
  let selectorDraftError: string | null = null;
  try {
    selector = selectorForEditor(editorMode, advancedSelector, builder, workspace);
  } catch (caught) {
    selectorDraftError = errorMessage(caught);
  }
  const previewSignature = JSON.stringify([selector, priority]);
  const currentPreview = preview?.signature === previewSignature ? preview.snapshot : null;
  const identityValid =
    newVariantName.trim().length > 0 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newVariantKey) &&
    priority >= 1 &&
    priority <= 10_000;

  const runPreview = async (): Promise<void> => {
    setError(null);
    if (selectorDraftError || selector.length === 0) {
      setError(selectorDraftError ?? 'Write a selector before previewing its impact.');
      return;
    }
    setPreviewing(true);
    try {
      const snapshot = await previewSelector({
        scenarioId,
        selector,
        priority,
        canonicalUrl: workspace.canonicalUrl,
        sampleLimit: 10,
      });
      setPreview({ signature: previewSignature, snapshot });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPreviewing(false);
    }
  };

  const createSelector = async (): Promise<void> => {
    if (!currentPreview) {
      setError('Run a fresh impact preview before creating this selector.');
      setStep('predicate');
      return;
    }
    setError(null);
    try {
      await runCommand({
        kind: 'createVariant',
        scenarioId,
        name: newVariantName.trim(),
        key: newVariantKey,
        selector,
        priority,
        mode: creationMode,
        expectedNormalizedSelector: currentPreview.normalizedSelector,
        expectedMatchCount: currentPreview.totalCount,
        expectedMatchSetFingerprint: currentPreview.matchSetFingerprint,
      });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const steps = [
    ['identity', '1', 'Identity'],
    ['predicate', '2', 'Predicate'],
    ['review', '3', 'Review'],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3">
      <ol className="grid grid-cols-3 gap-2" aria-label="Selector creation progress">
        {steps.map(([value, number, label]) => (
          <li
            key={value}
            aria-current={step === value ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
              step === value
                ? 'border-accent/40 bg-accent-soft text-ink'
                : 'border-line bg-canvas text-ink-muted'
            )}
          >
            <span className="grid size-5 place-items-center rounded bg-ink text-[10px] font-semibold text-canvas">
              {number}
            </span>
            <span className="font-semibold">{label}</span>
          </li>
        ))}
      </ol>

      {step === 'identity' ? (
        <Card>
          <CardHeader className="border-b border-line">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Step 1 of 3
            </p>
            <h3 className="text-sm font-semibold text-ink">Name the template variation</h3>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-ink"
                  htmlFor="new-variant-name"
                >
                  Display name
                </label>
                <Input
                  id="new-variant-name"
                  value={newVariantName}
                  disabled={pending}
                  placeholder="California premium"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setNewVariantName(value);
                    if (!keyEdited) setNewVariantKey(selectorKeyForName(value));
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-ink"
                  htmlFor="new-variant-key"
                >
                  Stable key
                </label>
                <Input
                  id="new-variant-key"
                  value={newVariantKey}
                  disabled={pending}
                  placeholder="california-premium"
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => {
                    setKeyEdited(true);
                    setNewVariantKey(event.currentTarget.value);
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-medium text-ink"
                  htmlFor="new-variant-priority"
                >
                  Priority
                </label>
                <Input
                  id="new-variant-priority"
                  type="number"
                  min={1}
                  max={10_000}
                  value={priority}
                  disabled={pending}
                  onChange={(event) => setPriority(Number(event.currentTarget.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink" htmlFor="creation-mode">
                  Starting content
                </label>
                <Select
                  id="creation-mode"
                  className="h-9 w-full"
                  value={creationMode}
                  disabled={pending}
                  onChange={(event) =>
                    setCreationMode(event.currentTarget.value === 'empty' ? 'empty' : 'linked')
                  }
                >
                  <option value="linked">Inherit the default blocks</option>
                  <option value="empty">Start explicitly blank</option>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border border-accent/25 bg-accent-soft/45 p-3 text-[11px] leading-5 text-ink-muted">
              {creationMode === 'linked' ? (
                <p>
                  <strong className="text-ink">Sparse linked start:</strong> zero block versions are
                  copied. Every placement stays inherited until an edit saves one new immutable
                  version in this variation.
                </p>
              ) : (
                <p>
                  <strong className="text-ink">Explicit blank start:</strong> tombstones hide the
                  inherited document for matching pages until blocks are added locally.
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button disabled={pending || !identityValid} onClick={() => setStep('predicate')}>
                Continue to predicate
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 'predicate' ? (
        <Card>
          <CardHeader className="border-b border-line">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Step 2 of 3
            </p>
            <h3 className="text-sm font-semibold text-ink">Choose the matching route slice</h3>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex justify-end">
              <div className="inline-flex rounded-lg border border-line bg-surface-muted p-0.5">
                <Button
                  size="sm"
                  variant={editorMode === 'guided' ? 'default' : 'ghost'}
                  aria-pressed={editorMode === 'guided'}
                  onClick={() => setEditorMode('guided')}
                >
                  Guided
                </Button>
                <Button
                  size="sm"
                  variant={editorMode === 'advanced' ? 'default' : 'ghost'}
                  aria-pressed={editorMode === 'advanced'}
                  onClick={() => setEditorMode('advanced')}
                >
                  <Braces aria-hidden="true" className="size-3.5" /> Advanced SQL-like
                </Button>
              </div>
            </div>
            {editorMode === 'guided' ? (
              <GuidedSelectorBuilder
                builder={builder}
                fields={workspace.selectorFields}
                disabled={pending || previewing}
                onChange={setBuilder}
              />
            ) : (
              <div>
                <label className="sr-only" htmlFor="new-advanced-selector">
                  Constrained selector predicate
                </label>
                <textarea
                  id="new-advanced-selector"
                  className={textareaClassName}
                  value={advancedSelector}
                  disabled={pending || previewing}
                  spellCheck={false}
                  onChange={(event) => setAdvancedSelector(event.currentTarget.value)}
                />
                <p className="mt-1 text-[10px] text-ink-faint">
                  Approved route slots and tags only. This runs during preview and publication,
                  never on the public request path.
                </p>
              </div>
            )}
            {selectorDraftError ? (
              <p className="text-xs text-danger-strong" role="alert">
                {selectorDraftError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="outline" disabled={pending} onClick={() => setStep('identity')}>
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  disabled={pending || previewing || Boolean(selectorDraftError)}
                  onClick={runPreview}
                >
                  <Play aria-hidden="true" className="size-3.5" />
                  {previewing ? 'Checking…' : 'Preview exact impact'}
                </Button>
                <Button disabled={pending || !currentPreview} onClick={() => setStep('review')}>
                  Review{' '}
                  {currentPreview ? `${currentPreview.totalCount.toLocaleString()} pages` : ''}
                </Button>
              </div>
            </div>
            {preview && !currentPreview ? (
              <p
                className="rounded-lg border border-warning/25 bg-warning-soft p-3 text-xs text-warning-strong"
                role="status"
              >
                The predicate or priority changed. Run the impact preview again to continue.
              </p>
            ) : null}
            {currentPreview ? (
              <div
                className="rounded-lg border border-success/25 bg-success-soft p-3 text-xs text-success-strong"
                role="status"
              >
                Preview is current: {currentPreview.totalCount.toLocaleString()} of{' '}
                {currentPreview.templatePageCount.toLocaleString()} pages match.
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 'review' && currentPreview ? (
        <Card>
          <CardHeader className="border-b border-line">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Step 3 of 3
            </p>
            <h3 className="text-sm font-semibold text-ink">Review and create {newVariantName}</h3>
            <p className="text-[11px] text-ink-muted">
              <code>{newVariantKey}</code> · P{priority} ·{' '}
              {creationMode === 'linked' ? 'inherits default placements' : 'explicitly blank'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <SelectorPreviewResults preview={currentPreview} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="outline" disabled={pending} onClick={() => setStep('predicate')}>
                Back to predicate
              </Button>
              <Button disabled={pending || !identityValid} onClick={createSelector}>
                <GitBranch aria-hidden="true" className="size-3.5" />
                {pending ? 'Creating…' : 'Create selector variation'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <p
          className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft p-3 text-xs text-danger-strong"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}

function SelectorWorkspaceScope({
  scenarioId,
  workspace,
  pending,
  runCommand,
  previewSelector,
}: SelectorWorkspaceProps) {
  const selectedVariant = workspace.variants.find((variant) => variant.id === workspace.scopeId);
  const [editorMode, setEditorMode] = useState<EditorMode>('advanced');
  const [advancedSelector, setAdvancedSelector] = useState(selectedVariant?.selector ?? 'TRUE');
  const [builder, setBuilder] = useState<SelectorBuilder>({
    combinator: 'AND',
    clauses: [initialClause(workspace.selectorFields)],
  });
  const [priority, setPriority] = useState(selectedVariant?.priority || 50);
  const [preview, setPreview] = useState<SelectorPreviewSnapshot | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!selectedVariant) {
    return (
      <Card className="border-danger/30 bg-danger-soft/40 p-4 text-sm text-danger-strong">
        The selected authoring scope is no longer available.
      </Card>
    );
  }

  const currentSelector = (): string =>
    selectorForEditor(editorMode, advancedSelector, builder, workspace);

  const run: LocalRunCommand = async (command): Promise<void> => {
    setError(null);
    setMessage(null);
    try {
      const result = await runCommand(typeof command === 'function' ? command() : command);
      setMessage(result.message);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const previewCurrentSelector = async (): Promise<void> => {
    setError(null);
    setMessage(null);
    setPreviewing(true);
    try {
      const selector = currentSelector();
      if (editorMode === 'guided') setAdvancedSelector(selector);
      setPreview(
        await previewSelector({
          scenarioId,
          selector,
          priority,
          scopeId: workspace.scopeId,
          canonicalUrl: workspace.canonicalUrl,
          sampleLimit: 10,
        })
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-line">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <GitBranch aria-hidden="true" className="size-4 text-accent" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                  Selector workspace
                </p>
              </div>
              <h2 className="mt-1 text-base font-semibold text-ink">{selectedVariant.name}</h2>
              <p className="mt-1 font-mono text-[10px] text-ink-faint">{workspace.canonicalUrl}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selectedVariant.matchesSamplePage ? 'success' : 'warning'} dot>
                {selectedVariant.matchesSamplePage ? 'Selected page matches' : 'Page not matched'}
              </Badge>
              <Badge>{selectedVariant.affectedPlacementCount} local placements</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          {!selectedVariant.isDefault ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface-muted/35 p-3">
              <div className="min-w-32 flex-1">
                <label
                  className="mb-1 block text-xs font-medium text-ink"
                  htmlFor="variant-priority"
                >
                  Explicit priority
                </label>
                <Input
                  id="variant-priority"
                  type="number"
                  min={1}
                  max={10_000}
                  value={priority}
                  disabled={pending}
                  onChange={(event) => setPriority(Number(event.currentTarget.value))}
                />
              </div>
              <Button
                variant="outline"
                disabled={pending || priority === selectedVariant.priority}
                onClick={() =>
                  run({
                    kind: 'setVariantPriority',
                    scenarioId,
                    scopeId: workspace.scopeId,
                    priority,
                  })
                }
              >
                <Layers3 aria-hidden="true" className="size-3.5" /> Update cascade
              </Button>
            </div>
          ) : null}

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">Selector predicate</h3>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Build from approved fields or use the same constrained predicate grammar directly.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-line bg-surface-muted p-0.5">
                <Button
                  size="sm"
                  variant={editorMode === 'guided' ? 'default' : 'ghost'}
                  aria-pressed={editorMode === 'guided'}
                  onClick={() => setEditorMode('guided')}
                >
                  Guided
                </Button>
                <Button
                  size="sm"
                  variant={editorMode === 'advanced' ? 'default' : 'ghost'}
                  aria-pressed={editorMode === 'advanced'}
                  onClick={() => setEditorMode('advanced')}
                >
                  <Braces aria-hidden="true" className="size-3.5" /> Advanced
                </Button>
              </div>
            </div>

            {editorMode === 'guided' ? (
              <GuidedSelectorBuilder
                builder={builder}
                fields={workspace.selectorFields}
                disabled={pending || previewing}
                onChange={setBuilder}
              />
            ) : (
              <div>
                <label className="sr-only" htmlFor="advanced-selector">
                  Advanced constrained selector predicate
                </label>
                <textarea
                  id="advanced-selector"
                  className={textareaClassName}
                  value={advancedSelector}
                  disabled={pending || previewing}
                  spellCheck={false}
                  onChange={(event) => setAdvancedSelector(event.currentTarget.value)}
                />
                <p className="mt-1 text-[10px] text-ink-faint">
                  Equality, IN, AND, OR, and parentheses only. DDL, DML, comments, PRAGMA, and
                  unapproved fields fail before SQLite execution.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={pending || previewing} onClick={previewCurrentSelector}>
              <Play aria-hidden="true" className="size-3.5" />
              {previewing ? 'Running…' : 'View generated SQL & impact'}
            </Button>
            {!selectedVariant.isDefault ? (
              <Button
                variant="outline"
                disabled={pending || previewing}
                onClick={() =>
                  run(() => ({
                    kind: 'reviseSelector',
                    scenarioId,
                    scopeId: workspace.scopeId,
                    selector: currentSelector(),
                  }))
                }
              >
                <Save aria-hidden="true" className="size-3.5" /> Save selector revision
              </Button>
            ) : null}
          </div>

          {message ? (
            <p className="flex items-center gap-2 text-xs text-success-strong" role="status">
              <CheckCircle2 aria-hidden="true" className="size-4" /> {message}
            </p>
          ) : null}
          {error ? (
            <p className="flex items-start gap-2 text-xs text-danger-strong" role="alert">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : null}

          {preview ? <SelectorPreviewResults preview={preview} /> : null}
        </CardContent>
      </Card>

      <CascadeInspector workspace={workspace} />
    </div>
  );
}

/** Controlled selector surface: the parent studio remains the only owner of persisted workspace state. */
export function SelectorWorkspace(props: SelectorWorkspaceProps) {
  if (props.mode === 'create') {
    return (
      <SelectorCreationWizard
        scenarioId={props.scenarioId}
        workspace={props.workspace}
        pending={props.pending}
        runCommand={props.runCommand}
        previewSelector={props.previewSelector}
      />
    );
  }
  const selectedVariant = props.workspace.variants.find(
    (variant) => variant.id === props.workspace.scopeId
  );
  const scopeKey = `${props.workspace.scopeId}:${selectedVariant?.activeRevisionId ?? 'missing'}:${selectedVariant?.priority ?? 0}`;
  return <SelectorWorkspaceScope key={scopeKey} {...props} />;
}
