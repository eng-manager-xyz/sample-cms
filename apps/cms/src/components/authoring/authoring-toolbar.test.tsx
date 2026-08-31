import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AuthoringToolbar } from '@/components/authoring/authoring-toolbar';
import { AUTHORING_BLOCK_FORM_ID } from '@/components/authoring/schema-block-form';
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
] satisfies readonly CmsWorkspaceVariant[];

const callbacks = {
  onSelectScope: () => undefined,
  onViewSelector: () => undefined,
  onCreateSelector: () => undefined,
  onClearSelector: () => undefined,
  onReviewPublication: () => undefined,
};

function renderToolbar(overrides: Partial<Parameters<typeof AuthoringToolbar>[0]> = {}): string {
  return renderToStaticMarkup(
    <AuthoringToolbar
      variants={variants}
      selectedScopeId="default-scope"
      scopeDisabled={false}
      lifecycleAnnouncement="Saved draft loaded."
      saveDisabled={false}
      savePending={false}
      saveTitle="Save the current block draft"
      previewHref="http://localhost:3001/cms-preview_/en-US/store/1001"
      previewUnavailableTitle="Preview is unavailable."
      reviewDisabled={false}
      reviewPending={false}
      reviewTitle="Compile a read-only preflight before confirming publication"
      publicationTriggerRef={null}
      {...callbacks}
      {...overrides}
    />
  );
}

function visibleText(markup: string): string {
  const withoutScreenReaderOnlyContent = markup.replace(
    /<([a-z][\w-]*)\b[^>]*class="[^"]*\bsr-only\b[^"]*"[^>]*>[\s\S]*?<\/\1>/g,
    ' '
  );
  return withoutScreenReaderOnlyContent
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('AUT-555 AuthoringToolbar', () => {
  test('groups the compact variation and accessible icon-only authoring actions', () => {
    const markup = renderToolbar();

    expect(markup).toContain('<fieldset');
    expect(markup).toContain('<legend class="sr-only">Template authoring actions</legend>');
    expect(markup).toContain('aria-label="Save block draft"');
    expect(markup).toContain('aria-label="Preview saved draft in a new tab"');
    expect(markup).toContain('aria-label="Review publication"');
    expect(markup).toContain(`form="${AUTHORING_BLOCK_FORM_ID}"`);
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('gap-0.5 sm:gap-1');
    expect(markup).toContain('size-7');
    expect(visibleText(markup)).not.toContain('Save');
    expect(visibleText(markup)).not.toContain('Preview saved draft');
    expect(visibleText(markup)).not.toContain('Review publish');
  });

  test('keeps available preview semantics on the icon link', () => {
    const markup = renderToolbar();

    expect(markup).toContain('href="http://localhost:3001/cms-preview_/en-US/store/1001"');
    expect(markup).toContain('target="_blank"');
    expect(markup).toContain('rel="noreferrer"');
    expect(markup).not.toContain('aria-label="Preview unavailable"');
  });

  test('renders an accessible disabled icon when preview is unavailable', () => {
    const markup = renderToolbar({ previewHref: undefined });

    expect(markup).toContain('aria-label="Preview unavailable"');
    expect(markup).toContain('title="Preview is unavailable."');
    expect(markup).toContain('<span class="inline-flex" title="Preview is unavailable.">');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('target="_blank"');
  });

  test('announces pending save and review actions without adding visible labels', () => {
    const markup = renderToolbar({ savePending: true, reviewPending: true });
    const busyAttributes = markup.match(/aria-busy="true"/g) ?? [];

    expect(busyAttributes).toHaveLength(2);
    expect(visibleText(markup)).toBe('P0 · Default · template default');
  });

  test('keeps disabled action reasons hoverable outside pointer-disabled buttons', () => {
    const markup = renderToolbar({
      saveDisabled: true,
      saveTitle: 'Select or add a block to save',
      reviewDisabled: true,
      reviewTitle: 'Save local form changes before publication review',
    });

    expect(markup).toContain(
      '<span class="inline-flex" title="Select or add a block to save"><button'
    );
    expect(markup).toContain(
      '<span class="inline-flex" title="Save local form changes before publication review"><button'
    );
    expect(markup.match(/disabled=""/g) ?? []).toHaveLength(2);
  });
});
