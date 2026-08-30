import type { ASTNode, ParseResult } from '@marcbachmann/cel-js';

export type CelJsonPrimitive = string | number | boolean | null;
export type CelJsonValue =
  | CelJsonPrimitive
  | readonly CelJsonValue[]
  | { readonly [key: string]: CelJsonValue };
export type CelContext = Readonly<Record<string, CelJsonValue>>;

export type CelErrorPhase = 'compile' | 'evaluate' | 'normalize';

export type CelErrorCode =
  | 'EMPTY_EXPRESSION'
  | 'SOURCE_TOO_LONG'
  | 'EXPRESSION_LIMIT_EXCEEDED'
  | 'AST_DEPTH_EXCEEDED'
  | 'AST_NODE_LIMIT_EXCEEDED'
  | 'SYNTAX_ERROR'
  | 'TYPE_ERROR'
  | 'UNKNOWN_ROOT'
  | 'FORBIDDEN_ROOT'
  | 'FORBIDDEN_PROPERTY'
  | 'FORBIDDEN_FUNCTION'
  | 'MISSING_VALUE'
  | 'EVALUATION_ERROR'
  | 'ASYNC_RESULT_FORBIDDEN'
  | 'NON_JSON_VALUE'
  | 'NON_SCALAR_VALUE'
  | 'NON_FINITE_NUMBER'
  | 'UNSAFE_INTEGER';

export interface CelError {
  readonly phase: CelErrorPhase;
  readonly code: CelErrorCode;
  readonly message: string;
  readonly source: string;
  readonly start?: number;
  readonly end?: number;
  readonly line?: number;
  readonly column?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
  readonly dependency?: string;
}

export interface CelEngineConfig {
  readonly maxSourceLength?: number;
  readonly maxExpressionCount?: number;
  readonly maxAstDepth?: number;
  readonly maxAstNodes?: number;
}

export interface ResolvedCelEngineConfig {
  readonly maxSourceLength: number;
  readonly maxExpressionCount: number;
  readonly maxAstDepth: number;
  readonly maxAstNodes: number;
}

export const DEFAULT_CEL_CONFIG: ResolvedCelEngineConfig = Object.freeze({
  maxSourceLength: 5_000,
  maxExpressionCount: 64,
  maxAstDepth: 50,
  maxAstNodes: 1_000,
});

export type SerializedCelAst =
  | string
  | number
  | boolean
  | null
  | readonly SerializedCelAst[]
  | { readonly [key: string]: SerializedCelAst };

export interface CompiledCelExpression {
  readonly source: string;
  readonly dependencies: readonly string[];
  readonly roots: readonly string[];
  readonly allowedVariables: readonly string[];
  readonly astDepth: number;
  readonly astNodeCount: number;
  readonly ast: SerializedCelAst;
}

export type CelCompileResult =
  | { readonly success: true; readonly compiled: CompiledCelExpression }
  | { readonly success: false; readonly error: CelError };

export interface CompileCelOptions extends CelEngineConfig {
  readonly allowedRoots?: readonly string[];
}

export interface EvaluateCelOptions {
  readonly expected?: 'json' | 'scalar';
}

export type CelEvaluationResult<T extends CelJsonValue = CelJsonValue> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: CelError };

export type CelExpressionCountResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: CelError };

/** Internal compiled callable; kept outside the public result's serializable metadata. */
export interface InternalCompiledCelExpression {
  readonly parsed: ParseResult;
  readonly ast: ASTNode;
}
