import { benchmarkDatabase } from '../benchmark';
import { createCmsDatabase } from '../client';
import { inspectDatabaseHealth } from '../health';

const client = createCmsDatabase({ create: false });
try {
  const health = inspectDatabaseHealth(client);
  if (!health.healthy) {
    throw new Error(`Cannot benchmark an unhealthy database: ${health.problems.join('; ')}`);
  }
  console.log(JSON.stringify(benchmarkDatabase(client), null, 2));
} finally {
  client.close();
}
