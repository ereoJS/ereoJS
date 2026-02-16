/**
 * @ereo/rpc - Typed RPC layer for EreoJS
 *
 * Server-side exports for defining routers and procedures
 */

// Procedure builder (main API)
export { procedure, executeMiddleware } from './procedure';
export type { ProcedureBuilder } from './procedure';

// Legacy procedure builders (deprecated but kept for compatibility)
export { query, mutation, subscription } from './procedure';

// Router
export { createRouter, RPCError, errors } from './router';
export type { Router, BunWebSocketHandler } from './router';

// Plugin
export { rpcPlugin } from './plugin';
export type { RPCPluginOptions, RPCPluginResult, BunWebSocketConfig, RPCPlugin } from './plugin';

export {
  setContextProvider,
  getContextProvider,
  clearContextProvider,
  createSharedContext,
  createContextProvider,
  withSharedContext,
  useSharedContext,
} from './context-bridge';
export type {
  ContextProvider,
  RouterWithContextOptions,
  ContextBridgeConfig,
} from './context-bridge';

// Middleware helpers
export {
  logging,
  rateLimit,
  clearRateLimitStore,
  createAuthMiddleware,
  requireRoles,
  validate,
  extend,
  timing,
  catchErrors,
} from './middleware';
export type { LoggingOptions, RateLimitOptions, TimingContext } from './middleware';

// Server Functions
export {
  createServerFn,
  ServerFnError,
  registerServerFn,
  getServerFn,
  getAllServerFns,
  unregisterServerFn,
  clearServerFnRegistry,
  SERVER_FN_BASE,
} from './server-fn';
export type {
  ServerFn,
  ServerFnOptions,
  ServerFnContext,
  ServerFnMiddleware,
  ServerFnErrorShape,
  RegisteredServerFn,
  InferServerFnInput,
  InferServerFnOutput,
} from './server-fn';

// Server Function Handler
export { createServerFnHandler } from './server-fn-handler';
export type { ServerFnHandlerOptions, ServerFnRequestHandler } from './server-fn-handler';

// Server Block (server$ + createServerBlock)
export {
  server$,
  createServerBlock,
  parseWindow,
  buildRateLimitMiddleware,
  buildCacheMiddleware,
  buildCorsMiddleware,
  buildAuthMiddleware,
  compileConfigMiddleware,
  clearServerFnRateLimitStore,
} from './server-block';
export type {
  ServerFnConfig,
  ServerFnRateLimitConfig,
  ServerFnCacheConfig,
  ServerFnCorsConfig,
  ServerFnAuthConfig,
} from './server-block';

// Types
export type {
  // Schema
  Schema,

  // Context
  BaseContext,
  ExtendedContext,

  // Middleware
  MiddlewareFn,
  MiddlewareDef,
  MiddlewareResult,

  // Procedures
  ProcedureType,
  ProcedureDef,
  QueryProcedure,
  MutationProcedure,
  SubscriptionProcedure,
  SubscriptionYield,
  AnyProcedure,

  // Router
  RouterDef,

  // Client inference
  InferClient,
  SubscriptionCallbacks,
  Unsubscribe,

  // Protocol
  RPCRequest,
  RPCResponse,
  RPCErrorShape,
  WSClientMessage,
  WSServerMessage,
  WSConnectionData,
} from './types';
