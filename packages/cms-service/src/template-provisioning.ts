import type {
  NormalizedProvisionTemplateSlot,
  TemplateProvisioningIssue,
  TemplateProvisioningLimits,
  TemplateProvisioningPreview,
  TemplateProvisioningPreviewInput,
  TemplateVariableKind,
} from './types';

const DEFAULT_LIMITS = {
  maxUploadBytes: 10 * 1024 * 1024,
  maxRowsPerCsv: 1_000_000,
  maxCardinality: 1_000_000,
  sampleLimit: 10,
} as const;

const MAX_CANONICAL_URL_LENGTH = 2_048;
const RESERVED_TEMPLATE_KEYS = new Set(['stores', 'eligible-vehicles', 'structural-proof']);

interface ParsedCsvRow {
  readonly row: number;
  readonly cells: readonly string[];
}

interface ResolvedLimits {
  readonly maxUploadBytes: number;
  readonly maxRowsPerCsv: number;
  readonly maxCardinality: number;
  readonly sampleLimit: number;
}

const machineSegment = (value: string): string => value.normalize('NFKC').trim().toLowerCase();

const resolvePositiveLimit = (value: number | undefined, fallback: number): number =>
  Number.isSafeInteger(value) && (value ?? 0) > 0 ? Math.min(value as number, fallback) : fallback;

const resolveLimits = (limits: TemplateProvisioningLimits | undefined): ResolvedLimits => ({
  maxUploadBytes: resolvePositiveLimit(limits?.maxUploadBytes, DEFAULT_LIMITS.maxUploadBytes),
  maxRowsPerCsv: resolvePositiveLimit(limits?.maxRowsPerCsv, DEFAULT_LIMITS.maxRowsPerCsv),
  maxCardinality: resolvePositiveLimit(limits?.maxCardinality, DEFAULT_LIMITS.maxCardinality),
  sampleLimit: resolvePositiveLimit(limits?.sampleLimit, DEFAULT_LIMITS.sampleLimit),
});

const parseCsvRows = (
  source: string,
  path: string
): {
  readonly rows: readonly ParsedCsvRow[];
  readonly errors: readonly TemplateProvisioningIssue[];
} => {
  const input = source.startsWith('\uFEFF') ? source.slice(1) : source;
  const rows: ParsedCsvRow[] = [];
  const errors: TemplateProvisioningIssue[] = [];
  let cells: string[] = [];
  let cell = '';
  let row = 1;
  let quoted = false;
  let afterQuote = false;
  let sawContent = false;

  const finishCell = (): void => {
    cells.push(cell);
    cell = '';
    afterQuote = false;
  };
  const finishRow = (): void => {
    finishCell();
    rows.push({ row, cells });
    cells = [];
    row += 1;
    sawContent = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? '';
    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        cell += character;
      }
      sawContent = true;
      continue;
    }
    if (afterQuote) {
      if (character === ',') {
        finishCell();
        sawContent = true;
        continue;
      }
      if (character === '\n' || character === '\r') {
        if (character === '\r' && input[index + 1] === '\n') {
          index += 1;
        }
        finishRow();
        continue;
      }
      errors.push({
        path,
        row,
        code: 'invalid_csv',
        message: `Row ${row} contains characters after a closing quote.`,
      });
      afterQuote = false;
      cell += character;
      sawContent = true;
      continue;
    }
    if (character === '"') {
      if (cell.length > 0) {
        errors.push({
          path,
          row,
          code: 'invalid_csv',
          message: `Row ${row} contains a quote inside an unquoted value.`,
        });
        cell += character;
      } else {
        quoted = true;
      }
      sawContent = true;
      continue;
    }
    if (character === ',') {
      finishCell();
      sawContent = true;
      continue;
    }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') {
        index += 1;
      }
      finishRow();
      continue;
    }
    cell += character;
    sawContent = true;
  }

  if (quoted) {
    errors.push({
      path,
      row,
      code: 'invalid_csv',
      message: `Row ${row} has an unterminated quoted value.`,
    });
  }
  if (sawContent || cell.length > 0 || cells.length > 0) {
    finishRow();
  }
  return { rows, errors };
};

const normalizeLocale = (rawValue: string): string | null => {
  const value = rawValue.normalize('NFKC').trim();
  if (value.length === 0 || value.includes('/') || value.includes('%')) {
    return null;
  }
  try {
    const canonical = Intl.getCanonicalLocales(value);
    return canonical.length === 1 ? (canonical[0] ?? null) : null;
  } catch {
    return null;
  }
};

const normalizeVariableCsv = (
  kind: TemplateVariableKind,
  source: string | undefined,
  limits: ResolvedLimits
): {
  readonly values: readonly string[];
  readonly errors: readonly TemplateProvisioningIssue[];
} => {
  const path = `${kind}Csv`;
  if (source === undefined) {
    return {
      values: [],
      errors: [{ path, code: 'missing_csv', message: `${kind} requires a ${kind}.csv upload.` }],
    };
  }
  if (new TextEncoder().encode(source).byteLength > limits.maxUploadBytes) {
    return {
      values: [],
      errors: [
        {
          path,
          code: 'upload_limit',
          message: `${kind}.csv exceeds the ${limits.maxUploadBytes}-byte upload limit.`,
        },
      ],
    };
  }
  const parsed = parseCsvRows(source, path);
  const errors = [...parsed.errors];
  const header = parsed.rows[0];
  if (header?.cells.length !== 1 || header.cells[0] !== kind) {
    errors.push({
      path,
      row: 1,
      code: 'invalid_header',
      message: `${kind}.csv must contain exactly one header named "${kind}".`,
    });
    return { values: [], errors };
  }
  const dataRows = parsed.rows.slice(1);
  if (dataRows.length > limits.maxRowsPerCsv) {
    errors.push({
      path,
      code: 'row_limit',
      message: `${kind}.csv exceeds the ${limits.maxRowsPerCsv}-row limit.`,
    });
  }
  const values: string[] = [];
  const firstRowByValue = new Map<string, number>();
  for (const csvRow of dataRows.slice(0, limits.maxRowsPerCsv)) {
    if (csvRow.cells.length !== 1) {
      errors.push({
        path,
        row: csvRow.row,
        code: 'invalid_csv',
        message: `Row ${csvRow.row} must contain exactly one ${kind} value.`,
      });
      continue;
    }
    const rawValue = csvRow.cells[0] ?? '';
    if (rawValue.trim().length === 0) {
      errors.push({
        path,
        row: csvRow.row,
        code: 'blank',
        message: `Row ${csvRow.row} has a blank ${kind} value.`,
      });
      continue;
    }
    const normalized =
      kind === 'locale'
        ? normalizeLocale(rawValue)
        : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(machineSegment(rawValue))
          ? machineSegment(rawValue)
          : null;
    if (normalized === null) {
      errors.push({
        path,
        row: csvRow.row,
        code: kind === 'locale' ? 'invalid_locale' : 'invalid_slug',
        message: `Row ${csvRow.row} contains an invalid ${kind} value.`,
      });
      continue;
    }
    const firstRow = firstRowByValue.get(normalized);
    if (firstRow !== undefined) {
      errors.push({
        path,
        row: csvRow.row,
        code: 'duplicate',
        message: `Row ${csvRow.row} duplicates normalized value "${normalized}" from row ${firstRow}.`,
      });
      continue;
    }
    firstRowByValue.set(normalized, csvRow.row);
    values.push(normalized);
  }
  if (values.length === 0 && errors.length === 0) {
    errors.push({ path, code: 'blank', message: `${kind}.csv must contain at least one value.` });
  }
  return { values, errors };
};

export const normalizeTemplateDomain = (domain: string): string | null => {
  const normalized = domain.normalize('NFKC').trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > 253 || !/^[a-z0-9.-]+$/.test(normalized)) {
    return null;
  }
  if (/^[0-9.]+$/.test(normalized)) {
    const octets = normalized.split('.');
    if (
      octets.length !== 4 ||
      octets.some(
        (octet) =>
          !/^\d{1,3}$/.test(octet) ||
          Number(octet) > 255 ||
          (octet.length > 1 && octet.startsWith('0'))
      )
    ) {
      return null;
    }
    return normalized;
  }
  const labels = normalized.split('.');
  if (
    labels.some(
      (label) =>
        label.length === 0 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    )
  ) {
    return null;
  }
  return normalized;
};

const routeCombinations = function* (
  slots: readonly NormalizedProvisionTemplateSlot[],
  values: Readonly<Record<TemplateVariableKind, readonly string[]>>,
  index = 0,
  current: Readonly<Record<string, string>> = {}
): Generator<Readonly<Record<string, string>>> {
  const slot = slots[index];
  if (!slot) {
    yield current;
    return;
  }
  const candidates =
    slot.kind === 'static'
      ? [slot.staticValue ?? '']
      : slot.variableKind
        ? values[slot.variableKind]
        : [];
  for (const candidate of candidates) {
    yield* routeCombinations(slots, values, index + 1, { ...current, [slot.key]: candidate });
  }
};

export const iterateTemplateRouteValues = (
  preview: Pick<TemplateProvisioningPreview, 'slots' | 'values'>
): Generator<Readonly<Record<string, string>>> => routeCombinations(preview.slots, preview.values);

export const iterateTemplateRouteValueBatches = function* (
  preview: Pick<TemplateProvisioningPreview, 'slots' | 'values'>,
  batchSize: number
): Generator<readonly Readonly<Record<string, string>>[]> {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 10_000) {
    throw new RangeError('Template route batch size must be an integer from 1 through 10000.');
  }
  let batch: Readonly<Record<string, string>>[] = [];
  for (const routeValues of iterateTemplateRouteValues(preview)) {
    batch.push(routeValues);
    if (batch.length === batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) {
    yield batch;
  }
};

export const canonicalUrlForProvisionedValues = (
  slots: readonly NormalizedProvisionTemplateSlot[],
  values: Readonly<Record<string, string>>
): string => `/${slots.map((slot) => encodeURIComponent(values[slot.key] ?? '')).join('/')}`;

export const previewTemplateProvisioning = (
  input: TemplateProvisioningPreviewInput
): TemplateProvisioningPreview => {
  const limits = resolveLimits(input.limits);
  const errors: TemplateProvisioningIssue[] = [];
  const normalizedDomain = normalizeTemplateDomain(input.template.domain);
  if (input.template.id.trim().length === 0) {
    errors.push({ path: 'template.id', code: 'blank', message: 'Template ID is required.' });
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.template.key)) {
    errors.push({
      path: 'template.key',
      code: 'invalid_slot',
      message: 'Template key must be lowercase kebab-case.',
    });
  } else if (RESERVED_TEMPLATE_KEYS.has(input.template.key)) {
    errors.push({
      path: 'template.key',
      code: 'collision',
      message: `Template key "${input.template.key}" is reserved by a built-in proof scenario.`,
    });
  }
  if (input.template.name.trim().length === 0) {
    errors.push({ path: 'template.name', code: 'blank', message: 'Template name is required.' });
  }
  if (normalizedDomain === null) {
    errors.push({
      path: 'template.domain',
      code: 'invalid_domain',
      message: 'Template domain must be a bare host name.',
    });
  }
  if (input.slots.length === 0) {
    errors.push({
      path: 'slots',
      code: 'invalid_slot',
      message: 'At least one URL slot is required.',
    });
  }
  if (input.slots.length > 32) {
    errors.push({
      path: 'slots',
      code: 'invalid_slot',
      message: 'A URL grammar supports at most 32 ordered slots.',
    });
  }

  const normalizedSlots: NormalizedProvisionTemplateSlot[] = [];
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const seenVariableKinds = new Set<TemplateVariableKind>();
  for (const [pathPosition, slot] of input.slots.entries()) {
    const path = `slots.${pathPosition}`;
    const key = machineSegment(slot.key);
    if (!/^[a-z][a-z0-9_]*$/.test(key) || key === 'tags') {
      errors.push({
        path: `${path}.key`,
        code: 'invalid_slot',
        message: 'Slot keys must be path-safe identifiers and cannot use reserved key "tags".',
      });
    }
    if (seenKeys.has(key)) {
      errors.push({
        path: `${path}.key`,
        code: 'duplicate',
        message: `Slot key "${key}" is duplicated.`,
      });
    }
    seenKeys.add(key);
    if (slot.id.trim().length === 0) {
      errors.push({ path: `${path}.id`, code: 'blank', message: 'Slot ID is required.' });
    }
    if (seenIds.has(slot.id)) {
      errors.push({
        path: `${path}.id`,
        code: 'duplicate',
        message: `Slot ID "${slot.id}" is duplicated.`,
      });
    }
    seenIds.add(slot.id);
    if (slot.label.trim().length === 0) {
      errors.push({ path: `${path}.label`, code: 'blank', message: 'Slot label is required.' });
    }
    if (slot.kind === 'static') {
      const staticValue = machineSegment(slot.staticValue);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(staticValue)) {
        errors.push({
          path: `${path}.staticValue`,
          code: 'invalid_slug',
          message: 'Static slots must be non-empty lowercase URL segments after normalization.',
        });
      }
      normalizedSlots.push({
        id: slot.id,
        key,
        label: slot.label.trim(),
        kind: 'static',
        variableKind: null,
        pathPosition,
        staticValue,
      });
      continue;
    }
    if (slot.key !== slot.variableKind) {
      errors.push({
        path: `${path}.key`,
        code: 'invalid_slot',
        message: `A ${slot.variableKind} variable slot must use key "${slot.variableKind}".`,
      });
    }
    if (seenVariableKinds.has(slot.variableKind)) {
      errors.push({
        path: `${path}.variableKind`,
        code: 'duplicate',
        message: `Only one ${slot.variableKind} variable slot is allowed.`,
      });
    }
    seenVariableKinds.add(slot.variableKind);
    normalizedSlots.push({
      id: slot.id,
      key,
      label: slot.label.trim(),
      kind: 'variable',
      variableKind: slot.variableKind,
      pathPosition,
      staticValue: null,
    });
  }

  const localeResult = seenVariableKinds.has('locale')
    ? normalizeVariableCsv('locale', input.localeCsv, limits)
    : { values: [] as readonly string[], errors: [] as readonly TemplateProvisioningIssue[] };
  const slugResult = seenVariableKinds.has('slug')
    ? normalizeVariableCsv('slug', input.slugCsv, limits)
    : { values: [] as readonly string[], errors: [] as readonly TemplateProvisioningIssue[] };
  errors.push(...localeResult.errors, ...slugResult.errors);
  if (!seenVariableKinds.has('locale') && input.localeCsv !== undefined) {
    errors.push({
      path: 'localeCsv',
      code: 'invalid_slot',
      message: 'locale.csv was supplied without a locale slot.',
    });
  }
  if (!seenVariableKinds.has('slug') && input.slugCsv !== undefined) {
    errors.push({
      path: 'slugCsv',
      code: 'invalid_slot',
      message: 'slug.csv was supplied without a slug slot.',
    });
  }
  const values = { locale: localeResult.values, slug: slugResult.values } as const;
  let cardinality = 1;
  for (const kind of seenVariableKinds) {
    cardinality *= values[kind].length;
  }
  if (cardinality > limits.maxCardinality) {
    errors.push({
      path: 'slots',
      code: 'cardinality_limit',
      message: `The URL Cartesian product has ${cardinality} pages, above the ${limits.maxCardinality}-page limit.`,
    });
  }
  const urlPattern = `/${normalizedSlots
    .map((slot) => (slot.kind === 'static' ? slot.staticValue : `{${slot.key}}`))
    .join('/')}`;
  if (urlPattern.length > MAX_CANONICAL_URL_LENGTH) {
    errors.push({
      path: 'slots',
      code: 'invalid_slot',
      message: `The URL pattern exceeds the ${MAX_CANONICAL_URL_LENGTH}-character canonical URL limit.`,
    });
  }
  const longestConcreteUrlLength = normalizedSlots.reduce((length, slot) => {
    if (slot.kind === 'static') {
      return length + 1 + encodeURIComponent(slot.staticValue ?? '').length;
    }
    let longestValueLength = 0;
    for (const value of slot.variableKind ? values[slot.variableKind] : []) {
      longestValueLength = Math.max(longestValueLength, encodeURIComponent(value).length);
    }
    return length + 1 + longestValueLength;
  }, 0);
  if (longestConcreteUrlLength > MAX_CANONICAL_URL_LENGTH) {
    errors.push({
      path: 'slots',
      code: 'invalid_slot',
      message: `At least one generated route exceeds the ${MAX_CANONICAL_URL_LENGTH}-character canonical URL limit.`,
    });
  }
  const sampleCanonicalUrls: string[] = [];
  if (errors.length === 0) {
    for (const combination of routeCombinations(normalizedSlots, values)) {
      sampleCanonicalUrls.push(canonicalUrlForProvisionedValues(normalizedSlots, combination));
      if (sampleCanonicalUrls.length >= limits.sampleLimit) {
        break;
      }
    }
  }
  return {
    valid: errors.length === 0,
    normalizedDomain: normalizedDomain ?? '',
    urlPattern,
    slots: normalizedSlots,
    values,
    cardinality,
    sampleCanonicalUrls,
    errors,
  };
};
