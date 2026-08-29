import { createCmsDatabase } from '../client';
import { inspectDatabaseHealth } from '../health';
import { seedStoreScale } from '../scale';

const configuredPageCount = Number.parseInt(process.env.CMS_SEED_SCALE ?? '1000000', 10);
const client = createCmsDatabase();
try {
  const result = await seedStoreScale(client, {
    pageCount: configuredPageCount,
    onProgress: (inserted, total) => {
      if (inserted === total || inserted % 100_000 === 0) {
        console.log(`Seeded ${inserted.toLocaleString()} / ${total.toLocaleString()} scale pages`);
      }
    },
  });
  const health = inspectDatabaseHealth(client);
  if (!health.healthy) {
    throw new Error(`Scale database is unhealthy: ${health.problems.join('; ')}`);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  client.close();
}
