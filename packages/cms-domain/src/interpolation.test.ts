import { describe, expect, test } from 'bun:test';
import {
  compileInterpolation,
  compileJsonInterpolation,
  InterpolationError,
  inspectInterpolation,
  inspectInterpolationSample,
  interpolateJson,
  interpolateTemplate,
  renderJsonInterpolation,
} from './interpolation';

const approvedRoots = ['store', 'route', 'slots', 'tags'];

describe('deterministic CEL interpolation', () => {
  test("preserves the legacy McDonald's dotted-path output exactly", () => {
    const context = {
      store: { name: "McDonald's", location: 'Oakland' },
      inventory: 0,
      open: false,
    };
    expect(
      interpolateTemplate(
        'Buy now {{ store.name }} — {{ store.location }}; stock={{ inventory }}; open={{open}}',
        context
      )
    ).toBe("Buy now McDonald's — Oakland; stock=0; open=false");
  });

  test('evaluates conditional and string expressions for two page contexts', () => {
    const source =
      '{{ store.isOpen ? "Open now: " + store.name : "Closed: " + store.name }} — {{ route.canonicalUrl }}';
    const compiled = compileInterpolation(source, { allowedRoots: approvedRoots });

    expect(
      interpolateTemplate(source, {
        store: { isOpen: true, name: 'Market' },
        route: { canonicalUrl: '/market' },
      })
    ).toBe('Open now: Market — /market');
    expect(
      interpolateTemplate(source, {
        store: { isOpen: false, name: 'Sutter' },
        route: { canonicalUrl: '/sutter' },
      })
    ).toBe('Closed: Sutter — /sutter');
    expect(compiled.dependencies).toEqual(['route.canonicalUrl', 'store.isOpen', 'store.name']);
  });

  test('extracts sorted unique dependencies and renders repeatably', () => {
    const compiled = compileInterpolation('{{ z }} / {{ a }} / {{ z }}');
    expect(compiled.dependencies).toEqual(['a', 'z']);
    const first = interpolateTemplate(compiled.source, { z: 'last', a: 'first' });
    const second = interpolateTemplate(compiled.source, { a: 'first', z: 'last' });
    expect(first).toBe(second);
  });

  test('returns a serializable compile-and-preview inspection for authoring controls', () => {
    const success = inspectInterpolationSample(
      '{{ store.isOpen ? "Open " + store.name : "Closed " + store.name }}',
      { store: { isOpen: true, name: 'Market' } },
      { allowedRoots: approvedRoots }
    );
    expect(success).toMatchObject({
      success: true,
      source: '{{ store.isOpen ? "Open " + store.name : "Closed " + store.name }}',
      dependencies: ['store.isOpen', 'store.name'],
      allowedVariables: ['route', 'slots', 'store', 'tags'],
      expressionCount: 1,
      evaluatedSample: 'Open Market',
    });
    if (success.success) expect(success.maxAstDepth).toBeGreaterThan(0);
    const failure = inspectInterpolationSample(
      '{{ store.missing }}',
      { store: {} },
      {
        allowedRoots: approvedRoots,
      }
    );
    expect(failure).toMatchObject({
      success: false,
      dependencies: ['store.missing'],
      error: { code: 'MISSING_VALUE', expression: 'store.missing' },
    });
    expect(() => JSON.stringify(failure)).not.toThrow();
  });

  test('supports explicit missing-value policies', () => {
    expect(() => interpolateTemplate('Hello {{ userProfile.name }}', {})).toThrow(
      InterpolationError
    );
    expect(interpolateTemplate('Hello {{ userProfile.name }}', {}, { onMissing: 'preserve' })).toBe(
      'Hello {{ userProfile.name }}'
    );
    expect(interpolateTemplate('Hello {{ userProfile.name }}', {}, { onMissing: 'empty' })).toBe(
      'Hello '
    );
  });

  test.each(['{{ }}', 'hello }}', 'hello {{ store.name', '{{ store.name + }}'])(
    'rejects malformed interpolation: %s',
    (source) => {
      expect(() => compileInterpolation(source)).toThrow(InterpolationError);
    }
  );

  test.each([
    '{{ store.constructor }}',
    '{{ store["__proto__"] }}',
    '{{ request.path }}',
    '{{ random() }}',
  ])('rejects forbidden CEL capabilities: %s', (source) => {
    const result = inspectInterpolation(source, {
      allowedRoots: [...approvedRoots, 'request'],
    });
    expect(result.success).toBe(false);
  });

  test('rejects unknown roots when the template allowlist is known', () => {
    const result = inspectInterpolation('{{ merchant.name }}', { allowedRoots: approvedRoots });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ROOT');
      expect(result.error.expression).toBe('merchant.name');
      expect(result.error.sourceStart).toBe(3);
    }
  });

  test('rejects object and list values instead of depending on stringification', () => {
    expect(() => interpolateTemplate('{{ store }}', { store: { name: 'A' } })).toThrow(
      'must evaluate to a scalar'
    );
    expect(() => interpolateTemplate('{{ tags.brand }}', { tags: { brand: ['food'] } })).toThrow(
      'must evaluate to a scalar'
    );
  });

  test('compiles JSON once, reports field dependencies, and emits objects in stable key order', () => {
    const compiled = compileJsonInterpolation(
      {
        z: ['{{ store.name }}', 2],
        a: { label: '{{ store.location }}' },
      },
      { allowedRoots: approvedRoots }
    );
    expect(compiled.fields.map((field) => field.path)).toEqual(['$.a.label', '$.z[0]']);
    expect(compiled.dependencies).toEqual(['store.location', 'store.name']);

    const result = renderJsonInterpolation(compiled, {
      store: { name: 'MCD', location: 'Oakland' },
    });
    expect(result).toEqual({ a: { label: 'Oakland' }, z: ['MCD', 2] });
    expect(Object.keys(result as Record<string, unknown>)).toEqual(['a', 'z']);
    expect(
      interpolateJson(
        { headline: '{{ store.name }}' },
        { store: { name: 'MCD', location: 'Oakland' } }
      )
    ).toEqual({ headline: 'MCD' });
  });

  test('caps source length, expression count, and AST depth', () => {
    expect(() => compileInterpolation('{{a}}{{b}}', 1)).toThrow('expression limit');
    expect(() => compileInterpolation('abcdef', { maxSourceLength: 5 })).toThrow('character limit');
    const deep = inspectInterpolation('{{ (((store.name))) }}', {
      allowedRoots: approvedRoots,
      maxAstDepth: 2,
    });
    expect(deep.success).toBe(false);
    if (!deep.success) expect(deep.error.code).toBe('AST_DEPTH_EXCEEDED');
    expect(() =>
      compileJsonInterpolation(
        { first: '{{ store.name }}', second: '{{ route.canonicalUrl }}' },
        { allowedRoots: approvedRoots, maxExpressionCount: 1 }
      )
    ).toThrow('Block content contains 2 CEL expressions');
  });

  test('does not confuse CEL map braces or delimiter text inside a string with the template close', () => {
    expect(() => interpolateTemplate('{{ {"label": "}}"} }}', {})).toThrow(
      'must evaluate to a scalar'
    );
  });
});
