/**
 * React hooks for RPC calls including subscriptions
 *
 * Usage:
 *   const { data, isLoading } = useQuery(rpc.users.me);
 *   const { mutate, isPending } = useMutation(rpc.posts.create);
 *   const { data, status } = useSubscription(rpc.posts.onCreate);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SubscriptionCallbacks, Unsubscribe } from './types';

// =============================================================================
// Query Hook
// =============================================================================

type QueryFn<TInput, TOutput> = TInput extends void
  ? { query: () => Promise<TOutput> }
  : { query: (input: TInput) => Promise<TOutput> };

export interface UseQueryOptions<TInput> {
  input?: TInput;
  enabled?: boolean;
  refetchInterval?: number;
}

export interface UseQueryResult<TOutput> {
  data: TOutput | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: () => Promise<void>;
}

export function useQuery<TInput, TOutput>(
  procedure: QueryFn<TInput, TOutput>,
  options: UseQueryOptions<TInput> = {}
): UseQueryResult<TOutput> {
  const { input, enabled = true, refetchInterval } = options;

  const [data, setData] = useState<TOutput | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(enabled);

  const inputRef = useRef(input);
  inputRef.current = input;

  // Serialize input for structural equality comparison in dependency arrays.
  // This ensures re-fetch when input changes structurally, not on every render.
  const inputKey = JSON.stringify(input);

  // Use ref for procedure to avoid infinite re-fetching.
  // The RPC client uses Proxy objects that create new references on each property access.
  const procedureRef = useRef(procedure);
  procedureRef.current = procedure;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(undefined);

    try {
      const result = await (procedureRef.current as any).query(inputRef.current);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, inputKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!refetchInterval || !enabled) return;
    const interval = setInterval(fetchData, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, fetchData, enabled]);

  return {
    data,
    error,
    isLoading,
    isError: error !== undefined,
    isSuccess: data !== undefined && error === undefined,
    refetch: fetchData,
  };
}

// =============================================================================
// Mutation Hook
// =============================================================================

type MutationFn<TInput, TOutput> = TInput extends void
  ? { mutate: () => Promise<TOutput> }
  : { mutate: (input: TInput) => Promise<TOutput> };

export interface UseMutationOptions<TOutput> {
  onSuccess?: (data: TOutput) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

export interface UseMutationResult<TInput, TOutput> {
  mutate: TInput extends void ? () => void : (input: TInput) => void;
  mutateAsync: TInput extends void ? () => Promise<TOutput> : (input: TInput) => Promise<TOutput>;
  data: TOutput | undefined;
  error: Error | undefined;
  isPending: boolean;
  isError: boolean;
  isSuccess: boolean;
  reset: () => void;
}

export function useMutation<TInput, TOutput>(
  procedure: MutationFn<TInput, TOutput>,
  options: UseMutationOptions<TOutput> = {}
): UseMutationResult<TInput, TOutput> {
  const { onSuccess, onError, onSettled } = options;

  const [data, setData] = useState<TOutput | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Use refs for procedure and callbacks to avoid re-creating mutateAsync on every render.
  // The RPC client uses Proxy objects that create new references on each property access.
  const procedureRef = useRef(procedure);
  procedureRef.current = procedure;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  const mutateAsync = useCallback(
    async (input?: TInput): Promise<TOutput> => {
      setIsPending(true);
      setError(undefined);
      setIsSuccess(false);

      try {
        const result = await (procedureRef.current as any).mutate(input);
        setData(result);
        setIsSuccess(true);
        onSuccessRef.current?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onErrorRef.current?.(error);
        throw error;
      } finally {
        setIsPending(false);
        onSettledRef.current?.();
      }
    },
    []
  );

  const mutate = useCallback(
    (input?: TInput) => {
      mutateAsync(input).catch(() => {});
    },
    [mutateAsync]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(undefined);
    setIsPending(false);
    setIsSuccess(false);
  }, []);

  return {
    mutate: mutate as any,
    mutateAsync: mutateAsync as any,
    data,
    error,
    isPending,
    isError: error !== undefined,
    isSuccess,
    reset,
  };
}

// =============================================================================
// Subscription Hook
// =============================================================================

type SubscribeFn<TInput, TOutput> = TInput extends void
  ? { subscribe: (callbacks: SubscriptionCallbacks<TOutput>) => Unsubscribe }
  : { subscribe: (input: TInput, callbacks: SubscriptionCallbacks<TOutput>) => Unsubscribe };

export type SubscriptionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export interface UseSubscriptionOptions<TInput> {
  input?: TInput;
  enabled?: boolean;
  onData?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export interface UseSubscriptionResult<TOutput> {
  /** Most recent data received */
  data: TOutput | undefined;
  /** All data received (for accumulating results) */
  history: TOutput[];
  /** Current error if any */
  error: Error | undefined;
  /** Connection status */
  status: SubscriptionStatus;
  /** Whether currently receiving data */
  isActive: boolean;
  /** Manually unsubscribe */
  unsubscribe: () => void;
  /** Resubscribe after unsubscribing */
  resubscribe: () => void;
}

export function useSubscription<TInput, TOutput>(
  procedure: SubscribeFn<TInput, TOutput>,
  options: UseSubscriptionOptions<TInput> = {}
): UseSubscriptionResult<TOutput> {
  const { input, enabled = true, onData, onError } = options;

  const [data, setData] = useState<TOutput | undefined>(undefined);
  const [history, setHistory] = useState<TOutput[]>([]);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [status, setStatus] = useState<SubscriptionStatus>('idle');

  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  // Serialize input for structural equality comparison in dependency arrays.
  const inputKey = JSON.stringify(input);

  // Use refs for procedure and callbacks to avoid re-subscribing on every render.
  // The RPC client uses Proxy objects that create new references on each property access,
  // so we must not include procedure in useCallback/useEffect dependency arrays.
  const procedureRef = useRef(procedure);
  procedureRef.current = procedure;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const subscribe = useCallback(() => {
    if (!enabled) return;

    setStatus('connecting');
    setError(undefined);

    const callbacks: SubscriptionCallbacks<TOutput> = {
      onData: (value) => {
        setStatus('connected');
        setData(value);
        setHistory((prev) => {
          const next = [...prev, value];
          // Cap history at 1000 entries to prevent unbounded memory growth
          return next.length > 1000 ? next.slice(-1000) : next;
        });
        onDataRef.current?.(value);
      },
      onError: (err) => {
        setStatus('error');
        setError(err);
        onErrorRef.current?.(err);
      },
      onComplete: () => {
        setStatus('closed');
      },
    };

    // Handle both input and no-input cases
    if (inputRef.current !== undefined) {
      unsubscribeRef.current = (procedureRef.current as any).subscribe(inputRef.current, callbacks);
    } else {
      unsubscribeRef.current = (procedureRef.current as any).subscribe(callbacks);
    }
  }, [enabled, inputKey]);

  const unsubscribe = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    setStatus('closed');
  }, []);

  const resubscribe = useCallback(() => {
    unsubscribe();
    setHistory([]);
    subscribe();
  }, [subscribe, unsubscribe]);

  // Subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    subscribe();
    return () => {
      unsubscribeRef.current?.();
    };
  }, [subscribe]);

  return {
    data,
    history,
    error,
    status,
    isActive: status === 'connecting' || status === 'connected',
    unsubscribe,
    resubscribe,
  };
}
