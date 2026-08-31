import { useId } from 'react';

import { pageForNavigation, TemplatePageNavigator } from '@/components/template-page-navigator';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import type { ContentPageNavigation, ContentPageNavigationOption } from '@/data/content-explorer';
import { type TemplateKey, TemplateKeySchema } from '@/data/scenario-fixtures';
import type { CmsWorkspaceSnapshot } from '@/data/sqlite-authoring';

export interface AuthoringTemplateOption {
  readonly id: TemplateKey;
  readonly name: string;
}

export function AuthoringContextNavigation({
  scenarios,
  scenario,
  navigation,
  canonicalUrl,
  resolutionStatus,
  lifecycleLabel,
  lifecycleTone,
  lifecycleAnnouncement,
  disabled,
  onTemplateChange,
  onPageChange,
}: Readonly<{
  scenarios: readonly AuthoringTemplateOption[];
  scenario: AuthoringTemplateOption;
  navigation: ContentPageNavigation;
  canonicalUrl: string;
  resolutionStatus: CmsWorkspaceSnapshot['resolutionStatus'];
  lifecycleLabel: string;
  lifecycleTone: BadgeProps['tone'];
  lifecycleAnnouncement: string;
  disabled: boolean;
  onTemplateChange: (scenarioId: TemplateKey) => void;
  onPageChange: (page: ContentPageNavigationOption) => void;
}>) {
  const idPrefix = useId();
  const selectedPage = pageForNavigation(navigation, canonicalUrl);
  const routeStatus = selectedPage?.routeStatus ?? 'not_live';
  const routeAndResolutionTone =
    resolutionStatus !== 'resolved' ? 'danger' : routeStatus === 'live' ? 'success' : 'warning';

  return (
    <nav
      aria-label="Authoring page context"
      className="flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden"
    >
      <h1 className="sr-only">{scenario.name} authoring</h1>
      <label className="sr-only" htmlFor={`${idPrefix}-template`}>
        Template
      </label>
      <Select
        id={`${idPrefix}-template`}
        density="compact"
        className="w-auto max-w-40 shrink-0 font-medium"
        value={scenario.id}
        disabled={disabled}
        title="Template"
        onChange={(event) => onTemplateChange(TemplateKeySchema.parse(event.currentTarget.value))}
      >
        {scenarios.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </Select>
      <span aria-hidden="true" className="shrink-0 text-ink-faint">
        /
      </span>
      <TemplatePageNavigator
        navigation={navigation}
        canonicalUrl={canonicalUrl}
        disabled={disabled}
        variant="compact"
        onPageChange={onPageChange}
      />
      <Badge
        tone={routeAndResolutionTone}
        className="h-5 shrink-0 px-1.5 text-[10px]"
        title={`Router status: ${routeStatus.replace('_', ' ')}. Authoring resolution: ${resolutionStatus}.`}
      >
        <span className="sr-only">Route and resolution status: </span>
        {routeStatus.replace('_', ' ')} · {resolutionStatus}
      </Badge>
      <Badge
        tone={lifecycleTone}
        dot
        className="h-5 shrink-0 px-1.5 text-[10px]"
        title={lifecycleAnnouncement}
      >
        {lifecycleLabel}
      </Badge>
      <span className="sr-only">Current canonical page: {canonicalUrl}</span>
    </nav>
  );
}
