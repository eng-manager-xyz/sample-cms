import { describe, expect, test } from 'bun:test';
import { parseUrlGrammar } from './template-grammar';

describe('URL template grammar', () => {
  test('preserves the ordered domain, variable slots, and static path segments', () => {
    expect(parseUrlGrammar('www.uber.com', '/{locale}/eligible-vehicles/{state}/{slug}')).toEqual([
      { order: 0, key: 'domain', label: 'www.uber.com', kind: 'domain' },
      { order: 1, key: 'locale', label: 'locale', kind: 'variable' },
      {
        order: 2,
        key: 'static-2',
        label: 'eligible-vehicles',
        kind: 'static',
      },
      { order: 3, key: 'state', label: 'state', kind: 'variable' },
      { order: 4, key: 'slug', label: 'slug', kind: 'variable' },
    ]);
  });

  test('does not confuse document placement keys with URL slots', () => {
    const parts = parseUrlGrammar('www.ubereats.com', '/{locale}/store/{store_id}');
    expect(parts.map((part) => part.key)).toEqual(['domain', 'locale', 'static-2', 'store_id']);
    expect(parts.some((part) => part.key === 'primary-hero')).toBe(false);
  });
});
