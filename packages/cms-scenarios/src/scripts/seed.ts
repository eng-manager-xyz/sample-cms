import { createCmsDatabase, inspectDatabaseHealth, seedFoundationDatabase } from '@repo/cms-db';

import { compactScenarioRegistry, ensureCompactPublishedScenarios } from '../compact-seed';

const client = createCmsDatabase();
try {
  await seedFoundationDatabase(client);
  ensureCompactPublishedScenarios(client);
  const health = inspectDatabaseHealth(client);
  if (!health.healthy) {
    throw new Error(`Seeded database is unhealthy: ${health.problems.join('; ')}`);
  }
  console.log(
    `Seeded ${Object.keys(compactScenarioRegistry).length} deterministic published scenarios at ${client.path}`
  );
} finally {
  client.close();
}
