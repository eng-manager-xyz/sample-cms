import { Check, Loader2, Tags } from 'lucide-react';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import type {
  ContentExplorerPage,
  ContentTemplateSummary,
  FixedTemplateSlug,
} from '@/data/content-explorer';
import { CONTENT_EXPLORER_TAG_SELECTION_LIMIT, parseTagValues } from '@/data/content-explorer';
import { mutateContentPageTags } from '@/server-functions/content.functions';

export function TemplatePageTagGrid({
  template,
  pages,
  onOpenPage,
  onChanged,
}: Readonly<{
  template: ContentTemplateSummary;
  pages: readonly ContentExplorerPage[];
  onOpenPage: (page: ContentExplorerPage) => void;
  onChanged: () => void | Promise<void>;
}>) {
  const [selectedPageIds, setSelectedPageIds] = useState<readonly string[]>([]);
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [tagInput, setTagInput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pathSlots = template.slots.filter((slot) => slot.pathPosition !== null);
  const allVisibleSelected =
    pages.length > 0 && pages.every((page) => selectedPageIds.includes(page.id));

  function togglePage(pageId: string) {
    setMessage(null);
    setSelectedPageIds((current) =>
      current.includes(pageId)
        ? current.filter((candidate) => candidate !== pageId)
        : current.length < CONTENT_EXPLORER_TAG_SELECTION_LIMIT
          ? [...current, pageId]
          : current
    );
  }

  function toggleVisiblePages() {
    setMessage(null);
    if (allVisibleSelected) {
      const visibleIds = new Set(pages.map((page) => page.id));
      setSelectedPageIds((current) => current.filter((pageId) => !visibleIds.has(pageId)));
      return;
    }
    setSelectedPageIds(pages.slice(0, CONTENT_EXPLORER_TAG_SELECTION_LIMIT).map((page) => page.id));
  }

  function applyTags() {
    const values = parseTagValues(tagInput);
    if (selectedPageIds.length === 0 || values.length === 0) {
      setMessage('Select at least one page and enter at least one tag value.');
      return;
    }
    startTransition(async () => {
      try {
        const result = await mutateContentPageTags({
          data: {
            template: template.slug as FixedTemplateSlug,
            pageIds: [...selectedPageIds],
            mode,
            values: [...values],
          },
        });
        const assignmentMessage = `${mode === 'add' ? 'Added' : 'Removed'} ${result.changedAssignmentCount.toLocaleString()} assignment${result.changedAssignmentCount === 1 ? '' : 's'}; ${result.unchangedAssignmentCount.toLocaleString()} already matched the requested state.`;
        const shownImpacts = result.selectorImpacts.slice(0, 3);
        const selectorMessage =
          shownImpacts.length === 0
            ? ' No active selectors use the requested tag values.'
            : ` Selector impact: ${shownImpacts
                .map(
                  (impact) =>
                    `${impact.selectorName} ${impact.beforeMatchCount.toLocaleString()}→${impact.afterMatchCount.toLocaleString()} pages (selected ${impact.beforeSelectedPageMatchCount.toLocaleString()}→${impact.afterSelectedPageMatchCount.toLocaleString()})`
                )
                .join('; ')}${
                result.selectorImpactTotalCount > shownImpacts.length
                  ? `; +${(
                      result.selectorImpactTotalCount - shownImpacts.length
                    ).toLocaleString()} more`
                  : ''
              }.`;
        setMessage(`${assignmentMessage}${selectorMessage}`);
        await onChanged();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The tag update could not be applied.');
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-canvas">
      <div className="border-b border-line bg-surface-muted/35 p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[9rem]">
            <label
              htmlFor="content-tag-mode"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
            >
              Bulk action
            </label>
            <Select
              id="content-tag-mode"
              value={mode}
              onChange={(event) => setMode(event.currentTarget.value as 'add' | 'remove')}
              className="w-full"
            >
              <option value="add">Add tags</option>
              <option value="remove">Remove tags</option>
            </Select>
          </div>
          <div className="min-w-[15rem] flex-1">
            <label
              htmlFor="content-tag-values"
              className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint"
            >
              tags values
            </label>
            <Input
              id="content-tag-values"
              value={tagInput}
              onChange={(event) => setTagInput(event.currentTarget.value)}
              placeholder="featured, summer_campaign"
              maxLength={2_000}
            />
          </div>
          <Button
            type="button"
            onClick={applyTags}
            disabled={isPending || selectedPageIds.length === 0}
          >
            {isPending ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Tags aria-hidden="true" className="size-3.5" />
            )}
            Apply to {selectedPageIds.length || 0}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-ink-muted">
          <span>
            The required <code className="font-mono text-ink">tags</code> dimension is queryable but
            never becomes part of the canonical URL.
          </span>
          <span>Up to {CONTENT_EXPLORER_TAG_SELECTION_LIMIT} pages per bounded command</span>
        </div>
        {message ? (
          <p className="mt-2 text-xs text-ink-muted" aria-live="polite">
            {message}
          </p>
        ) : null}
      </div>

      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-surface-muted text-[10px] uppercase tracking-[0.07em] text-ink-faint">
            <tr>
              <th scope="col" className="w-10 border-b border-line px-3 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisiblePages}
                  aria-label="Select all loaded pages"
                  className="size-3.5 rounded border-line-strong accent-accent"
                />
              </th>
              <th scope="col" className="border-b border-line px-3 py-2">
                Canonical URL
              </th>
              {pathSlots.map((slot) => (
                <th key={slot.id} scope="col" className="border-b border-line px-3 py-2">
                  {slot.label}
                </th>
              ))}
              <th scope="col" className="border-b border-line px-3 py-2">
                Status
              </th>
              <th scope="col" className="min-w-[15rem] border-b border-line px-3 py-2">
                Tags
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {pages.map((page) => {
              const selected = selectedPageIds.includes(page.id);
              return (
                <tr key={page.id} className={selected ? 'bg-accent-soft/55' : 'bg-canvas'}>
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePage(page.id)}
                      aria-label={`Select ${page.canonicalUrl}`}
                      className="size-3.5 rounded border-line-strong accent-accent"
                    />
                  </td>
                  <td className="max-w-[20rem] px-3 py-2 align-top">
                    <button
                      type="button"
                      onClick={() => onOpenPage(page)}
                      className="max-w-full truncate font-mono text-[11px] text-accent-strong underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    >
                      {page.canonicalUrl}
                    </button>
                  </td>
                  {pathSlots.map((slot) => (
                    <td
                      key={slot.id}
                      className="px-3 py-2 align-top font-mono text-[11px] text-ink-muted"
                    >
                      {page.slotValues[slot.key] ?? '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2 align-top">
                    <Badge
                      tone={
                        page.routeStatus === 'live'
                          ? 'success'
                          : page.routeStatus === 'not_live'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {page.routeStatus.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {page.tags.length > 0 ? (
                        page.tags.map((tag) =>
                          tag.namespace === 'tags' ? (
                            <button
                              key={tag.id}
                              type="button"
                              title={`Use ${tag.value} in the bulk editor`}
                              onClick={() => {
                                setMode('remove');
                                setTagInput(tag.value);
                              }}
                              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted px-2 py-0.5 text-[10px] text-ink-muted outline-none hover:border-line-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-focus"
                            >
                              <span className="font-mono text-ink-faint">{tag.namespace}:</span>
                              {tag.label}
                            </button>
                          ) : (
                            <span
                              key={tag.id}
                              title={`${tag.namespace} tags are read-only in this editor`}
                              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted px-2 py-0.5 text-[10px] text-ink-muted"
                            >
                              <span className="font-mono text-ink-faint">{tag.namespace}:</span>
                              {tag.label}
                            </span>
                          )
                        )
                      ) : (
                        <span className="text-[10px] text-ink-faint">No tags</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pages.length === 0 ? (
          <div className="grid min-h-28 place-items-center p-4 text-center text-xs text-ink-muted">
            No canonical pages match this search.
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-surface-muted/25 px-3 py-2 text-[10px] text-ink-muted">
        <Check aria-hidden="true" className="size-3.5 text-success" />
        {pages.length.toLocaleString()} bounded rows loaded from SQLite
      </div>
    </div>
  );
}
