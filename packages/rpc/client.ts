/**
 * @ereo/rpc/client - Client-side exports
 *
 * Separate entry point for client bundles (tree-shaking)
 */

// Client
export { createClient } from './src/client';
export type { RPCClientOptions, RPCClientError } from './src/client';

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

// Re-export types needed for type inference
export type {
  InferClient,
  RouterDef,
  SubscriptionCallbacks,
  Unsubscribe,
} from './src/types';
