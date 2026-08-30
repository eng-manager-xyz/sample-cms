interface ModalDialogController {
  readonly open: boolean;
  readonly ownerDocument: {
    addEventListener: (
      type: 'keydown',
      listener: (event: KeyboardEvent) => void,
      capture: true
    ) => void;
    removeEventListener: (
      type: 'keydown',
      listener: (event: KeyboardEvent) => void,
      capture: true
    ) => void;
  };
  showModal: () => void;
  close: () => void;
  addEventListener: (type: 'cancel', listener: (event: Event) => void) => void;
  removeEventListener: (type: 'cancel', listener: (event: Event) => void) => void;
}

interface FocusRestoreTarget {
  readonly isConnected: boolean;
  focus: () => void;
}

export function activateModalDialog(
  dialog: ModalDialogController,
  trigger: FocusRestoreTarget | null,
  onCancel: () => void
): () => void {
  let escapeHandled = false;
  const requestCancel = (event: Event): void => {
    event.preventDefault();
    if (escapeHandled) return;
    escapeHandled = true;
    onCancel();
    queueMicrotask(() => {
      escapeHandled = false;
    });
  };
  const handleCancel = (event: Event): void => {
    requestCancel(event);
  };
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    requestCancel(event);
  };

  dialog.addEventListener('cancel', handleCancel);
  dialog.ownerDocument.addEventListener('keydown', handleKeyDown, true);
  if (!dialog.open) dialog.showModal();

  return () => {
    dialog.removeEventListener('cancel', handleCancel);
    dialog.ownerDocument.removeEventListener('keydown', handleKeyDown, true);
    if (dialog.open) dialog.close();
    if (trigger?.isConnected) trigger.focus();
  };
}
