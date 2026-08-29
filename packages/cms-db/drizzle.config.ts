import { defineConfig } from 'drizzle-kit';

const databasePath = process.env.DATABASE_PATH ?? '.data/auteur-cms.sqlite';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: databasePath,
  },
  strict: true,
  verbose: true,
});
