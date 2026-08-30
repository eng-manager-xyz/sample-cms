import type { CmsDatabaseClient } from '@repo/cms-db';
import { CmsService, CmsServiceError } from '@repo/cms-service';
import {
  createPreviewPageViewModel,
  type PreviewPageLoadResult,
  previewHostMatchesTemplate,
} from '@/data/preview-page';
import { resolvePublicTemplate } from '@/data/public-path';

export function readPreviewPage(
  client: CmsDatabaseClient,
  input: {
    readonly canonicalUrl: string;
    readonly host: string;
    readonly nodeEnv: string | undefined;
    readonly previewEnabled: boolean;
    readonly allowLocalhost?: boolean;
  }
): PreviewPageLoadResult {
  const template = resolvePublicTemplate(input.canonicalUrl);
  if (!template) return { status: 404, reason: 'unsupported_pattern' };
  if (
    !previewHostMatchesTemplate({
      host: input.host,
      template,
      nodeEnv: input.nodeEnv,
      previewEnabled: input.previewEnabled,
      allowLocalhost: input.allowLocalhost,
    })
  ) {
    return { status: 404, reason: 'missing' };
  }

  try {
    const draft = new CmsService(client).resolveDraftByCanonicalUrl(
      template.templateId,
      input.canonicalUrl
    );
    return {
      status: 200,
      page: createPreviewPageViewModel({
        scenarioId: template.scenarioId,
        canonicalUrl: input.canonicalUrl,
        draft,
      }),
    };
  } catch (error) {
    if (error instanceof CmsServiceError && error.code === 'NOT_FOUND') {
      return { status: 404, reason: 'missing' };
    }
    throw error;
  }
}
