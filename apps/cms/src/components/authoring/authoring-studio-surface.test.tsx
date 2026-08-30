import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AuthoringDocumentSurface,
  AuthoringSelectorSurface,
} from '@/components/authoring/authoring-studio-surface';

describe('AUT-550 authoring studio mode surfaces', () => {
  test('keeps the canvas and inspector grid exclusive to document mode', () => {
    const markup = renderToStaticMarkup(
      <AuthoringDocumentSurface>
        <span>Document canvas</span>
      </AuthoringDocumentSurface>
    );

    expect(markup).toContain('data-authoring-mode="document"');
    expect(markup).toContain('xl:grid-cols-[minmax(520px,1fr)_390px]');
    expect(markup).not.toContain('Return to document authoring');
  });

  test('uses a full-width replacement surface with an accessible return action', () => {
    const markup = renderToStaticMarkup(
      <AuthoringSelectorSurface disabled={false} onReturnToDocument={() => undefined}>
        <span>Full selector cascade</span>
      </AuthoringSelectorSurface>
    );

    expect(markup).toContain('data-authoring-mode="selector"');
    expect(markup).toContain('Full selector cascade');
    expect(markup).toContain('aria-label="Return to document authoring"');
    expect(markup).not.toContain('xl:grid-cols-[minmax(520px,1fr)_390px]');
  });
});
