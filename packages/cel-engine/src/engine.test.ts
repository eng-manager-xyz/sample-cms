import { describe, expect, test } from 'bun:test';

import {
  CelEngine,
  compileCelExpression,
  evaluateCelExpression,
  evaluateCelSource,
  validateCelExpressionCount,
} from './index';
import type { CelErrorCode } from './types';

const allowedRoots = ['page', 'context', 'slots', 'tags', 'route', 'store'];

describe('deterministic Auteur CEL engine', () => {
  test('compiles conditional string expressions with precise dependency metadata', () => {
    const result = compileCelExpression(
      'store.kind == "restaurant" ? store.name + " in " + store.location : route.canonicalUrl',
      { allowedRoots }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.compiled.dependencies).toEqual([
      'route.canonicalUrl',
      'store.kind',
      'store.location',
      'store.name',
    ]);
    expect(result.compiled.roots).toEqual(['route', 'store']);
    expect(result.compiled.astDepth).toBeGreaterThan(1);
    expect(JSON.stringify(result.compiled.ast)).toContain('store');
  });

  test('evaluates synchronously and normalizes CEL integers to deterministic JSON', () => {
    const engine = new CelEngine({ allowedRoots });
    const compiled = engine.compile('slots.count + 1');
    expect(compiled.success).toBe(true);
    if (!compiled.success) return;

    expect(engine.evaluate(compiled.compiled, { slots: { count: 2 } })).toEqual({
      success: true,
      value: 3,
    });
    expect(
      engine.evaluate(compiled.compiled, { slots: { count: 2 } }, { expected: 'scalar' })
    ).toEqual({ success: true, value: 3 });
  });

  test('evaluates the same expression differently for two approved page contexts', () => {
    const source = 'store.isOpen ? "Open: " + store.name : "Closed: " + store.name';
    expect(
      evaluateCelSource(source, { store: { isOpen: true, name: 'Market' } }, { expected: 'scalar' })
    ).toEqual({ success: true, value: 'Open: Market' });
    expect(
      evaluateCelSource(
        source,
        { store: { isOpen: false, name: 'Sutter' } },
        { expected: 'scalar' }
      )
    ).toEqual({ success: true, value: 'Closed: Sutter' });
  });

  const forbiddenCases = [
    ['documents.get("stores", "1")', 'FORBIDDEN_ROOT'],
    ['request.path', 'FORBIDDEN_ROOT'],
    ['random()', 'FORBIDDEN_FUNCTION'],
    ['user()', 'FORBIDDEN_FUNCTION'],
    ['timestamp("2026-08-29T00:00:00Z")', 'FORBIDDEN_FUNCTION'],
    ['duration("1h")', 'FORBIDDEN_FUNCTION'],
    ['store.constructor', 'FORBIDDEN_PROPERTY'],
    ['store["__proto__"]', 'FORBIDDEN_PROPERTY'],
  ] satisfies readonly (readonly [string, CelErrorCode])[];

  test.each(forbiddenCases)('rejects forbidden source %s with %s', (source, code) => {
    const result = compileCelExpression(source, { allowedRoots: [...allowedRoots, 'documents'] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(code);
  });

  test('rejects unknown roots at compile time and missing values at evaluation time', () => {
    const unknown = compileCelExpression('merchant.name', { allowedRoots });
    expect(unknown.success).toBe(false);
    if (!unknown.success) expect(unknown.error.code).toBe('UNKNOWN_ROOT');

    const result = compileCelExpression('store.name', { allowedRoots });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const missing = evaluateCelExpression(result.compiled, { store: {} });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.code).toBe('MISSING_VALUE');
  });

  test('rejects non-scalar segment results and unsupported JSON results', () => {
    const objectResult = compileCelExpression('store', { allowedRoots });
    expect(objectResult.success).toBe(true);
    if (!objectResult.success) return;
    const evaluated = evaluateCelExpression(
      objectResult.compiled,
      { store: { name: 'Market' } },
      { expected: 'scalar' }
    );
    expect(evaluated.success).toBe(false);
    if (!evaluated.success) expect(evaluated.error.code).toBe('NON_SCALAR_VALUE');

    const unsafe = evaluateCelSource('9223372036854775807', {});
    expect(unsafe.success).toBe(false);
    if (!unsafe.success) expect(unsafe.error.code).toBe('UNSAFE_INTEGER');
  });

  test('returns bounded structured compile errors with source locations', () => {
    const malformed = compileCelExpression('store.name +', { allowedRoots });
    expect(malformed.success).toBe(false);
    if (!malformed.success) {
      expect(malformed.error.code).toBe('SYNTAX_ERROR');
      expect(malformed.error.line).toBe(1);
      expect(malformed.error.column).toBeGreaterThan(0);
    }

    const long = compileCelExpression('store.name', { allowedRoots, maxSourceLength: 5 });
    expect(long.success).toBe(false);
    if (!long.success) expect(long.error.code).toBe('SOURCE_TOO_LONG');

    const deep = compileCelExpression('((((store.name))))', {
      allowedRoots,
      maxAstDepth: 2,
    });
    expect(deep.success).toBe(false);
    if (!deep.success) expect(deep.error.code).toBe('AST_DEPTH_EXCEEDED');

    const count = validateCelExpressionCount('{{a}}{{b}}', 2, { maxExpressionCount: 1 });
    expect(count.success).toBe(false);
    if (!count.success) expect(count.error.code).toBe('EXPRESSION_LIMIT_EXCEEDED');
  });

  test('supports deterministic CEL list macros without treating the binding as a root', () => {
    const result = compileCelExpression('tags.brand.exists(value, value == "fast_food")', {
      allowedRoots,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.compiled.dependencies).toEqual(['tags.brand']);
    expect(result.compiled.roots).toEqual(['tags']);
    expect(
      evaluateCelExpression(result.compiled, { tags: { brand: ['restaurant', 'fast_food'] } })
    ).toEqual({ success: true, value: true });
  });
});
