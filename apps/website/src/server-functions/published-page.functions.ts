import { createServerFn } from '@tanstack/react-start';
import { getRequestHost, setResponseHeader } from '@tanstack/react-start/server';
import { createPublicPageViewModel, type PublicPageLoadResult } from '@/data/public-page';
import {
  PublicPageRequestSchema,
  publicHostMatchesTemplate,
  resolvePublicTemplate,
} from '@/data/public-path';
import { publishedResponseHeaders } from '@/data/published-page-policy';

export const loadPublishedPage = createServerFn({ method: 'GET' })
  .validator(PublicPageRequestSchema)
  .handler(async ({ data }): Promise<PublicPageLoadResult> => {
    const template = resolvePublicTemplate(data.canonicalUrl);
    if (!template) return { status: 404, reason: 'unsupported_pattern' };

    const [{ createCmsDatabase }, { parsePublishedDocument }, { CmsService }] = await Promise.all([
      import('@repo/cms-db'),
      import('@repo/cms-domain'),
      import('@repo/cms-service'),
    ]);
    if (
      !publicHostMatchesTemplate(
        getRequestHost(),
        template,
        process.env.NODE_ENV,
        process.env.CMS_ALLOW_LOCAL_PUBLISHED_HOST === 'true'
      )
    ) {
      return { status: 404, reason: 'missing' };
    }
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      const served = new CmsService(client).serve(template.templateId, data.canonicalUrl);
      if (served.status === 404) return served;
      const document = parsePublishedDocument(served.document);
      for (const [name, value] of Object.entries(
        publishedResponseHeaders({
          documentHash: served.documentHash,
          publicationId: served.publicationId,
        })
      )) {
        setResponseHeader(name, value);
      }
      return {
        status: 200,
        page: createPublicPageViewModel({
          scenarioId: template.scenarioId,
          publicationId: served.publicationId,
          canonicalUrl: served.canonicalUrl,
          documentHash: served.documentHash,
          document,
        }),
      };
    } finally {
      client.close();
    }
  });
