import {
  AlertTriangle,
  Braces,
  CheckCircle2,
  ChevronRight,
  Code2,
  GitFork,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useReducer, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  contentFromDraft,
  deriveBlockFormModel,
  draftValuesFromContent,
  parseContentJson,
} from '@/data/authoring-studio';
import type {
  CmsWorkspaceBlockType,
  CmsWorkspaceFieldInspection,
  CmsWorkspacePlacement,
} from '@/data/sqlite-authoring';
import { cn } from '@/lib/cn';

export const AUTHORING_BLOCK_FORM_ID = 'authoring-block-form';

export interface BlockFormSaveInput {
  readonly placementKey: string;
  readonly blockTypeKey: 'avatar' | 'navigation' | 'hero' | 'hero_alt' | 'promo' | 'footer';
  readonly contentJson: string;
  readonly position?: 'start' | 'end' | 'before' | 'after';
  readonly referencePlacementKey?: string;
}

type BlockFormPosition = NonNullable<BlockFormSaveInput['position']>;

export interface BlockFormInsertion {
  readonly position: BlockFormPosition;
  readonly referencePlacementKey?: string;
}

interface BlockFormState {
  readonly blockTypeKey: string;
  readonly placementKey: string;
  readonly position: BlockFormPosition;
  readonly referencePlacementKey: string;
  readonly values: Readonly<Record<string, string>>;
  readonly rawJson: string;
  readonly rawDirty: boolean;
  readonly fieldErrors: Readonly<Record<string, string>>;
  readonly touchedFields: Readonly<Record<string, true>>;
  readonly liveInspections: Readonly<Record<string, CmsWorkspaceFieldInspection>>;
  readonly inspectingFields: Readonly<Record<string, true>>;
  readonly localError: string | null;
}

type BlockFormAction =
  | { readonly type: 'reset'; readonly state: BlockFormState }
  | { readonly type: 'patch'; readonly patch: Partial<BlockFormState> }
  | {
      readonly type: 'change-field';
      readonly fieldKey: string;
      readonly value: string;
      readonly rawJson?: string;
    }
  | { readonly type: 'inspection-started'; readonly fieldKey: string }
  | {
      readonly type: 'inspection-succeeded';
      readonly fieldKey: string;
      readonly source: string;
      readonly inspection: CmsWorkspaceFieldInspection;
    }
  | {
      readonly type: 'inspection-failed';
      readonly fieldKey: string;
      readonly source: string;
      readonly message: string;
    };

function blockFormReducer(state: BlockFormState, action: BlockFormAction): BlockFormState {
  if (action.type === 'reset') return action.state;
  if (action.type === 'patch') return { ...state, ...action.patch };
  if (action.type === 'inspection-started') {
    return {
      ...state,
      inspectingFields: { ...state.inspectingFields, [action.fieldKey]: true },
      localError: null,
    };
  }
  if (action.type === 'inspection-succeeded') {
    const { [action.fieldKey]: _finished, ...remainingPending } = state.inspectingFields;
    if (state.values[action.fieldKey] !== action.source) {
      return { ...state, inspectingFields: remainingPending };
    }
    return {
      ...state,
      inspectingFields: remainingPending,
      liveInspections: {
        ...state.liveInspections,
        [action.fieldKey]: action.inspection,
      },
    };
  }
  if (action.type === 'inspection-failed') {
    const { [action.fieldKey]: _finished, ...remainingPending } = state.inspectingFields;
    return {
      ...state,
      inspectingFields: remainingPending,
      ...(state.values[action.fieldKey] === action.source ? { localError: action.message } : {}),
    };
  }
  const nextValues = { ...state.values, [action.fieldKey]: action.value };
  const { [action.fieldKey]: _removed, ...remainingErrors } = state.fieldErrors;
  const { [action.fieldKey]: _staleInspection, ...remainingInspections } = state.liveInspections;
  return {
    ...state,
    values: nextValues,
    rawJson: action.rawJson ?? state.rawJson,
    rawDirty: false,
    fieldErrors: remainingErrors,
    touchedFields: { ...state.touchedFields, [action.fieldKey]: true },
    liveInspections: remainingInspections,
  };
}

const textareaClassName =
  'min-h-24 w-full resize-y rounded-lg border border-line-strong bg-canvas px-3 py-2 text-[13px] leading-5 text-ink outline-none placeholder:text-ink-faint focus-visible:border-accent/50 focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60';

function registeredTypeKey(value: string): BlockFormSaveInput['blockTypeKey'] {
  if (
    value === 'avatar' ||
    value === 'navigation' ||
    value === 'hero' ||
    value === 'hero_alt' ||
    value === 'promo' ||
    value === 'footer'
  ) {
    return value;
  }
  throw new Error(`Unsupported registered block type "${value}".`);
}

function selectedBlockType(
  blockTypes: readonly CmsWorkspaceBlockType[],
  key: string
): CmsWorkspaceBlockType {
  const blockType = blockTypes.find((candidate) => candidate.key === key);
  if (!blockType) throw new Error(`Registered block type "${key}" was not loaded.`);
  return blockType;
}

function initialBlockFormState(input: {
  readonly placement?: CmsWorkspacePlacement;
  readonly blockTypes: readonly CmsWorkspaceBlockType[];
  readonly placementKeys: readonly string[];
  readonly insertion?: BlockFormInsertion;
}): BlockFormState {
  const typeKey = input.placement?.blockType ?? input.blockTypes[0]?.key ?? 'hero';
  const blockType = selectedBlockType(input.blockTypes, typeKey);
  const contentJson = input.placement?.contentJson ?? blockType.exampleContentJson;
  const model = deriveBlockFormModel({
    schemaJson: blockType.schemaJson,
    exampleContentJson: blockType.exampleContentJson,
    currentContentJson: contentJson,
  });
  return {
    blockTypeKey: blockType.key,
    placementKey: input.placement?.placementKey ?? '',
    position: input.insertion?.position ?? 'end',
    referencePlacementKey: input.insertion?.referencePlacementKey ?? input.placementKeys[0] ?? '',
    values: draftValuesFromContent(model.fields, parseContentJson(contentJson)),
    rawJson: contentJson,
    rawDirty: false,
    fieldErrors: {},
    touchedFields: {},
    liveInspections: {},
    inspectingFields: {},
    localError: null,
  };
}

function inspectionForField(
  inspections: readonly CmsWorkspaceFieldInspection[],
  fieldPath: string
): CmsWorkspaceFieldInspection | undefined {
  return inspections.find((inspection) => inspection.path === `$.${fieldPath}`);
}

function CelInspection({ inspection }: Readonly<{ inspection?: CmsWorkspaceFieldInspection }>) {
  if (!inspection) {
    return (
      <p className="mt-1.5 text-[11px] leading-4 text-ink-faint">
        Literal text or <code>{'{{ CEL expression }}'}</code>. Validation runs again on Save.
      </p>
    );
  }
  if (!inspection.success) {
    return (
      <div
        role="alert"
        className="mt-2 rounded-md border border-danger/20 bg-danger-soft px-2.5 py-2 text-[11px] leading-4 text-danger-strong"
      >
        <span className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle aria-hidden="true" className="size-3.5" />
          {inspection.error?.code ?? 'CEL error'}
        </span>
        <span className="mt-1 block">{inspection.error?.message}</span>
      </div>
    );
  }
  return (
    <div className="mt-2 space-y-2 rounded-md border border-success/20 bg-success-soft/55 px-2.5 py-2 text-[11px] leading-4">
      <p className="flex items-center gap-1.5 font-semibold text-success-strong">
        <CheckCircle2 aria-hidden="true" className="size-3.5" /> Evaluated for this page
      </p>
      <p className="break-words text-ink">{inspection.evaluatedSample}</p>
      {inspection.dependencies.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {inspection.dependencies.map((dependency) => (
            <code
              key={dependency}
              className="rounded bg-canvas/75 px-1.5 py-0.5 text-[10px] text-ink-muted"
            >
              {dependency}
            </code>
          ))}
        </div>
      ) : (
        <span className="text-ink-muted">Literal value · no context dependency</span>
      )}
      <details>
        <summary className="cursor-pointer text-ink-muted">Allowed variables</summary>
        <p className="mt-1 break-words font-mono text-[10px] text-ink-faint">
          {inspection.allowedVariables.join(', ')}
        </p>
      </details>
    </div>
  );
}

function fieldControlId(path: string): string {
  return `block-field-${path.replace(/[^a-zA-Z0-9_-]/gu, '-')}`;
}

function FieldFrame({
  field,
  changed,
  error,
  children,
}: Readonly<{
  field: ReturnType<typeof deriveBlockFormModel>['fields'][number];
  changed: boolean;
  error?: string;
  children: ReactNode;
}>) {
  const fieldId = fieldControlId(field.path);
  const descriptionId = field.description ? `${fieldId}-description` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  return (
    <div
      className={cn(
        'group/field border-l-2 pl-3',
        changed ? 'border-accent' : 'border-transparent'
      )}
      data-schema-field={field.path}
      data-field-kind={field.kind}
    >
      <div className="mb-1.5 flex min-h-5 items-start justify-between gap-3">
        <label htmlFor={fieldId} className="text-xs font-medium leading-5 text-ink">
          {field.label}
          {field.required ? <span className="ml-1 text-danger-strong">*</span> : null}
        </label>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[9px] uppercase tracking-[0.08em] text-ink-faint">
          {field.celEligible ? (
            <span className="flex items-center gap-1 text-accent-strong">
              <Sparkles aria-hidden="true" className="size-2.5" /> expression
            </span>
          ) : null}
          <code className="normal-case tracking-normal">{field.key}</code>
          <span aria-hidden="true">·</span>
          <span>
            {field.kind}
            {field.kind === 'array' && field.itemKind ? ` of ${field.itemKind}` : ''}
          </span>
        </span>
      </div>
      {field.description ? (
        <p id={descriptionId} className="mb-2 text-[11px] leading-4 text-ink-muted">
          {field.description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-[11px] text-danger-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BooleanControl({
  field,
  value,
  disabled,
  error,
  describedBy,
  onChange,
}: Readonly<{
  field: ReturnType<typeof deriveBlockFormModel>['fields'][number];
  value: string;
  disabled: boolean;
  error?: string;
  describedBy?: string;
  onChange: (value: string) => void;
}>) {
  const fieldId = fieldControlId(field.path);
  const stateId = `${fieldId}-state`;
  const checked = value === 'true';
  const stateLabel = value === '' ? 'Not set' : checked ? 'Enabled' : 'Disabled';
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-line-strong bg-canvas px-3 py-1.5">
      <span id={stateId} className="text-xs text-ink-muted">
        {stateLabel}
      </span>
      <div className="flex items-center gap-2">
        {!field.required && value !== '' ? (
          <button
            type="button"
            className="rounded px-1.5 py-1 text-[10px] text-ink-faint outline-none hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
            disabled={disabled}
            onClick={() => onChange('')}
          >
            Unset
          </button>
        ) : null}
        <button
          id={fieldId}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-required={field.required}
          aria-invalid={Boolean(error)}
          aria-describedby={[stateId, describedBy].filter(Boolean).join(' ')}
          disabled={disabled}
          className={cn(
            'relative h-5 w-9 rounded-full border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60',
            checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-muted'
          )}
          onClick={() => onChange(checked ? 'false' : 'true')}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-0.5 size-3.5 rounded-full bg-canvas shadow-sm transition-transform motion-reduce:transition-none',
              checked ? 'translate-x-[17px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  );
}

function LeafFieldControl({
  field,
  value,
  disabled,
  error,
  changed,
  inspection,
  inspectionPending,
  onChange,
  onInspect,
}: Readonly<{
  field: ReturnType<typeof deriveBlockFormModel>['fields'][number];
  value: string;
  disabled: boolean;
  error?: string;
  changed: boolean;
  inspection?: CmsWorkspaceFieldInspection;
  inspectionPending: boolean;
  onChange: (value: string) => void;
  onInspect: (value: string) => void;
}>) {
  const fieldId = fieldControlId(field.path);
  const describedBy = [
    field.description ? `${fieldId}-description` : null,
    error ? `${fieldId}-error` : null,
  ]
    .filter(Boolean)
    .join(' ');
  let control: ReactNode;
  if (field.enumValues.length > 0) {
    control = (
      <Select
        id={fieldId}
        className="h-9 w-full"
        value={value}
        disabled={disabled}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="" disabled={field.required}>
          {field.required ? 'Choose a value' : 'Not set'}
        </option>
        {field.enumValues.map((option) => (
          <option key={String(option)} value={String(option)}>
            {String(option)}
          </option>
        ))}
      </Select>
    );
  } else if (field.kind === 'boolean') {
    control = (
      <BooleanControl
        field={field}
        value={value}
        disabled={disabled}
        {...(error ? { error } : {})}
        {...(describedBy ? { describedBy } : {})}
        onChange={onChange}
      />
    );
  } else if (field.kind === 'string') {
    control = (
      <Input
        id={fieldId}
        type="text"
        value={value}
        disabled={disabled}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={() => onInspect(value)}
      />
    );
  } else if (field.kind === 'object' || field.kind === 'array') {
    control = (
      <textarea
        id={fieldId}
        className={cn(textareaClassName, 'font-mono text-xs')}
        value={value}
        disabled={disabled}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  } else {
    control = (
      <Input
        id={fieldId}
        type="number"
        step={field.kind === 'integer' ? 1 : 'any'}
        value={value}
        disabled={disabled}
        required={field.required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  }

  return (
    <FieldFrame field={field} changed={changed} {...(error ? { error } : {})}>
      {control}
      {field.celEligible ? (
        <details className="mt-2 rounded-md border border-line bg-surface-muted/25">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2.5 py-2 text-[10px] font-medium text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus">
            <Sparkles aria-hidden="true" className="size-3" /> Expression tools
          </summary>
          <div className="border-t border-line px-2.5 pb-2.5 pt-1">
            <CelInspection inspection={inspection} />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-1.5"
              disabled={disabled || inspectionPending}
              onClick={() => onInspect(value)}
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              {inspectionPending ? 'Evaluating…' : 'Evaluate current value'}
            </Button>
          </div>
        </details>
      ) : null}
    </FieldFrame>
  );
}

function SchemaFieldControl({
  field,
  values,
  pending,
  fieldErrors,
  placement,
  touchedFields,
  liveInspections,
  inspectingFields,
  onChange,
  onInspect,
}: Readonly<{
  field: ReturnType<typeof deriveBlockFormModel>['fields'][number];
  values: Readonly<Record<string, string>>;
  pending: boolean;
  fieldErrors: Readonly<Record<string, string>>;
  placement?: CmsWorkspacePlacement;
  touchedFields: Readonly<Record<string, true>>;
  liveInspections: Readonly<Record<string, CmsWorkspaceFieldInspection>>;
  inspectingFields: Readonly<Record<string, true>>;
  onChange: (fieldPath: string, value: string) => void;
  onInspect: (fieldPath: string, value: string) => void;
}>) {
  const [expanded, setExpanded] = useState(true);
  if (field.kind === 'object' && field.children.length > 0) {
    const groupId = `${fieldControlId(field.path)}-children`;
    const descendantErrorCount = Object.keys(fieldErrors).filter((path) =>
      path.startsWith(`${field.path}.`)
    ).length;
    const visible = expanded || descendantErrorCount > 0;
    return (
      <fieldset
        className="group/object border-l-2 border-line pl-3 focus-within:border-accent"
        data-schema-field={field.path}
        data-field-kind="object"
      >
        <legend className="sr-only">{field.label}</legend>
        <button
          type="button"
          className="flex w-full items-start gap-2 rounded-md py-1 text-left outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
          aria-expanded={visible}
          aria-controls={groupId}
          onClick={() => {
            if (descendantErrorCount === 0) setExpanded(!expanded);
          }}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'mt-0.5 size-3.5 shrink-0 text-ink-faint transition-transform motion-reduce:transition-none',
              visible && 'rotate-90'
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-ink">
              {field.label}
              {field.required ? <span className="ml-1 text-danger-strong">*</span> : null}
            </span>
            {field.description ? (
              <span className="mt-0.5 block text-[11px] leading-4 text-ink-muted">
                {field.description}
              </span>
            ) : null}
          </span>
          {descendantErrorCount > 0 ? (
            <span className="pt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-danger-strong">
              {descendantErrorCount} {descendantErrorCount === 1 ? 'issue' : 'issues'}
            </span>
          ) : (
            <span className="pt-0.5 text-[9px] uppercase tracking-[0.08em] text-ink-faint">
              {field.children.length} {field.children.length === 1 ? 'field' : 'fields'}
            </span>
          )}
        </button>
        <div id={groupId} hidden={!visible} className="space-y-5 pb-1 pl-2 pt-4">
          {field.children.map((child) => (
            <SchemaFieldControl
              key={child.path}
              field={child}
              values={values}
              pending={pending}
              fieldErrors={fieldErrors}
              placement={placement}
              touchedFields={touchedFields}
              liveInspections={liveInspections}
              inspectingFields={inspectingFields}
              onChange={onChange}
              onInspect={onInspect}
            />
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <LeafFieldControl
      field={field}
      value={values[field.path] ?? ''}
      disabled={pending}
      error={fieldErrors[field.path]}
      changed={Boolean(touchedFields[field.path])}
      inspection={
        liveInspections[field.path] ??
        (placement && !touchedFields[field.path]
          ? inspectionForField(placement.fieldInspections, field.path)
          : undefined)
      }
      inspectionPending={Boolean(inspectingFields[field.path])}
      onChange={(value) => onChange(field.path, value)}
      onInspect={(value) => onInspect(field.path, value)}
    />
  );
}

function BlockIdentityControls({
  mode,
  placement,
  blockTypes,
  placementKeys,
  pending,
  blockTypeKey,
  placementKey,
  position,
  referencePlacementKey,
  replacingType,
  onPlacementKeyChange,
  onBlockTypeChange,
  onPositionChange,
  onReferencePlacementChange,
}: Readonly<{
  mode: 'add' | 'edit';
  placement?: CmsWorkspacePlacement;
  blockTypes: readonly CmsWorkspaceBlockType[];
  placementKeys: readonly string[];
  pending: boolean;
  blockTypeKey: string;
  placementKey: string;
  position: BlockFormPosition;
  referencePlacementKey: string;
  replacingType: boolean;
  onPlacementKeyChange: (value: string) => void;
  onBlockTypeChange: (value: string) => void;
  onPositionChange: (value: BlockFormPosition) => void;
  onReferencePlacementChange: (value: string) => void;
}>) {
  return (
    <>
      <div>
        <label
          htmlFor="block-placement-key"
          className="mb-1.5 block text-xs font-semibold text-ink"
        >
          Stable placement key
        </label>
        <Input
          id="block-placement-key"
          value={placementKey}
          readOnly={mode === 'edit'}
          disabled={pending}
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="seasonal-promotion"
          onChange={(event) => onPlacementKeyChange(event.currentTarget.value)}
        />
        <p className="mt-1.5 text-[11px] leading-4 text-ink-faint">
          {mode === 'edit'
            ? 'Identity stays fixed across reorder, versions, and type replacement.'
            : 'Lowercase kebab-case; this identity remains stable after creation.'}
        </p>
      </div>

      <div>
        <label htmlFor="block-type" className="mb-1.5 block text-xs font-semibold text-ink">
          Registered block type
        </label>
        <Select
          id="block-type"
          className="h-9 w-full"
          value={blockTypeKey}
          disabled={pending}
          onChange={(event) => onBlockTypeChange(event.currentTarget.value)}
        >
          {blockTypes.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>
              {candidate.name} · schema v{candidate.schemaVersion}
            </option>
          ))}
        </Select>
        {replacingType ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/25 bg-warning-soft px-2.5 py-2 text-[11px] leading-4 text-warning-strong">
            <GitFork aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Saving replaces the
            block type while preserving <code>{placement?.placementKey}</code>.
          </p>
        ) : null}
      </div>

      {mode === 'add' ? (
        <fieldset className="space-y-2 rounded-lg border border-line bg-surface-muted/45 p-3">
          <legend className="px-1 text-xs font-semibold text-ink">Insertion position</legend>
          <Select
            className="h-9 w-full"
            aria-label="Insertion position"
            value={position}
            disabled={pending}
            onChange={(event) => {
              const value = event.currentTarget.value;
              onPositionChange(
                value === 'start' || value === 'before' || value === 'after' ? value : 'end'
              );
            }}
          >
            <option value="start">At the start</option>
            <option value="end">At the end</option>
            <option value="before">Before a placement</option>
            <option value="after">After a placement</option>
          </Select>
          {position === 'before' || position === 'after' ? (
            <Select
              className="h-9 w-full"
              aria-label="Reference placement"
              value={referencePlacementKey}
              disabled={pending}
              onChange={(event) => onReferencePlacementChange(event.currentTarget.value)}
            >
              {placementKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Select>
          ) : null}
        </fieldset>
      ) : null}
    </>
  );
}

function BlockSchemaFields({
  formModel,
  values,
  pending,
  fieldErrors,
  placement,
  touchedFields,
  liveInspections,
  inspectingFields,
  onChange,
  onInspect,
}: Readonly<{
  formModel: ReturnType<typeof deriveBlockFormModel>;
  values: Readonly<Record<string, string>>;
  pending: boolean;
  fieldErrors: Readonly<Record<string, string>>;
  placement?: CmsWorkspacePlacement;
  touchedFields: Readonly<Record<string, true>>;
  liveInspections: Readonly<Record<string, CmsWorkspaceFieldInspection>>;
  inspectingFields: Readonly<Record<string, true>>;
  onChange: (fieldKey: string, value: string) => void;
  onInspect: (fieldKey: string, value: string) => void;
}>) {
  return (
    <>
      {formModel.usesLegacyAdapter ? (
        <details className="mb-5 border-l-2 border-accent/35 pl-3 text-[10px] leading-4 text-ink-muted">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-accent-strong outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Braces aria-hidden="true" className="size-3" /> Schema compatibility details
          </summary>
          <p className="mt-1.5">
            This immutable v1 schema declares required keys only. Controls use its registered
            example and current scalar types without changing schema history.
          </p>
        </details>
      ) : null}

      {formModel.schemaError ? (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-xs text-danger-strong">
          {formModel.schemaError}
        </p>
      ) : (
        <div className="space-y-5">
          {formModel.fields.map((field) => (
            <SchemaFieldControl
              key={field.path}
              field={field}
              values={values}
              pending={pending}
              fieldErrors={fieldErrors}
              placement={placement}
              touchedFields={touchedFields}
              liveInspections={liveInspections}
              inspectingFields={inspectingFields}
              onChange={onChange}
              onInspect={onInspect}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AdvancedJsonEditor({
  rawJson,
  rawDirty,
  pending,
  onChange,
}: Readonly<{
  rawJson: string;
  rawDirty: boolean;
  pending: boolean;
  onChange: (value: string) => void;
}>) {
  return (
    <details className="rounded-lg border border-line bg-surface-muted/35">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-semibold text-ink">
        <Code2 aria-hidden="true" className="size-3.5" /> Advanced raw JSON
        {rawDirty ? <Badge tone="warning">edited</Badge> : null}
      </summary>
      <div className="border-t border-line p-3">
        <textarea
          aria-label="Advanced raw block JSON"
          className={cn(textareaClassName, 'min-h-44 font-mono text-xs')}
          value={rawJson}
          disabled={pending}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <p className="mt-2 text-[11px] leading-4 text-ink-muted">
          Raw JSON is an escape hatch. When edited, it becomes the payload for the next Save and
          still crosses server schema and CEL validation.
        </p>
      </div>
    </details>
  );
}

export function SchemaBlockForm({
  mode,
  placement,
  blockTypes,
  placementKeys,
  pending,
  serverError,
  onSave,
  onDirty,
  inspectField,
  hasUnsavedChanges,
  onDiscard,
  initialInsertion,
}: Readonly<{
  mode: 'add' | 'edit';
  placement?: CmsWorkspacePlacement;
  blockTypes: readonly CmsWorkspaceBlockType[];
  placementKeys: readonly string[];
  pending: boolean;
  serverError: string | null;
  onSave: (input: BlockFormSaveInput) => Promise<void>;
  onDirty: (description: string) => void;
  inspectField: (source: string) => Promise<CmsWorkspaceFieldInspection>;
  hasUnsavedChanges: boolean;
  onDiscard: () => void;
  initialInsertion?: BlockFormInsertion;
}>) {
  const [settingsExpanded, setSettingsExpanded] = useState(mode === 'add');
  const [formState, dispatch] = useReducer(
    blockFormReducer,
    { placement, blockTypes, placementKeys, insertion: initialInsertion },
    initialBlockFormState
  );
  const {
    blockTypeKey,
    placementKey,
    position,
    referencePlacementKey,
    values,
    rawJson,
    rawDirty,
    fieldErrors,
    touchedFields,
    liveInspections,
    inspectingFields,
    localError,
  } = formState;
  const blockType = selectedBlockType(blockTypes, blockTypeKey);
  const formModel = deriveBlockFormModel({
    schemaJson: blockType.schemaJson,
    exampleContentJson: blockType.exampleContentJson,
    currentContentJson: rawJson,
  });
  const replacingType = Boolean(placement && placement.blockType !== blockTypeKey);

  const discard = (): void => {
    dispatch({
      type: 'reset',
      state: initialBlockFormState({
        placement,
        blockTypes,
        placementKeys,
        insertion: initialInsertion,
      }),
    });
    onDiscard();
  };

  const changeType = (nextKey: string): void => {
    const nextType = selectedBlockType(blockTypes, nextKey);
    const nextContentJson =
      placement?.blockType === nextKey ? placement.contentJson : nextType.exampleContentJson;
    const nextModel = deriveBlockFormModel({
      schemaJson: nextType.schemaJson,
      exampleContentJson: nextType.exampleContentJson,
      currentContentJson: nextContentJson,
    });
    dispatch({
      type: 'patch',
      patch: {
        blockTypeKey: nextKey,
        rawJson: nextContentJson,
        values: draftValuesFromContent(nextModel.fields, parseContentJson(nextContentJson)),
        rawDirty: false,
        fieldErrors: {},
        touchedFields: {},
        liveInspections: {},
        inspectingFields: {},
        localError: null,
      },
    });
    onDirty('Unsaved block type change. Save the draft before previewing or publishing it.');
  };

  const inspectCurrentField = async (fieldKey: string, source: string): Promise<void> => {
    dispatch({ type: 'inspection-started', fieldKey });
    try {
      const inspection = await inspectField(source);
      dispatch({
        type: 'inspection-succeeded',
        fieldKey,
        source,
        inspection,
      });
    } catch (error) {
      dispatch({
        type: 'inspection-failed',
        fieldKey,
        source,
        message: error instanceof Error ? error.message : 'CEL evaluation failed.',
      });
    }
  };

  const changeField = (fieldKey: string, value: string): void => {
    const nextValues = { ...values, [fieldKey]: value };
    const parsed = contentFromDraft(formModel.fields, nextValues);
    dispatch({
      type: 'change-field',
      fieldKey,
      value,
      ...(parsed.success ? { rawJson: JSON.stringify(parsed.content, null, 2) } : {}),
    });
    onDirty(`Unsaved change to ${fieldKey}. Save the draft before previewing or publishing it.`);
  };

  const submit = async (): Promise<void> => {
    dispatch({ type: 'patch', patch: { localError: null } });
    let contentJson = rawJson;
    if (rawDirty) {
      try {
        contentJson = JSON.stringify(parseContentJson(rawJson), null, 2);
      } catch (error) {
        dispatch({
          type: 'patch',
          patch: {
            localError: error instanceof Error ? error.message : 'Enter valid object JSON.',
          },
        });
        return;
      }
    } else {
      const parsed = contentFromDraft(formModel.fields, values);
      if (!parsed.success) {
        dispatch({
          type: 'patch',
          patch: {
            fieldErrors: parsed.errors,
            localError: 'Fix the highlighted fields before saving.',
          },
        });
        return;
      }
      contentJson = JSON.stringify(parsed.content, null, 2);
    }
    try {
      await onSave({
        placementKey,
        blockTypeKey: registeredTypeKey(blockTypeKey),
        contentJson,
        ...(mode === 'add'
          ? {
              position,
              ...(position === 'before' || position === 'after' ? { referencePlacementKey } : {}),
            }
          : {}),
      });
    } catch (error) {
      dispatch({
        type: 'patch',
        patch: {
          localError: error instanceof Error ? error.message : 'The block could not be saved.',
        },
      });
    }
  };

  return (
    <form id={AUTHORING_BLOCK_FORM_ID} className="space-y-6" action={submit}>
      <section aria-labelledby="block-content-fields-heading">
        <div className="mb-5 border-b border-line pb-3">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
            Registered schema
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <h3 id="block-content-fields-heading" className="text-xs font-semibold text-ink">
              Content fields
            </h3>
            <span className="text-[10px] text-ink-faint">
              {blockType.name} · v{blockType.schemaVersion}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-ink-muted">
            Labels, nesting, and controls follow this block type’s immutable contract.
          </p>
        </div>
        <BlockSchemaFields
          formModel={formModel}
          values={values}
          pending={pending}
          fieldErrors={fieldErrors}
          placement={placement}
          touchedFields={touchedFields}
          liveInspections={liveInspections}
          inspectingFields={inspectingFields}
          onChange={changeField}
          onInspect={(fieldPath, value) => {
            void inspectCurrentField(fieldPath, value);
          }}
        />
      </section>

      <section className="border-t border-line pt-4">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md py-1 text-left text-xs font-semibold text-ink outline-none hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-focus"
          aria-expanded={settingsExpanded}
          aria-controls="block-settings-fields"
          onClick={() => setSettingsExpanded(!settingsExpanded)}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              'size-3.5 text-ink-faint transition-transform motion-reduce:transition-none',
              settingsExpanded && 'rotate-90'
            )}
          />
          Block settings
          <span className="font-normal text-ink-faint">Identity, type, and insertion</span>
        </button>
        <div
          id="block-settings-fields"
          hidden={!settingsExpanded}
          className="mt-4 space-y-5 border-l-2 border-line pl-3"
        >
          <BlockIdentityControls
            mode={mode}
            placement={placement}
            blockTypes={blockTypes}
            placementKeys={placementKeys}
            pending={pending}
            blockTypeKey={blockTypeKey}
            placementKey={placementKey}
            position={position}
            referencePlacementKey={referencePlacementKey}
            replacingType={replacingType}
            onPlacementKeyChange={(value) => {
              dispatch({ type: 'patch', patch: { placementKey: value } });
              onDirty(
                'Unsaved placement identity change. Save the draft before previewing or publishing it.'
              );
            }}
            onBlockTypeChange={changeType}
            onPositionChange={(value) => {
              dispatch({ type: 'patch', patch: { position: value } });
              onDirty(
                'Unsaved insertion-position change. Save the draft before previewing or publishing it.'
              );
            }}
            onReferencePlacementChange={(value) => {
              dispatch({ type: 'patch', patch: { referencePlacementKey: value } });
              onDirty(
                'Unsaved insertion-reference change. Save the draft before previewing or publishing it.'
              );
            }}
          />
        </div>
      </section>

      <AdvancedJsonEditor
        rawJson={rawJson}
        rawDirty={rawDirty}
        pending={pending}
        onChange={(value) => {
          dispatch({
            type: 'patch',
            patch: { rawJson: value, rawDirty: true, localError: null },
          });
          onDirty('Unsaved raw JSON change. Save the draft before previewing or publishing it.');
        }}
      />

      {localError || serverError ? (
        <p
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger-soft p-3 text-xs text-danger-strong"
        >
          {localError ?? serverError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={pending || !hasUnsavedChanges}
          onClick={discard}
        >
          Discard changes
        </Button>
        <Button
          type="submit"
          className="lg:hidden"
          disabled={pending || Boolean(formModel.schemaError)}
        >
          {pending ? 'Saving…' : mode === 'add' ? 'Add block' : 'Save block'}
        </Button>
      </div>
    </form>
  );
}
