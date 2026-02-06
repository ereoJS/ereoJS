/**
 * @ereo/client - useBeforeUnload Hook
 *
 * Registers a `beforeunload` event listener that fires when the user
 * attempts to close the tab or navigate away from the page.
 */

import { useRef, useEffect, useCallback } from 'react';

export interface UseBeforeUnloadOptions {
  /** Use capture phase for the event listener */
  capture?: boolean;
}

/**
 * Hook that registers a `beforeunload` event listener.
 * The callback ref is updated without re-registering the listener.
 *
 * @example
 * ```tsx
 * useBeforeUnload((event) => {
 *   if (hasUnsavedChanges) {
 *     event.preventDefault();
 *   }
 * });
 * ```
 */
export function useBeforeUnload(
  callback: (event: BeforeUnloadEvent) => void,
  options?: UseBeforeUnloadOptions,
): void {
  const callbackRef = useRef(callback);

  // Always keep the ref current without re-registering the listener
  callbackRef.current = callback;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = (event: BeforeUnloadEvent) => {
      callbackRef.current(event);
    };

    const capture = options?.capture ?? false;

    window.addEventListener('beforeunload', handler, { capture });
    return () => {
      window.removeEventListener('beforeunload', handler, { capture });
    };
  }, [options?.capture]);
}
