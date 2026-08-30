import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import type { AdminGatewayState } from '@/data/admin-gateway';
import { applyAdminGatewayResponseHeaders } from '@/data/admin-gateway-policy';

export const loadAdminGateway = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminGatewayState> => {
    const { readAdminGatewayState } = await import('@/server/admin-gateway.server');
    applyAdminGatewayResponseHeaders(setResponseHeader);
    return readAdminGatewayState();
  }
);
