/**
 * @ereo/client - Navigation Blocker
 *
 * Prevents navigation when the user has unsaved changes.
 * Works with both client-side navigation and browser back/forward.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { router } from './navigation';

/**
 * Blocker state.
 */
export type BlockerState = 'unblocked' | 'blocked' | 'proceeding';

/**
 * Return value from useBlocker.
 */
export interface UseBlockerReturn {
  /** Current blocker state */
  state: BlockerState;
  /** Proceed with the blocked navigation */
  proceed: () => void;
  /** Cancel the blocked navigation and stay on the current page */
  reset: () => void;
}

/**
 * Block navigation when a condition is true.
 * Useful for preventing navigation when there are unsaved changes.
 *
 * @param shouldBlock - Whether navigation should be blocked. Can be a boolean or a function returning boolean.
 * @returns Blocker state and control functions
 *
 * @example
 * ```tsx
 * function EditForm() {
 *   const [isDirty, setIsDirty] = useState(false);
 *   const blocker = useBlocker(isDirty);
 *
 *   return (
 *     <>
 *       <form onChange={() => setIsDirty(true)}>
 *         <input name="title" />
 *         <button type="submit">Save</button>
 *       </form>
 *
 *       {blocker.state === 'blocked' && (
 *         <dialog open>
 *           <p>You have unsaved changes. Leave anyway?</p>
 *           <button onClick={blocker.proceed}>Leave</button>
 *           <button onClick={blocker.reset}>Stay</button>
 *         </dialog>
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function useBlocker(shouldBlock: boolean | (() => boolean)): UseBlockerReturn {
  const [state, setState] = useState<BlockerState>('unblocked');
  const shouldBlockRef = useRef(shouldBlock);
  shouldBlockRef.current = shouldBlock;

  // Register blocker with the router
  useEffect(() => {
    // SSR-safe
    if (typeof window === 'undefined') return;

    const blockerFn = () => {
      const block = typeof shouldBlockRef.current === 'function'
        ? shouldBlockRef.current()
        : shouldBlockRef.current;
      return block;
    };

    const removeBlocker = router.addBlocker(blockerFn);

    // Listen for blocker state changes from the router
    const removeListener = router.subscribeBlocker(() => {
      if (router.pendingNavigation) {
        setState('blocked');
      } else {
        setState('unblocked');
      }
    });

    return () => {
      removeBlocker();
      removeListener();
    };
  }, []);

  // Register beforeunload for hard navigations
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const block = typeof shouldBlockRef.current === 'function'
        ? shouldBlockRef.current()
        : shouldBlockRef.current;

      if (block) {
        e.preventDefault();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const proceed = useCallback(() => {
    setState('proceeding');
    router.proceedNavigation();
  }, []);

  const reset = useCallback(() => {
    setState('unblocked');
    router.resetNavigation();
  }, []);

  return { state, proceed, reset };
}
