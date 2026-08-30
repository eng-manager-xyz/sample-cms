import { LockKeyhole, MapPin } from 'lucide-react';
import { useId } from 'react';

import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import type { ContentPageNavigation, ContentPageNavigationOption } from '@/data/content-explorer';

function initialPage(
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

export function TemplatePageNavigator({
  navigation,
  canonicalUrl,
  disabled = false,
  onPageChange,
}: Readonly<{
  navigation: ContentPageNavigation;
  canonicalUrl?: string;
  disabled?: boolean;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  const idPrefix = useId();
  const headingId = `${idPrefix}-template-page-navigator-heading`;
  const selectedPage = initialPage(navigation, canonicalUrl);

  if (!selectedPage) {
    return (
      <section className="rounded-lg border border-dashed border-line p-3 text-xs text-ink-muted">
        This template has no concrete preview pages.
      </section>
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

      <ol className="mt-3 flex flex-wrap items-end gap-2" aria-label="Ordered URL segments">
        {navigation.segments.map((segment) => {
          const selectedValue = selectedPage.slotValues[segment.key] ?? '';
          if (segment.kind === 'static') {
            return (
              <li key={segment.slotId} className="min-w-28">
                <span className="mb-1 block text-[10px] font-medium text-ink-faint">
                  {segment.label}
                </span>
                <span className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 font-mono text-xs text-ink-muted">
                  <LockKeyhole aria-hidden="true" className="size-3 shrink-0" />
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
            <li key={segment.slotId} className="min-w-36 flex-1 sm:max-w-56">
              <label
                className="mb-1 block text-[10px] font-medium text-ink-faint"
                htmlFor={`${idPrefix}-page-segment-${segment.slotId}`}
              >
                {segment.label}
              </label>
              <Select
                id={`${idPrefix}-page-segment-${segment.slotId}`}
                value={selectedValue}
                disabled={disabled}
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
