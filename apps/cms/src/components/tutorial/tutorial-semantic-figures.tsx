import { useId } from 'react';
import { Badge } from '@/components/ui/badge';

const anatomyParts = [
  {
    number: '01',
    label: 'Placement',
    value: 'primary-hero',
    detail:
      'The stable document address. It survives reordering, content edits, and block-type replacement.',
  },
  {
    number: '02',
    label: 'Block',
    value: 'hero_alt',
    detail: 'The registry type that supplies the schema, authoring contract, and renderer.',
  },
  {
    number: '03',
    label: 'Version',
    value: 'structural-block:primary-hero:hero-alt-v1',
    detail:
      'An immutable typed content value. A later edit appends a new version instead of mutating it.',
  },
  {
    number: '04',
    label: 'Provenance',
    value: 'hero-alt revision · set · priority 10',
    detail:
      'The winning revision, operation, and explicit priority that explain why this version won.',
  },
] as const;

const scenarioComparisons = [
  {
    name: 'Eligible',
    shape: 'Dense exact override',
    locallyDecidedPlacements: 7,
    placementSurface: 7,
    ratio: '7 / 7',
    percentage: '100%',
    inherited: '0 inherited positions',
    explanation:
      'The exact selector supplies at least one local decision for every placement; separate order operations do not increase this placement count.',
  },
  {
    name: 'Store',
    shape: 'Sparse composition',
    locallyDecidedPlacements: 3,
    placementSurface: 4,
    ratio: '3 / 4',
    percentage: '75%',
    inherited: '1 default position',
    explanation:
      'Hero, promo, and footer are local winners; navigation remains the default winner.',
  },
  {
    name: 'Structural',
    shape: 'Sparse type replacement',
    locallyDecidedPlacements: 2,
    placementSurface: 24,
    ratio: '2 / 24',
    percentage: '8.33%',
    inherited: '22 unchanged default pointers',
    explanation: 'One set replaces the hero type and one tombstone hides the promo.',
  },
] as const;

export function ContentAnatomyFigure() {
  const titleId = useId();
  const captionId = useId();

  return (
    <figure
      aria-describedby={captionId}
      aria-labelledby={titleId}
      className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_1px_3px_rgba(22,22,26,0.035)]"
    >
      <header className="border-b border-line bg-surface-subtle px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="info">Semantic anatomy</Badge>
          <span className="font-mono text-[10px] text-ink-faint">one effective placement</span>
        </div>
        <h4 id={titleId} className="mt-3 text-base font-semibold tracking-[-0.02em] text-ink">
          One address, one typed version, one explainable winner
        </h4>
        <p className="mt-1 max-w-3xl text-[11px] leading-5 text-ink-muted">
          These four identities travel together in a published placement, but they answer different
          questions and must not be collapsed into one block ID.
        </p>
      </header>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <ol className="grid gap-2 sm:grid-cols-2" aria-label="Placement anatomy parts">
          {anatomyParts.map((part) => (
            <li key={part.label} className="rounded-xl border border-line bg-surface-subtle p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.11em] text-accent-strong">
                  {part.label}
                </span>
                <span className="font-mono text-[9px] text-ink-faint" aria-hidden="true">
                  {part.number}
                </span>
              </div>
              <code className="mt-2 block break-words font-mono text-[11px] font-semibold leading-5 text-ink">
                {part.value}
              </code>
              <p className="mt-2 text-[10px] leading-4 text-ink-muted">{part.detail}</p>
            </li>
          ))}
        </ol>

        <aside
          className="rounded-xl border border-accent/25 bg-accent-soft/35 p-4"
          aria-label="Compiled placement record"
        >
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent-strong">
            Compiled placement record
          </p>
          <dl className="mt-3 divide-y divide-accent/15 rounded-lg border border-accent/20 bg-canvas px-3">
            <div className="grid gap-1 py-2.5 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3">
              <dt className="font-mono text-[9px] text-ink-faint">placementKey</dt>
              <dd className="break-words font-mono text-[10px] font-semibold text-ink">
                primary-hero
              </dd>
            </div>
            <div className="grid gap-1 py-2.5 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3">
              <dt className="font-mono text-[9px] text-ink-faint">blockType</dt>
              <dd className="break-words font-mono text-[10px] font-semibold text-ink">hero_alt</dd>
            </div>
            <div className="grid gap-1 py-2.5 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3">
              <dt className="font-mono text-[9px] text-ink-faint">blockVersionId</dt>
              <dd className="break-all font-mono text-[10px] font-semibold leading-4 text-ink">
                structural-block:primary-hero:hero-alt-v1
              </dd>
            </div>
            <div className="grid gap-1 py-2.5 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-3">
              <dt className="font-mono text-[9px] text-ink-faint">provenance</dt>
              <dd className="text-[10px] font-medium leading-4 text-ink">
                hero-alt revision · set operation · priority 10
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] leading-4 text-accent-strong">
            Replacing <code className="font-mono font-semibold">hero</code> with{' '}
            <code className="font-mono font-semibold">hero_alt</code> changes the type and version,
            not the placement key.
          </p>
        </aside>
      </div>

      <figcaption
        id={captionId}
        className="border-t border-line bg-surface-subtle px-4 py-3 text-[10px] italic leading-5 text-ink-muted sm:px-5"
      >
        Placement is the durable address; block is the rendering contract; version is immutable
        content; provenance records the exact winning authoring decision.
      </figcaption>
    </figure>
  );
}

export function ScenarioComparisonFigure() {
  const titleId = useId();
  const captionId = useId();
  const chartDescriptionId = useId();

  return (
    <figure
      aria-describedby={captionId}
      aria-labelledby={titleId}
      className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-[0_1px_3px_rgba(22,22,26,0.035)]"
    >
      <header className="border-b border-line bg-surface-subtle px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone="info">Common-denominator comparison</Badge>
          <span className="font-mono text-[10px] text-ink-faint">
            locally decided placements / placement surface
          </span>
        </div>
        <h4 id={titleId} className="mt-3 text-base font-semibold tracking-[-0.02em] text-ink">
          How much of one effective page is decided locally?
        </h4>
        <p id={chartDescriptionId} className="mt-1 max-w-3xl text-[11px] leading-5 text-ink-muted">
          Every bar uses the same 0–100% scale. The numerator counts placements with at least one
          active local decision; the denominator is the placement surface against which those
          decisions resolve. Multiple operations on one placement count once.
        </p>
      </header>

      <div className="p-4 sm:p-5">
        <div
          aria-describedby={chartDescriptionId}
          aria-label="Locally decided placements per effective page: Eligible 7 of 7, Store 3 of 4, Structural 2 of 24"
          role="img"
        >
          <div
            className="grid grid-cols-5 text-[9px] tabular-nums text-ink-faint"
            aria-hidden="true"
          >
            <span>0%</span>
            <span className="text-center">25%</span>
            <span className="text-center">50%</span>
            <span className="text-center">75%</span>
            <span className="text-right">100%</span>
          </div>
          <ol className="mt-2 space-y-4">
            {scenarioComparisons.map((scenario) => (
              <li
                key={scenario.name}
                data-placement-surface={scenario.placementSurface}
                data-locally-decided-placements={scenario.locallyDecidedPlacements}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div>
                    <span className="text-xs font-semibold text-ink">{scenario.name}</span>
                    <span className="ml-2 text-[10px] text-ink-muted">{scenario.shape}</span>
                  </div>
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-accent-strong">
                    {scenario.ratio} · {scenario.percentage}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-3 overflow-hidden rounded-full border border-line-strong bg-surface-muted"
                  aria-hidden="true"
                >
                  <div
                    className="h-full border-r border-accent-strong bg-accent"
                    style={{ width: scenario.percentage }}
                  />
                </div>
                <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[9px] leading-4 text-ink-muted">
                  <span>
                    Locally decided placements:{' '}
                    <strong className="font-semibold text-ink">
                      {scenario.locallyDecidedPlacements}
                    </strong>
                  </span>
                  <span>{scenario.inherited}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[680px] border-collapse text-left text-[10px] leading-4">
            <caption className="border-b border-line bg-surface-subtle px-3 py-2.5 text-left font-medium text-ink">
              Exact locally-decided-placement ratios for the representative effective page in each
              proof scenario
            </caption>
            <thead className="bg-surface-muted text-ink">
              <tr>
                <th scope="col" className="border-r border-line px-3 py-2 font-semibold">
                  Scenario
                </th>
                <th scope="col" className="border-r border-line px-3 py-2 font-semibold">
                  Locally decided placements
                </th>
                <th scope="col" className="border-r border-line px-3 py-2 font-semibold">
                  Effective-page placement surface
                </th>
                <th scope="col" className="border-r border-line px-3 py-2 font-semibold">
                  Ratio
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Interpretation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-canvas">
              {scenarioComparisons.map((scenario) => (
                <tr key={scenario.name}>
                  <th
                    scope="row"
                    className="border-r border-line px-3 py-2.5 font-semibold text-ink"
                  >
                    {scenario.name}
                  </th>
                  <td className="border-r border-line px-3 py-2.5 font-mono tabular-nums text-ink-muted">
                    {scenario.locallyDecidedPlacements}
                  </td>
                  <td className="border-r border-line px-3 py-2.5 font-mono tabular-nums text-ink-muted">
                    {scenario.placementSurface}
                  </td>
                  <td className="border-r border-line px-3 py-2.5 font-mono font-semibold tabular-nums text-accent-strong">
                    {scenario.ratio} ({scenario.percentage})
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted">{scenario.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 rounded-lg border border-warning/25 bg-warning-soft/55 px-3 py-2.5 text-[10px] leading-4 text-warning-strong">
          Structural uses 24 as its denominator because the tombstone is a local decision against
          one of the 24 baseline positions. The resulting document has 23 visible placements, but
          two of the 24 baseline positions are still decided locally: the replacement and the hide.
        </p>
      </div>

      <figcaption
        id={captionId}
        className="border-t border-line bg-surface-subtle px-4 py-3 text-[10px] italic leading-5 text-ink-muted sm:px-5"
      >
        The ratio compares placement-level authoring locality, not raw operation count, page count,
        manifest reuse, or storage savings: Eligible is 7 / 7, Store is 3 / 4, and Structural is 2 /
        24.
      </figcaption>
    </figure>
  );
}

export function TutorialSemanticFigures() {
  return (
    <section className="grid gap-5" aria-label="Auteur content anatomy and scenario comparison">
      <ContentAnatomyFigure />
      <ScenarioComparisonFigure />
    </section>
  );
}
