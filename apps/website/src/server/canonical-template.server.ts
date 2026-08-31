import type { CmsDatabaseClient } from '@repo/cms-db';
import * as z from 'zod';
import {
  hostnameWithoutPort,
  isLocalRequestHost,
  PublicTemplateKeySchema,
  type PublicTemplateMatch,
} from '@/data/public-path';

const CanonicalTemplatePageRowSchema = z.strictObject({
  templateId: z.string().min(1),
  templateKey: PublicTemplateKeySchema,
  templateName: z.string(),
  canonicalHost: z.string().min(1),
  pageId: z.string().min(1),
});

type CanonicalTemplatePageRow = z.infer<typeof CanonicalTemplatePageRowSchema>;

export interface CanonicalTemplatePageMatch extends PublicTemplateMatch {
  readonly pageId: string;
}

const canonicalTemplatePageSelect = `
  SELECT templates.id AS templateId,
         templates.key AS templateKey,
         templates.name AS templateName,
         templates.domain AS canonicalHost,
         pages.id AS pageId
  FROM templates
  JOIN page_instances AS pages ON pages.template_id = templates.id
`;

function parseUniqueMatch(
  rows: readonly CanonicalTemplatePageRow[]
): CanonicalTemplatePageMatch | null {
  if (rows.length !== 1) return null;
  const parsed = CanonicalTemplatePageRowSchema.safeParse(rows[0]);
  if (!parsed.success) return null;
  const row = parsed.data;
  return {
    scenarioId: row.templateKey,
    templateId: row.templateId,
    label: row.templateName.trim() || row.templateKey,
    canonicalHost: row.canonicalHost,
    pageId: row.pageId,
  };
}

/**
 * Resolves RouterService-owned canonical identity without consulting the legacy fixture registry.
 * Local development aliases have no canonical domain, so they resolve only when a path is unique
 * across all persisted templates. The two-row cap detects ambiguity without scanning every page.
 */
export function resolveCanonicalTemplatePage(
  client: CmsDatabaseClient,
  input: {
    readonly host: string;
    readonly canonicalUrl: string;
    readonly allowLocalhost: boolean;
  }
): CanonicalTemplatePageMatch | null {
  if (isLocalRequestHost(input.host) && input.allowLocalhost) {
    const rows = client.sqlite
      .query<CanonicalTemplatePageRow, [string]>(
        `${canonicalTemplatePageSelect}
         WHERE pages.canonical_url = ?
         ORDER BY templates.domain, templates.key, templates.id
         LIMIT 2`
      )
      .all(input.canonicalUrl);
    return parseUniqueMatch(rows);
  }

  const hostname = hostnameWithoutPort(input.host);
  if (!hostname) return null;
  const rows = client.sqlite
    .query<CanonicalTemplatePageRow, [string, string]>(
      `${canonicalTemplatePageSelect}
       WHERE templates.domain = ? AND pages.canonical_url = ?
       ORDER BY templates.key, templates.id
       LIMIT 2`
    )
    .all(hostname, input.canonicalUrl);
  return parseUniqueMatch(rows);
}
