import type { CmsDatabaseClient } from './client';
import { runMigrations } from './migrations';

interface SchemaObjectRow {
  name: string;
  type: 'table' | 'view';
}

const quoteIdentifier = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

export const resetDatabase = async (client: CmsDatabaseClient): Promise<void> => {
  client.sqlite.exec('PRAGMA foreign_keys = OFF');
  const objects = client.sqlite
    .query<SchemaObjectRow, []>(`
      SELECT name, type
      FROM sqlite_schema
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY CASE type WHEN 'view' THEN 0 ELSE 1 END, name DESC
    `)
    .all();

  client.sqlite.exec('BEGIN IMMEDIATE');
  try {
    for (const object of objects) {
      const keyword = object.type === 'view' ? 'VIEW' : 'TABLE';
      client.sqlite.exec(`DROP ${keyword} IF EXISTS ${quoteIdentifier(object.name)}`);
    }
    client.sqlite.exec('COMMIT');
  } catch (error) {
    client.sqlite.exec('ROLLBACK');
    throw error;
  } finally {
    client.sqlite.exec('PRAGMA foreign_keys = ON');
  }

  await runMigrations(client);
};
