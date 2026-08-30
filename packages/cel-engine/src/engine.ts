import type { ASTNode, ParseResult, SourceRange } from '@marcbachmann/cel-js';
import {
  TypeError as CelTypeError,
  Environment,
  EvaluationError,
  ParseError,
} from '@marcbachmann/cel-js';

import {
  type CelCompileResult,
  type CelContext,
  type CelEngineConfig,
  type CelError,
  type CelErrorCode,
  type CelErrorPhase,
  type CelEvaluationResult,
  type CelExpressionCountResult,
  type CelJsonPrimitive,
  type CelJsonValue,
  type CompileCelOptions,
  type CompiledCelExpression,
  DEFAULT_CEL_CONFIG,
  type EvaluateCelOptions,
  type InternalCompiledCelExpression,
  type ResolvedCelEngineConfig,
  type SerializedCelAst,
} from './types';

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FORBIDDEN_PROPERTIES = new Set(['__proto__', 'constructor', 'prototype']);
const FORBIDDEN_ROOTS = new Set([
  'db',
  'document',
  'documents',
  'fetch',
  'network',
  'now',
  'random',
  'request',
  'sql',
  'time',
  'user',
]);
const FORBIDDEN_FUNCTIONS = new Set([...FORBIDDEN_ROOTS, 'duration', 'timestamp']);
const SINGLE_BINDING_MACROS = new Set(['all', 'exists', 'exists_one', 'filter', 'map']);
const DOUBLE_BINDING_MACROS = new Set(['reduce']);

const compiledInternals = new WeakMap<CompiledCelExpression, InternalCompiledCelExpression>();

class CelNormalizationFailure extends Error {
  readonly code: CelErrorCode;
  readonly path: string;

  constructor(code: CelErrorCode, message: string, path: string) {
    super(message);
    this.name = 'CelNormalizationFailure';
    this.code = code;
    this.path = path;
  }
}

function resolveConfig(config: CelEngineConfig = {}): ResolvedCelEngineConfig {
  return {
    maxSourceLength: config.maxSourceLength ?? DEFAULT_CEL_CONFIG.maxSourceLength,
    maxExpressionCount: config.maxExpressionCount ?? DEFAULT_CEL_CONFIG.maxExpressionCount,
    maxAstDepth: config.maxAstDepth ?? DEFAULT_CEL_CONFIG.maxAstDepth,
    maxAstNodes: config.maxAstNodes ?? DEFAULT_CEL_CONFIG.maxAstNodes,
  };
}

function sourceLocation(
  source: string,
  offset: number
): { readonly line: number; readonly column: number } {
  const bounded = Math.max(0, Math.min(offset, source.length));
  const before = source.slice(0, bounded);
  const lines = before.split('\n');
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function createError(
  phase: CelErrorPhase,
  code: CelErrorCode,
  source: string,
  message: string,
  range?: SourceRange,
  dependency?: string
): CelError {
  if (!range) {
    return dependency === undefined
      ? { phase, code, source, message }
      : { phase, code, source, message, dependency };
  }
  const startLocation = sourceLocation(source, range.start);
  const endLocation = sourceLocation(source, range.end);
  const base = {
    phase,
    code,
    source,
    message,
    start: range.start,
    end: range.end,
    line: startLocation.line,
    column: startLocation.column,
    endLine: endLocation.line,
    endColumn: endLocation.column,
  };
  return dependency === undefined ? base : { ...base, dependency };
}

function childNodes(value: unknown): readonly ASTNode[] {
  if (isAstNode(value)) {
    return [value];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((entry) => childNodes(entry));
}

function isAstNode(value: unknown): value is ASTNode {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    readonly op?: unknown;
    readonly start?: unknown;
    readonly end?: unknown;
  };
  return (
    typeof candidate.op === 'string' &&
    typeof candidate.start === 'number' &&
    typeof candidate.end === 'number'
  );
}

function astMeasurements(node: ASTNode): { readonly depth: number; readonly count: number } {
  const children = childNodes(node.args);
  let depth = 1;
  let count = 1;
  for (const child of children) {
    const measured = astMeasurements(child);
    depth = Math.max(depth, measured.depth + 1);
    count += measured.count;
  }
  return { depth, count };
}

function serializeAstValue(value: unknown): SerializedCelAst {
  if (isAstNode(value)) {
    return {
      op: value.op,
      start: value.start,
      end: value.end,
      args: serializeAstValue(value.args),
    };
  }
  if (typeof value === 'bigint') {
    return value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
      ? Number(value)
      : value.toString();
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value === null) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeAstValue(entry));
  }
  return null;
}

function staticDependency(node: ASTNode, bound: ReadonlySet<string>): string | null {
  if (node.op === 'id') {
    return bound.has(node.args) ? null : node.args;
  }
  if (node.op === '.' || node.op === '.?') {
    const [receiver, property] = node.args;
    const base = staticDependency(receiver, bound);
    return base ? `${base}.${property}` : null;
  }
  if (node.op === '[]' || node.op === '[?]') {
    const [receiver, key] = node.args;
    const base = staticDependency(receiver, bound);
    if (!base || key.op !== 'value') {
      return null;
    }
    if (typeof key.args === 'string' && IDENTIFIER.test(key.args)) {
      return `${base}.${key.args}`;
    }
    if (typeof key.args === 'bigint' || typeof key.args === 'number') {
      return `${base}[${String(key.args)}]`;
    }
  }
  return null;
}

interface DependencyScan {
  readonly dependencies: Set<string>;
  readonly rootNodes: Map<string, ASTNode>;
  readonly forbiddenError?: CelError;
}

function scanDependencies(source: string, ast: ASTNode): DependencyScan {
  const dependencies = new Set<string>();
  const rootNodes = new Map<string, ASTNode>();
  let forbiddenError: CelError | undefined;

  const walk = (node: ASTNode, bound: ReadonlySet<string>, consumedByStaticPath: boolean): void => {
    if (forbiddenError) {
      return;
    }
    if (node.op === '.' || node.op === '.?') {
      const [, property] = node.args;
      if (FORBIDDEN_PROPERTIES.has(property)) {
        forbiddenError = createError(
          'compile',
          'FORBIDDEN_PROPERTY',
          source,
          `Property ${JSON.stringify(property)} is not available to CEL expressions.`,
          node.range,
          property
        );
        return;
      }
    }
    if (node.op === '[]' || node.op === '[?]') {
      const [, key] = node.args;
      if (
        key.op === 'value' &&
        typeof key.args === 'string' &&
        FORBIDDEN_PROPERTIES.has(key.args)
      ) {
        forbiddenError = createError(
          'compile',
          'FORBIDDEN_PROPERTY',
          source,
          `Property ${JSON.stringify(key.args)} is not available to CEL expressions.`,
          key.range,
          key.args
        );
        return;
      }
    }
    if (node.op === 'call' && FORBIDDEN_FUNCTIONS.has(node.args[0])) {
      forbiddenError = createError(
        'compile',
        'FORBIDDEN_FUNCTION',
        source,
        `Function ${JSON.stringify(node.args[0])} is not available to CEL expressions.`,
        node.range,
        node.args[0]
      );
      return;
    }
    if (node.op === 'rcall' && FORBIDDEN_PROPERTIES.has(node.args[0])) {
      forbiddenError = createError(
        'compile',
        'FORBIDDEN_PROPERTY',
        source,
        `Method ${JSON.stringify(node.args[0])} is not available to CEL expressions.`,
        node.range,
        node.args[0]
      );
      return;
    }

    const dependency = staticDependency(node, bound);
    if (dependency && !consumedByStaticPath) {
      dependencies.add(dependency);
    }
    if (node.op === 'id' && !bound.has(node.args)) {
      rootNodes.set(node.args, rootNodes.get(node.args) ?? node);
    }

    if (node.op === 'rcall') {
      const [name, receiver, argumentsList] = node.args;
      walk(receiver, bound, false);
      const bindingCount = SINGLE_BINDING_MACROS.has(name)
        ? 1
        : DOUBLE_BINDING_MACROS.has(name)
          ? 2
          : 0;
      if (bindingCount > 0) {
        const scoped = new Set(bound);
        for (const binding of argumentsList.slice(0, bindingCount)) {
          if (binding.op === 'id') {
            scoped.add(binding.args);
          }
        }
        for (const argument of argumentsList.slice(bindingCount)) {
          walk(argument, scoped, false);
        }
        return;
      }
    }

    const staticReceiver =
      node.op === '.' || node.op === '.?' || node.op === '[]' || node.op === '[?]';
    for (const child of childNodes(node.args)) {
      const consumes =
        staticReceiver && child === node.args[0] && staticDependency(node, bound) !== null;
      walk(child, bound, consumes);
    }
  };

  walk(ast, new Set<string>(), false);
  return forbiddenError === undefined
    ? { dependencies, rootNodes }
    : { dependencies, rootNodes, forbiddenError };
}

function mapNativeError(
  phase: CelErrorPhase,
  source: string,
  error: ParseError | EvaluationError | CelTypeError
): CelError {
  const nativeCode = error.code;
  if (error instanceof ParseError) {
    if (nativeCode === 'limit_exceeded' && /maxDepth/i.test(error.summary)) {
      return createError(phase, 'AST_DEPTH_EXCEEDED', source, error.summary, error.range);
    }
    if (nativeCode === 'limit_exceeded' && /maxAstNodes/i.test(error.summary)) {
      return createError(phase, 'AST_NODE_LIMIT_EXCEEDED', source, error.summary, error.range);
    }
    return createError(phase, 'SYNTAX_ERROR', source, error.summary, error.range);
  }
  if (error instanceof CelTypeError) {
    const code = nativeCode === 'unknown_variable' ? 'UNKNOWN_ROOT' : 'TYPE_ERROR';
    return createError(phase, code, source, error.summary, error.range);
  }
  if (nativeCode === 'unknown_variable') {
    return createError(phase, 'UNKNOWN_ROOT', source, error.summary, error.range);
  }
  if (nativeCode === 'no_such_key' || nativeCode === 'index_out_of_bounds') {
    return createError(phase, 'MISSING_VALUE', source, error.summary, error.range);
  }
  if (nativeCode === 'no_matching_overload' || nativeCode === 'no_such_overload') {
    return createError(phase, 'TYPE_ERROR', source, error.summary, error.range);
  }
  return createError(phase, 'EVALUATION_ERROR', source, error.summary, error.range);
}

function parserEnvironment(config: ResolvedCelEngineConfig): Environment {
  return new Environment({
    unlistedVariablesAreDyn: false,
    homogeneousAggregateLiterals: true,
    enableOptionalTypes: false,
    limits: {
      maxAstNodes: config.maxAstNodes,
      maxDepth: config.maxAstDepth,
      maxListElements: Math.min(config.maxAstNodes, 1_000),
      maxMapEntries: Math.min(config.maxAstNodes, 1_000),
      maxCallArguments: 32,
    },
  });
}

function sortedValidRoots(roots: readonly string[]): readonly string[] {
  return [...new Set(roots.filter((root) => IDENTIFIER.test(root)))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function normalizeInput(value: CelJsonValue, path: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CelNormalizationFailure('NON_FINITE_NUMBER', `${path} must be finite.`, path);
    }
    if (Number.isInteger(value)) {
      if (!Number.isSafeInteger(value)) {
        throw new CelNormalizationFailure(
          'UNSAFE_INTEGER',
          `${path} must be a safe JSON integer.`,
          path
        );
      }
      return BigInt(Object.is(value, -0) ? 0 : value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => normalizeInput(entry, `${path}[${index}]`));
  }
  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (FORBIDDEN_PROPERTIES.has(key)) {
      throw new CelNormalizationFailure(
        'FORBIDDEN_PROPERTY',
        `${path}.${key} is not available to CEL expressions.`,
        `${path}.${key}`
      );
    }
    normalized[key] = normalizeInput(entry, `${path}.${key}`);
  }
  return normalized;
}

function normalizeOutput(value: unknown, path: string, seen: WeakSet<object>): CelJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    if (value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER) {
      throw new CelNormalizationFailure(
        'UNSAFE_INTEGER',
        `${path} produced an integer outside JSON's safe range.`,
        path
      );
    }
    return Number(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new CelNormalizationFailure(
        'NON_FINITE_NUMBER',
        `${path} produced a non-finite number.`,
        path
      );
    }
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new CelNormalizationFailure(
        'UNSAFE_INTEGER',
        `${path} produced an unsafe JSON integer.`,
        path
      );
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') {
    throw new CelNormalizationFailure(
      'NON_JSON_VALUE',
      `${path} produced a value that cannot cross the JSON boundary.`,
      path
    );
  }
  if (seen.has(value)) {
    throw new CelNormalizationFailure('NON_JSON_VALUE', `${path} produced a cycle.`, path);
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) => normalizeOutput(entry, `${path}[${index}]`, seen));
    }
    if (value instanceof Map) {
      const entries: [string, CelJsonValue][] = [];
      for (const [key, entry] of value.entries()) {
        if (typeof key !== 'string' || FORBIDDEN_PROPERTIES.has(key)) {
          throw new CelNormalizationFailure(
            'NON_JSON_VALUE',
            `${path} produced a map with a non-JSON key.`,
            path
          );
        }
        entries.push([key, normalizeOutput(entry, `${path}.${key}`, seen)]);
      }
      return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new CelNormalizationFailure(
        'NON_JSON_VALUE',
        `${path} produced an unsupported object type.`,
        path
      );
    }
    const entries: [string, CelJsonValue][] = [];
    for (const [key, entry] of Object.entries(value).sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      if (FORBIDDEN_PROPERTIES.has(key)) {
        throw new CelNormalizationFailure(
          'FORBIDDEN_PROPERTY',
          `${path}.${key} is not a JSON-safe property.`,
          `${path}.${key}`
        );
      }
      entries.push([key, normalizeOutput(entry, `${path}.${key}`, seen)]);
    }
    return Object.fromEntries(entries);
  } finally {
    seen.delete(value);
  }
}

export function validateCelExpressionCount(
  source: string,
  expressionCount: number,
  config: CelEngineConfig = {}
): CelExpressionCountResult {
  const limit = resolveConfig(config).maxExpressionCount;
  if (!Number.isSafeInteger(expressionCount) || expressionCount < 0 || expressionCount > limit) {
    return {
      success: false,
      error: createError(
        'compile',
        'EXPRESSION_LIMIT_EXCEEDED',
        source,
        `Template contains ${expressionCount} expressions; the limit is ${limit}.`
      ),
    };
  }
  return { success: true };
}

export function compileCelExpression(
  source: string,
  options: CompileCelOptions = {}
): CelCompileResult {
  const config = resolveConfig(options);
  if (source.trim().length === 0) {
    return {
      success: false,
      error: createError('compile', 'EMPTY_EXPRESSION', source, 'CEL expressions cannot be empty.'),
    };
  }
  if (source.length > config.maxSourceLength) {
    return {
      success: false,
      error: createError(
        'compile',
        'SOURCE_TOO_LONG',
        source,
        `CEL source exceeds the ${config.maxSourceLength} character limit.`
      ),
    };
  }

  let parsed: ParseResult;
  try {
    parsed = parserEnvironment(config).parse(source);
  } catch (error) {
    if (error instanceof ParseError) {
      return { success: false, error: mapNativeError('compile', source, error) };
    }
    return {
      success: false,
      error: createError(
        'compile',
        'SYNTAX_ERROR',
        source,
        error instanceof Error ? error.message : 'CEL parsing failed.'
      ),
    };
  }

  const measured = astMeasurements(parsed.ast);
  if (measured.depth > config.maxAstDepth) {
    return {
      success: false,
      error: createError(
        'compile',
        'AST_DEPTH_EXCEEDED',
        source,
        `CEL AST depth ${measured.depth} exceeds the ${config.maxAstDepth} limit.`,
        parsed.ast.range
      ),
    };
  }
  if (measured.count > config.maxAstNodes) {
    return {
      success: false,
      error: createError(
        'compile',
        'AST_NODE_LIMIT_EXCEEDED',
        source,
        `CEL AST node count ${measured.count} exceeds the ${config.maxAstNodes} limit.`,
        parsed.ast.range
      ),
    };
  }

  const scan = scanDependencies(source, parsed.ast);
  if (scan.forbiddenError) {
    return { success: false, error: scan.forbiddenError };
  }
  const roots = [...scan.rootNodes.keys()].sort((left, right) => left.localeCompare(right));
  for (const root of roots) {
    const node = scan.rootNodes.get(root);
    if (FORBIDDEN_ROOTS.has(root)) {
      return {
        success: false,
        error: createError(
          'compile',
          'FORBIDDEN_ROOT',
          source,
          `Root variable ${JSON.stringify(root)} is not available to CEL expressions.`,
          node?.range,
          root
        ),
      };
    }
  }

  const providedAllowedRoots = options.allowedRoots
    ? sortedValidRoots(options.allowedRoots)
    : undefined;
  if (providedAllowedRoots) {
    const allowed = new Set(providedAllowedRoots);
    for (const root of roots) {
      if (!allowed.has(root)) {
        return {
          success: false,
          error: createError(
            'compile',
            'UNKNOWN_ROOT',
            source,
            `Unknown CEL root variable ${JSON.stringify(root)}.`,
            scan.rootNodes.get(root)?.range,
            root
          ),
        };
      }
    }
  }

  const evaluationEnvironment = parserEnvironment(config);
  for (const root of roots) {
    evaluationEnvironment.registerVariable(root, 'dyn');
  }
  let reusable: ParseResult;
  try {
    reusable = evaluationEnvironment.parse(source);
    const checked = reusable.check();
    if (!checked.valid) {
      const error = checked.error;
      if (error instanceof ParseError || error instanceof CelTypeError) {
        return { success: false, error: mapNativeError('compile', source, error) };
      }
      return {
        success: false,
        error: createError('compile', 'TYPE_ERROR', source, 'CEL type checking failed.'),
      };
    }
  } catch (error) {
    if (error instanceof ParseError || error instanceof CelTypeError) {
      return { success: false, error: mapNativeError('compile', source, error) };
    }
    return {
      success: false,
      error: createError(
        'compile',
        'TYPE_ERROR',
        source,
        error instanceof Error ? error.message : 'CEL type checking failed.'
      ),
    };
  }

  const compiled: CompiledCelExpression = Object.freeze({
    source,
    dependencies: [...scan.dependencies].sort((left, right) => left.localeCompare(right)),
    roots,
    allowedVariables: providedAllowedRoots ?? roots,
    astDepth: measured.depth,
    astNodeCount: measured.count,
    ast: serializeAstValue(parsed.ast),
  });
  compiledInternals.set(compiled, { parsed: reusable, ast: reusable.ast });
  return { success: true, compiled };
}

export function evaluateCelExpression(
  compiled: CompiledCelExpression,
  context: CelContext,
  options: EvaluateCelOptions = {}
): CelEvaluationResult {
  const internal = compiledInternals.get(compiled);
  if (!internal) {
    return {
      success: false,
      error: createError(
        'evaluate',
        'EVALUATION_ERROR',
        compiled.source,
        'Compiled CEL metadata did not originate from this engine instance.'
      ),
    };
  }
  for (const root of compiled.roots) {
    if (!Object.hasOwn(context, root)) {
      return {
        success: false,
        error: createError(
          'evaluate',
          'UNKNOWN_ROOT',
          compiled.source,
          `CEL root variable ${JSON.stringify(root)} is missing from the page context.`,
          undefined,
          root
        ),
      };
    }
  }

  let normalizedContext: Record<string, unknown>;
  try {
    normalizedContext = Object.fromEntries(
      compiled.roots.map((root) => [root, normalizeInput(context[root] ?? null, `$.${root}`)])
    );
  } catch (error) {
    if (error instanceof CelNormalizationFailure) {
      return {
        success: false,
        error: createError(
          'normalize',
          error.code,
          compiled.source,
          error.message,
          undefined,
          error.path
        ),
      };
    }
    return {
      success: false,
      error: createError(
        'normalize',
        'NON_JSON_VALUE',
        compiled.source,
        'CEL context normalization failed.'
      ),
    };
  }

  let raw: unknown;
  try {
    raw = internal.parsed(normalizedContext);
  } catch (error) {
    if (
      error instanceof ParseError ||
      error instanceof EvaluationError ||
      error instanceof CelTypeError
    ) {
      return { success: false, error: mapNativeError('evaluate', compiled.source, error) };
    }
    return {
      success: false,
      error: createError(
        'evaluate',
        'EVALUATION_ERROR',
        compiled.source,
        error instanceof Error ? error.message : 'CEL evaluation failed.'
      ),
    };
  }
  if (raw instanceof Promise) {
    return {
      success: false,
      error: createError(
        'evaluate',
        'ASYNC_RESULT_FORBIDDEN',
        compiled.source,
        'CEL evaluation must remain synchronous.'
      ),
    };
  }

  try {
    const value = normalizeOutput(raw, '$', new WeakSet<object>());
    if (options.expected === 'scalar' && value !== null && typeof value === 'object') {
      return {
        success: false,
        error: createError(
          'normalize',
          'NON_SCALAR_VALUE',
          compiled.source,
          'Interpolated CEL segments must evaluate to a scalar.'
        ),
      };
    }
    return { success: true, value };
  } catch (error) {
    if (error instanceof CelNormalizationFailure) {
      return {
        success: false,
        error: createError(
          'normalize',
          error.code,
          compiled.source,
          error.message,
          undefined,
          error.path
        ),
      };
    }
    return {
      success: false,
      error: createError(
        'normalize',
        'NON_JSON_VALUE',
        compiled.source,
        'CEL result normalization failed.'
      ),
    };
  }
}

export function evaluateCelSource(
  source: string,
  context: CelContext,
  options: CompileCelOptions & EvaluateCelOptions = {}
): CelEvaluationResult {
  const compiled = compileCelExpression(source, {
    ...options,
    allowedRoots: options.allowedRoots ?? Object.keys(context),
  });
  return compiled.success ? evaluateCelExpression(compiled.compiled, context, options) : compiled;
}

export class CelEngine {
  readonly config: ResolvedCelEngineConfig;
  readonly allowedRoots?: readonly string[];

  constructor(config: CompileCelOptions = {}) {
    this.config = resolveConfig(config);
    if (config.allowedRoots !== undefined) {
      this.allowedRoots = sortedValidRoots(config.allowedRoots);
    }
  }

  compile(source: string): CelCompileResult {
    return compileCelExpression(source, {
      ...this.config,
      ...(this.allowedRoots === undefined ? {} : { allowedRoots: this.allowedRoots }),
    });
  }

  evaluate(
    compiled: CompiledCelExpression,
    context: CelContext,
    options: EvaluateCelOptions = {}
  ): CelEvaluationResult {
    return evaluateCelExpression(compiled, context, options);
  }
}

export function formatCelScalar(value: CelJsonPrimitive): string {
  if (value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return JSON.stringify(Object.is(value, -0) ? 0 : value);
}
