import {
  type CelEngineConfig,
  type CelError,
  type CelErrorCode,
  type CompiledCelExpression,
  compileCelExpression,
  DEFAULT_CEL_CONFIG,
  evaluateCelExpression,
  formatCelScalar,
  validateCelExpressionCount,
} from '@repo/cel-engine';

import type { JsonObject, JsonPrimitive, JsonValue } from './types';

export type InterpolationErrorCode =
  | CelErrorCode
  | 'MALFORMED_EXPRESSION'
  | 'INVALID_PATH'
  | 'TOO_MANY_EXPRESSIONS';

export class InterpolationError extends Error {
  readonly code: InterpolationErrorCode;
  readonly path?: string;
  readonly expression?: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
  readonly celError?: CelError;

  constructor(
    code: InterpolationErrorCode,
    message: string,
    options: {
      readonly path?: string;
      readonly expression?: string;
      readonly sourceStart?: number;
      readonly sourceEnd?: number;
      readonly celError?: CelError;
    } = {}
  ) {
    super(message);
    this.name = 'InterpolationError';
    this.code = code;
    if (options.path !== undefined) this.path = options.path;
    if (options.expression !== undefined) this.expression = options.expression;
    if (options.sourceStart !== undefined) this.sourceStart = options.sourceStart;
    if (options.sourceEnd !== undefined) this.sourceEnd = options.sourceEnd;
    if (options.celError !== undefined) this.celError = options.celError;
  }
}

export interface InterpolationTextToken {
  readonly kind: 'text';
  readonly value: string;
}

export interface InterpolationValueToken {
  readonly kind: 'value';
  /** Backward-compatible alias for the CEL expression source. */
  readonly path: string;
  readonly expression: string;
  readonly source: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly compiled: CompiledCelExpression;
}

export type InterpolationToken = InterpolationTextToken | InterpolationValueToken;

export interface CompiledInterpolation {
  readonly source: string;
  readonly tokens: readonly InterpolationToken[];
  readonly dependencies: readonly string[];
  readonly allowedVariables: readonly string[];
  readonly expressionCount: number;
  readonly maxAstDepth: number;
}

export interface CompileInterpolationOptions extends CelEngineConfig {
  readonly allowedRoots?: readonly string[];
  readonly expressionLimit?: number;
}

export type InterpolationInspection =
  | { readonly success: true; readonly compiled: CompiledInterpolation }
  | {
      readonly success: false;
      readonly error: {
        readonly code: InterpolationErrorCode;
        readonly message: string;
        readonly path?: string;
        readonly expression?: string;
        readonly sourceStart?: number;
        readonly sourceEnd?: number;
      };
    };

export type InterpolationSampleInspection =
  | {
      readonly success: true;
      readonly source: string;
      readonly dependencies: readonly string[];
      readonly allowedVariables: readonly string[];
      readonly expressionCount: number;
      readonly maxAstDepth: number;
      readonly evaluatedSample: string;
    }
  | {
      readonly success: false;
      readonly source: string;
      readonly dependencies: readonly string[];
      readonly allowedVariables: readonly string[];
      readonly error: {
        readonly code: InterpolationErrorCode;
        readonly message: string;
        readonly path?: string;
        readonly expression?: string;
        readonly sourceStart?: number;
        readonly sourceEnd?: number;
      };
    };

interface CompiledJsonStringNode {
  readonly kind: 'string';
  readonly compiled: CompiledInterpolation;
}

interface CompiledJsonPrimitiveNode {
  readonly kind: 'primitive';
  readonly value: JsonPrimitive;
}

interface CompiledJsonArrayNode {
  readonly kind: 'array';
  readonly items: readonly CompiledJsonNode[];
}

interface CompiledJsonObjectNode {
  readonly kind: 'object';
  readonly entries: readonly (readonly [string, CompiledJsonNode])[];
}

type CompiledJsonNode =
  | CompiledJsonStringNode
  | CompiledJsonPrimitiveNode
  | CompiledJsonArrayNode
  | CompiledJsonObjectNode;

export interface CompiledJsonInterpolationField {
  readonly path: string;
  readonly source: string;
  readonly dependencies: readonly string[];
  readonly expressionCount: number;
}

export interface CompiledJsonInterpolation {
  readonly source: JsonValue;
  readonly fields: readonly CompiledJsonInterpolationField[];
  readonly dependencies: readonly string[];
  readonly allowedVariables: readonly string[];
  readonly root: CompiledJsonNode;
}

const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

function interpolationErrorFromCel(
  error: CelError,
  expression: string,
  expressionOffset: number,
  fieldPath?: string
): InterpolationError {
  const sourceStart = error.start === undefined ? expressionOffset : expressionOffset + error.start;
  const sourceEnd = error.end === undefined ? undefined : expressionOffset + error.end;
  const prefix = fieldPath === undefined ? '' : `${fieldPath}: `;
  return new InterpolationError(error.code, `${prefix}${error.message}`, {
    path: fieldPath ?? error.dependency,
    expression,
    sourceStart,
    ...(sourceEnd === undefined ? {} : { sourceEnd }),
    celError: error,
  });
}

function expressionClose(source: string, start: number): number {
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let mapDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') {
      mapDepth += 1;
      continue;
    }
    if (character === '}' && mapDepth > 0) {
      mapDepth -= 1;
      continue;
    }
    if (character === '}' && next === '}' && mapDepth === 0) {
      return index;
    }
  }
  return -1;
}

function resolvedOptions(
  optionsOrLimit: CompileInterpolationOptions | number
): CompileInterpolationOptions {
  return typeof optionsOrLimit === 'number'
    ? { expressionLimit: optionsOrLimit, maxExpressionCount: optionsOrLimit }
    : optionsOrLimit;
}

export function compileInterpolation(
  source: string,
  optionsOrLimit: CompileInterpolationOptions | number = {}
): CompiledInterpolation {
  const options = resolvedOptions(optionsOrLimit);
  const maxSourceLength = options.maxSourceLength ?? DEFAULT_CEL_CONFIG.maxSourceLength;
  const expressionLimit =
    options.expressionLimit ?? options.maxExpressionCount ?? DEFAULT_CEL_CONFIG.maxExpressionCount;
  if (source.length > maxSourceLength) {
    throw new InterpolationError(
      'SOURCE_TOO_LONG',
      `Interpolated field exceeds the ${maxSourceLength} character limit.`
    );
  }

  const tokens: InterpolationToken[] = [];
  let cursor = 0;
  let expressionCount = 0;
  let maxAstDepth = 0;

  while (cursor < source.length) {
    const open = source.indexOf('{{', cursor);
    const strayClose = source.indexOf('}}', cursor);
    if (strayClose !== -1 && (open === -1 || strayClose < open)) {
      throw new InterpolationError(
        'MALFORMED_EXPRESSION',
        `Unexpected closing interpolation braces at character ${strayClose}.`,
        { sourceStart: strayClose, sourceEnd: strayClose + 2 }
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
    const close = expressionClose(source, open + 2);
    if (close === -1) {
      throw new InterpolationError(
        'MALFORMED_EXPRESSION',
        `Interpolation opened at character ${open} but was not closed.`,
        { sourceStart: open, sourceEnd: source.length }
      );
    }

    expressionCount += 1;
    const countResult = validateCelExpressionCount(source, expressionCount, {
      ...options,
      maxExpressionCount: expressionLimit,
    });
    if (!countResult.success) {
      throw new InterpolationError(
        'TOO_MANY_EXPRESSIONS',
        `Interpolation exceeds the ${expressionLimit} expression limit.`,
        { sourceStart: open, sourceEnd: close + 2, celError: countResult.error }
      );
    }

    const raw = source.slice(open, close + 2);
    const untrimmedExpression = source.slice(open + 2, close);
    const expression = untrimmedExpression.trim();
    const leadingWhitespace = untrimmedExpression.length - untrimmedExpression.trimStart().length;
    const expressionOffset = open + 2 + leadingWhitespace;
    const compiled = compileCelExpression(expression, options);
    if (!compiled.success) {
      throw interpolationErrorFromCel(compiled.error, expression, expressionOffset);
    }
    maxAstDepth = Math.max(maxAstDepth, compiled.compiled.astDepth);
    tokens.push({
      kind: 'value',
      path: expression,
      expression,
      source: raw,
      sourceStart: open,
      sourceEnd: close + 2,
      compiled: compiled.compiled,
    });
    cursor = close + 2;
  }

  if (source.length === 0) {
    tokens.push({ kind: 'text', value: '' });
  }

  const valueTokens = tokens.filter(
    (token): token is InterpolationValueToken => token.kind === 'value'
  );
  return {
    source,
    tokens,
    dependencies: [...new Set(valueTokens.flatMap((token) => token.compiled.dependencies))].sort(),
    allowedVariables: [
      ...new Set(valueTokens.flatMap((token) => token.compiled.allowedVariables)),
    ].sort(),
    expressionCount,
    maxAstDepth,
  };
}

export function inspectInterpolation(
  source: string,
  options: CompileInterpolationOptions = {}
): InterpolationInspection {
  try {
    return { success: true, compiled: compileInterpolation(source, options) };
  } catch (error) {
    if (!(error instanceof InterpolationError)) {
      throw error;
    }
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.path === undefined ? {} : { path: error.path }),
        ...(error.expression === undefined ? {} : { expression: error.expression }),
        ...(error.sourceStart === undefined ? {} : { sourceStart: error.sourceStart }),
        ...(error.sourceEnd === undefined ? {} : { sourceEnd: error.sourceEnd }),
      },
    };
  }
}

function interpolationErrorValue(error: InterpolationError): {
  readonly code: InterpolationErrorCode;
  readonly message: string;
  readonly path?: string;
  readonly expression?: string;
  readonly sourceStart?: number;
  readonly sourceEnd?: number;
} {
  return {
    code: error.code,
    message: error.message,
    ...(error.path === undefined ? {} : { path: error.path }),
    ...(error.expression === undefined ? {} : { expression: error.expression }),
    ...(error.sourceStart === undefined ? {} : { sourceStart: error.sourceStart }),
    ...(error.sourceEnd === undefined ? {} : { sourceEnd: error.sourceEnd }),
  };
}

export interface InterpolateOptions {
  readonly onMissing?: 'error' | 'empty' | 'preserve';
}

function isMissingCelError(code: CelErrorCode): boolean {
  return code === 'MISSING_VALUE' || code === 'UNKNOWN_ROOT';
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
      const result = evaluateCelExpression(current.compiled, context, { expected: 'scalar' });
      if (result.success) {
        if (result.value !== null && typeof result.value === 'object') {
          throw new InterpolationError(
            'NON_SCALAR_VALUE',
            'Interpolated CEL segments must evaluate to a scalar.',
            { expression: current.expression, sourceStart: current.sourceStart }
          );
        }
        return formatCelScalar(result.value);
      }
      if (isMissingCelError(result.error.code) && onMissing === 'empty') {
        return '';
      }
      if (isMissingCelError(result.error.code) && onMissing === 'preserve') {
        return current.source;
      }
      throw interpolationErrorFromCel(result.error, current.expression, current.sourceStart + 2);
    })
    .join('');
}

/** Serializable compile-and-preview contract for authoring form inspectors. */
export function inspectInterpolationSample(
  source: string,
  context: JsonObject,
  options: CompileInterpolationOptions = {}
): InterpolationSampleInspection {
  const inspection = inspectInterpolation(source, options);
  if (!inspection.success) {
    return {
      success: false,
      source,
      dependencies: [],
      allowedVariables: [...new Set(options.allowedRoots ?? [])].sort(),
      error: inspection.error,
    };
  }
  try {
    return {
      success: true,
      source,
      dependencies: inspection.compiled.dependencies,
      allowedVariables: inspection.compiled.allowedVariables,
      expressionCount: inspection.compiled.expressionCount,
      maxAstDepth: inspection.compiled.maxAstDepth,
      evaluatedSample: renderInterpolation(inspection.compiled, context),
    };
  } catch (error) {
    if (!(error instanceof InterpolationError)) {
      throw error;
    }
    return {
      success: false,
      source,
      dependencies: inspection.compiled.dependencies,
      allowedVariables: inspection.compiled.allowedVariables,
      error: interpolationErrorValue(error),
    };
  }
}

export function interpolateTemplate(
  source: string,
  context: JsonObject,
  options: InterpolateOptions = {}
): string {
  return renderInterpolation(compileInterpolation(source), context, options);
}

function compileJsonNode(
  input: JsonValue,
  path: string,
  options: CompileInterpolationOptions,
  fields: CompiledJsonInterpolationField[]
): CompiledJsonNode {
  if (typeof input === 'string') {
    let compiled: CompiledInterpolation;
    try {
      compiled = compileInterpolation(input, options);
    } catch (error) {
      if (error instanceof InterpolationError) {
        throw new InterpolationError(error.code, `${path}: ${error.message}`, {
          path,
          ...(error.expression === undefined ? {} : { expression: error.expression }),
          ...(error.sourceStart === undefined ? {} : { sourceStart: error.sourceStart }),
          ...(error.sourceEnd === undefined ? {} : { sourceEnd: error.sourceEnd }),
          ...(error.celError === undefined ? {} : { celError: error.celError }),
        });
      }
      throw error;
    }
    if (compiled.expressionCount > 0) {
      fields.push({
        path,
        source: input,
        dependencies: compiled.dependencies,
        expressionCount: compiled.expressionCount,
      });
    }
    return { kind: 'string', compiled };
  }
  if (input === null || typeof input === 'number' || typeof input === 'boolean') {
    return { kind: 'primitive', value: input };
  }
  if (Array.isArray(input)) {
    return {
      kind: 'array',
      items: input.map((item, index) =>
        compileJsonNode(item, `${path}[${index}]`, options, fields)
      ),
    };
  }
  return {
    kind: 'object',
    entries: Object.entries(input)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => {
        if (FORBIDDEN_PATH_SEGMENTS.has(key)) {
          throw new InterpolationError(
            'FORBIDDEN_PROPERTY',
            `${path}.${key} is not a safe JSON property.`,
            { path: `${path}.${key}` }
          );
        }
        return [key, compileJsonNode(value, `${path}.${key}`, options, fields)] as const;
      }),
  };
}

export function compileJsonInterpolation(
  input: JsonValue,
  options: CompileInterpolationOptions = {}
): CompiledJsonInterpolation {
  const fields: CompiledJsonInterpolationField[] = [];
  const root = compileJsonNode(input, '$', options, fields);
  const expressionCount = fields.reduce((sum, field) => sum + field.expressionCount, 0);
  const limit =
    options.expressionLimit ?? options.maxExpressionCount ?? DEFAULT_CEL_CONFIG.maxExpressionCount;
  const countResult = validateCelExpressionCount('[block content]', expressionCount, {
    ...options,
    maxExpressionCount: limit,
  });
  if (!countResult.success) {
    throw new InterpolationError(
      'TOO_MANY_EXPRESSIONS',
      `Block content contains ${expressionCount} CEL expressions; the limit is ${limit}.`,
      { celError: countResult.error }
    );
  }
  return {
    source: input,
    fields,
    dependencies: [...new Set(fields.flatMap((field) => field.dependencies))].sort(),
    allowedVariables: [...new Set(options.allowedRoots ?? [])].sort(),
    root,
  };
}

function renderJsonNode(
  node: CompiledJsonNode,
  context: JsonObject,
  options: InterpolateOptions
): JsonValue {
  if (node.kind === 'string') {
    return renderInterpolation(node.compiled, context, options);
  }
  if (node.kind === 'primitive') {
    return node.value;
  }
  if (node.kind === 'array') {
    return node.items.map((item) => renderJsonNode(item, context, options));
  }
  return Object.fromEntries(
    node.entries.map(([key, value]) => [key, renderJsonNode(value, context, options)])
  );
}

export function renderJsonInterpolation(
  compiled: CompiledJsonInterpolation,
  context: JsonObject,
  options: InterpolateOptions = {}
): JsonValue {
  return renderJsonNode(compiled.root, context, options);
}

/** Recursively compiles and evaluates every eligible string leaf; non-string values stay typed. */
export function interpolateJson(
  input: JsonValue,
  context: JsonObject,
  options: InterpolateOptions = {}
): JsonValue {
  return renderJsonInterpolation(compileJsonInterpolation(input), context, options);
}
