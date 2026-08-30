import { Link, useNavigate } from '@tanstack/react-router';
import { Database, FileText, Folder, FolderOpen, GitBranch, Layers3, Search } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import * as z from 'zod';

import { TemplatePageNavigator } from '@/components/template-page-navigator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  CompactTreeChildren,
  CompactTreeDisclosure,
  CompactTreeRow,
  compactTreeRowClassName,
} from '@/components/ui/compact-tree';
import { Input } from '@/components/ui/input';
import {
  type ContentExplorerPage,
  type ContentExplorerSearch,
  ContentExplorerSearchSchema,
  ContentExplorerSnapshotSchema,
  type ContentPageNavigationOption,
  type ContentSelectorSummary,
  type ContentTemplateSummary,
  contentSelectorFocus,
  type FixedTemplateSlug,
  selectorIdFromExplorerFocus,
} from '@/data/content-explorer';
import { cn } from '@/lib/cn';

const ContentExplorerPropsSchema = z.object({
  snapshot: ContentExplorerSnapshotSchema,
  search: ContentExplorerSearchSchema,
});
type ContentExplorerProps = z.infer<typeof ContentExplorerPropsSchema>;

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const secondaryActionClassName =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-canvas px-3 text-xs font-medium text-ink outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-focus';
const primaryActionClassName =
  'inline-flex h-8 items-center gap-1.5 rounded-md bg-ink px-3 text-xs font-medium text-canvas outline-none transition-colors hover:bg-ink/90 focus-visible:ring-2 focus-visible:ring-focus';

type ExplorerSelection =
  | { kind: 'template' }
  | { kind: 'pages' }
  | { kind: 'page'; page: ContentExplorerPage }
  | { kind: 'selectors' }
  | { kind: 'selector'; selector: ContentSelectorSummary };

function formatTimestamp(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestampFormatter.format(timestamp);
}

function routeTone(status: ContentExplorerPage['routeStatus']): 'success' | 'warning' | 'neutral' {
  if (status === 'live') return 'success';
  if (status === 'not_live') return 'warning';
  return 'neutral';
}

function draftLabel(state: ContentTemplateSummary['draftState']): string {
  if (state === 'current') return 'No draft changes';
  if (state === 'changes') return 'Draft changes';
  return 'Not published';
}

function selectedTemplate(
  templates: readonly ContentTemplateSummary[],
  selectedSlug: ContentExplorerSearch['template']
): ContentTemplateSummary {
  const selected = templates.find((template) => template.slug === selectedSlug);
  if (!selected) throw new Error(`Selected fixed template "${selectedSlug}" was not loaded.`);
  return selected;
}

export function resolveExplorerSelection(
  search: ContentExplorerSearch,
  snapshot: Pick<ContentExplorerProps['snapshot'], 'selectedPageDetail' | 'selectors'>
): ExplorerSelection {
  const focus = search.focus;
  const focusedSelectorId = selectorIdFromExplorerFocus(focus);
  if (focusedSelectorId) {
    const selector = snapshot.selectors.find((candidate) => candidate.id === focusedSelectorId);
    if (selector) return { kind: 'selector', selector };
  }
  if (focus === 'selectors' || (!focus && search.view === 'selectors')) {
    return { kind: 'selectors' };
  }
  if (focus === 'pages' || (!focus && search.view === 'table')) return { kind: 'pages' };
  if (focus === 'page' || (!focus && search.canonicalUrl)) {
    const page = snapshot.selectedPageDetail;
    if (page) return { kind: 'page', page };
  }
  return { kind: 'template' };
}

export function contentExplorerTreePath(
  template: FixedTemplateSlug,
  kind: 'template' | 'pages' | 'selectors' | 'page' | 'selector',
  identity?: string
): string {
  const root = `/templates/${template}`;
  if (kind === 'template') return root;
  if (kind === 'pages') return `${root}/pages`;
  if (kind === 'selectors') return `${root}/selectors`;
  const normalizedIdentity = identity?.replace(/^\/+/, '') ?? '';
  return `${root}/${kind === 'page' ? 'pages' : 'selectors'}/${normalizedIdentity}`;
}

export function pagesForExplorerTree(
  pages: readonly ContentExplorerPage[],
  selectedPage: ContentExplorerPage | null
): readonly ContentExplorerPage[] {
  if (!selectedPage || pages.some((page) => page.id === selectedPage.id)) return pages;
  return [selectedPage, ...pages];
}

function TreeSelectButton({
  selected,
  label,
  description,
  meta,
  icon: Icon,
  onClick,
  treePath,
  className,
}: Readonly<{
  selected: boolean;
  label: string;
  description?: string;
  meta?: string;
  icon: typeof Folder;
  onClick: () => void;
  treePath: string;
  className?: string;
}>) {
  return (
    <button
      type="button"
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
      data-tree-path={treePath}
      className={cn(
        compactTreeRowClassName,
        'min-w-0 flex-1 gap-2 px-2 text-left focus-visible:ring-2 focus-visible:ring-focus',
        selected
          ? 'bg-accent-soft text-ink ring-1 ring-inset ring-accent/20'
          : 'text-ink-muted hover:bg-canvas hover:text-ink',
        className
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.8}
        className={cn('size-3.5 shrink-0', selected ? 'text-accent-strong' : 'text-ink-faint')}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {description ? (
          <span className="block truncate font-mono text-[9px] font-normal text-ink-faint">
            {description}
          </span>
        ) : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-[10px] font-normal tabular-nums text-ink-faint">{meta}</span>
      ) : null}
    </button>
  );
}

function TreeLeafRow({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <CompactTreeRow>
      <span aria-hidden="true" className="size-8 shrink-0" />
      {children}
    </CompactTreeRow>
  );
}

function ExplorerTree({
  snapshot,
  search,
  selection,
  onSelectTemplate,
  onSelectCollection,
  onSelectPage,
  onSelectSelector,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  search: ContentExplorerSearch;
  selection: ExplorerSelection;
  onSelectTemplate: (template: FixedTemplateSlug) => void;
  onSelectCollection: (template: FixedTemplateSlug, collection: 'pages' | 'selectors') => void;
  onSelectPage: (page: ContentExplorerPage) => void;
  onSelectSelector: (selector: ContentSelectorSummary) => void;
}>) {
  const idPrefix = useId();
  const templatePath = contentExplorerTreePath(snapshot.selectedTemplate, 'template');
  const pagesPath = contentExplorerTreePath(snapshot.selectedTemplate, 'pages');
  const selectorsPath = contentExplorerTreePath(snapshot.selectedTemplate, 'selectors');
  const [openPaths, setOpenPaths] = useState<Record<string, boolean>>({
    [templatePath]: true,
    [pagesPath]: true,
    [selectorsPath]: true,
  });
  const pinnedPage =
    selection.kind === 'page'
      ? selection.page
      : selection.kind === 'selector'
        ? snapshot.selectedPageDetail
        : null;
  const treePages = pagesForExplorerTree(snapshot.pages, pinnedPage);

  function expanded(path: string, activeTemplate: boolean): boolean {
    return openPaths[path] ?? activeTemplate;
  }

  function toggle(path: string, activeTemplate: boolean) {
    setOpenPaths((current) => ({ ...current, [path]: !expanded(path, activeTemplate) }));
  }

  function revealTemplate(template: FixedTemplateSlug, collection?: 'pages' | 'selectors') {
    const nextTemplatePath = contentExplorerTreePath(template, 'template');
    const nextCollectionPath = collection
      ? contentExplorerTreePath(template, collection)
      : undefined;
    setOpenPaths((current) => ({
      ...current,
      ...(template === snapshot.selectedTemplate ? {} : { [templatePath]: false }),
      [nextTemplatePath]: true,
      ...(nextCollectionPath ? { [nextCollectionPath]: true } : {}),
    }));
  }

  return (
    <nav aria-label="Templates, pages, and selectors" className="min-h-0">
      <ul className="space-y-1">
        {snapshot.templates.map((template) => {
          const activeTemplate = template.slug === snapshot.selectedTemplate;
          const currentTemplatePath = contentExplorerTreePath(template.slug, 'template');
          const currentPagesPath = contentExplorerTreePath(template.slug, 'pages');
          const currentSelectorsPath = contentExplorerTreePath(template.slug, 'selectors');
          const templateOpen = expanded(currentTemplatePath, activeTemplate);
          const pagesOpen = expanded(currentPagesPath, activeTemplate);
          const selectorsOpen = expanded(currentSelectorsPath, activeTemplate);
          const templateChildrenId = `${idPrefix}-${template.slug}-children`;
          const pagesChildrenId = `${idPrefix}-${template.slug}-pages`;
          const selectorsChildrenId = `${idPrefix}-${template.slug}-selectors`;
          const templateSelected = activeTemplate && selection.kind === 'template';
          const pagesSelected = activeTemplate && selection.kind === 'pages';
          const selectorsSelected = activeTemplate && selection.kind === 'selectors';

          return (
            <li key={template.templateId}>
              <CompactTreeRow activeAncestor={activeTemplate && !templateSelected}>
                <CompactTreeDisclosure
                  expanded={templateOpen}
                  label={template.name}
                  controls={templateChildrenId}
                  onClick={() => toggle(currentTemplatePath, activeTemplate)}
                />
                <TreeSelectButton
                  selected={templateSelected}
                  label={template.name}
                  description={template.urlPattern}
                  meta={template.publicationState === 'published' ? 'Published' : 'Unpublished'}
                  icon={templateOpen ? FolderOpen : Folder}
                  treePath={currentTemplatePath}
                  onClick={() => {
                    revealTemplate(template.slug);
                    onSelectTemplate(template.slug);
                  }}
                />
              </CompactTreeRow>

              {templateOpen ? (
                <CompactTreeChildren id={templateChildrenId} label={`${template.name} content`}>
                  <li>
                    <CompactTreeRow activeAncestor={activeTemplate && selection.kind === 'page'}>
                      <CompactTreeDisclosure
                        expanded={pagesOpen}
                        label={`${template.name} pages`}
                        controls={pagesChildrenId}
                        onClick={() => toggle(currentPagesPath, activeTemplate)}
                      />
                      <TreeSelectButton
                        selected={pagesSelected}
                        label="Pages"
                        meta={template.pageCount.toLocaleString()}
                        icon={pagesOpen ? FolderOpen : Folder}
                        treePath={currentPagesPath}
                        onClick={() => {
                          revealTemplate(template.slug, 'pages');
                          onSelectCollection(template.slug, 'pages');
                        }}
                      />
                    </CompactTreeRow>
                    {pagesOpen ? (
                      <CompactTreeChildren
                        id={pagesChildrenId}
                        label={`${template.name} canonical pages`}
                      >
                        {activeTemplate ? (
                          treePages.length > 0 ? (
                            treePages.map((page) => {
                              const selected =
                                selection.kind === 'page' && selection.page.id === page.id;
                              return (
                                <li key={page.id}>
                                  <TreeLeafRow>
                                    <TreeSelectButton
                                      selected={selected}
                                      label={page.canonicalUrl}
                                      meta={page.routeStatus.replace('_', ' ')}
                                      icon={FileText}
                                      treePath={contentExplorerTreePath(
                                        template.slug,
                                        'page',
                                        page.canonicalUrl
                                      )}
                                      className="font-mono font-normal"
                                      onClick={() => onSelectPage(page)}
                                    />
                                  </TreeLeafRow>
                                </li>
                              );
                            })
                          ) : (
                            <li className="px-2 py-2 text-[10px] leading-4 text-ink-faint">
                              No pages match “{search.q}”.
                            </li>
                          )
                        ) : (
                          <li className="px-2 py-2 text-[10px] leading-4 text-ink-faint">
                            Select this template to load its bounded page list.
                          </li>
                        )}
                      </CompactTreeChildren>
                    ) : null}
                  </li>

                  <li>
                    <CompactTreeRow
                      activeAncestor={activeTemplate && selection.kind === 'selector'}
                    >
                      <CompactTreeDisclosure
                        expanded={selectorsOpen}
                        label={`${template.name} selectors`}
                        controls={selectorsChildrenId}
                        onClick={() => toggle(currentSelectorsPath, activeTemplate)}
                      />
                      <TreeSelectButton
                        selected={selectorsSelected}
                        label="Selectors"
                        meta={
                          activeTemplate
                            ? snapshot.selectors.length.toLocaleString()
                            : (
                                template.activeVariantCount +
                                template.draftVariantCount +
                                1
                              ).toLocaleString()
                        }
                        icon={selectorsOpen ? FolderOpen : Folder}
                        treePath={currentSelectorsPath}
                        onClick={() => {
                          revealTemplate(template.slug, 'selectors');
                          onSelectCollection(template.slug, 'selectors');
                        }}
                      />
                    </CompactTreeRow>
                    {selectorsOpen ? (
                      <CompactTreeChildren
                        id={selectorsChildrenId}
                        label={`${template.name} template selectors`}
                      >
                        {activeTemplate ? (
                          snapshot.selectors.map((selector) => {
                            const selected =
                              selection.kind === 'selector' &&
                              selection.selector.id === selector.id;
                            return (
                              <li key={selector.id}>
                                <TreeLeafRow>
                                  <TreeSelectButton
                                    selected={selected}
                                    label={selector.name}
                                    description={
                                      selector.isDefault
                                        ? 'Template default'
                                        : `Priority ${selector.priority}`
                                    }
                                    meta={selector.status}
                                    icon={selector.isDefault ? Layers3 : GitBranch}
                                    treePath={contentExplorerTreePath(
                                      template.slug,
                                      'selector',
                                      selector.id
                                    )}
                                    onClick={() => onSelectSelector(selector)}
                                  />
                                </TreeLeafRow>
                              </li>
                            );
                          })
                        ) : (
                          <li className="px-2 py-2 text-[10px] leading-4 text-ink-faint">
                            Select this template to load selector scopes.
                          </li>
                        )}
                      </CompactTreeChildren>
                    ) : null}
                  </li>
                </CompactTreeChildren>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MetadataGrid({
  items,
}: Readonly<{
  items: readonly { label: string; value: string; mono?: boolean }[];
}>) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 bg-canvas p-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {item.label}
          </dt>
          <dd
            className={cn(
              'mt-1 truncate text-xs font-medium text-ink',
              item.mono && 'font-mono text-[11px] font-normal'
            )}
            title={item.value}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function InspectorHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  badges,
  actions,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  icon: typeof Folder;
  badges?: ReactNode;
  actions?: ReactNode;
}>) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
          <Icon aria-hidden="true" className="size-3.5" />
          {eyebrow}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2
            id="content-inspector-heading"
            className="min-w-0 truncate text-xl font-semibold tracking-[-0.025em] text-ink"
          >
            {title}
          </h2>
          {badges}
        </div>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-muted">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

function TemplateInspector({
  template,
  previewCanonicalUrl,
}: Readonly<{
  template: ContentTemplateSummary;
  previewCanonicalUrl: string;
}>) {
  return (
    <div className="space-y-5">
      <InspectorHeader
        eyebrow="Template"
        title={template.name}
        description={
          template.description || 'Template-owned pages, selectors, and publication state.'
        }
        icon={FolderOpen}
        badges={
          <>
            <Badge tone={template.status === 'active' ? 'success' : 'neutral'} dot>
              {template.status}
            </Badge>
            <Badge tone={template.draftState === 'changes' ? 'warning' : 'neutral'}>
              {draftLabel(template.draftState)}
            </Badge>
          </>
        }
        actions={
          <>
            <Link
              to="/publications/$templateId"
              params={{ templateId: template.slug }}
              className={secondaryActionClassName}
            >
              <Database aria-hidden="true" className="size-3.5" /> Publications
            </Link>
            <Link
              to="/author/$templateId"
              params={{ templateId: template.slug }}
              search={previewCanonicalUrl ? { canonicalUrl: previewCanonicalUrl } : {}}
              className={primaryActionClassName}
            >
              Open template workspace
            </Link>
          </>
        }
      />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          Canonical route grammar
        </p>
        <p className="mt-1 font-mono text-xs text-ink-muted">
          {template.domain}
          {template.urlPattern}
        </p>
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label={`${template.name} URL grammar`}>
          {template.grammar.map((segment) => (
            <li
              key={segment.key}
              className={cn(
                'rounded-md border px-2 py-1 font-mono text-[10px]',
                segment.kind === 'variable'
                  ? 'border-accent/25 bg-accent-soft text-accent-strong'
                  : 'border-line bg-surface-muted text-ink-muted'
              )}
            >
              {segment.value}
            </li>
          ))}
        </ol>
      </div>

      <MetadataGrid
        items={[
          { label: 'Pages', value: template.pageCount.toLocaleString() },
          { label: 'Live routes', value: template.livePageCount.toLocaleString() },
          { label: 'Variants', value: template.variantCount.toLocaleString() },
          { label: 'Published pages', value: template.publishedPageCount.toLocaleString() },
          { label: 'Publication', value: template.publicationState },
          { label: 'Active selectors', value: template.activeVariantCount.toLocaleString() },
          { label: 'Draft selectors', value: template.draftVariantCount.toLocaleString() },
          { label: 'Updated', value: formatTimestamp(template.updatedAt) },
        ]}
      />
    </div>
  );
}

function PagesInspector({
  snapshot,
  template,
  previewCanonicalUrl,
  onPageChange,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  template: ContentTemplateSummary;
  previewCanonicalUrl: string;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  return (
    <div className="space-y-5">
      <InspectorHeader
        eyebrow="Template collection"
        title="Pages"
        description={`Concrete canonical pages owned by ${template.name}. Folder hierarchy describes route shape, never content inheritance.`}
        icon={FolderOpen}
        badges={<Badge tone="info">{template.pageCount.toLocaleString()} total</Badge>}
        actions={
          previewCanonicalUrl ? (
            <Link
              to="/author/$templateId"
              params={{ templateId: template.slug }}
              search={{ canonicalUrl: previewCanonicalUrl }}
              className={primaryActionClassName}
            >
              Open selected page
            </Link>
          ) : null
        }
      />
      <TemplatePageNavigator
        navigation={snapshot.pageNavigation}
        canonicalUrl={previewCanonicalUrl}
        onPageChange={onPageChange}
      />
      <MetadataGrid
        items={[
          { label: 'Matching search', value: snapshot.filteredCount.toLocaleString() },
          { label: 'Loaded rows', value: snapshot.pages.length.toLocaleString() },
          { label: 'Live routes', value: template.livePageCount.toLocaleString() },
          { label: 'Not live', value: template.notLivePageCount.toLocaleString() },
          { label: 'Archived', value: template.archivedPageCount.toLocaleString() },
          { label: 'Published pages', value: template.publishedPageCount.toLocaleString() },
          { label: 'Draft state', value: draftLabel(template.draftState) },
          {
            label: 'Path choices',
            value: snapshot.pageNavigation.truncated
              ? `${snapshot.pageNavigation.options.length.toLocaleString()} of ${snapshot.pageNavigation.totalCount.toLocaleString()}`
              : snapshot.pageNavigation.totalCount.toLocaleString(),
          },
        ]}
      />
    </div>
  );
}

function PageInspector({
  snapshot,
  template,
  page,
  onPageChange,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  template: ContentTemplateSummary;
  page: ContentExplorerPage;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  return (
    <div className="space-y-5">
      <InspectorHeader
        eyebrow="Canonical page"
        title={page.canonicalUrl}
        description="One persisted route instance with template-wide selector context and an immutable publication result."
        icon={FileText}
        badges={
          <>
            <Badge tone={routeTone(page.routeStatus)} dot>
              {page.routeStatus.replace('_', ' ')}
            </Badge>
            <Badge tone={page.publicationState === 'published' ? 'success' : 'warning'}>
              {page.publicationState === 'published' ? 'Published' : 'Not published'}
            </Badge>
          </>
        }
        actions={
          <Link
            to="/author/$templateId"
            params={{ templateId: template.slug }}
            search={{ canonicalUrl: page.canonicalUrl }}
            className={primaryActionClassName}
          >
            Open studio
          </Link>
        }
      />
      <TemplatePageNavigator
        navigation={snapshot.pageNavigation}
        canonicalUrl={page.canonicalUrl}
        onPageChange={onPageChange}
      />
      <MetadataGrid
        items={[
          { label: 'Route', value: page.routeStatus.replace('_', ' ') },
          { label: 'Draft', value: draftLabel(template.draftState) },
          {
            label: 'Publication',
            value: page.publicationState === 'published' ? 'Published' : 'Not published',
          },
          { label: 'Last modified', value: formatTimestamp(page.updatedAt) },
          { label: 'Route revision', value: page.routeRevision, mono: true },
          { label: 'Template', value: template.name },
          { label: 'Page ID', value: page.id, mono: true },
          {
            label: 'Document hash',
            value: page.documentHash ?? 'No materialized document',
            mono: true,
          },
        ]}
      />
    </div>
  );
}

function SelectorsInspector({
  snapshot,
  template,
  previewCanonicalUrl,
  onPageChange,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  template: ContentTemplateSummary;
  previewCanonicalUrl: string;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  const activeCount = snapshot.selectors.filter((selector) => selector.status === 'active').length;
  const draftCount = snapshot.selectors.length - activeCount;
  return (
    <div className="space-y-5">
      <InspectorHeader
        eyebrow="Template collection"
        title="Selectors"
        description={`Template-wide page sets for ${template.name}. Choose a scope in the tree to inspect its authored predicate and impact.`}
        icon={FolderOpen}
        badges={<Badge tone="info">{snapshot.selectors.length} scopes</Badge>}
      />
      <TemplatePageNavigator
        navigation={snapshot.pageNavigation}
        canonicalUrl={previewCanonicalUrl}
        onPageChange={onPageChange}
      />
      <MetadataGrid
        items={[
          { label: 'Scopes', value: snapshot.selectors.length.toLocaleString() },
          { label: 'Active', value: activeCount.toLocaleString() },
          { label: 'Draft', value: draftCount.toLocaleString() },
          { label: 'Preview page', value: previewCanonicalUrl || 'No concrete page', mono: true },
        ]}
      />
      <div className="rounded-lg border border-dashed border-line bg-surface-muted/35 p-4 text-xs leading-5 text-ink-muted">
        Select a scope from the tree. Its matching page count, affected placements, sample URLs,
        priority, and authored selector will appear here.
      </div>
    </div>
  );
}

function SelectorInspector({
  snapshot,
  template,
  selector,
  previewCanonicalUrl,
  search,
  onPageChange,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  template: ContentTemplateSummary;
  selector: ContentSelectorSummary;
  previewCanonicalUrl: string;
  search: ContentExplorerSearch;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  const firstMatch = selector.sampleCanonicalUrls[0];
  const selectorCanonicalUrl = previewCanonicalUrl || firstMatch || '';
  return (
    <div className="space-y-5">
      <InspectorHeader
        eyebrow="Template selector"
        title={selector.name}
        description="A template-scoped page set with sparse block operations and explicit precedence."
        icon={selector.isDefault ? Layers3 : GitBranch}
        badges={
          <>
            <Badge tone={selector.isDefault ? 'neutral' : 'info'}>
              {selector.isDefault ? 'Template default' : `P${selector.priority}`}
            </Badge>
            <Badge tone={selector.status === 'active' ? 'success' : 'warning'} dot>
              {selector.status}
            </Badge>
            {selector.selectedPageMatches === null ? null : (
              <Badge tone={selector.selectedPageMatches ? 'success' : 'neutral'}>
                {selector.selectedPageMatches ? 'Matches preview' : 'Does not match preview'}
              </Badge>
            )}
          </>
        }
        actions={
          selectorCanonicalUrl ? (
            <Link
              to="/author/$templateId"
              params={{ templateId: template.slug }}
              search={{
                canonicalUrl: selectorCanonicalUrl,
                scopeId: selector.id,
                panel: 'cascade',
              }}
              className={primaryActionClassName}
            >
              <GitBranch aria-hidden="true" className="size-3.5" /> View selector
            </Link>
          ) : null
        }
      />
      <TemplatePageNavigator
        navigation={snapshot.pageNavigation}
        canonicalUrl={previewCanonicalUrl}
        onPageChange={onPageChange}
      />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
          Authored predicate
        </p>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-ink px-3 py-2.5 font-mono text-[11px] leading-5 text-canvas">
          {selector.selector}
        </code>
      </div>

      <MetadataGrid
        items={[
          {
            label: 'Matching pages',
            value: selector.exactMatchCount?.toLocaleString() ?? 'Calculating',
          },
          { label: 'Local placements', value: selector.affectedPlacementCount.toLocaleString() },
          { label: 'Priority', value: selector.priority.toLocaleString() },
          { label: 'Status', value: selector.status },
        ]}
      />

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
            Sample matching pages
          </p>
          {selector.sampleUrlsTruncated ? (
            <span className="text-[10px] text-ink-faint">
              First {selector.sampleCanonicalUrls.length} shown
            </span>
          ) : null}
        </div>
        {!selector.metricsLoaded ? (
          <p className="mt-2 rounded-lg border border-dashed border-line bg-surface-muted/35 p-3 text-xs text-ink-muted">
            Calculating selector impact for this preview context.
          </p>
        ) : selector.sampleCanonicalUrls.length > 0 ? (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line">
            {selector.sampleCanonicalUrls.map((canonicalUrl) => (
              <li key={canonicalUrl}>
                <Link
                  to="/content"
                  search={{
                    ...search,
                    view: 'tree',
                    canonicalUrl,
                    focus: contentSelectorFocus(selector.id),
                    cursor: undefined,
                  }}
                  className="flex min-h-9 items-center gap-2 bg-canvas px-3 font-mono text-[10px] text-ink-muted outline-none transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <FileText aria-hidden="true" className="size-3.5 shrink-0 text-ink-faint" />
                  <span className="truncate">{canonicalUrl}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-warning/35 bg-warning-soft p-3 text-xs text-warning-strong">
            This selector currently matches no pages.
          </p>
        )}
      </div>

      {firstMatch && firstMatch !== previewCanonicalUrl ? (
        <Link
          to="/content"
          search={{
            ...search,
            view: 'tree',
            canonicalUrl: firstMatch,
            focus: contentSelectorFocus(selector.id),
            cursor: undefined,
          }}
          className={secondaryActionClassName}
        >
          Preview first match
        </Link>
      ) : null}
    </div>
  );
}

function ExplorerInspector({
  snapshot,
  search,
  selection,
  template,
  previewCanonicalUrl,
  onPageChange,
  onPreviewPageChange,
}: Readonly<{
  snapshot: ContentExplorerProps['snapshot'];
  search: ContentExplorerSearch;
  selection: ExplorerSelection;
  template: ContentTemplateSummary;
  previewCanonicalUrl: string;
  onPageChange: (page: ContentPageNavigationOption) => void;
  onPreviewPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  if (selection.kind === 'page') {
    return (
      <PageInspector
        snapshot={snapshot}
        template={template}
        page={selection.page}
        onPageChange={onPageChange}
      />
    );
  }
  if (selection.kind === 'selector') {
    return (
      <SelectorInspector
        snapshot={snapshot}
        template={template}
        selector={selection.selector}
        previewCanonicalUrl={previewCanonicalUrl}
        search={search}
        onPageChange={onPreviewPageChange}
      />
    );
  }
  if (selection.kind === 'pages') {
    return (
      <PagesInspector
        snapshot={snapshot}
        template={template}
        previewCanonicalUrl={previewCanonicalUrl}
        onPageChange={onPageChange}
      />
    );
  }
  if (selection.kind === 'selectors') {
    return (
      <SelectorsInspector
        snapshot={snapshot}
        template={template}
        previewCanonicalUrl={previewCanonicalUrl}
        onPageChange={onPreviewPageChange}
      />
    );
  }
  return <TemplateInspector template={template} previewCanonicalUrl={previewCanonicalUrl} />;
}

function TreePagination({
  search,
  previousCursor,
  nextCursor,
  visibleCount,
  totalCount,
}: Readonly<{
  search: ContentExplorerSearch;
  previousCursor: string | null;
  nextCursor: string | null;
  visibleCount: number;
  totalCount: number;
}>) {
  return (
    <nav aria-label="Canonical page pagination" className="border-t border-line p-3">
      <p className="text-[10px] text-ink-muted" aria-live="polite">
        {visibleCount.toLocaleString()} loaded · {totalCount.toLocaleString()} matching
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {previousCursor ? (
          <Link
            to="/content"
            search={{ ...search, cursor: previousCursor }}
            className={cn(secondaryActionClassName, 'justify-center px-2')}
          >
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface-muted px-2 text-xs font-medium text-ink-faint"
          >
            Previous
          </span>
        )}
        {nextCursor ? (
          <Link
            to="/content"
            search={{ ...search, cursor: nextCursor }}
            className={cn(secondaryActionClassName, 'justify-center px-2')}
          >
            Next
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface-muted px-2 text-xs font-medium text-ink-faint"
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

export function ContentExplorer({ snapshot, search }: Readonly<ContentExplorerProps>) {
  const navigate = useNavigate({ from: '/content' });
  const template = selectedTemplate(snapshot.templates, snapshot.selectedTemplate);
  const selection = resolveExplorerSelection(search, snapshot);
  const previewCanonicalUrl =
    snapshot.pageNavigation.selectedPage?.canonicalUrl ??
    snapshot.pageNavigation.defaultPage?.canonicalUrl ??
    snapshot.pageNavigation.options[0]?.canonicalUrl ??
    '';

  function navigateToSearch(nextSearch: ContentExplorerSearch, replace = false) {
    void navigate({ replace, search: ContentExplorerSearchSchema.parse(nextSearch) });
  }

  function selectTemplate(templateSlug: FixedTemplateSlug) {
    navigateToSearch({
      view: 'tree',
      template: templateSlug,
      q: '',
      focus: 'template',
      canonicalUrl: undefined,
      cursor: undefined,
    });
  }

  function selectCollection(templateSlug: FixedTemplateSlug, collection: 'pages' | 'selectors') {
    navigateToSearch({
      view: 'tree',
      template: templateSlug,
      q: templateSlug === search.template ? search.q : '',
      focus: collection,
      canonicalUrl: templateSlug === search.template ? previewCanonicalUrl || undefined : undefined,
      cursor: undefined,
    });
  }

  function selectPage(page: ContentExplorerPage | ContentPageNavigationOption) {
    navigateToSearch(
      {
        ...search,
        view: 'tree',
        canonicalUrl: page.canonicalUrl,
        focus: 'page',
        cursor: undefined,
      },
      true
    );
  }

  function selectSelector(selector: ContentSelectorSummary) {
    navigateToSearch(
      {
        ...search,
        view: 'tree',
        canonicalUrl: previewCanonicalUrl || undefined,
        focus: contentSelectorFocus(selector.id),
        cursor: undefined,
      },
      true
    );
  }

  function selectPreviewPage(page: ContentPageNavigationOption) {
    const focus =
      selection.kind === 'selector'
        ? contentSelectorFocus(selection.selector.id)
        : selection.kind === 'selectors'
          ? 'selectors'
          : search.focus;
    navigateToSearch(
      {
        ...search,
        view: 'tree',
        canonicalUrl: page.canonicalUrl,
        focus,
        cursor: undefined,
      },
      true
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1480px] space-y-4 p-4 sm:p-5 lg:p-6">
      <header>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
          SQLite content
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink">
          Content explorer
        </h1>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-muted">
          Browse templates as folders, then inspect a concrete page or a template-wide selector in
          one workspace.
        </p>
      </header>

      <Card className="min-h-[calc(100vh-10.5rem)] overflow-hidden p-0">
        <div className="grid min-h-[calc(100vh-10.5rem)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside
            aria-label="Content explorer tree"
            className="flex h-[60vh] min-h-[420px] max-h-[560px] min-w-0 flex-col border-b border-line bg-surface-muted/35 xl:h-auto xl:max-h-[calc(100vh-10.5rem)] xl:border-b-0 xl:border-r"
          >
            <div className="border-b border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold text-ink">Workspace content</h2>
                  <p className="mt-0.5 text-[10px] text-ink-faint">3 templates · SQLite live</p>
                </div>
                <Badge tone="success" dot>
                  Live
                </Badge>
              </div>
              <search className="mt-3 block">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    navigateToSearch({
                      ...search,
                      view: 'tree',
                      q: String(formData.get('q') ?? ''),
                      focus: 'pages',
                      cursor: undefined,
                    });
                  }}
                >
                  <label htmlFor="content-search" className="sr-only">
                    Search canonical URLs in {template.name}
                  </label>
                  <div className="relative min-w-0 flex-1">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
                    />
                    <Input
                      key={`${snapshot.selectedTemplate}:${search.q}`}
                      id="content-search"
                      name="q"
                      type="search"
                      maxLength={120}
                      defaultValue={search.q}
                      placeholder={`Search ${template.name} pages`}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                  <Button type="submit" variant="outline" size="sm" className="h-8 px-2.5">
                    Search
                  </Button>
                </form>
              </search>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              <ExplorerTree
                snapshot={snapshot}
                search={search}
                selection={selection}
                onSelectTemplate={selectTemplate}
                onSelectCollection={selectCollection}
                onSelectPage={selectPage}
                onSelectSelector={selectSelector}
              />
            </div>

            <TreePagination
              search={search}
              previousCursor={snapshot.previousCursor}
              nextCursor={snapshot.nextCursor}
              visibleCount={snapshot.pages.length}
              totalCount={snapshot.filteredCount}
            />
          </aside>

          <section
            aria-labelledby="content-inspector-heading"
            aria-live="polite"
            aria-atomic="false"
            className="min-w-0 bg-canvas p-4 sm:p-5 lg:p-6"
          >
            <ExplorerInspector
              snapshot={snapshot}
              search={search}
              selection={selection}
              template={template}
              previewCanonicalUrl={previewCanonicalUrl}
              onPageChange={selectPage}
              onPreviewPageChange={selectPreviewPage}
            />
          </section>
        </div>
      </Card>
    </section>
  );
}
