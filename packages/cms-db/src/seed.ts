import type { CmsDatabaseClient } from './client';
import { runMigrations } from './migrations';

const readSeedAsset = async (): Promise<string> => {
  const assetUrl = new URL('../seed/foundation.sql', import.meta.url);
  const asset = Bun.file(assetUrl);
  if (!(await asset.exists())) {
    throw new Error(`Seed asset not found: ${assetUrl.pathname}`);
  }
  return asset.text();
};

export const seedFoundationDatabase = async (client: CmsDatabaseClient): Promise<void> => {
  await runMigrations(client);
  const seedSql = await readSeedAsset();

  client.sqlite.exec('BEGIN IMMEDIATE');
  try {
    client.sqlite.exec(seedSql);
    client.sqlite.exec('COMMIT');
  } catch (error) {
    client.sqlite.exec('ROLLBACK');
    throw error;
  }
};
