import { createServerFn } from '@tanstack/react-start';
import {
  ContentExplorerInputSchema,
  type ContentExplorerSnapshot,
  TemplateCreationCommitSchema,
  TemplateCreationInputSchema,
  type TemplateCreationPreview,
  type TemplateCreationResult,
  TemplatePageTagMutationInputSchema,
  type TemplatePageTagMutationResult,
} from '@/data/content-explorer';

export const loadContentExplorer = createServerFn({ method: 'GET' })
  .validator(ContentExplorerInputSchema)
  .handler(async ({ data }): Promise<ContentExplorerSnapshot> => {
    const [{ createCmsDatabase }, { readContentExplorer }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/content-explorer.server'),
    ]);
    const client = createCmsDatabase({ readonly: true, create: false });
    try {
      return readContentExplorer(client, data);
    } finally {
      client.close();
    }
  });

export const previewTemplateCreation = createServerFn({ method: 'POST' })
  .validator(TemplateCreationInputSchema)
  .handler(async ({ data }): Promise<TemplateCreationPreview> => {
    const { previewContentTemplateCreation } = await import('@/server/content-explorer.server');
    return previewContentTemplateCreation(data);
  });

export const provisionTemplateCreation = createServerFn({ method: 'POST' })
  .validator(TemplateCreationCommitSchema)
  .handler(async ({ data }): Promise<TemplateCreationResult> => {
    const [{ createCmsDatabase }, { provisionContentTemplate }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/content-explorer.server'),
    ]);
    const client = createCmsDatabase();
    try {
      return provisionContentTemplate(client, data);
    } finally {
      client.close();
    }
  });

export const mutateContentPageTags = createServerFn({ method: 'POST' })
  .validator(TemplatePageTagMutationInputSchema)
  .handler(async ({ data }): Promise<TemplatePageTagMutationResult> => {
    const [{ createCmsDatabase }, { mutateTemplatePageTags }] = await Promise.all([
      import('@repo/cms-db'),
      import('@/server/content-explorer.server'),
    ]);
    const client = createCmsDatabase();
    try {
      return mutateTemplatePageTags(client, data);
    } finally {
      client.close();
    }
  });
