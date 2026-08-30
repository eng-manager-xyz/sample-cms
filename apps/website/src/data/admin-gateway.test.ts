import { describe, expect, test } from 'bun:test';
import { CmsAdminOriginSchema, resolveAdminGatewayState } from './admin-gateway';
import {
  adminGatewayResponseHeaders,
  adminGatewayRobotsPolicy,
  applyAdminGatewayResponseHeaders,
} from './admin-gateway-policy';

describe('CMS admin origin parsing', () => {
  test('normalizes absolute HTTP and HTTPS origins', () => {
    expect(CmsAdminOriginSchema.parse(' http://localhost:3000/ ')).toBe('http://localhost:3000');
    expect(CmsAdminOriginSchema.parse('https://cms.example.com:8443')).toBe(
      'https://cms.example.com:8443'
    );
  });

  test.each([
    'cms.example.com',
    'ftp://cms.example.com',
    'https://writer:secret@cms.example.com',
    'https://cms.example.com/admin',
    'https://cms.example.com?tenant=auteur',
    'https://cms.example.com#authoring',
  ])('rejects a value that is not an isolated HTTP(S) origin: %s', (origin) => {
    expect(CmsAdminOriginSchema.safeParse(origin).success).toBe(false);
  });
});

describe('admin gateway state', () => {
  test('uses the configured origin in production', () => {
    expect(
      resolveAdminGatewayState({
        configuredOrigin: 'https://cms.example.com/',
        environment: 'production',
      })
    ).toEqual({
      status: 'ready',
      origin: 'https://cms.example.com',
      source: 'configured',
    });
  });

  test('fails closed when production configuration is missing or invalid', () => {
    expect(
      resolveAdminGatewayState({ configuredOrigin: undefined, environment: 'production' })
    ).toEqual({ status: 'unavailable', reason: 'missing-config' });
    expect(
      resolveAdminGatewayState({
        configuredOrigin: 'https://cms.example.com/admin',
        environment: 'production',
      })
    ).toEqual({ status: 'unavailable', reason: 'invalid-config' });
  });

  test('defaults only local development and test environments to the CMS dev server', () => {
    expect(
      resolveAdminGatewayState({ configuredOrigin: undefined, environment: 'development' })
    ).toEqual({
      status: 'ready',
      origin: 'http://localhost:3000',
      source: 'local-development-default',
    });
    expect(resolveAdminGatewayState({ configuredOrigin: '', environment: 'test' })).toEqual({
      status: 'ready',
      origin: 'http://localhost:3000',
      source: 'local-development-default',
    });
    expect(
      resolveAdminGatewayState({ configuredOrigin: undefined, environment: 'staging' })
    ).toEqual({ status: 'unavailable', reason: 'missing-config' });
  });

  test('keeps the gateway private and out of search indexes', () => {
    expect(adminGatewayResponseHeaders).toEqual({
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
    expect(adminGatewayRobotsPolicy).toBe('noindex, nofollow, noarchive');

    const writtenHeaders = new Map<string, string>();
    applyAdminGatewayResponseHeaders((name, value) => {
      writtenHeaders.set(name, value);
    });
    expect(Object.fromEntries(writtenHeaders)).toEqual(adminGatewayResponseHeaders);
  });
});
