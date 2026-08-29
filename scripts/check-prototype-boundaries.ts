import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const sourceRoots = ['apps/cms', 'packages'] as const;
const ignoredDirectories = new Set([
  '.output',
  '.tanstack',
  '.turbo',
  '_imported',
  'coverage',
  'dist',
  'node_modules',
]);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);
const forbiddenPackagePattern =
  /['"](?:next(?:\/[^'"]+)?|@sentry\/[^'"]+|@supabase\/[^'"]+|@workos[^'"]*|postgres|pg|@vercel\/[^'"]+|@bunny\.net\/[^'"]+|@repo\/supabase-utils)['"]/g;
const forbiddenEnvironmentPattern =
  /\b(?:SUPABASE|WORKOS|SENTRY|VERCEL|BUNNY|IMAGEKIT|TENSORZERO)_[A-Z0-9_]+\b/g;
const errors: string[] = [];

async function collect(directory: string): Promise<string[]> {
  if (!existsSync(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (ignoredDirectories.has(entry.name)) return [];
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collect(path);
      return sourceExtensions.has(extname(entry.name)) || entry.name === 'package.json'
        ? [path]
        : [];
    })
  );
  return nested.flat();
}

for (const sourceRoot of sourceRoots) {
  for (const file of await collect(join(root, sourceRoot))) {
    const source = await readFile(file, 'utf8');
    const packages = [...new Set(source.match(forbiddenPackagePattern) ?? [])];
    const environmentNames = [...new Set(source.match(forbiddenEnvironmentPattern) ?? [])];
    if (packages.length > 0) {
      errors.push(`${relative(root, file)} references excluded packages: ${packages.join(', ')}`);
    }
    if (environmentNames.length > 0) {
      errors.push(
        `${relative(root, file)} references excluded production environment: ${environmentNames.join(', ')}`
      );
    }

    if (
      sourceRoot === 'apps/cms' &&
      source.includes("from 'bun:sqlite'") &&
      !file.endsWith('.server.ts') &&
      !file.includes('/src/server-functions/')
    ) {
      errors.push(`${relative(root, file)} imports bun:sqlite outside a server-only boundary`);
    }

    if (
      sourceRoot === 'apps/cms' &&
      /(?:from\s+|import\s*\()['"]@repo\/(?:cms-db|cms-service)['"]/.test(source) &&
      !file.endsWith('.server.ts') &&
      !file.includes('/src/server-functions/')
    ) {
      errors.push(
        `${relative(root, file)} imports a SQLite-backed workspace outside a server-only boundary`
      );
    }
  }
}

for (const requiredFile of [
  'apps/cms/vite.config.ts',
  'apps/cms/src/client.tsx',
  'apps/cms/src/router.tsx',
  'apps/cms/src/routes/__root.tsx',
  'apps/cms/src/start.ts',
]) {
  if (!existsSync(join(root, requiredFile)))
    errors.push(`missing TanStack Start entry: ${requiredFile}`);
}

for (const excludedPath of ['supabase', 'terraform', 'tensorzero', 'apps/mcp', 'apps/img']) {
  if (existsSync(join(root, excludedPath)))
    errors.push(`excluded Median surface exists: ${excludedPath}`);
}

if (errors.length > 0) {
  console.error(`Prototype boundary check failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Prototype boundary check passed.');
}
