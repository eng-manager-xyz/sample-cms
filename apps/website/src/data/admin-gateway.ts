import * as z from 'zod';

const LOCAL_ADMIN_ORIGIN = 'http://localhost:3000';

export const CmsAdminOriginSchema = z
  .string()
  .trim()
  .min(1)
  .transform((rawOrigin, context) => {
    let url: URL;
    try {
      url = new URL(rawOrigin);
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'CMS_ADMIN_ORIGIN must be an absolute URL.',
      });
      return z.NEVER;
    }

    const hasSupportedProtocol = url.protocol === 'http:' || url.protocol === 'https:';
    const hasCredentials = url.username.length > 0 || url.password.length > 0;
    const hasNonRootPath = url.pathname !== '/';
    const hasQueryOrHash = rawOrigin.includes('?') || rawOrigin.includes('#');

    if (!hasSupportedProtocol || hasCredentials || hasNonRootPath || hasQueryOrHash) {
      context.addIssue({
        code: 'custom',
        message:
          'CMS_ADMIN_ORIGIN must be an HTTP(S) origin without credentials, path, query, or hash.',
      });
      return z.NEVER;
    }

    return url.origin;
  });

const AdminGatewayStateSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('ready'),
    origin: CmsAdminOriginSchema,
    source: z.enum(['configured', 'local-development-default']),
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    reason: z.enum(['missing-config', 'invalid-config']),
  }),
]);

export type AdminGatewayState = z.infer<typeof AdminGatewayStateSchema>;

const AdminGatewayConfigInputSchema = z.strictObject({
  configuredOrigin: z.string().optional(),
  environment: z.string().optional(),
});

export function resolveAdminGatewayState(input: unknown): AdminGatewayState {
  const { configuredOrigin, environment } = AdminGatewayConfigInputSchema.parse(input);
  const hasConfiguredOrigin = configuredOrigin?.trim().length;

  if (!hasConfiguredOrigin) {
    if (environment === 'development' || environment === 'test') {
      return AdminGatewayStateSchema.parse({
        status: 'ready',
        origin: LOCAL_ADMIN_ORIGIN,
        source: 'local-development-default',
      });
    }

    return { status: 'unavailable', reason: 'missing-config' };
  }

  const parsedOrigin = CmsAdminOriginSchema.safeParse(configuredOrigin);
  if (!parsedOrigin.success) return { status: 'unavailable', reason: 'invalid-config' };

  return {
    status: 'ready',
    origin: parsedOrigin.data,
    source: 'configured',
  };
}
