export const adminGatewayRobotsPolicy = 'noindex, nofollow, noarchive';

export const adminGatewayResponseHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'X-Robots-Tag': adminGatewayRobotsPolicy,
} as const;

export function applyAdminGatewayResponseHeaders(
  writeHeader: (name: keyof typeof adminGatewayResponseHeaders, value: string) => void
): void {
  writeHeader('Cache-Control', adminGatewayResponseHeaders['Cache-Control']);
  writeHeader('Pragma', adminGatewayResponseHeaders.Pragma);
  writeHeader('X-Robots-Tag', adminGatewayResponseHeaders['X-Robots-Tag']);
}
