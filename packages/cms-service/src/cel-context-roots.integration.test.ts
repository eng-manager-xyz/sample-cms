import { expect, test } from 'bun:test';
import { seedFoundationDatabase } from '@repo/cms-db';
import { createTestDatabase } from '@repo/cms-db/testing';

import { CmsService } from './index';

test('unions legacy top-level CEL aliases across heterogeneous page contexts', async () => {
  const client = await createTestDatabase();
  try {
    await seedFoundationDatabase(client);
    const service = new CmsService(client);
    expect(
      service.inspectBlockFieldInterpolation('tpl-store', 'page-store-1001', '{{ marketName }}')
    ).toMatchObject({ success: false, error: { code: 'UNKNOWN_ROOT' } });
    service.createPage('tpl-store', {
      id: 'page-store-heterogeneous-context',
      canonicalUrl: '/en-US/store/1003',
      routeExternalId: 'router-store-heterogeneous-context',
      routeStatus: 'live',
      routeRevision: 'store-seed-v2',
      context: {
        locale: 'en-US',
        marketName: 'South Bay',
        store: { id: 1003, name: 'Third Kitchen', location: 'San Jose' },
      },
      slotValues: {
        locale: 'en-US',
        store_id: 1003,
        store_name: 'Third Kitchen',
      },
    });

    expect(
      service.inspectBlockFieldInterpolation(
        'tpl-store',
        'page-store-heterogeneous-context',
        '{{ marketName + " merchant" }}'
      )
    ).toMatchObject({
      success: true,
      dependencies: ['marketName'],
      evaluatedSample: 'South Bay merchant',
    });
    expect(
      service.inspectBlockFieldInterpolation(
        'tpl-store',
        'page-store-heterogeneous-context',
        '{{ context.marketName }}'
      )
    ).toMatchObject({
      success: true,
      dependencies: ['context.marketName'],
      evaluatedSample: 'South Bay',
    });
    service.forkBlockVersion('tpl-store', {
      id: 'block-store-navigation-heterogeneous-context',
      sourceVersionId: 'block-store-navigation-v1',
      content: { label: '{{ marketName }}' },
      createdBy: 'author',
    });
    expect(
      service.getBlockVersion('tpl-store', 'block-store-navigation-heterogeneous-context')?.content
    ).toEqual({ label: '{{ marketName }}' });
  } finally {
    client.close();
  }
});
