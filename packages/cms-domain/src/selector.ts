export type SelectorScalar = string | number | boolean;

export interface SelectorComparison {
  readonly kind: 'comparison';
  readonly field: string;
  readonly value: SelectorScalar;
}

export interface SelectorMembership {
  readonly kind: 'in';
  readonly field: string;
  readonly values: readonly SelectorScalar[];
}

export interface SelectorAnd {
  readonly kind: 'and';
  readonly operands: readonly SelectorExpression[];
}

export interface SelectorOr {
  readonly kind: 'or';
  readonly operands: readonly SelectorExpression[];
}

export type SelectorExpression = SelectorComparison | SelectorMembership | SelectorAnd | SelectorOr;

export type SelectorTokenKind =
  | 'identifier'
  | 'string'
  | 'number'
  | 'boolean'
  | 'equals'
  | 'comma'
  | 'leftParen'
  | 'rightParen'
  | 'and'
  | 'or'
  | 'in'
  | 'eof';

export interface SelectorToken {
  readonly kind: SelectorTokenKind;
  readonly lexeme: string;
  readonly value?: SelectorScalar;
  readonly start: number;
  readonly end: number;
}

export type SelectorErrorCode =
  | 'EMPTY_SELECTOR'
  | 'SELECTOR_TOO_LONG'
  | 'TOO_MANY_TOKENS'
  | 'FORBIDDEN_SQL'
  | 'MULTIPLE_STATEMENTS'
  | 'INVALID_TOKEN'
  | 'INVALID_STRING'
  | 'INVALID_NUMBER'
  | 'UNEXPECTED_TOKEN'
  | 'UNKNOWN_FIELD'
  | 'INVALID_FIELD_CONFIG';

export class SelectorError extends Error {
  readonly code: SelectorErrorCode;
  readonly position: number;

  constructor(code: SelectorErrorCode, message: string, position = 0) {
    super(message);
    this.name = 'SelectorError';
    this.code = code;
    this.position = position;
  }
}

const FORBIDDEN_SQL_WORDS = new Set([
  'alter',
  'attach',
  'begin',
  'commit',
  'create',
  'delete',
  'detach',
  'drop',
  'except',
  'execute',
  'explain',
  'from',
  'insert',
  'intersect',
  'join',
  'pragma',
  'reindex',
  'release',
  'replace',
  'rollback',
  'savepoint',
  'select',
  'union',
  'update',
  'vacuum',
  'where',
  'with',
]);

const DEFAULT_MAX_LENGTH = 4096;
const DEFAULT_MAX_TOKENS = 512;
const IDENTIFIER_START = /[A-Za-z_]/;
const IDENTIFIER_PART = /[A-Za-z0-9_.]/;
const SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isDigit(character: string | undefined): boolean {
  return character !== undefined && character >= '0' && character <= '9';
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /\s/.test(character);
}

function token(
  kind: SelectorTokenKind,
  lexeme: string,
  start: number,
  end: number,
  value?: SelectorScalar
): SelectorToken {
  return value === undefined ? { kind, lexeme, start, end } : { kind, lexeme, value, start, end };
}

export interface TokenizeSelectorOptions {
  readonly maxLength?: number;
  readonly maxTokens?: number;
}

/** Tokenizes the deliberately tiny selector language; this is not a general SQL tokenizer. */
export function tokenizeSelector(
  source: string,
  options: TokenizeSelectorOptions = {}
): readonly SelectorToken[] {
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  if (source.trim().length === 0) {
    throw new SelectorError('EMPTY_SELECTOR', 'A selector cannot be empty.');
  }
  if (source.length > maxLength) {
    throw new SelectorError(
      'SELECTOR_TOO_LONG',
      `Selector length ${source.length} exceeds the ${maxLength} character limit.`
    );
  }

  const tokens: SelectorToken[] = [];
  let cursor = 0;
  const push = (nextToken: SelectorToken): void => {
    tokens.push(nextToken);
    if (tokens.length > maxTokens) {
      throw new SelectorError(
        'TOO_MANY_TOKENS',
        `Selector exceeds the ${maxTokens} token limit.`,
        nextToken.start
      );
    }
  };

  while (cursor < source.length) {
    const character = source[cursor];
    if (isWhitespace(character)) {
      cursor += 1;
      continue;
    }

    const start = cursor;
    if (character === ';') {
      throw new SelectorError(
        'MULTIPLE_STATEMENTS',
        'Statement separators are not allowed in selectors.',
        start
      );
    }
    if (
      (character === '-' && source[cursor + 1] === '-') ||
      (character === '/' && source[cursor + 1] === '*') ||
      (character === '*' && source[cursor + 1] === '/') ||
      character === '#'
    ) {
      throw new SelectorError('FORBIDDEN_SQL', 'SQL comments are not allowed in selectors.', start);
    }
    if (character === '=') {
      push(token('equals', character, start, ++cursor));
      continue;
    }
    if (character === ',') {
      push(token('comma', character, start, ++cursor));
      continue;
    }
    if (character === '(') {
      push(token('leftParen', character, start, ++cursor));
      continue;
    }
    if (character === ')') {
      push(token('rightParen', character, start, ++cursor));
      continue;
    }
    if (character === "'") {
      cursor += 1;
      let value = '';
      let closed = false;
      while (cursor < source.length) {
        const stringCharacter = source[cursor];
        if (stringCharacter === "'") {
          if (source[cursor + 1] === "'") {
            value += "'";
            cursor += 2;
            continue;
          }
          cursor += 1;
          closed = true;
          break;
        }
        value += stringCharacter;
        cursor += 1;
      }
      if (!closed) {
        throw new SelectorError('INVALID_STRING', 'Unterminated string literal.', start);
      }
      push(token('string', source.slice(start, cursor), start, cursor, value));
      continue;
    }
    if (isDigit(character) || (character === '-' && isDigit(source[cursor + 1]))) {
      const remaining = source.slice(cursor);
      const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(remaining);
      if (!match) {
        throw new SelectorError('INVALID_NUMBER', 'Invalid numeric literal.', start);
      }
      const lexeme = match[0];
      cursor += lexeme.length;
      const value = Number(lexeme);
      if (!Number.isFinite(value)) {
        throw new SelectorError('INVALID_NUMBER', 'Numeric literals must be finite.', start);
      }
      push(token('number', lexeme, start, cursor, value));
      continue;
    }
    if (character !== undefined && IDENTIFIER_START.test(character)) {
      cursor += 1;
      while (cursor < source.length && IDENTIFIER_PART.test(source[cursor] ?? '')) {
        cursor += 1;
      }
      const lexeme = source.slice(start, cursor);
      if (lexeme.includes('..') || lexeme.endsWith('.')) {
        throw new SelectorError('INVALID_TOKEN', `Invalid field name "${lexeme}".`, start);
      }
      const lower = lexeme.toLowerCase();
      if (FORBIDDEN_SQL_WORDS.has(lower)) {
        throw new SelectorError(
          'FORBIDDEN_SQL',
          `SQL keyword "${lexeme}" is outside the selector language.`,
          start
        );
      }
      if (lower === 'and' || lower === 'or' || lower === 'in') {
        push(token(lower, lexeme, start, cursor));
      } else if (lower === 'true' || lower === 'false') {
        push(token('boolean', lexeme, start, cursor, lower === 'true'));
      } else {
        push(token('identifier', lexeme, start, cursor));
      }
      continue;
    }

    throw new SelectorError(
      'INVALID_TOKEN',
      `Character ${JSON.stringify(character)} is not allowed in selectors.`,
      start
    );
  }

  tokens.push(token('eof', '', source.length, source.length));
  return tokens;
}

class SelectorParser {
  readonly tokens: readonly SelectorToken[];
  private cursor = 0;

  constructor(tokens: readonly SelectorToken[]) {
    this.tokens = tokens;
  }

  parse(): SelectorExpression {
    const expression = this.parseOr();
    this.consume('eof', 'Unexpected content after the selector expression.');
    return expression;
  }

  private peek(): SelectorToken {
    return (
      this.tokens[this.cursor] ??
      token('eof', '', this.tokens.at(-1)?.end ?? 0, this.tokens.at(-1)?.end ?? 0)
    );
  }

  private match(kind: SelectorTokenKind): boolean {
    if (this.peek().kind !== kind) {
      return false;
    }
    this.cursor += 1;
    return true;
  }

  private consume(kind: SelectorTokenKind, message: string): SelectorToken {
    const current = this.peek();
    if (current.kind !== kind) {
      throw new SelectorError('UNEXPECTED_TOKEN', message, current.start);
    }
    this.cursor += 1;
    return current;
  }

  private parseOr(): SelectorExpression {
    const operands = [this.parseAnd()];
    while (this.match('or')) {
      operands.push(this.parseAnd());
    }
    return operands.length === 1 ? (operands[0] ?? this.unreachable()) : { kind: 'or', operands };
  }

  private parseAnd(): SelectorExpression {
    const operands = [this.parsePrimary()];
    while (this.match('and')) {
      operands.push(this.parsePrimary());
    }
    return operands.length === 1 ? (operands[0] ?? this.unreachable()) : { kind: 'and', operands };
  }

  private parsePrimary(): SelectorExpression {
    if (this.match('leftParen')) {
      const expression = this.parseOr();
      this.consume('rightParen', 'Expected a closing parenthesis.');
      return expression;
    }
    return this.parsePredicate();
  }

  private parsePredicate(): SelectorExpression {
    const field = this.consume('identifier', 'Expected an approved field name.');
    if (this.match('equals')) {
      return { kind: 'comparison', field: field.lexeme, value: this.parseScalar() };
    }
    if (this.match('in')) {
      this.consume('leftParen', 'Expected "(" after IN.');
      const values = [this.parseScalar()];
      while (this.match('comma')) {
        values.push(this.parseScalar());
      }
      this.consume('rightParen', 'Expected ")" after the IN values.');
      return { kind: 'in', field: field.lexeme, values };
    }
    throw new SelectorError(
      'UNEXPECTED_TOKEN',
      'Expected "=" or IN after the field name.',
      this.peek().start
    );
  }

  private parseScalar(): SelectorScalar {
    const current = this.peek();
    if (current.kind !== 'string' && current.kind !== 'number' && current.kind !== 'boolean') {
      throw new SelectorError(
        'UNEXPECTED_TOKEN',
        'Expected a string, number, or boolean literal.',
        current.start
      );
    }
    this.cursor += 1;
    if (current.value === undefined) {
      return this.unreachable();
    }
    return current.value;
  }

  private unreachable(): never {
    throw new SelectorError('UNEXPECTED_TOKEN', 'Unexpected end of selector.', this.peek().start);
  }
}

export function parseSelector(
  source: string,
  options: TokenizeSelectorOptions = {}
): SelectorExpression {
  return new SelectorParser(tokenizeSelector(source, options)).parse();
}

function scalarKey(value: SelectorScalar): string {
  return `${typeof value}:${JSON.stringify(value)}`;
}

function expressionKey(expression: SelectorExpression): string {
  switch (expression.kind) {
    case 'comparison':
      return `eq:${expression.field}:${scalarKey(expression.value)}`;
    case 'in':
      return `in:${expression.field}:${expression.values.map(scalarKey).join(',')}`;
    case 'and':
    case 'or':
      return `${expression.kind}:(${expression.operands.map(expressionKey).join(',')})`;
  }
}

function normalizeBoolean(
  kind: 'and' | 'or',
  operands: readonly SelectorExpression[]
): SelectorExpression {
  const flattened = operands.flatMap((operand) => {
    const normalized = normalizeSelector(operand);
    return normalized.kind === kind ? normalized.operands : [normalized];
  });
  const unique = new Map(flattened.map((operand) => [expressionKey(operand), operand]));
  const sorted = [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, operand]) => operand);
  if (sorted.length === 1) {
    return (
      sorted[0] ??
      (() => {
        throw new SelectorError('EMPTY_SELECTOR', 'A selector cannot be empty.');
      })()
    );
  }
  return { kind, operands: sorted };
}

/** Canonicalizes casing-independent structure, IN values, and commutative boolean operands. */
export function normalizeSelector(expression: SelectorExpression): SelectorExpression {
  switch (expression.kind) {
    case 'comparison':
      return { ...expression };
    case 'in': {
      const values = [
        ...new Map(expression.values.map((value) => [scalarKey(value), value])).entries(),
      ]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([, value]) => value);
      return values.length === 1
        ? { kind: 'comparison', field: expression.field, value: values[0] ?? false }
        : { kind: 'in', field: expression.field, values };
    }
    case 'and':
    case 'or':
      return normalizeBoolean(expression.kind, expression.operands);
  }
}

function formatScalar(value: SelectorScalar): string {
  if (typeof value === 'string') {
    return `'${value.replaceAll("'", "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return JSON.stringify(Object.is(value, -0) ? 0 : value);
}

function formatNormalizedSelector(expression: SelectorExpression, parentPrecedence = 0): string {
  if (expression.kind === 'comparison') {
    return `${expression.field} = ${formatScalar(expression.value)}`;
  }
  if (expression.kind === 'in') {
    return `${expression.field} IN (${expression.values.map(formatScalar).join(', ')})`;
  }

  const precedence = expression.kind === 'and' ? 2 : 1;
  const formatted = expression.operands
    .map((operand) => formatNormalizedSelector(operand, precedence))
    .join(expression.kind === 'and' ? ' AND ' : ' OR ');
  return precedence < parentPrecedence ? `(${formatted})` : formatted;
}

export function formatSelector(expression: SelectorExpression): string {
  return formatNormalizedSelector(normalizeSelector(expression));
}

export interface SelectorField {
  readonly name: string;
  /** Trusted identifier path in the approved read surface, never arbitrary SQL. */
  readonly sqlColumn?: string;
}

export interface SelectorValidationOptions extends TokenizeSelectorOptions {
  readonly fields: readonly (string | SelectorField)[];
}

export interface ValidSelector {
  readonly ok: true;
  readonly expression: SelectorExpression;
  readonly normalized: string;
  readonly fields: readonly string[];
}

export interface InvalidSelector {
  readonly ok: false;
  readonly errors: readonly SelectorError[];
}

export type SelectorValidationResult = ValidSelector | InvalidSelector;

interface PreparedField {
  readonly name: string;
  readonly sqlColumn: string;
}

function prepareFields(
  fields: readonly (string | SelectorField)[]
): ReadonlyMap<string, PreparedField> {
  const prepared = new Map<string, PreparedField>();
  for (const input of fields) {
    const field = typeof input === 'string' ? { name: input, sqlColumn: input } : input;
    const sqlColumn = field.sqlColumn ?? field.name;
    const validName = field.name.split('.').every((part) => SQL_IDENTIFIER.test(part));
    const validColumn = sqlColumn.split('.').every((part) => SQL_IDENTIFIER.test(part));
    if (!validName || !validColumn || prepared.has(field.name)) {
      throw new SelectorError(
        'INVALID_FIELD_CONFIG',
        `Invalid or duplicate approved selector field "${field.name}".`
      );
    }
    prepared.set(field.name, { name: field.name, sqlColumn });
  }
  return prepared;
}

function collectFields(expression: SelectorExpression, output = new Set<string>()): Set<string> {
  if (expression.kind === 'comparison' || expression.kind === 'in') {
    output.add(expression.field);
  } else {
    for (const operand of expression.operands) {
      collectFields(operand, output);
    }
  }
  return output;
}

function toExpression(
  selector: string | SelectorExpression,
  options: TokenizeSelectorOptions
): SelectorExpression {
  return typeof selector === 'string' ? parseSelector(selector, options) : selector;
}

export function validateSelector(
  selector: string | SelectorExpression,
  options: SelectorValidationOptions
): SelectorValidationResult {
  try {
    const preparedFields = prepareFields(options.fields);
    const expression = normalizeSelector(toExpression(selector, options));
    const usedFields = [...collectFields(expression)].sort();
    const unknown = usedFields.find((field) => !preparedFields.has(field));
    if (unknown) {
      throw new SelectorError(
        'UNKNOWN_FIELD',
        `Field "${unknown}" is not part of the approved selector surface.`
      );
    }
    return {
      ok: true,
      expression,
      normalized: formatNormalizedSelector(expression),
      fields: usedFields,
    };
  } catch (error) {
    return {
      ok: false,
      errors: [
        error instanceof SelectorError
          ? error
          : new SelectorError('INVALID_TOKEN', 'Selector validation failed.'),
      ],
    };
  }
}

export interface CompiledSelector {
  readonly sql: string;
  readonly parameters: readonly SelectorScalar[];
  readonly normalized: string;
  readonly expression: SelectorExpression;
  readonly fields: readonly string[];
}

function quoteIdentifierPath(path: string): string {
  return path
    .split('.')
    .map((part) => `"${part}"`)
    .join('.');
}

function compileExpression(
  expression: SelectorExpression,
  fields: ReadonlyMap<string, PreparedField>,
  parameters: SelectorScalar[]
): string {
  if (expression.kind === 'comparison') {
    const field = fields.get(expression.field);
    if (!field) {
      throw new SelectorError('UNKNOWN_FIELD', `Unknown field "${expression.field}".`);
    }
    parameters.push(expression.value);
    return `${quoteIdentifierPath(field.sqlColumn)} = ?`;
  }
  if (expression.kind === 'in') {
    const field = fields.get(expression.field);
    if (!field) {
      throw new SelectorError('UNKNOWN_FIELD', `Unknown field "${expression.field}".`);
    }
    parameters.push(...expression.values);
    return `${quoteIdentifierPath(field.sqlColumn)} IN (${expression.values.map(() => '?').join(', ')})`;
  }

  const operator = expression.kind === 'and' ? ' AND ' : ' OR ';
  return `(${expression.operands
    .map((operand) => compileExpression(operand, fields, parameters))
    .join(operator)})`;
}

/** Compiles only approved identifiers and parameterizes every author-provided literal. */
export function compileSelector(
  selector: string | SelectorExpression,
  options: SelectorValidationOptions
): CompiledSelector {
  const result = validateSelector(selector, options);
  if (!result.ok) {
    throw result.errors[0] ?? new SelectorError('INVALID_TOKEN', 'Invalid selector.');
  }
  const fields = prepareFields(options.fields);
  const parameters: SelectorScalar[] = [];
  return {
    sql: compileExpression(result.expression, fields, parameters),
    parameters,
    normalized: result.normalized,
    expression: result.expression,
    fields: result.fields,
  };
}

export type SelectorRecordValue = SelectorScalar | readonly SelectorScalar[] | undefined;
export type SelectorRecord = Readonly<Record<string, SelectorRecordValue>>;

function readRecordValue(record: SelectorRecord, field: string): SelectorRecordValue {
  return record[field];
}

function matchesValue(actual: SelectorRecordValue, expected: SelectorScalar): boolean {
  return Array.isArray(actual) ? actual.includes(expected) : actual === expected;
}

/** Evaluates an already-safe AST for previews and tests; publication can use the compiled SQL form. */
export function evaluateSelector(selector: SelectorExpression, record: SelectorRecord): boolean {
  switch (selector.kind) {
    case 'comparison':
      return matchesValue(readRecordValue(record, selector.field), selector.value);
    case 'in': {
      const actual = readRecordValue(record, selector.field);
      return selector.values.some((candidate) => matchesValue(actual, candidate));
    }
    case 'and':
      return selector.operands.every((operand) => evaluateSelector(operand, record));
    case 'or':
      return selector.operands.some((operand) => evaluateSelector(operand, record));
  }
}
