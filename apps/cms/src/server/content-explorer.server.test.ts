import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type CmsDatabaseClient, seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';
import { ensureCompactPublishedScenarios } from '@repo/cms-scenarios/compact-seed';
import { CmsService } from '@repo/cms-service';
import { readContentExplorer } from './content-explorer.server';
import { readCmsWorkspace } from './sqlite-authoring.server';

let client: CmsDatabaseClient;

beforeEach(async () => {
  client = await createTestDatabase();
  await seedFoundationDatabase(client);
  ensureCompactPublishedScenarios(client);
});

afterEach(() => client.close());

describe('AUT-540 SQLite content explorer', () => {
  test('returns exactly the allowlisted persisted templates with counts and publication state', () => {
    new CmsService(client).createTemplate({
      id: 'rogue-template',
      key: 'rogue-template',
      name: 'Rogue template',
      domain: 'example.test',
      urlPattern: '/{slug}',
    });

    const snapshot = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 20,
    });

    expect(snapshot.templates.map((template) => template.slug)).toEqual([
      'stores',
      'eligible-vehicles',
      'structural-proof',
    ]);
    expect(snapshot.templates.some((template) => template.templateId === 'rogue-template')).toBe(
      false
    );
    expect(snapshot.templates[0]).toMatchObject({
      templateId: 'tpl-store',
      pageCount: 2,
      livePageCount: 2,
      variantCount: 4,
      publicationState: 'published',
      currentPublicationId: 'publication-store-1',
    });
    expect(snapshot.templates.every((template) => template.slots.length > 0)).toBe(true);
  });

  test('uses bounded bidirectional cursors without duplicate pages', () => {
    const first = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 1,
    });
    expect(first.pages).toHaveLength(1);
    expect(first.pages[0]?.canonicalUrl).toBe('/en-US/store/1001');
    expect(first.previousCursor).toBeNull();
    expect(first.nextCursor).not.toBeNull();

    const second = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.pages).toHaveLength(1);
    expect(second.pages[0]?.canonicalUrl).toBe('/en-US/store/1002');
    expect(second.pages[0]?.id).not.toBe(first.pages[0]?.id);
    expect(second.previousCursor).not.toBeNull();
    expect(second.nextCursor).toBeNull();

    const previous = readContentExplorer(client, {
      template: 'stores',
      q: '',
      limit: 1,
      cursor: second.previousCursor ?? undefined,
    });
    expect(previous.pages[0]?.id).toBe(first.pages[0]?.id);
    expect(previous.previousCursor).toBeNull();
    expect(previous.nextCursor).not.toBeNull();
  });

  test('searches canonical URLs in SQLite while retaining exact template counts', () => {
    const result = readContentExplorer(client, {
      template: 'stores',
      q: '1002',
      limit: 1,
    });

    expect(result.filteredCount).toBe(1);
    expect(result.pages.map((page) => page.canonicalUrl)).toEqual(['/en-US/store/1002']);
    expect(result.templates[0]?.pageCount).toBe(2);
  });

  test('rejects malformed cursors instead of falling back to an unbounded read', () => {
    expect(() =>
      readContentExplorer(client, {
        template: 'stores',
        q: '',
        limit: 20,
        cursor: 'not-a-content-cursor',
      })
    ).toThrow('invalid or expired');
  });

  test('resolves the canonical page selected by route search inside its template', () => {
    const workspace = readCmsWorkspace(client, 'stores', undefined, '/en-US/store/1002');
    expect(workspace).toMatchObject({
      templateId: 'tpl-store',
      pageId: 'page-store-1002',
      canonicalUrl: '/en-US/store/1002',
    });

    expect(() => readCmsWorkspace(client, 'stores', undefined, '/en-US/airport/hero-alt')).toThrow(
      'not found in the selected template'
    );
  });
});
