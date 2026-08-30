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
  onClearSelector: () => undefined,
};

describe('AUT-550 AuthoringScopeControl', () => {
  test('keeps default scope free of redundant selector actions', () => {
    const markup = renderToStaticMarkup(
      <AuthoringScopeControl
        variants={variants}
        selectedScopeId="default-scope"
        disabled={false}
        {...callbacks}
      />
    );

    expect(markup).toContain('data-scope-kind="default"');
    expect(markup).toContain('template default');
    expect(markup).not.toContain('View selector');
    expect(markup).not.toContain('Clear Default');
  });

  test('groups a mini primary selector action and accessible clear action with a selected variant', () => {
    const markup = renderToStaticMarkup(
      <AuthoringScopeControl
        variants={variants}
        selectedScopeId="fast-food-scope"
        disabled={false}
        {...callbacks}
      />
    );

    expect(markup).toContain('data-scope-kind="selector"');
    expect(markup).toContain('View selector');
    expect(markup).toContain('aria-label="Clear Fast food and return to template default"');
    expect(markup).not.toContain('aria-pressed');
  });
});
