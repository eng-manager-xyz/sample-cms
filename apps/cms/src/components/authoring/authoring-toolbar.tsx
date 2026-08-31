import { Eye, Rocket, Save } from 'lucide-react';
import type { Ref } from 'react';

import { AuthoringScopeControl } from '@/components/authoring/authoring-scope-control';
import { AUTHORING_BLOCK_FORM_ID } from '@/components/authoring/schema-block-form';
import { Button } from '@/components/ui/button';
import { buttonClassName } from '@/components/ui/button-styles';
import { AUTHORING_LIFECYCLE_LIVE_REGION_PROPS } from '@/data/authoring-lifecycle';
import type { CmsWorkspaceVariant } from '@/data/sqlite-authoring';

export function AuthoringToolbar({
  variants,
  selectedScopeId,
  scopeDisabled,
  lifecycleAnnouncement,
  saveDisabled,
  savePending,
  saveTitle,
  previewHref,
  previewUnavailableTitle,
  reviewDisabled,
  reviewPending,
  reviewTitle,
  publicationTriggerRef,
  onSelectScope,
  onViewSelector,
  onCreateSelector,
  onClearSelector,
  onReviewPublication,
}: Readonly<{
  variants: readonly CmsWorkspaceVariant[];
  selectedScopeId: string;
  scopeDisabled: boolean;
  lifecycleAnnouncement: string;
  saveDisabled: boolean;
  savePending: boolean;
  saveTitle: string;
  previewHref?: string;
  previewUnavailableTitle: string;
  reviewDisabled: boolean;
  reviewPending: boolean;
  reviewTitle: string;
  publicationTriggerRef: Ref<HTMLButtonElement>;
  onSelectScope: (scopeId: string) => void;
  onViewSelector: () => void;
  onCreateSelector: () => void;
  onClearSelector: () => void;
  onReviewPublication: () => void;
}>) {
  return (
    <fieldset className="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <legend className="sr-only">Template authoring actions</legend>
      <p {...AUTHORING_LIFECYCLE_LIVE_REGION_PROPS} className="sr-only">
        {lifecycleAnnouncement}
      </p>
      <AuthoringScopeControl
        variants={variants}
        selectedScopeId={selectedScopeId}
        disabled={scopeDisabled}
        onSelectScope={onSelectScope}
        onViewSelector={onViewSelector}
        onCreateSelector={onCreateSelector}
        onClearSelector={onClearSelector}
      />
      <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-line" />
      <span className="inline-flex" title={saveTitle}>
        <Button
          variant="outline"
          size="icon-sm"
          form={AUTHORING_BLOCK_FORM_ID}
          type="submit"
          disabled={saveDisabled}
          aria-label="Save block draft"
          aria-busy={savePending}
        >
          <Save aria-hidden="true" className="size-4" />
        </Button>
      </span>
      {previewHref ? (
        <a
          href={previewHref}
          target="_blank"
          rel="noreferrer"
          className={buttonClassName({ variant: 'outline', size: 'icon-sm' })}
          aria-label="Preview saved draft in a new tab"
          title="Open the persisted saved draft as the full active cascade; unsaved local form edits are excluded."
        >
          <Eye aria-hidden="true" className="size-4" />
        </a>
      ) : (
        <span className="inline-flex" title={previewUnavailableTitle}>
          <Button variant="outline" size="icon-sm" disabled aria-label="Preview unavailable">
            <Eye aria-hidden="true" className="size-4" />
          </Button>
        </span>
      )}
      <span className="inline-flex" title={reviewTitle}>
        <Button
          ref={publicationTriggerRef}
          size="icon-sm"
          disabled={reviewDisabled}
          aria-label="Review publication"
          aria-busy={reviewPending}
          onClick={onReviewPublication}
        >
          <Rocket aria-hidden="true" className="size-4" />
        </Button>
      </span>
    </fieldset>
  );
}
