/**
 * @ereo/rpc - Typed RPC layer for EreoJS
 *
 * Core type definitions for end-to-end type inference
 */

// =============================================================================
// Schema
// =============================================================================

/** Schema interface (Zod-compatible but not Zod-dependent) */
export interface Schema<T> {
  parse(data: unknown): T;
  safeParse?(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

// =============================================================================
// Context
// =============================================================================

/** Base context available to all procedures */
export interface BaseContext {
  /** Application context (from @ereo/core) */
  ctx: any;
  /** The original HTTP request */
  request: Request;
}

/** Extended context after middleware runs */
export type ExtendedContext<TBase, TExtension> = TBase & TExtension;

// =============================================================================
// Middleware
// =============================================================================

/** Result of middleware execution */
export type MiddlewareResult<TContext> =
  | { ok: true; ctx: TContext }
  | { ok: false; error: RPCErrorShape };

/** Middleware function signature */
export type MiddlewareFn<TContextIn, TContextOut> = (opts: {
  ctx: TContextIn;
  next: <T>(ctx: T) => MiddlewareResult<T>;
}) => MiddlewareResult<TContextOut> | Promise<MiddlewareResult<TContextOut>>;

/** Middleware definition stored on procedure builder */
export interface MiddlewareDef<TContextIn, TContextOut> {
  fn: MiddlewareFn<TContextIn, TContextOut>;
}

// =============================================================================
// Procedures
// =============================================================================

export type ProcedureType = 'query' | 'mutation' | 'subscription';

/** Base procedure definition */
export interface ProcedureDef<TContext, TInput, TOutput> {
  _type: ProcedureType;
  _ctx: TContext;
  _input: TInput;
  _output: TOutput;
  middlewares: MiddlewareDef<any, any>[];
  inputSchema?: Schema<TInput>;
  handler: (args: TContext & { input: TInput }) => TOutput | Promise<TOutput>;
}

/** Query procedure */
export interface QueryProcedure<TContext, TInput, TOutput> extends ProcedureDef<TContext, TInput, TOutput> {
  _type: 'query';
}

/** Mutation procedure */
export interface MutationProcedure<TContext, TInput, TOutput> extends ProcedureDef<TContext, TInput, TOutput> {
  _type: 'mutation';
}

/** Subscription yield type */
export type SubscriptionYield<T> = AsyncGenerator<T, void, unknown>;

/** Subscription procedure */
export interface SubscriptionProcedure<TContext, TInput, TOutput> {
  _type: 'subscription';
  _ctx: TContext;
  _input: TInput;
  _output: TOutput;
  middlewares: MiddlewareDef<any, any>[];
  inputSchema?: Schema<TInput>;
  handler: (args: TContext & { input: TInput }) => SubscriptionYield<TOutput>;
}

export type AnyProcedure =
  | QueryProcedure<any, any, any>
  | MutationProcedure<any, any, any>
  | SubscriptionProcedure<any, any, any>;

// =============================================================================
// Router
// =============================================================================

/** Router definition - nested object of procedures */
export type RouterDef = {
  [key: string]: AnyProcedure | RouterDef;
};

/** Router instance */
export interface Router<T extends RouterDef> {
  _def: T;
  handler: (request: Request, ctx: any) => Promise<Response>;
  websocket: any;
}

// =============================================================================
// Client type inference
// =============================================================================

/** Infer client type from router definition */
export type InferClient<T extends RouterDef> = {
  [K in keyof T]: T[K] extends QueryProcedure<any, infer TInput, infer TOutput>
    ? TInput extends void
      ? { query: () => Promise<TOutput> }
      : { query: (input: TInput) => Promise<TOutput> }
    : T[K] extends MutationProcedure<any, infer TInput, infer TOutput>
      ? TInput extends void
        ? { mutate: () => Promise<TOutput> }
        : { mutate: (input: TInput) => Promise<TOutput> }
      : T[K] extends SubscriptionProcedure<any, infer TInput, infer TOutput>
        ? TInput extends void
          ? { subscribe: (callbacks: SubscriptionCallbacks<TOutput>) => Unsubscribe }
          : { subscribe: (input: TInput, callbacks: SubscriptionCallbacks<TOutput>) => Unsubscribe }
        : T[K] extends RouterDef
          ? InferClient<T[K]>
          : never;
};

/** Subscription callbacks */
export interface SubscriptionCallbacks<T> {
  onData: (data: T) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/** Unsubscribe function */
export type Unsubscribe = () => void;

// =============================================================================
// Protocol
// =============================================================================

/** RPC request over HTTP */
export interface RPCRequest {
  path: string[];
  type: 'query' | 'mutation';
  input?: unknown;
}

/** WebSocket message types */
export type WSClientMessage =
  | { type: 'subscribe'; id: string; path: string[]; input?: unknown }
  | { type: 'unsubscribe'; id: string }
  | { type: 'ping' };

export type WSServerMessage =
  | { type: 'data'; id: string; data: unknown }
  | { type: 'error'; id: string; error: RPCErrorShape }
  | { type: 'complete'; id: string }
  | { type: 'pong' };

/** RPC error shape */
export interface RPCErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

/** RPC response */
export type RPCResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: RPCErrorShape };

// =============================================================================
// WebSocket state
// =============================================================================

/** Per-connection WebSocket data */
export interface WSConnectionData {
  subscriptions: Map<string, AbortController>;
  ctx: any;
  /** Original HTTP request that initiated the WebSocket upgrade */
  originalRequest?: Request;
}
