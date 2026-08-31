import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AuthoringCanvasPane,
  AuthoringInspectorPane,
} from '@/components/authoring/authoring-studio-panes';
import type {
  CmsWorkspaceBlockType,
  CmsWorkspacePlacement,
  CmsWorkspaceSnapshot,
} from '@/data/sqlite-authoring';

const heroBlockType: CmsWorkspaceBlockType = {
  key: 'hero',
  name: 'Hero',
  schemaVersion: 1,
  schemaJson: JSON.stringify({
    type: 'object',
    required: ['headline'],
    properties: {
      headline: {
        type: 'string',
        title: 'Headline',
        description: 'Primary page message',
      },
    },
  }),
  exampleContentJson: '{"headline":"Example hero"}',
};

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
  versionHistory: [
    {
      id: 'block-version-1',
      parentBlockVersionId: null,
      versionNumber: 1,
      blockType: 'hero',
      schemaVersion: 1,
      contentHash: 'hash-1',
      createdBy: 'test',
      createdAt: '2026-08-30T00:00:00.000Z',
    },
  ],
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
  blockTypes: [heroBlockType],
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

describe('AUT-556 AuthoringInspectorPane', () => {
  test('keeps Fields mounted behind an accessible collapsed desktop rail', () => {
    const markup = renderToStaticMarkup(
      <AuthoringInspectorPane
        workspace={workspace}
        selectedPlacement={hero}
        addingBlock={false}
        inspectorTab="fields"
        inspectorNavigationDisabled={false}
        collapsed
        pending={false}
        placementActionsDisabled={false}
        serverError={null}
        onTabChange={() => undefined}
        onCollapsedChange={() => undefined}
        onDiscardChanges={() => undefined}
        onSave={async () => undefined}
        onFormDirty={() => undefined}
        inspectField={async () => ({
          path: '$.headline',
          source: 'Example hero',
          success: true,
          dependencies: [],
          allowedVariables: [],
          expressionCount: 0,
          maxAstDepth: 0,
          evaluatedSample: 'Example hero',
          error: null,
        })}
      />
    );

    expect(markup).toContain('data-inspector-collapsed="true"');
    expect(markup).toContain('aria-label="Expand Fields inspector"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('!cursor-w-resize');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('role="tabpanel"');
    expect(markup).toContain('xl:hidden');
    expect(markup).toContain('Primary page message');
  });

  test('exposes the active History tab and compact revision provenance', () => {
    const markup = renderToStaticMarkup(
      <AuthoringInspectorPane
        workspace={workspace}
        selectedPlacement={hero}
        addingBlock={false}
        inspectorTab="history"
        inspectorNavigationDisabled={false}
        collapsed={false}
        pending={false}
        placementActionsDisabled={false}
        serverError={null}
        onTabChange={() => undefined}
        onCollapsedChange={() => undefined}
        onDiscardChanges={() => undefined}
        onSave={async () => undefined}
        onFormDirty={() => undefined}
        inspectField={async () => {
          throw new Error('History does not inspect fields.');
        }}
      />
    );

    expect(markup).toContain('aria-label="Collapse History inspector"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('!cursor-e-resize');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('Draft and publication state');
    expect(markup).toContain('Version lineage');
    expect(markup).toContain('Technical provenance');
  });
});
