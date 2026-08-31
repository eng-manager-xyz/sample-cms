import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2 } from 'lucide-react';
import { useReducer, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { AuthoringContextNavigation } from '@/components/authoring/authoring-context-navigation';
import {
  AuthoringCanvasPane,
  AuthoringInspectorPane,
  type AuthoringInspectorTab,
} from '@/components/authoring/authoring-studio-panes';
import {
  AuthoringDocumentSurface,
  AuthoringSelectorSurface,
} from '@/components/authoring/authoring-studio-surface';
import { AuthoringToolbar } from '@/components/authoring/authoring-toolbar';
import {
  type PublicationWorkflowOperation,
  PublicationWorkflowPanel,
} from '@/components/authoring/publication-workflow-panel';
import type {
  BlockFormInsertion,
  BlockFormSaveInput,
} from '@/components/authoring/schema-block-form';
import { SelectorWorkspace } from '@/components/selector-workspace';
import {
  authoringLifecycleLabel,
  authoringLifecycleReducer,
  canReviewPublication,
  canSaveDraft,
  classifyPublicationBlockers,
  initialAuthoringLifecycle,
  isAuthoringLifecyclePending,
} from '@/data/authoring-lifecycle';
import {
  authoringPanelSearch,
  authoringScopeSearch,
  authoringTemplateSearch,
  type WebsiteOriginState,
  websitePreviewHref,
} from '@/data/authoring-studio';
import type { ContentPageNavigation } from '@/data/content-explorer';
import { type ScenarioFixture, scenarioFixtures } from '@/data/scenario-fixtures';
import type { SelectorWorkspacePreviewInput } from '@/data/selector-workspace';
import type {
  CmsCommand,
  CmsCommandResult,
  CmsLifecycleErrorCode,
  CmsPublicationMutationResponse,
  CmsPublicationPreflight,
  CmsWorkspaceSnapshot,
  SelectorPreviewSnapshot,
} from '@/data/sqlite-authoring';
import {
  executeCmsMutation,
  inspectCmsBlockField,
  loadCmsWorkspace,
  preflightCmsPublication,
  previewCmsSelector,
  publishCmsPublication,
  rollbackCmsPublication,
} from '@/server-functions/cms.functions';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'The authoring operation failed.';
}

function isConflictCode(code: CmsLifecycleErrorCode): boolean {
  return code === 'CONFLICT' || code === 'PRIORITY_CONFLICT';
}

function workspaceKey(
  scenarioId: ScenarioFixture['id'],
  canonicalUrl: string,
  scopeId: string
): readonly string[] {
  return ['cms-authoring-studio', scenarioId, canonicalUrl, scopeId];
}

export function AuthoringStudio({
  scenario,
  initialWorkspace,
  initialInspectorTab,
  pageNavigation,
  websiteOrigin,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  inspectorCollapsed,
  onInspectorCollapsedChange,
}: Readonly<{
  scenario: ScenarioFixture;
  initialWorkspace: CmsWorkspaceSnapshot;
  initialInspectorTab: AuthoringInspectorTab;
  pageNavigation: ContentPageNavigation;
  websiteOrigin: WebsiteOriginState;
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
  inspectorCollapsed: boolean;
  onInspectorCollapsedChange: (collapsed: boolean) => void;
}>) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canonicalUrl = initialWorkspace.canonicalUrl;
  const scopeId = initialWorkspace.scopeId;
  const queryKey = workspaceKey(scenario.id, canonicalUrl, scopeId);
  const workspaceQuery = useQuery({
    queryKey,
    queryFn: () => loadCmsWorkspace({ data: { scenarioId: scenario.id, canonicalUrl, scopeId } }),
    initialData: initialWorkspace,
  });
  const workspace = workspaceQuery.data;
  const defaultVariant = workspace.variants.find((variant) => variant.isDefault);
  const [selectedPlacementKey, setSelectedPlacementKey] = useState(
    workspace.placements[0]?.placementKey ?? ''
  );
  const selectedPlacement =
    workspace.placements.find((placement) => placement.placementKey === selectedPlacementKey) ??
    workspace.placements[0];
  const [addInsertion, setAddInsertion] = useState<BlockFormInsertion | null>(null);
  const addingBlock = addInsertion !== null;
  const inspectorTab = initialInspectorTab;
  const selectorMode = inspectorTab === 'cascade';
  const documentInspectorTab = inspectorTab === 'history' ? 'history' : 'fields';
  const [lifecycle, dispatchLifecycle] = useReducer(
    authoringLifecycleReducer,
    workspace.canonicalUrl,
    initialAuthoringLifecycle
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [publicationPanelOpen, setPublicationPanelOpen] = useState(false);
  const [publicationPreflight, setPublicationPreflight] = useState<CmsPublicationPreflight | null>(
    null
  );
  const [publicationError, setPublicationError] = useState<string | null>(null);
  const publicationTriggerRef = useRef<HTMLButtonElement>(null);

  const applyWorkspace = (nextWorkspace: CmsWorkspaceSnapshot): void => {
    queryClient.setQueryData(
      workspaceKey(scenario.id, canonicalUrl, nextWorkspace.scopeId),
      nextWorkspace
    );
    if (nextWorkspace.scopeId === workspace.scopeId) {
      queryClient.setQueryData(queryKey, nextWorkspace);
      return;
    }
    void navigate({
      to: '/author/$templateId',
      params: { templateId: scenario.id },
      search: { canonicalUrl, scopeId: nextWorkspace.scopeId, panel: inspectorTab },
    });
  };

  const mutation = useMutation({
    mutationFn: async (command: CmsCommand): Promise<CmsCommandResult> => {
      const result = await executeCmsMutation({ data: command });
      const reloadScopeId =
        command.kind === 'createVariant'
          ? result.workspace.scopeId
          : 'scopeId' in command
            ? command.scopeId
            : workspace.scopeId;
      const normalizedWorkspace = await loadCmsWorkspace({
        data: {
          scenarioId: scenario.id,
          scopeId: reloadScopeId,
          canonicalUrl,
        },
      });
      return { ...result, workspace: normalizedWorkspace };
    },
    onMutate: (command) => {
      setPublicationPreflight(null);
      setPublicationPanelOpen(false);
      setPublicationError(null);
      dispatchLifecycle({
        type: 'local-change',
        description: `Persisting ${command.kind} to the SQLite draft.`,
      });
      dispatchLifecycle({ type: 'save-started' });
    },
    onSuccess: (result) => {
      setServerError(null);
      dispatchLifecycle({
        type: 'save-succeeded',
        message: `${result.message} The exact canonical-page draft was reloaded.`,
      });
      applyWorkspace(result.workspace);
    },
    onError: (error, command) => {
      const message = readableError(error);
      setServerError(message);
      dispatchLifecycle({
        type: 'operation-failed',
        message: `Save rejected: ${message}`,
        recoverTo:
          command.kind === 'addPlacement' || command.kind === 'editPlacement'
            ? 'unsaved'
            : 'draft-saved',
      });
    },
  });
  const selectorPreviewMutation = useMutation({
    mutationFn: (input: SelectorWorkspacePreviewInput) => previewCmsSelector({ data: input }),
  });
  const preflightMutation = useMutation({
    mutationFn: () =>
      preflightCmsPublication({
        data: {
          scenarioId: scenario.id,
          canonicalUrl: workspace.canonicalUrl,
          scopeId: workspace.scopeId,
          materializationMode: 'manifest',
          sampleLimit: 10,
        },
      }),
    onMutate: () => {
      setPublicationError(null);
    },
    onSuccess: (preflight) => {
      setPublicationPreflight(preflight);
      setPublicationPanelOpen(true);
      if (preflight.issues.length === 0) {
        if (lifecycle.status === 'error' || lifecycle.status === 'conflict') {
          dispatchLifecycle({ type: 'recover' });
        }
        return;
      }
      const blockerKind = classifyPublicationBlockers(preflight.issues.map((issue) => issue.code));
      const conflictCount = preflight.issues.filter((issue) => isConflictCode(issue.code)).length;
      dispatchLifecycle(
        blockerKind === 'conflict'
          ? {
              type: 'publication-conflict',
              message: `${conflictCount} deterministic same-priority conflict${conflictCount === 1 ? '' : 's'} found.`,
              conflictCount,
              recoverTo: 'draft-saved',
            }
          : {
              type: 'operation-failed',
              message: `Publication preflight found ${preflight.issues.length} validation blocker${preflight.issues.length === 1 ? '' : 's'}.`,
              recoverTo: 'draft-saved',
            }
      );
    },
    onError: (error) => {
      const message = readableError(error);
      setPublicationError(message);
      dispatchLifecycle({
        type: 'operation-failed',
        message: `Publication preflight failed: ${message}`,
        recoverTo: 'draft-saved',
      });
    },
  });
  const publicationMutation = useMutation({
    mutationFn: async (): Promise<CmsPublicationMutationResponse> => {
      if (!publicationPreflight?.inputHash) {
        throw new Error('Run a clean publication preflight before publishing.');
      }
      return publishCmsPublication({
        data: {
          scenarioId: scenario.id,
          canonicalUrl: workspace.canonicalUrl,
          scopeId: workspace.scopeId,
          inputHash: publicationPreflight.inputHash,
          expectedCurrentPublicationId: publicationPreflight.currentPublication?.id ?? null,
          materializationMode: publicationPreflight.materializationMode,
        },
      });
    },
    onMutate: () => {
      setPublicationError(null);
      dispatchLifecycle({ type: 'publish-started' });
    },
    onSuccess: (response) => {
      if (!response.ok) {
        setPublicationError(response.error.message);
        if (response.preflight) setPublicationPreflight(response.preflight);
        dispatchLifecycle(
          isConflictCode(response.error.code)
            ? {
                type: 'publication-conflict',
                message: response.error.message,
                conflictCount: Math.max(response.preflight?.issues.length ?? 0, 1),
                recoverTo: 'draft-saved',
              }
            : {
                type: 'operation-failed',
                message: `Publication failed atomically: ${response.error.message}`,
                recoverTo: 'draft-saved',
              }
        );
        return;
      }
      if (response.result.kind !== 'publish') {
        const message = 'The publication endpoint returned an unexpected rollback result.';
        setPublicationError(message);
        dispatchLifecycle({
          type: 'operation-failed',
          message,
          recoverTo: 'draft-saved',
        });
        return;
      }
      const result = response.result;
      setServerError(null);
      setPublicationPreflight(result.preflight);
      applyWorkspace(result.workspace);
      dispatchLifecycle({
        type: 'publication-succeeded',
        operation: 'publish',
        publicationId: result.publication.id,
      });
    },
    onError: (error) => {
      const message = readableError(error);
      setPublicationError(message);
      dispatchLifecycle({
        type: 'operation-failed',
        message: `Publication failed atomically: ${message}`,
        recoverTo: 'draft-saved',
      });
    },
  });
  const rollbackMutation = useMutation({
    mutationFn: (input: {
      targetPublicationId: string;
      expectedCurrentPublicationId: string;
    }): Promise<CmsPublicationMutationResponse> =>
      rollbackCmsPublication({
        data: {
          scenarioId: scenario.id,
          canonicalUrl: workspace.canonicalUrl,
          scopeId: workspace.scopeId,
          ...input,
        },
      }),
    onMutate: () => {
      setPublicationError(null);
      dispatchLifecycle({ type: 'rollback-started' });
    },
    onSuccess: (response) => {
      if (!response.ok) {
        setPublicationError(response.error.message);
        if (response.preflight) setPublicationPreflight(response.preflight);
        dispatchLifecycle(
          isConflictCode(response.error.code)
            ? {
                type: 'publication-conflict',
                message: response.error.message,
                conflictCount: Math.max(response.preflight?.issues.length ?? 0, 1),
                recoverTo: 'published',
              }
            : {
                type: 'operation-failed',
                message: `Rollback failed without moving the pointer: ${response.error.message}`,
                recoverTo: 'published',
              }
        );
        return;
      }
      if (response.result.kind !== 'rollback') {
        const message = 'The rollback endpoint returned an unexpected publish result.';
        setPublicationError(message);
        dispatchLifecycle({ type: 'operation-failed', message, recoverTo: 'published' });
        return;
      }
      const result = response.result;
      setServerError(null);
      setPublicationPreflight(result.preflight);
      applyWorkspace(result.workspace);
      dispatchLifecycle({
        type: 'publication-succeeded',
        operation: 'rollback',
        publicationId: result.publication.id,
      });
    },
    onError: (error) => {
      const message = readableError(error);
      setPublicationError(message);
      dispatchLifecycle({
        type: 'operation-failed',
        message: `Rollback failed without moving the pointer: ${message}`,
        recoverTo: 'published',
      });
    },
  });
  const publicationPendingOperation: PublicationWorkflowOperation | null =
    preflightMutation.isPending
      ? 'preflight'
      : publicationMutation.isPending
        ? 'publish'
        : rollbackMutation.isPending
          ? 'rollback'
          : null;
  const pending =
    mutation.isPending ||
    selectorPreviewMutation.isPending ||
    publicationPendingOperation !== null ||
    workspaceQuery.isFetching ||
    isAuthoringLifecyclePending(lifecycle);
  const hasUnsavedForm = canSaveDraft(lifecycle);
  const formActionsDisabled = pending || !workspace.scopeMatchesSamplePage;
  const structureActionsDisabled = formActionsDisabled || hasUnsavedForm;
  const hasEditableForm = addingBlock || Boolean(selectedPlacement);

  const runCommand = (command: CmsCommand): Promise<CmsCommandResult> =>
    mutation.mutateAsync(command);

  const runSelectorPreview = (
    input: SelectorWorkspacePreviewInput
  ): Promise<SelectorPreviewSnapshot> => selectorPreviewMutation.mutateAsync(input);

  const inspectField = (source: string) =>
    inspectCmsBlockField({ data: { scenarioId: scenario.id, canonicalUrl, source } });

  const chooseScope = (nextScopeId: string): void => {
    const nextVariant = workspace.variants.find((variant) => variant.id === nextScopeId);
    void navigate({
      to: '/author/$templateId',
      params: { templateId: scenario.id },
      search: authoringScopeSearch({
        canonicalUrl,
        nextScopeId,
        currentPanel: inspectorTab,
        nextScopeIsDefault: Boolean(nextVariant?.isDefault),
      }),
    });
  };

  const changeInspectorTab = (tab: AuthoringInspectorTab): void => {
    void navigate({
      to: '/author/$templateId',
      params: { templateId: scenario.id },
      search: authoringPanelSearch({ canonicalUrl, scopeId: workspace.scopeId, panel: tab }),
      replace: true,
    });
  };

  const viewSelector = (): void => {
    changeInspectorTab('cascade');
  };

  const choosePage = (nextCanonicalUrl: string): void => {
    void navigate({
      to: '/author/$templateId',
      params: { templateId: scenario.id },
      search: {
        canonicalUrl: nextCanonicalUrl,
        scopeId: workspace.scopeId,
        panel: inspectorTab,
      },
    });
  };

  const chooseTemplate = (nextScenarioId: ScenarioFixture['id']): void => {
    const nextScenario = scenarioFixtures.find((candidate) => candidate.id === nextScenarioId);
    if (!nextScenario || nextScenario.id === scenario.id) return;
    void navigate({
      to: '/author/$templateId',
      params: { templateId: nextScenario.id },
      search: authoringTemplateSearch(),
    });
  };

  const selectPlacement = (placementKey: string): void => {
    setAddInsertion(null);
    setSelectedPlacementKey(placementKey);
    changeInspectorTab('fields');
  };

  const startAdd = (insertion: BlockFormInsertion): void => {
    setAddInsertion(insertion);
    changeInspectorTab('fields');
    dispatchLifecycle({
      type: 'local-change',
      description: 'Unsaved new block. Complete its fields and save the SQLite draft.',
    });
  };

  const saveBlock = async (input: BlockFormSaveInput): Promise<void> => {
    await runCommand(
      addingBlock
        ? {
            kind: 'addPlacement',
            scenarioId: scenario.id,
            scopeId: workspace.scopeId,
            canonicalUrl: workspace.canonicalUrl,
            ...input,
          }
        : {
            kind: 'editPlacement',
            scenarioId: scenario.id,
            scopeId: workspace.scopeId,
            canonicalUrl: workspace.canonicalUrl,
            placementKey: input.placementKey,
            blockTypeKey: input.blockTypeKey,
            contentJson: input.contentJson,
          }
    );
    setAddInsertion(null);
    setSelectedPlacementKey(input.placementKey);
    changeInspectorTab('fields');
  };

  const runPlacementCommand = (command: CmsCommand): void => {
    void runCommand(command).catch(() => undefined);
  };
  const reviewPublication = (): void => {
    if (!canReviewPublication(lifecycle)) return;
    preflightMutation.mutate();
  };
  const closePublicationPanel = (): void => {
    setPublicationPanelOpen(false);
    if (lifecycle.status === 'error' || lifecycle.status === 'conflict') {
      dispatchLifecycle({ type: 'recover' });
    }
  };
  const previewHref =
    websiteOrigin.status === 'ready'
      ? websitePreviewHref(workspace.canonicalUrl, websiteOrigin.origin)
      : undefined;
  const unavailableOriginMessage =
    websiteOrigin.status === 'unavailable' && websiteOrigin.reason === 'invalid-config'
      ? 'CMS_WEBSITE_ORIGIN is invalid; Preview is unavailable.'
      : 'Set CMS_WEBSITE_ORIGIN on the CMS server to enable Preview in this environment.';
  const lifecycleLabel = authoringLifecycleLabel(lifecycle);
  const lifecycleTone =
    lifecycle.status === 'error' || lifecycle.status === 'conflict'
      ? 'danger'
      : lifecycle.status === 'unsaved' || lifecycle.status === 'saving'
        ? 'warning'
        : lifecycle.status === 'published' || lifecycle.status === 'draft-saved'
          ? 'success'
          : 'neutral';
  const saveTitle = !workspace.scopeMatchesSamplePage
    ? 'The selected scope does not match this canonical page'
    : !hasEditableForm
      ? 'Select or add a block to save'
      : documentInspectorTab === 'fields' && !selectorMode
        ? 'Save the current block draft'
        : 'Open Fields to save';
  const reviewTitle = hasUnsavedForm
    ? 'Save local form changes before running publication preflight'
    : 'Compile a read-only preflight before confirming publication';

  return (
    <AppShell
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={onSidebarCollapsedChange}
      section="template"
      templateId={scenario.id}
      headerContent={
        <AuthoringContextNavigation
          scenarios={scenarioFixtures}
          scenario={scenario}
          navigation={pageNavigation}
          canonicalUrl={workspace.canonicalUrl}
          resolutionStatus={workspace.resolutionStatus}
          lifecycleLabel={lifecycleLabel}
          lifecycleTone={lifecycleTone}
          lifecycleAnnouncement={lifecycle.announcement}
          disabled={pending || hasUnsavedForm}
          onTemplateChange={chooseTemplate}
          onPageChange={(page) => choosePage(page.canonicalUrl)}
        />
      }
      headerActions={
        <AuthoringToolbar
          variants={workspace.variants}
          selectedScopeId={workspace.scopeId}
          scopeDisabled={pending || hasUnsavedForm}
          lifecycleAnnouncement={lifecycle.announcement}
          saveDisabled={
            formActionsDisabled ||
            documentInspectorTab !== 'fields' ||
            selectorMode ||
            !hasEditableForm ||
            !canSaveDraft(lifecycle)
          }
          savePending={mutation.isPending}
          saveTitle={saveTitle}
          {...(previewHref ? { previewHref } : {})}
          previewUnavailableTitle={unavailableOriginMessage}
          reviewDisabled={pending || !canReviewPublication(lifecycle)}
          reviewPending={preflightMutation.isPending}
          reviewTitle={reviewTitle}
          publicationTriggerRef={publicationTriggerRef}
          onSelectScope={chooseScope}
          onViewSelector={viewSelector}
          onClearSelector={() => {
            if (defaultVariant) chooseScope(defaultVariant.id);
          }}
          onReviewPublication={reviewPublication}
        />
      }
    >
      <div className="min-h-0" aria-busy={pending}>
        {selectorMode ? (
          <AuthoringSelectorSurface
            disabled={pending}
            onReturnToDocument={() => changeInspectorTab('fields')}
          >
            <SelectorWorkspace
              scenarioId={scenario.id}
              workspace={workspace}
              pending={pending}
              runCommand={runCommand}
              previewSelector={runSelectorPreview}
            />
          </AuthoringSelectorSurface>
        ) : (
          <AuthoringDocumentSurface inspectorCollapsed={inspectorCollapsed}>
            <AuthoringCanvasPane
              scenarioId={scenario.id}
              workspace={workspace}
              selectedPlacementKey={selectedPlacement?.placementKey}
              addingBlock={addingBlock}
              actionsDisabled={structureActionsDisabled}
              onStartAdd={startAdd}
              onSelectPlacement={selectPlacement}
              runPlacementCommand={runPlacementCommand}
            />
            <AuthoringInspectorPane
              workspace={workspace}
              selectedPlacement={selectedPlacement}
              addingBlock={addingBlock}
              {...(addInsertion ? { addInsertion } : {})}
              inspectorTab={documentInspectorTab}
              inspectorNavigationDisabled={hasUnsavedForm}
              collapsed={inspectorCollapsed}
              pending={pending}
              placementActionsDisabled={formActionsDisabled}
              serverError={serverError}
              onTabChange={(tab) => {
                if (hasUnsavedForm && tab !== 'fields') return;
                changeInspectorTab(tab);
              }}
              onCollapsedChange={onInspectorCollapsedChange}
              onDiscardChanges={() => {
                setAddInsertion(null);
                setServerError(null);
                dispatchLifecycle({ type: 'discard-local-changes' });
              }}
              onSave={saveBlock}
              onFormDirty={(description) => {
                setServerError(null);
                setPublicationPreflight(null);
                setPublicationPanelOpen(false);
                setPublicationError(null);
                dispatchLifecycle({ type: 'local-change', description });
              }}
              inspectField={inspectField}
            />
          </AuthoringDocumentSurface>
        )}

        {publicationPanelOpen && publicationPreflight ? (
          <PublicationWorkflowPanel
            key={`${publicationPreflight.inputHash ?? 'blocked'}:${publicationPreflight.currentPublication?.id ?? 'none'}`}
            preflight={publicationPreflight}
            lifecycle={lifecycle}
            returnFocusRef={publicationTriggerRef}
            pendingOperation={publicationPendingOperation}
            error={publicationError}
            onClose={closePublicationPanel}
            onPublish={() => publicationMutation.mutate()}
            onRollback={(targetPublicationId, expectedCurrentPublicationId) =>
              rollbackMutation.mutate({ targetPublicationId, expectedCurrentPublicationId })
            }
          />
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas px-4 py-2 text-[10px] text-ink-muted">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 aria-hidden="true" className="size-3.5 text-success-strong" /> Every
            action crosses the validated SQLite server boundary.
          </span>
          <span>
            {workspace.publicationCount} immutable publications · rollback{' '}
            {workspace.rollbackPublicationId ?? 'not available'}
          </span>
        </footer>
      </div>
    </AppShell>
  );
}
