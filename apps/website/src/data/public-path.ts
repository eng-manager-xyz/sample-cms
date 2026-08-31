import * as z from 'zod';

const TEMPLATE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CANONICAL_PATH_PATTERN =
  /^(?:\/|\/(?:[A-Za-z0-9.!_~*'()-]|%[0-9A-Fa-f]{2})+(?:\/(?:[A-Za-z0-9.!_~*'()-]|%[0-9A-Fa-f]{2})+)*)$/;

export const PublicTemplateKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(TEMPLATE_KEY_PATTERN, 'Use a lowercase kebab-case template key.');

// Keep the existing presentation-field name while allowing any safe template key.
export const PublicScenarioIdSchema = PublicTemplateKeySchema;
export type PublicScenarioId = z.infer<typeof PublicScenarioIdSchema>;

export const PublicCanonicalPathSchema = z.string().min(1).refine(isSafeCanonicalPath, {
  error: 'Use one absolute canonical path with valid percent-encoded segments.',
});

export const PublicPageRequestSchema = z.strictObject({
  canonicalUrl: PublicCanonicalPathSchema,
});

export interface PublicTemplateMatch {
  readonly scenarioId: PublicScenarioId;
  readonly templateId: string;
  readonly label: string;
  readonly canonicalHost: string;
}

interface PublicTemplatePattern extends PublicTemplateMatch {
  readonly expression: RegExp;
}

const localeSegment = '[a-z]{2}-[A-Z]{2}';

const publicTemplatePatterns: readonly PublicTemplatePattern[] = [
  {
    scenarioId: 'eligible-vehicles',
    templateId: 'eligible-vehicles',
    label: 'Eligible Vehicles',
    canonicalHost: 'www.uber.com',
    expression: new RegExp(
      `^/${localeSegment}/eligible-vehicles/[a-z]{2}/[a-z0-9]+(?:-[a-z0-9]+)*$`
    ),
  },
  {
    scenarioId: 'stores',
    templateId: 'tpl-store',
    label: 'Store',
    canonicalHost: 'www.ubereats.com',
    expression: new RegExp(`^/${localeSegment}/store/[1-9][0-9]*$`),
  },
  {
    scenarioId: 'structural-proof',
    templateId: 'structural-marketing',
    label: 'Structural replacement',
    canonicalHost: 'www.uber.com',
    expression: new RegExp(`^/${localeSegment}/airport/[a-z0-9]+(?:-[a-z0-9]+)*$`),
  },
] as const;

function isSafeCanonicalPath(path: string): boolean {
  if (!CANONICAL_PATH_PATTERN.test(path) || path === '/') return path === '/';
  for (const segment of path.slice(1).split('/')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return false;
    }
    if (decoded === '.' || decoded === '..' || hasUnsafeDecodedPathCharacter(decoded)) {
      return false;
    }
  }
  return true;
}

function hasUnsafeDecodedPathCharacter(value: string): boolean {
  for (const character of value) {
    const codeUnit = character.charCodeAt(0);
    if (character === '/' || character === '\\' || codeUnit <= 31 || codeUnit === 127) return true;
  }
  return false;
}

export const representativePages = [
  {
    scenarioId: 'eligible-vehicles',
    canonicalUrl: '/en-US/eligible-vehicles/ca/premium',
    title: 'Eligible Vehicles',
    summary: 'Dense regional variation across seven published placements.',
    accent: 'lime',
  },
  {
    scenarioId: 'stores',
    canonicalUrl: '/en-US/store/1001',
    title: 'Store',
    summary: 'Sparse tags compose a brand hero, promotion, and terms.',
    accent: 'coral',
  },
  {
    scenarioId: 'structural-proof',
    canonicalUrl: '/en-US/airport/hero-alt',
    title: 'Airport',
    summary: 'One stable placement swaps block type while the rest inherits.',
    accent: 'blue',
  },
] as const satisfies readonly {
  scenarioId: PublicScenarioId;
  canonicalUrl: string;
  title: string;
  summary: string;
  accent: 'lime' | 'coral' | 'blue';
}[];

export const publicRenderPolicy = {
  source: 'active-publication',
  editable: false,
  acceptsPreviewSearchParams: false,
} as const;

export function canonicalPathFromSplat(splat: string | undefined): string {
  if (!splat) return '/';
  const decodedSegments = splat.replace(/^\/+/, '').split('/');
  return `/${decodedSegments.map((segment) => encodeURIComponent(segment)).join('/')}`;
}

export function resolvePublicTemplate(canonicalUrl: string): PublicTemplateMatch | null {
  for (const candidate of publicTemplatePatterns) {
    if (!candidate.expression.test(canonicalUrl)) continue;
    return {
      scenarioId: candidate.scenarioId,
      templateId: candidate.templateId,
      label: candidate.label,
      canonicalHost: candidate.canonicalHost,
    };
  }
  return null;
}

export function hostnameWithoutPort(host: string): string {
  const normalized = host.normalize('NFKC').trim().toLowerCase();
  if (normalized.startsWith('[')) {
    const closingBracket = normalized.indexOf(']');
    return closingBracket > 1 ? normalized.slice(1, closingBracket) : '';
  }
  return normalized.split(':', 1)[0] ?? '';
}

export function isLocalRequestHost(host: string): boolean {
  const hostname = hostnameWithoutPort(host);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function publicHostMatchesTemplate(
  host: string,
  template: PublicTemplateMatch,
  nodeEnv: string | undefined,
  allowLocalhost = false
): boolean {
  const hostname = hostnameWithoutPort(host);
  const isLocal = isLocalRequestHost(host);
  if (isLocal && (nodeEnv !== 'production' || allowLocalhost)) return true;
  return hostname === template.canonicalHost;
}
