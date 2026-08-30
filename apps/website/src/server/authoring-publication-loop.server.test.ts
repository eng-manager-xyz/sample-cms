import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type CmsDatabaseClient,
  createCmsDatabase,
  runMigrations,
  seedFoundationDatabase,
} from '@repo/cms-db';
import { ensureCompactPublishedScenarios } from '@repo/cms-scenarios/compact-seed';
import { CmsService } from '@repo/cms-service';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublishedPage } from '@/components/published-page';
import { previewResponseHeaders } from '@/data/preview-page-policy';
import { createPublicPageViewModel } from '@/data/public-page';
import { PublicPageRequestSchema, resolvePublicTemplate } from '@/data/public-path';
import { publishedResponseHeaders } from '@/data/published-page-policy';
import { readPreviewPage } from './preview-page.server';

const ACTOR = 'aut-543-cross-app-test';

const examples = [
  {
    id: 'store',
    templateId: 'tpl-store',
    canonicalUrl: '/en-US/store/1001',
  },
  {
    id: 'eligible',
    templateId: 'eligible-vehicles',
    canonicalUrl: '/en-US/eligible-vehicles/ca/premium',
  },
  {
    id: 'structural',
    templateId: 'structural-marketing',
    canonicalUrl: '/en-US/airport/hero-alt',
  },
] as const;

let client: CmsDatabaseClient | null;
let databaseDirectory: string;
let databasePath: string;

beforeEach(async () => {
  databaseDirectory = mkdtempSync(join(tmpdir(), 'auteur-aut-543-loop-'));
  databasePath = join(databaseDirectory, 'authoring.sqlite');
  client = createCmsDatabase({ databasePath });
  await runMigrations(client);
  await seedFoundationDatabase(client);
  ensureCompactPublishedScenarios(client);
});

afterEach(() => {
  client?.close();
  client = null;
  rmSync(databaseDirectory, { recursive: true, force: true });
});

function currentClient(): CmsDatabaseClient {
  if (!client) throw new Error('Expected an open AUT-543 test database.');
  return client;
}

function reopenDatabase(readonly = false): CmsDatabaseClient {
  client?.close();
  client = createCmsDatabase({
    databasePath,
    create: false,
    readonly,
  });
  return client;
}

function publicationCount(templateId: string): number {
  return (
    currentClient()
      .sqlite.query<{ count: number }, [string]>(
        'SELECT count(*) AS count FROM publications WHERE template_id = ?'
      )
      .get(templateId)?.count ?? 0
  );
}

function publicSnapshot(templateId: string, canonicalUrl: string) {
  const evidence = new CmsService(currentClient()).serveWithEvidence(templateId, canonicalUrl);
  expect(evidence).toMatchObject({
    selectorSqlExecutions: 0,
    celEvaluations: 0,
  });
  expect(evidence.result.status).toBe(200);
  if (evidence.result.status !== 200) throw new Error('Expected a published page.');

  const template = resolvePublicTemplate(canonicalUrl);
  if (!template) throw new Error('Expected a mapped public template.');
  const page = createPublicPageViewModel({
    scenarioId: template.scenarioId,
    publicationId: evidence.result.publicationId,
    canonicalUrl: evidence.result.canonicalUrl,
    documentHash: evidence.result.documentHash,
    document: evidence.result.document,
  });

  return {
    evidence,
    page,
    documentBytes: JSON.stringify(evidence.result.document),
    websiteBytes: renderToStaticMarkup(createElement(PublishedPage, { page })),
  };
}

describe('AUT-543 persisted authoring to standalone website loop', () => {
  for (const example of examples) {
    test(`${example.canonicalUrl} saves, previews, publishes atomically, and rolls back exactly`, () => {
      const placementKey = `aut-543-${example.id}`;
      const addedMarker = `AUT543 ${example.id} added draft`;
      const editedMarker = `AUT543 ${example.id} edited draft`;
      const failedMarker = `AUT543 ${example.id} failed publication draft`;

      const initialPublic = publicSnapshot(example.templateId, example.canonicalUrl);
      expect(initialPublic.evidence).toMatchObject({
        selectorSqlExecutions: 0,
        celEvaluations: 0,
      });
      expect(initialPublic.evidence.sqlQueryCount).toBe(
        initialPublic.evidence.materializationMode === 'expanded' ? 1 : 2
      );
      expect(initialPublic.page.placements.some((item) => item.placementKey === placementKey)).toBe(
        false
      );

      const authoring = new CmsService(currentClient());
      const added = authoring.createDefaultPlacement(example.templateId, {
        revisionId: `revision-${placementKey}-add`,
        placementKey,
        lineage: {
          id: `lineage-${placementKey}`,
          key: placementKey,
          label: `AUT-543 ${example.id} lifecycle placement`,
        },
        blockVersionId: `block-${placementKey}-1`,
        blockTypeKey: 'promo',
        content: { message: addedMarker },
        createdBy: ACTOR,
        position: { kind: 'end' },
      });

      let reloadedAuthoring = new CmsService(reopenDatabase());
      expect(
        reloadedAuthoring
          .resolveDraftByCanonicalUrl(example.templateId, example.canonicalUrl)
          .renderedPlacements.find((item) => item.placementKey === placementKey)
      ).toMatchObject({
        blockVersionId: added.blockVersion.id,
        content: { message: addedMarker },
      });

      const edited = reloadedAuthoring.editDefaultPlacement(example.templateId, {
        revisionId: `revision-${placementKey}-edit`,
        placementKey,
        blockVersionId: `block-${placementKey}-2`,
        content: { message: editedMarker },
        createdBy: ACTOR,
      });
      expect(edited.blockVersion).toMatchObject({
        parentVersionId: added.blockVersion.id,
        versionNumber: 2,
      });

      const websiteDraftClient = reopenDatabase(true);
      const preview = readPreviewPage(websiteDraftClient, {
        canonicalUrl: example.canonicalUrl,
        host: 'localhost:3001',
        nodeEnv: 'test',
        previewEnabled: false,
      });
      expect(preview.status).toBe(200);
      if (preview.status !== 200) throw new Error('Expected the persisted draft preview.');
      expect(
        preview.page.placements.find((item) => item.placementKey === placementKey)
      ).toMatchObject({
        blockVersionId: edited.blockVersion.id,
        content: { message: editedMarker },
      });

      const publicBeforePublish = publicSnapshot(example.templateId, example.canonicalUrl);
      expect(publicBeforePublish.evidence.result).toEqual(initialPublic.evidence.result);
      expect(publicBeforePublish.documentBytes).toBe(initialPublic.documentBytes);
      expect(publicBeforePublish.websiteBytes).toBe(initialPublic.websiteBytes);
      expect(publicBeforePublish.websiteBytes).not.toContain(editedMarker);

      reloadedAuthoring = new CmsService(reopenDatabase());
      const preflight = reloadedAuthoring.preflightPublication(example.templateId, {
        sampleLimit: 100,
      });
      expect(preflight).toMatchObject({
        templateId: example.templateId,
        materializationMode: 'manifest',
        affectedActivePages: {
          count: preflight.totalActivePages,
          truncated: false,
        },
        issues: [],
        canPublish: true,
        reusesCurrentPublication: false,
        currentPublication: { id: initialPublic.page.publicationId },
      });
      expect(preflight.inputHash).toMatch(/^[a-f0-9]{64}$/);
      expect(preflight.affectedActivePages.sampleCanonicalUrls).toContain(example.canonicalUrl);
      expect(preflight.manifestReuse.eligibleManifestCount).toBeGreaterThan(0);
      expect(
        preflight.manifestReuse.reusedManifestCount + preflight.manifestReuse.newManifestCount
      ).toBe(preflight.manifestReuse.eligibleManifestCount);
      if (!preflight.inputHash || !preflight.currentPublication) {
        throw new Error('Expected a clean preflight with an active publication.');
      }
      const preflightInputHash = preflight.inputHash;
      const preflightCurrentPublicationId = preflight.currentPublication.id;
      const publication = reloadedAuthoring.publish(example.templateId, {
        id: `publication-${placementKey}`,
        createdBy: ACTOR,
        expectedInputHash: preflightInputHash,
        expectedCurrentPublicationId: preflightCurrentPublicationId,
      });
      expect(publication).toMatchObject({
        previousPublicationId: initialPublic.page.publicationId,
        reusedCurrentPublication: false,
        fromPublication: { id: initialPublic.page.publicationId },
      });

      reopenDatabase(true);
      const publicAfterPublish = publicSnapshot(example.templateId, example.canonicalUrl);
      expect(publicAfterPublish.page.publicationId).toBe(publication.publicationId);
      expect(publicAfterPublish.page.documentHash).not.toBe(initialPublic.page.documentHash);
      expect(publicAfterPublish.documentBytes).not.toBe(initialPublic.documentBytes);
      expect(publicAfterPublish.websiteBytes).toContain(editedMarker);
      expect(
        publishedResponseHeaders({
          documentHash: publicAfterPublish.page.documentHash,
          publicationId: publicAfterPublish.page.publicationId,
        })
      ).toEqual({
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
        ETag: `"${publicAfterPublish.page.documentHash}"`,
        'X-Auteur-Publication': publication.publicationId,
      });

      reloadedAuthoring = new CmsService(reopenDatabase());
      const activatedPreflight = reloadedAuthoring.preflightPublication(example.templateId);
      expect(activatedPreflight).toMatchObject({
        affectedActivePages: { count: 0 },
        issues: [],
        canPublish: true,
        reusesCurrentPublication: true,
        currentPublication: { id: publication.publicationId },
        rollbackTarget: {
          publication: { id: initialPublic.page.publicationId },
          valid: true,
          reason: null,
        },
      });
      expect(activatedPreflight.manifestReuse.reusedManifestCount).toBe(
        activatedPreflight.manifestReuse.eligibleManifestCount
      );

      const publicationRowsBeforeStaleWrite = publicationCount(example.templateId);
      expect(() =>
        reloadedAuthoring.publish(example.templateId, {
          id: `publication-${placementKey}-stale`,
          createdBy: ACTOR,
          forceNewPublication: true,
          expectedInputHash: preflightInputHash,
          expectedCurrentPublicationId: preflightCurrentPublicationId,
        })
      ).toThrow('Serving pointer changed after preflight');
      expect(publicationCount(example.templateId)).toBe(publicationRowsBeforeStaleWrite);
      reopenDatabase(true);
      const publicAfterStaleWrite = publicSnapshot(example.templateId, example.canonicalUrl);
      expect(publicAfterStaleWrite.page.publicationId).toBe(publicAfterPublish.page.publicationId);
      expect(publicAfterStaleWrite.page.documentHash).toBe(publicAfterPublish.page.documentHash);
      expect(publicAfterStaleWrite.documentBytes).toBe(publicAfterPublish.documentBytes);
      expect(publicAfterStaleWrite.websiteBytes).toBe(publicAfterPublish.websiteBytes);

      reloadedAuthoring = new CmsService(reopenDatabase());
      reloadedAuthoring.editDefaultPlacement(example.templateId, {
        revisionId: `revision-${placementKey}-failed`,
        placementKey,
        blockVersionId: `block-${placementKey}-3`,
        content: { message: failedMarker },
        createdBy: ACTOR,
      });
      const failedPreflight = reloadedAuthoring.preflightPublication(example.templateId);
      expect(failedPreflight).toMatchObject({
        issues: [],
        canPublish: true,
        reusesCurrentPublication: false,
        currentPublication: { id: publication.publicationId },
      });
      if (!failedPreflight.inputHash || !failedPreflight.currentPublication) {
        throw new Error('Expected the failed-publication draft to pass read-only preflight.');
      }
      const failedInputHash = failedPreflight.inputHash;
      const failedCurrentPublicationId = failedPreflight.currentPublication.id;
      const publicationRowsBeforeFailure = publicationCount(example.templateId);
      expect(() =>
        reloadedAuthoring.publish(example.templateId, {
          id: `publication-${placementKey}-failed`,
          createdBy: ACTOR,
          failAt: 'before-activation',
          forceNewPublication: true,
          expectedInputHash: failedInputHash,
          expectedCurrentPublicationId: failedCurrentPublicationId,
        })
      ).toThrow('Injected failure before activation.');
      expect(publicationCount(example.templateId)).toBe(publicationRowsBeforeFailure);

      reopenDatabase(true);
      const publicAfterFailure = publicSnapshot(example.templateId, example.canonicalUrl);
      expect(publicAfterFailure.page.publicationId).toBe(publicAfterPublish.page.publicationId);
      expect(publicAfterFailure.page.documentHash).toBe(publicAfterPublish.page.documentHash);
      expect(publicAfterFailure.documentBytes).toBe(publicAfterPublish.documentBytes);
      expect(publicAfterFailure.websiteBytes).toBe(publicAfterPublish.websiteBytes);
      expect(publicAfterFailure.websiteBytes).not.toContain(failedMarker);

      reloadedAuthoring = new CmsService(reopenDatabase());
      const rollback = reloadedAuthoring.rollback(example.templateId, {
        targetPublicationId: initialPublic.page.publicationId,
        expectedCurrentPublicationId: publication.publicationId,
        activatedBy: ACTOR,
      });
      expect(rollback).toMatchObject({
        fromPublicationId: publication.publicationId,
        publicationId: initialPublic.page.publicationId,
        fromPublication: { id: publication.publicationId },
        publication: { id: initialPublic.page.publicationId },
      });

      reopenDatabase(true);
      const publicAfterRollback = publicSnapshot(example.templateId, example.canonicalUrl);
      expect(publicAfterRollback.page.publicationId).toBe(initialPublic.page.publicationId);
      expect(publicAfterRollback.page.documentHash).toBe(initialPublic.page.documentHash);
      expect(publicAfterRollback.documentBytes).toBe(initialPublic.documentBytes);
      expect(publicAfterRollback.websiteBytes).toBe(initialPublic.websiteBytes);

      const previewAfterRollback = readPreviewPage(currentClient(), {
        canonicalUrl: example.canonicalUrl,
        host: 'localhost:3001',
        nodeEnv: 'test',
        previewEnabled: false,
      });
      expect(previewAfterRollback.status).toBe(200);
      if (previewAfterRollback.status !== 200) {
        throw new Error('Expected the saved draft to survive serving rollback.');
      }
      expect(
        previewAfterRollback.page.placements.find((item) => item.placementKey === placementKey)
          ?.content
      ).toEqual({ message: failedMarker });

      const routeWriter = new CmsService(reopenDatabase());
      const page = routeWriter.getPage(example.templateId, initialPublic.page.pageId);
      if (!page) throw new Error('Expected the canonical route authority row.');
      routeWriter.updatePage(example.templateId, page.id, { ...page, routeStatus: 'not_live' });
      const notLive = new CmsService(reopenDatabase(true)).serveWithEvidence(
        example.templateId,
        example.canonicalUrl
      );
      expect(notLive).toMatchObject({
        result: { status: 404, reason: 'not_live' },
        sqlQueryCount: 1,
        selectorSqlExecutions: 0,
        celEvaluations: 0,
      });
    });
  }

  test('keeps edit-mode out of public requests and preview responses private and unindexable', () => {
    expect(
      PublicPageRequestSchema.safeParse({
        canonicalUrl: '/en-US/store/1001?edit_mode=true',
      }).success
    ).toBe(false);
    expect(
      PublicPageRequestSchema.safeParse({
        canonicalUrl: '/en-US/store/1001',
        edit_mode: true,
      }).success
    ).toBe(false);
    expect(previewResponseHeaders).toEqual({
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      Vary: 'Host',
    });
  });
});
