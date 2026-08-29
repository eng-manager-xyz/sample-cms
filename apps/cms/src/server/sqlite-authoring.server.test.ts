import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';

import {
  editableScenarioRegistry,
  executeCmsCommand,
  previewCmsSelector,
  readCmsWorkspace,
} from './sqlite-authoring.server';

let client: CmsDatabaseClient;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
});

afterEach(() => client.close());

describe('AUT-514 persisted HUD authoring workbench', () => {
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
      currentPublicationId: 'publication-store-1',
    });
    expect(dense).toMatchObject({
      templateId: 'eligible-vehicles',
      currentPublicationId: 'editable-eligible-publication-1',
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
      placementKey: 'ui-promotion',
      blockTypeKey: 'promo',
      contentJson: '{"message":"UI promotion"}',
    }).workspace;
    expect(added.placements.at(-1)).toMatchObject({ placementKey: 'ui-promotion' });

    const moved = executeCmsCommand(client, {
      kind: 'movePlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
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
    expect(rolledBack.workspace.rollbackPublicationId).toBeNull();

    const deleted = executeCmsCommand(client, {
      kind: 'deletePlacement',
      scenarioId: 'stores',
      scopeId: defaultScope,
      placementKey: 'ui-promotion',
    }).workspace;
    expect(deleted.placements.some((placement) => placement.placementKey === 'ui-promotion')).toBe(
      false
    );
  });

  test('persists linked and blank variants, selector revisions, copy-on-write, tombstones, and revert', () => {
    const preview = previewCmsSelector(client, 'stores', "brand = 'mcdonalds'");
    expect(preview).toMatchObject({ totalCount: 1, templatePageCount: 2 });
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
    const inheritedVersion = linked.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    )?.blockVersionId;

    const reordered = executeCmsCommand(client, {
      kind: 'movePlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
      placementKey: 'footer',
      direction: 'up',
    }).workspace;
    expect(reordered.placements.every((placement) => placement.inherited)).toBe(true);
    expect(reordered.placements.every((placement) => !placement.orderInherited)).toBe(true);

    const copied = executeCmsCommand(client, {
      kind: 'editPlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"HUD copy for {{ store.name }}"}',
    }).workspace;
    expect(
      copied.placements.find((placement) => placement.placementKey === 'primary-hero')
    ).toMatchObject({ inherited: false });
    expect(
      copied.placements.find((placement) => placement.placementKey === 'primary-hero')
        ?.blockVersionId
    ).not.toBe(inheritedVersion);

    const hidden = executeCmsCommand(client, {
      kind: 'deletePlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
      placementKey: 'primary-hero',
    }).workspace;
    expect(hidden.tombstones.map((entry) => entry.placementKey)).toContain('primary-hero');
    const reverted = executeCmsCommand(client, {
      kind: 'revertPlacement',
      scenarioId: 'stores',
      scopeId: linkedScope,
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

  test('rolls back a mutation when the returned projection detects a priority conflict', () => {
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
      placementKey: 'primary-hero',
      blockTypeKey: 'hero',
      contentJson: '{"headline":"First winner"}',
    });
    const revisionBefore = client.sqlite
      .query<{ revisionId: string }, [string]>(
        'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
      )
      .get(second.scopeId)?.revisionId;

    expect(() =>
      executeCmsCommand(client, {
        kind: 'editPlacement',
        scenarioId: 'stores',
        scopeId: second.scopeId,
        placementKey: 'primary-hero',
        blockTypeKey: 'hero',
        contentJson: '{"headline":"Conflicting winner"}',
      })
    ).toThrow();

    expect(
      client.sqlite
        .query<{ revisionId: string }, [string]>(
          'SELECT active_revision_id AS revisionId FROM variants WHERE id = ?'
        )
        .get(second.scopeId)?.revisionId
    ).toBe(revisionBefore);
    expect(
      readCmsWorkspace(client, 'stores', second.scopeId).placements.find(
        (placement) => placement.placementKey === 'primary-hero'
      )
    ).toMatchObject({ inherited: true });
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
