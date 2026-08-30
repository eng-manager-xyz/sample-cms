import * as z from 'zod';

import type { CmsLifecycleErrorCode } from '@/data/sqlite-authoring';

const RecoverableAuthoringStatusSchema = z.enum(['saved', 'unsaved', 'draft-saved', 'published']);
const PersistedDraftStatusSchema = z.enum(['saved', 'draft-saved']);

const AnnouncementSchema = z.string().trim().min(1).max(500);

export const AuthoringLifecycleStateSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('saved'),
    announcement: AnnouncementSchema,
  }),
  z.strictObject({
    status: z.literal('unsaved'),
    restoreTo: PersistedDraftStatusSchema,
    announcement: AnnouncementSchema,
  }),
  z.strictObject({
    status: z.literal('saving'),
    restoreTo: PersistedDraftStatusSchema,
    announcement: AnnouncementSchema,
  }),
  z.strictObject({
    status: z.literal('draft-saved'),
    announcement: AnnouncementSchema,
  }),
  z.strictObject({
    status: z.literal('publishing'),
    operation: z.enum(['publish', 'rollback']),
    announcement: AnnouncementSchema,
  }),
  z.strictObject({
    status: z.literal('published'),
    operation: z.enum(['publish', 'rollback']),
    publicationId: z.string().trim().min(1).max(200),
    announcement: AnnouncementSchema,
  }),
  z.strictObject({
    status: z.literal('error'),
    message: AnnouncementSchema,
    recoverTo: RecoverableAuthoringStatusSchema,
    restoreTo: PersistedDraftStatusSchema,
    announcement: AnnouncementSchema,
  }),
  z.strictObject({
    status: z.literal('conflict'),
    message: AnnouncementSchema,
    conflictCount: z.int().min(1),
    recoverTo: RecoverableAuthoringStatusSchema,
    restoreTo: PersistedDraftStatusSchema,
    announcement: AnnouncementSchema,
  }),
]);

export type AuthoringLifecycleState = z.infer<typeof AuthoringLifecycleStateSchema>;

export const AuthoringLifecycleEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('workspace-loaded'),
    canonicalUrl: z.string().trim().min(1).max(2_000),
  }),
  z.strictObject({
    type: z.literal('local-change'),
    description: z.string().trim().min(1).max(300).optional(),
  }),
  z.strictObject({ type: z.literal('save-started') }),
  z.strictObject({
    type: z.literal('save-succeeded'),
    message: AnnouncementSchema.optional(),
  }),
  z.strictObject({ type: z.literal('publish-started') }),
  z.strictObject({ type: z.literal('rollback-started') }),
  z.strictObject({
    type: z.literal('publication-succeeded'),
    operation: z.enum(['publish', 'rollback']),
    publicationId: z.string().trim().min(1).max(200),
  }),
  z.strictObject({
    type: z.literal('operation-failed'),
    message: AnnouncementSchema,
    recoverTo: RecoverableAuthoringStatusSchema,
  }),
  z.strictObject({
    type: z.literal('publication-conflict'),
    message: AnnouncementSchema,
    conflictCount: z.int().min(1),
    recoverTo: RecoverableAuthoringStatusSchema,
  }),
  z.strictObject({ type: z.literal('discard-local-changes') }),
  z.strictObject({ type: z.literal('recover') }),
]);

export type AuthoringLifecycleEvent = z.infer<typeof AuthoringLifecycleEventSchema>;

const PublicationBlockerKindSchema = z.enum(['clean', 'conflict', 'error']);

type PublicationBlockerKind = z.infer<typeof PublicationBlockerKindSchema>;

export const AUTHORING_LIFECYCLE_LIVE_REGION_PROPS = {
  role: 'status',
  'aria-live': 'polite',
  'aria-atomic': true,
} as const;

const DEFAULT_ANNOUNCEMENTS = {
  unsaved: 'Unsaved local changes. Save the draft before previewing or publishing them.',
  saving: 'Saving and validating the draft.',
  draftSaved: 'Draft saved. Preview can now resolve the saved full cascade.',
  publishing: 'Publishing the validated draft atomically.',
  rollingBack: 'Rolling back to the selected immutable publication.',
} as const;

export function initialAuthoringLifecycle(canonicalUrl: string): AuthoringLifecycleState {
  return AuthoringLifecycleStateSchema.parse({
    status: 'saved',
    announcement: `Saved SQLite draft loaded for ${canonicalUrl}.`,
  });
}

function recoverState(
  status: z.infer<typeof RecoverableAuthoringStatusSchema>,
  announcement: string,
  restoreTo: z.infer<typeof PersistedDraftStatusSchema>
): AuthoringLifecycleState {
  if (status === 'unsaved') {
    return { status, restoreTo, announcement };
  }
  if (status === 'published') {
    return {
      status: 'saved',
      announcement,
    };
  }
  return { status, announcement };
}

function persistedRestoreStatus(
  state: AuthoringLifecycleState
): z.infer<typeof PersistedDraftStatusSchema> {
  if (state.status === 'saved' || state.status === 'draft-saved') return state.status;
  if (
    state.status === 'unsaved' ||
    state.status === 'saving' ||
    state.status === 'error' ||
    state.status === 'conflict'
  ) {
    return state.restoreTo;
  }
  return 'draft-saved';
}

export function authoringLifecycleReducer(
  state: AuthoringLifecycleState,
  rawEvent: AuthoringLifecycleEvent
): AuthoringLifecycleState {
  const event = AuthoringLifecycleEventSchema.parse(rawEvent);
  switch (event.type) {
    case 'workspace-loaded':
      return initialAuthoringLifecycle(event.canonicalUrl);
    case 'local-change':
      if (state.status === 'saving' || state.status === 'publishing') return state;
      return {
        status: 'unsaved',
        restoreTo: persistedRestoreStatus(state),
        announcement: event.description ?? DEFAULT_ANNOUNCEMENTS.unsaved,
      };
    case 'save-started':
      if (
        state.status !== 'unsaved' &&
        !(state.status === 'error' && state.recoverTo === 'unsaved')
      ) {
        return state;
      }
      return {
        status: 'saving',
        restoreTo: persistedRestoreStatus(state),
        announcement: DEFAULT_ANNOUNCEMENTS.saving,
      };
    case 'save-succeeded':
      if (state.status !== 'saving') return state;
      return {
        status: 'draft-saved',
        announcement: event.message ?? DEFAULT_ANNOUNCEMENTS.draftSaved,
      };
    case 'publish-started':
      if (!canBeginPublication(state)) return state;
      return {
        status: 'publishing',
        operation: 'publish',
        announcement: DEFAULT_ANNOUNCEMENTS.publishing,
      };
    case 'rollback-started':
      if (!canBeginRollback(state)) return state;
      return {
        status: 'publishing',
        operation: 'rollback',
        announcement: DEFAULT_ANNOUNCEMENTS.rollingBack,
      };
    case 'publication-succeeded':
      if (state.status !== 'publishing' || state.operation !== event.operation) return state;
      return {
        status: 'published',
        operation: event.operation,
        publicationId: event.publicationId,
        announcement:
          event.operation === 'publish'
            ? `Published immutable publication ${event.publicationId}.`
            : `Rollback complete. Serving now points to publication ${event.publicationId}.`,
      };
    case 'operation-failed':
      return {
        status: 'error',
        message: event.message,
        recoverTo: event.recoverTo,
        restoreTo:
          event.recoverTo === 'saved' || event.recoverTo === 'draft-saved'
            ? event.recoverTo
            : persistedRestoreStatus(state),
        announcement: `Error: ${event.message}`,
      };
    case 'publication-conflict':
      return {
        status: 'conflict',
        message: event.message,
        conflictCount: event.conflictCount,
        recoverTo: event.recoverTo,
        restoreTo:
          event.recoverTo === 'saved' || event.recoverTo === 'draft-saved'
            ? event.recoverTo
            : persistedRestoreStatus(state),
        announcement: `Conflict: ${event.message}`,
      };
    case 'discard-local-changes':
      if (
        state.status !== 'unsaved' &&
        !(state.status === 'error' && state.recoverTo === 'unsaved')
      ) {
        return state;
      }
      return recoverState(
        state.restoreTo,
        'Local changes discarded. Persisted draft values restored.',
        state.restoreTo
      );
    case 'recover':
      if (state.status !== 'error' && state.status !== 'conflict') return state;
      return recoverState(state.recoverTo, 'Previous authoring state restored.', state.restoreTo);
    default:
      return state;
  }
}

export function authoringLifecycleLabel(
  state: AuthoringLifecycleState
):
  | 'Saved'
  | 'Unsaved'
  | 'Saving'
  | 'Draft saved'
  | 'Publishing'
  | 'Published'
  | 'Error'
  | 'Conflict' {
  switch (state.status) {
    case 'saved':
      return 'Saved';
    case 'unsaved':
      return 'Unsaved';
    case 'saving':
      return 'Saving';
    case 'draft-saved':
      return 'Draft saved';
    case 'publishing':
      return 'Publishing';
    case 'published':
      return 'Published';
    case 'error':
      return 'Error';
    case 'conflict':
      return 'Conflict';
    default:
      return 'Saved';
  }
}

export function canSaveDraft(state: AuthoringLifecycleState): boolean {
  return state.status === 'unsaved' || (state.status === 'error' && state.recoverTo === 'unsaved');
}

export function canReviewPublication(state: AuthoringLifecycleState): boolean {
  return (
    state.status === 'saved' ||
    state.status === 'draft-saved' ||
    state.status === 'published' ||
    state.status === 'conflict' ||
    (state.status === 'error' && state.recoverTo !== 'unsaved')
  );
}

export function canBeginPublication(state: AuthoringLifecycleState): boolean {
  return state.status === 'saved' || state.status === 'draft-saved' || state.status === 'published';
}

export function canBeginRollback(state: AuthoringLifecycleState): boolean {
  return (
    state.status === 'saved' ||
    state.status === 'draft-saved' ||
    state.status === 'published' ||
    state.status === 'conflict' ||
    (state.status === 'error' && state.recoverTo !== 'unsaved')
  );
}

export function canConfirmPublication(
  state: AuthoringLifecycleState,
  preflight: Readonly<{
    canPublish: boolean;
    hasInputHash: boolean;
    confirmed: boolean;
  }>
): boolean {
  return (
    canBeginPublication(state) &&
    preflight.canPublish &&
    preflight.hasInputHash &&
    preflight.confirmed
  );
}

export function classifyPublicationBlockers(
  issueCodes: readonly CmsLifecycleErrorCode[]
): PublicationBlockerKind {
  if (issueCodes.length === 0) return 'clean';
  return issueCodes.every((code) => code === 'CONFLICT' || code === 'PRIORITY_CONFLICT')
    ? 'conflict'
    : 'error';
}

export function isAuthoringLifecyclePending(state: AuthoringLifecycleState): boolean {
  return state.status === 'saving' || state.status === 'publishing';
}
