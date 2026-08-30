import * as z from 'zod';

export const PublishedPlacementProvenanceSchema = z.strictObject({
  sourceRevisionId: z.string().min(1),
  sourceOperationId: z.string().min(1),
  sourcePriority: z.int().min(0),
});

export type PublishedPlacementProvenance = z.infer<typeof PublishedPlacementProvenanceSchema>;

export const PublishedPlacementSchema = z.strictObject({
  placementKey: z.string().min(1),
  order: z.int().min(0),
  blockType: z.string().min(1),
  blockVersionId: z.string().min(1),
  content: z.record(z.string(), z.json()),
  provenance: PublishedPlacementProvenanceSchema,
});

export type PublishedPlacement = z.infer<typeof PublishedPlacementSchema>;

export const PublishedDocumentSchema = z
  .strictObject({
    templateId: z.string().min(1),
    pageId: z.string().min(1),
    placements: z.array(PublishedPlacementSchema),
  })
  .superRefine((document, context) => {
    const placementKeys = new Set<string>();
    for (const [index, placement] of document.placements.entries()) {
      if (placement.order !== index) {
        context.addIssue({
          code: 'custom',
          message: `Published placement order must be contiguous; expected ${index}.`,
          path: ['placements', index, 'order'],
        });
      }
      if (placementKeys.has(placement.placementKey)) {
        context.addIssue({
          code: 'custom',
          message: 'Published placement keys must be unique within a document.',
          path: ['placements', index, 'placementKey'],
        });
      }
      placementKeys.add(placement.placementKey);
    }
  });

export type PublishedDocument = z.infer<typeof PublishedDocumentSchema>;

/** Parses materialized publication output at persistence and serving boundaries. */
export function parsePublishedDocument(value: unknown): PublishedDocument {
  return PublishedDocumentSchema.parse(value);
}
