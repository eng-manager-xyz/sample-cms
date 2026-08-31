import type { Database } from 'bun:sqlite';

import type { CmsDatabaseClient } from './client';

export const CURRENT_SCHEMA_VERSION = 8;

interface MigrationDefinition {
  version: number;
  name: string;
  assetPath: string;
}

interface AppliedMigrationRow {
  checksum: string;
}

const migrationDefinitions: readonly MigrationDefinition[] = [
  {
    version: 1,
    name: '0000_slot_variant_foundation',
    assetPath: '../drizzle/0000_slot_variant_foundation.sql',
  },
  {
    version: 2,
    name: '0001_authoring_contract',
    assetPath: '../drizzle/0001_authoring-contract.sql',
  },
  {
    version: 3,
    name: '0002_block_version_parent_provenance',
    assetPath: '../drizzle/0002_block-version-parent-provenance.sql',
  },
  {
    version: 4,
    name: '0003_domain_path_canonical_identity',
    assetPath: '../drizzle/0003_domain-path-canonical-identity.sql',
  },
  {
    version: 5,
    name: '0004_selector_validation_and_preview_metadata',
    assetPath: '../drizzle/0004_selector-validation-and-preview-metadata.sql',
  },
  {
    version: 6,
    name: '0005_route_source_observed_at',
    assetPath: '../drizzle/0005_route-source-observed-at.sql',
  },
  {
    version: 7,
    name: '0006_router_service_terminology',
    assetPath: '../drizzle/0006_natural_jubilee.sql',
  },
  {
    version: 8,
    name: '0007_template_provisioning',
    assetPath: '../drizzle/0007_template-provisioning.sql',
  },
];

const readSqlAsset = async (assetPath: string): Promise<string> => {
  const assetUrl = new URL(assetPath, import.meta.url);
  const asset = Bun.file(assetUrl);
  if (!(await asset.exists())) {
    throw new Error(`SQL asset not found: ${assetUrl.pathname}`);
  }
  return asset.text();
};

const checksum = (contents: string): string =>
  new Bun.CryptoHasher('sha256').update(contents).digest('hex');

const ensureMigrationTable = (sqlite: Database): void => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _cms_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

export const runMigrations = async (client: CmsDatabaseClient): Promise<number> => {
  ensureMigrationTable(client.sqlite);
  let appliedCount = 0;

  for (const migration of migrationDefinitions) {
    const migrationSql = await readSqlAsset(migration.assetPath);
    const migrationChecksum = checksum(migrationSql);
    const existing = client.sqlite
      .query<AppliedMigrationRow, [number]>(
        'SELECT checksum FROM _cms_migrations WHERE version = ?'
      )
      .get(migration.version);

    if (existing) {
      if (existing.checksum !== migrationChecksum) {
        throw new Error(
          `Migration ${migration.name} changed after it was applied; create a new migration instead`
        );
      }
      continue;
    }

    client.sqlite.exec('BEGIN IMMEDIATE');
    try {
      client.sqlite.exec(migrationSql);
      client.sqlite
        .query('INSERT INTO _cms_migrations (version, name, checksum) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, migrationChecksum);
      client.sqlite.exec('COMMIT');
      appliedCount += 1;
    } catch (error) {
      client.sqlite.exec('ROLLBACK');
      throw error;
    }
  }

  return appliedCount;
};

export const getAppliedSchemaVersion = (sqlite: Database): number => {
  ensureMigrationTable(sqlite);
  const row = sqlite
    .query<{ version: number | null }, []>('SELECT max(version) AS version FROM _cms_migrations')
    .get();
  return row?.version ?? 0;
};
