import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AuthoringDocumentSurface,
  AuthoringSelectorSurface,
} from '@/components/authoring/authoring-studio-surface';

describe('AUT-550/AUT-556 authoring studio mode surfaces', () => {
  test('keeps the expanded canvas and inspector grid exclusive to document mode', () => {
    const markup = renderToStaticMarkup(
      <AuthoringDocumentSurface>
        <span>Document canvas</span>
      </AuthoringDocumentSurface>
    );

    expect(markup).toContain('data-authoring-mode="document"');
    expect(markup).toContain('min-h-[calc(100vh-6rem)]');
    expect(markup).toContain('sm:min-h-[calc(100vh-3.25rem)]');
    expect(markup).toContain('xl:grid-cols-[minmax(520px,1fr)_390px]');
    expect(markup).toContain('data-inspector-collapsed="false"');
    expect(markup).not.toContain('Return to document authoring');
  });

  test('reclaims the desktop canvas with a narrow inspector rail while retaining its children', () => {
    const markup = renderToStaticMarkup(
      <AuthoringDocumentSurface inspectorCollapsed>
        <span>Mounted inspector state</span>
      </AuthoringDocumentSurface>
    );

    expect(markup).toContain('data-inspector-collapsed="true"');
    expect(markup).toContain('xl:grid-cols-[minmax(520px,1fr)_44px]');
    expect(markup).toContain('xl:gap-0');
    expect(markup).toContain('transition-[grid-template-columns]');
    expect(markup).toContain('motion-reduce:transition-none');
    expect(markup).toContain('Mounted inspector state');
  });

  test('uses a full-width replacement surface with an accessible return action', () => {
    const markup = renderToStaticMarkup(
      <AuthoringSelectorSurface disabled={false} onReturnToDocument={() => undefined}>
        <span>Full selector cascade</span>
      </AuthoringSelectorSurface>
    );

    expect(markup).toContain('data-authoring-mode="selector"');
    expect(markup).toContain('min-h-[calc(100vh-6rem)]');
    expect(markup).toContain('sm:min-h-[calc(100vh-3.25rem)]');
    expect(markup).toContain('Full selector cascade');
    expect(markup).toContain('aria-label="Return to document authoring"');
    expect(markup).not.toContain('xl:grid-cols-[minmax(520px,1fr)_390px]');
  });

  test('labels the route-backed creation surface as a cancellable wizard', () => {
    const markup = renderToStaticMarkup(
      <AuthoringSelectorSurface disabled={false} mode="create" onReturnToDocument={() => undefined}>
        <span>Selector creation wizard</span>
      </AuthoringSelectorSurface>
    );

    expect(markup).toContain('Create a selector variation');
    expect(markup).toContain('aria-label="Cancel selector creation"');
    expect(markup).toContain('Selector creation wizard');
  });
});
