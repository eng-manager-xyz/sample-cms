import {
  createCmsDatabase,
  inspectDatabaseHealth,
  resetDatabase,
  seedStoreScale,
} from '@repo/cms-db';

import { runDenseEligibleVehiclesProof } from './dense';
import { runGeneratedDeterminismProof } from './properties';
import { runScenarioProofReport, writeJsonReport } from './report';
import {
  requireVerifiedServiceIntegration,
  runServiceIntegrationProof,
} from './service-integration';
import type { StorePhaseProgress } from './store';
import { DEFAULT_STORE_PAGE_COUNT, runStoreProof } from './store';
import { runStructuralReplacementProof } from './structural';

type Command = 'seed' | 'prove' | 'benchmark' | 'report' | 'integration';

interface CliOptions {
  readonly command: Command;
  readonly outputPath: string;
  readonly databasePath: string;
  readonly pageCount: number;
  readonly benchmarkSamples: number;
  readonly propertyCaseCount: number;
  readonly propertySeed: number;
}

const COMMANDS = new Set<Command>(['seed', 'prove', 'benchmark', 'report', 'integration']);

function progressReporter(interval = 100_000): (progress: StorePhaseProgress) => void {
  const lastReported = new Map<StorePhaseProgress['phase'], number>();
  return (progress) => {
    const previous = lastReported.get(progress.phase) ?? 0;
    if (progress.completed !== progress.total && progress.completed - previous < interval) {
      return;
    }
    lastReported.set(progress.phase, progress.completed);
    console.error(
      JSON.stringify({
        event: 'progress',
        phase: progress.phase,
        completed: progress.completed,
        total: progress.total,
      })
    );
  };
}

function readValue(arguments_: readonly string[], index: number, flag: string): string {
  const value = arguments_[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseInteger(value: string, flag: string, allowZero = false): number {
  const integer = Number(value);
  if (!Number.isSafeInteger(integer) || integer < (allowZero ? 0 : 1)) {
    throw new Error(`${flag} must be ${allowZero ? 'a non-negative' : 'a positive'} integer.`);
  }
  return integer;
}

export function parseCliOptions(arguments_: readonly string[]): CliOptions {
  const commandValue = arguments_[0];
  if (!commandValue || !COMMANDS.has(commandValue as Command)) {
    throw new Error('Expected command: seed, prove, benchmark, report, or integration.');
  }
  let outputPath = '';
  let databasePath = '.data/cms-scenarios.sqlite';
  let pageCount = DEFAULT_STORE_PAGE_COUNT;
  let benchmarkSamples = 250;
  let propertyCaseCount = 200;
  let propertySeed = 0x5eedc0de;
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--output') {
      outputPath = readValue(arguments_, index, '--output');
      index += 1;
    } else if (argument === '--database') {
      databasePath = readValue(arguments_, index, '--database');
      index += 1;
    } else if (argument === '--pages') {
      pageCount = parseInteger(readValue(arguments_, index, '--pages'), '--pages', true);
      index += 1;
    } else if (argument === '--samples') {
      benchmarkSamples = parseInteger(readValue(arguments_, index, '--samples'), '--samples');
      index += 1;
    } else if (argument === '--cases') {
      propertyCaseCount = parseInteger(readValue(arguments_, index, '--cases'), '--cases');
      index += 1;
    } else if (argument === '--seed') {
      propertySeed = parseInteger(readValue(arguments_, index, '--seed'), '--seed', true);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument ?? '<missing>'}`);
    }
  }
  if (!outputPath) {
    throw new Error('--output is required so evidence is written to a caller-specified path.');
  }
  return {
    command: commandValue as Command,
    outputPath,
    databasePath,
    pageCount,
    benchmarkSamples,
    propertyCaseCount,
    propertySeed,
  };
}

async function runSeed(options: CliOptions): Promise<unknown> {
  const client = createCmsDatabase({ databasePath: options.databasePath });
  try {
    await resetDatabase(client);
    const reportProgress = progressReporter();
    const seed = await seedStoreScale(client, {
      pageCount: options.pageCount,
      onProgress: (completed, total) => reportProgress({ phase: 'seed', completed, total }),
    });
    return {
      command: 'seed',
      issueId: 'AUT-528',
      databasePath: client.path,
      seed,
      health: inspectDatabaseHealth(client),
      productionSloClaimed: false,
    };
  } finally {
    client.close();
  }
}

async function runProof(options: CliOptions): Promise<unknown> {
  const reportProgress = progressReporter();
  const store = await runStoreProof({
    databasePath: options.databasePath,
    pageCount: options.pageCount,
    benchmarkSamples: options.benchmarkSamples,
    onPhaseProgress: reportProgress,
  });
  const service = await runServiceIntegrationProof();
  requireVerifiedServiceIntegration(service);
  return {
    command: 'prove',
    issues: ['AUT-527', 'AUT-528', 'AUT-529', 'AUT-530'],
    denseEligibleVehicles: runDenseEligibleVehiclesProof(),
    store,
    structuralReplacement: runStructuralReplacementProof(),
    generatedDeterminism: runGeneratedDeterminismProof({
      caseCount: options.propertyCaseCount,
      seed: options.propertySeed,
    }),
    serviceIntegration: service,
    productionSloClaimed: false,
  };
}

async function runBenchmark(options: CliOptions): Promise<unknown> {
  const reportProgress = progressReporter();
  const store = await runStoreProof({
    databasePath: options.databasePath,
    pageCount: options.pageCount,
    benchmarkSamples: options.benchmarkSamples,
    onPhaseProgress: reportProgress,
  });
  return {
    command: 'benchmark',
    issueId: 'AUT-528',
    requestedScalePageCount: store.requestedScalePageCount,
    actualPageCount: store.actualPageCount,
    seed: store.seed,
    seedReplay: store.seedReplay,
    rawCounts: store.rawCounts,
    databaseStorage: store.databaseStorage,
    membershipCounts: store.membershipCounts,
    persistedClassGoldens: store.persistedClassGoldens,
    completeFiveClassCoverage: store.completeFiveClassCoverage,
    selectorDemonstrations: store.selectorDemonstrations,
    scalePublication: store.scalePublication,
    publicServeReadPath: store.publicServeReadPath,
    interpolationManifestSharing: store.interpolationManifestSharing,
    mutationPropagation: store.mutationPropagation,
    canonicalLookupPlan: store.canonicalLookupPlan,
    tagLookupPlan: store.tagLookupPlan,
    benchmark: store.benchmark,
    limitations: store.limitations,
    productionSloClaimed: false,
  };
}

async function runCommand(options: CliOptions): Promise<unknown> {
  if (options.command === 'seed') {
    return runSeed(options);
  }
  if (options.command === 'prove') {
    return runProof(options);
  }
  if (options.command === 'benchmark') {
    return runBenchmark(options);
  }
  if (options.command === 'integration') {
    const evidence = await runServiceIntegrationProof();
    requireVerifiedServiceIntegration(evidence);
    return { command: 'integration', evidence };
  }
  return runScenarioProofReport({
    databasePath: options.databasePath,
    pageCount: options.pageCount,
    benchmarkSamples: options.benchmarkSamples,
    propertyCaseCount: options.propertyCaseCount,
    propertySeed: options.propertySeed,
    onPhaseProgress: progressReporter(),
  });
}

export async function runCli(arguments_: readonly string[] = Bun.argv.slice(2)): Promise<void> {
  const options = parseCliOptions(arguments_);
  const report = await runCommand(options);
  await writeJsonReport(options.outputPath, report);
  console.log(JSON.stringify({ command: options.command, outputPath: options.outputPath }));
}

if (import.meta.main) {
  await runCli();
}
