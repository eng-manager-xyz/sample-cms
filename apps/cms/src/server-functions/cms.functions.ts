import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { getInstancePage, getScenarioFixture, ScenarioIdSchema } from '@/data/scenario-fixtures';

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
