export const publishedCacheControl =
  'public, max-age=0, s-maxage=60, stale-while-revalidate=300' as const;

export function publishedResponseHeaders(input: {
  readonly documentHash: string;
  readonly publicationId: string;
}) {
  return {
    'Cache-Control': publishedCacheControl,
    ETag: `"${input.documentHash}"`,
    'X-Auteur-Publication': input.publicationId,
  } as const;
}
