import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { CanvasBlock, HiddenCanvasBlock } from '@/components/authoring/canvas-block';
import type { CmsWorkspacePlacement } from '@/data/sqlite-authoring';

function placement(inherited: boolean): CmsWorkspacePlacement {
  return {
    placementKey: 'primary-hero',
    order: 1,
    blockType: 'hero',
    blockVersionId: 'block-version-2',
    contentJson: '{"headline":"A local hero"}',
    renderedJson: '{"headline":"A local hero"}',
    sourceRevisionId: 'revision-2',
    sourcePriority: inherited ? 0 : 10,
    inherited,
    orderSourceRevisionId: 'order-revision-1',
    orderSourcePriority: 0,
    orderInherited: true,
    trace: [],
    lineageId: 'lineage-1',
    parentBlockVersionId: 'block-version-1',
    versionNumber: 2,
    schemaVersion: 1,
    contentHash: 'hash-2',
    createdBy: 'test',
    createdAt: '2026-08-30T00:00:00.000Z',
    publishedBlockVersionId: 'block-version-1',
    draftDifference: 'changed',
    versionHistory: [],
    fieldInspections: [],
  };
}

const callbacks = {
  onSelect: () => undefined,
  onAdd: () => undefined,
  onMove: () => undefined,
  onToggleVisibility: () => undefined,
  onRevert: () => undefined,
};

const page = {
  scenarioId: 'stores' as const,
  canonicalUrl: '/en-US/store/1001',
  renderMode: 'preview' as const,
  interactionMode: 'static' as const,
};

describe('CanvasBlock', () => {
  test('exposes the complete canvas-native structure controls without a trash affordance', () => {
    const markup = renderToStaticMarkup(
      <CanvasBlock
        page={page}
        placement={placement(false)}
        selected={false}
        disabled={false}
        index={1}
        count={4}
        isDefault={false}
        {...callbacks}
      />
    );

    expect(markup).toContain('Local');
    expect(markup).toContain('class="site-hero site-hero--stores"');
    expect(markup).toContain('A local hero');
    expect(markup).not.toContain('inert=""');
    expect(markup).not.toContain('<a');
    expect(markup).not.toContain('href=');
    expect(markup).not.toContain('Evaluated for the selected canonical page context.');
    expect(markup).toContain('aria-label="Add block above primary-hero"');
    expect(markup).toContain('aria-label="Add block below primary-hero"');
    expect(markup).toContain('aria-label="Move primary-hero up"');
    expect(markup).toContain('aria-label="Move primary-hero down"');
    expect(markup).toContain('aria-label="Revert local operation for primary-hero"');
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('aria-label="Hide primary-hero"');
    expect(markup).not.toContain('Trash');
    expect(markup).not.toContain('Delete primary-hero');
  });

  test('keeps inherited provenance visible and omits an invalid local revert action', () => {
    const markup = renderToStaticMarkup(
      <CanvasBlock
        page={page}
        placement={placement(true)}
        selected
        disabled={false}
        index={1}
        count={4}
        isDefault={false}
        {...callbacks}
      />
    );

    expect(markup).toContain('Inherited');
    expect(markup).not.toContain('Revert local operation for primary-hero');
  });

  test('renders a hidden placement in situ with a switch that restores inheritance', () => {
    const markup = renderToStaticMarkup(
      <HiddenCanvasBlock
        tombstone={{
          placementKey: 'primary-hero',
          sourceRevisionId: 'revision-3',
          sourcePriority: 10,
          trace: [],
          hiddenPlacement: {
            order: 1,
            blockType: 'hero',
            blockVersionId: 'block-version-1',
            contentJson: '{"headline":"Inherited hero"}',
          },
        }}
        disabled={false}
        onRestore={() => undefined}
      />
    );

    expect(markup).toContain('Local');
    expect(markup).toContain('Hidden');
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="false"');
    expect(markup).toContain('aria-label="Show primary-hero"');
    expect(markup).toContain('class="group relative z-30 h-9 overflow-visible"');
  });
});
