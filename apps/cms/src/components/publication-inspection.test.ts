import { describe, expect, test } from 'bun:test';

import { filterPublicationHistory } from '@/components/publication-inspection';
import type { CmsPublicationHistoryRow } from '@/data/sqlite-authoring';

function publicationRow(
  overrides: Partial<CmsPublicationHistoryRow> = {}
): CmsPublicationHistoryRow {
  return {
    id: 'publication-store-4',
    sequence: 4,
    status: 'published',
    inputHash: 'a'.repeat(64),
    previousPublicationId: 'publication-store-3',
    pageCount: 14,
    manifestCount: 4,
    createdBy: 'prototype-ui',
    publishedAt: '2026-08-30T12:00:00.000Z',
    createdAt: '2026-08-30T12:00:00.000Z',
    activatedAt: '2026-08-30T12:00:00.000Z',
    activatedBy: 'prototype-ui',
    isCurrent: true,
    isRollbackTarget: false,
    ...overrides,
  };
}

describe('AUT-557 release-history filters', () => {
  const rows = [
    publicationRow(),
    publicationRow({
      id: 'publication-store-3',
      sequence: 3,
      previousPublicationId: 'publication-store-2',
      activatedAt: null,
      activatedBy: null,
      isCurrent: false,
      isRollbackTarget: true,
    }),
    publicationRow({
      id: 'publication-store-2',
      sequence: 2,
      previousPublicationId: null,
      activatedAt: null,
      activatedBy: null,
      isCurrent: false,
      isRollbackTarget: false,
    }),
    publicationRow({
      id: 'publication-store-failed',
      sequence: 1,
      status: 'failed',
      previousPublicationId: null,
      pageCount: 0,
      manifestCount: 0,
      publishedAt: null,
      activatedAt: null,
      activatedBy: null,
      isCurrent: false,
      isRollbackTarget: false,
    }),
  ] as const satisfies readonly CmsPublicationHistoryRow[];

  test('isolates the active serving pointer', () => {
    expect(filterPublicationHistory(rows, 'active').map((row) => row.sequence)).toEqual([4]);
  });

  test('isolates only the exact retained predecessor', () => {
    expect(filterPublicationHistory(rows, 'rollback').map((row) => row.sequence)).toEqual([3]);
  });

  test('keeps older immutable history separate and preserves newest-first order', () => {
    expect(filterPublicationHistory(rows, 'history').map((row) => row.sequence)).toEqual([2]);
    expect(filterPublicationHistory(rows, 'failed').map((row) => row.id)).toEqual([
      'publication-store-failed',
    ]);
    expect(filterPublicationHistory(rows, 'all').map((row) => row.sequence)).toEqual([4, 3, 2, 1]);
    expect(rows.map((row) => row.sequence)).toEqual([4, 3, 2, 1]);
  });
});
