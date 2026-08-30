import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type {
  EffectivePlacement,
  LayerOperation,
  ScenarioFixture,
  VariantLayer,
} from '@/data/scenario-fixtures';

type ThreeModule = typeof import('three');
type ThreeMaterial = import('three').Material;
type ThreeGeometry = import('three').BufferGeometry;
type ThreeMesh = import('three').Mesh;
type ThreeGroup = import('three').Group;
type ThreeScene = import('three').Scene;
type ThreeCamera = import('three').OrthographicCamera;
type ThreeRenderer = import('three').WebGLRenderer;

interface LayerPlaneRecord {
  layer: VariantLayer;
  matching: boolean;
  mesh: ThreeMesh;
  material: import('three').MeshBasicMaterial;
}

interface OperationTokenRecord {
  operation: LayerOperation;
  mesh: ThreeMesh;
}

interface ResolutionRuntime {
  three: ThreeModule;
  scene: ThreeScene;
  camera: ThreeCamera;
  renderer: ThreeRenderer;
  observer: ResizeObserver;
  layerPlanes: LayerPlaneRecord[];
  operationTokens: OperationTokenRecord[];
  camoGate: ThreeGroup;
  pin: ThreeMesh;
  conflictStop: ThreeMesh;
  manifest: ThreeGroup;
  geometries: Set<ThreeGeometry>;
  materials: Set<ThreeMaterial>;
}

interface RuntimeState {
  beat: number;
  conflict: boolean;
  selectedPlacementKey: string;
  showNonmatching: boolean;
}

const beatCopy = [
  'Camo Press decides whether this canonical route may serve.',
  'The template default and selector-scoped variants form one ordered stack.',
  'A pin isolates the matching layers for exactly one canonical page.',
  'Operations resolve by stable placement key; inheritance remains visible.',
  'Tombstones hide lower content and equal-priority conflicts stop publication.',
  'A conflict-free stack flattens into an immutable manifest with provenance.',
] as const;

const layerColors: Record<VariantLayer['tone'], number> = {
  neutral: 0x6e6e78,
  blue: 0x4d79c7,
  purple: 0x7657d5,
  amber: 0xc08a2e,
  green: 0x3c9467,
  red: 0xcf3e45,
};

function placementColumn(placements: EffectivePlacement[], placementKey: string) {
  const index = placements.findIndex((placement) => placement.placementKey === placementKey);
  if (index < 0) return 0;
  if (placements.length <= 1) return 0;
  return -2 + (index / (placements.length - 1)) * 4;
}

function resizeRuntime(runtime: ResolutionRuntime, host: HTMLElement) {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  const aspect = width / height;
  const halfHeight = 4.4;
  runtime.camera.left = -halfHeight * aspect;
  runtime.camera.right = halfHeight * aspect;
  runtime.camera.top = halfHeight;
  runtime.camera.bottom = -halfHeight;
  runtime.camera.updateProjectionMatrix();
  runtime.renderer.setSize(width, height, false);
  runtime.renderer.render(runtime.scene, runtime.camera);
}

function updateRuntime(runtime: ResolutionRuntime, state: RuntimeState, scenario: ScenarioFixture) {
  runtime.camoGate.visible = state.beat >= 1;
  runtime.layerPlanes.forEach((record) => {
    record.mesh.visible = state.beat >= 2 && (record.matching || state.showNonmatching);
    record.material.opacity = record.matching ? 0.22 : 0.045;
    record.material.wireframe = !record.matching;
  });
  runtime.pin.visible = state.beat >= 3;
  runtime.pin.position.x = placementColumn(scenario.pin.placements, state.selectedPlacementKey);
  runtime.operationTokens.forEach((record) => {
    record.mesh.visible = state.beat >= 4;
    const selected = record.operation.placementKey === state.selectedPlacementKey;
    record.mesh.scale.set(selected ? 1.28 : 0.88, selected ? 1.28 : 0.88, selected ? 1.28 : 0.88);
  });
  runtime.conflictStop.visible = state.beat >= 5 && state.conflict;
  runtime.manifest.visible = state.beat >= 6 && !state.conflict;
  runtime.renderer.render(runtime.scene, runtime.camera);
}

function disposeRuntime(runtime: ResolutionRuntime) {
  runtime.observer.disconnect();
  runtime.renderer.setAnimationLoop(null);
  runtime.geometries.forEach((geometry) => {
    geometry.dispose();
  });
  runtime.materials.forEach((material) => {
    material.dispose();
  });
  runtime.renderer.renderLists.dispose();
  runtime.renderer.dispose();
  runtime.renderer.forceContextLoss();
  runtime.scene.clear();
}

function buildRuntime(
  three: ThreeModule,
  canvas: HTMLCanvasElement,
  host: HTMLElement,
  scenario: ScenarioFixture
): ResolutionRuntime {
  const geometries = new Set<ThreeGeometry>();
  const materials = new Set<ThreeMaterial>();
  const scene = new three.Scene();
  const camera = new three.OrthographicCamera(-7, 7, 4.4, -4.4, 0.1, 100);
  camera.position.set(7.8, 7.1, 10.2);
  camera.lookAt(0, -0.15, 0);
  const renderer = new three.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0xffffff, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = three.SRGBColorSpace;

  const grid = new three.GridHelper(12, 20, 0xd9d9df, 0xededf0);
  grid.position.y = -2.15;
  scene.add(grid);
  geometries.add(grid.geometry);
  if (Array.isArray(grid.material)) {
    grid.material.forEach((material) => {
      materials.add(material);
    });
  } else {
    materials.add(grid.material);
  }

  const matchingLayerIds = new Set([
    scenario.layers[0]?.id ?? '',
    ...scenario.pin.matchingLayerIds,
  ]);
  const planeGeometry = new three.PlaneGeometry(5.7, 3.25);
  geometries.add(planeGeometry);
  const layerPlanes = scenario.layers.map((layer, index): LayerPlaneRecord => {
    const material = new three.MeshBasicMaterial({
      color: layerColors[layer.tone],
      transparent: true,
      opacity: 0.22,
      side: three.DoubleSide,
      depthWrite: false,
    });
    materials.add(material);
    const mesh = new three.Mesh(planeGeometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, -1.55 + index * 0.62, 0);
    scene.add(mesh);
    return { layer, matching: matchingLayerIds.has(layer.id), mesh, material };
  });

  const tokenGeometry = new three.BoxGeometry(0.34, 0.18, 0.34);
  geometries.add(tokenGeometry);
  const operationTokens: OperationTokenRecord[] = [];
  scenario.layers.forEach((layer, layerIndex) => {
    layer.operations.forEach((operation) => {
      const color = operation.kind === 'hide' ? 0xcf3e45 : layerColors[layer.tone];
      const material = new three.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
      materials.add(material);
      const mesh = new three.Mesh(tokenGeometry, material);
      mesh.position.set(
        placementColumn(scenario.pin.placements, operation.placementKey),
        -1.42 + layerIndex * 0.62,
        0
      );
      if (operation.kind === 'hide') mesh.scale.set(1.35, 0.35, 1.35);
      scene.add(mesh);
      operationTokens.push({ operation, mesh });
    });
  });

  const pinGeometry = new three.CylinderGeometry(0.055, 0.055, 4.75, 18);
  const pinMaterial = new three.MeshBasicMaterial({ color: 0x7657d5 });
  geometries.add(pinGeometry);
  materials.add(pinMaterial);
  const pin = new three.Mesh(pinGeometry, pinMaterial);
  pin.position.set(0, -0.1, 0);
  scene.add(pin);

  const gateGeometry = new three.BoxGeometry(0.95, 1.5, 0.32);
  const gateMaterial = new three.MeshBasicMaterial({
    color: 0x3c9467,
    transparent: true,
    opacity: 0.88,
  });
  geometries.add(gateGeometry);
  materials.add(gateMaterial);
  const camoGate = new three.Group();
  const gateLeft = new three.Mesh(gateGeometry, gateMaterial);
  const gateRight = new three.Mesh(gateGeometry, gateMaterial);
  gateLeft.position.x = -0.68;
  gateRight.position.x = 0.68;
  camoGate.add(gateLeft, gateRight);
  camoGate.position.set(-4.45, -0.65, 0);
  scene.add(camoGate);

  const stopGeometry = new three.BoxGeometry(6.35, 0.16, 3.7);
  const stopMaterial = new three.MeshBasicMaterial({
    color: 0xcf3e45,
    transparent: true,
    opacity: 0.36,
  });
  geometries.add(stopGeometry);
  materials.add(stopMaterial);
  const conflictStop = new three.Mesh(stopGeometry, stopMaterial);
  conflictStop.position.y = 1.7;
  scene.add(conflictStop);

  const manifest = new three.Group();
  const manifestGeometry = new three.BoxGeometry(2.1, 3.15, 0.18);
  const manifestMaterial = new three.MeshBasicMaterial({
    color: 0x3c9467,
    transparent: true,
    opacity: 0.28,
  });
  geometries.add(manifestGeometry);
  materials.add(manifestMaterial);
  const manifestBody = new three.Mesh(manifestGeometry, manifestMaterial);
  manifest.add(manifestBody);
  const rowGeometry = new three.BoxGeometry(1.5, 0.12, 0.12);
  const rowMaterial = new three.MeshBasicMaterial({ color: 0x28724d });
  geometries.add(rowGeometry);
  materials.add(rowMaterial);
  scenario.pin.placements.slice(0, 7).forEach((_, index) => {
    const row = new three.Mesh(rowGeometry, rowMaterial);
    row.position.set(0, 1.05 - index * 0.34, 0.16);
    manifest.add(row);
  });
  manifest.position.set(4.45, -0.1, 0);
  scene.add(manifest);

  const observer = new ResizeObserver(() => resizeRuntime(runtime, host));
  const runtime: ResolutionRuntime = {
    three,
    scene,
    camera,
    renderer,
    observer,
    layerPlanes,
    operationTokens,
    camoGate,
    pin,
    conflictStop,
    manifest,
    geometries,
    materials,
  };
  observer.observe(host);
  resizeRuntime(runtime, host);
  return runtime;
}

function selectedOperations(scenario: ScenarioFixture, placementKey: string) {
  const selected: Array<{ layer: VariantLayer; operation: LayerOperation }> = [];
  for (const layer of scenario.layers) {
    for (const operation of layer.operations) {
      if (operation.placementKey === placementKey) selected.push({ layer, operation });
    }
  }
  return selected;
}

export function ThreeResolutionPin({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  const initialPlacementKey = scenario.pin.placements[0]?.placementKey ?? '';
  const [beat, setBeat] = useState(6);
  const [selectedPlacementKey, setSelectedPlacementKey] = useState(initialPlacementKey);
  const [showNonmatching, setShowNonmatching] = useState(false);
  const [renderStatus, setRenderStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ResolutionRuntime | null>(null);
  const conflict = scenario.conflictState === '2 conflicts';
  const runtimeStateRef = useRef<RuntimeState>({
    beat,
    conflict,
    selectedPlacementKey,
    showNonmatching,
  });
  const placement =
    scenario.pin.placements.find((item) => item.placementKey === selectedPlacementKey) ??
    scenario.pin.placements[0];
  const operations = selectedOperations(scenario, placement?.placementKey ?? '');
  const matchingLayerIds = new Set(scenario.pin.matchingLayerIds);
  const matchingLayers = scenario.layers.filter(
    (layer, index) => index === 0 || matchingLayerIds.has(layer.id)
  );
  const camoCase = scenario.requestCases.find((requestCase) => requestCase.lifecycle === 'live');
  const currentBeatCopy =
    conflict && beat === 6
      ? 'Publication stays blocked; no immutable manifest is created.'
      : beatCopy[beat - 1];

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const canvas = canvasRef.current;
      const host = hostRef.current;
      if (!canvas || !host) return;

      try {
        const three = await import('three');
        if (cancelled) return;
        const runtime = buildRuntime(three, canvas, host, scenario);
        if (cancelled) {
          disposeRuntime(runtime);
          return;
        }
        runtimeRef.current = runtime;
        updateRuntime(runtime, runtimeStateRef.current, scenario);
        setRenderStatus('ready');
      } catch {
        if (!cancelled) setRenderStatus('unavailable');
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      if (runtimeRef.current) {
        disposeRuntime(runtimeRef.current);
        runtimeRef.current = null;
      }
    };
  }, [scenario]);

  useEffect(() => {
    const runtimeState = { beat, conflict, selectedPlacementKey, showNonmatching };
    runtimeStateRef.current = runtimeState;
    if (!runtimeRef.current) return;
    updateRuntime(runtimeRef.current, runtimeState, scenario);
  }, [beat, conflict, scenario, selectedPlacementKey, showNonmatching]);

  const reset = () => {
    setBeat(6);
    setSelectedPlacementKey(initialPlacementKey);
    setShowNonmatching(false);
  };

  return (
    <figure aria-labelledby={`${scenario.id}-resolution-title`} className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-line pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="info">Three.js depth view</Badge>
            <Badge tone={conflict ? 'danger' : 'success'}>
              {conflict ? 'Publication blocked' : 'Manifest materialized'}
            </Badge>
          </div>
          <h4
            id={`${scenario.id}-resolution-title`}
            className="font-display text-lg font-semibold tracking-[-0.025em] text-ink"
          >
            Layers to manifest · {scenario.name}
          </h4>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
            One canonical URL passes the Camo gate, crosses matching layers, resolves stable
            placement keys, and either stops or becomes an immutable document.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw aria-hidden="true" className="size-3.5" /> Reset scene
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label
          htmlFor={`${scenario.id}-resolution-placement`}
          className="grid gap-1.5 text-xs font-medium text-ink-muted"
        >
          Placement column
          <Select
            id={`${scenario.id}-resolution-placement`}
            value={placement?.placementKey ?? ''}
            onChange={(event) => setSelectedPlacementKey(event.currentTarget.value)}
          >
            {scenario.pin.placements.map((item) => (
              <option key={item.placementKey} value={item.placementKey}>
                {item.placementKey} · {item.blockType}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-canvas px-3 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={showNonmatching}
            onChange={(event) => setShowNonmatching(event.currentTarget.checked)}
            className="size-3.5 accent-[var(--color-accent)]"
          />
          Show nonmatching layers
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-subtle p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
            Beat {beat} of 6
          </p>
          <p className="mt-1 text-sm leading-5 text-ink">{currentBeatCopy}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={beat === 1}
            onClick={() => setBeat((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft aria-hidden="true" className="size-3.5" /> Previous
          </Button>
          <Button
            size="sm"
            disabled={beat === 6}
            onClick={() => setBeat((current) => Math.min(6, current + 1))}
          >
            Next <ChevronRight aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div
          ref={hostRef}
          aria-hidden="true"
          className="relative aspect-video min-h-[300px] overflow-hidden rounded-xl border border-line bg-[linear-gradient(180deg,#fff,#f8f8fa)] shadow-inner"
        >
          <canvas ref={canvasRef} className="block size-full" />
          <div className="pointer-events-none absolute inset-x-4 top-3 flex items-start justify-between gap-3 text-[11px]">
            <span className="rounded-md border border-success/25 bg-success-soft/95 px-2 py-1 font-semibold text-success-strong shadow-sm">
              Camo · {camoCase?.lifecycle ?? 'unknown'} · {camoCase?.outcome ?? '—'}
            </span>
            <code className="max-w-[62%] truncate rounded-md border border-line bg-canvas/95 px-2 py-1 font-mono text-ink-muted shadow-sm">
              {scenario.pin.canonicalUrl}
            </code>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-4 flex flex-wrap gap-1.5">
            {matchingLayers.slice(0, 5).map((layer) => (
              <span
                key={layer.id}
                className="rounded border border-line bg-canvas/95 px-1.5 py-1 text-[10px] text-ink-muted shadow-sm"
              >
                p{layer.priority} · {layer.name}
              </span>
            ))}
          </div>
          {renderStatus === 'loading' ? (
            <div className="absolute inset-0 grid place-items-center bg-canvas/75 text-sm text-ink-muted">
              Initializing resolution scene…
            </div>
          ) : null}
          {renderStatus === 'unavailable' ? (
            <div className="absolute inset-0 grid place-items-center bg-surface px-8 text-center text-sm leading-6 text-ink-muted">
              3D scene unavailable; the complete resolution trace remains available beside it.
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-line bg-canvas p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
            Ordered resolution trace
          </p>
          <ol className="mt-3 space-y-3 text-xs leading-5 text-ink-muted">
            <li className="grid grid-cols-[20px_1fr] gap-2">
              <span className="font-mono text-ink-faint">1</span>
              <span>
                Camo route <strong className="font-semibold text-ink">{camoCase?.lifecycle}</strong>{' '}
                yields {camoCase?.outcome} before content resolution.
              </span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-2">
              <span className="font-mono text-ink-faint">2</span>
              <span>
                {matchingLayers.length} ordered layers match; default remains scoped to this
                template.
              </span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-2">
              <span className="font-mono text-ink-faint">3</span>
              <span>
                Pin <code className="font-mono text-ink">{placement?.placementKey}</code> through
                the stack.
              </span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-2">
              <span className="font-mono text-ink-faint">4</span>
              <span>
                {operations.length} local/default operations participate; effective type is{' '}
                <strong className="font-semibold text-ink">{placement?.blockType}</strong>.
              </span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-2">
              <span className="font-mono text-ink-faint">5</span>
              <span className={conflict ? 'font-medium text-danger-strong' : ''}>
                {conflict
                  ? 'Equal-priority fixture conflict: publication blocked; no winner selected.'
                  : placement?.diff === 'hidden'
                    ? 'The explicit tombstone hides the lower placement.'
                    : 'No same-priority conflict blocks this placement.'}
              </span>
            </li>
            <li className="grid grid-cols-[20px_1fr] gap-2">
              <span className="font-mono text-ink-faint">6</span>
              <span>
                {conflict
                  ? 'Manifest creation stops before activation.'
                  : `Immutable ${scenario.publications.find((item) => item.state === 'active')?.label ?? 'publication'} retains provenance and rollback.`}
              </span>
            </li>
          </ol>
          <p aria-live="polite" className="sr-only">
            Resolution scene showing beat {beat}: {currentBeatCopy}
          </p>
        </div>
      </div>

      {scenario.id === 'structural-proof' ? (
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-xs leading-5 text-danger-strong">
          <code className="font-mono">primary-hero</code> keeps its placement key while the
          effective block type changes from <code className="font-mono">hero</code> to{' '}
          <code className="font-mono">hero_alt</code>; 22 of 24 default placements remain inherited
          and <code className="font-mono">announcement-promo</code> is tombstoned.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[820px] border-collapse text-left text-xs">
          <caption className="sr-only">Effective placement provenance for {scenario.name}</caption>
          <thead className="bg-surface-subtle text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Placement key</th>
              <th className="px-3 py-2.5 font-semibold">Order</th>
              <th className="px-3 py-2.5 font-semibold">Block type</th>
              <th className="px-3 py-2.5 font-semibold">Version</th>
              <th className="px-3 py-2.5 font-semibold">Winning source</th>
              <th className="px-3 py-2.5 font-semibold">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-canvas">
            {scenario.pin.placements.map((item) => (
              <tr
                key={item.placementKey}
                className={item.placementKey === placement?.placementKey ? 'bg-accent-soft/55' : ''}
              >
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="font-mono font-medium text-accent-strong underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                    onClick={() => setSelectedPlacementKey(item.placementKey)}
                  >
                    {item.placementKey}
                  </button>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ink-muted">{item.order}</td>
                <td className="px-3 py-2.5 text-ink">{item.blockType}</td>
                <td className="px-3 py-2.5 font-mono text-ink-muted">{item.version}</td>
                <td className="px-3 py-2.5 text-ink-muted">{item.winningLayerId}</td>
                <td className="px-3 py-2.5">
                  <Badge
                    tone={
                      item.diff === 'hidden'
                        ? 'danger'
                        : item.diff === 'changed'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {item.diff}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t border-line pt-3 font-serif text-xs italic leading-5 text-ink-muted">
        The 3D scene is an aria-hidden depth cue. The ordered trace and provenance table carry the
        complete, non-visual explanation of each resolution beat.
      </figcaption>
    </figure>
  );
}
