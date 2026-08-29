import { createCmsDatabase } from '../client';
import { getAppliedSchemaVersion, runMigrations } from '../migrations';

const client = createCmsDatabase();
try {
  const appliedCount = await runMigrations(client);
  const schemaVersion = getAppliedSchemaVersion(client.sqlite);
  console.log(`Applied ${appliedCount} migration(s); schema version is ${schemaVersion}`);
} finally {
  client.close();
}
