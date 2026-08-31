import { describe, expect, test } from 'bun:test';

import {
  buildGuidedSelector,
  type SelectorBuilder,
  type SelectorField,
  SelectorWorkspacePreviewInputSchema,
} from './selector-workspace';
import { CmsCommandSchema } from './sqlite-authoring';

const fields: readonly SelectorField[] = [
  {
    name: 'tag.brand',
    kind: 'tag',
    cardinality: 'multi',
    valueType: 'string',
    sourceKey: 'brand',
  },
  {
    name: 'slot.store_id',
    kind: 'slot',
    cardinality: 'scalar',
    valueType: 'integer',
    sourceKey: 'store_id',
  },
  {
    name: 'route_status',
    kind: 'builtin',
    cardinality: 'scalar',
    valueType: 'string',
    sourceKey: 'route_status',
  },
];

function builder(overrides: Partial<SelectorBuilder> = {}): SelectorBuilder {
  return {
    combinator: 'AND',
    clauses: [
      { id: 'brand', field: 'tag.brand', operator: '=', value: "mcdonald's" },
      { id: 'stores', field: 'slot.store_id', operator: 'IN', value: '1001, 1002' },
    ],
    ...overrides,
  };
}

describe('AUT-542 guided selector builder', () => {
  test('emits the constrained predicate grammar with escaped and typed values', () => {
    expect(buildGuidedSelector(builder(), fields)).toBe(
      "tag.brand = 'mcdonald''s' AND slot.store_id IN (1001, 1002)"
    );
  });

  test('supports explicit OR without changing clause order', () => {
    expect(
      buildGuidedSelector(
        builder({
          combinator: 'OR',
          clauses: [
            { id: 'one', field: 'route_status', operator: '=', value: 'live' },
            { id: 'two', field: 'tag.brand', operator: '=', value: 'burger_king' },
          ],
        }),
        fields
      )
    ).toBe("route_status = 'live' OR tag.brand = 'burger_king'");
  });

  test('rejects unknown fields and malformed typed values before preview', () => {
    expect(() =>
      buildGuidedSelector(
        builder({ clauses: [{ id: 'secret', field: 'secrets', operator: '=', value: 'x' }] }),
        fields
      )
    ).toThrow('not approved');
    expect(() =>
      buildGuidedSelector(
        builder({
          clauses: [{ id: 'unsafe-number', field: 'slot.store_id', operator: '=', value: '1.5' }],
        }),
        fields
      )
    ).toThrow('safe integer');
  });

  test('validates bounded server preview inputs', () => {
    expect(
      SelectorWorkspacePreviewInputSchema.safeParse({
        scenarioId: 'stores',
        selector: "brand = 'mcdonalds'",
        priority: 30,
      }).success
    ).toBe(true);
    expect(
      SelectorWorkspacePreviewInputSchema.safeParse({
        scenarioId: 'stores',
        selector: 'DROP TABLE variants',
        priority: 0,
        sampleLimit: 100,
      }).success
    ).toBe(false);
  });

  test('requires an explicit source only for duplicate creation', () => {
    const duplicate = {
      kind: 'createVariant',
      scenarioId: 'stores',
      name: 'Duplicate',
      selector: "brand = 'mcdonalds'",
      priority: 40,
      mode: 'duplicate',
      expectedMatchSetFingerprint: '0'.repeat(64),
    };
    expect(CmsCommandSchema.safeParse(duplicate).success).toBe(false);
    expect(
      CmsCommandSchema.safeParse({
        ...duplicate,
        duplicateSourceScopeId: 'variant-store-mcdonalds',
      }).success
    ).toBe(true);
  });

  test('accepts an explicit stable selector key and impact-preview guard', () => {
    const reviewedCommand = {
      kind: 'createVariant',
      scenarioId: 'new-store-template',
      name: 'California premium',
      key: 'california-premium',
      selector: "locale = 'en-US' AND slug = 'premium'",
      priority: 50,
      mode: 'linked',
      expectedNormalizedSelector: "locale = 'en-US' AND slug = 'premium'",
      expectedMatchCount: 12,
    } as const;
    expect(CmsCommandSchema.safeParse(reviewedCommand).success).toBe(false);
    expect(
      CmsCommandSchema.safeParse({
        ...reviewedCommand,
        expectedMatchSetFingerprint: '1'.repeat(64),
      }).success
    ).toBe(true);
    expect(
      CmsCommandSchema.safeParse({
        kind: 'createVariant',
        scenarioId: 'new-store-template',
        name: 'Bad key',
        key: 'Bad Key',
        selector: 'TRUE',
        priority: 50,
        mode: 'linked',
        expectedMatchSetFingerprint: '2'.repeat(64),
      }).success
    ).toBe(false);
  });

  test('requires the exact canonical page on every placement mutation command', () => {
    const commands = [
      {
        kind: 'addPlacement',
        scenarioId: 'stores',
        scopeId: 'default-store',
        placementKey: 'new-promo',
        blockTypeKey: 'promo',
        contentJson: '{"message":"New"}',
      },
      {
        kind: 'editPlacement',
        scenarioId: 'stores',
        scopeId: 'default-store',
        placementKey: 'primary-hero',
        blockTypeKey: 'hero',
        contentJson: '{"headline":"Edited"}',
      },
      {
        kind: 'movePlacement',
        scenarioId: 'stores',
        scopeId: 'default-store',
        placementKey: 'footer',
        direction: 'up',
      },
      {
        kind: 'revertOrder',
        scenarioId: 'stores',
        scopeId: 'variant-store-mcdonalds',
      },
      {
        kind: 'deletePlacement',
        scenarioId: 'stores',
        scopeId: 'default-store',
        placementKey: 'primary-hero',
      },
      {
        kind: 'revertPlacement',
        scenarioId: 'stores',
        scopeId: 'variant-store-mcdonalds',
        placementKey: 'primary-hero',
      },
    ];

    for (const command of commands) {
      expect(CmsCommandSchema.safeParse(command).success).toBe(false);
      expect(
        CmsCommandSchema.safeParse({
          ...command,
          canonicalUrl: '/en-US/store/1001',
        }).success
      ).toBe(true);
    }
  });
});
