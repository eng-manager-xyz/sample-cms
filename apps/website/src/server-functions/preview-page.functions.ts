import { createServerFn } from '@tanstack/react-start';
import { getRequestHost, setResponseHeader, setResponseStatus } from '@tanstack/react-start/server';
import { type PreviewPageLoadResult, PreviewPageRequestSchema } from '@/data/preview-page';
import { previewResponseHeaders } from '@/data/preview-page-policy';

export const loadPreviewPage = createServerFn({ method: 'GET' })
  .validator(PreviewPageRequestSchema)
  .handler(async ({ data }): Promise<PreviewPageLoadResult> => {
    const [{ createCmsDatabase }, { readPreviewPage }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/preview-page.server'),
    ]);
    for (const [name, value] of Object.entries(previewResponseHeaders)) {
      setResponseHeader(name, value);
    }

    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      const result = readPreviewPage(client, {
        canonicalUrl: data.canonicalUrl,
        host: getRequestHost(),
        nodeEnv: process.env.NODE_ENV,
        previewEnabled: process.env.CMS_ENABLE_PREVIEW === 'true',
        allowLocalhost: process.env.CMS_ALLOW_LOCAL_PREVIEW_HOST === 'true',
      });
      if (result.status === 404) setResponseStatus(404);
      return result;
    } finally {
      client.close();
    }
  });
