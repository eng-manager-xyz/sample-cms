import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { SchemaBlockForm } from '@/components/authoring/schema-block-form';
import type { CmsWorkspaceBlockType } from '@/data/sqlite-authoring';

const nestedHero: CmsWorkspaceBlockType = {
  key: 'hero',
  name: 'Editorial hero',
  schemaVersion: 3,
  schemaJson: JSON.stringify({
    type: 'object',
    required: ['headline', 'layout'],
    properties: {
      headline: {
        type: 'string',
        title: 'Headline',
        description: 'The primary message shown on the page.',
      },
      layout: {
        type: 'object',
        title: 'Layout',
        description: 'Visual treatment for this hero.',
        required: ['theme'],
        properties: {
          theme: {
            type: 'string',
            title: 'Theme',
            enum: ['light', 'dark'],
          },
          columns: {
            type: 'integer',
            title: 'Columns',
          },
        },
      },
      featured: {
        type: 'boolean',
        title: 'Featured',
      },
      tags: {
        type: 'array',
        title: 'Tags',
        items: { type: 'string' },
      },
    },
  }),
  exampleContentJson: JSON.stringify({
    headline: 'A schema-shaped form',
    layout: { theme: 'dark', columns: 2 },
    featured: true,
    tags: ['editorial', 'preview'],
  }),
};

describe('AUT-556 SchemaBlockForm', () => {
  test('maps registered primitives and nested objects into an ordered field hierarchy', () => {
    const markup = renderToStaticMarkup(
      <SchemaBlockForm
        mode="add"
        blockTypes={[nestedHero]}
        placementKeys={['navigation']}
        pending={false}
        serverError={null}
        onSave={async () => undefined}
        onDirty={() => undefined}
        inspectField={async (source) => ({
          path: '$.headline',
          source,
          success: true,
          dependencies: [],
          allowedVariables: [],
          expressionCount: 0,
          maxAstDepth: 0,
          evaluatedSample: source,
          error: null,
        })}
        hasUnsavedChanges={false}
        onDiscard={() => undefined}
      />
    );

    expect(markup).toContain('Registered schema');
    expect(markup).toContain('Editorial hero · v3');
    expect(markup).toContain('data-schema-field="headline"');
    expect(markup).toContain('data-field-kind="string"');
    expect(markup).toContain('id="block-field-headline" type="text"');
    expect(markup).toContain('The primary message shown on the page.');
    expect(markup).toContain('data-schema-field="layout"');
    expect(markup).toContain('aria-controls="block-field-layout-children"');
    expect(markup).toContain('data-schema-field="layout.theme"');
    expect(markup).toContain('<option value="" disabled="">Choose a value</option>');
    expect(markup).toContain('<option value="light">light</option>');
    expect(markup).toContain('data-schema-field="layout.columns"');
    expect(markup).toContain('type="number"');
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-required="false"');
    expect(markup).toContain('aria-describedby="block-field-featured-state"');
    expect(markup).toContain('data-schema-field="tags"');
    expect(markup).toContain('array of string');
    expect(markup.indexOf('Content fields')).toBeLessThan(markup.indexOf('Block settings'));
    expect(markup).not.toContain('Schema compatibility details');
  });
});
