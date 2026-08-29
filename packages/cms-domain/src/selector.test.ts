import { describe, expect, test } from 'bun:test';
import {
  compileSelector,
  evaluateSelector,
  formatSelector,
  normalizeSelector,
  parseSelector,
  SelectorError,
  tokenizeSelector,
  validateSelector,
} from './selector';

const fields = [
  { name: 'brand', sqlColumn: 'page.brand' },
  { name: 'locale', sqlColumn: 'page.locale' },
  { name: 'state', sqlColumn: 'page.state' },
  'is_live',
  'store_id',
  'tags',
] as const;

describe('selector tokenizer and parser', () => {
  test("parses McDonald's SQL escaping without treating the apostrophe as syntax", () => {
    const expression = parseSelector("brand = 'mcdonald''s'");
    expect(expression).toEqual({ kind: 'comparison', field: 'brand', value: "mcdonald's" });
    expect(tokenizeSelector("brand = 'mcdonald''s'").map((item) => item.kind)).toEqual([
      'identifier',
      'equals',
      'string',
      'eof',
    ]);
  });

  test('gives AND higher precedence than OR and preserves explicit grouping', () => {
    expect(parseSelector("brand = 'a' OR locale = 'en-US' AND state = 'CA'")).toEqual({
      kind: 'or',
      operands: [
        { kind: 'comparison', field: 'brand', value: 'a' },
        {
          kind: 'and',
          operands: [
            { kind: 'comparison', field: 'locale', value: 'en-US' },
            { kind: 'comparison', field: 'state', value: 'CA' },
          ],
        },
      ],
    });
    expect(
      formatSelector(parseSelector("(brand = 'a' OR locale = 'en-US') AND state = 'CA'"))
    ).toBe("state = 'CA' AND (brand = 'a' OR locale = 'en-US')");
  });

  test('supports strings, finite numbers, booleans, IN, and case-insensitive keywords', () => {
    expect(
      formatSelector(
        parseSelector("store_id In (42, -7, 3.5) aNd is_live = TrUe OR locale = 'en-US'")
      )
    ).toBe("is_live = TRUE AND store_id IN (-7, 3.5, 42) OR locale = 'en-US'");
  });

  test('normalization is stable across commutative ordering and removes duplicates', () => {
    const left = normalizeSelector(
      parseSelector("locale IN ('en-US', 'en-GB', 'en-US') AND brand = 'mcdonalds'")
    );
    const right = normalizeSelector(
      parseSelector("brand = 'mcdonalds' AND locale IN ('en-GB', 'en-US')")
    );
    expect(left).toEqual(right);
    expect(formatSelector(left)).toBe("brand = 'mcdonalds' AND locale IN ('en-GB', 'en-US')");
  });
});

describe('selector safety and compilation', () => {
  test('quotes only approved identifiers and parameterizes every authored value', () => {
    const compiled = compileSelector("locale IN ('en-US', 'en-GB') AND brand = 'x'' OR 1=1 --'", {
      fields,
    });
    expect(compiled.sql).toBe('("page"."brand" = ? AND "page"."locale" IN (?, ?))');
    expect(compiled.parameters).toEqual(["x' OR 1=1 --", 'en-GB', 'en-US']);
    expect(compiled.normalized).toBe("brand = 'x'' OR 1=1 --' AND locale IN ('en-GB', 'en-US')");
  });

  test('returns a typed validation failure for unknown fields', () => {
    const result = validateSelector("secret_column = 'x'", { fields });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('UNKNOWN_FIELD');
    }
    expect(() => compileSelector("secret_column = 'x'", { fields })).toThrow(SelectorError);
  });

  test.each([
    'SELECT * FROM pages',
    "brand = 'safe'; DELETE FROM pages",
    "brand = 'safe' -- comment",
    "brand = 'safe' /* comment */",
    'PRAGMA table_info(page_instances)',
    "ATTACH DATABASE '/tmp/evil' AS evil",
    'DROP TABLE pages',
    'UPDATE pages SET brand = 1',
    'INSERT INTO pages VALUES (1)',
    'CREATE TABLE attack(value TEXT)',
    'VACUUM',
    "brand = 'a' UNION SELECT secret FROM users",
  ])('rejects SQL outside the read-only grammar: %s', (source) => {
    expect(() => compileSelector(source, { fields })).toThrow(SelectorError);
  });

  test.each([
    "brand == 'a'",
    "brand != 'a'",
    "brand LIKE '%a%'",
    'brand IN ()',
    "brand = 'unterminated",
    "(brand = 'a'",
    "brand = 'a' trailing",
    'store_id = 01',
    'store_id = NaN',
  ])('rejects malformed or unsupported grammar: %s', (source) => {
    expect(() => compileSelector(source, { fields })).toThrow(SelectorError);
  });

  test('rejects arbitrary SQL in field configuration as well as author input', () => {
    expect(() =>
      compileSelector("brand = 'mcdonalds'", {
        fields: [{ name: 'brand', sqlColumn: 'brand) OR 1=1 --' }],
      })
    ).toThrow('Invalid or duplicate');
  });

  test('enforces input and token limits', () => {
    expect(() => tokenizeSelector("brand = 'a'", { maxLength: 4 })).toThrow('character limit');
    expect(() => tokenizeSelector("brand = 'a'", { maxTokens: 2 })).toThrow('token limit');
  });

  test('evaluates scalar and multi-valued preview fields with the same AST', () => {
    const selector = parseSelector("tags IN ('chain_store', 'fast_food') AND locale = 'en-US'");
    expect(evaluateSelector(selector, { tags: ['mcdonalds', 'fast_food'], locale: 'en-US' })).toBe(
      true
    );
    expect(evaluateSelector(selector, { tags: ['independent'], locale: 'en-US' })).toBe(false);
  });
});
