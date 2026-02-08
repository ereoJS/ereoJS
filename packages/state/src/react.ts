/**
 * @ereo/state - React Integration
 *
 * useSyncExternalStore wrappers for signals to ensure React Compiler compatibility.
 */

import { useSyncExternalStore, useCallback, useRef } from 'react';
import type { Signal, Store } from './signals';

/**
 * Hook to use a signal value with React's useSyncExternalStore.
 * This makes signals compatible with React Compiler.
 *
 * @example
 * ```tsx
 * const count = signal(0);
 *
 * function Counter() {
 *   const value = useSignal(count);
 *   return <button>{value}</button>;
 * }
 * ```
 */
export function useSignal<T>(signal: Signal<T>): T {
  return useSyncExternalStore(
    useCallback((callback) => signal.subscribe(callback), [signal]),
    () => signal.get(),
    () => signal.get()
  );
}

/**
 * Hook to use a single key from a store with React's useSyncExternalStore.
 * Only re-renders when the specific key changes.
 *
 * @example
 * ```tsx
 * const store = createStore({ count: 0, name: 'test' });
 *
 * function Counter() {
 *   const count = useStoreKey(store, 'count');
 *   return <button>{count}</button>;
 * }
 * ```
 */
export function useStoreKey<T extends Record<string, unknown>, K extends keyof T>(
  store: Store<T>,
  key: K
): T[K] {
  const signal = store.get(key);
  return useSignal(signal);
}

/**
 * Hook to use the entire store snapshot with React's useSyncExternalStore.
 * Re-renders when any key in the store changes.
 *
 * @example
 * ```tsx
 * const store = createStore({ count: 0, name: 'test' });
 *
 * function App() {
 *   const state = useStore(store);
 *   return <div>{state.count} - {state.name}</div>;
 * }
 * ```
 */
export function useStore<T extends Record<string, unknown>>(store: Store<T>): T {
  const cachedSnapshot = useRef<T | null>(null);

  return useSyncExternalStore(
    useCallback((callback) => {
      return store.subscribe(() => {
        cachedSnapshot.current = null; // invalidate cache
        callback();
      });
    }, [store]),
    () => {
      if (cachedSnapshot.current === null) {
        cachedSnapshot.current = store.getSnapshot();
      }
      return cachedSnapshot.current;
    },
    () => {
      if (cachedSnapshot.current === null) {
        cachedSnapshot.current = store.getSnapshot();
      }
      return cachedSnapshot.current;
    }
  );
}
