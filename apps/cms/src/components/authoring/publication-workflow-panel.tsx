import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileStack,
  Rocket,
  RotateCcw,
  X,
} from 'lucide-react';
import { type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react';

import { activateModalDialog } from '@/components/authoring/modal-dialog-lifecycle';
import { Button } from '@/components/ui/button';
import {
  type AuthoringLifecycleState,
  canBeginRollback,
  canConfirmPublication,
} from '@/data/authoring-lifecycle';
import type { CmsPublicationMetadata, CmsPublicationPreflight } from '@/data/sqlite-authoring';

export type PublicationWorkflowOperation = 'preflight' | 'publish' | 'rollback';

function PublicationMetadataCard({
  label,
  publication,
}: Readonly<{
  label: string;
  publication: CmsPublicationMetadata | null;
}>) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </p>
      {publication ? (
        <dl className="mt-2 grid gap-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Sequence</dt>
            <dd className="font-semibold text-ink">#{publication.sequence}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Immutable ID</dt>
            <dd className="mt-0.5 break-all font-mono text-[10px] text-ink">{publication.id}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Input hash</dt>
            <dd className="mt-0.5 break-all font-mono text-[10px] text-ink-faint">
              {publication.inputHash}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Published</dt>
            <dd className="text-right text-ink">
              <time dateTime={publication.publishedAt}>{publication.publishedAt}</time>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-ink-muted">No active publication.</p>
      )}
    </div>
  );
}

function PreflightIssues({ preflight }: Readonly<{ preflight: CmsPublicationPreflight }>) {
  if (preflight.issues.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-success/20 bg-success-soft p-3 text-xs text-success-strong">
        <CheckCircle2 aria-hidden="true" className="size-4" /> No deterministic publication errors
        or same-priority conflicts were found.
      </p>
    );
  }
  return (
    <section aria-labelledby="publication-issues-heading" className="space-y-2" role="alert">
      <h3 id="publication-issues-heading" className="text-xs font-semibold text-danger-strong">
        Publication blockers ({preflight.issues.length})
      </h3>
      <ol className="space-y-2">
        {preflight.issues.map((issue) => (
          <li
            key={`${issue.code}:${issue.priority ?? 'none'}:${issue.placementKey ?? 'none'}:${issue.variantRevisionIds.join(':')}:${issue.operationKinds.join(':')}:${issue.message}`}
            className="rounded-lg border border-danger/25 bg-danger-soft/55 p-3 text-[11px]"
          >
            <p className="flex items-start gap-2 font-semibold text-danger-strong">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {issue.code}
              {issue.placementKey ? ` · ${issue.placementKey}` : ''}
              {issue.priority === null ? '' : ` · P${issue.priority}`}
            </p>
            <p className="mt-1.5 leading-4 text-ink-muted">{issue.message}</p>
            <p className="mt-1 text-ink-faint">
              {issue.affectedPageCount.toLocaleString()} affected page
              {issue.affectedPageCount === 1 ? '' : 's'}
            </p>
            {issue.sampleCanonicalUrls.length > 0 ? (
              <p className="mt-1 break-words font-mono text-[10px] text-ink-faint">
                {issue.sampleCanonicalUrls.join(' · ')}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function PublicationWorkflowPanel({
  preflight,
  lifecycle,
  returnFocusRef,
  pendingOperation,
  error,
  onClose,
  onPublish,
  onRollback,
}: Readonly<{
  preflight: CmsPublicationPreflight;
  lifecycle: AuthoringLifecycleState;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  pendingOperation: PublicationWorkflowOperation | null;
  error: string | null;
  onClose: () => void;
  onPublish: () => void;
  onRollback: (targetPublicationId: string, expectedCurrentPublicationId: string) => void;
}>) {
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canConfirm = canConfirmPublication(lifecycle, {
    canPublish: preflight.canPublish,
    hasInputHash: preflight.inputHash !== null,
    confirmed,
  });
  const rollbackTarget = preflight.rollbackTarget;
  const exactRollbackAvailable = Boolean(
    rollbackTarget?.valid && preflight.currentPublication?.id && canBeginRollback(lifecycle)
  );
  const busy = pendingOperation !== null;
  const requestEscapeClose = useEffectEvent(() => {
    if (!busy) onClose();
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    return activateModalDialog(dialog, returnFocusRef.current, requestEscapeClose);
  }, [returnFocusRef]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-3 sm:p-6">
      <dialog
        ref={dialogRef}
        aria-labelledby="publication-workflow-heading"
        className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-line bg-canvas shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-canvas/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-strong">
              Read-only publication preflight
            </p>
            <h2 id="publication-workflow-heading" className="mt-1 text-lg font-semibold text-ink">
              Review immutable website update
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              This result was compiled from the persisted saved draft. Preflight never moves the
              public serving pointer.
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            disabled={busy}
            autoFocus
            aria-label="Close publication preflight"
            onClick={onClose}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </header>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Active pages
              </p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {preflight.totalActivePages.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Pages changed
              </p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {preflight.affectedActivePages.count.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                Manifest reuse
              </p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {preflight.manifestReuse.reusedManifestCount.toLocaleString()}
                <span className="text-xs font-normal text-ink-muted">
                  {' '}
                  / {preflight.manifestReuse.eligibleManifestCount.toLocaleString()}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
                New manifests
              </p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {preflight.manifestReuse.newManifestCount.toLocaleString()}
              </p>
            </div>
          </div>

          {preflight.affectedActivePages.sampleCanonicalUrls.length > 0 ? (
            <details className="rounded-lg border border-line bg-surface-muted/30">
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-ink">
                Affected page sample ({preflight.affectedActivePages.sampleCanonicalUrls.length})
              </summary>
              <ul className="space-y-1 border-t border-line p-3 font-mono text-[10px] text-ink-muted">
                {preflight.affectedActivePages.sampleCanonicalUrls.map((canonicalUrl) => (
                  <li key={canonicalUrl}>{canonicalUrl}</li>
                ))}
              </ul>
              {preflight.affectedActivePages.truncated ? (
                <p className="border-t border-line px-3 py-2 text-[10px] text-ink-faint">
                  Sample truncated; the exact count above is complete.
                </p>
              ) : null}
            </details>
          ) : null}

          <PreflightIssues preflight={preflight} />

          <div className="grid gap-3 md:grid-cols-2">
            <PublicationMetadataCard
              label="Current public pointer"
              publication={preflight.currentPublication}
            />
            <PublicationMetadataCard
              label="Exact rollback target"
              publication={rollbackTarget?.publication ?? null}
            />
          </div>

          {rollbackTarget && !rollbackTarget.valid ? (
            <p role="alert" className="rounded-lg bg-danger-soft p-3 text-xs text-danger-strong">
              Rollback target rejected: {rollbackTarget.reason ?? 'materialization is invalid'}
            </p>
          ) : null}

          <div className="grid gap-3 rounded-lg border border-line bg-surface-muted/30 p-3 text-[11px] text-ink-muted sm:grid-cols-3">
            <span className="flex items-center gap-1.5">
              <FileStack aria-hidden="true" className="size-3.5" />
              {preflight.blockReferenceCount.toLocaleString()} block references
            </span>
            <span className="flex items-center gap-1.5">
              <Database aria-hidden="true" className="size-3.5" />
              {preflight.selectorMatchCount.toLocaleString()} selector matches
            </span>
            <span>
              {preflight.logicalExpandedRenderedDocumentBytes.toLocaleString()} rendered bytes
            </span>
          </div>

          {preflight.reusesCurrentPublication ? (
            <p className="rounded-lg border border-accent/20 bg-accent-soft p-3 text-xs text-accent-strong">
              The saved draft has the same input hash as the current immutable publication. Publish
              will reuse the current publication instead of moving the pointer.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-danger/25 bg-danger-soft p-3 text-xs text-danger-strong"
            >
              {error}
            </p>
          ) : null}

          <label className="flex items-start gap-2.5 rounded-lg border border-line bg-canvas p-3 text-xs text-ink">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[var(--color-accent)]"
              checked={confirmed}
              disabled={busy || !preflight.canPublish || preflight.inputHash === null}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
            />
            <span>
              I confirm this exact preflight input hash and current serving pointer. Publish may
              atomically update every affected active page.
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div>
              {rollbackTarget?.publication && preflight.currentPublication ? (
                <Button
                  variant="outline"
                  disabled={busy || !exactRollbackAvailable}
                  title={
                    rollbackTarget.valid
                      ? `Move the pointer from ${preflight.currentPublication.id} to ${rollbackTarget.publication.id}`
                      : (rollbackTarget.reason ?? 'Rollback target is invalid')
                  }
                  onClick={() =>
                    onRollback(
                      rollbackTarget.publication.id,
                      preflight.currentPublication?.id ?? ''
                    )
                  }
                >
                  <RotateCcw aria-hidden="true" className="size-4" /> Rollback exactly to #
                  {rollbackTarget.publication.sequence}
                </Button>
              ) : (
                <span className="text-xs text-ink-faint">No valid predecessor is available.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy || !canConfirm} onClick={onPublish}>
                <Rocket aria-hidden="true" className="size-4" />
                {pendingOperation === 'publish' ? 'Publishing…' : 'Confirm atomic publish'}
              </Button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
