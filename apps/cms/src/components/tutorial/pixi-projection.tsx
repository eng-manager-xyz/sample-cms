import { RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import type { ProjectionPoint, ScenarioFixture, VariantLayer } from '@/data/scenario-fixtures';
import { cn } from '@/lib/cn';

type PixiApplication = import('pixi.js').Application;
type PixiGraphics = import('pixi.js').Graphics;

interface ProjectionRenderState {
  activeLayerIds: ReadonlySet<string>;
  points: ProjectionPoint[];
  layers: VariantLayer[];
  selectedPointId: string;
}

interface ProjectionRenderer {
  app: PixiApplication;
  graphics: PixiGraphics;
}

const palette = {
  canvas: 0xffffff,
  surface: 0xf7f7f8,
  line: 0xe3e3e8,
  lineStrong: 0xbfc0ca,
  muted: 0x777783,
  accent: 0x7657d5,
  accentSoft: 0xeee9fc,
  danger: 0xcf3e45,
} as const;

const layerColors: Record<VariantLayer['tone'], number> = {
  neutral: 0x8d8d98,
  blue: 0x4d79c7,
  purple: 0x7657d5,
  amber: 0xc08a2e,
  green: 0x3c9467,
  red: 0xcf3e45,
};

function drawDashedLine(
  graphics: PixiGraphics,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: number
) {
  const segments = 18;
  for (let index = 0; index < segments; index += 2) {
    const start = index / segments;
    const end = (index + 1) / segments;
    graphics
      .moveTo(fromX + (toX - fromX) * start, fromY + (toY - fromY) * start)
      .lineTo(fromX + (toX - fromX) * end, fromY + (toY - fromY) * end);
  }
  graphics.stroke({ color, alpha: 0.65, width: 1 });
}

function drawProjection(
  graphics: PixiGraphics,
  state: ProjectionRenderState,
  width: number,
  height: number
) {
  if (width < 1 || height < 1) return;

  const left = Math.max(36, width * 0.055);
  const right = Math.max(20, width * 0.035);
  const top = Math.max(26, height * 0.08);
  const bottom = Math.max(34, height * 0.1);
  const fieldWidth = Math.max(1, width - left - right);
  const fieldHeight = Math.max(1, height - top - bottom);

  graphics.clear();
  graphics.roundRect(0, 0, width, height, 12).fill({ color: palette.canvas });
  graphics
    .roundRect(left, top, fieldWidth, fieldHeight, 8)
    .fill({ color: palette.surface })
    .stroke({ color: palette.line, width: 1 });

  for (let index = 1; index < 10; index += 1) {
    const x = left + (fieldWidth * index) / 10;
    const y = top + (fieldHeight * index) / 10;
    graphics.moveTo(x, top).lineTo(x, top + fieldHeight);
    graphics.moveTo(left, y).lineTo(left + fieldWidth, y);
  }
  graphics.stroke({ color: palette.line, alpha: 0.68, width: 1 });

  const visibleLayers = state.layers.filter(
    (layer) => layer.priority > 0 && state.activeLayerIds.has(layer.id)
  );
  visibleLayers.forEach((layer, index) => {
    const fraction = Math.min(0.9, Math.max(0.18, layer.matchCount / 1_000_000));
    const overlayWidth = Math.max(fieldWidth * fraction, fieldWidth * 0.22);
    const overlayHeight = Math.max(fieldHeight * (0.28 + (index % 3) * 0.16), 54);
    const maxX = Math.max(1, fieldWidth - overlayWidth - 14);
    const maxY = Math.max(1, fieldHeight - overlayHeight - 14);
    const overlayX = left + 7 + ((index * 137) % maxX);
    const overlayY = top + 7 + ((index * 79) % maxY);
    const color = layerColors[layer.tone];

    graphics
      .roundRect(overlayX, overlayY, overlayWidth, overlayHeight, 8)
      .fill({ color, alpha: 0.08 })
      .stroke({ color, alpha: 0.7, width: 1.5 });
    drawDashedLine(
      graphics,
      overlayX + 8,
      overlayY + 10,
      overlayX + overlayWidth - 8,
      overlayY + 10,
      color
    );
  });

  for (const point of state.points) {
    const x = left + (point.x / 100) * fieldWidth;
    const y = top + ((100 - point.y) / 100) * fieldHeight;
    const visibleMatches = point.layerIds.filter((layerId) => state.activeLayerIds.has(layerId));
    const isSelected = point.id === state.selectedPointId;
    const radius = 3.4 + Math.min(point.density, 5) * 0.75;
    const conflict = point.layerIds.some((layerId) => layerId.includes('conflict'));

    if (visibleMatches.length > 1) {
      graphics.circle(x, y, radius + 3.5).stroke({
        color: conflict ? palette.danger : palette.accent,
        alpha: 0.72,
        width: 1.25,
      });
    }

    graphics
      .circle(x, y, radius)
      .fill({ color: visibleMatches.length ? palette.accentSoft : palette.canvas })
      .stroke({
        color: conflict
          ? palette.danger
          : visibleMatches.length
            ? palette.accent
            : palette.lineStrong,
        width: visibleMatches.length ? 1.4 : 1,
      });

    if (isSelected) {
      graphics.circle(x, y, radius + 7).stroke({ color: palette.accent, width: 2.25 });
      graphics.moveTo(x, y - radius - 7).lineTo(x, Math.max(top + 6, y - 42));
      graphics.stroke({ color: palette.accent, width: 2 });
      graphics.circle(x, Math.max(top + 6, y - 42), 3.5).fill({ color: palette.accent });
    }
  }

  graphics.moveTo(left, top + fieldHeight).lineTo(left + fieldWidth, top + fieldHeight);
  graphics.moveTo(left, top).lineTo(left, top + fieldHeight);
  graphics.stroke({ color: palette.muted, alpha: 0.62, width: 1.2 });
}

function createRenderState(
  scenario: ScenarioFixture,
  selectedPointId: string,
  activeLayerIds: string[]
): ProjectionRenderState {
  return {
    points: scenario.projectionPoints,
    layers: scenario.layers,
    selectedPointId,
    activeLayerIds: new Set(activeLayerIds),
  };
}

export function PixiProjection({ scenario }: Readonly<{ scenario: ScenarioFixture }>) {
  const initialPointId = scenario.projectionPoints[0]?.id ?? '';
  const [selectedPointId, setSelectedPointId] = useState(initialPointId);
  const [activeLayerIds, setActiveLayerIds] = useState(() =>
    scenario.layers.map((layer) => layer.id)
  );
  const [xAxis, setXAxis] = useState(scenario.defaultAxes[0]);
  const [yAxis, setYAxis] = useState(scenario.defaultAxes[1]);
  const [renderStatus, setRenderStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ProjectionRenderer | null>(null);
  const [initialRenderState] = useState(() =>
    createRenderState(scenario, selectedPointId, activeLayerIds)
  );
  const renderStateRef = useRef(initialRenderState);

  const selectedPoint =
    scenario.projectionPoints.find((point) => point.id === selectedPointId) ??
    scenario.projectionPoints[0];
  const activeLayerIdSet = new Set(activeLayerIds);
  const activeLayers = scenario.layers.filter((layer) => activeLayerIdSet.has(layer.id));
  const selectedPointLayerIdSet = new Set(selectedPoint?.layerIds ?? []);
  const selectedLayerNames: string[] = [];
  for (const layer of scenario.layers) {
    if (selectedPointLayerIdSet.has(layer.id)) selectedLayerNames.push(layer.name);
  }

  useEffect(() => {
    let cancelled = false;
    let pendingApp: PixiApplication | null = null;
    let observer: ResizeObserver | null = null;

    async function initialize() {
      const canvas = canvasRef.current;
      const host = hostRef.current;
      if (!canvas || !host) return;

      try {
        const pixi = await import('pixi.js');
        const app = new pixi.Application();
        pendingApp = app;
        await app.init({
          canvas,
          resizeTo: host,
          preference: 'webgl',
          autoStart: false,
          resolution: 1,
          autoDensity: true,
          antialias: false,
          backgroundAlpha: 0,
        });

        if (cancelled) {
          app.destroy(
            { removeView: false },
            { children: true, texture: true, textureSource: true, context: true }
          );
          return;
        }

        app.stop();
        const graphics = new pixi.Graphics();
        app.stage.addChild(graphics);
        const render = () => {
          const renderState = renderStateRef.current;
          if (!renderState) return;
          drawProjection(graphics, renderState, app.screen.width, app.screen.height);
          app.render();
        };
        observer = new ResizeObserver(() => {
          app.resize();
          requestAnimationFrame(render);
        });
        observer.observe(host);
        rendererRef.current = { app, graphics };
        render();
        setRenderStatus('ready');
      } catch {
        if (!cancelled) setRenderStatus('unavailable');
      }
    }

    void initialize();

    return () => {
      cancelled = true;
      observer?.disconnect();
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.app.stop();
        renderer.app.destroy(
          { removeView: false },
          { children: true, texture: true, textureSource: true, context: true }
        );
        rendererRef.current = null;
      } else if (pendingApp?.renderer) {
        pendingApp.destroy(
          { removeView: false },
          { children: true, texture: true, textureSource: true, context: true }
        );
      }
    };
  }, []);

  useEffect(() => {
    renderStateRef.current = createRenderState(scenario, selectedPointId, activeLayerIds);
    const renderer = rendererRef.current;
    if (!renderer) return;
    drawProjection(
      renderer.graphics,
      renderStateRef.current,
      renderer.app.screen.width,
      renderer.app.screen.height
    );
    renderer.app.render();
  }, [activeLayerIds, scenario, selectedPointId]);

  const reset = () => {
    setSelectedPointId(initialPointId);
    setActiveLayerIds(scenario.layers.map((layer) => layer.id));
    setXAxis(scenario.defaultAxes[0]);
    setYAxis(scenario.defaultAxes[1]);
  };

  return (
    <figure aria-labelledby={`${scenario.id}-projection-title`} className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-line pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge tone="info">PixiJS breadth view</Badge>
            <Badge tone="warning">Aggregated projection</Badge>
          </div>
          <h4
            id={`${scenario.id}-projection-title`}
            className="font-display text-lg font-semibold tracking-[-0.025em] text-ink"
          >
            Wall of pages · {scenario.name}
          </h4>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
            Selector sheets cover aggregate route bins. Select a row to pin one deterministic
            sample; the table remains the semantic source of truth.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw aria-hidden="true" className="size-3.5" /> Reset view
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
        <label
          htmlFor={`${scenario.id}-projection-x-axis`}
          className="grid gap-1.5 text-xs font-medium text-ink-muted"
        >
          Horizontal axis
          <Select
            id={`${scenario.id}-projection-x-axis`}
            value={xAxis}
            onChange={(event) => setXAxis(event.currentTarget.value)}
          >
            {scenario.dimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.label}
              </option>
            ))}
          </Select>
        </label>
        <label
          htmlFor={`${scenario.id}-projection-y-axis`}
          className="grid gap-1.5 text-xs font-medium text-ink-muted"
        >
          Vertical axis
          <Select
            id={`${scenario.id}-projection-y-axis`}
            value={yAxis}
            onChange={(event) => setYAxis(event.currentTarget.value)}
          >
            {scenario.dimensions.map((dimension) => (
              <option key={dimension.id} value={dimension.id}>
                {dimension.label}
              </option>
            ))}
          </Select>
        </label>
        <div className="self-end text-[11px] leading-5 text-ink-faint">
          <span className="block font-semibold uppercase tracking-[0.09em]">Scale cue</span>
          {scenario.instanceCount.toLocaleString()} instances
        </div>
      </div>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 text-xs font-semibold text-ink">Visible selector sheets</legend>
        {scenario.layers.map((layer) => {
          const checked = activeLayerIdSet.has(layer.id);
          return (
            <label
              key={layer.id}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-medium',
                checked
                  ? 'border-accent/30 bg-accent-soft text-accent-strong'
                  : 'border-line bg-canvas text-ink-muted'
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setActiveLayerIds((current) => {
                    const currentIds = new Set(current);
                    return currentIds.has(layer.id)
                      ? current.filter((layerId) => layerId !== layer.id)
                      : [...current, layer.id];
                  })
                }
                className="size-3.5 accent-[var(--color-accent)]"
              />
              {layer.name} · p{layer.priority}
            </label>
          );
        })}
      </fieldset>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.75fr)]">
        <div
          ref={hostRef}
          aria-hidden="true"
          className="relative aspect-video min-h-[260px] overflow-hidden rounded-xl border border-line bg-canvas shadow-inner"
        >
          <canvas ref={canvasRef} className="block size-full" />
          <div className="pointer-events-none absolute inset-x-4 top-3 flex items-center justify-between text-xs font-semibold text-ink-muted">
            <span>{scenario.dimensions.find((item) => item.id === yAxis)?.label ?? yAxis}</span>
            <span>{scenario.dimensions.find((item) => item.id === xAxis)?.label ?? xAxis} →</span>
          </div>
          <p className="pointer-events-none absolute bottom-3 left-4 rounded-md border border-line bg-canvas/95 px-2 py-1 text-[11px] text-ink-muted shadow-sm">
            Sampled/aggregated projection — not one dot per page
          </p>
          {renderStatus === 'loading' ? (
            <div className="absolute inset-0 grid place-items-center bg-canvas/75 text-sm text-ink-muted">
              Initializing projection…
            </div>
          ) : null}
          {renderStatus === 'unavailable' ? (
            <div className="absolute inset-0 grid place-items-center bg-surface px-8 text-center text-sm leading-6 text-ink-muted">
              Visual projection unavailable; all data remains available below.
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-line bg-surface-subtle p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
            Selected sample
          </p>
          <p className="mt-2 text-base font-semibold text-ink">
            {selectedPoint?.label ?? 'No sample available'}
          </p>
          <dl className="mt-4 space-y-3 text-xs">
            <div>
              <dt className="text-ink-faint">Projection position</dt>
              <dd className="mt-1 font-mono text-ink">
                {selectedPoint ? `${selectedPoint.x}, ${selectedPoint.y}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Matching layers</dt>
              <dd className="mt-1 leading-5 text-ink">
                {selectedLayerNames.length ? selectedLayerNames.join(' → ') : 'Template default'}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Visible coverage</dt>
              <dd className="mt-1 text-ink">
                {activeLayers.length} of {scenario.layers.length} selector sheets
              </dd>
            </div>
          </dl>
          <p aria-live="polite" className="sr-only">
            {selectedPoint ? `${selectedPoint.label} selected.` : 'No projection sample selected.'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <caption className="sr-only">Aggregate projection samples for {scenario.name}</caption>
          <thead className="bg-surface-subtle text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Sample</th>
              <th className="px-3 py-2.5 font-semibold">X / Y</th>
              <th className="px-3 py-2.5 font-semibold">Density</th>
              <th className="px-3 py-2.5 font-semibold">Matching layers</th>
              <th className="px-3 py-2.5 font-semibold">Selection</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-canvas">
            {scenario.projectionPoints.slice(0, 8).map((point) => (
              <tr
                key={point.id}
                className={point.id === selectedPoint?.id ? 'bg-accent-soft/55' : ''}
              >
                <td className="px-3 py-2.5 font-medium text-ink">{point.label}</td>
                <td className="px-3 py-2.5 font-mono text-ink-muted">
                  {point.x} / {point.y}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-ink-muted">{point.density}</td>
                <td className="max-w-[260px] px-3 py-2.5 text-ink-muted">
                  {point.layerIds.length || 1}
                </td>
                <td className="px-3 py-2.5">
                  <Button
                    variant={point.id === selectedPoint?.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPointId(point.id)}
                  >
                    {point.id === selectedPoint?.id ? 'Selected' : 'Select'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="border-t border-line pt-3 font-serif text-xs italic leading-5 text-ink-muted">
        The canvas is an aria-hidden breadth cue. Axis controls, exact sample values, layer counts,
        and selection state remain available in native controls and the synchronized table.
      </figcaption>
    </figure>
  );
}
