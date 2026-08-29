import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getInstancePage, getScenarioFixture, ScenarioIdSchema } from '@/data/scenario-fixtures';
import {
  type CmsCommandResult,
  CmsCommandSchema,
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
      return readCmsWorkspace(client, data.scenarioId, data.scopeId);
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
      return authoring.previewCmsSelector(client, data.scenarioId, data.selector);
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
