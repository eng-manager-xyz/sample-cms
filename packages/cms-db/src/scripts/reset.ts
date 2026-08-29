import { createCmsDatabase } from '../client';
import { inspectDatabaseHealth } from '../health';
import { resetDatabase } from '../reset';

const client = createCmsDatabase();
try {
  await resetDatabase(client);
  const health = inspectDatabaseHealth(client);
  console.log(`Reset database at ${client.path}; schema version ${health.schemaVersion}`);
} finally {
  client.close();
}
