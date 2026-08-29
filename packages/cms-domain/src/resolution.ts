import { canonicalHash } from './hash';
import type {
  BlockVersion,
  DefaultDocument,
  DocumentPlacement,
  JsonObject,
  PlacementTraceStep,
  ProvenanceSource,
  ResolvedDocument,
  ResolvedPlacement,
  ResolvedTombstone,
  VariantLayer,
  VariantOperation,
} from './types';

export type ResolutionErrorCode =
  | 'INVALID_DEFAULT'
  | 'INVALID_VARIANT'
  | 'INVALID_OPERATION'
  | 'PRIORITY_CONFLICT'
  | 'MISSING_ORDER_TARGET'
  | 'INCOMPLETE_PLACEMENT';

export class ResolutionError extends Error {
  readonly code: ResolutionErrorCode;

  constructor(code: ResolutionErrorCode, message: string) {
    super(message);
    this.name = 'ResolutionError';
    this.code = code;
  }
}

export interface VariantConflict {
  readonly priority: number;
  readonly placementKey: string;
  readonly variantIds: readonly string[];
  readonly operationKinds: readonly VariantOperation['kind'][];
}

export class VariantConflictError extends ResolutionError {
  readonly conflicts: readonly VariantConflict[];

  constructor(conflicts: readonly VariantConflict[]) {
    super(
      'PRIORITY_CONFLICT',
      `Publication is ambiguous: ${conflicts
        .map(
          (conflict) =>
            `priority ${conflict.priority}, placement "${conflict.placementKey}", variants ${conflict.variantIds.join(', ')}`
        )
        .join('; ')}.`
    );
    this.name = 'VariantConflictError';
    this.conflicts = conflicts;
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new ResolutionError('INVALID_OPERATION', `${label} cannot be empty.`);
  }
}

function assertOrder(order: number): void {
  if (!Number.isSafeInteger(order)) {
    throw new ResolutionError(
      'INVALID_OPERATION',
      `Placement order ${order} is not a safe integer.`
    );
  }
}

function assertBlockVersion(blockVersion: BlockVersion): void {
  assertNonEmpty(blockVersion.id, 'Block version ID');
  assertNonEmpty(blockVersion.lineageId, 'Block lineage ID');
  assertNonEmpty(blockVersion.blockType, 'Block type');
  if (!Number.isSafeInteger(blockVersion.schemaVersion) || blockVersion.schemaVersion < 1) {
    throw new ResolutionError(
      'INVALID_OPERATION',
      `Block version "${blockVersion.id}" has an invalid schema version.`
    );
  }
}

export function setPlacement(placementKey: string, blockVersion: BlockVersion): VariantOperation {
  assertNonEmpty(placementKey, 'Placement key');
  assertBlockVersion(blockVersion);
  return { kind: 'set', placementKey, blockVersion };
}

export function tombstonePlacement(placementKey: string): VariantOperation {
  assertNonEmpty(placementKey, 'Placement key');
  return { kind: 'tombstone', placementKey };
}

export function orderPlacement(placementKey: string, order: number): VariantOperation {
  assertNonEmpty(placementKey, 'Placement key');
  assertOrder(order);
  return { kind: 'order', placementKey, order };
}

/** Removing every local operation reveals the effective lower-layer placement again. */
export function revertPlacement(
  operations: readonly VariantOperation[],
  placementKey: string
): readonly VariantOperation[] {
  return operations.filter((operation) => operation.placementKey !== placementKey);
}

export interface CopyOnWriteInput {
  readonly id: string;
  readonly content: JsonObject;
  readonly lineageId?: string;
  readonly blockType?: string;
  readonly schemaVersion?: number;
}

export interface CopyOnWriteResult {
  readonly blockVersion: BlockVersion;
  readonly operation: VariantOperation;
}

/** Creates an immutable version plus the sparse set operation that points at it. */
export function copyOnWritePlacement(
  inherited: DocumentPlacement,
  input: CopyOnWriteInput
): CopyOnWriteResult {
  if (input.id === inherited.blockVersion.id) {
    throw new ResolutionError(
      'INVALID_OPERATION',
      'Copy-on-write requires a new block version ID.'
    );
  }
  const blockVersion: BlockVersion = {
    id: input.id,
    lineageId: input.lineageId ?? inherited.blockVersion.lineageId,
    blockType: input.blockType ?? inherited.blockVersion.blockType,
    schemaVersion: input.schemaVersion ?? inherited.blockVersion.schemaVersion,
    content: input.content,
  };
  return {
    blockVersion,
    operation: setPlacement(inherited.placementKey, blockVersion),
  };
}

interface OperationSummary {
  readonly variantId: string;
  readonly kinds: Set<VariantOperation['kind']>;
}

function validateLayer(layer: VariantLayer): void {
  assertNonEmpty(layer.id, 'Variant ID');
  if (!Number.isSafeInteger(layer.priority) || layer.priority <= 0) {
    throw new ResolutionError(
      'INVALID_VARIANT',
      `Variant "${layer.id}" must have an explicit positive integer priority.`
    );
  }

  const contentOperations = new Set<string>();
  const orderOperations = new Set<string>();
  for (const operation of layer.operations) {
    assertNonEmpty(operation.placementKey, 'Placement key');
    if (operation.kind === 'set') {
      assertBlockVersion(operation.blockVersion);
    }
    if (operation.kind === 'order') {
      assertOrder(operation.order);
    }
    const target = operation.kind === 'order' ? orderOperations : contentOperations;
    if (target.has(operation.placementKey)) {
      throw new ResolutionError(
        'INVALID_OPERATION',
        `Variant "${layer.id}" has duplicate ${
          operation.kind === 'order' ? 'order' : 'content'
        } operations for placement "${operation.placementKey}".`
      );
    }
    target.add(operation.placementKey);
  }
}

/** Returns every same-priority/same-placement ambiguity without using row order as a tiebreaker. */
export function detectVariantConflicts(
  variants: readonly VariantLayer[]
): readonly VariantConflict[] {
  const variantIds = new Set<string>();
  const groups = new Map<string, Map<string, OperationSummary>>();
  for (const variant of variants) {
    validateLayer(variant);
    if (variantIds.has(variant.id)) {
      throw new ResolutionError('INVALID_VARIANT', `Duplicate variant ID "${variant.id}".`);
    }
    variantIds.add(variant.id);
    for (const operation of variant.operations) {
      const groupKey = `${variant.priority}\u0000${operation.placementKey}`;
      const group = groups.get(groupKey) ?? new Map<string, OperationSummary>();
      const summary = group.get(variant.id) ?? { variantId: variant.id, kinds: new Set() };
      summary.kinds.add(operation.kind);
      group.set(variant.id, summary);
      groups.set(groupKey, group);
    }
  }

  const conflicts: VariantConflict[] = [];
  for (const [groupKey, variantsById] of groups) {
    if (variantsById.size < 2) {
      continue;
    }
    const separator = groupKey.indexOf('\u0000');
    const priority = Number(groupKey.slice(0, separator));
    const placementKey = groupKey.slice(separator + 1);
    const summaries = [...variantsById.values()];
    conflicts.push({
      priority,
      placementKey,
      variantIds: summaries.map((summary) => summary.variantId).sort(),
      operationKinds: [...new Set(summaries.flatMap((summary) => [...summary.kinds]))].sort(),
    });
  }
  return conflicts.sort(
    (left, right) =>
      left.priority - right.priority || left.placementKey.localeCompare(right.placementKey)
  );
}

export function assertNoVariantConflicts(variants: readonly VariantLayer[]): void {
  const conflicts = detectVariantConflicts(variants);
  if (conflicts.length > 0) {
    throw new VariantConflictError(conflicts);
  }
}

interface PlacementState {
  readonly placementKey: string;
  blockVersion?: BlockVersion;
  order?: number;
  visible: boolean;
  contentSource?: ProvenanceSource;
  orderSource?: ProvenanceSource;
  hiddenPlacement?: DocumentPlacement;
  readonly trace: PlacementTraceStep[];
}

function operationRank(operation: VariantOperation): number {
  return operation.kind === 'order' ? 1 : 0;
}

function sortedOperations(operations: readonly VariantOperation[]): readonly VariantOperation[] {
  return [...operations].sort(
    (left, right) =>
      operationRank(left) - operationRank(right) ||
      left.placementKey.localeCompare(right.placementKey) ||
      left.kind.localeCompare(right.kind)
  );
}

function documentHash(templateId: string, placements: readonly ResolvedPlacement[]): string {
  return canonicalHash({
    templateId,
    placements: placements.map((placement) => ({
      placementKey: placement.placementKey,
      order: placement.order,
      blockVersion: {
        id: placement.blockVersion.id,
        lineageId: placement.blockVersion.lineageId,
        blockType: placement.blockVersion.blockType,
        schemaVersion: placement.blockVersion.schemaVersion,
        content: placement.blockVersion.content,
      },
    })),
  });
}

/** Resolves a default plus matching sparse layers into one stable, provenance-rich document. */
export function resolveDocument(
  defaultDocument: DefaultDocument,
  matchingVariants: readonly VariantLayer[]
): ResolvedDocument {
  assertNonEmpty(defaultDocument.templateId, 'Template ID');
  assertNoVariantConflicts(matchingVariants);

  const states = new Map<string, PlacementState>();
  const defaultSource: ProvenanceSource = {
    kind: 'default',
    sourceId: `default:${defaultDocument.templateId}`,
    priority: 0,
  };
  for (const placement of defaultDocument.placements) {
    assertNonEmpty(placement.placementKey, 'Placement key');
    assertOrder(placement.order);
    assertBlockVersion(placement.blockVersion);
    if (states.has(placement.placementKey)) {
      throw new ResolutionError(
        'INVALID_DEFAULT',
        `Default document repeats placement "${placement.placementKey}".`
      );
    }
    states.set(placement.placementKey, {
      placementKey: placement.placementKey,
      blockVersion: placement.blockVersion,
      order: placement.order,
      visible: true,
      contentSource: defaultSource,
      orderSource: defaultSource,
      trace: [
        {
          kind: 'default',
          placementKey: placement.placementKey,
          source: defaultSource,
          blockVersionId: placement.blockVersion.id,
          order: placement.order,
        },
      ],
    });
  }

  const orderedVariants = [...matchingVariants].sort(
    (left, right) => left.priority - right.priority || left.id.localeCompare(right.id)
  );
  for (const variant of orderedVariants) {
    const source: ProvenanceSource = {
      kind: 'variant',
      sourceId: variant.id,
      priority: variant.priority,
    };
    for (const operation of sortedOperations(variant.operations)) {
      const existing = states.get(operation.placementKey);
      if (operation.kind === 'set') {
        const state: PlacementState = existing ?? {
          placementKey: operation.placementKey,
          visible: false,
          trace: [],
        };
        state.blockVersion = operation.blockVersion;
        state.contentSource = source;
        state.visible = true;
        state.hiddenPlacement = undefined;
        state.trace.push({
          kind: 'set',
          placementKey: operation.placementKey,
          source,
          blockVersionId: operation.blockVersion.id,
        });
        states.set(operation.placementKey, state);
        continue;
      }
      if (operation.kind === 'tombstone') {
        const state: PlacementState = existing ?? {
          placementKey: operation.placementKey,
          visible: false,
          trace: [],
        };
        if (state.visible && state.blockVersion !== undefined && state.order !== undefined) {
          state.hiddenPlacement = {
            placementKey: state.placementKey,
            blockVersion: state.blockVersion,
            order: state.order,
          };
        }
        state.visible = false;
        state.contentSource = source;
        state.trace.push({ kind: 'tombstone', placementKey: operation.placementKey, source });
        states.set(operation.placementKey, state);
        continue;
      }
      if (!existing?.visible) {
        throw new ResolutionError(
          'MISSING_ORDER_TARGET',
          `Variant "${variant.id}" orders absent placement "${operation.placementKey}".`
        );
      }
      existing.order = operation.order;
      existing.orderSource = source;
      existing.trace.push({
        kind: 'order',
        placementKey: operation.placementKey,
        source,
        order: operation.order,
      });
    }
  }

  const placements: ResolvedPlacement[] = [];
  const tombstones: ResolvedTombstone[] = [];
  for (const state of states.values()) {
    if (!state.visible) {
      if (state.contentSource?.kind === 'variant') {
        const tombstone: ResolvedTombstone = {
          placementKey: state.placementKey,
          source: state.contentSource,
          trace: state.trace,
          ...(state.hiddenPlacement === undefined
            ? {}
            : { hiddenPlacement: state.hiddenPlacement }),
        };
        tombstones.push(tombstone);
      }
      continue;
    }
    if (
      state.blockVersion === undefined ||
      state.order === undefined ||
      state.contentSource === undefined ||
      state.orderSource === undefined
    ) {
      throw new ResolutionError(
        'INCOMPLETE_PLACEMENT',
        `Placement "${state.placementKey}" is visible without content, order, or provenance.`
      );
    }
    placements.push({
      placementKey: state.placementKey,
      blockVersion: state.blockVersion,
      order: state.order,
      provenance: { content: state.contentSource, order: state.orderSource },
      trace: state.trace,
    });
  }

  placements.sort(
    (left, right) => left.order - right.order || left.placementKey.localeCompare(right.placementKey)
  );
  tombstones.sort((left, right) => left.placementKey.localeCompare(right.placementKey));
  return {
    templateId: defaultDocument.templateId,
    placements,
    tombstones,
    matchedVariantIds: orderedVariants.map((variant) => variant.id),
    contentHash: documentHash(defaultDocument.templateId, placements),
  };
}
