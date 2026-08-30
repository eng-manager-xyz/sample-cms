import { expect, test } from 'bun:test';
import { seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';

import { CmsService, CmsServiceError } from './index';

test('rejects an invalid persisted expanded document before serving it', async () => {
  const client = await createTestDatabase();
  try {
    await seedFoundationDatabase(client);
    const service = new CmsService(client, {
      now: () => '2026-08-29T12:00:00.000Z',
      createId: (scope) => `${scope}:published-contract-test`,
    });
    service.publish('tpl-store', {
      id: 'publication-invalid-expanded-contract',
      createdBy: 'test',
      materializationMode: 'expanded',
    });

    client.sqlite.exec('DROP TRIGGER published_page_documents_immutable_update');
    client.sqlite
      .query(
        `UPDATE published_page_documents
         SET rendered_document_json = ?
         WHERE publication_id = ? AND page_instance_id = ?`
      )
      .run(
        JSON.stringify({
          templateId: 'tpl-store',
          pageId: 'page-store-1001',
          placements: [{ placementKey: 'primary-hero', content: [] }],
        }),
        'publication-invalid-expanded-contract',
        'page-store-1001'
      );

    const reads = [
      () =>
        service.resolvePublication(
          'tpl-store',
          'publication-invalid-expanded-contract',
          '/en-US/store/1001'
        ),
      () => service.serve('tpl-store', '/en-US/store/1001'),
    ];
    for (const read of reads) {
      try {
        read();
        throw new Error('Expected invalid persisted publication data to fail.');
      } catch (error) {
        expect(error).toBeInstanceOf(CmsServiceError);
        expect(error).toMatchObject({ code: 'PUBLICATION_FAILED' });
        if (!(error instanceof Error)) {
          throw new Error('Expected a typed service error.');
        }
        expect(error.message).toContain('contract validation');
      }
    }
  } finally {
    client.close();
  }
});
