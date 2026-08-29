import type { JsonObject, JsonValue } from '@repo/cms-domain';

export interface SchemaValidationIssue {
  readonly path: string;
  readonly message: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const expectedTypeMatches = (expected: string, value: JsonValue): boolean => {
  switch (expected) {
    case 'object':
      return isObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    default:
      return false;
  }
};

const enumContains = (values: readonly unknown[], value: JsonValue): boolean =>
  values.some((candidate) => JSON.stringify(candidate) === JSON.stringify(value));

function validateNode(
  schema: Record<string, unknown>,
  value: JsonValue,
  path: string,
  issues: SchemaValidationIssue[]
): void {
  const expectedType = schema.type;
  if (typeof expectedType === 'string' && !expectedTypeMatches(expectedType, value)) {
    issues.push({ path, message: `Expected ${expectedType}.` });
    return;
  }

  if (Array.isArray(schema.enum) && !enumContains(schema.enum, value)) {
    issues.push({ path, message: 'Value is not in the allowed enum.' });
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      issues.push({ path, message: `Must contain at least ${schema.minLength} characters.` });
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      issues.push({ path, message: `Must contain no more than ${schema.maxLength} characters.` });
    }
    if (typeof schema.pattern === 'string') {
      try {
        if (!new RegExp(schema.pattern, 'u').test(value)) {
          issues.push({ path, message: `Must match ${schema.pattern}.` });
        }
      } catch {
        issues.push({ path, message: 'Block schema contains an invalid regular expression.' });
      }
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      issues.push({ path, message: `Must be at least ${schema.minimum}.` });
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      issues.push({ path, message: `Must be no more than ${schema.maximum}.` });
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      issues.push({ path, message: `Must contain at least ${schema.minItems} items.` });
    }
    if (isObject(schema.items)) {
      value.forEach((item, index) => {
        validateNode(schema.items as Record<string, unknown>, item, `${path}[${index}]`, issues);
      });
    }
  }

  if (!isObject(value)) {
    return;
  }

  const required = Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === 'string')
    : [];
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      issues.push({ path: `${path}.${key}`, message: 'Required property is missing.' });
    }
  }

  const properties = isObject(schema.properties) ? schema.properties : {};
  for (const [key, child] of Object.entries(value)) {
    const childSchema = properties[key];
    if (isObject(childSchema)) {
      validateNode(childSchema, child as JsonValue, `${path}.${key}`, issues);
    } else if (schema.additionalProperties === false) {
      issues.push({ path: `${path}.${key}`, message: 'Additional properties are not allowed.' });
    }
  }
}

export function validateBlockContent(
  schema: JsonObject,
  content: JsonObject
): readonly SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];
  validateNode(schema, content, '$', issues);
  return issues;
}

export function assertBlockContent(schema: JsonObject, content: JsonObject): void {
  const issues = validateBlockContent(schema, content);
  if (issues.length > 0) {
    throw new Error(
      `Block content failed schema validation: ${issues
        .map((issue) => `${issue.path} ${issue.message}`)
        .join('; ')}`
    );
  }
}
