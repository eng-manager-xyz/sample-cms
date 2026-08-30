import { describe, expect, test } from 'bun:test';
import {
  CanonicalUrlSchema,
  ContentExplorerInputSchema,
  ContentExplorerSearchSchema,
  canonicalUrlSegments,
  FixedTemplateSlugSchema,
  TemplateWorkspaceSearchSchema,
} from './content-explorer';

describe('AUT-540 content explorer schemas', () => {
  test('defaults to the Store tree without an unbounded cursor or query', () => {
    expect(ContentExplorerSearchSchema.parse({})).toEqual({
      view: 'tree',
      template: 'stores',
      q: '',
    });
  });

  test('allowlists exactly the three provisioned templates', () => {
    expect(FixedTemplateSlugSchema.options).toEqual([
      'stores',
      'eligible-vehicles',
      'structural-proof',
    ]);
    expect(FixedTemplateSlugSchema.safeParse('rogue-template').success).toBe(false);
  });

  test('bounds every server page read', () => {
    expect(
      ContentExplorerInputSchema.safeParse({ template: 'stores', q: '', limit: 50 }).success
    ).toBe(true);
    expect(
      ContentExplorerInputSchema.safeParse({ template: 'stores', q: '', limit: 51 }).success
    ).toBe(false);
  });

  test('validates canonical studio selection without query-string ambiguity', () => {
    expect(TemplateWorkspaceSearchSchema.parse({ canonicalUrl: '/en-US/store/1002' })).toEqual({
      canonicalUrl: '/en-US/store/1002',
    });
    expect(CanonicalUrlSchema.safeParse('en-US/store/1002').success).toBe(false);
    expect(CanonicalUrlSchema.safeParse('/en-US/store/1002?edit=true').success).toBe(false);
    expect(canonicalUrlSegments('/en-US/store/1002')).toEqual(['en-US', 'store', '1002']);
  });
});
