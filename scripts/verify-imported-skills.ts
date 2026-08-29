import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const importedRoot = '.agents/skills/_imported/mind-palace';
const expectedFileCount = 115;
const expectedSkillCount = 71;
const expectedSha256 = 'c8c2ae9948af945230ae352400ba8124a7130ecd3945de8119d989b07ace0b17';

async function collectFiles(directory: string): Promise<string[]> {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0
  );
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

const files = await collectFiles(importedRoot);
const skillCount = files.filter((file) => file.endsWith('/SKILL.md')).length;
const hash = createHash('sha256');
for (const file of files) {
  hash.update(relative(importedRoot, file));
  hash.update('\0');
  hash.update(await readFile(file));
  hash.update('\0');
}
const actualSha256 = hash.digest('hex');

const errors: string[] = [];
if (files.length !== expectedFileCount) {
  errors.push(`expected ${expectedFileCount} imported files, found ${files.length}`);
}
if (skillCount !== expectedSkillCount) {
  errors.push(`expected ${expectedSkillCount} SKILL.md files, found ${skillCount}`);
}
if (actualSha256 !== expectedSha256) {
  errors.push(`expected tree SHA-256 ${expectedSha256}, found ${actualSha256}`);
}

if (errors.length > 0) {
  console.error('Imported skill verification failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Imported skill verification passed (${skillCount} skills, ${files.length} files, ${actualSha256}).`
  );
}
