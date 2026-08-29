import { describe, expect, test } from 'bun:test';
import {
  compileInterpolation,
  InterpolationError,
  interpolateJson,
  interpolateTemplate,
} from './interpolation';

describe('deterministic interpolation', () => {
  test("renders McDonald's page data without evaluating code", () => {
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

  test('extracts sorted unique dependencies and renders repeatably', () => {
    const compiled = compileInterpolation('{{ z }} / {{ a }} / {{ z }}');
    expect(compiled.dependencies).toEqual(['a', 'z']);
    const first = interpolateTemplate(compiled.source, { z: 'last', a: 'first' });
    const second = interpolateTemplate(compiled.source, { a: 'first', z: 'last' });
    expect(first).toBe(second);
  });

  test('supports explicit missing-value policies', () => {
    expect(() => interpolateTemplate('Hello {{ user.name }}', {})).toThrow(InterpolationError);
    expect(interpolateTemplate('Hello {{ user.name }}', {}, { onMissing: 'preserve' })).toBe(
      'Hello {{ user.name }}'
    );
    expect(interpolateTemplate('Hello {{ user.name }}', {}, { onMissing: 'empty' })).toBe('Hello ');
  });

  test.each([
    '{{ }}',
    '{{ store["name"] }}',
    '{{ store.name.toUpperCase() }}',
    '{{ constructor.constructor }}()',
    'hello }}',
    'hello {{ store.name',
  ])('rejects malformed or executable-looking interpolation: %s', (source) => {
    expect(() => compileInterpolation(source)).toThrow(InterpolationError);
  });

  test('rejects object values instead of depending on object stringification', () => {
    expect(() => interpolateTemplate('{{ store }}', { store: { name: 'A' } })).toThrow(
      'must be a scalar'
    );
  });

  test('recursively interpolates JSON and emits objects in stable key order', () => {
    const result = interpolateJson(
      {
        z: ['{{ store.name }}', 2],
        a: { label: '{{ store.location }}' },
      },
      { store: { name: 'MCD', location: 'Oakland' } }
    );
    expect(result).toEqual({ a: { label: 'Oakland' }, z: ['MCD', 2] });
    expect(Object.keys(result as Record<string, unknown>)).toEqual(['a', 'z']);
  });

  test('caps expression count', () => {
    expect(() => compileInterpolation('{{a}}{{b}}', 1)).toThrow('expression limit');
  });
});
