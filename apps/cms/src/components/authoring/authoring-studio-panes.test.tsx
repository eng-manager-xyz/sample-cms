import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { AuthoringCanvasPane } from '@/components/authoring/authoring-studio-panes';
import type { CmsWorkspacePlacement, CmsWorkspaceSnapshot } from '@/data/sqlite-authoring';

const hero: CmsWorkspacePlacement = {
  placementKey: 'primary-hero',
  order: 0,
  blockType: 'hero',
  blockVersionId: 'block-version-1',
  contentJson: '{"headline":"A shared renderer hero"}',
  renderedJson: '{"headline":"A shared renderer hero"}',
  sourceRevisionId: 'default-revision-1',
  sourcePriority: 0,
  inherited: false,
  orderSourceRevisionId: 'default-revision-1',
  orderSourcePriority: 0,
  orderInherited: false,
  trace: [],
  lineageId: 'lineage-1',
  parentBlockVersionId: null,
  versionNumber: 1,
  schemaVersion: 1,
  contentHash: 'hash-1',
  createdBy: 'test',
  createdAt: '2026-08-30T00:00:00.000Z',
  publishedBlockVersionId: 'block-version-1',
  draftDifference: 'same',
  versionHistory: [],
  fieldInspections: [],
};

const workspace: CmsWorkspaceSnapshot = {
  scenarioId: 'stores',
  templateId: 'stores-template',
  templateName: 'Store',
  pageId: 'store-1001',
  canonicalUrl: '/en-US/store/1001',
  scopeId: 'default-variant',
  scopeMatchesSamplePage: true,
  variants: [
    {
      id: 'default-variant',
      name: 'Default',
      priority: 0,
      isDefault: true,
      status: 'active',
      selector: 'true',
      activeRevisionId: 'default-revision-1',
      matchesSamplePage: true,
      affectedPlacementCount: 1,
    },
  ],
  selectorFields: [],
  blockTypes: [],
  placements: [hero],
  tombstones: [],
  matchedVariantRevisionIds: ['default-revision-1'],
  resolutionStatus: 'resolved',
  resolutionConflicts: [],
  publicationBlocked: false,
  currentPublicationId: 'publication-1',
  currentDocumentHash: 'document-hash-1',
  rollbackPublicationId: null,
  publicationCount: 1,
};

describe('AuthoringCanvasPane', () => {
  test('renders the shared website surface without explanatory card chrome', () => {
    const markup = renderToStaticMarkup(
      <AuthoringCanvasPane
        scenarioId="stores"
        workspace={workspace}
        selectedPlacementKey="primary-hero"
        addingBlock={false}
        actionsDisabled={false}
        onStartAdd={() => undefined}
        onSelectPlacement={() => undefined}
        runPlacementCommand={() => undefined}
      />
    );

    expect(markup).toContain('aria-label="Authoring document canvas"');
    expect(markup).toContain('cms-rendered-page');
    expect(markup).toContain('class="site-hero site-hero--stores"');
    expect(markup).toContain('A shared renderer hero');
    expect(markup).not.toContain('<a');
    expect(markup).toContain('Local');
    expect(markup).not.toContain('<main');
    expect(markup).not.toContain('Selected scope projection');
    expect(markup).not.toContain('Serving pointer');
  });
});
