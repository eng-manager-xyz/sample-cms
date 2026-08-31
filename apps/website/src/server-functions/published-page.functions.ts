import { createServerFn } from '@tanstack/react-start';
import { getRequestHost, setResponseHeader } from '@tanstack/react-start/server';
import type { PublicPageLoadResult } from '@/data/public-page';
import { PublicPageRequestSchema } from '@/data/public-path';
import { publishedResponseHeaders } from '@/data/published-page-policy';

export const loadPublishedPage = createServerFn({ method: 'GET' })
  .validator(PublicPageRequestSchema)
  .handler(async ({ data }): Promise<PublicPageLoadResult> => {
    const [{ createCmsDatabase }, { readPublishedPage }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/published-page.server'),
    ]);
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      const { result } = readPublishedPage(client, {
        canonicalUrl: data.canonicalUrl,
        host: getRequestHost(),
        nodeEnv: process.env.NODE_ENV,
        allowLocalhost: process.env.CMS_ALLOW_LOCAL_PUBLISHED_HOST === 'true',
      });
      if (result.status === 404) return result;
      for (const [name, value] of Object.entries(
        publishedResponseHeaders({
          documentHash: result.page.documentHash,
          publicationId: result.page.publicationId,
        })
      )) {
        setResponseHeader(name, value);
      }
      return result;
    } finally {
      client.close();
    }
  });
