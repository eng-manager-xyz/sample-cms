import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import * as schema from './schema';

const findWorkspaceRoot = (startDirectory: string): string => {
  let candidate = resolve(startDirectory);
  while (true) {
    if (
      existsSync(join(candidate, 'turbo.json')) &&
      existsSync(join(candidate, 'packages', 'cms-db', 'package.json'))
    ) {
      return candidate;
    }
    const parent = dirname(candidate);
    if (parent === candidate) {
      return resolve(startDirectory);
    }
    candidate = parent;
  }
};

export const DEFAULT_DATABASE_PATH = join(findWorkspaceRoot(process.cwd()), 'data', 'auteur.db');

export interface CmsDatabaseOptions {
  databasePath?: string;
  readonly?: boolean;
  create?: boolean;
  logger?: boolean;
}

export interface CmsDatabaseClient {
  path: string;
  sqlite: Database;
  db: BunSQLiteDatabase<typeof schema>;
  close: () => void;
}

const isMemoryPath = (databasePath: string) =>
  databasePath === ':memory:' || databasePath.startsWith('file::memory:');

export const resolveDatabasePath = (databasePath?: string): string => {
  const configuredPath = databasePath ?? process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
  if (isMemoryPath(configuredPath) || configuredPath.startsWith('file:')) {
    return configuredPath;
  }
  return resolve(configuredPath);
};

export const createCmsDatabase = (options: CmsDatabaseOptions = {}): CmsDatabaseClient => {
  const path = resolveDatabasePath(options.databasePath);
  const readonly = options.readonly ?? false;

  if (!readonly && !isMemoryPath(path) && !path.startsWith('file:')) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const sqlite = new Database(path, {
    create: options.create ?? !readonly,
    readwrite: !readonly,
    readonly,
  });
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec('PRAGMA busy_timeout = 5000');
  if (!readonly && !isMemoryPath(path)) {
    sqlite.exec('PRAGMA journal_mode = WAL');
    sqlite.exec('PRAGMA synchronous = NORMAL');
  }

  const db = drizzle(sqlite, {
    schema,
    logger: options.logger ?? false,
  });

  return {
    path,
    sqlite,
    db,
    close: () => sqlite.close(),
  };
};
