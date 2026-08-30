INSERT OR IGNORE INTO templates (
  id, key, name, domain, url_pattern, description, status,
  route_authority, created_at, updated_at
) VALUES (
  'tpl-store',
  'store',
  'Store',
  'www.ubereats.com',
  '/{locale}/store/{store_id}',
  'Sparse selector and manifest-reuse proof template',
  'active',
  'camo_press',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO template_slots (
  id, template_id, key, label, kind, path_position, static_value, value_type, is_required, created_at
) VALUES
  ('slot-store-locale', 'tpl-store', 'locale', 'Locale', 'variable', 0, NULL, 'string', 1, '2026-01-01T00:00:00.000Z'),
  ('slot-store-static', 'tpl-store', 'store', 'Store path', 'static', 1, 'store', 'string', 1, '2026-01-01T00:00:00.000Z'),
  ('slot-store-id', 'tpl-store', 'store_id', 'Store ID', 'variable', 2, NULL, 'integer', 1, '2026-01-01T00:00:00.000Z'),
  ('slot-store-name', 'tpl-store', 'store_name', 'Store name', 'derived', NULL, NULL, 'string', 1, '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO route_ingestions (
  id, template_id, source, source_revision, status, checksum, row_count,
  source_observed_at, started_at, completed_at, created_at
) VALUES (
  'ing-store-seed-1',
  'tpl-store',
  'seed',
  'store-seed-v1',
  'succeeded',
  '7a6ee9ee95ae7a3982ad907b8603b94aededfc9fa762b82eba1a19be895172a6',
  2,
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:01.000Z',
  '2026-01-01T00:00:00.000Z'
);

INSERT OR IGNORE INTO page_instances (
  id, template_id, canonical_url, route_external_id, route_status, route_revision,
  last_ingestion_id, slot_value_hash, context_json, created_at, updated_at
) VALUES
  (
    'page-store-1001', 'tpl-store', '/en-US/store/1001', 'camo-store-1001', 'live',
    'store-seed-v1', 'ing-store-seed-1', 'ad34c82b43166d4823b61f6190ea475c65d3eaee35d87ee86cfe02ec08e8b11a',
    '{"locale":"en-US","store":{"id":1001,"name":"McDonald''s Market","location":"San Francisco"}}',
    '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
  ),
  (
    'page-store-1002', 'tpl-store', '/en-US/store/1002', 'camo-store-1002', 'live',
    'store-seed-v1', 'ing-store-seed-1', 'e9e61f1e643b84e92daa2fde8979ea84fda00f8461a063a7a3ccb53f9b5e3627',
    '{"locale":"en-US","store":{"id":1002,"name":"Neighborhood Kitchen","location":"Oakland"}}',
    '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
  );

INSERT OR IGNORE INTO page_slot_values (
  page_instance_id, template_id, slot_id, value, normalized_value, created_at
) VALUES
  ('page-store-1001', 'tpl-store', 'slot-store-locale', 'en-US', 'en-us', '2026-01-01T00:00:00.000Z'),
  ('page-store-1001', 'tpl-store', 'slot-store-static', 'store', 'store', '2026-01-01T00:00:00.000Z'),
  ('page-store-1001', 'tpl-store', 'slot-store-id', '1001', '1001', '2026-01-01T00:00:00.000Z'),
  ('page-store-1001', 'tpl-store', 'slot-store-name', 'McDonald''s Market', 'mcdonalds market', '2026-01-01T00:00:00.000Z'),
  ('page-store-1002', 'tpl-store', 'slot-store-locale', 'en-US', 'en-us', '2026-01-01T00:00:00.000Z'),
  ('page-store-1002', 'tpl-store', 'slot-store-static', 'store', 'store', '2026-01-01T00:00:00.000Z'),
  ('page-store-1002', 'tpl-store', 'slot-store-id', '1002', '1002', '2026-01-01T00:00:00.000Z'),
  ('page-store-1002', 'tpl-store', 'slot-store-name', 'Neighborhood Kitchen', 'neighborhood kitchen', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO tags (
  id, template_id, namespace, value, label, description, source, parent_tag_id, created_at
) VALUES
  ('tag-store-type-chain', 'tpl-store', 'store_type', 'chain_store', 'Chain store', 'Imported store type', 'seed', NULL, '2026-01-01T00:00:00.000Z'),
  ('tag-store-category-fast-food', 'tpl-store', 'category', 'fast_food', 'Fast food', 'Imported category', 'seed', NULL, '2026-01-01T00:00:00.000Z'),
  ('tag-store-brand-mcdonalds', 'tpl-store', 'brand', 'mcdonalds', 'McDonald''s', 'Imported brand', 'seed', NULL, '2026-01-01T00:00:00.000Z'),
  ('tag-store-brand-burger-king', 'tpl-store', 'brand', 'burger_king', 'Burger King', 'Imported brand', 'seed', NULL, '2026-01-01T00:00:00.000Z'),
  ('tag-store-type-independent', 'tpl-store', 'store_type', 'independent', 'Independent', 'Imported store type', 'seed', NULL, '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO page_tags (
  page_instance_id, template_id, tag_id, source, created_at
) VALUES
  ('page-store-1001', 'tpl-store', 'tag-store-type-chain', 'seed', '2026-01-01T00:00:00.000Z'),
  ('page-store-1001', 'tpl-store', 'tag-store-category-fast-food', 'seed', '2026-01-01T00:00:00.000Z'),
  ('page-store-1001', 'tpl-store', 'tag-store-brand-mcdonalds', 'seed', '2026-01-01T00:00:00.000Z'),
  ('page-store-1002', 'tpl-store', 'tag-store-type-independent', 'seed', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO route_audit_log (
  id, ingestion_id, page_instance_id, route_external_id, canonical_url, action,
  previous_status, next_status, detail_json, created_at
) VALUES
  (
    'audit-store-1001-insert', 'ing-store-seed-1', 'page-store-1001', 'camo-store-1001',
    '/en-US/store/1001', 'insert', NULL, 'live', '{"source":"deterministic-seed"}',
    '2026-01-01T00:00:00.000Z'
  ),
  (
    'audit-store-1002-insert', 'ing-store-seed-1', 'page-store-1002', 'camo-store-1002',
    '/en-US/store/1002', 'insert', NULL, 'live', '{"source":"deterministic-seed"}',
    '2026-01-01T00:00:00.000Z'
  );

INSERT OR IGNORE INTO variants (
  id, template_id, key, name, description, is_default, priority, status,
  active_revision_id, created_at, updated_at
) VALUES
  ('tpl-store:default', 'tpl-store', 'default', 'Default', 'Template-owned default layer', 1, 0, 'active', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('variant-store-chain', 'tpl-store', 'chain-stores', 'Chain stores', 'Shared footer', 0, 10, 'active', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('variant-store-fast-food', 'tpl-store', 'fast-food', 'Fast food', 'Shared promotion', 0, 20, 'active', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('variant-store-mcdonalds', 'tpl-store', 'mcdonalds', 'McDonald''s', 'Brand-specific hero', 0, 30, 'active', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('variant-store-burger-king', 'tpl-store', 'burger-king', 'Burger King', 'Brand-specific hero', 0, 30, 'active', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO variant_revisions (
  id, variant_id, revision_number, selector_input, selector_sql, selector_hash,
  validation_result_json, selector_description, created_by, created_at
) VALUES
  ('tpl-store:default:r1', 'tpl-store:default', 1, 'TRUE', 'TRUE', '35f9735092451bcd1079d62accc2e748ffc0629401731fcbc3cb8f6e12a28079', '{"status":"valid","normalizedSelector":"TRUE"}', 'All store pages', 'seed', '2026-01-01T00:00:00.000Z'),
  ('revision-store-chain-1', 'variant-store-chain', 1, 'store_type = ''chain_store''', 'store_type = ''chain_store''', 'db2917402e9487d4ffea4c4c1fc8fef551f023f99efab54a42a827352d4491c1', '{"status":"valid","normalizedSelector":"store_type = ''chain_store''"}', 'Pages explicitly tagged chain_store', 'seed', '2026-01-01T00:00:00.000Z'),
  ('revision-store-fast-food-1', 'variant-store-fast-food', 1, 'category = ''fast_food''', 'category = ''fast_food''', '546a21eb8d5998f2516582bffca6036e94eac6362c2cb98146515a0dea747810', '{"status":"valid","normalizedSelector":"category = ''fast_food''"}', 'Pages explicitly tagged fast_food', 'seed', '2026-01-01T00:00:00.000Z'),
  ('revision-store-mcdonalds-1', 'variant-store-mcdonalds', 1, 'brand = ''mcdonalds''', 'brand = ''mcdonalds''', 'deac120b2db0849c1e66bdc1d1b36edf2a8321eefe51203d3ae1f27fa86e47b9', '{"status":"valid","normalizedSelector":"brand = ''mcdonalds''"}', 'Pages explicitly tagged mcdonalds', 'seed', '2026-01-01T00:00:00.000Z'),
  ('revision-store-burger-king-1', 'variant-store-burger-king', 1, 'brand = ''burger_king''', 'brand = ''burger_king''', '7b36327a3489ca1e3f32dc261347a9781bedee25abad52e1944a1d1ff64d4eb2', '{"status":"valid","normalizedSelector":"brand = ''burger_king''"}', 'Pages explicitly tagged burger_king', 'seed', '2026-01-01T00:00:00.000Z');

UPDATE variants SET active_revision_id = 'tpl-store:default:r1' WHERE id = 'tpl-store:default';
UPDATE variants SET active_revision_id = 'revision-store-chain-1' WHERE id = 'variant-store-chain';
UPDATE variants SET active_revision_id = 'revision-store-fast-food-1' WHERE id = 'variant-store-fast-food';
UPDATE variants SET active_revision_id = 'revision-store-mcdonalds-1' WHERE id = 'variant-store-mcdonalds';
UPDATE variants SET active_revision_id = 'revision-store-burger-king-1' WHERE id = 'variant-store-burger-king';

INSERT OR IGNORE INTO block_types (
  id, key, name, schema_version, schema_json, preview_renderer_json, created_at, updated_at
) VALUES
  ('block-type-navigation', 'navigation', 'Navigation', 1, '{"type":"object","required":["label"]}', '{"kind":"wireframe","component":"navigation"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('block-type-hero', 'hero', 'Hero', 1, '{"type":"object","required":["headline"]}', '{"kind":"wireframe","component":"hero"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('block-type-promo', 'promo', 'Promotion', 1, '{"type":"object","required":["message"]}', '{"kind":"wireframe","component":"promo"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('block-type-footer', 'footer', 'Footer', 1, '{"type":"object","required":["legal"]}', '{"kind":"wireframe","component":"footer"}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO block_lineages (
  id, template_id, key, label, created_at
) VALUES
  ('lineage-store-navigation', 'tpl-store', 'navigation', 'Navigation lineage', '2026-01-01T00:00:00.000Z'),
  ('lineage-store-primary-hero', 'tpl-store', 'primary-hero', 'Primary hero lineage', '2026-01-01T00:00:00.000Z'),
  ('lineage-store-category-promo', 'tpl-store', 'category-promo', 'Category promotion lineage', '2026-01-01T00:00:00.000Z'),
  ('lineage-store-footer', 'tpl-store', 'footer', 'Footer lineage', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO block_versions (
  id, lineage_id, parent_version_id, version_number, block_type_id, schema_version,
  content_json, content_hash, created_by, created_at
) VALUES
  ('block-store-navigation-v1', 'lineage-store-navigation', NULL, 1, 'block-type-navigation', 1, '{"label":"Uber Eats"}', '027bf02493cff403ef63ebe7785308ae57cbaa5a24caf1676a7b0ccaa6c4d7f9', 'seed', '2026-01-01T00:00:00.000Z'),
  ('block-store-hero-v1', 'lineage-store-primary-hero', NULL, 1, 'block-type-hero', 1, '{"headline":"I am {{ store.name }} — {{ store.location }}"}', '1981cf9537819eeebf9db4d48e8bd02eeda4ada460cc934255e8c853428de33d', 'seed', '2026-01-01T00:00:00.000Z'),
  ('block-store-hero-v2-mcd', 'lineage-store-primary-hero', 'block-store-hero-v1', 2, 'block-type-hero', 1, '{"headline":"Buy now {{ store.name }} — {{ store.location }}"}', 'a1140af867536674936cdec3f85250758177a899055e482a955a50fe232b6fac', 'seed', '2026-01-01T00:00:00.000Z'),
  ('block-store-hero-v3-bk', 'lineage-store-primary-hero', 'block-store-hero-v1', 3, 'block-type-hero', 1, '{"headline":"Buy today {{ store.name }} — {{ store.location }}"}', 'e4f0e8a10a68c3834afff747121c4aa6ae5fb246075a78326696220a79c5606c', 'seed', '2026-01-01T00:00:00.000Z'),
  ('block-store-promo-v1', 'lineage-store-category-promo', NULL, 1, 'block-type-promo', 1, '{"message":"Local favorites"}', 'bbf44f5563ff1687192fa31fa1ab12bdfe75b41dd54f7c79490aecf8acce3dc7', 'seed', '2026-01-01T00:00:00.000Z'),
  ('block-store-promo-v2-fast', 'lineage-store-category-promo', 'block-store-promo-v1', 2, 'block-type-promo', 1, '{"message":"Fast-food deals"}', 'b494a166a379ecbc77eb62d8b465d2c8d08b30b321f83a8aaa5c38bdd4aaa876', 'seed', '2026-01-01T00:00:00.000Z'),
  ('block-store-footer-v1', 'lineage-store-footer', NULL, 1, 'block-type-footer', 1, '{"legal":"Standard terms"}', 'a9df3f203a074e9a76d983a92d1fd9e4767e56abacc42060d1b9aaee56073791', 'seed', '2026-01-01T00:00:00.000Z'),
  ('block-store-footer-v2-chain', 'lineage-store-footer', 'block-store-footer-v1', 2, 'block-type-footer', 1, '{"legal":"Chain-store terms"}', '126666788bf35d981688e2350b75ee9ca7f08f40a9e3d35b62cb487c2c4d6816', 'seed', '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO variant_operations (
  id, variant_revision_id, placement_key, operation_kind, block_version_id, order_index, created_at
) VALUES
  ('op-default-nav-set', 'tpl-store:default:r1', 'navigation', 'set', 'block-store-navigation-v1', NULL, '2026-01-01T00:00:00.000Z'),
  ('op-default-nav-order', 'tpl-store:default:r1', 'navigation', 'order', NULL, 0, '2026-01-01T00:00:00.000Z'),
  ('op-default-hero-set', 'tpl-store:default:r1', 'primary-hero', 'set', 'block-store-hero-v1', NULL, '2026-01-01T00:00:00.000Z'),
  ('op-default-hero-order', 'tpl-store:default:r1', 'primary-hero', 'order', NULL, 1, '2026-01-01T00:00:00.000Z'),
  ('op-default-promo-set', 'tpl-store:default:r1', 'category-promo', 'set', 'block-store-promo-v1', NULL, '2026-01-01T00:00:00.000Z'),
  ('op-default-promo-order', 'tpl-store:default:r1', 'category-promo', 'order', NULL, 2, '2026-01-01T00:00:00.000Z'),
  ('op-default-footer-set', 'tpl-store:default:r1', 'footer', 'set', 'block-store-footer-v1', NULL, '2026-01-01T00:00:00.000Z'),
  ('op-default-footer-order', 'tpl-store:default:r1', 'footer', 'order', NULL, 3, '2026-01-01T00:00:00.000Z'),
  ('op-chain-footer-set', 'revision-store-chain-1', 'footer', 'set', 'block-store-footer-v2-chain', NULL, '2026-01-01T00:00:00.000Z'),
  ('op-fast-promo-set', 'revision-store-fast-food-1', 'category-promo', 'set', 'block-store-promo-v2-fast', NULL, '2026-01-01T00:00:00.000Z'),
  ('op-mcd-hero-set', 'revision-store-mcdonalds-1', 'primary-hero', 'set', 'block-store-hero-v2-mcd', NULL, '2026-01-01T00:00:00.000Z'),
  ('op-bk-hero-set', 'revision-store-burger-king-1', 'primary-hero', 'set', 'block-store-hero-v3-bk', NULL, '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO document_manifests (
  id, template_id, content_hash, placement_count, created_at
) VALUES
  ('manifest-store-mcd-v1', 'tpl-store', '4accc62a515bf038c72033ee01dbb7ffc9352090c1584c1a5d10bd62eb8f0638', 4, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-default-v1', 'tpl-store', 'e8d1c5b5d5dbad68f8532a606858932e32c1a58860aa37ba5b922c5336b9614d', 4, '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO document_manifest_items (
  manifest_id, ordinal, placement_key, block_version_id,
  source_variant_revision_id, source_operation_id, source_priority, created_at
) VALUES
  ('manifest-store-mcd-v1', 0, 'navigation', 'block-store-navigation-v1', 'tpl-store:default:r1', 'op-default-nav-set', 0, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-mcd-v1', 1, 'primary-hero', 'block-store-hero-v2-mcd', 'revision-store-mcdonalds-1', 'op-mcd-hero-set', 30, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-mcd-v1', 2, 'category-promo', 'block-store-promo-v2-fast', 'revision-store-fast-food-1', 'op-fast-promo-set', 20, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-mcd-v1', 3, 'footer', 'block-store-footer-v2-chain', 'revision-store-chain-1', 'op-chain-footer-set', 10, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-default-v1', 0, 'navigation', 'block-store-navigation-v1', 'tpl-store:default:r1', 'op-default-nav-set', 0, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-default-v1', 1, 'primary-hero', 'block-store-hero-v1', 'tpl-store:default:r1', 'op-default-hero-set', 0, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-default-v1', 2, 'category-promo', 'block-store-promo-v1', 'tpl-store:default:r1', 'op-default-promo-set', 0, '2026-01-01T00:00:00.000Z'),
  ('manifest-store-default-v1', 3, 'footer', 'block-store-footer-v1', 'tpl-store:default:r1', 'op-default-footer-set', 0, '2026-01-01T00:00:00.000Z');

INSERT OR IGNORE INTO publications (
  id, template_id, sequence, status, input_hash, previous_publication_id,
  route_revision, page_count, manifest_count, failure_json, created_by, published_at, created_at
) VALUES (
  'publication-store-1', 'tpl-store', 1, 'published', '3e47d2a533c757682471c83cb84b04f28753ebb199184226147a7a8ecf52427b', NULL,
  'store-seed-v1', 2, 2, NULL, 'seed', '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:02.000Z'
);

INSERT OR IGNORE INTO published_page_documents (
  publication_id, template_id, page_instance_id, manifest_id, canonical_url,
  route_status, resolved_data_json, rendered_document_json, document_hash, created_at
) VALUES
  (
    'publication-store-1', 'tpl-store', 'page-store-1001', 'manifest-store-mcd-v1',
    '/en-US/store/1001', 'live',
    '{"contract":"cms-published-placement-content-v1","placements":{"category-promo":{"message":"Fast-food deals"},"footer":{"legal":"Chain-store terms"},"navigation":{"label":"Uber Eats"},"primary-hero":{"headline":"Buy now McDonald''s Market — San Francisco"}}}',
    NULL, '173f0c8b8cfaff9425c595896e3e1d9f4d39bb5b3f73a358582ba17198d6306d', '2026-01-01T00:00:02.000Z'
  ),
  (
    'publication-store-1', 'tpl-store', 'page-store-1002', 'manifest-store-default-v1',
    '/en-US/store/1002', 'live',
    '{"contract":"cms-published-placement-content-v1","placements":{"category-promo":{"message":"Local favorites"},"footer":{"legal":"Standard terms"},"navigation":{"label":"Uber Eats"},"primary-hero":{"headline":"I am Neighborhood Kitchen — Oakland"}}}',
    NULL, '2b7e04a41b0799a12af85ada05bb1bad29d6e665b35e943f5cbf6f2bb4d753a2', '2026-01-01T00:00:02.000Z'
  );

INSERT INTO current_publications (
  template_id, publication_id, activated_at, activated_by
) VALUES (
  'tpl-store', 'publication-store-1', '2026-01-01T00:00:03.000Z', 'seed'
)
ON CONFLICT(template_id) DO NOTHING;
