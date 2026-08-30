import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminGateway } from './admin-gateway';

describe('AdminGateway', () => {
  test('renders an actionable authoring link only for a validated ready state', () => {
    const markup = renderToStaticMarkup(
      <AdminGateway
        state={{
          status: 'ready',
          origin: 'https://cms.example.com',
          source: 'configured',
        }}
      />
    );

    expect(markup).toContain('data-admin-status="ready"');
    expect(markup).toContain('data-admin-open="true"');
    expect(markup).toContain('href="https://cms.example.com"');
    expect(markup).toContain('rel="noreferrer"');
    expect(markup).not.toContain('<iframe');
  });

  test.each(['missing-config', 'invalid-config'] as const)(
    'fails closed without an authoring link for %s',
    (reason) => {
      const markup = renderToStaticMarkup(
        <AdminGateway state={{ status: 'unavailable', reason }} />
      );

      expect(markup).toContain('data-admin-status="unavailable"');
      expect(markup).not.toContain('data-admin-open');
      expect(markup).not.toContain('<iframe');
      expect(markup).not.toContain('/api');
      expect(markup).not.toContain('/auth');
    }
  );
});
