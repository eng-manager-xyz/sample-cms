import type { SQLQueryBindings } from 'bun:sqlite';
import type { CmsDatabaseClient } from '@repo/cms-db';
import { compactScenarioRegistry } from '@repo/cms-scenarios/compact-seed';
import {
  adaptStoredSelector,
  CmsService,
  CmsServiceError,
  compileApprovedSelector,
} from '@repo/cms-service';
import * as z from 'zod';
import {
  CONTENT_EXPLORER_PAGE_OPTION_LIMIT,
  CONTENT_EXPLORER_SELECTOR_SAMPLE_LIMIT,
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
} from '@/data/content-explorer';

const VARIABLE_SEGMENT_PATTERN = /^\{([^{}]+)\}$/;

const fixedTemplates = [
  ['stores', compactScenarioRegistry.stores.templateId],
  ['eligible-vehicles', compactScenarioRegistry['eligible-vehicles'].templateId],
  ['structural-proof', compactScenarioRegistry['structural-proof'].templateId],
] as const satisfies readonly (readonly [FixedTemplateSlug, string])[];

const templateIdBySlug = new Map<FixedTemplateSlug, string>(fixedTemplates);
const slugByTemplateId = new Map<string, FixedTemplateSlug>(
  fixedTemplates.map(([slug, templateId]) => [templateId, slug])
);
const fixedTemplateIds = fixedTemplates.map(([, templateId]) => templateId) as [
  string,
  string,
  string,
];

interface TemplateSummaryRow {
  templateId: string;
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

function templateRows(client: CmsDatabaseClient): readonly TemplateSummaryRow[] {
  return client.sqlite
    .query<TemplateSummaryRow, [string, string, string]>(
      `SELECT templates.id AS templateId,
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
       WHERE templates.id IN (?, ?, ?)`
    )
    .all(...fixedTemplateIds);
}

function slotRows(client: CmsDatabaseClient): readonly SlotRow[] {
  return client.sqlite
    .query<SlotRow, [string, string, string]>(
      `SELECT id, template_id AS templateId, key, label, kind,
              path_position AS pathPosition, static_value AS staticValue
       FROM template_slots
       WHERE template_id IN (?, ?, ?)
       ORDER BY template_id, path_position IS NULL, path_position, key`
    )
    .all(...fixedTemplateIds);
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

function readTemplates(client: CmsDatabaseClient): readonly ContentTemplateSummary[] {
  const rowsById = new Map(templateRows(client).map((row) => [row.templateId, row] as const));
  const allSlots = slotRows(client);
  return fixedTemplates.map(([slug, templateId]) => {
    const row = rowsById.get(templateId);
    if (!row) {
      throw new CmsServiceError(
        'NOT_FOUND',
        `The fixed template "${slug}" is not provisioned. Run bun run db:seed.`
      );
    }
    const slots = allSlots.filter((slot) => slot.templateId === templateId);
    return {
      slug,
      templateId,
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
}

function readDefaultNavigationPage(
  client: CmsDatabaseClient,
  templateId: string,
  defaultCanonicalUrl: string
): PageNavigationRow | null {
  const selected = client.sqlite
    .query<PageNavigationRow, [string, string]>(
      `SELECT id AS pageId, canonical_url AS canonicalUrl, route_status AS routeStatus
       FROM page_instances
       WHERE template_id = ? AND canonical_url = ?`
    )
    .get(templateId, defaultCanonicalUrl);
  if (selected) return selected;
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
  defaultCanonicalUrl: string,
  selectedCanonicalUrl: string | undefined
): ContentPageNavigation {
  const pathSlots = template.slots
    .filter((slot) => slot.pathPosition !== null && slot.kind !== 'derived')
    .sort(
      (left, right) =>
        (left.pathPosition ?? 0) - (right.pathPosition ?? 0) || left.key.localeCompare(right.key)
    );
  const defaultRow = readDefaultNavigationPage(client, template.templateId, defaultCanonicalUrl);
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
  selectedPageId: string | null
): readonly ContentSelectorSummary[] {
  const surface = new CmsService(client).getApprovedReadSurface(templateId);
  return selectorSummaryRows(client, templateId).map((row) => {
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
      id: row.id,
      activeRevisionId: row.activeRevisionId,
      name: row.name,
      isDefault: Boolean(row.isDefault),
      priority: row.priority,
      status: row.status,
      selector: row.selector,
      exactMatchCount,
      affectedPlacementCount: row.affectedPlacementCount,
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
  const pages: ContentExplorerPage[] = boundedRows.map((row) => ({
    id: row.id,
    templateId: row.templateId,
    canonicalUrl: row.canonicalUrl,
    routeStatus: row.routeStatus,
    routeRevision: row.routeRevision,
    updatedAt: row.updatedAt,
    segments: [...canonicalUrlSegments(row.canonicalUrl)],
    publicationState: row.documentHash ? 'published' : 'not_published',
    documentHash: row.documentHash,
  }));
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
  const templateId = templateIdBySlug.get(rawInput.template);
  if (!templateId || !slugByTemplateId.has(templateId)) {
    throw new CmsServiceError('NOT_FOUND', 'The selected template is not available for authoring.');
  }
  const templates = readTemplates(client);
  const selectedTemplate = templates.find((template) => template.templateId === templateId);
  if (!selectedTemplate) {
    throw new CmsServiceError('NOT_FOUND', 'The selected template summary was not loaded.');
  }
  const pageNavigation = readPageNavigation(
    client,
    selectedTemplate,
    compactScenarioRegistry[rawInput.template].canonicalUrl,
    rawInput.selectedCanonicalUrl
  );
  const selectors =
    rawInput.includeSelectors !== false
      ? readSelectorSummaries(client, templateId, pageNavigation.selectedPage?.pageId ?? null)
      : [];
  const pageData = readPages(client, rawInput, templateId, cursor);
  return ContentExplorerSnapshotSchema.parse({
    templates,
    selectedTemplate: rawInput.template,
    query: rawInput.q,
    pageNavigation,
    selectors,
    ...pageData,
  });
}
