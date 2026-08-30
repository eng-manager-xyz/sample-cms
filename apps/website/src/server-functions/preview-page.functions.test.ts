import { describe, expect, test } from 'bun:test';
import { previewResponseHeaders } from '@/data/preview-page-policy';

describe('preview response policy', () => {
  test('is private, uncacheable, and excluded from search indexing', () => {
    expect(previewResponseHeaders).toEqual({
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      Vary: 'Host',
    });
  });
});
