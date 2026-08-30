import { describe, expect, test } from 'bun:test';

import {
  AUTHORING_LIFECYCLE_LIVE_REGION_PROPS,
  AuthoringLifecycleEventSchema,
  authoringLifecycleLabel,
  authoringLifecycleReducer,
  canBeginPublication,
  canBeginRollback,
  canConfirmPublication,
  canReviewPublication,
  canSaveDraft,
  classifyPublicationBlockers,
  initialAuthoringLifecycle,
  isAuthoringLifecyclePending,
} from './authoring-lifecycle';

describe('authoring lifecycle', () => {
  test('announces every lifecycle transition through one polite atomic status region', () => {
    expect(AUTHORING_LIFECYCLE_LIVE_REGION_PROPS).toEqual({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': true,
    });
  });

  test('moves local field edits through validation and persisted draft reload', () => {
    const loaded = initialAuthoringLifecycle('/en-US/store/1001');
    expect(authoringLifecycleLabel(loaded)).toBe('Saved');

    const changed = authoringLifecycleReducer(loaded, { type: 'local-change' });
    expect(authoringLifecycleLabel(changed)).toBe('Unsaved');
    expect(canSaveDraft(changed)).toBe(true);
    expect(canReviewPublication(changed)).toBe(false);

    const saving = authoringLifecycleReducer(changed, { type: 'save-started' });
    expect(authoringLifecycleLabel(saving)).toBe('Saving');
    expect(isAuthoringLifecyclePending(saving)).toBe(true);

    const saved = authoringLifecycleReducer(saving, {
      type: 'save-succeeded',
      message: 'Validated, persisted, and reloaded the exact canonical-page draft.',
    });
    expect(authoringLifecycleLabel(saved)).toBe('Draft saved');
    expect(saved.announcement).toContain('reloaded');
    expect(canReviewPublication(saved)).toBe(true);
  });

  test('discards only local form changes and restores the prior persisted lifecycle', () => {
    const loaded = initialAuthoringLifecycle('/en-US/store/1001');
    const initialEdit = authoringLifecycleReducer(loaded, { type: 'local-change' });
    expect(initialEdit).toMatchObject({ status: 'unsaved', restoreTo: 'saved' });
    expect(authoringLifecycleReducer(initialEdit, { type: 'discard-local-changes' })).toMatchObject(
      { status: 'saved' }
    );

    const draftSaved = authoringLifecycleReducer(
      authoringLifecycleReducer(initialEdit, { type: 'save-started' }),
      { type: 'save-succeeded' }
    );
    const subsequentEdit = authoringLifecycleReducer(draftSaved, { type: 'local-change' });
    expect(subsequentEdit).toMatchObject({ status: 'unsaved', restoreTo: 'draft-saved' });
    expect(
      authoringLifecycleReducer(subsequentEdit, { type: 'discard-local-changes' })
    ).toMatchObject({ status: 'draft-saved' });
  });

  test('can discard invalid local values after a rejected save', () => {
    const changed = authoringLifecycleReducer(initialAuthoringLifecycle('/draft'), {
      type: 'local-change',
    });
    const saving = authoringLifecycleReducer(changed, { type: 'save-started' });
    const rejected = authoringLifecycleReducer(saving, {
      type: 'operation-failed',
      message: 'CEL validation failed.',
      recoverTo: 'unsaved',
    });
    expect(rejected).toMatchObject({ status: 'error', restoreTo: 'saved' });
    expect(authoringLifecycleReducer(rejected, { type: 'discard-local-changes' })).toMatchObject({
      status: 'saved',
    });
  });

  test('publishes only from a persisted state and records the exact immutable pointer', () => {
    const unsaved = authoringLifecycleReducer(initialAuthoringLifecycle('/draft'), {
      type: 'local-change',
    });
    expect(authoringLifecycleReducer(unsaved, { type: 'publish-started' })).toEqual(unsaved);

    const draftSaved = authoringLifecycleReducer(
      authoringLifecycleReducer(unsaved, { type: 'save-started' }),
      { type: 'save-succeeded' }
    );
    expect(
      canConfirmPublication(draftSaved, {
        canPublish: true,
        hasInputHash: true,
        confirmed: true,
      })
    ).toBe(true);
    const publishing = authoringLifecycleReducer(draftSaved, { type: 'publish-started' });
    expect(authoringLifecycleLabel(publishing)).toBe('Publishing');

    const published = authoringLifecycleReducer(publishing, {
      type: 'publication-succeeded',
      operation: 'publish',
      publicationId: 'publication-store-42',
    });
    expect(authoringLifecycleLabel(published)).toBe('Published');
    expect(published).toMatchObject({
      operation: 'publish',
      publicationId: 'publication-store-42',
    });
  });

  test('reports Conflict only when every preflight blocker is a deterministic conflict', () => {
    expect(classifyPublicationBlockers([])).toBe('clean');
    expect(classifyPublicationBlockers(['PRIORITY_CONFLICT', 'CONFLICT'])).toBe('conflict');
    expect(classifyPublicationBlockers(['CEL_VALIDATION'])).toBe('error');
    expect(classifyPublicationBlockers(['PRIORITY_CONFLICT', 'SCHEMA_VALIDATION'])).toBe('error');
  });

  test('uses the publishing state for an exact rollback and rejects stale completion events', () => {
    const loaded = initialAuthoringLifecycle('/en-US/airport/hero-alt');
    const rollingBack = authoringLifecycleReducer(loaded, { type: 'rollback-started' });
    expect(rollingBack).toMatchObject({ status: 'publishing', operation: 'rollback' });

    expect(
      authoringLifecycleReducer(rollingBack, {
        type: 'publication-succeeded',
        operation: 'publish',
        publicationId: 'wrong-operation',
      })
    ).toEqual(rollingBack);

    const rolledBack = authoringLifecycleReducer(rollingBack, {
      type: 'publication-succeeded',
      operation: 'rollback',
      publicationId: 'publication-airport-previous',
    });
    expect(rolledBack).toMatchObject({
      status: 'published',
      operation: 'rollback',
      publicationId: 'publication-airport-previous',
    });
  });

  test('recovers from a failed publication attempt without treating persisted draft as unsaved', () => {
    const publishing = authoringLifecycleReducer(initialAuthoringLifecycle('/draft'), {
      type: 'publish-started',
    });
    const failed = authoringLifecycleReducer(publishing, {
      type: 'operation-failed',
      message: 'Publication failed before activation.',
      recoverTo: 'draft-saved',
    });
    expect(failed).toMatchObject({ status: 'error', recoverTo: 'draft-saved' });
    expect(canReviewPublication(failed)).toBe(true);
    expect(authoringLifecycleReducer(failed, { type: 'recover' })).toMatchObject({
      status: 'draft-saved',
    });
  });

  test('keeps conflict and error states recoverable without losing whether a draft was dirty', () => {
    const conflict = authoringLifecycleReducer(initialAuthoringLifecycle('/draft'), {
      type: 'publication-conflict',
      message: 'Two priority-30 variants write hero.',
      conflictCount: 2,
      recoverTo: 'draft-saved',
    });
    expect(authoringLifecycleLabel(conflict)).toBe('Conflict');
    expect(canReviewPublication(conflict)).toBe(true);
    expect(canBeginPublication(conflict)).toBe(false);
    expect(canBeginRollback(conflict)).toBe(true);
    expect(
      canConfirmPublication(conflict, {
        canPublish: true,
        hasInputHash: true,
        confirmed: true,
      })
    ).toBe(false);
    expect(authoringLifecycleReducer(conflict, { type: 'publish-started' })).toEqual(conflict);
    expect(authoringLifecycleReducer(conflict, { type: 'recover' })).toMatchObject({
      status: 'draft-saved',
    });

    const dirtyError = authoringLifecycleReducer(initialAuthoringLifecycle('/draft'), {
      type: 'operation-failed',
      message: 'CEL validation failed.',
      recoverTo: 'unsaved',
    });
    expect(authoringLifecycleLabel(dirtyError)).toBe('Error');
    expect(canSaveDraft(dirtyError)).toBe(true);
    expect(authoringLifecycleReducer(dirtyError, { type: 'local-change' })).toMatchObject({
      status: 'unsaved',
    });
  });

  test('rejects malformed events at the reducer boundary', () => {
    expect(
      AuthoringLifecycleEventSchema.safeParse({
        type: 'publication-conflict',
        message: 'Conflict',
        conflictCount: 0,
        recoverTo: 'draft-saved',
      }).success
    ).toBe(false);
    expect(
      AuthoringLifecycleEventSchema.safeParse({
        type: 'publication-succeeded',
        operation: 'publish',
        publicationId: '',
      }).success
    ).toBe(false);
  });
});
