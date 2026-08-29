import { statfsSync } from 'node:fs';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { relative, resolve } from 'node:path';

import {
  runScenarioProofReport,
  type StorePhaseProgress,
  writeJsonReport,
} from '@repo/cms-scenarios';

interface Options {
  readonly outputPath: string;
  readonly databasePath: string;
  readonly pageCount: number;
  readonly sampleCount: number;
  readonly caseCount: number;
  readonly seed: number;
}

function valueAfter(arguments_: readonly string[], index: number): string {
  const value = arguments_[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${arguments_[index]} requires a value.`);
  return value;
}

function positiveInteger(value: string, flag: string, allowZero = false): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < (allowZero ? 0 : 1)) {
    throw new Error(`${flag} must be ${allowZero ? 'a non-negative' : 'a positive'} integer.`);
  }
  return result;
}

function parseOptions(arguments_: readonly string[]): Options {
  let outputPath = '';
  let databasePath = '';
  let pageCount = 1_000;
  let sampleCount = 100;
  let caseCount = 200;
  let seed = 1_592_639_710;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = valueAfter(arguments_, index);
    if (argument === '--output') outputPath = value;
    else if (argument === '--database') databasePath = value;
    else if (argument === '--pages') pageCount = positiveInteger(value, argument, true);
    else if (argument === '--samples') sampleCount = positiveInteger(value, argument);
    else if (argument === '--cases') caseCount = positiveInteger(value, argument);
    else if (argument === '--seed') seed = positiveInteger(value, argument, true);
    else throw new Error(`Unknown argument: ${argument ?? '<missing>'}`);
    index += 1;
  }
  if (!outputPath || !databasePath) throw new Error('--output and --database are required.');
  return { outputPath, databasePath, pageCount, sampleCount, caseCount, seed };
}

function runText(command: readonly string[]): string {
  const result = Bun.spawnSync({ cmd: [...command], cwd: process.cwd(), stderr: 'ignore' });
  return result.exitCode === 0 ? result.stdout.toString().trim() : 'unavailable';
}

async function sha256(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(path).arrayBuffer());
  return hasher.digest('hex');
}

function progressRecorder(interval: number): {
  readonly checkpoints: StorePhaseProgress[];
  readonly report: (progress: StorePhaseProgress) => void;
} {
  const lastReported = new Map<StorePhaseProgress['phase'], number>();
  const checkpoints: StorePhaseProgress[] = [];
  const report = (progress: StorePhaseProgress): void => {
    const previous = lastReported.get(progress.phase) ?? 0;
    if (progress.completed !== progress.total && progress.completed - previous < interval) return;
    lastReported.set(progress.phase, progress.completed);
    checkpoints.push(progress);
    console.error(
      JSON.stringify({
        event: 'progress',
        phase: progress.phase,
        completed: progress.completed,
        total: progress.total,
      })
    );
  };
  return { checkpoints, report };
}

function formatEvidence(path: string): void {
  const result = Bun.spawnSync({
    cmd: ['bunx', 'biome', 'format', '--write', path],
    cwd: process.cwd(),
    stdout: 'ignore',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) {
    throw new Error(`Could not format evidence JSON: ${result.stderr.toString().trim()}`);
  }
}

const options = parseOptions(Bun.argv.slice(2));
const startedAt = new Date();
const startedPerformance = performance.now();
const workingTreeBeforeRun = runText(['git', 'status', '--short']);
const storeProgress = progressRecorder(
  Math.max(1, Math.min(100_000, Math.ceil(options.pageCount / 10)))
);
const report = await runScenarioProofReport({
  databasePath: options.databasePath,
  pageCount: options.pageCount,
  benchmarkSamples: options.sampleCount,
  propertyCaseCount: options.caseCount,
  propertySeed: options.seed,
  onPhaseProgress: storeProgress.report,
});
const resourceUsage = process.resourceUsage();
const disk = statfsSync('.');
const databaseFile = Bun.file(options.databasePath);
const evidence = {
  evidenceVersion: 1,
  run: {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    elapsedMilliseconds: performance.now() - startedPerformance,
    invocation: [
      'bun',
      'run',
      'scripts/run-scenario-evidence.ts',
      '--output',
      relative(process.cwd(), resolve(options.outputPath)),
      '--database',
      relative(process.cwd(), resolve(options.databasePath)),
      '--pages',
      String(options.pageCount),
      '--samples',
      String(options.sampleCount),
      '--cases',
      String(options.caseCount),
      '--seed',
      String(options.seed),
    ],
    gitCommit: runText(['git', 'rev-parse', 'HEAD']),
    workingTreeBeforeRun,
    bunLockSha256: await sha256('bun.lock'),
    packageManagerPin: (await Bun.file('package.json').json()).packageManager,
    databasePath: relative(process.cwd(), resolve(options.databasePath)),
    databaseFileBytes: databaseFile.size,
    progressCheckpoints: storeProgress.checkpoints,
    host: {
      platform: platform(),
      release: release(),
      architecture: arch(),
      cpuModel: cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: cpus().length,
      physicalMemoryBytes: totalmem(),
      diskFreeBytesBeforeReportWrite: Number(disk.bavail) * Number(disk.bsize),
    },
    process: {
      userCpuMicroseconds: resourceUsage.userCPUTime,
      systemCpuMicroseconds: resourceUsage.systemCPUTime,
      maxRssBytes: resourceUsage.maxRSS,
    },
  },
  scenarioReport: report,
};

await writeJsonReport(options.outputPath, evidence);
formatEvidence(options.outputPath);
console.log(
  JSON.stringify({
    outputPath: options.outputPath,
    pageCount: options.pageCount,
    elapsedMilliseconds: evidence.run.elapsedMilliseconds,
  })
);
