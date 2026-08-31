import type { CmsDatabaseClient } from '@repo/cms-db';
import { CmsService, CmsServiceError } from '@repo/cms-service';
import { createPreviewPageViewModel, type PreviewPageLoadResult } from '@/data/preview-page';
import { resolveCanonicalTemplatePage } from './canonical-template.server';

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
  const isLocalDevelopment = input.nodeEnv === 'development' || input.nodeEnv === 'test';
  if (!isLocalDevelopment && !input.previewEnabled) {
    return { status: 404, reason: 'missing' };
  }
  const template = resolveCanonicalTemplatePage(client, {
    host: input.host,
    canonicalUrl: input.canonicalUrl,
    allowLocalhost: isLocalDevelopment || input.allowLocalhost === true,
  });
  if (!template) return { status: 404, reason: 'missing' };

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
