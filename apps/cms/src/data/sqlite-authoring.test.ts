import { describe, expect, test } from 'bun:test';

import {
  CmsPublicationPreflightInputSchema,
  CmsPublishPublicationInputSchema,
  CmsRollbackPublicationInputSchema,
} from './sqlite-authoring';

describe('AUT-543 publication lifecycle boundary schemas', () => {
  test('accepts bounded preflight context and rejects unbounded samples', () => {
    expect(
      CmsPublicationPreflightInputSchema.parse({
        scenarioId: 'stores',
        scopeId: 'tpl-store:default',
        canonicalUrl: '/en-US/store/1001',
        sampleLimit: 10,
      })
    ).toEqual({
      scenarioId: 'stores',
      scopeId: 'tpl-store:default',
      canonicalUrl: '/en-US/store/1001',
      sampleLimit: 10,
    });
    expect(
      CmsPublicationPreflightInputSchema.safeParse({
        scenarioId: 'stores',
        sampleLimit: 101,
      }).success
    ).toBe(false);
  });

  test('requires the reviewed draft hash and an explicit current pointer for publish', () => {
    expect(
      CmsPublishPublicationInputSchema.safeParse({
        scenarioId: 'stores',
        inputHash: 'a'.repeat(64),
        expectedCurrentPublicationId: 'publication-store-1',
      }).success
    ).toBe(true);
    for (const invalid of [
      { scenarioId: 'stores', inputHash: 'not-a-hash' },
      { scenarioId: 'stores', inputHash: 'a'.repeat(64) },
    ]) {
      expect(CmsPublishPublicationInputSchema.safeParse(invalid).success).toBe(false);
    }
  });

  test('requires exact non-null current and target publication IDs for rollback', () => {
    expect(
      CmsRollbackPublicationInputSchema.safeParse({
        scenarioId: 'stores',
        targetPublicationId: 'publication-store-1',
        expectedCurrentPublicationId: 'publication-store-2',
      }).success
    ).toBe(true);
    expect(
      CmsRollbackPublicationInputSchema.safeParse({
        scenarioId: 'stores',
        targetPublicationId: 'publication-store-1',
        expectedCurrentPublicationId: null,
      }).success
    ).toBe(false);
  });
});
