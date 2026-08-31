import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  FileUp,
  Loader2,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react';
import { type ChangeEvent, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type {
  ContentExplorerSearch,
  TemplateCreationInput,
  TemplateCreationPreview,
  TemplateCreationResult,
  TemplateProvisioningSlot,
} from '@/data/content-explorer';
import { TemplateCreationInputSchema, templateProvisioningCsvHint } from '@/data/content-explorer';
import { cn } from '@/lib/cn';
import {
  previewTemplateCreation,
  provisionTemplateCreation,
} from '@/server-functions/content.functions';

type WizardStep = NonNullable<ContentExplorerSearch['createStep']>;

interface SlotDraft {
  readonly clientId: number;
  readonly kind: 'static' | 'locale' | 'slug';
  readonly key: string;
  readonly label: string;
  readonly staticValue: string;
}

const steps: readonly { readonly id: WizardStep; readonly label: string }[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'slots', label: 'URL slots' },
  { id: 'sources', label: 'Route values' },
  { id: 'review', label: 'Review' },
];

function machineKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function provisioningSlots(
  templateKey: string,
  drafts: readonly SlotDraft[]
): TemplateProvisioningSlot[] {
  return drafts.map((slot, index) => {
    const base = {
      id: `slot:${templateKey}:${index + 1}`,
      key: slot.key,
      label: slot.label,
    };
    return slot.kind === 'static'
      ? { ...base, kind: 'static' as const, staticValue: slot.staticValue }
      : {
          ...base,
          kind: 'variable' as const,
          variableKind: slot.kind,
        };
  });
}

function pathPreview(slots: readonly SlotDraft[]): string {
  return `/${slots
    .map((slot) =>
      slot.kind === 'static' ? slot.staticValue || '…' : `{${slot.key || slot.kind}}`
    )
    .join('/')}`;
}

export function TemplateCreationWizard({
  step,
  onStepChange,
  onCancel,
  onCreated,
}: Readonly<{
  step: WizardStep;
  onStepChange: (step: WizardStep) => void;
  onCancel: () => void;
  onCreated: (result: TemplateCreationResult) => void;
}>) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [slots, setSlots] = useState<readonly SlotDraft[]>([
    { clientId: 1, kind: 'locale', key: 'locale', label: 'Locale', staticValue: '' },
    { clientId: 2, kind: 'slug', key: 'slug', label: 'Slug', staticValue: '' },
  ]);
  const [nextClientId, setNextClientId] = useState(3);
  const [localeCsv, setLocaleCsv] = useState('locale\nen-US');
  const [slugCsv, setSlugCsv] = useState('slug\nexample-page');
  const [preview, setPreview] = useState<TemplateCreationPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const stepIndex = steps.findIndex((candidate) => candidate.id === step);

  function buildInput(): TemplateCreationInput {
    return TemplateCreationInputSchema.parse({
      template: {
        id: `tpl:${key}`,
        key,
        name,
        domain,
        description: description || undefined,
      },
      slots: provisioningSlots(key, slots),
      localeCsv: slots.some((slot) => slot.kind === 'locale') ? localeCsv : undefined,
      slugCsv: slots.some((slot) => slot.kind === 'slug') ? slugCsv : undefined,
    });
  }

  function updateSlot(clientId: number, patch: Partial<Omit<SlotDraft, 'clientId'>>) {
    setPreview(null);
    setSlots((current) =>
      current.map((slot) => (slot.clientId === clientId ? { ...slot, ...patch } : slot))
    );
  }

  function addSlot(kind: SlotDraft['kind']) {
    const defaults =
      kind === 'static'
        ? { key: `path_${nextClientId}`, label: 'Static path', staticValue: 'path' }
        : kind === 'locale'
          ? { key: 'locale', label: 'Locale', staticValue: '' }
          : { key: 'slug', label: 'Slug', staticValue: '' };
    setSlots((current) => [...current, { clientId: nextClientId, kind, ...defaults }]);
    setNextClientId((current) => current + 1);
    setPreview(null);
  }

  function moveSlot(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slots.length) return;
    const reordered = [...slots];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(target, 0, moved);
    setSlots(reordered);
    setPreview(null);
  }

  function requestPreview() {
    setMessage(null);
    startTransition(async () => {
      try {
        const input = buildInput();
        const nextPreview = await previewTemplateCreation({ data: input });
        setPreview(nextPreview);
        onStepChange('review');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The template preview failed.');
      }
    });
  }

  function createTemplate() {
    if (!preview) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await provisionTemplateCreation({
          data: { input: buildInput(), previewFingerprint: preview.fingerprint },
        });
        onCreated(result);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The template could not be created.');
      }
    });
  }

  async function readCsvFile(event: ChangeEvent<HTMLInputElement>, kind: 'locale' | 'slug') {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (kind === 'locale') setLocaleCsv(text);
      else setSlugCsv(text);
      setPreview(null);
      setMessage(`${file.name} loaded. Review the pasted values before continuing.`);
    } catch {
      setMessage(`Could not read ${file.name}.`);
    } finally {
      event.currentTarget.value = '';
    }
  }

  const identityReady = Boolean(name.trim() && key.trim() && domain.trim());
  const slotsReady = slots.length > 0;
  const canCreate = Boolean(preview && preview.errors.length === 0 && !isPending);

  return (
    <section className="mx-auto w-full max-w-[1180px] space-y-4 p-4 sm:p-5 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Guided setup
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">
            Create template
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-muted">
            Define the URL grammar and finite route values. Nothing is written until the reviewed
            preview is created.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </header>

      <Card className="overflow-hidden p-0">
        <nav
          aria-label="Template creation progress"
          className="border-b border-line bg-surface-muted/35 px-4 py-3"
        >
          <ol className="grid gap-2 sm:grid-cols-4">
            {steps.map((candidate, index) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  disabled={index > stepIndex || isPending}
                  onClick={() => onStepChange(candidate.id)}
                  aria-current={candidate.id === step ? 'step' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed',
                    candidate.id === step
                      ? 'bg-canvas font-semibold text-ink shadow-sm'
                      : index < stepIndex
                        ? 'text-accent-strong hover:bg-canvas/70'
                        : 'text-ink-faint'
                  )}
                >
                  <span
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border text-[10px]',
                      index < stepIndex
                        ? 'border-success bg-success text-canvas'
                        : candidate.id === step
                          ? 'border-accent bg-accent text-canvas'
                          : 'border-line-strong bg-canvas'
                    )}
                  >
                    {index < stepIndex ? (
                      <Check aria-hidden="true" className="size-3" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  {candidate.label}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-h-[34rem] p-4 sm:p-6">
          {step === 'identity' ? (
            <div className="mx-auto max-w-2xl space-y-5">
              <WizardHeading
                title="Name the template"
                description="The host and ordered path slots form one canonical route grammar. The key becomes the stable authoring URL."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Template name" htmlFor="template-name">
                  <Input
                    id="template-name"
                    value={name}
                    onChange={(event) => {
                      const nextName = event.currentTarget.value;
                      setName(nextName);
                      if (!key || key === machineKey(name)) setKey(machineKey(nextName));
                      setPreview(null);
                    }}
                    placeholder="City guides"
                    maxLength={120}
                    autoFocus
                  />
                </Field>
                <Field
                  label="Template key"
                  htmlFor="template-key"
                  hint="Lowercase words and dashes"
                >
                  <Input
                    id="template-key"
                    value={key}
                    onChange={(event) => {
                      setKey(machineKey(event.currentTarget.value));
                      setPreview(null);
                    }}
                    placeholder="city-guides"
                    maxLength={64}
                  />
                </Field>
                <Field
                  label="Canonical host"
                  htmlFor="template-domain"
                  hint="Bare host; no protocol or path"
                >
                  <Input
                    id="template-domain"
                    value={domain}
                    onChange={(event) => {
                      setDomain(event.currentTarget.value);
                      setPreview(null);
                    }}
                    placeholder="www.example.com"
                    maxLength={253}
                  />
                </Field>
                <Field label="Description" htmlFor="template-description" hint="Optional">
                  <Input
                    id="template-description"
                    value={description}
                    onChange={(event) => {
                      setDescription(event.currentTarget.value);
                      setPreview(null);
                    }}
                    placeholder="What this family of pages is for"
                    maxLength={500}
                  />
                </Field>
              </div>
              <div className="rounded-lg border border-line bg-surface-muted/35 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  Starting route
                </p>
                <p className="mt-1 font-mono text-xs text-ink-muted">
                  {domain || 'host.example.com'}
                  {pathPreview(slots)}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-ink-faint">
                  Add static slots in the next step to define the path prefix.
                </p>
              </div>
              <WizardFooter>
                <span />
                <Button
                  type="button"
                  disabled={!identityReady}
                  onClick={() => onStepChange('slots')}
                >
                  Continue <ArrowRight aria-hidden="true" className="size-3.5" />
                </Button>
              </WizardFooter>
            </div>
          ) : null}

          {step === 'slots' ? (
            <div className="mx-auto max-w-4xl space-y-5">
              <WizardHeading
                title="Build the URL slots"
                description="Order static segments and the finite locale or slug variables exactly as they appear in the path."
              />
              <div className="rounded-lg border border-line">
                <div className="grid grid-cols-[2rem_7rem_minmax(0,1fr)_minmax(0,1fr)_8rem] gap-2 border-b border-line bg-surface-muted/35 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
                  <span>#</span>
                  <span>Type</span>
                  <span>Key / value</span>
                  <span>Label</span>
                  <span>Actions</span>
                </div>
                <ol className="divide-y divide-line">
                  {slots.map((slot, index) => (
                    <li
                      key={slot.clientId}
                      className="grid grid-cols-[2rem_7rem_minmax(0,1fr)_minmax(0,1fr)_8rem] items-center gap-2 px-3 py-3"
                    >
                      <span className="font-mono text-[10px] text-ink-faint">{index + 1}</span>
                      <Badge tone={slot.kind === 'static' ? 'neutral' : 'info'}>{slot.kind}</Badge>
                      {slot.kind === 'static' ? (
                        <Input
                          aria-label={`Static value for slot ${index + 1}`}
                          value={slot.staticValue}
                          onChange={(event) =>
                            updateSlot(slot.clientId, {
                              staticValue: machineKey(event.currentTarget.value),
                              key:
                                machineKey(event.currentTarget.value).replaceAll('-', '_') ||
                                slot.key,
                            })
                          }
                          placeholder="path-segment"
                        />
                      ) : (
                        <Input
                          aria-label={`Key for ${slot.kind} slot`}
                          value={slot.key}
                          onChange={(event) =>
                            updateSlot(slot.clientId, {
                              key: machineKey(event.currentTarget.value),
                            })
                          }
                        />
                      )}
                      <Input
                        aria-label={`Label for slot ${index + 1}`}
                        value={slot.label}
                        onChange={(event) =>
                          updateSlot(slot.clientId, { label: event.currentTarget.value })
                        }
                      />
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          label="Move slot up"
                          disabled={index === 0}
                          onClick={() => moveSlot(index, -1)}
                        >
                          <ArrowUp />
                        </IconButton>
                        <IconButton
                          label="Move slot down"
                          disabled={index === slots.length - 1}
                          onClick={() => moveSlot(index, 1)}
                        >
                          <ArrowDown />
                        </IconButton>
                        <IconButton
                          label="Remove slot"
                          disabled={slots.length === 1}
                          onClick={() =>
                            setSlots((current) =>
                              current.filter((candidate) => candidate.clientId !== slot.clientId)
                            )
                          }
                        >
                          <Trash2 />
                        </IconButton>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2 border-t border-line bg-surface-muted/20 p-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addSlot('static')}
                  >
                    <Plus className="size-3.5" /> Static
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={slots.some((slot) => slot.kind === 'locale')}
                    onClick={() => addSlot('locale')}
                  >
                    <Plus className="size-3.5" /> Locale
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={slots.some((slot) => slot.kind === 'slug')}
                    onClick={() => addSlot('slug')}
                  >
                    <Plus className="size-3.5" /> Slug
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-accent/35 bg-accent-soft/45 p-3">
                <Tags aria-hidden="true" className="size-4 shrink-0 text-accent-strong" />
                <div>
                  <p className="text-xs font-medium text-ink">Tags dimension included</p>
                  <p className="text-[10px] leading-4 text-ink-muted">
                    Tags are required, multi-value selector data. They are managed after route
                    creation and never add a URL segment.
                  </p>
                </div>
              </div>
              <div className="rounded-lg bg-ink px-3 py-2 font-mono text-xs text-canvas">
                {domain || 'host.example.com'}
                {pathPreview(slots)}
              </div>
              <WizardFooter>
                <Button type="button" variant="outline" onClick={() => onStepChange('identity')}>
                  <ArrowLeft className="size-3.5" /> Back
                </Button>
                <Button
                  type="button"
                  disabled={!slotsReady}
                  onClick={() => onStepChange('sources')}
                >
                  Continue <ArrowRight className="size-3.5" />
                </Button>
              </WizardFooter>
            </div>
          ) : null}

          {step === 'sources' ? (
            <div className="mx-auto max-w-4xl space-y-5">
              <WizardHeading
                title="Provide finite route values"
                description="Paste CSV text or upload a file for each variable dimension. Static segments do not need a source."
              />
              <div className="grid gap-4 lg:grid-cols-2">
                {slots.some((slot) => slot.kind === 'locale') ? (
                  <CsvSource
                    kind="locale"
                    value={localeCsv}
                    onChange={(value) => {
                      setLocaleCsv(value);
                      setPreview(null);
                    }}
                    onFile={(event) => void readCsvFile(event, 'locale')}
                  />
                ) : null}
                {slots.some((slot) => slot.kind === 'slug') ? (
                  <CsvSource
                    kind="slug"
                    value={slugCsv}
                    onChange={(value) => {
                      setSlugCsv(value);
                      setPreview(null);
                    }}
                    onFile={(event) => void readCsvFile(event, 'slug')}
                  />
                ) : null}
              </div>
              {!slots.some((slot) => slot.kind !== 'static') ? (
                <p className="rounded-lg border border-line bg-surface-muted/35 p-4 text-xs text-ink-muted">
                  This grammar contains only static slots, so it creates one canonical page.
                </p>
              ) : null}
              <WizardFooter>
                <Button type="button" variant="outline" onClick={() => onStepChange('slots')}>
                  <ArrowLeft className="size-3.5" /> Back
                </Button>
                <Button type="button" disabled={isPending} onClick={requestPreview}>
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null} Preview routes
                </Button>
              </WizardFooter>
            </div>
          ) : null}

          {step === 'review' ? (
            <div className="mx-auto max-w-4xl space-y-5">
              <WizardHeading
                title="Review and create"
                description="The fingerprint binds this review to the exact normalized input. Creating commits the template, default layer, slots, and canonical pages atomically."
              />
              {preview ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <ReviewMetric label="URL pattern" value={preview.urlPattern} mono />
                    <ReviewMetric
                      label="Canonical pages"
                      value={preview.cardinality.toLocaleString()}
                    />
                    <ReviewMetric label="Locales" value={preview.localeCount.toLocaleString()} />
                    <ReviewMetric label="Slugs" value={preview.slugCount.toLocaleString()} />
                  </div>
                  {preview.errors.length > 0 ? (
                    <div className="rounded-lg border border-danger/30 bg-danger-soft p-4">
                      <p className="text-xs font-semibold text-danger-strong">
                        Resolve these items before creating
                      </p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-danger-strong">
                        {preview.errors.map((error) => (
                          <li key={`${error.path}:${error.message}`}>
                            <code className="font-mono">{error.path}</code>: {error.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success-strong">
                      Preview is valid and ready to commit.
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                      Bounded sample URLs
                    </p>
                    <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-canvas">
                      {preview.sampleCanonicalUrls.map((url) => (
                        <li key={url} className="px-3 py-2 font-mono text-[11px] text-ink-muted">
                          {domain}
                          {url}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="break-all rounded-lg bg-surface-muted/50 p-3 font-mono text-[10px] text-ink-faint">
                    Fingerprint: {preview.fingerprint}
                  </p>
                </>
              ) : (
                <p className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-xs text-warning-strong">
                  The route preview is stale. Return to route values and preview again.
                </p>
              )}
              <WizardFooter>
                <Button type="button" variant="outline" onClick={() => onStepChange('sources')}>
                  <ArrowLeft className="size-3.5" /> Back
                </Button>
                <Button type="button" disabled={!canCreate} onClick={createTemplate}>
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : null} Create template
                </Button>
              </WizardFooter>
            </div>
          ) : null}

          {message ? (
            <p className="mx-auto mt-4 max-w-4xl text-xs text-ink-muted" aria-live="polite">
              {message}
            </p>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

function WizardHeading({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-ink-muted">{description}</p>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: Readonly<{ label: string; htmlFor: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-medium text-ink">
          {label}
        </label>
        {hint ? <span className="text-[10px] text-ink-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function WizardFooter({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
      {children}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: Readonly<{
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactElement;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md border border-line bg-canvas text-ink-muted outline-none hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-35 [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}

function CsvSource({
  kind,
  value,
  onChange,
  onFile,
}: Readonly<{
  kind: 'locale' | 'slug';
  value: string;
  onChange: (value: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}>) {
  return (
    <section className="rounded-lg border border-line bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold capitalize text-ink">{kind} CSV</h3>
          <p className="mt-0.5 text-[10px] leading-4 text-ink-muted">
            {templateProvisioningCsvHint(kind)}
          </p>
        </div>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line-strong bg-canvas px-3 text-xs font-medium text-ink outline-none hover:bg-surface-muted focus-within:ring-2 focus-within:ring-focus">
          <FileUp className="size-3.5" /> Upload
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
        </label>
      </div>
      <label htmlFor={`${kind}-csv`} className="sr-only">
        {kind} CSV contents
      </label>
      <textarea
        id={`${kind}-csv`}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        spellCheck={false}
        className="mt-3 min-h-52 w-full resize-y rounded-md border border-line-strong bg-surface-muted/25 p-3 font-mono text-[11px] leading-5 text-ink outline-none focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-focus"
      />
    </section>
  );
}

function ReviewMetric({
  label,
  value,
  mono = false,
}: Readonly<{ label: string; value: string; mono?: boolean }>) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
        {label}
      </p>
      <p
        className={cn('mt-1 truncate text-sm font-semibold text-ink', mono && 'font-mono text-xs')}
      >
        {value}
      </p>
    </div>
  );
}
