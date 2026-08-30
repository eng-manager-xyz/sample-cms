import { Box, CirclePlay, Image, Layers3 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { PixiProjection } from '@/components/tutorial/pixi-projection';
import { ThreeResolutionPin } from '@/components/tutorial/three-resolution-pin';
import { TutorialVideo, type TutorialVideoProps } from '@/components/tutorial/tutorial-video';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { TutorialSection } from '@/content/tutorial/tutorial-curriculum';
import { getScenarioFixture } from '@/data/scenario-fixtures';

const storeScenario = getScenarioFixture('stores');
const eligibleScenario = getScenarioFixture('eligible-vehicles');
const structuralScenario = getScenarioFixture('structural-proof');

const storeVideo: TutorialVideoProps = {
  id: 'store-authoring-v1',
  title: 'Store authoring · stable placement to publication',
  description:
    'A real 32-second production-build capture against a disposable SQLite database. The million-page claim comes from separate benchmark evidence.',
  duration: '0:32',
  poster: '/media/tutorial/flows/store-authoring-v1-poster.webp',
  mp4: '/media/tutorial/flows/store-authoring-v1.mp4',
  webm: '/media/tutorial/flows/store-authoring-v1.webm',
  descriptionsVtt: '/media/tutorial/flows/store-authoring-v1.vtt',
  transcript: [
    'The Store scenario represents one million canonical pages covered by one template default and sparse selector sheets. The scale result is verified separately; this capture uses a disposable authoring database.',
    'The authoring HUD crosses a validated server boundary into the same SQLite-backed services used by the domain proof.',
    'A new stable placement key is added to the template default as an immutable block version.',
    'Reordering writes an atomic order revision without changing the placement identity.',
    'Editing creates another immutable version. The placement key remains stable while content provenance advances.',
    'Publication compiles the current authoring revisions and atomically activates an immutable serving document.',
    'The change survives in SQLite and serving reads the materialized pointer, not selector SQL.',
  ],
};

const eligibleVideo: TutorialVideoProps = {
  id: 'eligible-vehicles-authoring-v1',
  title: 'Eligible Vehicles · linked selector scope and copy on write',
  description:
    'A real 34-second production-build capture: preview one approved selector, create a sparse P50 variant, copy-on-write one hero, and publish.',
  duration: '0:34',
  poster: '/media/tutorial/flows/eligible-vehicles-authoring-v1-poster.webp',
  mp4: '/media/tutorial/flows/eligible-vehicles-authoring-v1.mp4',
  webm: '/media/tutorial/flows/eligible-vehicles-authoring-v1.webm',
  descriptionsVtt: '/media/tutorial/flows/eligible-vehicles-authoring-v1.vtt',
  transcript: [
    'Eligible Vehicles uses broader selector sheets. A page can match several layers, but distinct priorities make the result deterministic.',
    'The persisted workspace resolves seven placements for the selected canonical page.',
    'Selector SQL runs only during authoring preview or publication, against the approved surface.',
    'A linked variant starts sparse: it inherits the default document and adds no copied page tree.',
    'Editing inherited content is copy on write. Only the hero receives a local immutable version; the remaining placements stay inherited.',
    'Publication validates priorities and conflicts before activating the materialized documents.',
    'The result is a selector-scoped change with explicit provenance, not duplicated route content.',
  ],
};

const structuralVideo: TutorialVideoProps = {
  id: 'structural-replacement-authoring-v1',
  title: 'Structural replacement · stable key, tombstone, and rollback',
  description:
    'A real 35-second production-build capture: edit hero_alt, revert and reapply a tombstone, publish, then repoint serving to a retained snapshot.',
  duration: '0:35',
  poster: '/media/tutorial/flows/structural-replacement-authoring-v1-poster.webp',
  mp4: '/media/tutorial/flows/structural-replacement-authoring-v1.mp4',
  webm: '/media/tutorial/flows/structural-replacement-authoring-v1.webm',
  descriptionsVtt: '/media/tutorial/flows/structural-replacement-authoring-v1.vtt',
  transcript: [
    'Structural replacement preserves the primary-hero placement key while the effective block type changes from hero to hero_alt.',
    'This linked variant changes one hero, hides one promotion, and inherits twenty-two of twenty-four defaults.',
    'A structural edit creates a new immutable hero_alt version without changing the document position.',
    'Revert removes the local operation and restores inheritance. Hiding again writes an explicit scoped tombstone.',
    'Publication atomically activates the conflict-free document and retains the previous immutable publication as a rollback target.',
    'Rollback changes only the serving pointer. It does not recompile or mutate either publication.',
    'Serving is restored to an existing immutable snapshot while authoring history remains intact.',
  ],
};

const wallNavigationVideo: TutorialVideoProps = {
  id: 'wall-navigation-v1',
  title: 'Wall navigation · map search to persisted workspace',
  description:
    'A real 32-second production-build walkthrough: narrow the map inventory, inspect Store, open its SQLite-backed workbench, and return through the shared HUD shell.',
  duration: '0:32',
  evidenceLabel: 'Reviewed UI capture',
  poster: '/media/tutorial/flows/wall-navigation-v1-poster.webp',
  mp4: '/media/tutorial/flows/wall-navigation-v1.mp4',
  webm: '/media/tutorial/flows/wall-navigation-v1.webm',
  descriptionsVtt: '/media/tutorial/flows/wall-navigation-v1.vtt',
  transcript: [
    'The Wall of Maps opens with the required scenario maps, their selector-sheet summaries, and the immutable-manifest serving posture.',
    'Keyboard search narrows the inventory to the one Store map and keeps the bounded result count visible.',
    'Inspect map opens the real persisted Store route and its sparse selector-sheet projection.',
    'Block authoring reveals the live SQLite workspace: four visible placements, no tombstones, and one publication.',
    'Primary navigation returns to the Wall with the Store filter retained for orientation.',
    'Clearing search restores the complete three-map inventory without changing the information architecture.',
    'The tutorial and operational workspace remain adjacent routes inside the same HUD shell.',
  ],
};

const pinInspectionVideo: TutorialVideoProps = {
  id: 'pin-inspection-v1',
  title: 'Resolution pin · URL to layers, provenance, and serving seam',
  description:
    "A real 35-second production-build walkthrough: select one McDonald's point, inspect its four matching sheets and winning placement, then verify selector SQL stays off the public path.",
  duration: '0:35',
  evidenceLabel: 'Reviewed UI capture',
  poster: '/media/tutorial/flows/pin-inspection-v1-poster.webp',
  mp4: '/media/tutorial/flows/pin-inspection-v1.mp4',
  webm: '/media/tutorial/flows/pin-inspection-v1.webm',
  descriptionsVtt: '/media/tutorial/flows/pin-inspection-v1.vtt',
  transcript: [
    'The Store projection exposes sparse selector sheets in explicit priority order.',
    "The P30 McDonald's sheet and one concrete page point are selected; that page matches four sheets.",
    'The resolution pin shows the canonical URL, tags, Camo route live, Auteur content published, and HTTP 200.',
    "Matching sheets stay visible from the P0 template default through P10 chain, P20 fast food, and P30 McDonald's.",
    "Expanding primary-hero shows the inherited version and the winning McDonald's replacement as complete provenance.",
    'The exact approved selector SQL is inspectible, with an explicit warning that it runs only during preview or publication.',
    'Returning to Trace restores the independent Camo Press and Auteur serving status for the selected point.',
  ],
};

const scenarioVideos = [eligibleVideo, storeVideo, structuralVideo] as const;

function readableVisualName(visual: string): string {
  return visual
    .split('-')
    .map((word) => `${word.charAt(0).toLocaleUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function MediaFrame({
  visualId,
  title,
  description,
  active,
  onActiveChange,
  children,
}: Readonly<{
  visualId: string;
  title: string;
  description: string;
  active: boolean;
  onActiveChange: (visualId: string | null) => void;
  children: ReactNode;
}>) {
  return (
    <section
      aria-labelledby={`tutorial-media-${visualId}-title`}
      className="my-6 overflow-hidden rounded-xl border border-line bg-surface-subtle"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-canvas px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
            Interactive explanation
          </p>
          <h4
            id={`tutorial-media-${visualId}-title`}
            className="mt-0.5 font-display text-sm font-semibold text-ink"
          >
            {title}
          </h4>
          <p className="mt-1 max-w-2xl text-[11px] leading-5 text-ink-muted">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info" dot>
            typed scenario data
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-controls={`tutorial-media-${visualId}`}
            aria-expanded={active}
            onClick={() => onActiveChange(active ? null : visualId)}
          >
            {active ? 'Close model' : 'Load model'}
          </Button>
        </div>
      </header>
      <div id={`tutorial-media-${visualId}`} className="p-3 sm:p-4">
        {active ? (
          children
        ) : (
          <div className="map-grid flex min-h-44 items-center justify-center rounded-lg border border-dashed border-line-strong bg-canvas p-5 text-center">
            <div>
              <Layers3 aria-hidden="true" className="mx-auto size-5 text-accent" />
              <p className="mt-2 text-xs font-semibold text-ink">Interactive model paused</p>
              <p className="mt-1 max-w-md text-[10px] leading-4 text-ink-muted">
                Load this model to mount its WebGL canvas. Opening another tutorial model releases
                the current one.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function EditorialImage({
  src,
  title,
  alt,
  caption,
}: Readonly<{ src: string; title: string; alt: string; caption: string }>) {
  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="border-b border-line bg-surface-subtle px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">OpenAI-generated substitute</Badge>
          <Badge tone="success">Accepted for AUT-533</Badge>
        </div>
        <h4 className="mt-2 text-sm font-[700] text-ink">{title}</h4>
      </div>
      <img
        src={src}
        alt={alt}
        width={1672}
        height={941}
        loading="lazy"
        decoding="async"
        className="aspect-[16/9] w-full bg-surface object-cover"
      />
      <figcaption className="border-t border-line px-4 py-3 text-[11px] font-[350] italic leading-5 text-ink-muted">
        <p>{caption}</p>
        <p className="mt-1 font-[450] not-italic text-success-strong">
          Generator provenance: OpenAI built-in image_gen. The requester accepted this as the Google
          Imagen substitute for AUT-533.
        </p>
      </figcaption>
    </figure>
  );
}

function PlannedVisual({ section }: Readonly<{ section: TutorialSection }>) {
  const hasMedia = section.mediaMinutes > 0;
  return (
    <figure
      aria-labelledby={`planned-visual-${section.visual}-title`}
      className="my-6 grid overflow-hidden rounded-xl border border-line bg-surface-subtle sm:grid-cols-[160px_minmax(0,1fr)]"
      data-visual-id={section.visual}
    >
      <div
        aria-hidden="true"
        className="map-grid relative min-h-28 overflow-hidden border-b border-line bg-canvas sm:border-b-0 sm:border-r"
      >
        <div className="absolute inset-x-5 top-6 h-4 rounded border border-accent/30 bg-accent-soft" />
        <div className="absolute inset-x-8 top-13 h-4 rounded border border-line-strong bg-surface-muted" />
        <div className="absolute inset-x-11 top-20 h-4 rounded border border-success/30 bg-success-soft" />
        <div className="absolute bottom-3 left-1/2 h-20 w-px -translate-x-1/2 bg-accent" />
      </div>
      <figcaption className="flex items-start gap-3 p-4">
        <span className="mt-0.5 rounded-lg border border-line bg-canvas p-2 text-accent-strong">
          {hasMedia ? (
            <CirclePlay aria-hidden="true" className="size-4" />
          ) : (
            <Image aria-hidden="true" className="size-4" />
          )}
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
            {hasMedia ? `${section.mediaMinutes} min media companion` : 'Static evidence companion'}
          </p>
          <p
            id={`planned-visual-${section.visual}-title`}
            className="mt-1 font-display text-sm font-semibold text-ink"
          >
            {readableVisualName(section.visual)}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-ink-muted">
            The report key is stable for a reviewed illustration, diagram, or UI clip. The prose and
            digest remain complete when media is unavailable.
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

function ScenarioFlowPlayer() {
  const [selectedVideoId, setSelectedVideoId] = useState(scenarioVideos[0].id);
  const selectedVideo =
    scenarioVideos.find((video) => video.id === selectedVideoId) ?? scenarioVideos[0];

  return (
    <aside className="my-6 overflow-hidden rounded-xl border border-line bg-surface-subtle">
      <div className="border-b border-line bg-canvas px-4 py-3">
        <Badge tone="success">Three reviewed SQLite captures</Badge>
        <h4 className="mt-2 text-sm font-semibold text-ink">Replay each authoring proof</h4>
        <p className="mt-1 text-[11px] leading-5 text-ink-muted">
          Choose a scenario here. The selected native player and complete transcript stay in this
          section, so the learning path continues forward.
        </p>
      </div>
      <fieldset className="grid gap-px bg-line sm:grid-cols-3">
        <legend className="sr-only">Choose an authoring proof</legend>
        {scenarioVideos.map((video) => (
          <Button
            key={video.id}
            type="button"
            variant="outline"
            aria-pressed={video.id === selectedVideo.id}
            aria-controls="chapter-5-scenario-flow-player"
            onClick={() => setSelectedVideoId(video.id)}
            className="group h-auto min-w-0 flex-col items-stretch rounded-none border-0 bg-canvas p-3 text-left whitespace-normal aria-pressed:bg-accent-soft"
          >
            <img
              src={video.poster}
              alt=""
              width={1440}
              height={900}
              loading="lazy"
              className="aspect-[8/5] w-full rounded-md border border-line object-cover transition-opacity group-hover:opacity-85"
            />
            <p className="mt-2 text-xs font-semibold leading-5 text-ink">{video.title}</p>
            <p className="mt-0.5 text-[10px] text-ink-faint">
              {video.duration} · silent · transcript
            </p>
          </Button>
        ))}
      </fieldset>
      <div
        id="chapter-5-scenario-flow-player"
        className="border-t border-line bg-canvas p-3 sm:p-4"
      >
        <p aria-live="polite" className="sr-only">
          Selected walkthrough: {selectedVideo.title}
        </p>
        <TutorialVideo
          key={selectedVideo.id}
          {...selectedVideo}
          instanceId={`chapter-5-${selectedVideo.id}`}
          evidenceLabel="Reviewed UI capture"
        />
      </div>
    </aside>
  );
}

export function TutorialSectionMedia({
  section,
  activeVisual,
  onActiveVisualChange,
}: Readonly<{
  section: TutorialSection;
  activeVisual: string | null;
  onActiveVisualChange: (visualId: string | null) => void;
}>) {
  switch (section.visual) {
    case 'generated-old-world-cutaway':
      return (
        <EditorialImage
          src="/media/tutorial/old-world-to-wall-of-maps-v1.webp"
          title="From route-tree assembly to a queryable wall of maps"
          alt="Editorial cutaway comparing a branching legacy route tree and block-resolution pipeline on the left with a calm grid of selector sheets, page points, and one pinned document on the right."
          caption="A conceptual bridge generated for this tutorial. Repository models and measured evidence—not the illustration—remain authoritative."
        />
      );
    case 'pixi-wall-intro':
      return (
        <MediaFrame
          visualId={section.visual}
          title="Project one high-dimensional map"
          description="The 2D field is an explanatory projection; the synchronized text beneath it remains authoritative."
          active={activeVisual === section.visual}
          onActiveChange={onActiveVisualChange}
        >
          <PixiProjection scenario={storeScenario} />
        </MediaFrame>
      );
    case 'eligible-video-and-pixi':
      return (
        <>
          <TutorialVideo {...eligibleVideo} />
          <MediaFrame
            visualId={section.visual}
            title="Dense Eligible Vehicles projection"
            description="Inspect broad intersections and one selected point without turning visual overlap into an implicit winner."
            active={activeVisual === section.visual}
            onActiveChange={onActiveVisualChange}
          >
            <PixiProjection scenario={eligibleScenario} />
          </MediaFrame>
        </>
      );
    case 'stores-video-and-pixi':
      return (
        <>
          <TutorialVideo {...storeVideo} />
          <MediaFrame
            visualId={section.visual}
            title="Sparse Store selector projection"
            description="Aggregated points communicate scale while the selected page exposes sparse brand, category, and store-type contributions."
            active={activeVisual === section.visual}
            onActiveChange={onActiveVisualChange}
          >
            <PixiProjection scenario={storeScenario} />
          </MediaFrame>
        </>
      );
    case 'three-linear-space':
      return (
        <MediaFrame
          visualId={section.visual}
          title="From selector space to one page"
          description="A fixed-camera layer stack turns sets, priorities, and sparse operations into a traceable spatial model."
          active={activeVisual === section.visual}
          onActiveChange={onActiveVisualChange}
        >
          <ThreeResolutionPin scenario={eligibleScenario} />
        </MediaFrame>
      );
    case 'three-resolution-pin':
      return (
        <MediaFrame
          visualId={section.visual}
          title="Conflict predicate and deterministic fold"
          description="The pin crosses matching layers in explicit priority order and stops rather than inventing a winner for equal-priority collisions."
          active={activeVisual === section.visual}
          onActiveChange={onActiveVisualChange}
        >
          <ThreeResolutionPin scenario={eligibleScenario} />
        </MediaFrame>
      );
    case 'structural-video-and-three':
      return (
        <>
          <TutorialVideo {...structuralVideo} />
          <MediaFrame
            visualId={section.visual}
            title="Stable placement, structural replacement"
            description="The same primary-hero address changes type while inherited placements and the scoped tombstone remain visible in the trace."
            active={activeVisual === section.visual}
            onActiveChange={onActiveVisualChange}
          >
            <ThreeResolutionPin scenario={structuralScenario} />
          </MediaFrame>
        </>
      );
    case 'scenario-flow-videos':
      return <ScenarioFlowPlayer />;
    case 'wall-ui-walkthrough':
      return <TutorialVideo {...wallNavigationVideo} />;
    case 'pin-ui-walkthrough':
      return <TutorialVideo {...pinInspectionVideo} />;
    case 'shape-comparison':
      return (
        <figure className="my-6 overflow-hidden rounded-xl border border-line bg-surface-subtle">
          <img
            src="/media/tutorial/three-proof-shapes-v1.webp"
            alt="Editorial triptych showing dense overlapping vehicle selector bands, sparse Store selector islands across a large map, and a structural block replacement retaining the same placement pin."
            width={1672}
            height={941}
            loading="lazy"
            decoding="async"
            className="aspect-[16/9] w-full border-b border-line bg-canvas object-cover"
          />
          <figcaption className="p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="info">OpenAI-generated substitute</Badge>
              <Badge tone="success">Accepted for AUT-533</Badge>
            </div>
            <div className="flex items-center gap-2">
              <Layers3 aria-hidden="true" className="size-4 text-accent-strong" />
              <h4 className="text-sm font-semibold text-ink">One model, three pressure shapes</h4>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {[
                ['Dense', '24 pages · 24 manifests', 'Correctness under intersecting selectors'],
                ['Sparse', '1,000,002 pages · 5 manifests', 'Reuse under high cardinality'],
                ['Structural', '22 / 24 inherited', 'Stable identity across type replacement'],
              ].map(([name, measure, purpose]) => (
                <div key={name} className="rounded-lg border border-line bg-canvas p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent-strong">
                    {name}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-ink">{measure}</p>
                  <p className="mt-1 text-[10px] leading-4 text-ink-muted">{purpose}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] italic leading-4 text-ink-faint">
              OpenAI-generated editorial substitute accepted by the requester for AUT-533. Exact
              counts above come from repository evidence.
            </p>
          </figcaption>
        </figure>
      );
    case 'publication-video':
      return (
        <EditorialImage
          src="/media/tutorial/atomic-publication-rollback-v1.webp"
          title="Atomic activation keeps rollback one pointer away"
          alt="Editorial diagram of immutable publication documents in a sealed sequence, with a green active pointer and a retained amber rollback pointer while selector computation stays outside the public request lane."
          caption="The illustration explains the transaction boundary. The live publication HUD and recorded structural flow provide executable evidence."
        />
      );
    default:
      return <PlannedVisual section={section} />;
  }
}

export function TutorialMediaLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-[10px] text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <Layers3 aria-hidden="true" className="size-3 text-accent" /> explanatory model
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CirclePlay aria-hidden="true" className="size-3 text-accent" /> reviewed real-UI companion
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Box aria-hidden="true" className="size-3 text-accent" /> semantic fallback retained
      </span>
    </div>
  );
}
