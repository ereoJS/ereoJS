/**
 * React hooks for server functions
 *
 * Usage:
 *   import { useServerFn } from '@ereo/rpc/client';
 *   import { getUser } from '../server-fns/users';
 *
 *   function UserProfile({ id }) {
 *     const { execute, data, isPending, error } = useServerFn(getUser);
 *
 *     useEffect(() => { execute(id); }, [id, execute]);
 *
 *     if (isPending) return <Loading />;
 *     if (error) return <Error error={error} />;
 *     return <Profile user={data} />;
 *   }
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ServerFn, ServerFnErrorShape } from './server-fn';

// =============================================================================
// Types
// =============================================================================

export interface UseServerFnOptions<TOutput> {
  /** Called on successful execution */
  onSuccess?: (data: TOutput) => void;
  /** Called when an error occurs */
  onError?: (error: ServerFnErrorShape) => void;
  /** Called after execution completes (success or error) */
  onSettled?: () => void;
}

export interface UseServerFnReturn<TInput, TOutput> {
  /** Call the server function */
  execute: (input: TInput) => Promise<TOutput>;
  /** Most recent successful result */
  data: TOutput | undefined;
  /** Most recent error */
  error: ServerFnErrorShape | undefined;
  /** Whether a call is currently in flight */
  isPending: boolean;
  /** Whether the last call was successful */
  isSuccess: boolean;
  /** Whether the last call resulted in an error */
  isError: boolean;
  /** Reset state to initial values */
  reset: () => void;
}

// =============================================================================
// useServerFn Hook
// =============================================================================

/**
 * React hook for calling server functions with loading/error state management.
 *
 * Handles:
 * - Loading state tracking
 * - Error capture and formatting
 * - Automatic abort of stale requests (last-write-wins)
 * - Cleanup on unmount
 *
 * @example
 * ```tsx
 * const { execute, data, isPending, error } = useServerFn(getUser);
 *
 * // Call imperatively
 * const handleClick = () => execute(userId);
 *
 * // Or in an effect
 * useEffect(() => { execute(userId); }, [userId, execute]);
 * ```
 */
export function useServerFn<TInput, TOutput>(
  fn: ServerFn<TInput, TOutput>,
  options: UseServerFnOptions<TOutput> = {}
): UseServerFnReturn<TInput, TOutput> {
  const [data, setData] = useState<TOutput | undefined>(undefined);
  const [error, setError] = useState<ServerFnErrorShape | undefined>(undefined);
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');

  // Use refs for fn and callbacks to keep execute stable across re-renders.
  // This prevents infinite re-render loops when fn is a Proxy (RPC client)
  // that creates new references each render.
  const fnRef = useRef(fn);
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  const onSettledRef = useRef(options.onSettled);

  // Update refs on every render
  fnRef.current = fn;
  onSuccessRef.current = options.onSuccess;
  onErrorRef.current = options.onError;
  onSettledRef.current = options.onSettled;

  // Track the latest request to implement last-write-wins
  const requestIdRef = useRef(0);
  // Track mount state to avoid setState on unmounted component
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (input: TInput): Promise<TOutput> => {
      const currentId = ++requestIdRef.current;

      if (mountedRef.current) {
        setStatus('pending');
        setError(undefined);
      }

      try {
        const result = await fnRef.current(input);

        // Only update state if this is still the latest request
        if (currentId === requestIdRef.current && mountedRef.current) {
          setData(result);
          setStatus('success');
          onSuccessRef.current?.(result);
        }

        return result;
      } catch (err: unknown) {
        const errorShape = toErrorShape(err);

        if (currentId === requestIdRef.current && mountedRef.current) {
          setError(errorShape);
          setData(undefined);
          setStatus('error');
          onErrorRef.current?.(errorShape);
        }

        throw err;
      } finally {
        if (currentId === requestIdRef.current && mountedRef.current) {
          onSettledRef.current?.();
        }
      }
    },
    [] // Stable: no deps since we read from refs
  );

  const reset = useCallback(() => {
    requestIdRef.current++;
    setData(undefined);
    setError(undefined);
    setStatus('idle');
  }, []);

  return {
    execute,
    data,
    error,
    isPending: status === 'pending',
    isSuccess: status === 'success',
    isError: status === 'error',
    reset,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function toErrorShape(err: unknown): ServerFnErrorShape {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    'message' in err
  ) {
    const e = err as { code: string; message: string; details?: Record<string, unknown> };
    return {
      code: e.code,
      message: e.message,
      ...(e.details ? { details: e.details } : {}),
    };
  }

  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message };
  }

  return { code: 'UNKNOWN', message: String(err) };
}
