import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import type { ScenarioFixture, ScenarioId } from '@/data/scenario-fixtures';
import { cn } from '@/lib/cn';

export function ScenarioSwitcher({
  scenarios,
  activeId,
  destination = 'template',
}: Readonly<{
  scenarios: ScenarioFixture[];
  activeId: ScenarioId;
  destination?: 'template' | 'publications';
}>) {
  return (
    <nav
      aria-label="Proof scenario"
      className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-line bg-surface-subtle p-1"
    >
      {scenarios.map((scenario) => {
        const active = scenario.id === activeId;
        const className = cn(
          'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus',
          active
            ? 'bg-canvas text-ink shadow-sm'
            : 'text-ink-muted hover:bg-canvas/70 hover:text-ink'
        );
        const contents = (
          <>
            {scenario.shortName}
            {scenario.conflictState === '2 conflicts' ? (
              <Badge tone="danger" className="h-4 px-1 text-[8px]">
                2
              </Badge>
            ) : null}
          </>
        );

        return destination === 'template' ? (
          <Link
            key={scenario.id}
            to="/author/$templateId"
            params={{ templateId: scenario.id }}
            search={{ canonicalUrl: scenario.pin.canonicalUrl }}
            aria-current={active ? 'page' : undefined}
            className={className}
          >
            {contents}
          </Link>
        ) : (
          <Link
            key={scenario.id}
            to="/publications/$templateId"
            params={{ templateId: scenario.id }}
            aria-current={active ? 'page' : undefined}
            className={className}
          >
            {contents}
          </Link>
        );
      })}
    </nav>
  );
}
