import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AuthoringScopeControl } from '@/components/authoring/authoring-scope-control';
import type { CmsWorkspaceVariant } from '@/data/sqlite-authoring';

const variants = [
  {
    id: 'default-scope',
    name: 'Default',
    priority: 0,
    isDefault: true,
    status: 'active',
    selector: 'TRUE',
    activeRevisionId: 'default-revision',
    matchesSamplePage: true,
    affectedPlacementCount: 4,
  },
  {
    id: 'fast-food-scope',
    name: 'Fast food',
    priority: 20,
    isDefault: false,
    status: 'active',
    selector: "category = 'fast_food'",
    activeRevisionId: 'fast-food-revision',
    matchesSamplePage: true,
    affectedPlacementCount: 2,
  },
] satisfies readonly CmsWorkspaceVariant[];

const callbacks = {
  onSelectScope: () => undefined,
  onViewSelector: () => undefined,
  onCreateSelector: () => undefined,
  onClearSelector: () => undefined,
};

describe('AUT-555 AuthoringScopeControl', () => {
  test('renders the default variation as a compact dropdown without redundant actions', () => {
    const markup = renderToStaticMarkup(
      <AuthoringScopeControl
        variants={variants}
        selectedScopeId="default-scope"
        disabled={false}
        {...callbacks}
      />
    );

    expect(markup).toContain('data-scope-kind="default"');
    expect(markup).toContain('class="sr-only" for="authoring-scope"');
    expect(markup).toContain('h-7 px-2 text-[11px]');
    expect(markup).toContain('w-24 shrink-0 font-medium sm:w-36 xl:w-44');
    expect(markup).toContain('template default');
    expect(markup).toContain('aria-label="Create selector variation"');
    expect(markup).not.toContain('aria-label="View selector');
    expect(markup).not.toContain('Clear Default');
  });

  test('groups icon-only selector and clear actions with a selected variant', () => {
    const markup = renderToStaticMarkup(
      <AuthoringScopeControl
        variants={variants}
        selectedScopeId="fast-food-scope"
        disabled={false}
        {...callbacks}
      />
    );

    expect(markup).toContain('data-scope-kind="selector"');
    expect(markup).toContain('aria-label="View selector for Fast food"');
    expect(markup).toContain('aria-label="Clear Fast food and return to template default"');
    expect(markup).not.toContain('>View selector<');
    expect(markup).not.toContain('aria-pressed');
  });
});
