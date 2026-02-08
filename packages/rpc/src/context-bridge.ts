/**
 * @ereo/rpc - Context Bridge for RPC and Loaders/Actions
 *
 * Provides shared context between RPC procedures and route loaders/actions.
 * This allows auth state, database connections, and other context to be
 * shared seamlessly between the two patterns.
 */

import type { BaseContext } from './types';

/**
 * Context provider function - creates shared context from a request
 * This is used by both RPC handlers and route loaders/actions
 */
export type ContextProvider<TContext = any> = (request: Request) => TContext | Promise<TContext>;

/**
 * Global context provider registry
 */
let globalContextProvider: ContextProvider | null = null;

/**
 * Set the global context provider that will be used by both RPC and loaders.
 *
 * **Important:** The provider must be a stateless factory function that creates
 * a fresh context object for each request. Do not return shared/mutable objects
 * across requests, as this can lead to cross-request data leakage.
 *
 * Usage in your app setup:
 *   import { setContextProvider } from '@ereo/rpc';
 *
 *   setContextProvider(async (request) => {
 *     const session = await getSession(request);
 *     const db = createDbConnection();
 *     return { session, db, user: session?.user };
 *   });
 */
export function setContextProvider<TContext>(provider: ContextProvider<TContext>): void {
  globalContextProvider = provider as ContextProvider;
}

/**
 * Get the current global context provider
 */
export function getContextProvider(): ContextProvider | null {
  return globalContextProvider;
}

/**
 * Clear the global context provider (useful for testing)
 */
export function clearContextProvider(): void {
  globalContextProvider = null;
}

/** Last context reference for dev-mode same-reference detection */
let _lastContextRef: WeakRef<object> | null = null;

/**
 * Create context from a request using the global provider
 * Falls back to an empty object if no provider is set
 */
export async function createSharedContext(request: Request): Promise<any> {
  if (globalContextProvider) {
    const ctx = await globalContextProvider(request);

    // Dev-mode: warn if the provider returns the same object reference
    if (
      typeof ctx === 'object' &&
      ctx !== null &&
      typeof process !== 'undefined' &&
      process.env?.NODE_ENV !== 'production'
    ) {
      if (_lastContextRef && _lastContextRef.deref() === ctx) {
        console.warn(
          '[@ereo/rpc] Context provider returned the same object reference for consecutive calls. ' +
            'This may cause cross-request data leakage. Providers should return a fresh object per request.'
        );
      }
      _lastContextRef = new WeakRef(ctx);
    }

    return ctx;
  }
  return {};
}

/**
 * RPC Router options with context bridge support
 */
export interface RouterWithContextOptions<TContext> {
  /** Context provider for this router */
  context?: ContextProvider<TContext>;
}

/**
 * Enhanced router creation that supports context bridge
 * This is an alternative to createRouter that provides better integration
 */
export interface ContextBridgeConfig<TContext> {
  /** Context provider - called for each request */
  context: ContextProvider<TContext>;
}

/**
 * Helper to create a typed context provider
 * Provides better type inference for TypeScript users
 */
export function createContextProvider<TContext>(
  provider: ContextProvider<TContext>
): ContextProvider<TContext> {
  return provider;
}

/**
 * Middleware that injects shared context into the procedure context
 * Usage: procedure.use(withSharedContext())
 */
export function withSharedContext(): (opts: {
  ctx: BaseContext;
  next: <T>(ctx: T) => { ok: true; ctx: T } | { ok: false; error: any };
}) => Promise<any> {
  return async ({ ctx, next }) => {
    const sharedCtx = await createSharedContext(ctx.request);
    // Merge shared context with ctx.ctx (application context), not the entire BaseContext
    return next({ ...ctx, ctx: { ...ctx.ctx, ...sharedCtx } });
  };
}

/**
 * Hook for React components to access shared context
 * This bridges server context to the client
 */
export function useSharedContext<T>(): T | null {
  // This would be implemented with React context
  // For now, it's a placeholder for the concept
  if (typeof window !== 'undefined') {
    // @ts-ignore - Access from window for hydration
    return window.__EREO_SHARED_CONTEXT__ ?? null;
  }
  return null;
}
