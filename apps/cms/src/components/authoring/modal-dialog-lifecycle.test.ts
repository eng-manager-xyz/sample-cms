import { describe, expect, test } from 'bun:test';

import { activateModalDialog } from './modal-dialog-lifecycle';

function createDialogHarness(initiallyOpen = false, onShowModal: () => void = () => undefined) {
  let open = initiallyOpen;
  let cancelListener: ((event: Event) => void) | null = null;
  let keydownListener: ((event: KeyboardEvent) => void) | null = null;
  let showModalCount = 0;
  let closeCount = 0;
  let cancelRemoveCount = 0;
  let keydownRemoveCount = 0;

  const dialog = {
    get open() {
      return open;
    },
    ownerDocument: {
      addEventListener: (
        _type: 'keydown',
        listener: (event: KeyboardEvent) => void,
        _capture: true
      ) => {
        keydownListener = listener;
      },
      removeEventListener: (
        _type: 'keydown',
        listener: (event: KeyboardEvent) => void,
        _capture: true
      ) => {
        if (keydownListener === listener) keydownListener = null;
        keydownRemoveCount += 1;
      },
    },
    showModal: () => {
      showModalCount += 1;
      open = true;
      onShowModal();
    },
    close: () => {
      closeCount += 1;
      open = false;
    },
    addEventListener: (_type: 'cancel', listener: (event: Event) => void) => {
      cancelListener = listener;
    },
    removeEventListener: (_type: 'cancel', listener: (event: Event) => void) => {
      if (cancelListener === listener) cancelListener = null;
      cancelRemoveCount += 1;
    },
  };

  return {
    dialog,
    cancel: () => {
      let defaultPrevented = false;
      cancelListener?.({
        preventDefault: () => {
          defaultPrevented = true;
        },
      } as Event);
      return defaultPrevented;
    },
    keyDown: (key: string) => {
      let defaultPrevented = false;
      let propagationStopped = false;
      keydownListener?.({
        key,
        preventDefault: () => {
          defaultPrevented = true;
        },
        stopPropagation: () => {
          propagationStopped = true;
        },
      } as KeyboardEvent);
      return { defaultPrevented, propagationStopped };
    },
    counts: () => ({
      showModalCount,
      closeCount,
      cancelRemoveCount,
      keydownRemoveCount,
    }),
    hasCancelListener: () => cancelListener !== null,
    hasKeydownListener: () => keydownListener !== null,
  };
}

describe('publication modal dialog lifecycle', () => {
  test('opens modally and routes native Escape cancellation through controlled close', () => {
    const harness = createDialogHarness();
    let cancelCount = 0;
    const cleanup = activateModalDialog(harness.dialog, null, () => {
      cancelCount += 1;
    });

    expect(harness.counts().showModalCount).toBe(1);
    expect(harness.hasCancelListener()).toBe(true);
    expect(harness.hasKeydownListener()).toBe(true);
    expect(harness.cancel()).toBe(true);
    expect(cancelCount).toBe(1);

    cleanup();
    expect(harness.counts()).toEqual({
      showModalCount: 1,
      closeCount: 1,
      cancelRemoveCount: 1,
      keydownRemoveCount: 1,
    });
    expect(harness.hasCancelListener()).toBe(false);
    expect(harness.hasKeydownListener()).toBe(false);
  });

  test('uses document keydown as an Escape fallback and deduplicates native cancel', async () => {
    const harness = createDialogHarness();
    let cancelCount = 0;
    const cleanup = activateModalDialog(harness.dialog, null, () => {
      cancelCount += 1;
    });

    expect(harness.keyDown('Enter')).toEqual({
      defaultPrevented: false,
      propagationStopped: false,
    });
    expect(cancelCount).toBe(0);
    expect(harness.keyDown('Escape')).toEqual({
      defaultPrevented: true,
      propagationStopped: true,
    });
    expect(harness.cancel()).toBe(true);
    expect(cancelCount).toBe(1);

    await Promise.resolve();
    expect(harness.keyDown('Escape').defaultPrevented).toBe(true);
    expect(cancelCount).toBe(2);
    cleanup();
  });

  test('restores focus to a connected trigger only after modal cleanup', () => {
    let focusedControl = 'review-publish';
    const harness = createDialogHarness(false, () => {
      focusedControl = 'close-dialog';
    });
    let focusCount = 0;
    const trigger = {
      isConnected: true,
      focus: () => {
        focusCount += 1;
        focusedControl = 'review-publish';
      },
    };

    const cleanup = activateModalDialog(harness.dialog, trigger, () => undefined);
    expect(focusedControl).toBe('close-dialog');
    expect(focusCount).toBe(0);
    cleanup();
    expect(focusedControl).toBe('review-publish');
    expect(focusCount).toBe(1);

    const detachedHarness = createDialogHarness();
    const detachedCleanup = activateModalDialog(
      detachedHarness.dialog,
      { ...trigger, isConnected: false },
      () => undefined
    );
    detachedCleanup();
    expect(focusCount).toBe(1);
  });

  test('does not reopen an already-open modal', () => {
    const harness = createDialogHarness(true);
    const cleanup = activateModalDialog(harness.dialog, null, () => undefined);
    expect(harness.counts().showModalCount).toBe(0);
    cleanup();
  });
});
