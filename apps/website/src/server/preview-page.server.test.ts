import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';
import { ensureCompactPublishedScenarios } from '@repo/cms-scenarios/compact-seed';
import { CmsService } from '@repo/cms-service';
import { readPreviewPage } from './preview-page.server';

let client: CmsDatabaseClient;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
  ensureCompactPublishedScenarios(client);
});

afterEach(() => client.close());

function readStorePreview(canonicalUrl = '/en-US/store/1001') {
  return readPreviewPage(client, {
    canonicalUrl,
    host: 'localhost:3001',
    nodeEnv: 'test',
    previewEnabled: false,
  });
}

describe('SQLite preview boundary', () => {
  test('shows an unpublished authoring revision while serving the prior immutable publication', () => {
    const service = new CmsService(client, {
      now: () => '2026-08-29T20:00:00.000Z',
      createId: (scope) => `preview-only:${scope}`,
    });
    const publishedBefore = service.serve('tpl-store', '/en-US/store/1001');
    expect(publishedBefore.status).toBe(200);
    if (publishedBefore.status !== 200) throw new Error('Expected the seeded Store publication.');

    const authoringChange = service.copyOnWritePlacement(
      'tpl-store',
      'variant-store-mcdonalds',
      'page-store-1001',
      'primary-hero',
      {
        revisionId: 'revision-store-mcdonalds-preview-only',
        blockVersionId: 'block-store-hero-preview-only',
        content: { headline: 'Preview only {{ store.name }} — {{ store.location }}' },
        createdBy: 'preview-isolation-test',
      }
    );

    const preview = readStorePreview();
    expect(preview.status).toBe(200);
    if (preview.status !== 200) throw new Error('Expected the draft preview.');
    const previewHero = preview.page.placements.find(
      (placement) => placement.placementKey === 'primary-hero'
    );
    expect(previewHero).toMatchObject({
      blockVersionId: 'block-store-hero-preview-only',
      content: { headline: "Preview only McDonald's Market — San Francisco" },
      provenance: {
        content: {
          sourceRevisionId: authoringChange.revision.id,
          sourcePriority: 30,
        },
      },
    });

    const publishedAfter = service.serve('tpl-store', '/en-US/store/1001');
    expect(publishedAfter).toEqual(publishedBefore);
    if (publishedAfter.status !== 200) throw new Error('Expected the active publication.');
    expect(
      publishedAfter.document.placements.find(
        (placement) => placement.placementKey === 'primary-hero'
      )?.content
    ).toEqual({ headline: "Buy now McDonald's Market — San Francisco" });
  });

  test('maps unsupported and absent canonical pages to explicit 404 results', () => {
    expect(readStorePreview('/en-US/not-a-cms-pattern')).toEqual({
      status: 404,
      reason: 'missing',
    });
    expect(readStorePreview('/en-US/store/9999')).toEqual({
      status: 404,
      reason: 'missing',
    });
  });

  test('fails closed in production and rejects a canonical-path host mismatch', () => {
    expect(
      readPreviewPage(client, {
        canonicalUrl: '/en-US/store/1001',
        host: 'www.ubereats.com',
        nodeEnv: 'production',
        previewEnabled: false,
      })
    ).toEqual({ status: 404, reason: 'missing' });
    expect(
      readPreviewPage(client, {
        canonicalUrl: '/en-US/store/1001',
        host: 'www.uber.com',
        nodeEnv: 'production',
        previewEnabled: true,
      })
    ).toEqual({ status: 404, reason: 'missing' });
    expect(
      readPreviewPage(client, {
        canonicalUrl: '/en-US/store/1001',
        host: 'www.ubereats.com',
        nodeEnv: 'production',
        previewEnabled: true,
      }).status
    ).toBe(200);
  });
});
