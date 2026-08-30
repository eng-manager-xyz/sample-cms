import { createServerFn } from '@tanstack/react-start';
import { createPublicPageViewModel, type PublicPageLoadResult } from '@/data/public-page';
import {
  PublicPageRequestSchema,
  publicHostMatchesTemplate,
  resolvePublicTemplate,
} from '@/data/public-path';

export const loadPublishedPage = createServerFn({ method: 'GET' })
  .validator(PublicPageRequestSchema)
  .handler(async ({ data }): Promise<PublicPageLoadResult> => {
    const template = resolvePublicTemplate(data.canonicalUrl);
    if (!template) return { status: 404, reason: 'unsupported_pattern' };

    const [
      { createCmsDatabase },
      { parsePublishedDocument },
      { CmsService },
      { getRequestHost, setResponseHeader },
    ] = await Promise.all([
      import('@repo/cms-db'),
      import('@repo/cms-domain'),
      import('@repo/cms-service'),
      import('@tanstack/react-start/server'),
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
      setResponseHeader(
        'Cache-Control',
        'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
      );
      setResponseHeader('ETag', `"${served.documentHash}"`);
      setResponseHeader('X-Auteur-Publication', served.publicationId);
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
