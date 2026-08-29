import type { SQLQueryBindings } from 'bun:sqlite';
import {
  compileSelector,
  formatSelector,
  normalizeSelector,
  type SelectorExpression,
  type SelectorScalar,
} from '@repo/cms-domain';

import type { ApprovedSelectorField } from './types';

export interface ApprovedSelectorCompilation {
  readonly expression: SelectorExpression;
  readonly normalized: string;
  readonly predicateSql: string;
  readonly parameters: readonly SQLQueryBindings[];
}

const BUILTIN_COLUMNS = new Map([
  ['canonical_url', 'canonical_url'],
  ['route_external_id', 'route_external_id'],
  ['route_status', 'route_status'],
]);

const normalizeText = (value: string): string => value.normalize('NFKC').trim().toLowerCase();

function normalizeFieldValue(field: ApprovedSelectorField, value: SelectorScalar): SelectorScalar {
  if (field.kind === 'tag') {
    if (typeof value !== 'string') {
      throw new Error(`Tag selector field "${field.name}" requires string values.`);
    }
    return normalizeText(value);
  }
  if (field.kind === 'builtin') {
    if (typeof value !== 'string') {
      throw new Error(`Built-in selector field "${field.name}" requires a string value.`);
    }
    return field.sourceKey === 'route_status' ? normalizeText(value) : value;
  }
  if (field.valueType === 'integer') {
    const number = typeof value === 'number' ? value : Number(value);
    if (!Number.isSafeInteger(number)) {
      throw new Error(`Slot selector field "${field.name}" requires an integer value.`);
    }
    return String(number);
  }
  if (field.valueType === 'boolean') {
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    const normalized = normalizeText(String(value));
    if (normalized !== 'true' && normalized !== 'false') {
      throw new Error(`Slot selector field "${field.name}" requires a boolean value.`);
    }
    return normalized;
  }
  return normalizeText(String(value));
}

function normalizeValues(
  expression: SelectorExpression,
  fields: ReadonlyMap<string, ApprovedSelectorField>
): SelectorExpression {
  if (expression.kind === 'comparison') {
    const field = fields.get(expression.field);
    if (!field) {
      throw new Error(`Unknown selector field "${expression.field}".`);
    }
    return { ...expression, value: normalizeFieldValue(field, expression.value) };
  }
  if (expression.kind === 'in') {
    const field = fields.get(expression.field);
    if (!field) {
      throw new Error(`Unknown selector field "${expression.field}".`);
    }
    return {
      ...expression,
      values: expression.values.map((value) => normalizeFieldValue(field, value)),
    };
  }
  return {
    kind: expression.kind,
    operands: expression.operands.map((operand) => normalizeValues(operand, fields)),
  };
}

function placeholders(values: readonly SelectorScalar[]): string {
  return values.map(() => '?').join(', ');
}

function compileFieldPredicate(
  field: ApprovedSelectorField,
  values: readonly SelectorScalar[],
  parameters: SQLQueryBindings[]
): string {
  const comparison = values.length === 1 ? '= ?' : `IN (${placeholders(values)})`;
  if (field.kind === 'builtin') {
    const column = BUILTIN_COLUMNS.get(field.sourceKey);
    if (!column) {
      throw new Error(`Built-in selector field "${field.name}" is not mapped.`);
    }
    parameters.push(...values);
    return `p."${column}" ${comparison}`;
  }
  if (field.kind === 'slot') {
    parameters.push(field.sourceKey, ...values);
    return `EXISTS (
      SELECT 1
      FROM page_slot_values AS psv
      JOIN template_slots AS ts
        ON ts.id = psv.slot_id AND ts.template_id = p.template_id
      WHERE psv.page_instance_id = p.id
        AND psv.template_id = p.template_id
        AND ts.key = ?
        AND psv.normalized_value ${comparison}
    )`;
  }

  parameters.push(field.sourceKey, ...values);
  return `EXISTS (
    SELECT 1
    FROM page_tags AS pt
    JOIN tags AS t
      ON t.id = pt.tag_id AND t.template_id = p.template_id
    WHERE pt.page_instance_id = p.id
      AND pt.template_id = p.template_id
      AND t.namespace = ?
      AND t.value ${comparison}
  )`;
}

function compileExpression(
  expression: SelectorExpression,
  fields: ReadonlyMap<string, ApprovedSelectorField>,
  parameters: SQLQueryBindings[]
): string {
  if (expression.kind === 'comparison') {
    const field = fields.get(expression.field);
    if (!field) {
      throw new Error(`Unknown selector field "${expression.field}".`);
    }
    return compileFieldPredicate(field, [expression.value], parameters);
  }
  if (expression.kind === 'in') {
    const field = fields.get(expression.field);
    if (!field) {
      throw new Error(`Unknown selector field "${expression.field}".`);
    }
    return compileFieldPredicate(field, expression.values, parameters);
  }
  const operator = expression.kind === 'and' ? ' AND ' : ' OR ';
  return `(${expression.operands
    .map((operand) => compileExpression(operand, fields, parameters))
    .join(operator)})`;
}

export function compileApprovedSelector(
  selector: string,
  approvedFields: readonly ApprovedSelectorField[]
): ApprovedSelectorCompilation {
  const fieldMap = new Map(approvedFields.map((field) => [field.name, field]));
  const domainCompilation = compileSelector(selector, { fields: [...fieldMap.keys()] });
  const expression = normalizeSelector(normalizeValues(domainCompilation.expression, fieldMap));
  const parameters: SQLQueryBindings[] = [];
  const predicateSql = compileExpression(expression, fieldMap, parameters);
  return {
    expression,
    normalized: formatSelector(expression),
    predicateSql,
    parameters,
  };
}

const HAS_TAG_SELECTOR = /^has_tag\s*\(\s*'((?:''|[^'])*)'\s*,\s*'((?:''|[^'])*)'\s*\)\s*$/i;

const quoteSelectorString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** Converts the audited Median seed's has_tag form into the named multi-value field grammar. */
export function adaptStoredSelector(selector: string): string {
  const trimmed = selector.trim();
  const match = HAS_TAG_SELECTOR.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const namespace = (match[1] ?? '').replaceAll("''", "'");
  const value = (match[2] ?? '').replaceAll("''", "'");
  return `${namespace} = ${quoteSelectorString(value)}`;
}
