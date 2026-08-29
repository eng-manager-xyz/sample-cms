export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface BlockVersion {
  readonly id: string;
  readonly lineageId: string;
  readonly blockType: string;
  readonly schemaVersion: number;
  readonly content: JsonObject;
}

export interface DocumentPlacement {
  readonly placementKey: string;
  readonly order: number;
  readonly blockVersion: BlockVersion;
}

export interface SetOperation {
  readonly kind: 'set';
  readonly placementKey: string;
  readonly blockVersion: BlockVersion;
}

export interface TombstoneOperation {
  readonly kind: 'tombstone';
  readonly placementKey: string;
}

export interface OrderOperation {
  readonly kind: 'order';
  readonly placementKey: string;
  readonly order: number;
}

export type VariantOperation = SetOperation | TombstoneOperation | OrderOperation;

export interface VariantLayer {
  readonly id: string;
  readonly priority: number;
  readonly operations: readonly VariantOperation[];
}

export interface DefaultDocument {
  readonly templateId: string;
  readonly placements: readonly DocumentPlacement[];
}

export interface ProvenanceSource {
  readonly kind: 'default' | 'variant';
  readonly sourceId: string;
  readonly priority: number;
}

export interface PlacementTraceStep {
  readonly kind: 'default' | VariantOperation['kind'];
  readonly placementKey: string;
  readonly source: ProvenanceSource;
  readonly blockVersionId?: string;
  readonly order?: number;
}

export interface ResolvedPlacement extends DocumentPlacement {
  readonly provenance: {
    readonly content: ProvenanceSource;
    readonly order: ProvenanceSource;
  };
  readonly trace: readonly PlacementTraceStep[];
}

export interface ResolvedTombstone {
  readonly placementKey: string;
  readonly source: ProvenanceSource;
  readonly hiddenPlacement?: DocumentPlacement;
  readonly trace: readonly PlacementTraceStep[];
}

export interface ResolvedDocument {
  readonly templateId: string;
  readonly placements: readonly ResolvedPlacement[];
  readonly tombstones: readonly ResolvedTombstone[];
  readonly matchedVariantIds: readonly string[];
  readonly contentHash: string;
}
