/**
 * @ereo/rpc/client - Client-side exports
 *
 * Separate entry point for client bundles (tree-shaking)
 */

// Client
export { createClient } from './src/client';
export { RPCClientError } from './src/client';
export type { RPCClientOptions } from './src/client';

// Hooks
export { useQuery, useMutation, useSubscription } from './src/hooks';
export type {
  UseQueryOptions,
  UseQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UseSubscriptionOptions,
  UseSubscriptionResult,
  SubscriptionStatus,
} from './src/hooks';

// Server Functions (isomorphic — works on both client and server)
export { createServerFn, ServerFnError, SERVER_FN_BASE } from './src/server-fn';
export type {
  ServerFn,
  ServerFnOptions,
  ServerFnContext,
  ServerFnMiddleware,
  ServerFnErrorShape,
  InferServerFnInput,
  InferServerFnOutput,
} from './src/server-fn';

// Server Function Hooks
export { useServerFn } from './src/server-fn-hooks';
export type { UseServerFnOptions, UseServerFnReturn } from './src/server-fn-hooks';

// Re-export types needed for type inference
export type {
  InferClient,
  RouterDef,
  SubscriptionCallbacks,
  Unsubscribe,
} from './src/types';
