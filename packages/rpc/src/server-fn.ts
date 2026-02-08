/**
 * Server Functions - Lightweight RPC for calling server code from the client
 *
 * Unlike the procedure/router pattern, server functions are standalone functions
 * that can be defined anywhere, imported in components, and called like regular
 * functions. On the client they auto-POST to the server; on the server they
 * execute directly.
 *
 * Usage:
 *   // Define (in a shared or server file)
 *   export const getUser = createServerFn('getUser', async (id: string, ctx) => {
 *     return db.users.findUnique({ where: { id } });
 *   });
 *
 *   // Call from anywhere
 *   const user = await getUser('123');
 *
 *   // With options (validation, middleware)
 *   export const createPost = createServerFn({
 *     id: 'createPost',
 *     input: z.object({ title: z.string() }),
 *     middleware: [authMiddleware],
 *     handler: async (input, ctx) => {
 *       return db.posts.create({ data: input });
 *     },
 *   });
 */

import type { Schema, BaseContext, RPCErrorShape } from './types';

// =============================================================================
// Types
// =============================================================================

/** Context available inside server functions */
export interface ServerFnContext {
  /** The original HTTP request */
  request: Request;
  /** Response headers — set these to add headers to the response */
  responseHeaders: Headers;
  /** Application context (from @ereo/core or context provider) */
  appContext: unknown;
}

/** Middleware that runs before a server function */
export type ServerFnMiddleware = (
  ctx: ServerFnContext,
  next: () => Promise<unknown>
) => Promise<unknown>;

/** Options for createServerFn with full configuration */
export interface ServerFnOptions<TInput, TOutput> {
  /** Unique function identifier */
  id: string;
  /** Input validation schema (zod-compatible) */
  input?: Schema<TInput>;
  /** Middleware to run before the handler */
  middleware?: ServerFnMiddleware[];
  /** The function implementation */
  handler: (input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput;
  /** Skip defaultMiddleware (marks this function as publicly accessible) */
  allowPublic?: boolean;
}

/** A callable server function with metadata */
export interface ServerFn<TInput, TOutput> {
  (input: TInput): Promise<TOutput>;
  /** Unique function ID */
  readonly _id: string;
  /** HTTP endpoint for this function */
  readonly _url: string;
  /** Type brand for inference */
  readonly _input: TInput;
  readonly _output: TOutput;
}

/** Extract the input type of a server function */
export type InferServerFnInput<T> = T extends ServerFn<infer I, any> ? I : never;

/** Extract the output type of a server function */
export type InferServerFnOutput<T> = T extends ServerFn<any, infer O> ? O : never;

/** Entry in the server function registry */
export interface RegisteredServerFn {
  id: string;
  handler: (input: unknown, ctx: ServerFnContext) => Promise<unknown>;
  middleware: ServerFnMiddleware[];
  inputSchema?: Schema<unknown>;
  allowPublic?: boolean;
}

// =============================================================================
// Server Function Error
// =============================================================================

/** Error thrown by server functions with structured error data */
export class ServerFnError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: { statusCode?: number; details?: Record<string, unknown> }
  ) {
    super(message);
    this.name = 'ServerFnError';
    this.code = code;
    this.statusCode = options?.statusCode ?? 400;
    this.details = options?.details;
  }
}

/** Structured error shape returned to the client */
export interface ServerFnErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Registry (server-side singleton)
// =============================================================================

const registry = new Map<string, RegisteredServerFn>();

/** Register a server function in the global registry */
export function registerServerFn(entry: RegisteredServerFn): void {
  if (registry.has(entry.id)) {
    throw new Error(
      `Server function "${entry.id}" is already registered. Each function must have a unique ID.`
    );
  }
  registry.set(entry.id, entry);
}

/** Get a registered server function by ID */
export function getServerFn(id: string): RegisteredServerFn | undefined {
  return registry.get(id);
}

/** Get all registered server functions */
export function getAllServerFns(): ReadonlyMap<string, RegisteredServerFn> {
  return registry;
}

/** Unregister a server function */
export function unregisterServerFn(id: string): boolean {
  return registry.delete(id);
}

/** Clear all registered server functions (for testing) */
export function clearServerFnRegistry(): void {
  registry.clear();
}

// =============================================================================
// Environment Detection
// =============================================================================

const isServer =
  typeof globalThis.window === 'undefined' ||
  typeof (globalThis as any).Bun !== 'undefined';

/** Server function endpoint base path */
export const SERVER_FN_BASE = '/_server-fn';

// =============================================================================
// Client Proxy
// =============================================================================

/** @internal Exported for testing only */
export function _createClientProxy<TInput, TOutput>(id: string): ServerFn<TInput, TOutput> {
  const url = `${SERVER_FN_BASE}/${encodeURIComponent(id)}`;

  const fn = async (input: TInput): Promise<TOutput> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Ereo-RPC': '1' },
      body: JSON.stringify({ input }),
    });

    const result = await response.json();

    if (!result.ok) {
      const error = new ServerFnError(
        result.error.code,
        result.error.message,
        {
          statusCode: response.status,
          details: result.error.details,
        }
      );
      throw error;
    }

    return result.data as TOutput;
  };

  Object.defineProperties(fn, {
    _id: { value: id, writable: false, enumerable: true },
    _url: { value: url, writable: false, enumerable: true },
    _input: { value: undefined, writable: false, enumerable: false },
    _output: { value: undefined, writable: false, enumerable: false },
  });

  return fn as ServerFn<TInput, TOutput>;
}

// =============================================================================
// createServerFn - Isomorphic API
// =============================================================================

/**
 * Create a server function with just an ID and handler.
 *
 * @example
 * ```ts
 * export const getUser = createServerFn(
 *   'getUser',
 *   async (id: string, ctx) => {
 *     return db.users.findUnique({ where: { id } });
 *   }
 * );
 * ```
 */
export function createServerFn<TInput = void, TOutput = unknown>(
  id: string,
  handler: (input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput
): ServerFn<TInput, TOutput>;

/**
 * Create a server function with full options (validation, middleware).
 *
 * @example
 * ```ts
 * export const createPost = createServerFn({
 *   id: 'createPost',
 *   input: z.object({ title: z.string(), content: z.string() }),
 *   middleware: [authMiddleware],
 *   handler: async (input, ctx) => {
 *     return db.posts.create({ data: input });
 *   },
 * });
 * ```
 */
export function createServerFn<TInput, TOutput>(
  options: ServerFnOptions<TInput, TOutput>
): ServerFn<TInput, TOutput>;

export function createServerFn<TInput, TOutput>(
  idOrOptions: string | ServerFnOptions<TInput, TOutput>,
  maybeHandler?: (input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput
): ServerFn<TInput, TOutput> {
  let id: string;
  let handler: (input: TInput, ctx: ServerFnContext) => Promise<TOutput> | TOutput;
  let middleware: ServerFnMiddleware[] = [];
  let inputSchema: Schema<TInput> | undefined;
  let allowPublic: boolean | undefined;

  if (typeof idOrOptions === 'string') {
    id = idOrOptions;
    handler = maybeHandler!;
  } else {
    id = idOrOptions.id;
    handler = idOrOptions.handler;
    middleware = idOrOptions.middleware ?? [];
    inputSchema = idOrOptions.input;
    allowPublic = idOrOptions.allowPublic;
  }

  if (isServer) {
    // Server: register the function and return a direct callable
    registerServerFn({
      id,
      handler: handler as (input: unknown, ctx: ServerFnContext) => Promise<unknown>,
      middleware,
      inputSchema: inputSchema as Schema<unknown> | undefined,
      allowPublic,
    });

    const fn = async (input: TInput): Promise<TOutput> => {
      // When called directly on the server, execute with a minimal context
      const ctx: ServerFnContext = {
        request: new Request('http://localhost/_server-fn/' + id, { method: 'POST' }),
        responseHeaders: new Headers(),
        appContext: {},
      };

      // Validate input
      let validatedInput = input;
      if (inputSchema) {
        validatedInput = inputSchema.parse(input) as TInput;
      }

      // Run middleware chain
      let result: unknown;
      const chain = [...middleware];

      const runChain = async (index: number): Promise<unknown> => {
        if (index < chain.length) {
          return chain[index](ctx, () => runChain(index + 1));
        }
        return handler(validatedInput, ctx);
      };

      result = await runChain(0);
      return result as TOutput;
    };

    Object.defineProperties(fn, {
      _id: { value: id, writable: false, enumerable: true },
      _url: { value: `${SERVER_FN_BASE}/${encodeURIComponent(id)}`, writable: false, enumerable: true },
      _input: { value: undefined, writable: false, enumerable: false },
      _output: { value: undefined, writable: false, enumerable: false },
    });

    return fn as ServerFn<TInput, TOutput>;
  }

  // Client: return a proxy that POSTs to the server
  return _createClientProxy<TInput, TOutput>(id);
}
