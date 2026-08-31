import type { SQLQueryBindings } from 'bun:sqlite';
import type { CmsDatabaseClient } from '@repo/cms-db';
import type { ApprovedSelectorCompilation } from '@repo/cms-service';
import {
  adaptStoredSelector,
  CmsService,
  CmsServiceError,
  compileApprovedSelector,
  previewTemplateProvisioning,
} from '@repo/cms-service';
import * as z from 'zod';
import {
  CONTENT_EXPLORER_PAGE_OPTION_LIMIT,
  CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT,
  CONTENT_EXPLORER_TAG_SELECTOR_IMPACT_LIMIT,
  CONTENT_EXPLORER_TEMPLATE_LIMIT,
  type ContentExplorerInput,
  type ContentExplorerPage,
  type ContentExplorerSnapshot,
  ContentExplorerSnapshotSchema,
  type ContentPageNavigation,
  type ContentPageNavigationOption,
  type ContentSelectorSummary,
  type ContentTemplateSummary,
  canonicalUrlSegments,
  type FixedTemplateSlug,
  type TemplateCreationCommit,
  TemplateCreationCommitSchema,
  type TemplateCreationInput,
  TemplateCreationInputSchema,
  type TemplateCreationPreview,
  TemplateCreationPreviewSchema,
  type TemplateCreationResult,
  TemplateCreationResultSchema,
  type TemplatePageTagMutationInput,
  TemplatePageTagMutationInputSchema,
  type TemplatePageTagMutationResult,
  TemplatePageTagMutationResultSchema,
  type TemplatePageTagSelectorImpact,
} from '@/data/content-explorer';

const VARIABLE_SEGMENT_PATTERN = /^\{([^{}]+)\}$/;

const legacySlugByTemplateId = new Map<string, FixedTemplateSlug>([
  ['tpl-store', 'stores'],
  ['eligible-vehicles', 'eligible-vehicles'],
  ['structural-marketing', 'structural-proof'],
]);
const legacyTemplateIdBySlug = new Map(
  [...legacySlugByTemplateId].map(([templateId, slug]) => [slug, templateId] as const)
);
const legacyDefaultUrlByTemplateId = new Map<string, string>([
  ['tpl-store', '/en-US/store/1001'],
  ['eligible-vehicles', '/en-US/eligible-vehicles/ca/premium'],
  ['structural-marketing', '/en-US/airport/hero-alt'],
]);

interface TemplateSummaryRow {
  templateId: string;
  key: string;
  name: string;
  domain: string;
  urlPattern: string;
  description: string;
  status: 'active' | 'archived';
  updatedAt: string;
  pageCount: number;
  livePageCount: number;
  notLivePageCount: number;
  archivedPageCount: number;
  variantCount: number;
  activeVariantCount: number;
  draftVariantCount: number;
  currentPublicationId: string | null;
  publishedAt: string | null;
  publishedPageCount: number | null;
  draftState: 'current' | 'changes' | 'unpublished';
}

interface SlotRow {
  id: string;
  templateId: string;
  key: string;
  label: string;
  kind: 'static' | 'variable' | 'derived';
  pathPosition: number | null;
  staticValue: string | null;
}

interface PageRow {
  id: string;
  templateId: string;
  canonicalUrl: string;
  routeStatus: 'live' | 'not_live' | 'archived';
  routeRevision: string;
  updatedAt: string;
  documentHash: string | null;
}

interface PageNavigationRow {
  pageId: string;
  canonicalUrl: string;
  routeStatus: 'live' | 'not_live' | 'archived';
}

interface PagePathSlotValueRow {
  pageId: string;
  slotId: string;
  slotKey: string;
  value: string;
}

interface PageSlotValueRow {
  pageId: string;
  slotKey: string;
  value: string;
}

interface PageTagRow {
  pageId: string;
  id: string;
  namespace: string;
  value: string;
  label: string;
}

interface SelectorSummaryRow {
  id: string;
  activeRevisionId: string;
  name: string;
  isDefault: number;
  priority: number;
  status: 'draft' | 'active';
  selector: string;
  normalizedSelector: string;
  affectedPlacementCount: number;
}

interface SelectorMatchAggregateRow {
  exactMatchCount: number;
  selectedPageMatches?: number;
}

interface ActiveSelectorRow {
  selectorId: string;
  selectorName: string;
  priority: number;
  selector: string;
}

interface TagRow {
  id: string;
  value: string;
}

interface TagAssignmentRow {
  pageId: string;
  tagId: string;
}

interface SelectorImpactAggregateRow {
  exactMatchCount: number;
  selectedPageMatchCount: number;
}

interface TagSensitiveSelector {
  selectorId: string;
  selectorName: string;
  priority: number;
  compilation: ApprovedSelectorCompilation;
}

const CursorSchema = z.tuple([
  z.literal(1),
  z.enum(['after', 'before']),
  z.string().min(1).max(2_048),
  z.string().min(1).max(512),
]);
type ContentCursor = z.infer<typeof CursorSchema>;

function encodeCursor(direction: ContentCursor[1], page: PageRow): string {
  return encodeURIComponent(JSON.stringify([1, direction, page.canonicalUrl, page.id]));
}

function decodeCursor(value: string | undefined): ContentCursor | null {
  if (!value) return null;
  try {
    return CursorSchema.parse(JSON.parse(decodeURIComponent(value)));
  } catch {
    throw new CmsServiceError('INVALID_INPUT', 'The content cursor is invalid or expired.');
  }
}

function templateRows(
  client: CmsDatabaseClient,
  requestedSlug: FixedTemplateSlug
): readonly TemplateSummaryRow[] {
  const requestedTemplateId = legacyTemplateIdBySlug.get(requestedSlug) ?? '';
  return client.sqlite
    .query<TemplateSummaryRow, [string, string, number]>(
      `SELECT templates.id AS templateId,
              templates.key,
              templates.name,
              templates.domain,
              templates.url_pattern AS urlPattern,
              templates.description,
              templates.status,
              templates.updated_at AS updatedAt,
              (SELECT count(*) FROM page_instances AS pages
                WHERE pages.template_id = templates.id) AS pageCount,
              (SELECT count(*) FROM page_instances AS pages
                WHERE pages.template_id = templates.id AND pages.route_status = 'live') AS livePageCount,
              (SELECT count(*) FROM page_instances AS pages
                WHERE pages.template_id = templates.id AND pages.route_status = 'not_live') AS notLivePageCount,
              (SELECT count(*) FROM page_instances AS pages
                WHERE pages.template_id = templates.id AND pages.route_status = 'archived') AS archivedPageCount,
              (SELECT count(*) FROM variants
                WHERE variants.template_id = templates.id AND variants.is_default = 0) AS variantCount,
              (SELECT count(*) FROM variants
                WHERE variants.template_id = templates.id AND variants.is_default = 0
                  AND variants.status = 'active') AS activeVariantCount,
              (SELECT count(*) FROM variants
                WHERE variants.template_id = templates.id AND variants.is_default = 0
                  AND variants.status = 'draft') AS draftVariantCount,
              current.publication_id AS currentPublicationId,
              publications.published_at AS publishedAt,
              publications.page_count AS publishedPageCount,
              CASE
                WHEN current.publication_id IS NULL THEN 'unpublished'
                WHEN EXISTS (
                  SELECT 1 FROM variants
                  WHERE variants.template_id = templates.id
                    AND variants.updated_at > current.activated_at
                ) OR EXISTS (
                  SELECT 1 FROM page_instances AS pages
                  WHERE pages.template_id = templates.id
                    AND pages.updated_at > current.activated_at
                ) THEN 'changes'
                ELSE 'current'
              END AS draftState
       FROM templates
       LEFT JOIN current_publications AS current ON current.template_id = templates.id
       LEFT JOIN publications ON publications.id = current.publication_id
         AND publications.template_id = templates.id
       ORDER BY CASE
                  WHEN templates.id = ? OR templates.key = ? THEN -1
                  ELSE CASE templates.id
                  WHEN 'tpl-store' THEN 0
                  WHEN 'eligible-vehicles' THEN 1
                  WHEN 'structural-marketing' THEN 2
                  ELSE 3
                  END
                END,
                templates.key, templates.id
       LIMIT ?`
    )
    .all(requestedTemplateId, requestedSlug, CONTENT_EXPLORER_TEMPLATE_LIMIT);
}

function slotRows(client: CmsDatabaseClient, templateIds: readonly string[]): readonly SlotRow[] {
  if (templateIds.length === 0) return [];
  const placeholders = templateIds.map(() => '?').join(', ');
  return client.sqlite
    .query<SlotRow, SQLQueryBindings[]>(
      `SELECT id, template_id AS templateId, key, label, kind,
              path_position AS pathPosition, static_value AS staticValue
       FROM template_slots
       WHERE template_id IN (${placeholders})
       ORDER BY template_id, path_position IS NULL, path_position, key`
    )
    .all(...templateIds);
}

function grammarForTemplate(
  urlPattern: string,
  slots: readonly SlotRow[]
): ContentTemplateSummary['grammar'] {
  const slotsByPosition = new Map(
    slots
      .filter((slot) => slot.pathPosition !== null)
      .map((slot) => [slot.pathPosition, slot] as const)
  );
  return urlPattern
    .split('/')
    .filter(Boolean)
    .map((segment, pathPosition) => {
      const variableKey = VARIABLE_SEGMENT_PATTERN.exec(segment)?.[1];
      const slot = slotsByPosition.get(pathPosition);
      if (variableKey) {
        return {
          key: variableKey,
          label: slot?.label ?? variableKey,
          kind: 'variable' as const,
          value: `{${variableKey}}`,
        };
      }
      return {
        key: slot?.key ?? `segment-${pathPosition}`,
        label: slot?.label ?? segment,
        kind: 'static' as const,
        value: segment,
      };
    });
}

function readTemplates(
  client: CmsDatabaseClient,
  requestedSlug: FixedTemplateSlug
): {
  readonly items: readonly ContentTemplateSummary[];
  readonly totalCount: number;
} {
  const rows = templateRows(client, requestedSlug);
  if (rows.length === 0) {
    throw new CmsServiceError('NOT_FOUND', 'No templates are provisioned in this workspace.');
  }
  const allSlots = slotRows(
    client,
    rows.map((row) => row.templateId)
  );
  const slotsByTemplate = new Map<string, SlotRow[]>();
  for (const slot of allSlots) {
    const slots = slotsByTemplate.get(slot.templateId) ?? [];
    slots.push(slot);
    slotsByTemplate.set(slot.templateId, slots);
  }
  const totalCount =
    client.sqlite.query<{ count: number }, []>('SELECT count(*) AS count FROM templates').get()
      ?.count ?? 0;
  const items: ContentTemplateSummary[] = rows.map((row) => {
    const slug = legacySlugByTemplateId.get(row.templateId) ?? row.key;
    const slots = slotsByTemplate.get(row.templateId) ?? [];
    return {
      slug,
      templateId: row.templateId,
      name: row.name,
      domain: row.domain,
      urlPattern: row.urlPattern,
      description: row.description,
      status: row.status,
      updatedAt: row.updatedAt,
      slots: slots.map(({ id, key, label, kind, pathPosition, staticValue }) => ({
        id,
        key,
        label,
        kind,
        pathPosition,
        staticValue,
      })),
      grammar: grammarForTemplate(row.urlPattern, slots),
      pageCount: row.pageCount,
      livePageCount: row.livePageCount,
      notLivePageCount: row.notLivePageCount,
      archivedPageCount: row.archivedPageCount,
      variantCount: row.variantCount,
      activeVariantCount: row.activeVariantCount,
      draftVariantCount: row.draftVariantCount,
      publicationState: row.currentPublicationId ? 'published' : 'unpublished',
      currentPublicationId: row.currentPublicationId,
      publishedAt: row.publishedAt,
      publishedPageCount: row.publishedPageCount ?? 0,
      draftState: row.draftState,
    };
  });
  return { items, totalCount };
}

function readDefaultNavigationPage(
  client: CmsDatabaseClient,
  templateId: string
): PageNavigationRow | null {
  const preferredCanonicalUrl = legacyDefaultUrlByTemplateId.get(templateId);
  if (preferredCanonicalUrl) {
    const preferred = client.sqlite
      .query<PageNavigationRow, [string, string]>(
        `SELECT id AS pageId, canonical_url AS canonicalUrl, route_status AS routeStatus
         FROM page_instances
         WHERE template_id = ? AND canonical_url = ?`
      )
      .get(templateId, preferredCanonicalUrl);
    if (preferred) return preferred;
  }
  return (
    client.sqlite
      .query<PageNavigationRow, [string]>(
        `SELECT id AS pageId, canonical_url AS canonicalUrl, route_status AS routeStatus
         FROM page_instances
         WHERE template_id = ?
         ORDER BY canonical_url, id
         LIMIT 1`
      )
      .get(templateId) ?? null
  );
}

function readExactNavigationPage(
  client: CmsDatabaseClient,
  templateId: string,
  canonicalUrl: string | undefined
): PageNavigationRow | null {
  if (!canonicalUrl) return null;
  return (
    client.sqlite
      .query<PageNavigationRow, [string, string]>(
        `SELECT id AS pageId, canonical_url AS canonicalUrl, route_status AS routeStatus
         FROM page_instances
         WHERE template_id = ? AND canonical_url = ?`
      )
      .get(templateId, canonicalUrl) ?? null
  );
}

function readBoundedNavigationPages(
  client: CmsDatabaseClient,
  templateId: string,
  requiredPages: readonly (PageNavigationRow | null)[]
): readonly PageNavigationRow[] {
  const rows = client.sqlite
    .query<PageNavigationRow, [string, number]>(
      `SELECT id AS pageId, canonical_url AS canonicalUrl, route_status AS routeStatus
       FROM page_instances
       WHERE template_id = ?
       ORDER BY canonical_url, id
       LIMIT ?`
    )
    .all(templateId, CONTENT_EXPLORER_PAGE_OPTION_LIMIT);
  const uniqueRequiredPages = requiredPages
    .filter((page): page is PageNavigationRow => page !== null)
    .filter(
      (page, index, pages) =>
        pages.findIndex((candidate) => candidate.pageId === page.pageId) === index
    );
  const requiredPageIds = new Set(uniqueRequiredPages.map((page) => page.pageId));
  const ordinaryRows = rows.filter((row) => !requiredPageIds.has(row.pageId));
  return [
    ...ordinaryRows.slice(0, CONTENT_EXPLORER_PAGE_OPTION_LIMIT - uniqueRequiredPages.length),
    ...uniqueRequiredPages,
  ].sort(
    (left, right) =>
      left.canonicalUrl.localeCompare(right.canonicalUrl) || left.pageId.localeCompare(right.pageId)
  );
}

function readPagePathSlotValues(
  client: CmsDatabaseClient,
  templateId: string,
  pages: readonly PageNavigationRow[]
): readonly PagePathSlotValueRow[] {
  if (pages.length === 0) return [];
  const placeholders = pages.map(() => '?').join(', ');
  return client.sqlite
    .query<PagePathSlotValueRow, SQLQueryBindings[]>(
      `SELECT values_table.page_instance_id AS pageId,
              slots.id AS slotId,
              slots.key AS slotKey,
              values_table.value
       FROM page_slot_values AS values_table
       JOIN template_slots AS slots
         ON slots.id = values_table.slot_id
        AND slots.template_id = values_table.template_id
       WHERE values_table.template_id = ?
         AND slots.path_position IS NOT NULL
         AND values_table.page_instance_id IN (${placeholders})
       ORDER BY values_table.page_instance_id, slots.path_position, slots.key`
    )
    .all(templateId, ...pages.map((page) => page.pageId));
}

function pageNavigationOption(
  page: PageNavigationRow,
  pathSlots: readonly ContentTemplateSummary['slots'][number][],
  valuesByPage: ReadonlyMap<string, ReadonlyMap<string, string>>
): ContentPageNavigationOption {
  const values = valuesByPage.get(page.pageId);
  const slotValues = Object.fromEntries(
    pathSlots.map((slot) => {
      const value = values?.get(slot.key);
      if (value === undefined) {
        throw new CmsServiceError(
          'CONFLICT',
          `Page "${page.pageId}" is missing path slot "${slot.key}".`
        );
      }
      return [slot.key, value];
    })
  );
  return {
    pageId: page.pageId,
    canonicalUrl: page.canonicalUrl,
    routeStatus: page.routeStatus,
    slotValues,
  };
}

function readPageNavigation(
  client: CmsDatabaseClient,
  template: ContentTemplateSummary,
  selectedCanonicalUrl: string | undefined
): ContentPageNavigation {
  const pathSlots = template.slots
    .filter((slot) => slot.pathPosition !== null && slot.kind !== 'derived')
    .sort(
      (left, right) =>
        (left.pathPosition ?? 0) - (right.pathPosition ?? 0) || left.key.localeCompare(right.key)
    );
  const defaultRow = readDefaultNavigationPage(client, template.templateId);
  const selectedRow =
    readExactNavigationPage(client, template.templateId, selectedCanonicalUrl) ?? defaultRow;
  const rows = readBoundedNavigationPages(client, template.templateId, [defaultRow, selectedRow]);
  const valueRows = readPagePathSlotValues(client, template.templateId, rows);
  const mutableValuesByPage = new Map<string, Map<string, string>>();
  for (const valueRow of valueRows) {
    const values = mutableValuesByPage.get(valueRow.pageId) ?? new Map<string, string>();
    values.set(valueRow.slotKey, valueRow.value);
    mutableValuesByPage.set(valueRow.pageId, values);
  }
  const valuesByPage = new Map<string, ReadonlyMap<string, string>>(mutableValuesByPage);
  const options = rows.map((row) => pageNavigationOption(row, pathSlots, valuesByPage));
  const defaultPage = defaultRow
    ? (options.find((option) => option.pageId === defaultRow.pageId) ?? null)
    : null;
  const selectedPage = selectedRow
    ? (options.find((option) => option.pageId === selectedRow.pageId) ?? defaultPage)
    : defaultPage;
  return {
    segments: pathSlots.map((slot) => ({
      slotId: slot.id,
      key: slot.key,
      label: slot.label,
      kind: slot.kind === 'static' ? ('static' as const) : ('variable' as const),
      pathPosition: slot.pathPosition ?? 0,
      staticValue: slot.staticValue,
      defaultValue: defaultPage?.slotValues[slot.key] ?? null,
      selectedValue: selectedPage?.slotValues[slot.key] ?? null,
    })),
    defaultPage,
    selectedPage,
    options,
    totalCount: template.pageCount,
    truncated: template.pageCount > options.length,
  };
}

function selectorSummaryRows(
  client: CmsDatabaseClient,
  templateId: string
): readonly SelectorSummaryRow[] {
  return client.sqlite
    .query<SelectorSummaryRow, [string]>(
      `SELECT variants.id,
              variants.active_revision_id AS activeRevisionId,
              variants.name,
              variants.is_default AS isDefault,
              variants.priority,
              variants.status,
              revisions.selector_input AS selector,
              revisions.selector_sql AS normalizedSelector,
              count(DISTINCT operations.placement_key) AS affectedPlacementCount
       FROM variants
       JOIN variant_revisions AS revisions
         ON revisions.id = variants.active_revision_id
        AND revisions.variant_id = variants.id
       LEFT JOIN variant_operations AS operations
         ON operations.variant_revision_id = revisions.id
       WHERE variants.template_id = ?
         AND variants.status <> 'archived'
       GROUP BY variants.id, variants.active_revision_id, variants.name, variants.is_default,
                variants.priority, variants.status, revisions.selector_input,
                revisions.selector_sql
       ORDER BY variants.priority, variants.id`
    )
    .all(templateId);
}

function readSelectorSummaries(
  client: CmsDatabaseClient,
  templateId: string,
  selectedPageId: string | null,
  selectorMetricsFor: string | null
): readonly ContentSelectorSummary[] {
  const rows = selectorSummaryRows(client, templateId);
  return rows.map((row) => {
    const summary = {
      id: row.id,
      activeRevisionId: row.activeRevisionId,
      name: row.name,
      isDefault: Boolean(row.isDefault),
      priority: row.priority,
      status: row.status,
      selector: row.selector,
      affectedPlacementCount: row.affectedPlacementCount,
    };
    if (row.id !== selectorMetricsFor) {
      return {
        ...summary,
        metricsLoaded: false,
        exactMatchCount: null,
        selectedPageMatches: null,
        sampleCanonicalUrls: [],
        sampleUrlsTruncated: false,
      };
    }
    const surface = new CmsService(client).getApprovedReadSurface(templateId);
    const compilation = row.isDefault
      ? null
      : compileApprovedSelector(adaptStoredSelector(row.normalizedSelector), surface.fields);
    const predicateSql = compilation?.predicateSql ?? '1 = 1';
    const predicateParameters = compilation?.parameters ?? [];
    const aggregate = selectedPageId
      ? client.sqlite
          .query<SelectorMatchAggregateRow, SQLQueryBindings[]>(
            `SELECT count(*) AS exactMatchCount,
                    coalesce(max(CASE WHEN p.id = ? THEN 1 ELSE 0 END), 0) AS selectedPageMatches
             FROM page_instances AS p
             WHERE p.template_id = ? AND (${predicateSql})`
          )
          .get(selectedPageId, templateId, ...predicateParameters)
      : client.sqlite
          .query<SelectorMatchAggregateRow, SQLQueryBindings[]>(
            `SELECT count(*) AS exactMatchCount
             FROM page_instances AS p
             WHERE p.template_id = ? AND (${predicateSql})`
          )
          .get(templateId, ...predicateParameters);
    const exactMatchCount = aggregate?.exactMatchCount ?? 0;
    const sampleCanonicalUrls = client.sqlite
      .query<{ canonicalUrl: string }, SQLQueryBindings[]>(
        `SELECT p.canonical_url AS canonicalUrl
         FROM page_instances AS p
         WHERE p.template_id = ? AND (${predicateSql})
         ORDER BY p.canonical_url, p.id
         LIMIT ?`
      )
      .all(templateId, ...predicateParameters, CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT)
      .map((sample) => sample.canonicalUrl);
    return {
      ...summary,
      metricsLoaded: true,
      exactMatchCount,
      selectedPageMatches: selectedPageId === null ? null : Boolean(aggregate?.selectedPageMatches),
      sampleCanonicalUrls,
      sampleUrlsTruncated: exactMatchCount > sampleCanonicalUrls.length,
    };
  });
}

function filteredPageCount(client: CmsDatabaseClient, templateId: string, query: string): number {
  const searchClause = query ? ' AND instr(lower(canonical_url), lower(?)) > 0' : '';
  const bindings: SQLQueryBindings[] = query ? [templateId, query] : [templateId];
  return (
    client.sqlite
      .query<{ count: number }, SQLQueryBindings[]>(
        `SELECT count(*) AS count FROM page_instances
         WHERE template_id = ?${searchClause}`
      )
      .get(...bindings)?.count ?? 0
  );
}

function pageRows(
  client: CmsDatabaseClient,
  templateId: string,
  query: string,
  cursor: ContentCursor | null,
  limit: number
): readonly PageRow[] {
  const clauses = ['pages.template_id = ?'];
  const bindings: SQLQueryBindings[] = [templateId];
  if (query) {
    clauses.push('instr(lower(pages.canonical_url), lower(?)) > 0');
    bindings.push(query);
  }
  if (cursor) {
    const comparison = cursor[1] === 'before' ? '<' : '>';
    clauses.push(
      `(pages.canonical_url ${comparison} ? OR (pages.canonical_url = ? AND pages.id ${comparison} ?))`
    );
    bindings.push(cursor[2], cursor[2], cursor[3]);
  }
  bindings.push(limit + 1);
  const direction = cursor?.[1] === 'before' ? 'DESC' : 'ASC';
  return client.sqlite
    .query<PageRow, SQLQueryBindings[]>(
      `SELECT pages.id,
              pages.template_id AS templateId,
              pages.canonical_url AS canonicalUrl,
              pages.route_status AS routeStatus,
              pages.route_revision AS routeRevision,
              pages.updated_at AS updatedAt,
              documents.document_hash AS documentHash
       FROM page_instances AS pages
       LEFT JOIN current_publications AS current ON current.template_id = pages.template_id
       LEFT JOIN published_page_documents AS documents
         ON documents.template_id = pages.template_id
        AND documents.page_instance_id = pages.id
        AND documents.publication_id = current.publication_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY pages.canonical_url ${direction}, pages.id ${direction}
       LIMIT ?`
    )
    .all(...bindings);
}

function readPageMetadata(
  client: CmsDatabaseClient,
  templateId: string,
  pageIds: readonly string[]
): {
  readonly slotValuesByPage: ReadonlyMap<string, Readonly<Record<string, string>>>;
  readonly tagsByPage: ReadonlyMap<string, readonly PageTagRow[]>;
} {
  if (pageIds.length === 0) {
    return { slotValuesByPage: new Map(), tagsByPage: new Map() };
  }
  const placeholders = pageIds.map(() => '?').join(', ');
  const slotRows = client.sqlite
    .query<PageSlotValueRow, SQLQueryBindings[]>(
      `SELECT values_table.page_instance_id AS pageId,
              slots.key AS slotKey,
              values_table.value
       FROM page_slot_values AS values_table
       JOIN template_slots AS slots
         ON slots.id = values_table.slot_id
        AND slots.template_id = values_table.template_id
       WHERE values_table.template_id = ?
         AND values_table.page_instance_id IN (${placeholders})
       ORDER BY values_table.page_instance_id, slots.path_position IS NULL,
                slots.path_position, slots.key`
    )
    .all(templateId, ...pageIds);
  const tagRows = client.sqlite
    .query<PageTagRow, SQLQueryBindings[]>(
      `SELECT assignments.page_instance_id AS pageId,
              tags.id,
              tags.namespace,
              tags.value,
              tags.label
       FROM page_tags AS assignments
       JOIN tags
         ON tags.id = assignments.tag_id
        AND tags.template_id = assignments.template_id
       WHERE assignments.template_id = ?
         AND assignments.page_instance_id IN (${placeholders})
       ORDER BY assignments.page_instance_id, tags.namespace, tags.value, tags.id`
    )
    .all(templateId, ...pageIds);
  const mutableSlotValuesByPage = new Map<string, Record<string, string>>();
  for (const row of slotRows) {
    const values = mutableSlotValuesByPage.get(row.pageId) ?? {};
    values[row.slotKey] = row.value;
    mutableSlotValuesByPage.set(row.pageId, values);
  }
  const mutableTagsByPage = new Map<string, PageTagRow[]>();
  for (const row of tagRows) {
    const tags = mutableTagsByPage.get(row.pageId) ?? [];
    tags.push(row);
    mutableTagsByPage.set(row.pageId, tags);
  }
  return {
    slotValuesByPage: mutableSlotValuesByPage,
    tagsByPage: mutableTagsByPage,
  };
}

function contentExplorerPage(
  row: PageRow,
  metadata: ReturnType<typeof readPageMetadata>
): ContentExplorerPage {
  return {
    id: row.id,
    templateId: row.templateId,
    canonicalUrl: row.canonicalUrl,
    routeStatus: row.routeStatus,
    routeRevision: row.routeRevision,
    updatedAt: row.updatedAt,
    segments: [...canonicalUrlSegments(row.canonicalUrl)],
    publicationState: row.documentHash ? 'published' : 'not_published',
    documentHash: row.documentHash,
    slotValues: metadata.slotValuesByPage.get(row.id) ?? {},
    tags: (metadata.tagsByPage.get(row.id) ?? []).map(({ id, namespace, value, label }) => ({
      id,
      namespace,
      value,
      label,
    })),
  };
}

function readSelectedPageDetail(
  client: CmsDatabaseClient,
  templateId: string,
  canonicalUrl: string | undefined
): ContentExplorerPage | null {
  if (!canonicalUrl) return null;
  const row = client.sqlite
    .query<PageRow, [string, string]>(
      `SELECT pages.id,
              pages.template_id AS templateId,
              pages.canonical_url AS canonicalUrl,
              pages.route_status AS routeStatus,
              pages.route_revision AS routeRevision,
              pages.updated_at AS updatedAt,
              documents.document_hash AS documentHash
       FROM page_instances AS pages
       LEFT JOIN current_publications AS current ON current.template_id = pages.template_id
       LEFT JOIN published_page_documents AS documents
         ON documents.template_id = pages.template_id
        AND documents.page_instance_id = pages.id
        AND documents.publication_id = current.publication_id
       WHERE pages.template_id = ? AND pages.canonical_url = ?`
    )
    .get(templateId, canonicalUrl);
  return row ? contentExplorerPage(row, readPageMetadata(client, templateId, [row.id])) : null;
}

function readPages(
  client: CmsDatabaseClient,
  input: ContentExplorerInput,
  templateId: string,
  cursor: ContentCursor | null
): Pick<ContentExplorerSnapshot, 'pages' | 'filteredCount' | 'previousCursor' | 'nextCursor'> {
  const rows = pageRows(client, templateId, input.q, cursor, input.limit);
  const hasMore = rows.length > input.limit;
  const boundedRows = rows.slice(0, input.limit);
  if (cursor?.[1] === 'before') boundedRows.reverse();
  const first = boundedRows.at(0);
  const last = boundedRows.at(-1);
  const metadata = readPageMetadata(
    client,
    templateId,
    boundedRows.map((row) => row.id)
  );
  const pages = boundedRows.map((row) => contentExplorerPage(row, metadata));
  const movingBackward = cursor?.[1] === 'before';
  return {
    pages,
    filteredCount: filteredPageCount(client, templateId, input.q),
    previousCursor:
      first && ((movingBackward && hasMore) || (!movingBackward && cursor))
        ? encodeCursor('before', first)
        : null,
    nextCursor:
      last && ((!movingBackward && hasMore) || movingBackward) ? encodeCursor('after', last) : null,
  };
}

export function readContentExplorer(
  client: CmsDatabaseClient,
  rawInput: ContentExplorerInput
): ContentExplorerSnapshot {
  const cursor = decodeCursor(rawInput.cursor);
  const templateCatalog = readTemplates(client, rawInput.template);
  const templates = templateCatalog.items;
  const selectedTemplate =
    templates.find((template) => template.slug === rawInput.template) ??
    (rawInput.template === 'stores' ? templates[0] : undefined);
  if (!selectedTemplate) {
    throw new CmsServiceError('NOT_FOUND', 'The selected template is not available for authoring.');
  }
  const templateId = selectedTemplate.templateId;
  const pageNavigation = readPageNavigation(
    client,
    selectedTemplate,
    rawInput.selectedCanonicalUrl
  );
  const selectors =
    rawInput.includeSelectors !== false
      ? readSelectorSummaries(
          client,
          templateId,
          pageNavigation.selectedPage?.pageId ?? null,
          rawInput.selectorMetricsFor ?? null
        )
      : [];
  const selectedPageDetail = readSelectedPageDetail(
    client,
    templateId,
    pageNavigation.selectedPage?.canonicalUrl
  );
  const pageData = readPages(client, rawInput, templateId, cursor);
  return ContentExplorerSnapshotSchema.parse({
    templates,
    templateCount: templateCatalog.totalCount,
    templatesTruncated: templateCatalog.totalCount > templates.length,
    selectedTemplate: selectedTemplate.slug,
    query: rawInput.q,
    pageNavigation,
    selectedPageDetail,
    selectors,
    ...pageData,
  });
}

function provisioningFingerprint(
  input: TemplateCreationInput,
  preview: ReturnType<typeof previewTemplateProvisioning>
): string {
  const fingerprintPayload = {
    contract: 'cms-template-provisioning-review-v1',
    template: {
      id: input.template.id,
      key: input.template.key,
      name: input.template.name,
      domain: preview.normalizedDomain,
      description: input.template.description ?? '',
    },
    urlPattern: preview.urlPattern,
    slots: preview.slots.map((slot) => ({
      id: slot.id,
      key: slot.key,
      label: slot.label,
      kind: slot.kind,
      variableKind: slot.variableKind,
      pathPosition: slot.pathPosition,
      staticValue: slot.staticValue,
    })),
    values: {
      locale: [...preview.values.locale],
      slug: [...preview.values.slug],
    },
  };
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(fingerprintPayload)).digest('hex');
}

export function previewContentTemplateCreation(
  rawInput: TemplateCreationInput
): TemplateCreationPreview {
  const input = TemplateCreationInputSchema.parse(rawInput);
  const preview = previewTemplateProvisioning(input);
  return TemplateCreationPreviewSchema.parse({
    fingerprint: provisioningFingerprint(input, preview),
    urlPattern: preview.urlPattern,
    cardinality: preview.cardinality,
    sampleCanonicalUrls: preview.sampleCanonicalUrls,
    errors: preview.errors.map((error) => ({ path: error.path, message: error.message })),
    localeCount: preview.values.locale.length,
    slugCount: preview.values.slug.length,
  });
}

export function provisionContentTemplate(
  client: CmsDatabaseClient,
  rawCommit: TemplateCreationCommit
): TemplateCreationResult {
  const commit = TemplateCreationCommitSchema.parse(rawCommit);
  const preview = previewTemplateProvisioning(commit.input);
  if (provisioningFingerprint(commit.input, preview) !== commit.previewFingerprint) {
    throw new CmsServiceError(
      'CONFLICT',
      'The reviewed template preview is stale. Preview the current values again before creating.'
    );
  }
  if (!preview.valid) {
    throw new CmsServiceError(
      'INVALID_INPUT',
      'The reviewed template contains validation errors and cannot be created.'
    );
  }
  const result = new CmsService(client).provisionTemplate(commit.input);
  return TemplateCreationResultSchema.parse({
    templateId: result.template.id,
    templateKey: result.template.key,
    defaultVariantId: result.defaultVariant.id,
    pageCount: result.rowCount,
    firstCanonicalUrl: preview.sampleCanonicalUrls[0] ?? null,
  });
}

function tagLabel(value: string): string {
  return value
    .split(/[._-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function selectedTemplateId(client: CmsDatabaseClient, slug: FixedTemplateSlug): string {
  const legacyTemplateId = legacyTemplateIdBySlug.get(slug);
  const row = legacyTemplateId
    ? client.sqlite
        .query<{ templateId: string }, [string]>(
          `SELECT id AS templateId
           FROM templates
           WHERE id = ? AND status = 'active'
           LIMIT 1`
        )
        .get(legacyTemplateId)
    : client.sqlite
        .query<{ templateId: string }, [string]>(
          `SELECT id AS templateId
           FROM templates
           WHERE key = ? AND status = 'active'
           LIMIT 1`
        )
        .get(slug);
  if (!row) {
    throw new CmsServiceError('NOT_FOUND', 'The selected template is not available for authoring.');
  }
  return row.templateId;
}

function expressionUsesTagValues(
  expression: ApprovedSelectorCompilation['expression'],
  fields: ReadonlyMap<string, { readonly kind: string; readonly sourceKey: string }>,
  values: ReadonlySet<string>
): boolean {
  if (expression.kind === 'comparison') {
    const field = fields.get(expression.field);
    return (
      field?.kind === 'tag' &&
      field.sourceKey === 'tags' &&
      typeof expression.value === 'string' &&
      values.has(expression.value)
    );
  }
  if (expression.kind === 'in') {
    const field = fields.get(expression.field);
    return (
      field?.kind === 'tag' &&
      field.sourceKey === 'tags' &&
      expression.values.some((value) => typeof value === 'string' && values.has(value))
    );
  }
  return expression.operands.some((operand) => expressionUsesTagValues(operand, fields, values));
}

function readTagSensitiveSelectors(
  client: CmsDatabaseClient,
  templateId: string,
  values: readonly string[]
): { readonly selectors: readonly TagSensitiveSelector[]; readonly totalCount: number } {
  const surface = new CmsService(client).getApprovedReadSurface(templateId);
  const fields = new Map(surface.fields.map((field) => [field.name, field] as const));
  const valueSet = new Set(values);
  const selectors: TagSensitiveSelector[] = [];
  let totalCount = 0;
  let afterPriority: number | null = null;
  let afterSelectorId: string | null = null;

  while (true) {
    const hasCursor: boolean = afterPriority !== null && afterSelectorId !== null;
    const rows: ActiveSelectorRow[] = client.sqlite
      .query<ActiveSelectorRow, SQLQueryBindings[]>(
        `SELECT variants.id AS selectorId,
                variants.name AS selectorName,
                variants.priority,
                revisions.selector_input AS selector
         FROM variants
         JOIN variant_revisions AS revisions
           ON revisions.id = variants.active_revision_id
          AND revisions.variant_id = variants.id
         WHERE variants.template_id = ?
           AND variants.is_default = 0
           AND variants.status = 'active'
           ${hasCursor ? 'AND (variants.priority > ? OR (variants.priority = ? AND variants.id > ?))' : ''}
         ORDER BY variants.priority, variants.id
         LIMIT 100`
      )
      .all(templateId, ...(hasCursor ? [afterPriority, afterPriority, afterSelectorId] : []));
    for (const row of rows) {
      const compilation = compileApprovedSelector(
        adaptStoredSelector(row.selector),
        surface.fields
      );
      if (!expressionUsesTagValues(compilation.expression, fields, valueSet)) continue;
      totalCount += 1;
      if (selectors.length < CONTENT_EXPLORER_TAG_SELECTOR_IMPACT_LIMIT) {
        selectors.push({
          selectorId: row.selectorId,
          selectorName: row.selectorName,
          priority: row.priority,
          compilation,
        });
      }
    }
    const last: ActiveSelectorRow | undefined = rows.at(-1);
    if (!last || rows.length < 100) break;
    afterPriority = last.priority;
    afterSelectorId = last.selectorId;
  }

  return { selectors, totalCount };
}

function selectorImpactCounts(
  client: CmsDatabaseClient,
  templateId: string,
  pageIds: readonly string[],
  selector: TagSensitiveSelector
): SelectorImpactAggregateRow {
  const pagePlaceholders = pageIds.map(() => '?').join(', ');
  return (
    client.sqlite
      .query<SelectorImpactAggregateRow, SQLQueryBindings[]>(
        `SELECT count(*) AS exactMatchCount,
                coalesce(sum(CASE WHEN p.id IN (${pagePlaceholders}) THEN 1 ELSE 0 END), 0)
                  AS selectedPageMatchCount
         FROM page_instances AS p
         WHERE p.template_id = ? AND (${selector.compilation.predicateSql})`
      )
      .get(...pageIds, templateId, ...selector.compilation.parameters) ?? {
      exactMatchCount: 0,
      selectedPageMatchCount: 0,
    }
  );
}

export function mutateTemplatePageTags(
  client: CmsDatabaseClient,
  rawInput: TemplatePageTagMutationInput
): TemplatePageTagMutationResult {
  const input = TemplatePageTagMutationInputSchema.parse(rawInput);
  const uniquePageIds = [...new Set(input.pageIds)];
  return client.sqlite
    .transaction(() => {
      const templateId = selectedTemplateId(client, input.template);
      const pagePlaceholders = uniquePageIds.map(() => '?').join(', ');
      const ownedPageCount =
        client.sqlite
          .query<{ count: number }, SQLQueryBindings[]>(
            `SELECT count(*) AS count
             FROM page_instances
             WHERE template_id = ? AND id IN (${pagePlaceholders})`
          )
          .get(templateId, ...uniquePageIds)?.count ?? 0;
      if (ownedPageCount !== uniquePageIds.length) {
        throw new CmsServiceError(
          'INVALID_INPUT',
          'Every selected page must belong to the selected template.'
        );
      }

      const sensitiveSelectors = readTagSensitiveSelectors(client, templateId, input.values);
      const beforeCounts = new Map(
        sensitiveSelectors.selectors.map((selector) => [
          selector.selectorId,
          selectorImpactCounts(client, templateId, uniquePageIds, selector),
        ])
      );

      const valuePlaceholders = input.values.map(() => '?').join(', ');
      const tagsByValue = new Map(
        client.sqlite
          .query<TagRow, SQLQueryBindings[]>(
            `SELECT id, value
             FROM tags
             WHERE template_id = ? AND namespace = 'tags'
               AND value IN (${valuePlaceholders})
             ORDER BY value, id`
          )
          .all(templateId, ...input.values)
          .map((tag) => [tag.value, tag] as const)
      );
      if (input.mode === 'add') {
        const insertTag = client.sqlite.query<null, [string, string, string, string]>(
          `INSERT INTO tags (
             id, template_id, namespace, value, label, description, source, created_at
           ) VALUES (?, ?, 'tags', ?, ?, 'Self-serve Content Explorer tag', 'author', CURRENT_TIMESTAMP)`
        );
        for (const value of input.values) {
          if (tagsByValue.has(value)) continue;
          const tag = { id: `tag:${templateId}:tags:${value}`, value };
          insertTag.run(tag.id, templateId, value, tagLabel(value));
          tagsByValue.set(value, tag);
        }
      }

      const selectedTags = input.values
        .map((value) => tagsByValue.get(value))
        .filter((tag): tag is TagRow => tag !== undefined);
      const tagPlaceholders = selectedTags.map(() => '?').join(', ');
      const assigned = new Set(
        selectedTags.length === 0
          ? []
          : client.sqlite
              .query<TagAssignmentRow, SQLQueryBindings[]>(
                `SELECT page_instance_id AS pageId, tag_id AS tagId
                 FROM page_tags
                 WHERE template_id = ?
                   AND page_instance_id IN (${pagePlaceholders})
                   AND tag_id IN (${tagPlaceholders})`
              )
              .all(templateId, ...uniquePageIds, ...selectedTags.map((tag) => tag.id))
              .map((assignment) => `${assignment.pageId}\0${assignment.tagId}`)
      );
      const insertAssignment = client.sqlite.query<null, [string, string, string]>(
        `INSERT INTO page_tags (
           page_instance_id, template_id, tag_id, source, created_at
         ) VALUES (?, ?, ?, 'author', CURRENT_TIMESTAMP)`
      );
      const deleteAssignment = client.sqlite.query<null, [string, string, string]>(
        `DELETE FROM page_tags
         WHERE template_id = ? AND page_instance_id = ? AND tag_id = ?`
      );
      let changed = 0;
      for (const tag of selectedTags) {
        for (const pageId of uniquePageIds) {
          const isAssigned = assigned.has(`${pageId}\0${tag.id}`);
          if (input.mode === 'add' && !isAssigned) {
            insertAssignment.run(pageId, templateId, tag.id);
            changed += 1;
          } else if (input.mode === 'remove' && isAssigned) {
            deleteAssignment.run(templateId, pageId, tag.id);
            changed += 1;
          }
        }
      }

      const selectorImpacts: TemplatePageTagSelectorImpact[] = sensitiveSelectors.selectors.map(
        (selector) => {
          const before = beforeCounts.get(selector.selectorId) ?? {
            exactMatchCount: 0,
            selectedPageMatchCount: 0,
          };
          const after = selectorImpactCounts(client, templateId, uniquePageIds, selector);
          return {
            selectorId: selector.selectorId,
            selectorName: selector.selectorName,
            priority: selector.priority,
            beforeMatchCount: before.exactMatchCount,
            afterMatchCount: after.exactMatchCount,
            beforeSelectedPageMatchCount: before.selectedPageMatchCount,
            afterSelectedPageMatchCount: after.selectedPageMatchCount,
          };
        }
      );

      return TemplatePageTagMutationResultSchema.parse({
        selectedPageCount: uniquePageIds.length,
        tagCount: input.values.length,
        changedAssignmentCount: changed,
        unchangedAssignmentCount: uniquePageIds.length * input.values.length - changed,
        selectorImpacts,
        selectorImpactTotalCount: sensitiveSelectors.totalCount,
        selectorImpactsTruncated:
          sensitiveSelectors.totalCount > CONTENT_EXPLORER_TAG_SELECTOR_IMPACT_LIMIT,
      });
    })
    .immediate();
}
