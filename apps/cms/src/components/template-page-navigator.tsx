import { LockKeyhole, MapPin, RotateCcw } from 'lucide-react';
import { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import type { ContentPageNavigation, ContentPageNavigationOption } from '@/data/content-explorer';
import { cn } from '@/lib/cn';

export function pageForNavigation(
  navigation: ContentPageNavigation,
  canonicalUrl: string | undefined
): ContentPageNavigationOption | null {
  return (
    navigation.options.find((option) => option.canonicalUrl === canonicalUrl) ??
    navigation.selectedPage ??
    navigation.defaultPage ??
    navigation.options[0] ??
    null
  );
}

function matchingPrefix(
  option: ContentPageNavigationOption,
  selectedPage: ContentPageNavigationOption,
  navigation: ContentPageNavigation,
  beforePathPosition: number
): boolean {
  return navigation.segments
    .filter((segment) => segment.pathPosition < beforePathPosition)
    .every((segment) => option.slotValues[segment.key] === selectedPage.slotValues[segment.key]);
}

export function valuesForSegment(
  navigation: ContentPageNavigation,
  selectedPage: ContentPageNavigationOption,
  pathPosition: number,
  key: string
): readonly string[] {
  return [
    ...new Set(
      navigation.options
        .filter((option) => matchingPrefix(option, selectedPage, navigation, pathPosition))
        .flatMap((option) => {
          const value = option.slotValues[key];
          return value === undefined ? [] : [value];
        })
    ),
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function downstreamMatchScore(
  candidate: ContentPageNavigationOption,
  selectedPage: ContentPageNavigationOption,
  navigation: ContentPageNavigation,
  afterPathPosition: number
): number {
  return navigation.segments
    .filter((segment) => segment.pathPosition > afterPathPosition)
    .reduce(
      (score, segment) =>
        score +
        (candidate.slotValues[segment.key] === selectedPage.slotValues[segment.key] ? 1 : 0),
      0
    );
}

export function nextPageForSegment(
  navigation: ContentPageNavigation,
  selectedPage: ContentPageNavigationOption,
  pathPosition: number,
  key: string,
  value: string
): ContentPageNavigationOption | null {
  return (
    navigation.options
      .filter(
        (option) =>
          matchingPrefix(option, selectedPage, navigation, pathPosition) &&
          option.slotValues[key] === value
      )
      .sort(
        (left, right) =>
          downstreamMatchScore(right, selectedPage, navigation, pathPosition) -
            downstreamMatchScore(left, selectedPage, navigation, pathPosition) ||
          left.canonicalUrl.localeCompare(right.canonicalUrl)
      )[0] ?? null
  );
}

function TemplatePageSegmentControls({
  navigation,
  selectedPage,
  disabled,
  compact,
  idPrefix,
  onPageChange,
}: Readonly<{
  navigation: ContentPageNavigation;
  selectedPage: ContentPageNavigationOption;
  disabled: boolean;
  compact: boolean;
  idPrefix: string;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  return (
    <ol
      className={cn('flex items-end', compact ? 'shrink-0 gap-1' : 'mt-3 flex-wrap gap-2')}
      aria-label="Ordered URL segments"
      title={
        compact && navigation.truncated
          ? `Showing ${navigation.options.length.toLocaleString()} of ${navigation.totalCount.toLocaleString()} persisted pages. Use Content Explorer for other pages.`
          : undefined
      }
    >
      {navigation.segments.map((segment) => {
        const selectedValue = selectedPage.slotValues[segment.key] ?? '';
        if (segment.kind === 'static') {
          return (
            <li key={segment.slotId} className={compact ? 'shrink-0' : 'min-w-28'}>
              <span
                className={cn(
                  compact ? 'sr-only' : 'mb-1 block text-[10px] font-medium text-ink-faint'
                )}
              >
                {segment.label}
              </span>
              <span
                className={cn(
                  'flex items-center gap-2 border border-line bg-surface-muted font-mono text-ink-muted',
                  compact ? 'h-7 rounded-md px-2 text-[11px]' : 'h-9 rounded-lg px-3 text-xs'
                )}
                title={`${segment.label}: ${segment.staticValue ?? selectedValue}`}
              >
                <LockKeyhole
                  aria-hidden="true"
                  className={cn('shrink-0', compact ? 'size-2.5' : 'size-3')}
                />
                {segment.staticValue ?? selectedValue}
              </span>
            </li>
          );
        }
        const values = valuesForSegment(
          navigation,
          selectedPage,
          segment.pathPosition,
          segment.key
        );
        return (
          <li key={segment.slotId} className={compact ? 'shrink-0' : 'min-w-36 flex-1 sm:max-w-56'}>
            <label
              className={cn(
                compact ? 'sr-only' : 'mb-1 block text-[10px] font-medium text-ink-faint'
              )}
              htmlFor={`${idPrefix}-page-segment-${segment.slotId}`}
            >
              {segment.label}
            </label>
            <Select
              id={`${idPrefix}-page-segment-${segment.slotId}`}
              density={compact ? 'compact' : 'default'}
              className={compact ? 'w-auto min-w-20 max-w-40' : undefined}
              value={selectedValue}
              disabled={disabled}
              title={compact ? segment.label : undefined}
              onChange={(event) => {
                const nextPage = nextPageForSegment(
                  navigation,
                  selectedPage,
                  segment.pathPosition,
                  segment.key,
                  event.currentTarget.value
                );
                if (!nextPage) return;
                onPageChange(nextPage);
              }}
            >
              {values.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </li>
        );
      })}
    </ol>
  );
}

function DefaultPageButton({
  navigation,
  selectedPage,
  disabled,
  compact,
  onPageChange,
}: Readonly<{
  navigation: ContentPageNavigation;
  selectedPage: ContentPageNavigationOption;
  disabled: boolean;
  compact: boolean;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  const defaultPage = navigation.defaultPage;
  if (!defaultPage) return null;
  const isDefault = defaultPage.pageId === selectedPage.pageId;
  return (
    <button
      type="button"
      aria-label="Go to default preview page"
      title={isDefault ? 'This is the default preview page' : 'Go to default preview page'}
      disabled={disabled || isDefault}
      onClick={() => onPageChange(defaultPage)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-line-strong bg-canvas text-ink-muted outline-none transition-colors hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-default disabled:opacity-45',
        compact ? 'size-7' : 'h-9 px-3 text-xs font-medium'
      )}
    >
      <RotateCcw aria-hidden="true" className="size-3.5" />
      {compact ? <span className="sr-only">Default</span> : <span>Default</span>}
    </button>
  );
}

export function TemplatePageNavigator({
  navigation,
  canonicalUrl,
  disabled = false,
  variant = 'panel',
  onPageChange,
}: Readonly<{
  navigation: ContentPageNavigation;
  canonicalUrl?: string;
  disabled?: boolean;
  variant?: 'panel' | 'compact';
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  const idPrefix = useId();
  const headingId = `${idPrefix}-template-page-navigator-heading`;
  const selectedPage = pageForNavigation(navigation, canonicalUrl);

  if (!selectedPage) {
    return (
      <section
        className={cn(
          'text-ink-muted',
          variant === 'compact'
            ? 'shrink-0 text-[11px]'
            : 'rounded-lg border border-dashed border-line p-3 text-xs'
        )}
      >
        This template has no concrete preview pages.
      </section>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex shrink-0 items-end gap-1">
        <DefaultPageButton
          navigation={navigation}
          selectedPage={selectedPage}
          disabled={disabled}
          compact
          onPageChange={onPageChange}
        />
        <TemplatePageSegmentControls
          navigation={navigation}
          selectedPage={selectedPage}
          disabled={disabled}
          compact
          idPrefix={idPrefix}
          onPageChange={onPageChange}
        />
      </div>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-line bg-surface-muted/35 p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-3.5 text-accent-strong" />
            <h2
              id={headingId}
              className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint"
            >
              Preview page
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-ink-muted">
            Page context only. Template variations and their selectors remain template-wide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={selectedPage.routeStatus === 'live' ? 'success' : 'warning'} dot>
            {selectedPage.routeStatus.replace('_', ' ')}
          </Badge>
          <span
            aria-live="polite"
            aria-atomic="true"
            className="max-w-full truncate font-mono text-[10px] text-ink-muted"
          >
            {selectedPage.canonicalUrl}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <DefaultPageButton
          navigation={navigation}
          selectedPage={selectedPage}
          disabled={disabled}
          compact={false}
          onPageChange={onPageChange}
        />
        <TemplatePageSegmentControls
          navigation={navigation}
          selectedPage={selectedPage}
          disabled={disabled}
          compact={false}
          idPrefix={idPrefix}
          onPageChange={onPageChange}
        />
      </div>

      {navigation.truncated ? (
        <p className="mt-2 text-[10px] text-ink-faint">
          Showing a bounded set of {navigation.options.length.toLocaleString()} of{' '}
          {navigation.totalCount.toLocaleString()} pages. Use Content Explorer search for a page
          outside this set.
        </p>
      ) : null}
    </section>
  );
}
