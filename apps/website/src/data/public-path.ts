import * as z from 'zod';

export const PublicScenarioIdSchema = z.enum(['stores', 'eligible-vehicles', 'structural-proof']);
export type PublicScenarioId = z.infer<typeof PublicScenarioIdSchema>;

export const PublicPageRequestSchema = z.strictObject({
  canonicalUrl: z.string().regex(/^\/[A-Za-z0-9/_-]+$/),
});
export type PublicPageRequest = z.infer<typeof PublicPageRequestSchema>;

export interface PublicTemplateMatch {
  readonly scenarioId: PublicScenarioId;
  readonly templateId: string;
  readonly label: string;
  readonly canonicalHost: 'www.uber.com' | 'www.ubereats.com';
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
  return `/${splat.replace(/^\/+/, '')}`;
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

function hostnameWithoutPort(host: string): string {
  if (host.startsWith('[')) return host.slice(1, host.indexOf(']'));
  return host.split(':', 1)[0]?.toLowerCase() ?? '';
}

export function publicHostMatchesTemplate(
  host: string,
  template: PublicTemplateMatch,
  nodeEnv: string | undefined,
  allowLocalhost = false
): boolean {
  const hostname = hostnameWithoutPort(host);
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLocal && (nodeEnv !== 'production' || allowLocalhost)) return true;
  return hostname === template.canonicalHost;
}
