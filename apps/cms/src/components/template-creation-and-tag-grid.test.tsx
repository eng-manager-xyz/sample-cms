import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { TemplateCreationWizard } from '@/components/template-creation-wizard';
import { TemplatePageTagGrid } from '@/components/template-page-tag-grid';
import type { ContentExplorerPage, ContentTemplateSummary } from '@/data/content-explorer';

const template = {
  slug: 'city-guides',
  templateId: 'tpl:city-guides',
  name: 'City guides',
  domain: 'www.example.com',
  urlPattern: '/{locale}/cities/{slug}',
  description: '',
  status: 'active',
  updatedAt: '2026-08-31T00:00:00.000Z',
  slots: [
    {
      id: 'slot:city-guides:locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable',
      pathPosition: 0,
      staticValue: null,
    },
    {
      id: 'slot:city-guides:resource',
      key: 'resource',
      label: 'Resource',
      kind: 'static',
      pathPosition: 1,
      staticValue: 'cities',
    },
    {
      id: 'slot:city-guides:slug',
      key: 'slug',
      label: 'Slug',
      kind: 'variable',
      pathPosition: 2,
      staticValue: null,
    },
  ],
  grammar: [
    { key: 'locale', label: 'Locale', kind: 'variable', value: '{locale}' },
    { key: 'resource', label: 'Resource', kind: 'static', value: 'cities' },
    { key: 'slug', label: 'Slug', kind: 'variable', value: '{slug}' },
  ],
  pageCount: 1,
  livePageCount: 1,
  notLivePageCount: 0,
  archivedPageCount: 0,
  variantCount: 0,
  activeVariantCount: 0,
  draftVariantCount: 0,
  publicationState: 'unpublished',
  currentPublicationId: null,
  publishedAt: null,
  publishedPageCount: 0,
  draftState: 'unpublished',
} as const satisfies ContentTemplateSummary;

const page = {
  id: 'page:city-guides:one',
  templateId: template.templateId,
  canonicalUrl: '/en-US/cities/downtown',
  routeStatus: 'live',
  routeRevision: 'route-1',
  updatedAt: '2026-08-31T00:00:00.000Z',
  segments: ['en-US', 'cities', 'downtown'],
  publicationState: 'not_published',
  documentHash: null,
  slotValues: { locale: 'en-US', resource: 'cities', slug: 'downtown' },
  tags: [
    { id: 'tag:featured', namespace: 'tags', value: 'featured', label: 'Featured' },
    { id: 'tag:brand', namespace: 'brand', value: 'auteur', label: 'Auteur' },
  ],
} as const satisfies ContentExplorerPage;

describe('AUT-565 template creation wizard', () => {
  test('renders the full-canvas identity and ordered slot steps with explicit tags guidance', () => {
    const identity = renderToStaticMarkup(
      <TemplateCreationWizard
        step="identity"
        onStepChange={() => undefined}
        onCancel={() => undefined}
        onCreated={() => undefined}
      />
    );
    expect(identity).toContain('Create template');
    expect(identity).toContain('Template name');
    expect(identity).toContain('Canonical host');
    expect(identity).toContain('Starting route');

    const slots = renderToStaticMarkup(
      <TemplateCreationWizard
        step="slots"
        onStepChange={() => undefined}
        onCancel={() => undefined}
        onCreated={() => undefined}
      />
    );
    expect(slots).toContain('Build the URL slots');
    expect(slots).toContain('Move slot up');
    expect(slots).toContain('Tags dimension included');
    expect(slots).toContain('never add a URL segment');
  });
});

describe('AUT-562 template page tag grid', () => {
  test('renders named slot columns, bounded selection controls, and tag chips', () => {
    const markup = renderToStaticMarkup(
      <TemplatePageTagGrid
        template={template}
        pages={[page]}
        onOpenPage={() => undefined}
        onChanged={() => undefined}
      />
    );
    expect(markup).toContain('Select all loaded pages');
    expect(markup).toContain('Canonical URL');
    expect(markup).toContain('Locale');
    expect(markup).toContain('Slug');
    expect(markup).toContain('tags:');
    expect(markup).toContain('Featured');
    expect(markup).toContain('brand tags are read-only in this editor');
    expect(markup).toContain('Auteur');
    expect(markup).toContain('50 pages per bounded command');
  });
});
