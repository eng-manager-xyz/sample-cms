import { describe, expect, test } from 'bun:test';

import {
  iterateTemplateRouteValueBatches,
  previewTemplateProvisioning,
} from './template-provisioning';

const baseInput = {
  template: {
    id: 'tpl-provisioned',
    key: 'provisioned',
    name: 'Provisioned',
    domain: 'WWW.Example.Test',
  },
  slots: [
    {
      id: 'slot-locale',
      key: 'locale',
      label: 'Locale',
      kind: 'variable' as const,
      variableKind: 'locale' as const,
    },
    {
      id: 'slot-static',
      key: 'catalog',
      label: 'Catalog',
      kind: 'static' as const,
      staticValue: 'Catalog',
    },
    {
      id: 'slot-slug',
      key: 'slug',
      label: 'Slug',
      kind: 'variable' as const,
      variableKind: 'slug' as const,
    },
  ],
  localeCsv: '\uFEFFlocale\r\nen-us\r\nfr-FR\r\n',
  slugCsv: 'slug\n"First-Item"\nsecond-item\n',
};

describe('AUT-560 CSV preview and URL grammar', () => {
  test('normalizes exact locale/slug CSVs and samples the deterministic Cartesian product', () => {
    const preview = previewTemplateProvisioning(baseInput);

    expect(preview).toMatchObject({
      valid: true,
      normalizedDomain: 'www.example.test',
      urlPattern: '/{locale}/catalog/{slug}',
      cardinality: 4,
      errors: [],
      values: {
        locale: ['en-US', 'fr-FR'],
        slug: ['first-item', 'second-item'],
      },
    });
    expect(preview.sampleCanonicalUrls).toEqual([
      '/en-US/catalog/first-item',
      '/en-US/catalog/second-item',
      '/fr-FR/catalog/first-item',
      '/fr-FR/catalog/second-item',
    ]);
    expect(preview.slots.map((slot) => slot.pathPosition)).toEqual([0, 1, 2]);
  });

  test('reports field-addressable headers, malformed rows, blanks, and normalized collisions', () => {
    const preview = previewTemplateProvisioning({
      ...baseInput,
      localeCsv: 'Locale\nen-US\n',
      slugCsv: 'slug\nFoo\nfoo\n\n"unterminated',
    });

    expect(preview.valid).toBe(false);
    expect(preview.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'localeCsv', row: 1, code: 'invalid_header' }),
        expect.objectContaining({ path: 'slugCsv', row: 3, code: 'duplicate' }),
        expect.objectContaining({ path: 'slugCsv', row: 4, code: 'blank' }),
        expect.objectContaining({ path: 'slugCsv', row: 5, code: 'invalid_csv' }),
      ])
    );
  });

  test('rejects reserved tags slots and guards exact cardinality before route expansion', () => {
    const preview = previewTemplateProvisioning({
      ...baseInput,
      slots: [
        ...baseInput.slots,
        {
          id: 'slot-locale',
          key: 'tags',
          label: 'Tags',
          kind: 'static' as const,
          staticValue: 'tags',
        },
      ],
      limits: { maxCardinality: 3, sampleLimit: 1 },
    });

    expect(preview.cardinality).toBe(4);
    expect(preview.sampleCanonicalUrls).toEqual([]);
    expect(preview.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'slots.3.key', code: 'invalid_slot' }),
        expect.objectContaining({ path: 'slots.3.id', code: 'duplicate' }),
        expect.objectContaining({ path: 'slots', code: 'cardinality_limit' }),
      ])
    );
  });

  test('rejects generated routes that exceed the canonical URL contract', () => {
    const preview = previewTemplateProvisioning({
      ...baseInput,
      slugCsv: `slug\n${'a'.repeat(2_034)}\n`,
    });

    expect(preview.valid).toBe(false);
    expect(preview.sampleCanonicalUrls).toEqual([]);
    expect(preview.errors).toContainEqual({
      path: 'slots',
      code: 'invalid_slot',
      message: 'At least one generated route exceeds the 2048-character canonical URL limit.',
    });
  });

  test('rejects template keys reserved by legacy proof-route aliases', () => {
    for (const key of ['stores', 'eligible-vehicles', 'structural-proof']) {
      const preview = previewTemplateProvisioning({
        ...baseInput,
        template: { ...baseInput.template, key },
      });

      expect(preview.valid).toBe(false);
      expect(preview.errors).toContainEqual({
        path: 'template.key',
        code: 'collision',
        message: `Template key "${key}" is reserved by a built-in proof scenario.`,
      });
    }
  });

  test('rejects ports and URL authority characters from bare template hosts', () => {
    for (const domain of [
      'pages.example.test:443',
      'author@pages.example.test',
      'pages.example.test?preview=true',
      '-pages.example.test',
      '999.1.1.1',
    ]) {
      const preview = previewTemplateProvisioning({
        ...baseInput,
        template: { ...baseInput.template, domain },
      });

      expect(preview.valid).toBe(false);
      expect(preview.errors).toContainEqual({
        path: 'template.domain',
        code: 'invalid_domain',
        message: 'Template domain must be a bare host name.',
      });
    }
  });

  test('streams a larger Cartesian product through fixed-size bounded batches', () => {
    const locales = [
      'en-US',
      'en-CA',
      'en-GB',
      'fr-FR',
      'de-DE',
      'es-ES',
      'it-IT',
      'pt-BR',
      'ja-JP',
      'ko-KR',
    ];
    const slugs = Array.from(
      { length: 1_000 },
      (_, index) => `item-${index.toString().padStart(4, '0')}`
    );
    const preview = previewTemplateProvisioning({
      ...baseInput,
      localeCsv: `locale\n${locales.join('\n')}\n`,
      slugCsv: `slug\n${slugs.join('\n')}\n`,
    });
    expect(preview.cardinality).toBe(10_000);

    let batchCount = 0;
    let routeCount = 0;
    let largestBatch = 0;
    let firstRoute: Readonly<Record<string, string>> | undefined;
    let lastRoute: Readonly<Record<string, string>> | undefined;
    for (const batch of iterateTemplateRouteValueBatches(preview, 128)) {
      batchCount += 1;
      routeCount += batch.length;
      largestBatch = Math.max(largestBatch, batch.length);
      firstRoute ??= batch[0];
      lastRoute = batch.at(-1);
    }

    expect({ batchCount, routeCount, largestBatch }).toEqual({
      batchCount: 79,
      routeCount: 10_000,
      largestBatch: 128,
    });
    expect(firstRoute).toMatchObject({ locale: 'en-US', slug: 'item-0000' });
    expect(lastRoute).toMatchObject({ locale: 'ko-KR', slug: 'item-0999' });
    expect(() => iterateTemplateRouteValueBatches(preview, 0).next()).toThrow(RangeError);
  });
});
