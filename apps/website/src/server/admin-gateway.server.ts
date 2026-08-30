import type { AdminGatewayState } from '@/data/admin-gateway';
import { resolveAdminGatewayState } from '@/data/admin-gateway';

export function readAdminGatewayState(): AdminGatewayState {
  return resolveAdminGatewayState({
    configuredOrigin: process.env.CMS_ADMIN_ORIGIN,
    environment: process.env.NODE_ENV,
  });
}
