import * as z from 'zod';

import { CanonicalUrlSchema } from './content-explorer';

const ScalarEnumValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const JsonSchemaPropertySchema = z.looseObject({
  type: z.enum(['string', 'number', 'integer', 'boolean', 'object', 'array']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  enum: z.array(ScalarEnumValueSchema).min(1).optional(),
});

const RegisteredObjectSchema = z.looseObject({
  type: z.literal('object'),
  required: z.array(z.string().min(1)).optional().default([]),
  properties: z.record(z.string(), JsonSchemaPropertySchema).optional().default({}),
});

export const AuthoringStudioSearchSchema = z.object({
  canonicalUrl: CanonicalUrlSchema.optional(),
  scopeId: z.string().trim().min(1).max(160).optional(),
});

const FormFieldKindSchema = z.enum(['string', 'number', 'integer', 'boolean', 'object', 'array']);
type FormFieldKind = z.infer<typeof FormFieldKindSchema>;

export interface BlockFormField {
  readonly key: string;
  readonly label: string;
  readonly description: string | null;
  readonly kind: FormFieldKind;
  readonly required: boolean;
  readonly enumValues: readonly (string | number | boolean)[];
  readonly celEligible: boolean;
  readonly source: 'registered-schema' | 'legacy-schema-adapter';
}

export interface BlockFormModel {
  readonly fields: readonly BlockFormField[];
  readonly usesLegacyAdapter: boolean;
  readonly schemaError: string | null;
}

export type JsonObject = Record<string, z.infer<ReturnType<typeof z.json>>>;

export type ContentDraftResult =
  | { readonly success: true; readonly content: JsonObject }
  | { readonly success: false; readonly errors: Readonly<Record<string, string>> };

const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const humanizeKey = (key: string): string =>
  key.replace(/[_-]+/gu, ' ').replace(/\b\p{L}/gu, (character) => character.toUpperCase());

function inferFieldKind(value: unknown): FormFieldKind {
  if (Array.isArray(value)) return 'array';
  if (value !== null && typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isSafeInteger(value) ? 'integer' : 'number';
  return 'string';
}

export function parseContentJson(contentJson: string): JsonObject {
  const parsed: unknown = JSON.parse(contentJson);
  if (!isJsonObject(parsed)) throw new Error('Block content must be a JSON object.');
  return parsed;
}

export function deriveBlockFormModel(input: {
  readonly schemaJson: string;
  readonly exampleContentJson: string;
  readonly currentContentJson?: string;
}): BlockFormModel {
  let rawSchema: unknown;
  let example: JsonObject;
  let current: JsonObject;
  try {
    rawSchema = JSON.parse(input.schemaJson);
    example = parseContentJson(input.exampleContentJson);
    current = input.currentContentJson ? parseContentJson(input.currentContentJson) : {};
  } catch (error) {
    return {
      fields: [],
      usesLegacyAdapter: false,
      schemaError: error instanceof Error ? error.message : 'The block schema could not be read.',
    };
  }

  const schemaResult = RegisteredObjectSchema.safeParse(rawSchema);
  if (!schemaResult.success) {
    return {
      fields: [],
      usesLegacyAdapter: false,
      schemaError: z.prettifyError(schemaResult.error),
    };
  }

  const required = new Set(schemaResult.data.required);
  const keys = [
    ...Object.keys(schemaResult.data.properties),
    ...schemaResult.data.required,
    ...Object.keys(current),
    ...Object.keys(example),
  ].filter((key, index, allKeys) => allKeys.indexOf(key) === index);
  let usesLegacyAdapter = false;
  const fields = keys.map((key): BlockFormField => {
    const property = schemaResult.data.properties[key];
    const sample = current[key] ?? example[key];
    const source = property ? 'registered-schema' : 'legacy-schema-adapter';
    if (!property) usesLegacyAdapter = true;
    const kind = property?.type ?? inferFieldKind(sample);
    return {
      key,
      label: property?.title ?? humanizeKey(key),
      description: property?.description ?? null,
      kind,
      required: required.has(key),
      enumValues: property?.enum ?? [],
      celEligible: kind === 'string',
      source,
    };
  });

  return { fields, usesLegacyAdapter, schemaError: null };
}

export function draftValuesFromContent(
  fields: readonly BlockFormField[],
  content: JsonObject
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    fields.map((field) => {
      const value = content[field.key];
      if (value === undefined || value === null) return [field.key, ''];
      if (field.kind === 'object' || field.kind === 'array') {
        return [field.key, JSON.stringify(value, null, 2)];
      }
      return [field.key, String(value)];
    })
  );
}

function parseDraftValue(field: BlockFormField, rawValue: string): unknown {
  if (!field.required && rawValue.trim() === '') return undefined;
  switch (field.kind) {
    case 'string':
      return rawValue;
    case 'number': {
      const value = Number(rawValue);
      if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
      return value;
    }
    case 'integer': {
      const value = Number(rawValue);
      if (!Number.isSafeInteger(value)) throw new Error('Enter a whole number.');
      return value;
    }
    case 'boolean':
      if (rawValue === 'true') return true;
      if (rawValue === 'false') return false;
      throw new Error('Choose true or false.');
    case 'array': {
      const value: unknown = JSON.parse(rawValue);
      if (!Array.isArray(value)) throw new Error('Enter a JSON array.');
      return value;
    }
    case 'object': {
      const value: unknown = JSON.parse(rawValue);
      if (!isJsonObject(value)) throw new Error('Enter a JSON object.');
      return value;
    }
    default:
      return rawValue;
  }
}

export function contentFromDraft(
  fields: readonly BlockFormField[],
  values: Readonly<Record<string, string>>
): ContentDraftResult {
  const content: JsonObject = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const rawValue = values[field.key] ?? '';
    if (field.required && rawValue.trim() === '') {
      errors[field.key] = 'This field is required.';
      continue;
    }
    try {
      const value = parseDraftValue(field, rawValue);
      if (value !== undefined) content[field.key] = z.json().parse(value);
      if (
        value !== undefined &&
        field.enumValues.length > 0 &&
        !field.enumValues.some((candidate) => Object.is(candidate, value))
      ) {
        errors[field.key] = 'Choose one of the registered values.';
      }
    } catch (error) {
      errors[field.key] = error instanceof Error ? error.message : 'Enter a valid value.';
    }
  }
  return Object.keys(errors).length > 0 ? { success: false, errors } : { success: true, content };
}

const LOCAL_DEVELOPMENT_WEBSITE_ORIGIN = 'http://localhost:3001';

export const WebsiteOriginSchema = z
  .string()
  .trim()
  .min(1)
  .transform((rawOrigin, context) => {
    let parsed: URL;
    try {
      parsed = new URL(rawOrigin);
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'CMS_WEBSITE_ORIGIN must be an absolute URL.',
      });
      return z.NEVER;
    }

    const hasSupportedProtocol = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    const hasCredentials = parsed.username.length > 0 || parsed.password.length > 0;
    const hasNonRootPath = parsed.pathname !== '/';
    const hasQueryOrHash = rawOrigin.includes('?') || rawOrigin.includes('#');
    if (!hasSupportedProtocol || hasCredentials || hasNonRootPath || hasQueryOrHash) {
      context.addIssue({
        code: 'custom',
        message:
          'CMS_WEBSITE_ORIGIN must be an HTTP(S) origin without credentials, path, query, or hash.',
      });
      return z.NEVER;
    }

    return parsed.origin;
  });

const WebsiteOriginStateSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('ready'),
    origin: WebsiteOriginSchema,
    source: z.enum(['configured', 'local-development-default']),
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    reason: z.enum(['missing-config', 'invalid-config']),
  }),
]);

export type WebsiteOriginState = z.infer<typeof WebsiteOriginStateSchema>;

const WebsiteOriginConfigInputSchema = z.strictObject({
  configuredOrigin: z.string().optional(),
  environment: z.string().optional(),
});

export function resolveWebsiteOriginState(input: unknown): WebsiteOriginState {
  const { configuredOrigin, environment } = WebsiteOriginConfigInputSchema.parse(input);
  const hasConfiguredOrigin = configuredOrigin?.trim().length;

  if (!hasConfiguredOrigin) {
    if (environment === 'development' || environment === 'test') {
      return WebsiteOriginStateSchema.parse({
        status: 'ready',
        origin: LOCAL_DEVELOPMENT_WEBSITE_ORIGIN,
        source: 'local-development-default',
      });
    }
    return { status: 'unavailable', reason: 'missing-config' };
  }

  const parsedOrigin = WebsiteOriginSchema.safeParse(configuredOrigin);
  if (!parsedOrigin.success) return { status: 'unavailable', reason: 'invalid-config' };

  return {
    status: 'ready',
    origin: parsedOrigin.data,
    source: 'configured',
  };
}

function websiteHref(origin: string, path: string): string {
  const safeOrigin = WebsiteOriginSchema.parse(origin);
  const safePath = CanonicalUrlSchema.parse(path);
  return new URL(safePath, safeOrigin).toString();
}

export function websitePreviewHref(canonicalUrl: string, websiteOrigin: string): string {
  const safeCanonicalUrl = CanonicalUrlSchema.parse(canonicalUrl);
  return websiteHref(websiteOrigin, `/cms-preview_${safeCanonicalUrl}`);
}

export function publishedWebsiteHref(canonicalUrl: string, websiteOrigin: string): string {
  return websiteHref(websiteOrigin, canonicalUrl);
}
