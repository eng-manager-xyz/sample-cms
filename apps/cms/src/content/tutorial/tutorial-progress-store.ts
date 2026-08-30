import { useSyncExternalStore } from 'react';
import {
  createTutorialProgress,
  parseTutorialProgress,
  serializeTutorialProgress,
  type TutorialProgress,
} from './tutorial-srs';

export const TUTORIAL_PROGRESS_STORAGE_KEY = 'auteur:tutorial-learning:v1';

const serverProgress = createTutorialProgress();
let browserProgress = serverProgress;
let browserProgressLoaded = false;
const listeners = new Set<() => void>();

function loadBrowserProgress(): TutorialProgress {
  if (typeof window === 'undefined') return serverProgress;
  if (browserProgressLoaded) return browserProgress;

  browserProgressLoaded = true;
  try {
    browserProgress = parseTutorialProgress(
      window.localStorage.getItem(TUTORIAL_PROGRESS_STORAGE_KEY)
    );
  } catch {
    browserProgress = createTutorialProgress();
  }
  return browserProgress;
}

function emitProgressChange(): void {
  for (const listener of listeners) listener();
}

function subscribeToTutorialProgress(listener: () => void): () => void {
  listeners.add(listener);

  function handleStorage(event: StorageEvent): void {
    if (event.key !== TUTORIAL_PROGRESS_STORAGE_KEY) return;
    try {
      browserProgress = parseTutorialProgress(event.newValue);
    } catch {
      browserProgress = createTutorialProgress();
    }
    browserProgressLoaded = true;
    emitProgressChange();
  }

  if (typeof window !== 'undefined') window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', handleStorage);
  };
}

function getTutorialProgressSnapshot(): TutorialProgress {
  return loadBrowserProgress();
}

function getTutorialProgressServerSnapshot(): TutorialProgress {
  return serverProgress;
}

export function useTutorialProgress(): TutorialProgress {
  return useSyncExternalStore(
    subscribeToTutorialProgress,
    getTutorialProgressSnapshot,
    getTutorialProgressServerSnapshot
  );
}

export function updateTutorialProgress(
  update: (progress: TutorialProgress) => TutorialProgress
): void {
  browserProgress = parseTutorialProgress(update(loadBrowserProgress()));
  browserProgressLoaded = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        TUTORIAL_PROGRESS_STORAGE_KEY,
        serializeTutorialProgress(browserProgress)
      );
    } catch {
      // Memory state still keeps this study session functional when storage is unavailable.
    }
  }
  emitProgressChange();
}

export function resetTutorialProgress(): void {
  browserProgress = createTutorialProgress();
  browserProgressLoaded = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(TUTORIAL_PROGRESS_STORAGE_KEY);
    } catch {
      // The in-memory reset still succeeds when storage is unavailable.
    }
  }
  emitProgressChange();
}
