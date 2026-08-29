import { createCmsDatabase } from '../client';
import { inspectDatabaseHealth } from '../health';
import { seedFoundationDatabase } from '../seed';

const client = createCmsDatabase();
try {
  await seedFoundationDatabase(client);
  const health = inspectDatabaseHealth(client);
  if (!health.healthy) {
    throw new Error(`Seeded database is unhealthy: ${health.problems.join('; ')}`);
  }
  console.log(`Seeded deterministic foundation data at ${client.path}`);
} finally {
  client.close();
}
