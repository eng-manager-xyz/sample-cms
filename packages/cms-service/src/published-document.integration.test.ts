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

test('rejects an incompatible legacy rollback target without moving the current pointer', async () => {
  const client = await createTestDatabase();
  try {
    await seedFoundationDatabase(client);
    const service = new CmsService(client, {
      now: () => '2026-08-29T12:00:00.000Z',
      createId: (scope) => `${scope}:rollback-contract-test`,
    });
    const current = service.publish('tpl-store', {
      id: 'publication-current-materialized',
      createdBy: 'test',
      forceNewPublication: true,
    });
    expect(current.previousPublicationId).toBe('publication-store-1');

    client.sqlite.exec(`
      DROP TRIGGER published_page_documents_immutable_update;
      UPDATE published_page_documents
      SET resolved_data_json = (
        SELECT pages.context_json
        FROM page_instances AS pages
        WHERE pages.template_id = published_page_documents.template_id
          AND pages.id = published_page_documents.page_instance_id
      )
      WHERE publication_id = 'publication-store-1';
      CREATE TRIGGER published_page_documents_immutable_update
      BEFORE UPDATE ON published_page_documents
      BEGIN
        SELECT RAISE(ABORT, 'published page documents are immutable');
      END;
    `);

    try {
      service.rollback('tpl-store', undefined, 'operator');
      throw new Error('Expected incompatible rollback materialization to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CmsServiceError);
      expect(error).toMatchObject({ code: 'PUBLICATION_FAILED' });
      if (!(error instanceof Error)) throw new Error('Expected a typed service error.');
      expect(error.message).toContain('incompatible materialization');
    }
    expect(
      client.sqlite
        .query<{ publicationId: string }, []>(
          `SELECT publication_id AS publicationId
           FROM current_publications WHERE template_id = 'tpl-store'`
        )
        .get()
    ).toEqual({ publicationId: current.publicationId });
    expect(service.serve('tpl-store', '/en-US/store/1001')).toMatchObject({
      status: 200,
      publicationId: current.publicationId,
    });
  } finally {
    client.close();
  }
});
