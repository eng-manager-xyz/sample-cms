import type { CmsDatabaseClient } from '@repo/cms-db';
import { parsePublishedDocument } from '@repo/cms-domain';
import {
  CmsService,
  CmsServiceError,
  type ServeCanonicalResult,
  type ServeReadEvidence,
  type ServeResult,
} from '@repo/cms-service';
import { createPublicPageViewModel, type PublicPageLoadResult } from '@/data/public-page';
import {
  hostnameWithoutPort,
  isLocalRequestHost,
  PublicTemplateKeySchema,
} from '@/data/public-path';
import {
  type CanonicalTemplatePageMatch,
  resolveCanonicalTemplatePage,
} from './canonical-template.server';

export interface WebsitePublishedReadEvidence {
  readonly materializationMode: ServeReadEvidence['materializationMode'];
  readonly sqlQueryCount: number;
  readonly serviceSqlQueryCount: ServeReadEvidence['sqlQueryCount'];
  readonly adapterSqlQueryCount: 0 | 1;
  readonly selectorSqlExecutions: 0;
  readonly celEvaluations: 0;
}

export interface WebsitePublishedPageRead {
  readonly result: PublicPageLoadResult;
  readonly evidence: WebsitePublishedReadEvidence | null;
}

function toWebsiteEvidence(
  evidence: ServeReadEvidence,
  adapterSqlQueryCount: 0 | 1
): WebsitePublishedReadEvidence {
  return {
    materializationMode: evidence.materializationMode,
    sqlQueryCount: evidence.sqlQueryCount + adapterSqlQueryCount,
    serviceSqlQueryCount: evidence.sqlQueryCount,
    adapterSqlQueryCount,
    selectorSqlExecutions: evidence.selectorSqlExecutions,
    celEvaluations: evidence.celEvaluations,
  };
}

function createLoadResult(
  served: ServeResult,
  template: ServeCanonicalResult['template']
): PublicPageLoadResult {
  if (served.status === 404) return served;
  const templateKey = PublicTemplateKeySchema.safeParse(template?.key);
  if (!template || !templateKey.success) return { status: 404, reason: 'missing' };
  return {
    status: 200,
    page: createPublicPageViewModel({
      scenarioId: templateKey.data,
      publicationId: served.publicationId,
      canonicalUrl: served.canonicalUrl,
      documentHash: served.documentHash,
      document: parsePublishedDocument(served.document),
    }),
  };
}

/**
 * Reads a materialized page by canonical host and path through the service's joined one/two-read
 * seam. Local development aliases need one bounded lookup to recover the persisted canonical host;
 * evidence exposes that exceptional adapter read rather than hiding it.
 */
export function readPublishedPage(
  client: CmsDatabaseClient,
  input: {
    readonly canonicalUrl: string;
    readonly host: string;
    readonly nodeEnv: string | undefined;
    readonly allowLocalhost?: boolean;
  }
): WebsitePublishedPageRead {
  const localHost = isLocalRequestHost(input.host);
  const localAllowed = input.nodeEnv !== 'production' || input.allowLocalhost === true;
  if (localHost && !localAllowed) {
    return { result: { status: 404, reason: 'missing' }, evidence: null };
  }

  let adapterSqlQueryCount: 0 | 1 = 0;
  let canonicalHost = hostnameWithoutPort(input.host);
  if (localHost) {
    const adapterMatch: CanonicalTemplatePageMatch | null = resolveCanonicalTemplatePage(client, {
      host: input.host,
      canonicalUrl: input.canonicalUrl,
      allowLocalhost: true,
    });
    adapterSqlQueryCount = 1;
    if (!adapterMatch) {
      return {
        result: { status: 404, reason: 'missing' },
        evidence: null,
      };
    }
    canonicalHost = adapterMatch.canonicalHost;
  }
  if (!canonicalHost) {
    return { result: { status: 404, reason: 'missing' }, evidence: null };
  }

  const service = new CmsService(client);
  let evidence: ServeCanonicalResult;
  try {
    evidence = service.serveCanonicalWithEvidence(canonicalHost, input.canonicalUrl);
  } catch (error) {
    if (error instanceof CmsServiceError && error.code === 'INVALID_INPUT') {
      return { result: { status: 404, reason: 'missing' }, evidence: null };
    }
    throw error;
  }
  return {
    result: createLoadResult(evidence.result, evidence.template),
    evidence: toWebsiteEvidence(evidence, adapterSqlQueryCount),
  };
}
