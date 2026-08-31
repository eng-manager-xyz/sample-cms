import { describe, expect, test } from 'bun:test';

import {
  flattenSidebarNavigation,
  getContentExplorerNavigationSearch,
  isNavigationBranchActive,
  isNavigationItemUnavailable,
  sidebarNavigation,
} from '@/components/app-shell';

describe('AUT-552 sidebar navigation tree', () => {
  test('nests every destination once in the requested hierarchy', () => {
    expect(
      sidebarNavigation.map((branch) => ({
        label: branch.label,
        children: branch.children.map((item) => item.label),
      }))
    ).toEqual([
      { label: 'Tutorial', children: ['Wall of Maps'] },
      {
        label: 'Content explorer',
        children: ['Template workspace'],
      },
    ]);

    const flattenedSections = flattenSidebarNavigation().map((item) => item.section);
    expect(flattenedSections).toEqual(['tutorial', 'maps', 'content', 'template']);
    expect(new Set(flattenedSections).size).toBe(flattenedSections.length);
  });

  test('marks a branch active for itself or any nested destination', () => {
    const [tutorial, content] = sidebarNavigation;

    expect(isNavigationBranchActive(tutorial, 'tutorial')).toBe(true);
    expect(isNavigationBranchActive(tutorial, 'maps')).toBe(true);
    expect(isNavigationBranchActive(tutorial, 'content')).toBe(false);
    expect(isNavigationBranchActive(content, 'content')).toBe(true);
    expect(isNavigationBranchActive(content, 'template')).toBe(true);
    expect(isNavigationBranchActive(content, 'maps')).toBe(false);
  });

  test('keeps template destinations unavailable without context and preserves context when present', () => {
    const [, content] = sidebarNavigation;
    const [templateWorkspace] = content.children;

    expect(isNavigationItemUnavailable(templateWorkspace)).toBe(true);
    expect(isNavigationItemUnavailable(templateWorkspace, 'eligible-vehicles')).toBe(false);
    expect(isNavigationItemUnavailable(content, undefined)).toBe(false);

    expect(getContentExplorerNavigationSearch()).toEqual({
      view: 'tree',
      template: 'stores',
      q: '',
    });
    expect(getContentExplorerNavigationSearch('structural-proof')).toEqual({
      view: 'tree',
      template: 'structural-proof',
      q: '',
    });
  });
});
