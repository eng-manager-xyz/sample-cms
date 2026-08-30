import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';
import { CmsService } from '@repo/cms-service';

import {
  editableScenarioRegistry,
  executeCmsCommand,
  inspectCmsBlockField,
  preflightCmsPublication,
  previewCmsSelector,
  publishCmsPublication,
  readCmsWorkspace,
  rollbackCmsPublication,
} from './sqlite-authoring.server';

let client: CmsDatabaseClient;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
});

afterEach(() => client.close());

describe('AUT-514/AUT-542 persisted authoring workbench', () => {
  test('loads all three bounded scenarios idempotently with resolvable SQLite documents', () => {
    const store = readCmsWorkspace(client, 'stores');
    const dense = readCmsWorkspace(client, 'eligible-vehicles');
    const structuralDefault = readCmsWorkspace(client, 'structural-proof');
    const structuralVariant = readCmsWorkspace(
      client,
      'structural-proof',
      'editable-structural-hero-alt'
    );

    expect(store).toMatchObject({
      templateId: 'tpl-store',
      currentPublicationId: 'publication-store-2',
    });
    const storeHero = store.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    expect(storeHero).toMatchObject({
      lineageId: 'lineage-store-primary-hero',
      versionNumber: 1,
      schemaVersion: 1,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      publishedBlockVersionId: 'block-store-hero-v2-mcd',
      draftDifference: 'changed',
    });
    expect(storeHero?.versionHistory.length).toBeGreaterThanOrEqual(3);
    expect(storeHero?.versionHistory[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storeHero?.fieldInspections).toEqual([
      expect.objectContaining({
        path: '$.headline',
        success: true,
        dependencies: ['store.location', 'store.name'],
        evaluatedSample: "I am McDonald's Market — San Francisco",
      }),
    ]);
    expect(dense).toMatchObject({
      templateId: 'eligible-vehicles',
      currentPublicationId: 'editable-eligible-publication-2',
    });
    expect(dense.placements).toHaveLength(7);
    expect(dense.placements.every((placement) => placement.sourcePriority === 0)).toBe(true);
    expect(structuralDefault.placements).toHaveLength(24);
    expect(structuralVariant.placements).toHaveLength(23);
    expect(structuralVariant.tombstones.map((entry) => entry.placementKey)).toEqual([
      'announcement-promo',
    ]);
    expect(
      structuralVariant.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({ blockType: 'hero_alt', inherited: false });
    expect(structuralVariant.placements.filter((placement) => placement.inherited)).toHaveLength(
      22
    );
    expect(structuralVariant.placements.every((placement) => placement.orderInherited)).toBe(true);

    const templateCountBeforeReplay = client.sqlite
      .query<{ count: number }, []>('SELECT count(*) AS count FROM templates')
      .get()?.count;
    for (const scenarioId of Object.keys(editableScenarioRegistry) as Array<
      keyof typeof editableScenarioRegistry
    >) {
      readCmsWorkspace(client, scenarioId);
    }
    expect(
      client.sqlite.query<{ count: number }, []>('SELECT count(*) AS count FROM templates').get()
        ?.count
    ).toBe(templateCountBeforeReplay);
  });

  test('inspects unsaved CEL input against the exact canonical page context', () => {
    readCmsWorkspace(client, 'stores');
    expect(
      inspectCmsBlockField(
        client,
        'stores',
        '/en-US/store/1001',
        'Current draft for {{ store.name }} in {{ store.location }}'
      )
    ).toMatchObject({
      source: 'Current draft for {{ store.name }} in {{ store.location }}',
      success: true,
      dependencies: ['store.location', 'store.name'],
      evaluatedSample: "Current draft for McDonald's Market in San Francisco",
    });
    expect(
      inspectCmsBlockField(client, 'stores', '/en-US/store/1001', '{{ merchant.name }}')
    ).toMatchObject({ success: false, error: { code: 'UNKNOWN_ROOT' } });
  });

  test('persists default add, atomic reorder, immutable edit, delete, publish, and rollback', () => {
    const initial = readCmsWorkspace(client, 'stores');
    const defaultScope = initial.scopeId;
    const versionCountBeforeOrder = client.sqlite
      .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
      .get()?.count;
    const added = executeCmsCommand(client, {
      kind: 'addPlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'ui-promotion',
      blockTypeKey: 'promo',
      contentJson: '{"message":"UI promotion"}',
    }).workspace;
    expect(added.placements.at(-1)).toMatchObject({ placementKey: 'ui-promotion' });

    const moved = executeCmsCommand(client, {
      kind: 'movePlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'ui-promotion',
      direction: 'up',
    }).workspace;
    expect(moved.placements.at(-2)?.placementKey).toBe('ui-promotion');
    expect(
      client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
        .get()?.count
    ).toBe((versionCountBeforeOrder ?? 0) + 1);

    const previousVersion = moved.placements.find(
      (placement) => placement.placementKey === 'ui-promotion'
    )?.blockVersionId;
    const edited = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'ui-promotion',
      blockTypeKey: 'promo',
      contentJson: '{"message":"Edited through the HUD"}',
    }).workspace;
    const editedPlacement = edited.placements.find(
      (placement) => placement.placementKey === 'ui-promotion'
    );
    expect(editedPlacement?.blockVersionId).not.toBe(previousVersion);
    expect(editedPlacement?.contentJson).toContain('Edited through the HUD');
    expect(
      client.sqlite
        .query<{ count: number }, [string]>(
          'SELECT count(*) AS count FROM block_versions WHERE id = ?'
        )
        .get(previousVersion ?? '')?.count
    ).toBe(1);

    const published = executeCmsCommand(client, { kind: 'publish', scenarioId: 'stores' });
    expect(published.workspace.currentPublicationId).not.toBe(initial.currentPublicationId);
    expect(published.workspace.currentDocumentHash).not.toBe(initial.currentDocumentHash);
    expect(published.workspace.rollbackPublicationId).toBe(initial.currentPublicationId);
    const rolledBack = executeCmsCommand(client, { kind: 'rollback', scenarioId: 'stores' });
    expect(rolledBack.workspace.currentPublicationId).toBe(initial.currentPublicationId);
    expect(rolledBack.workspace.currentDocumentHash).toBe(initial.currentDocumentHash);
    expect(rolledBack.workspace.rollbackPublicationId).toBe('publication-store-1');

    const deleted = executeCmsCommand(client, {
      kind: 'deletePlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'ui-promotion',
    }).workspace;
    expect(deleted.placements.some((placement) => placement.placementKey === 'ui-promotion')).toBe(
      false
    );
  });

  test('inserts at an explicit position and preserves placement identity across type replacement', () => {
    readCmsWorkspace(client, 'structural-proof');
    const initial = readCmsWorkspace(client, 'stores');
    const defaultScope = initial.scopeId;
    const inserted = executeCmsCommand(client, {
      kind: 'addPlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'pre-hero-promotion',
      blockTypeKey: 'promo',
      contentJson: '{"message":"Before the hero"}',
      position: 'before',
      referencePlacementKey: 'primary-hero',
    }).workspace;
    expect(inserted.placements.map((placement) => placement.placementKey).slice(0, 3)).toEqual([
      'navigation',
      'pre-hero-promotion',
      'primary-hero',
    ]);

    const previous = inserted.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    const replaced = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero_alt',
      contentJson: '{"headline":"Alternate {{ store.name }}","mapAssetKey":"market-map"}',
    }).workspace;
    const next = replaced.placements.find((placement) => placement.placementKey === 'primary-hero');
    expect(next).toMatchObject({
      placementKey: 'primary-hero',
      blockType: 'hero_alt',
      parentBlockVersionId: previous?.blockVersionId,
      lineageId: previous?.lineageId,
      draftDifference: 'changed',
    });
    expect(next?.blockVersionId).not.toBe(previous?.blockVersionId);
    expect(next?.versionHistory[0]).toMatchObject({
      id: next?.blockVersionId,
      parentBlockVersionId: previous?.blockVersionId,
      blockType: 'hero_alt',
    });
  });

  test('persists linked and blank variants, selector revisions, copy-on-write, tombstones, and revert', () => {
    const preview = previewCmsSelector(client, 'stores', "brand = 'mcdonalds'");
    expect(preview).toMatchObject({ totalCount: 1, templatePageCount: 14 });
    expect(() => previewCmsSelector(client, 'stores', 'DROP TABLE pages')).toThrow();

    const linked = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'HUD linked variant',
      selector: "brand = 'mcdonalds'",
      priority: 60,
      mode: 'linked',
    }).workspace;
    expect(linked.placements.every((placement) => placement.inherited)).toBe(true);
    const linkedScope = linked.scopeId;
    expect(linked.placements.every((placement) => placement.orderInherited)).toBe(true);
    const inheritedOrder = linked.placements.map((placement) => placement.placementKey);
    const blockCountBeforeMove = client.sqlite
      .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
      .get()?.count;
    const inheritedVersion = linked.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    )?.blockVersionId;

    const reordered = executeCmsCommand(client, {
      kind: 'movePlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
      direction: 'up',
    }).workspace;
    expect(reordered.placements.every((placement) => placement.inherited)).toBe(true);
    expect(reordered.placements.every((placement) => !placement.orderInherited)).toBe(true);
    const revertedOrder = executeCmsCommand(client, {
      kind: 'revertOrder',
      scenarioId: 'stores',
      scopeId: linkedScope,
      canonicalUrl: '/en-US/store/1001',
    }).workspace;
    expect(revertedOrder.placements.map((placement) => placement.placementKey)).toEqual(
      inheritedOrder
    );
    expect(revertedOrder.placements.map((placement) => placement.order)).toEqual([0, 1, 2, 3]);
    expect(revertedOrder.placements.every((placement) => placement.orderInherited)).toBe(true);
    expect(new Set(revertedOrder.placements.map((placement) => placement.order)).size).toBe(
      revertedOrder.placements.length
    );
    expect(
      client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
        .get()?.count
    ).toBe(blockCountBeforeMove);

    const copied = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"HUD copy for {{ store.name }}"}',
    }).workspace;
    expect(
      copied.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({ inherited: false });
    const copiedHero = copied.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    expect(copiedHero?.blockVersionId).not.toBe(inheritedVersion);
    expect(copiedHero).toMatchObject({
      parentBlockVersionId: inheritedVersion,
      inherited: false,
    });

    const hidden = executeCmsCommand(client, {
      kind: 'deletePlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
    }).workspace;
    expect(hidden.tombstones.map((entry) => entry.placementKey)).toContain('primary-hero');
    const reverted = executeCmsCommand(client, {
      kind: 'revertPlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
    }).workspace;
    expect(reverted.tombstones.map((entry) => entry.placementKey)).not.toContain('primary-hero');
    expect(
      reverted.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({ inherited: true, blockVersionId: inheritedVersion });

    const revised = executeCmsCommand(client, {
      kind: 'reviseSelector',
      scenarioId: 'stores',
      scopeId: linkedScope,
      selector: "store_type = 'independent'",
    }).workspace;
    expect(revised.canonicalUrl).toBe('/en-US/store/1002');

    const blank = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'HUD blank variant',
      selector: "store_type = 'independent'",
      priority: 70,
      mode: 'empty',
    }).workspace;
    expect(blank.placements).toEqual([]);
    expect(blank.tombstones).toHaveLength(4);
  });

  test('seeds copy-on-write from the exact displayed page and returns that page snapshot', () => {
    const broad = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'All live stores',
      selector: "route_status = 'live'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    const firstPage = readCmsWorkspace(client, 'stores', broad.scopeId, '/en-US/store/1001');
    const secondPage = readCmsWorkspace(client, 'stores', broad.scopeId, '/en-US/store/1002');
    const firstParent = firstPage.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    )?.blockVersionId;
    const secondParent = secondPage.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    )?.blockVersionId;
    expect(secondParent).not.toBe(firstParent);

    const edited = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: broad.scopeId,
      canonicalUrl: '/en-US/store/1002',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Exact second-page copy"}',
    }).workspace;
    const editedHero = edited.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );

    expect(edited.canonicalUrl).toBe('/en-US/store/1002');
    expect(editedHero?.parentBlockVersionId).toBe(secondParent);
    expect(editedHero?.parentBlockVersionId).not.toBe(firstParent);
  });

  test('projects a selected scope above lower layers but below same and higher winners', () => {
    const selected = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Selected low-priority scope',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    const higher = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Higher global winner',
      selector: "brand = 'mcdonalds'",
      priority: 90,
      mode: 'linked',
    }).workspace;
    const higherWorkspace = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: higher.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
      blockTypeKey: 'footer',
      contentJson: '{"legal":"Higher global footer"}',
    }).workspace;
    const higherVersion = higherWorkspace.placements.find(
      (placement) => placement.placementKey === 'footer'
    )?.blockVersionId;
    const selectedBefore = readCmsWorkspace(
      client,
      'stores',
      selected.scopeId,
      '/en-US/store/1001'
    );
    const lowerVersion = selectedBefore.placements.find(
      (placement) => placement.placementKey === 'footer'
    )?.blockVersionId;
    expect(lowerVersion).not.toBe(higherVersion);

    const edited = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: selected.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
      blockTypeKey: 'footer',
      contentJson: '{"legal":"Selected scope footer"}',
    }).workspace;
    expect(
      edited.placements.find((placement) => placement.placementKey === 'footer')
    ).toMatchObject({
      sourcePriority: 80,
      inherited: false,
      parentBlockVersionId: lowerVersion,
    });
    expect(
      new CmsService(client)
        .resolvePage('tpl-store', 'page-store-1001')
        .document.placements.find((placement) => placement.placementKey === 'footer')?.blockVersion
        .id
    ).toBe(higherVersion);

    const hidden = executeCmsCommand(client, {
      kind: 'deletePlacement',
      scenarioId: 'stores',
      scopeId: selected.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
    }).workspace;
    expect(hidden.tombstones).toContainEqual(
      expect.objectContaining({
        placementKey: 'footer',
        sourcePriority: 80,
        hiddenPlacement: expect.objectContaining({ blockVersionId: lowerVersion }),
      })
    );
    const reverted = executeCmsCommand(client, {
      kind: 'revertPlacement',
      scenarioId: 'stores',
      scopeId: selected.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
    }).workspace;
    expect(reverted.tombstones).toEqual([]);
    expect(
      reverted.placements.find((placement) => placement.placementKey === 'footer')
    ).toMatchObject({ blockVersionId: lowerVersion, inherited: true });
  });

  test('rejects every placement mutation when the selected scope misses the exact page', () => {
    const scoped = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Only McDonalds',
      selector: "brand = 'mcdonalds'",
      priority: 90,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: scoped.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Local operation for revert proof"}',
    });
    const revisionBefore = client.sqlite
      .query<{ revisionId: string }, [string]>(
        'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
      )
      .get(scoped.scopeId)?.revisionId;
    const blockCountBefore = client.sqlite
      .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
      .get()?.count;
    const wrongPageCommands = [
      {
        kind: 'addPlacement',
        scenarioId: 'stores',
        scopeId: scoped.scopeId,
        canonicalUrl: '/en-US/store/1002',
        placementKey: 'wrong-page-promo',
        blockTypeKey: 'promo',
        contentJson: '{"message":"Must roll back"}',
      },
      {
        kind: 'editPlacement',
        scenarioId: 'stores',
        scopeId: scoped.scopeId,
        canonicalUrl: '/en-US/store/1002',
        placementKey: 'primary-hero',
        blockTypeKey: 'hero',
        contentJson: '{"headline":"Must roll back"}',
      },
      {
        kind: 'movePlacement',
        scenarioId: 'stores',
        scopeId: scoped.scopeId,
        canonicalUrl: '/en-US/store/1002',
        placementKey: 'footer',
        direction: 'up',
      },
      {
        kind: 'revertOrder',
        scenarioId: 'stores',
        scopeId: scoped.scopeId,
        canonicalUrl: '/en-US/store/1002',
      },
      {
        kind: 'deletePlacement',
        scenarioId: 'stores',
        scopeId: scoped.scopeId,
        canonicalUrl: '/en-US/store/1002',
        placementKey: 'primary-hero',
      },
      {
        kind: 'revertPlacement',
        scenarioId: 'stores',
        scopeId: scoped.scopeId,
        canonicalUrl: '/en-US/store/1002',
        placementKey: 'primary-hero',
      },
    ] as const;

    for (const command of wrongPageCommands) {
      expect(() => executeCmsCommand(client, command)).toThrow(
        'does not match page "/en-US/store/1002"'
      );
    }
    expect(() =>
      executeCmsCommand(client, {
        kind: 'editPlacement',
        scenarioId: 'stores',
        scopeId: scoped.scopeId,
        canonicalUrl: '/en-US/airport/hero-alt',
        placementKey: 'primary-hero',
        blockTypeKey: 'hero',
        contentJson: '{"headline":"Wrong template"}',
      })
    ).toThrow('was not found in the selected template');
    expect(
      client.sqlite
        .query<{ revisionId: string }, [string]>(
          'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
        )
        .get(scoped.scopeId)?.revisionId
    ).toBe(revisionBefore);
    expect(
      client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
        .get()?.count
    ).toBe(blockCountBefore);
  });

  test('rolls back a broad order snapshot that references a page-specific lower placement', () => {
    const lower = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Page-specific lower layer',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'addPlacement',
      scenarioId: 'stores',
      scopeId: lower.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'mcdonalds-only-promo',
      blockTypeKey: 'promo',
      contentJson: '{"message":"Only this lower layer provides me"}',
    });
    const broad = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Broad ordering layer',
      selector: "route_status = 'live'",
      priority: 90,
      mode: 'linked',
    }).workspace;
    const revisionBefore = client.sqlite
      .query<{ revisionId: string }, [string]>(
        'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
      )
      .get(broad.scopeId)?.revisionId;
    const publicationCountBefore = broad.publicationCount;
    const publicationIdBefore = broad.currentPublicationId;

    expect(() =>
      executeCmsCommand(client, {
        kind: 'movePlacement',
        scenarioId: 'stores',
        scopeId: broad.scopeId,
        canonicalUrl: '/en-US/store/1001',
        placementKey: 'footer',
        direction: 'up',
      })
    ).toThrow();

    expect(
      client.sqlite
        .query<{ revisionId: string }, [string]>(
          'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
        )
        .get(broad.scopeId)?.revisionId
    ).toBe(revisionBefore);
    const after = readCmsWorkspace(client, 'stores', broad.scopeId, '/en-US/store/1002');
    expect(after.placements.map((placement) => placement.placementKey)).not.toContain(
      'mcdonalds-only-promo'
    );
    expect(after.publicationCount).toBe(publicationCountBefore);
    expect(after.currentPublicationId).toBe(publicationIdBefore);
  });

  test('rolls back selector broadening when a saved order depends on a page-specific lower layer', () => {
    const lower = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Selector preflight lower layer',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'addPlacement',
      scenarioId: 'stores',
      scopeId: lower.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'selector-only-promo',
      blockTypeKey: 'promo',
      contentJson: '{"message":"Selector-local lower placement"}',
    });
    const target = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Narrow ordering selector',
      selector: "brand = 'mcdonalds'",
      priority: 90,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'movePlacement',
      scenarioId: 'stores',
      scopeId: target.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
      direction: 'up',
    });
    const before = readCmsWorkspace(client, 'stores', target.scopeId, '/en-US/store/1001');
    const revisionBefore = before.variants.find(
      (variant) => variant.id === target.scopeId
    )?.activeRevisionId;

    expect(() =>
      executeCmsCommand(client, {
        kind: 'reviseSelector',
        scenarioId: 'stores',
        scopeId: target.scopeId,
        selector: "route_status = 'live'",
      })
    ).toThrow();

    const after = readCmsWorkspace(client, 'stores', target.scopeId, '/en-US/store/1001');
    expect(after.variants.find((variant) => variant.id === target.scopeId)).toMatchObject({
      activeRevisionId: revisionBefore,
      selector: "brand = 'mcdonalds'",
    });
    expect(after.publicationCount).toBe(before.publicationCount);
    expect(after.currentPublicationId).toBe(before.currentPublicationId);
  });

  test('rolls back priority changes that move a complete order below its required placement', () => {
    const lower = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Priority preflight lower layer',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'addPlacement',
      scenarioId: 'stores',
      scopeId: lower.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'priority-only-promo',
      blockTypeKey: 'promo',
      contentJson: '{"message":"Priority-local lower placement"}',
    });
    const target = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Priority ordering layer',
      selector: "brand = 'mcdonalds'",
      priority: 90,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'movePlacement',
      scenarioId: 'stores',
      scopeId: target.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
      direction: 'up',
    });
    const before = readCmsWorkspace(client, 'stores', target.scopeId, '/en-US/store/1001');
    const revisionBefore = before.variants.find(
      (variant) => variant.id === target.scopeId
    )?.activeRevisionId;

    expect(() =>
      executeCmsCommand(client, {
        kind: 'setVariantPriority',
        scenarioId: 'stores',
        scopeId: target.scopeId,
        priority: 70,
      })
    ).toThrow();

    const after = readCmsWorkspace(client, 'stores', target.scopeId, '/en-US/store/1001');
    expect(after.variants.find((variant) => variant.id === target.scopeId)).toMatchObject({
      activeRevisionId: revisionBefore,
      priority: 90,
    });
    expect(after.publicationCount).toBe(before.publicationCount);
    expect(after.currentPublicationId).toBe(before.currentPublicationId);
  });

  test('does not let an unrelated draft conflict mask an invalid broad order mutation', () => {
    const firstConflict = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Preflight conflict one',
      selector: "brand = 'mcdonalds'",
      priority: 100,
      mode: 'linked',
    }).workspace;
    const secondConflict = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Preflight conflict two',
      selector: "brand = 'mcdonalds'",
      priority: 100,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: firstConflict.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Conflict one"}',
    });
    const conflicted = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: secondConflict.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Conflict two"}',
    }).workspace;
    expect(conflicted.publicationBlocked).toBe(true);

    const lower = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Conflict-safe lower layer',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'addPlacement',
      scenarioId: 'stores',
      scopeId: lower.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'conflict-mask-promo',
      blockTypeKey: 'promo',
      contentJson: '{"message":"Must not leak into the other page order"}',
    });
    const broad = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Conflict-masked broad order',
      selector: "route_status = 'live'",
      priority: 90,
      mode: 'linked',
    }).workspace;
    const revisionBefore = broad.variants.find(
      (variant) => variant.id === broad.scopeId
    )?.activeRevisionId;

    expect(() =>
      executeCmsCommand(client, {
        kind: 'movePlacement',
        scenarioId: 'stores',
        scopeId: broad.scopeId,
        canonicalUrl: '/en-US/store/1001',
        placementKey: 'footer',
        direction: 'up',
      })
    ).toThrow();

    const after = readCmsWorkspace(client, 'stores', broad.scopeId, '/en-US/store/1002');
    expect(after.variants.find((variant) => variant.id === broad.scopeId)?.activeRevisionId).toBe(
      revisionBefore
    );
    expect(after.publicationCount).toBe(broad.publicationCount);
    expect(after.currentPublicationId).toBe(broad.currentPublicationId);
  });

  test('rolls back default deletion when a sparse variant inherits its placement order', () => {
    const sparse = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Sparse inherited order',
      selector: "brand = 'mcdonalds'",
      priority: 90,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: sparse.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Sparse set inherits default order"}',
    });
    const defaults = readCmsWorkspace(client, 'stores', undefined, '/en-US/store/1001');
    const defaultRevisionBefore = client.sqlite
      .query<{ revisionId: string }, [string]>(
        'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
      )
      .get(defaults.scopeId)?.revisionId;
    const publicationCountBefore = defaults.publicationCount;
    const publicationIdBefore = defaults.currentPublicationId;

    expect(() =>
      executeCmsCommand(client, {
        kind: 'deletePlacement',
        scenarioId: 'stores',
        scopeId: defaults.scopeId,
        canonicalUrl: '/en-US/store/1001',
        placementKey: 'primary-hero',
      })
    ).toThrow();

    expect(
      client.sqlite
        .query<{ revisionId: string }, [string]>(
          'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
        )
        .get(defaults.scopeId)?.revisionId
    ).toBe(defaultRevisionBefore);
    const after = readCmsWorkspace(client, 'stores', undefined, '/en-US/store/1001');
    expect(after.placements.map((placement) => placement.placementKey)).toContain('primary-hero');
    expect(after.publicationCount).toBe(publicationCountBefore);
    expect(after.currentPublicationId).toBe(publicationIdBefore);
  });

  test('ignores archived-only overlaps in previews and publication blocking', () => {
    const first = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Archived overlap first',
      selector: "store_type = 'independent'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    const second = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Archived overlap second',
      selector: "store_type = 'independent'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: first.scopeId,
      canonicalUrl: '/en-US/store/1002',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"First archived-only winner"}',
    });
    const conflicted = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: second.scopeId,
      canonicalUrl: '/en-US/store/1002',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Second archived-only winner"}',
    }).workspace;
    expect(conflicted.publicationBlocked).toBe(true);

    new CmsService(client).deletePage('tpl-store', 'page-store-1002');
    const preview = previewCmsSelector(client, 'stores', "store_type = 'independent'", {
      scopeId: first.scopeId,
      priority: 80,
      canonicalUrl: '/en-US/store/1002',
    });
    expect(preview.overlaps.find((overlap) => overlap.variantId === second.scopeId)).toMatchObject({
      overlapCount: 0,
      sampleUrls: [],
      conflictingPlacementKeys: ['primary-hero'],
    });
    const afterArchive = readCmsWorkspace(client, 'stores', first.scopeId, '/en-US/store/1002');
    expect(afterArchive).toMatchObject({
      publicationBlocked: false,
      resolutionConflicts: [],
    });
    expect(() => new CmsService(client).publish('tpl-store', { createdBy: 'test' })).not.toThrow();
  });

  test('creates, previews, revises, and reloads Eligible Vehicles dimensions', () => {
    const selector = "state = 'tx' AND slug = 'delivery'";
    const preview = previewCmsSelector(client, 'eligible-vehicles', selector, {
      priority: 60,
      canonicalUrl: '/es-US/eligible-vehicles/tx/delivery',
    });
    expect(preview).toMatchObject({
      totalCount: 1,
      templatePageCount: 14,
      selectedPageMatches: true,
      truncated: false,
    });
    expect(preview.approvedFields.map((field) => field.name)).toEqual(
      expect.arrayContaining(['state', 'slug'])
    );

    const created = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'eligible-vehicles',
      name: 'TX delivery dimension',
      selector,
      priority: 60,
      mode: 'linked',
    }).workspace;
    expect(created).toMatchObject({
      canonicalUrl: '/es-US/eligible-vehicles/tx/delivery',
      scopeMatchesSamplePage: true,
    });
    expect(created.placements.every((placement) => placement.inherited)).toBe(true);

    const reloaded = readCmsWorkspace(
      client,
      'eligible-vehicles',
      created.scopeId,
      '/es-US/eligible-vehicles/tx/delivery'
    );
    expect(reloaded.scopeId).toBe(created.scopeId);
    expect(reloaded.scopeMatchesSamplePage).toBe(true);

    const revised = executeCmsCommand(client, {
      kind: 'reviseSelector',
      scenarioId: 'eligible-vehicles',
      scopeId: created.scopeId,
      selector: "state = 'ca' AND slug = 'premium'",
    }).workspace;
    expect(revised.canonicalUrl).toBe('/en-US/eligible-vehicles/ca/premium');
    expect(revised.variants.find((variant) => variant.id === created.scopeId)?.selector).toBe(
      "state = 'ca' AND slug = 'premium'"
    );
  });

  test('reports exact impact, allowlisted execution, bounded samples, and every active overlap', () => {
    new CmsService(client).assignTags(
      'tpl-store',
      'page-store-1002',
      ['tag-store-brand-mcdonalds', 'tag-store-type-chain'],
      'author'
    );

    const preview = previewCmsSelector(client, 'stores', "brand = 'mcdonalds'", {
      scopeId: 'variant-store-mcdonalds',
      priority: 30,
      canonicalUrl: '/en-US/store/1001',
      sampleLimit: 1,
    });

    expect(preview).toMatchObject({
      normalizedSelector: "brand = 'mcdonalds'",
      totalCount: 2,
      templatePageCount: 14,
      truncated: true,
      selectedPageMatches: true,
      affectedPlacementCount: 1,
      warnings: [],
    });
    expect(preview.samplePages).toHaveLength(1);
    expect(preview.approvedFields.map((field) => field.name)).toContain('tag.brand');
    expect(preview.execution.sql).toContain('WHERE p.template_id = ?');
    expect(preview.execution.sql).not.toContain('mcdonalds');
    expect(preview.execution.parameters).toContain('mcdonalds');
    expect(preview.plan.length).toBeGreaterThan(0);
    expect(preview.overlaps).toHaveLength(3);
    expect(
      preview.overlaps.find((overlap) => overlap.variantId === 'variant-store-chain')
    ).toMatchObject({
      overlapCount: 2,
      truncated: true,
      sampleUrls: ['/en-US/store/1001'],
      relation: 'below',
      affectedPlacementCount: 1,
    });
    expect(() =>
      previewCmsSelector(client, 'stores', "brand = 'x'; DELETE FROM variants", {
        priority: 30,
      })
    ).toThrow();
  });

  test('duplicates immutable variation intent without sharing mutable revision state', () => {
    const source = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Duplicate source',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    const authoredSource = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: source.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Immutable source"}',
    }).workspace;
    const sourceVersion = authoredSource.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    )?.blockVersionId;
    const blockCountBefore = client.sqlite
      .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
      .get()?.count;

    const duplicated = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Independent duplicate',
      selector: "category = 'restaurant'",
      priority: 81,
      mode: 'duplicate',
      duplicateSourceScopeId: source.scopeId,
    }).workspace;
    expect(duplicated.scopeId).not.toBe(source.scopeId);
    expect(duplicated.variants.find((variant) => variant.id === duplicated.scopeId)?.selector).toBe(
      "brand = 'mcdonalds'"
    );
    expect(
      duplicated.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({
      blockVersionId: sourceVersion,
      sourcePriority: 81,
      inherited: false,
    });
    expect(
      client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM block_versions')
        .get()?.count
    ).toBe(blockCountBefore);

    const editedDuplicate = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: duplicated.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Independent duplicate edit"}',
    }).workspace;
    const duplicateVersion = editedDuplicate.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    )?.blockVersionId;
    expect(duplicateVersion).not.toBe(sourceVersion);
    expect(
      client.sqlite
        .query<{ blockVersionId: string }, [string]>(
          `SELECT operations.block_version_id AS blockVersionId
           FROM variants
           JOIN variant_operations AS operations
             ON operations.variant_revision_id = variants.active_revision_id
           WHERE variants.id = ?
             AND operations.placement_key = 'primary-hero'
             AND operations.operation_kind = 'set'`
        )
        .get(source.scopeId)?.blockVersionId
    ).toBe(sourceVersion);
  });

  test('persists draft conflicts, names both sources, blocks publish, and recomputes after priority repair', () => {
    const publicationBefore = readCmsWorkspace(client, 'stores').currentPublicationId;
    const first = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'First equal-priority layer',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    const second = executeCmsCommand(client, {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Second equal-priority layer',
      selector: "brand = 'mcdonalds'",
      priority: 80,
      mode: 'linked',
    }).workspace;
    executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: first.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"First winner"}',
    });
    const disjoint = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: second.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'footer',
      blockTypeKey: 'footer',
      contentJson: '{"legal":"A disjoint same-priority edit"}',
    }).workspace;
    expect(disjoint.publicationBlocked).toBe(false);
    const revisionBefore = client.sqlite
      .query<{ revisionId: string }, [string]>(
        'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
      )
      .get(second.scopeId)?.revisionId;

    const conflicted = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: second.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"Conflicting winner"}',
    }).workspace;

    expect(conflicted).toMatchObject({
      resolutionStatus: 'resolved',
      publicationBlocked: true,
      resolutionConflicts: [
        {
          priority: 80,
          placementKey: 'primary-hero',
          overlapCount: 1,
          sources: [
            { variantName: expect.any(String), operationKinds: ['set'] },
            { variantName: expect.any(String), operationKinds: ['set'] },
          ],
        },
      ],
    });
    expect(
      conflicted.resolutionConflicts[0]?.sources.map((source) => source.variantName).sort()
    ).toEqual(['First equal-priority layer', 'Second equal-priority layer']);
    expect(
      client.sqlite
        .query<{ revisionId: string }, [string]>(
          'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
        )
        .get(second.scopeId)?.revisionId
    ).not.toBe(revisionBefore);
    expect(() => executeCmsCommand(client, { kind: 'publish', scenarioId: 'stores' })).toThrow(
      'ambiguous'
    );
    expect(readCmsWorkspace(client, 'stores').currentPublicationId).toBe(publicationBefore);

    const repaired = executeCmsCommand(client, {
      kind: 'setVariantPriority',
      scenarioId: 'stores',
      scopeId: second.scopeId,
      priority: 81,
    }).workspace;
    expect(repaired).toMatchObject({
      resolutionStatus: 'resolved',
      publicationBlocked: false,
      resolutionConflicts: [],
    });
    expect(
      readCmsWorkspace(client, 'stores', second.scopeId).placements.find(
        (placement) => placement.placementKey === 'primary-hero'
      )
    ).toMatchObject({ sourcePriority: 81, inherited: false });
  });

  test('rolls back a failed lazy seed and can retry from a clean state', () => {
    client.sqlite.exec(`
      CREATE TRIGGER fail_eligible_editable_seed
      BEFORE INSERT ON page_instances
      WHEN NEW.template_id = 'eligible-vehicles'
      BEGIN
        SELECT RAISE(ABORT, 'forced editable seed failure');
      END;
    `);
    expect(() => readCmsWorkspace(client, 'eligible-vehicles')).toThrow();
    expect(
      client.sqlite
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM templates WHERE id = 'eligible-vehicles'"
        )
        .get()?.count
    ).toBe(0);
    client.sqlite.exec('DROP TRIGGER fail_eligible_editable_seed');
    expect(readCmsWorkspace(client, 'eligible-vehicles').placements).toHaveLength(7);
  });
});

describe('AUT-543 typed publication lifecycle backend', () => {
  test('preflights all three scenarios through a read-only contract without adding rows', () => {
    for (const scenarioId of ['stores', 'eligible-vehicles', 'structural-proof'] as const) {
      readCmsWorkspace(client, scenarioId);
    }
    const before = {
      publications: client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM publications')
        .get()?.count,
      documents: client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM published_page_documents')
        .get()?.count,
      pointers: client.sqlite
        .query<{ templateId: string; publicationId: string }, []>(
          `SELECT template_id AS templateId, publication_id AS publicationId
           FROM current_publications ORDER BY template_id`
        )
        .all(),
    };

    for (const scenarioId of ['stores', 'eligible-vehicles', 'structural-proof'] as const) {
      const preflight = preflightCmsPublication(client, { scenarioId, sampleLimit: 2 });
      expect(preflight).toMatchObject({
        canPublish: true,
        issues: [],
        currentPublication: { id: expect.any(String) },
      });
      expect(preflight.inputHash).toMatch(/^[a-f0-9]{64}$/);
      expect(preflight.totalActivePages).toBeGreaterThan(0);
      expect(
        preflight.manifestReuse.reusedManifestCount + preflight.manifestReuse.newManifestCount
      ).toBe(preflight.manifestReuse.eligibleManifestCount);
    }

    expect({
      publications: client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM publications')
        .get()?.count,
      documents: client.sqlite
        .query<{ count: number }, []>('SELECT count(*) AS count FROM published_page_documents')
        .get()?.count,
      pointers: client.sqlite
        .query<{ templateId: string; publicationId: string }, []>(
          `SELECT template_id AS templateId, publication_id AS publicationId
           FROM current_publications ORDER BY template_id`
        )
        .all(),
    }).toEqual(before);
  });

  test('publishes with reviewed hashes and rolls back only the exact reviewed predecessor', () => {
    const initial = readCmsWorkspace(client, 'stores');
    executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: initial.scopeId,
      canonicalUrl: '/en-US/store/1001',
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"AUT-543 reviewed {{ store.name }}"}',
    });
    const preflight = preflightCmsPublication(client, {
      scenarioId: 'stores',
      scopeId: initial.scopeId,
      canonicalUrl: '/en-US/store/1001',
    });
    if (!preflight.inputHash || !preflight.currentPublication) {
      throw new Error('Expected a publishable reviewed Store draft.');
    }
    expect(preflight.affectedActivePages).toMatchObject({
      count: 14,
      truncated: true,
    });
    expect(preflight.affectedActivePages.sampleCanonicalUrls).toHaveLength(10);
    expect(preflight.affectedActivePages.sampleCanonicalUrls).toContain('/en-US/store/1001');
    const publicBefore = new CmsService(client).serve('tpl-store', '/en-US/store/1001');
    expect(() =>
      publishCmsPublication(client, {
        scenarioId: 'stores',
        inputHash: '0'.repeat(64),
        expectedCurrentPublicationId: preflight.currentPublication?.id ?? null,
      })
    ).toThrow('Authoring input changed after preflight');
    expect(new CmsService(client).serve('tpl-store', '/en-US/store/1001')).toEqual(publicBefore);

    const published = publishCmsPublication(client, {
      scenarioId: 'stores',
      scopeId: initial.scopeId,
      canonicalUrl: '/en-US/store/1001',
      inputHash: preflight.inputHash,
      expectedCurrentPublicationId: preflight.currentPublication.id,
    });
    expect(published).toMatchObject({
      kind: 'publish',
      publication: { previousPublicationId: preflight.currentPublication.id },
      preflight: { affectedActivePages: { count: 0 } },
    });
    const target = published.preflight.rollbackTarget;
    if (!target?.valid) throw new Error('Expected a valid retained predecessor.');
    expect(() =>
      rollbackCmsPublication(client, {
        scenarioId: 'stores',
        targetPublicationId: target.publication.id,
        expectedCurrentPublicationId: 'stale-current-publication',
      })
    ).toThrow('Serving pointer changed after preflight');
    const rolledBack = rollbackCmsPublication(client, {
      scenarioId: 'stores',
      scopeId: initial.scopeId,
      canonicalUrl: '/en-US/store/1001',
      targetPublicationId: target.publication.id,
      expectedCurrentPublicationId: published.publication.id,
    });
    expect(rolledBack).toMatchObject({
      kind: 'rollback',
      fromPublication: { id: published.publication.id },
      publication: { id: target.publication.id },
      workspace: { currentPublicationId: target.publication.id },
    });
  });
});
