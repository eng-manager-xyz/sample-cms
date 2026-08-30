import { createServerFn } from '@tanstack/react-start';
import { ContentExplorerInputSchema, type ContentExplorerSnapshot } from '@/data/content-explorer';

export const loadContentExplorer = createServerFn({ method: 'GET' })
  .validator(ContentExplorerInputSchema)
  .handler(async ({ data }): Promise<ContentExplorerSnapshot> => {
    const [{ createCmsDatabase }, { readContentExplorer }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/content-explorer.server'),
    ]);
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      return readContentExplorer(client, data);
    } finally {
      client.close();
    }
  });
