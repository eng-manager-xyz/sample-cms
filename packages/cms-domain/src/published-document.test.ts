import { describe, expect, test } from 'bun:test';
import {
  type PublishedDocument,
  PublishedDocumentSchema,
  parsePublishedDocument,
} from './published-document';
import type { JsonValue } from './types';

const validDocument = {
  templateId: 'tpl-store',
  pageId: 'page-store-1001',
  placements: [
    {
      placementKey: 'primary-hero',
      order: 0,
      blockType: 'hero',
      blockVersionId: 'block-store-hero-v2',
      content: { heading: 'Welcome', details: { featured: true }, items: [1, null] },
      provenance: {
        sourceRevisionId: 'revision-store-featured-1',
        sourceOperationId: 'operation-store-hero-set',
        sourcePriority: 20,
      },
    },
  ],
};

const acceptJsonValue = (value: JsonValue): JsonValue => value;

describe('PublishedDocumentSchema', () => {
  test('parses the materialized document contract as a JSON value', () => {
    const document: PublishedDocument = parsePublishedDocument(validDocument);

    expect(acceptJsonValue(document)).toEqual(validDocument);
  });

  test('rejects malformed placements and non-object content', () => {
    const invalid = PublishedDocumentSchema.safeParse({
      ...validDocument,
      placements: [
        {
          ...validDocument.placements[0],
          order: -1,
          content: ['not', 'an', 'object'],
        },
      ],
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          ['placements', 0, 'order'],
          ['placements', 0, 'content'],
        ])
      );
    }
  });

  test('rejects unknown persisted contract fields instead of silently stripping them', () => {
    expect(
      PublishedDocumentSchema.safeParse({
        ...validDocument,
        unsupportedContractField: true,
      }).success
    ).toBe(false);
  });

  test('rejects gaps and duplicate stable placement identities', () => {
    const firstPlacement = validDocument.placements[0];
    if (!firstPlacement) throw new Error('Expected the valid published placement fixture.');
    const duplicate = structuredClone(firstPlacement);
    duplicate.order = 2;

    const invalid = PublishedDocumentSchema.safeParse({
      ...validDocument,
      placements: [firstPlacement, duplicate],
    });

    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([
          ['placements', 1, 'order'],
          ['placements', 1, 'placementKey'],
        ])
      );
    }
  });
});
