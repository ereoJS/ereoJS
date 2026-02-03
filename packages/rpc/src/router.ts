/**
 * Router - combines procedures into a typed API with HTTP and WebSocket support
 *
 * Usage:
 *   export const api = createRouter({
 *     users: {
 *       me: protectedProcedure.query(({ user }) => user),
 *     },
 *     posts: {
 *       list: procedure.query(() => db.post.findMany()),
 *       onCreate: procedure.subscription(async function* () {
 *         for await (const post of postCreatedEvents) {
 *           yield post;
 *         }
 *       }),
 *     },
 *   });
 */

import type {
  RouterDef,
  AnyProcedure,
  RPCRequest,
  RPCResponse,
  BaseContext,
  WSClientMessage,
  WSServerMessage,
  WSConnectionData,
  SubscriptionProcedure,
} from './types';
import { executeMiddleware } from './procedure';

/** Bun WebSocket handler type */
export interface BunWebSocketHandler<T> {
  message: (ws: BunServerWebSocket<T>, message: string | Buffer) => void | Promise<void>;
  open?: (ws: BunServerWebSocket<T>) => void | Promise<void>;
  close?: (ws: BunServerWebSocket<T>) => void | Promise<void>;
  drain?: (ws: BunServerWebSocket<T>) => void;
}

/** Bun ServerWebSocket interface (simplified) */
interface BunServerWebSocket<T> {
  data: T;
  send(message: string | Buffer): number;
  close(code?: number, reason?: string): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, message: string | Buffer): void;
  isSubscribed(topic: string): boolean;
  readonly readyState: number;
  readonly remoteAddress: string;
}

export interface Router<T extends RouterDef> {
  _def: T;
  /** HTTP request handler for queries and mutations */
  handler: (request: Request, ctx: any) => Promise<Response>;
  /** WebSocket handlers for Bun.serve() */
  websocket: BunWebSocketHandler<WSConnectionData>;
}

/**
 * Create a router from procedure definitions
 */
export function createRouter<T extends RouterDef>(def: T): Router<T> {
  return {
    _def: def,
    handler: createHttpHandler(def),
    websocket: createWebSocketHandler(def),
  };
}

/**
 * Create HTTP handler for queries and mutations
 */
function createHttpHandler(def: RouterDef) {
  return async (request: Request, ctx: any): Promise<Response> => {
    let rpcRequest: RPCRequest;

    try {
      if (request.method === 'GET') {
        const url = new URL(request.url);
        const path = url.searchParams.get('path')?.split('.') ?? [];
        const inputRaw = url.searchParams.get('input');
        rpcRequest = {
          path,
          type: 'query',
          input: inputRaw ? JSON.parse(inputRaw) : undefined,
        };
      } else {
        rpcRequest = await request.json();
      }
    } catch {
      return jsonResponse({
        ok: false,
        error: { code: 'PARSE_ERROR', message: 'Invalid RPC request' },
      }, 400);
    }

    const procedure = resolveProcedure(def, rpcRequest.path);
    if (!procedure) {
      return jsonResponse({
        ok: false,
        error: { code: 'NOT_FOUND', message: `Procedure not found: ${rpcRequest.path.join('.')}` },
      }, 404);
    }

    if (procedure._type === 'subscription') {
      return jsonResponse({
        ok: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Subscriptions must use WebSocket' },
      }, 400);
    }

    if (procedure._type !== rpcRequest.type) {
      return jsonResponse({
        ok: false,
        error: { code: 'METHOD_MISMATCH', message: `Expected ${procedure._type}, got ${rpcRequest.type}` },
      }, 400);
    }

    // Execute middleware chain
    const baseContext: BaseContext = { ctx, request };
    const middlewareResult = await executeMiddleware(procedure.middlewares, baseContext);

    if (!middlewareResult.ok) {
      return jsonResponse({ ok: false, error: middlewareResult.error }, 400);
    }

    // Validate input
    let input = rpcRequest.input;
    if (procedure.inputSchema) {
      try {
        input = procedure.inputSchema.parse(rpcRequest.input);
      } catch (error) {
        // Sanitize error details before sending to client
        const sanitizedError = sanitizeValidationError(error);
        return jsonResponse({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Input validation failed', details: sanitizedError },
        }, 400);
      }
    }

    // Execute handler
    try {
      const result = await procedure.handler({ ...middlewareResult.ctx, input });
      return jsonResponse({ ok: true, data: result });
    } catch (error) {
      if (error instanceof RPCError) {
        return jsonResponse({ ok: false, error: { code: error.code, message: error.message } }, error.status);
      }

      console.error(`RPC error [${rpcRequest.path.join('.')}]:`, error);
      return jsonResponse({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      }, 500);
    }
  };
}

/**
 * Create WebSocket handler for subscriptions
 */
function createWebSocketHandler(def: RouterDef): BunWebSocketHandler<WSConnectionData> {
  return {
    open(ws) {
      // Initialize subscription tracking
      ws.data.subscriptions = new Map();
    },

    async message(ws, message) {
      let msg: WSClientMessage;

      try {
        msg = JSON.parse(typeof message === 'string' ? message : message.toString());
      } catch {
        sendError(ws, '', 'PARSE_ERROR', 'Invalid message format');
        return;
      }

      // Handle ping/pong heartbeat
      if (msg.type === 'ping') {
        const pongMsg: WSServerMessage = { type: 'pong' };
        ws.send(JSON.stringify(pongMsg));
        return;
      }

      if (msg.type === 'subscribe') {
        await handleSubscribe(ws, def, msg);
      } else if (msg.type === 'unsubscribe') {
        handleUnsubscribe(ws, msg.id);
      }
    },

    close(ws) {
      // Abort all subscriptions on disconnect
      for (const [, controller] of ws.data.subscriptions) {
        controller.abort();
      }
      ws.data.subscriptions.clear();
    },
  };
}

/**
 * Handle subscription request
 */
async function handleSubscribe(
  ws: BunServerWebSocket<WSConnectionData>,
  def: RouterDef,
  msg: { type: 'subscribe'; id: string; path: string[]; input?: unknown }
) {
  const { id, path, input } = msg;

  // Check for duplicate subscription ID
  if (ws.data.subscriptions.has(id)) {
    sendError(ws, id, 'DUPLICATE_ID', 'Subscription ID already in use');
    return;
  }

  const procedure = resolveProcedure(def, path);
  if (!procedure) {
    sendError(ws, id, 'NOT_FOUND', `Procedure not found: ${path.join('.')}`);
    return;
  }

  if (procedure._type !== 'subscription') {
    sendError(ws, id, 'METHOD_MISMATCH', 'Procedure is not a subscription');
    return;
  }

  // Execute middleware chain - use original request if available from WebSocket upgrade
  const baseContext: BaseContext = {
    ctx: ws.data.ctx,
    request: ws.data.originalRequest ?? new Request('ws://localhost'),
  };
  const middlewareResult = await executeMiddleware(procedure.middlewares, baseContext);

  if (!middlewareResult.ok) {
    sendError(ws, id, middlewareResult.error.code, middlewareResult.error.message);
    return;
  }

  // Validate input
  let validatedInput = input;
  if (procedure.inputSchema) {
    try {
      validatedInput = procedure.inputSchema.parse(input);
    } catch {
      sendError(ws, id, 'VALIDATION_ERROR', 'Input validation failed');
      return;
    }
  }

  // Create abort controller for this subscription
  const controller = new AbortController();
  ws.data.subscriptions.set(id, controller);

  // Run the subscription generator
  const sub = procedure as SubscriptionProcedure<any, any, any>;

  try {
    const generator = sub.handler({ ...middlewareResult.ctx, input: validatedInput });

    // Async iteration with abort support
    (async () => {
      try {
        for await (const value of generator) {
          if (controller.signal.aborted) break;

          const msg: WSServerMessage = { type: 'data', id, data: value };
          ws.send(JSON.stringify(msg));
        }

        // Generator completed normally
        if (!controller.signal.aborted) {
          const msg: WSServerMessage = { type: 'complete', id };
          ws.send(JSON.stringify(msg));
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          const errorMsg = error instanceof Error ? error.message : 'Subscription error';
          sendError(ws, id, 'SUBSCRIPTION_ERROR', errorMsg);
        }
      } finally {
        ws.data.subscriptions.delete(id);
      }
    })();
  } catch (error) {
    ws.data.subscriptions.delete(id);
    const errorMsg = error instanceof Error ? error.message : 'Failed to start subscription';
    sendError(ws, id, 'SUBSCRIPTION_ERROR', errorMsg);
  }
}

/**
 * Handle unsubscribe request
 */
function handleUnsubscribe(ws: BunServerWebSocket<WSConnectionData>, id: string) {
  const controller = ws.data.subscriptions.get(id);
  if (controller) {
    controller.abort();
    ws.data.subscriptions.delete(id);
  }
}

/**
 * Send error message to WebSocket client
 */
function sendError(ws: BunServerWebSocket<WSConnectionData>, id: string, code: string, message: string) {
  const msg: WSServerMessage = { type: 'error', id, error: { code, message } };
  ws.send(JSON.stringify(msg));
}

/**
 * Sanitize validation error to prevent information leakage
 * Extracts only safe fields from Zod-like errors
 */
function sanitizeValidationError(error: unknown): unknown {
  if (error instanceof Error) {
    // Zod-style errors have issues array
    const anyError = error as any;
    if (Array.isArray(anyError.issues)) {
      return anyError.issues.map((issue: any) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
      }));
    }
    // Generic error
    return { message: error.message };
  }
  return { message: 'Validation failed' };
}

/**
 * Resolve a procedure from a path like ['users', 'me']
 */
function resolveProcedure(def: RouterDef, path: string[]): AnyProcedure | null {
  let current: RouterDef | AnyProcedure = def;

  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return null;
    }
    current = (current as RouterDef)[segment];
  }

  if (current && typeof current === 'object' && '_type' in current) {
    return current as AnyProcedure;
  }

  return null;
}

function jsonResponse(data: RPCResponse, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Custom RPC error class
 */
export class RPCError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400
  ) {
    super(message);
    this.name = 'RPCError';
  }
}

/** Common error factories */
export const errors = {
  unauthorized: (message = 'Unauthorized') => new RPCError('UNAUTHORIZED', message, 401),
  forbidden: (message = 'Forbidden') => new RPCError('FORBIDDEN', message, 403),
  notFound: (message = 'Not found') => new RPCError('NOT_FOUND', message, 404),
  badRequest: (message: string) => new RPCError('BAD_REQUEST', message, 400),
};
