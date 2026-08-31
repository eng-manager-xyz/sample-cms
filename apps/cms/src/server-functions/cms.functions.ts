import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { resolveWebsiteOriginState, type WebsiteOriginState } from '@/data/authoring-studio';
import { getInstancePage, getScenarioFixture, ScenarioIdSchema } from '@/data/scenario-fixtures';
import {
  CmsBlockFieldInspectionInputSchema,
  type CmsCommandResult,
  CmsCommandSchema,
  CmsLifecycleErrorCodeSchema,
  type CmsPublicationHistory,
  CmsPublicationHistoryInputSchema,
  type CmsPublicationMutationResponse,
  type CmsPublicationPreflight,
  CmsPublicationPreflightInputSchema,
  CmsPublishPublicationInputSchema,
  CmsRollbackPublicationInputSchema,
  type CmsWorkspaceFieldInspection,
  CmsWorkspaceInputSchema,
  type CmsWorkspaceSnapshot,
  SelectorPreviewInputSchema,
  type SelectorPreviewSnapshot,
} from '@/data/sqlite-authoring';

export interface CmsHealthSummary {
  healthy: boolean;
  schemaVersion: number;
  templateCount: number;
  pageCount: number;
  publicationCount: number;
  problems: string[];
}

export const loadCmsWebsiteOrigin = createServerFn({ method: 'GET' }).handler(
  async (): Promise<WebsiteOriginState> =>
    resolveWebsiteOriginState({
      configuredOrigin: process.env.CMS_WEBSITE_ORIGIN,
      environment: process.env.NODE_ENV,
    })
);

export const loadCmsHealth = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CmsHealthSummary> => {
    const { createCmsDatabase, inspectDatabaseHealth } = await import('@repo/cms-db');
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      const report = inspectDatabaseHealth(client);
      return {
        healthy: report.healthy,
        schemaVersion: report.schemaVersion,
        templateCount: report.tableCounts.templates ?? 0,
        pageCount: report.tableCounts.page_instances ?? 0,
        publicationCount: report.tableCounts.publications ?? 0,
        problems: report.problems,
      };
    } finally {
      client.close();
    }
  }
);

export const InstancePageInputSchema = z.object({
  templateId: ScenarioIdSchema,
  pageIndex: z.int().min(0),
  pageSize: z.int().min(1).max(10),
});

export const loadScenarioInstancePage = createServerFn({ method: 'GET' })
  .validator(InstancePageInputSchema)
  .handler(({ data }) =>
    getInstancePage(getScenarioFixture(data.templateId), data.pageIndex, data.pageSize)
  );

export const loadCmsWorkspace = createServerFn({ method: 'GET' })
  .validator(CmsWorkspaceInputSchema)
  .handler(async ({ data }): Promise<CmsWorkspaceSnapshot> => {
    const [{ createCmsDatabase }, { readCmsWorkspace }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase();
    try {
      return readCmsWorkspace(client, data.scenarioId, data.scopeId, data.canonicalUrl);
    } finally {
      client.close();
    }
  });

export const loadCmsPublicationHistory = createServerFn({ method: 'GET' })
  .validator(CmsPublicationHistoryInputSchema)
  .handler(async ({ data }): Promise<CmsPublicationHistory> => {
    const [{ createCmsDatabase }, { readCmsPublicationHistory }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      return readCmsPublicationHistory(client, data);
    } finally {
      client.close();
    }
  });

export const previewCmsSelector = createServerFn({ method: 'POST' })
  .validator(SelectorPreviewInputSchema)
  .handler(async ({ data }): Promise<SelectorPreviewSnapshot> => {
    const [{ createCmsDatabase }, authoring] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase();
    try {
      return authoring.previewCmsSelector(client, data.scenarioId, data.selector, {
        priority: data.priority,
        sampleLimit: data.sampleLimit,
        ...(data.scopeId === undefined ? {} : { scopeId: data.scopeId }),
        ...(data.canonicalUrl === undefined ? {} : { canonicalUrl: data.canonicalUrl }),
      });
    } finally {
      client.close();
    }
  });

export const inspectCmsBlockField = createServerFn({ method: 'POST' })
  .validator(CmsBlockFieldInspectionInputSchema)
  .handler(async ({ data }): Promise<CmsWorkspaceFieldInspection> => {
    const [{ createCmsDatabase }, authoring] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      return authoring.inspectCmsBlockField(
        client,
        data.scenarioId,
        data.canonicalUrl,
        data.source
      );
    } finally {
      client.close();
    }
  });

export const preflightCmsPublication = createServerFn({ method: 'POST' })
  .validator(CmsPublicationPreflightInputSchema)
  .handler(async ({ data }): Promise<CmsPublicationPreflight> => {
    const [{ createCmsDatabase }, authoring] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      return authoring.preflightCmsPublication(client, data);
    } finally {
      client.close();
    }
  });

export const publishCmsPublication = createServerFn({ method: 'POST' })
  .validator(CmsPublishPublicationInputSchema)
  .handler(async ({ data }): Promise<CmsPublicationMutationResponse> => {
    const [{ createCmsDatabase }, { CmsServiceError }, authoring] = await Promise.all([
      import('@repo/cms-db'),
      import('@repo/cms-service'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase();
    try {
      return { ok: true, result: authoring.publishCmsPublication(client, data) };
    } catch (error) {
      const lifecycleError =
        error instanceof CmsServiceError
          ? { code: CmsLifecycleErrorCodeSchema.parse(error.code), message: error.message }
          : error instanceof Error && error.name === 'VariantConflictError'
            ? { code: 'PRIORITY_CONFLICT' as const, message: error.message }
            : null;
      if (!lifecycleError) throw error;
      let preflight: CmsPublicationPreflight | null = null;
      try {
        preflight = authoring.preflightCmsPublication(client, data);
      } catch {
        preflight = null;
      }
      return {
        ok: false,
        error: lifecycleError,
        preflight,
      };
    } finally {
      client.close();
    }
  });

export const rollbackCmsPublication = createServerFn({ method: 'POST' })
  .validator(CmsRollbackPublicationInputSchema)
  .handler(async ({ data }): Promise<CmsPublicationMutationResponse> => {
    const [{ createCmsDatabase }, { CmsServiceError }, authoring] = await Promise.all([
      import('@repo/cms-db'),
      import('@repo/cms-service'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase();
    try {
      return { ok: true, result: authoring.rollbackCmsPublication(client, data) };
    } catch (error) {
      const lifecycleError =
        error instanceof CmsServiceError
          ? { code: CmsLifecycleErrorCodeSchema.parse(error.code), message: error.message }
          : error instanceof Error && error.name === 'VariantConflictError'
            ? { code: 'PRIORITY_CONFLICT' as const, message: error.message }
            : null;
      if (!lifecycleError) throw error;
      let preflight: CmsPublicationPreflight | null = null;
      try {
        preflight = authoring.preflightCmsPublication(client, data);
      } catch {
        preflight = null;
      }
      return {
        ok: false,
        error: lifecycleError,
        preflight,
      };
    } finally {
      client.close();
    }
  });

export const executeCmsMutation = createServerFn({ method: 'POST' })
  .validator(CmsCommandSchema)
  .handler(async ({ data }): Promise<CmsCommandResult> => {
    const [{ createCmsDatabase }, authoring] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/sqlite-authoring.server'),
    ]);
    const client = createCmsDatabase();
    try {
      return authoring.executeCmsCommand(client, data);
    } finally {
      client.close();
    }
  });
