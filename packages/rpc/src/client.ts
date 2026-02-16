/**
 * Client - typed proxy for calling RPC procedures with WebSocket subscriptions
 *
 * Usage:
 *   import { createClient } from '@ereo/rpc/client';
 *   import type { Api } from './api/router';
 *
 *   const rpc = createClient<Api>({
 *     httpEndpoint: '/api/rpc',
 *     wsEndpoint: 'ws://localhost:3000/api/rpc',
 *   });
 *
 *   // Queries and mutations
 *   const user = await rpc.users.me.query();
 *   const post = await rpc.posts.create.mutate({ title: 'Hello' });
 *
 *   // Subscriptions with auto-reconnect
 *   const unsub = rpc.posts.onCreate.subscribe({
 *     onData: (post) => console.log('New post:', post),
 *     onError: (err) => console.error(err),
 *   });
 */

import type {
  Router,
  RouterDef,
  InferClient,
  RPCResponse,
  WSClientMessage,
  WSServerMessage,
  SubscriptionCallbacks,
  Unsubscribe,
} from './types';

export interface RPCClientOptions {
  /** HTTP endpoint for queries/mutations (e.g., '/api/rpc') */
  httpEndpoint: string;
  /** WebSocket endpoint for subscriptions (e.g., 'ws://localhost:3000/api/rpc') */
  wsEndpoint?: string;
  /** Custom fetch function */
  fetch?: typeof fetch;
  /** Custom headers */
  headers?: Record<string, string> | (() => Record<string, string>);
  /** WebSocket reconnect options */
  reconnect?: {
    enabled?: boolean;
    maxAttempts?: number;
    delayMs?: number;
    maxDelayMs?: number;
  };
  /** Use POST for all requests (queries and mutations) instead of GET for queries */
  usePostForQueries?: boolean;
  /** WebSocket heartbeat interval in milliseconds (default: 30000) */
  heartbeatInterval?: number;
  /** Enable WebSocket heartbeat (default: true) */
  heartbeatEnabled?: boolean;
}

interface ActiveSubscription {
  path: string[];
  input?: unknown;
  callbacks: SubscriptionCallbacks<unknown>;
}

/**
 * Create a typed client from a router type
 */
export function createClient<T extends Router<RouterDef>>(
  optionsOrEndpoint: string | RPCClientOptions
): InferClient<T['_def']> {
  const options: RPCClientOptions =
    typeof optionsOrEndpoint === 'string'
      ? { httpEndpoint: optionsOrEndpoint }
      : optionsOrEndpoint;

  const fetchFn = options.fetch ?? fetch;
  const reconnectOpts = {
    enabled: true,
    maxAttempts: 10,
    delayMs: 1000,
    maxDelayMs: 30000,
    ...options.reconnect,
  };
  const heartbeatOpts = {
    enabled: options.heartbeatEnabled !== false,
    interval: options.heartbeatInterval ?? 30000,
  };

  // WebSocket state
  let ws: WebSocket | null = null;
  let wsConnecting = false;
  let wsConnected = false;
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let missedPongs = 0;
  const subscriptions = new Map<string, ActiveSubscription>();
  const pendingSubscriptions: Array<{ id: string; sub: ActiveSubscription }> = [];
  // Promise-based queue for connection requests
  const connectionQueue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];

  function getHeaders(): Record<string, string> {
    const base: Record<string, string> = { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1' };
    const custom = typeof options.headers === 'function'
      ? options.headers()
      : options.headers;
    return { ...base, ...custom };
  }

  function generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ==========================================================================
  // WebSocket management
  // ==========================================================================

  function connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!options.wsEndpoint) {
        reject(new Error('WebSocket endpoint not configured'));
        return;
      }

      if (wsConnected) {
        resolve();
        return;
      }

      // Add to queue if already connecting
      if (wsConnecting) {
        connectionQueue.push({ resolve, reject });
        return;
      }

      wsConnecting = true;
      startConnection(resolve, reject);
    });
  }

  function startConnection(initialResolve: () => void, initialReject: (err: Error) => void): void {
    // Queue the initial request
    connectionQueue.push({ resolve: initialResolve, reject: initialReject });

    try {
      ws = new WebSocket(options.wsEndpoint!);

      ws.onopen = () => {
        wsConnecting = false;
        wsConnected = true;
        reconnectAttempts = 0;
        missedPongs = 0;

        // Start heartbeat
        startHeartbeat();

        // Process all queued connection requests
        while (connectionQueue.length > 0) {
          const { resolve } = connectionQueue.shift()!;
          resolve();
        }

        // Resubscribe to existing subscriptions
        for (const [id, sub] of subscriptions) {
          sendSubscribe(id, sub.path, sub.input);
        }

        // Process pending subscriptions
        while (pendingSubscriptions.length > 0) {
          const pending = pendingSubscriptions.shift()!;
          subscriptions.set(pending.id, pending.sub);
          sendSubscribe(pending.id, pending.sub.path, pending.sub.input);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSServerMessage = JSON.parse(event.data);

          // Handle pong response
          if (msg.type === 'pong') {
            missedPongs = 0;
            return;
          }

          handleServerMessage(msg);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        stopHeartbeat();
        wsConnecting = false;
        wsConnected = false;
        ws = null;

        // Reject all queued connection requests
        while (connectionQueue.length > 0) {
          const { reject } = connectionQueue.shift()!;
          reject(new Error('WebSocket connection closed'));
        }

        // Attempt reconnection
        if (reconnectOpts.enabled && subscriptions.size > 0) {
          scheduleReconnect();
        }
      };
    } catch (error) {
      wsConnecting = false;
      // Reject all queued requests
      while (connectionQueue.length > 0) {
        const { reject } = connectionQueue.shift()!;
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  function startHeartbeat() {
    if (!heartbeatOpts.enabled) return;

    heartbeatInterval = setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        stopHeartbeat();
        return;
      }

      // Check for missed pongs
      if (missedPongs >= 2) {
        console.warn('WebSocket heartbeat failed, closing connection');
        ws.close();
        return;
      }

      // Send ping
      missedPongs++;
      ws.send(JSON.stringify({ type: 'ping' }));
    }, heartbeatOpts.interval);
  }

  function stopHeartbeat() {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    missedPongs = 0;
  }

  function scheduleReconnect() {
    if (reconnectTimeout) return;
    stopHeartbeat();
    if (reconnectAttempts >= reconnectOpts.maxAttempts) {
      console.error('Max reconnection attempts reached');
      // Notify all subscriptions of error
      for (const [, sub] of subscriptions) {
        sub.callbacks.onError?.(new Error('Connection lost'));
      }
      return;
    }

    const delay = Math.min(
      reconnectOpts.delayMs * Math.pow(2, reconnectAttempts),
      reconnectOpts.maxDelayMs
    );
    reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connectWebSocket().catch(() => {
        // Will retry via onclose handler
      });
    }, delay);
  }

  function handleServerMessage(msg: Exclude<WSServerMessage, { type: 'pong' }>) {
    const sub = subscriptions.get(msg.id);
    if (!sub) return;

    switch (msg.type) {
      case 'data':
        sub.callbacks.onData(msg.data);
        break;
      case 'error':
        sub.callbacks.onError?.(new Error(msg.error.message));
        break;
      case 'complete':
        subscriptions.delete(msg.id);
        sub.callbacks.onComplete?.();
        break;
    }
  }

  function sendSubscribe(id: string, path: string[], input?: unknown) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const msg: WSClientMessage = { type: 'subscribe', id, path, input };
    ws.send(JSON.stringify(msg));
  }

  function sendUnsubscribe(id: string) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const msg: WSClientMessage = { type: 'unsubscribe', id };
    ws.send(JSON.stringify(msg));
  }

  // ==========================================================================
  // Proxy creation
  // ==========================================================================

  function createProxy(path: string[]): unknown {
    return new Proxy(() => {}, {
      get(_target, prop: string) {
        if (prop === 'query') {
          return async (input?: unknown) => {
            // Use POST if configured, or if input is large/complex
            const usePost = options.usePostForQueries ?? false;

            if (usePost) {
              // POST method for queries
              const response = await fetchFn(options.httpEndpoint, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ path, type: 'query', input }),
              });
              return handleHttpResponse(response, path);
            } else {
              // GET method (default) - with URL length check
              const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
              const url = new URL(options.httpEndpoint, base);
              url.searchParams.set('path', path.join('.'));
              if (input !== undefined) {
                const inputStr = JSON.stringify(input);
                // Warn if URL might be too long (roughly 2000 chars is safe)
                if (inputStr.length > 1500) {
                  console.warn(
                    'RPC query input is large. Consider using usePostForQueries option to avoid URL length limits.'
                  );
                }
                url.searchParams.set('input', inputStr);
              }

              const response = await fetchFn(url.toString(), {
                method: 'GET',
                headers: getHeaders(),
              });

              return handleHttpResponse(response, path);
            }
          };
        }

        if (prop === 'mutate') {
          return async (input?: unknown) => {
            const response = await fetchFn(options.httpEndpoint, {
              method: 'POST',
              headers: getHeaders(),
              body: JSON.stringify({ path, type: 'mutation', input }),
            });

            return handleHttpResponse(response, path);
          };
        }

        if (prop === 'subscribe') {
          return (inputOrCallbacks?: unknown, maybeCallbacks?: SubscriptionCallbacks<unknown>) => {
            const hasInput = maybeCallbacks !== undefined;
            const input = hasInput ? inputOrCallbacks : undefined;
            const callbacks = (hasInput ? maybeCallbacks : inputOrCallbacks) as SubscriptionCallbacks<unknown>;

            const id = generateId();
            const sub: ActiveSubscription = { path, input, callbacks };

            // Start connection if needed
            if (!wsConnected && !wsConnecting) {
              pendingSubscriptions.push({ id, sub });
              connectWebSocket().catch((error) => {
                callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
              });
            } else if (wsConnected) {
              subscriptions.set(id, sub);
              sendSubscribe(id, path, input);
            } else {
              // Connecting - queue it
              pendingSubscriptions.push({ id, sub });
            }

            // Return unsubscribe function
            return () => {
              subscriptions.delete(id);
              // Also remove from pending queue (if still connecting)
              const pendingIdx = pendingSubscriptions.findIndex(p => p.id === id);
              if (pendingIdx !== -1) {
                pendingSubscriptions.splice(pendingIdx, 1);
              }
              sendUnsubscribe(id);

              // Close WebSocket if no more subscriptions
              if (subscriptions.size === 0 && pendingSubscriptions.length === 0) {
                stopHeartbeat();
                if (reconnectTimeout) {
                  clearTimeout(reconnectTimeout);
                  reconnectTimeout = null;
                }
                ws?.close();
                ws = null;
                wsConnected = false;
                wsConnecting = false;
              }
            };
          };
        }

        // Continue building path
        return createProxy([...path, prop]);
      },
    });
  }

  return createProxy([]) as InferClient<T['_def']>;
}

async function handleHttpResponse(response: Response, path: string[]): Promise<unknown> {
  let result: RPCResponse;
  try {
    result = await response.json();
  } catch {
    throw new RPCClientError(
      `RPC call to ${path.join('.')} returned invalid JSON (status ${response.status})`,
      'PARSE_ERROR',
      path.join('.')
    );
  }

  if (!result || !('ok' in result)) {
    throw new RPCClientError(
      `RPC call to ${path.join('.')} returned unexpected response format`,
      'INVALID_RESPONSE',
      path.join('.')
    );
  }

  if (!result.ok) {
    throw new RPCClientError(
      result.error?.message || 'Unknown RPC error',
      result.error?.code || 'UNKNOWN',
      path.join('.'),
      result.error?.details
    );
  }

  return result.data;
}

export class RPCClientError extends Error {
  public readonly code: string;
  public readonly path: string;
  public readonly details?: unknown;

  constructor(message: string, code: string, path: string, details?: unknown) {
    super(message);
    this.name = 'RPCClientError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}
