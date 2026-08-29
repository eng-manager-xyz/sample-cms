import { describe, expect, test } from 'bun:test';
import { ScenarioIdSchema, TemplateParamsSchema } from '@/data/scenario-fixtures';
import { getRouter } from './router';
import { NotFound, Route as RootRoute, RouteError } from './routes/__root';
import { startInstance } from './start';

describe('CMS router contracts', () => {
  test('wires route-level and router-level recovery boundaries', () => {
    expect(RootRoute.options.errorComponent).toBe(RouteError);
    expect(RootRoute.options.notFoundComponent).toBe(NotFound);

    const router = getRouter();
    expect(router.options.defaultErrorComponent).toBe(RouteError);
    expect(router.options.defaultNotFoundComponent).toBe(NotFound);
  });

  test('server rendering rethrows unexpected route errors', () => {
    expect(() => RouteError({ error: new Error('kaboom'), reset: () => undefined })).toThrow(
      'kaboom'
    );
  });

  test('unknown dynamic IDs parse as paths but fail the scenario allowlist for a 404', () => {
    expect(TemplateParamsSchema.parse({ templateId: 'not-a-scenario' })).toEqual({
      templateId: 'not-a-scenario',
    });
    expect(ScenarioIdSchema.safeParse('not-a-scenario').success).toBe(false);
  });

  test('protects server-function requests with global CSRF middleware', async () => {
    const options = await startInstance.getOptions();

    expect(options.requestMiddleware).toHaveLength(1);
  });
});
