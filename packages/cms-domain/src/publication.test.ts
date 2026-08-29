import { describe, expect, test } from 'bun:test';
import type { BlockVersion, DefaultDocument, PublicationPageInput } from './index';
import { compilePublication, PublicationError } from './publication';
import { resolveDocument, setPlacement } from './resolution';

function version(id: string, text = id): BlockVersion {
  return {
    id,
    lineageId: `lineage:${id}`,
    blockType: id.split(':')[0] ?? 'content',
    schemaVersion: 1,
    content: { text },
  };
}

const defaultDocument: DefaultDocument = {
  templateId: 'store',
  placements: [
    { placementKey: 'hero', order: 10, blockVersion: version('hero:v1', '{{ store.name }}') },
    { placementKey: 'footer', order: 20, blockVersion: version('footer:v1') },
  ],
};

function page(
  pageId: string,
  canonicalUrl: string,
  document = resolveDocument(defaultDocument, [])
): PublicationPageInput {
  return { pageId, canonicalUrl, document };
}

describe('publication manifest compilation', () => {
  test('deduplicates structural manifests while retaining one URL-to-page mapping', () => {
    const special = resolveDocument(defaultDocument, [
      {
        id: 'special-brand',
        priority: 10,
        operations: [setPlacement('hero', version('hero:special:v1'))],
      },
    ]);
    const publication = compilePublication([
      page('store-2', '/en-US/store/2'),
      page('store-1', '/en-US/store/1'),
      page('store-3', '/en-US/store/3', special),
    ]);

    expect(publication.pages.map((item) => item.pageId)).toEqual(['store-1', 'store-2', 'store-3']);
    expect(publication.manifests).toHaveLength(2);
    expect(publication.pages[0]?.manifestId).toBe(publication.pages[1]?.manifestId);
    expect(publication.pages[2]?.manifestId).not.toBe(publication.pages[0]?.manifestId);
    expect(publication.metrics).toMatchObject({
      pageCount: 3,
      uniqueManifestCount: 2,
      reusedPageCount: 1,
      manifestReuseRatio: 1.5,
      deduplicatedPageRatio: 1 / 3,
      expandedPlacementCount: 6,
      storedPlacementCount: 4,
      savedPlacementCount: 2,
      savedPlacementRatio: 1 / 3,
    });
    expect(publication.metrics.savedManifestBytes).toBeGreaterThan(0);
  });

  test('is deterministic for randomized page input order', () => {
    const pages = Array.from({ length: 50 }, (_, index) =>
      page(`store-${index}`, `/en-US/store/${index.toString().padStart(3, '0')}`)
    );
    const expected = compilePublication(pages);
    for (let offset = 0; offset < 50; offset += 1) {
      const rotated = [...pages.slice(offset), ...pages.slice(0, offset)].reverse();
      expect(compilePublication(rotated)).toEqual(expected);
    }
    expect(expected.metrics.uniqueManifestCount).toBe(1);
    expect(expected.metrics.savedPlacementCount).toBe(98);
  });

  test('rejects duplicate canonical URLs and page IDs', () => {
    expect(() => compilePublication([page('one', '/same'), page('two', '/same')])).toThrow(
      PublicationError
    );
    expect(() => compilePublication([page('one', '/one'), page('one', '/two')])).toThrow(
      PublicationError
    );
  });

  test('rejects an immutable block version ID that has two different values', () => {
    const conflictingDefault: DefaultDocument = {
      ...defaultDocument,
      placements: [
        {
          placementKey: 'hero',
          order: 10,
          blockVersion: version('hero:v1', 'different content under same immutable ID'),
        },
      ],
    };
    expect(() =>
      compilePublication([
        page('one', '/one'),
        page('two', '/two', resolveDocument(conflictingDefault, [])),
      ])
    ).toThrow('more than one value');
  });

  test('keeps identical structure template-scoped', () => {
    const other = resolveDocument({ ...defaultDocument, templateId: 'eligible-vehicles' }, []);
    expect(
      compilePublication([page('one', '/one'), page('two', '/two', other)]).manifests
    ).toHaveLength(2);
  });

  test('reports zeroed metrics for an empty publication', () => {
    expect(compilePublication([]).metrics).toEqual({
      pageCount: 0,
      uniqueManifestCount: 0,
      reusedPageCount: 0,
      manifestReuseRatio: 0,
      deduplicatedPageRatio: 0,
      expandedPlacementCount: 0,
      storedPlacementCount: 0,
      savedPlacementCount: 0,
      savedPlacementRatio: 0,
      expandedManifestBytes: 0,
      storedManifestBytes: 0,
      savedManifestBytes: 0,
      manifestReuse: [],
    });
  });
});
