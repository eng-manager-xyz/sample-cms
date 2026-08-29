import { createCmsDatabase } from '@repo/cms-db';

import { type DenseScenarioReport, runDenseEligibleVehiclesProof } from './dense';
import { type PropertyProofReport, runGeneratedDeterminismProof } from './properties';
import {
  runServiceIntegrationProof,
  type ScenarioServiceAdapter,
  type ServiceIntegrationEvidence,
} from './service-integration';
import { runStoreProof, type StoreScenarioOptions, type StoreScenarioReport } from './store';
import { runStructuralReplacementProof, type StructuralScenarioReport } from './structural';

export interface ScenarioEnvironment {
  readonly platform: string;
  readonly architecture: string;
  readonly bunVersion: string;
  readonly sqliteVersion: string;
}

export interface ScenarioTiming {
  readonly name: string;
  readonly elapsedMilliseconds: number;
}

export interface ScenarioProofReport {
  readonly reportVersion: 1;
  readonly generatedAt: string;
  readonly issues: readonly ['AUT-527', 'AUT-528', 'AUT-529', 'AUT-530'];
  readonly environment: ScenarioEnvironment;
  readonly timings: readonly ScenarioTiming[];
  readonly denseEligibleVehicles: DenseScenarioReport;
  readonly store: StoreScenarioReport;
  readonly structuralReplacement: StructuralScenarioReport;
  readonly generatedDeterminism: PropertyProofReport;
  readonly serviceIntegration: ServiceIntegrationEvidence;
  readonly productionSloClaimed: false;
}

export interface ScenarioProofOptions extends StoreScenarioOptions {
  readonly generatedAt?: string;
  readonly propertyCaseCount?: number;
  readonly propertySeed?: number;
  readonly serviceAdapter?: ScenarioServiceAdapter;
}

function environment(): ScenarioEnvironment {
  const client = createCmsDatabase({ databasePath: ':memory:' });
  try {
    const sqliteVersion =
      client.sqlite.query<{ version: string }, []>('SELECT sqlite_version() AS version').get()
        ?.version ?? 'unknown';
    return {
      platform: process.platform,
      architecture: process.arch,
      bunVersion: Bun.version,
      sqliteVersion,
    };
  } finally {
    client.close();
  }
}

function timed<T>(
  name: string,
  operation: () => T
): { readonly value: T; readonly timing: ScenarioTiming } {
  const startedAt = performance.now();
  const value = operation();
  return { value, timing: { name, elapsedMilliseconds: performance.now() - startedAt } };
}

async function timedAsync<T>(
  name: string,
  operation: () => Promise<T>
): Promise<{ readonly value: T; readonly timing: ScenarioTiming }> {
  const startedAt = performance.now();
  const value = await operation();
  return { value, timing: { name, elapsedMilliseconds: performance.now() - startedAt } };
}

export async function runScenarioProofReport(
  options: ScenarioProofOptions = {}
): Promise<ScenarioProofReport> {
  const dense = timed('dense-eligible-vehicles', runDenseEligibleVehiclesProof);
  const structural = timed('structural-replacement', runStructuralReplacementProof);
  const properties = timed('generated-determinism', () =>
    runGeneratedDeterminismProof({
      ...(options.propertyCaseCount === undefined ? {} : { caseCount: options.propertyCaseCount }),
      ...(options.propertySeed === undefined ? {} : { seed: options.propertySeed }),
    })
  );
  const store = await timedAsync('store', () => runStoreProof(options));
  const service = await timedAsync('cms-service-integration', () =>
    runServiceIntegrationProof(options.serviceAdapter)
  );

  return {
    reportVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    issues: ['AUT-527', 'AUT-528', 'AUT-529', 'AUT-530'],
    environment: environment(),
    timings: [dense.timing, store.timing, structural.timing, properties.timing, service.timing],
    denseEligibleVehicles: dense.value,
    store: store.value,
    structuralReplacement: structural.value,
    generatedDeterminism: properties.value,
    serviceIntegration: service.value,
    productionSloClaimed: false,
  };
}

export async function writeJsonReport(outputPath: string, value: unknown): Promise<void> {
  if (outputPath.trim().length === 0) {
    throw new Error('A non-empty output path is required.');
  }
  const file = Bun.file(outputPath);
  await Bun.write(file, `${JSON.stringify(value, null, 2)}\n`, { createPath: true });
}
