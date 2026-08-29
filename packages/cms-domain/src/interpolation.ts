import type { JsonObject, JsonPrimitive, JsonValue } from './types';

export type InterpolationErrorCode =
  | 'MALFORMED_EXPRESSION'
  | 'INVALID_PATH'
  | 'TOO_MANY_EXPRESSIONS'
  | 'MISSING_VALUE'
  | 'NON_SCALAR_VALUE';

export class InterpolationError extends Error {
  readonly code: InterpolationErrorCode;
  readonly path?: string;

  constructor(code: InterpolationErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'InterpolationError';
    this.code = code;
    if (path !== undefined) {
      this.path = path;
    }
  }
}

export interface InterpolationTextToken {
  readonly kind: 'text';
  readonly value: string;
}

export interface InterpolationValueToken {
  readonly kind: 'value';
  readonly path: string;
  readonly source: string;
}

export type InterpolationToken = InterpolationTextToken | InterpolationValueToken;

export interface CompiledInterpolation {
  readonly source: string;
  readonly tokens: readonly InterpolationToken[];
  readonly dependencies: readonly string[];
}

const INTERPOLATION_PATH = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const DEFAULT_EXPRESSION_LIMIT = 256;
const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

export function compileInterpolation(
  source: string,
  expressionLimit = DEFAULT_EXPRESSION_LIMIT
): CompiledInterpolation {
  const tokens: InterpolationToken[] = [];
  let cursor = 0;
  let expressionCount = 0;

  while (cursor < source.length) {
    const open = source.indexOf('{{', cursor);
    const strayClose = source.indexOf('}}', cursor);
    if (strayClose !== -1 && (open === -1 || strayClose < open)) {
      throw new InterpolationError(
        'MALFORMED_EXPRESSION',
        `Unexpected closing interpolation braces at character ${strayClose}.`
      );
    }
    if (open === -1) {
      tokens.push({ kind: 'text', value: source.slice(cursor) });
      cursor = source.length;
      break;
    }
    if (open > cursor) {
      tokens.push({ kind: 'text', value: source.slice(cursor, open) });
    }
    const close = source.indexOf('}}', open + 2);
    if (close === -1) {
      throw new InterpolationError(
        'MALFORMED_EXPRESSION',
        `Interpolation opened at character ${open} but was not closed.`
      );
    }

    const raw = source.slice(open, close + 2);
    const path = source.slice(open + 2, close).trim();
    if (
      !INTERPOLATION_PATH.test(path) ||
      path.split('.').some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))
    ) {
      throw new InterpolationError(
        'INVALID_PATH',
        `Interpolation path ${JSON.stringify(path)} is not a dotted field path.`,
        path
      );
    }
    tokens.push({ kind: 'value', path, source: raw });
    expressionCount += 1;
    if (expressionCount > expressionLimit) {
      throw new InterpolationError(
        'TOO_MANY_EXPRESSIONS',
        `Interpolation exceeds the ${expressionLimit} expression limit.`
      );
    }
    cursor = close + 2;
  }

  if (source.length === 0) {
    tokens.push({ kind: 'text', value: '' });
  }

  const dependencies = [
    ...new Set(tokens.flatMap((current) => (current.kind === 'value' ? [current.path] : []))),
  ].sort();
  return { source, tokens, dependencies };
}

interface FoundValue {
  readonly found: boolean;
  readonly value?: JsonValue;
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPath(context: JsonObject, path: string): FoundValue {
  let current: JsonValue = context;
  for (const segment of path.split('.')) {
    if (!isJsonObject(current) || !Object.hasOwn(current, segment)) {
      return { found: false };
    }
    const next: JsonValue | undefined = current[segment];
    if (next === undefined) {
      return { found: false };
    }
    current = next;
  }
  return { found: true, value: current };
}

function formatValue(value: JsonValue, path: string): string {
  if (value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new InterpolationError(
        'NON_SCALAR_VALUE',
        `Interpolation value at "${path}" is not finite.`,
        path
      );
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  throw new InterpolationError(
    'NON_SCALAR_VALUE',
    `Interpolation value at "${path}" must be a scalar.`,
    path
  );
}

export interface InterpolateOptions {
  readonly onMissing?: 'error' | 'empty' | 'preserve';
}

export function renderInterpolation(
  compiled: CompiledInterpolation,
  context: JsonObject,
  options: InterpolateOptions = {}
): string {
  const onMissing = options.onMissing ?? 'error';
  return compiled.tokens
    .map((current) => {
      if (current.kind === 'text') {
        return current.value;
      }
      const result = readPath(context, current.path);
      if (result.found && result.value !== undefined) {
        return formatValue(result.value, current.path);
      }
      if (onMissing === 'empty') {
        return '';
      }
      if (onMissing === 'preserve') {
        return current.source;
      }
      throw new InterpolationError(
        'MISSING_VALUE',
        `Interpolation value "${current.path}" is missing.`,
        current.path
      );
    })
    .join('');
}

export function interpolateTemplate(
  source: string,
  context: JsonObject,
  options: InterpolateOptions = {}
): string {
  return renderInterpolation(compileInterpolation(source), context, options);
}

/** Recursively interpolates every string leaf without evaluating code or changing non-string values. */
export function interpolateJson(
  input: JsonValue,
  context: JsonObject,
  options: InterpolateOptions = {}
): JsonValue {
  if (typeof input === 'string') {
    return interpolateTemplate(input, context, options);
  }
  if (input === null || typeof input === 'number' || typeof input === 'boolean') {
    return input as JsonPrimitive;
  }
  if (Array.isArray(input)) {
    return input.map((item) => interpolateJson(item, context, options));
  }

  return Object.fromEntries(
    Object.entries(input)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, interpolateJson(value, context, options)])
  );
}
