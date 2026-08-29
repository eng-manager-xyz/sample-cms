import { describe, expect, test } from 'bun:test';
import {
  copyOnWritePlacement,
  detectVariantConflicts,
  orderPlacement,
  ResolutionError,
  resolveDocument,
  revertPlacement,
  setPlacement,
  tombstonePlacement,
  VariantConflictError,
} from './resolution';
import type {
  BlockVersion,
  DefaultDocument,
  DocumentPlacement,
  VariantLayer,
  VariantOperation,
} from './types';

function version(id: string, blockType: string, text = id): BlockVersion {
  return {
    id,
    lineageId: `lineage:${id}`,
    blockType,
    schemaVersion: 1,
    content: { text },
  };
}

function placement(
  placementKey: string,
  order: number,
  blockVersion: BlockVersion
): DocumentPlacement {
  return { placementKey, order, blockVersion };
}

function seededShuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  let state = seed >>> 0;
  const random = (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const value = result[index];
    result[index] = result[swapIndex] as T;
    result[swapIndex] = value as T;
  }
  return result;
}

const storeDefault: DefaultDocument = {
  templateId: 'store',
  placements: [
    placement('navigation', 10, version('nav:v1', 'navigation')),
    placement('primary-hero', 20, version('hero:default:v1', 'hero', 'I am {{ store.name }}')),
    placement('category-promo', 30, version('promo:default:v1', 'promo')),
    placement('footer', 40, version('footer:default:v1', 'footer')),
  ],
};

const composingLayers: readonly VariantLayer[] = [
  {
    id: 'chain-stores',
    priority: 10,
    operations: [setPlacement('footer', version('footer:chain:v1', 'footer'))],
  },
  {
    id: 'fast-food',
    priority: 20,
    operations: [setPlacement('category-promo', version('promo:fast-food:v1', 'promo'))],
  },
  {
    id: 'mcdonalds',
    priority: 30,
    operations: [
      setPlacement(
        'primary-hero',
        version('hero:mcdonalds:v1', 'hero', 'Buy now {{ store.name }} — {{ store.location }}')
      ),
    ],
  },
];

describe("McDonald's composing layers", () => {
  test('composes independent sparse contributions and records their provenance', () => {
    const result = resolveDocument(storeDefault, composingLayers);
    expect(result.placements.map((item) => item.blockVersion.id)).toEqual([
      'nav:v1',
      'hero:mcdonalds:v1',
      'promo:fast-food:v1',
      'footer:chain:v1',
    ]);
    expect(result.placements.map((item) => item.provenance.content.sourceId)).toEqual([
      'default:store',
      'mcdonalds',
      'fast-food',
      'chain-stores',
    ]);
    expect(result.matchedVariantIds).toEqual(['chain-stores', 'fast-food', 'mcdonalds']);
  });

  test('is invariant to default, layer, and operation input order over randomized trials', () => {
    const expected = resolveDocument(storeDefault, composingLayers);
    for (let seed = 1; seed <= 200; seed += 1) {
      const shuffledDefault = {
        ...storeDefault,
        placements: seededShuffle(storeDefault.placements, seed),
      };
      const shuffledLayers = seededShuffle(composingLayers, seed + 1000).map((layer, index) => ({
        ...layer,
        operations: seededShuffle(layer.operations, seed + index + 2000),
      }));
      const actual = resolveDocument(shuffledDefault, shuffledLayers);
      expect(actual.contentHash).toBe(expected.contentHash);
      expect(actual.placements).toEqual(expected.placements);
      expect(actual.tombstones).toEqual(expected.tombstones);
    }
  });
});

describe('variant operations', () => {
  test('copy-on-write creates a new immutable pointer without changing the inherited placement', () => {
    const inherited = storeDefault.placements[1];
    if (!inherited) {
      throw new Error('fixture missing inherited placement');
    }
    const copied = copyOnWritePlacement(inherited, {
      id: 'hero:mcdonalds:v2',
      content: { text: 'A changed hero' },
    });
    expect(copied.blockVersion).toEqual({
      ...inherited.blockVersion,
      id: 'hero:mcdonalds:v2',
      content: { text: 'A changed hero' },
    });
    expect(copied.operation).toEqual({
      kind: 'set',
      placementKey: 'primary-hero',
      blockVersion: copied.blockVersion,
    });
    expect(inherited.blockVersion.content).toEqual({ text: 'I am {{ store.name }}' });
    expect(() =>
      copyOnWritePlacement(inherited, {
        id: inherited.blockVersion.id,
        content: { text: 'illegal mutation' },
      })
    ).toThrow('new block version ID');
  });

  test('tombstone hides lower content while revert removes the local decision', () => {
    const operation = tombstonePlacement('category-promo');
    const hidden = resolveDocument(storeDefault, [
      { id: 'hide-promo', priority: 10, operations: [operation] },
    ]);
    expect(hidden.placements.some((item) => item.placementKey === 'category-promo')).toBe(false);
    expect(hidden.tombstones[0]).toMatchObject({
      placementKey: 'category-promo',
      source: { sourceId: 'hide-promo' },
      hiddenPlacement: { blockVersion: { id: 'promo:default:v1' } },
    });

    const reverted = resolveDocument(storeDefault, [
      {
        id: 'hide-promo',
        priority: 10,
        operations: revertPlacement([operation], 'category-promo'),
      },
    ]);
    expect(
      reverted.placements.find((item) => item.placementKey === 'category-promo')
    ).toMatchObject({ blockVersion: { id: 'promo:default:v1' } });
  });

  test('an order operation changes order without manufacturing a content version', () => {
    const result = resolveDocument(storeDefault, [
      { id: 'hero-first', priority: 10, operations: [orderPlacement('primary-hero', 1)] },
    ]);
    expect(result.placements[0]).toMatchObject({
      placementKey: 'primary-hero',
      blockVersion: { id: 'hero:default:v1' },
      provenance: {
        content: { sourceId: 'default:store' },
        order: { sourceId: 'hero-first' },
      },
    });
  });

  test('a variant can insert and order a placement regardless of operation array order', () => {
    const operations: readonly VariantOperation[] = [
      orderPlacement('local-banner', 15),
      setPlacement('local-banner', version('banner:v1', 'banner')),
    ];
    const result = resolveDocument(storeDefault, [
      { id: 'local-banner', priority: 10, operations },
    ]);
    expect(result.placements[1]).toMatchObject({
      placementKey: 'local-banner',
      blockVersion: { id: 'banner:v1' },
    });
    expect(() =>
      resolveDocument(storeDefault, [
        { id: 'bad-order', priority: 10, operations: [orderPlacement('missing', 1)] },
      ])
    ).toThrow(ResolutionError);
  });

  test('a higher set can reintroduce content hidden by a lower tombstone', () => {
    const result = resolveDocument(storeDefault, [
      { id: 'hide', priority: 10, operations: [tombstonePlacement('footer')] },
      {
        id: 'reintroduce',
        priority: 20,
        operations: [setPlacement('footer', version('footer:special:v1', 'footer'))],
      },
    ]);
    expect(result.placements.at(-1)).toMatchObject({
      placementKey: 'footer',
      order: 40,
      blockVersion: { id: 'footer:special:v1' },
    });
    expect(result.tombstones).toEqual([]);
  });
});

describe('explicit-priority conflict detection', () => {
  test('allows same-priority variants to touch different placements', () => {
    const variants: readonly VariantLayer[] = [
      {
        id: 'one',
        priority: 10,
        operations: [setPlacement('primary-hero', version('hero:a', 'hero'))],
      },
      {
        id: 'two',
        priority: 10,
        operations: [setPlacement('footer', version('footer:a', 'footer'))],
      },
    ];
    expect(detectVariantConflicts(variants)).toEqual([]);
    expect(() => resolveDocument(storeDefault, variants)).not.toThrow();
  });

  test('fails same-priority overlap even when the operation kinds differ', () => {
    const variants: readonly VariantLayer[] = [
      {
        id: 'created-first-but-irrelevant',
        priority: 10,
        operations: [setPlacement('primary-hero', version('hero:a', 'hero'))],
      },
      {
        id: 'row-id-0001-also-irrelevant',
        priority: 10,
        operations: [orderPlacement('primary-hero', 1)],
      },
    ];
    expect(detectVariantConflicts(variants)).toEqual([
      {
        priority: 10,
        placementKey: 'primary-hero',
        variantIds: ['created-first-but-irrelevant', 'row-id-0001-also-irrelevant'],
        operationKinds: ['order', 'set'],
      },
    ]);
    expect(() => resolveDocument(storeDefault, variants)).toThrow(VariantConflictError);
  });

  test('rejects duplicate local content or order operations instead of using array order', () => {
    expect(() =>
      resolveDocument(storeDefault, [
        {
          id: 'invalid',
          priority: 10,
          operations: [
            setPlacement('footer', version('footer:a', 'footer')),
            tombstonePlacement('footer'),
          ],
        },
      ])
    ).toThrow('duplicate content');
  });
});

describe('structural replacement', () => {
  test('replaces a block type while preserving the placement key and at least 90% inheritance', () => {
    const placements = Array.from({ length: 25 }, (_, index) =>
      placement(
        index === 0 ? 'primary-hero' : `placement-${index.toString().padStart(2, '0')}`,
        index * 10,
        version(`block:${index}:v1`, index === 0 ? 'hero' : 'content')
      )
    );
    const document: DefaultDocument = { templateId: 'long-form', placements };
    const result = resolveDocument(document, [
      {
        id: 'structural-experiment',
        priority: 50,
        operations: [
          setPlacement('primary-hero', version('hero-alt:v1', 'hero_alt')),
          orderPlacement('primary-hero', 5),
          tombstonePlacement('placement-24'),
        ],
      },
    ]);
    const hero = result.placements.find((item) => item.placementKey === 'primary-hero');
    expect(hero).toMatchObject({
      placementKey: 'primary-hero',
      blockVersion: { blockType: 'hero_alt' },
    });
    const inheritedCount = result.placements.filter(
      (item) => item.provenance.content.kind === 'default'
    ).length;
    expect(inheritedCount / placements.length).toBeGreaterThanOrEqual(0.9);
    expect(result.tombstones).toHaveLength(1);
  });
});
