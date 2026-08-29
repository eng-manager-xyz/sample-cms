import { type CmsDatabaseClient, createCmsDatabase } from './client';
import { runMigrations } from './migrations';

export const createTestDatabase = async (): Promise<CmsDatabaseClient> => {
  const client = createCmsDatabase({ databasePath: ':memory:' });
  await runMigrations(client);
  return client;
};
