/**
 * EreoJS plugin for RPC integration with WebSocket support
 *
 * Usage in ereo.config.ts:
 *   import { rpcPlugin } from '@ereo/rpc';
 *   import { api } from './api/router';
 *
 *   export default defineConfig({
 *     plugins: [
 *       rpcPlugin({
 *         router: api,
 *         endpoint: '/api/rpc',
 *       }),
 *     ],
 *   });
 */

import type { RouterDef, Router, WSConnectionData } from './types';

// We avoid importing from @ereo/core directly to prevent build dependency issues
// The types are simple enough to inline

/** Bun WebSocket configuration */
export interface BunWebSocketConfig<T> {
  message: (ws: any, message: string | Buffer) => void | Promise<void>;
  open?: (ws: any) => void | Promise<void>;
  close?: (ws: any) => void | Promise<void>;
  drain?: (ws: any) => void;
}

/** Minimal Plugin interface matching @ereo/core */
export interface RPCPlugin {
  name: string;
  runtimeMiddleware?: Array<(request: Request, context: any, next: () => Promise<Response>) => Response | Promise<Response>>;
  virtualModules?: Record<string, string>;
}

export interface RPCPluginOptions<T extends RouterDef = RouterDef> {
  /** The router instance */
  router: Router<T>;
  /** Endpoint path for HTTP and WebSocket (default: '/api/rpc') */
  endpoint?: string;
}

export interface RPCPluginResult extends RPCPlugin {
  /** The endpoint path this plugin handles */
  endpoint: string;
  /** Get WebSocket handler config for Bun.serve() */
  getWebSocketConfig(): BunWebSocketConfig<WSConnectionData>;
  /** Upgrade a request to WebSocket (call from your server setup) */
  upgradeToWebSocket(server: any, request: Request, ctx: any): boolean;
}

export function rpcPlugin<T extends RouterDef>(
  options: RPCPluginOptions<T>
): RPCPluginResult {
  const { router, endpoint = '/api/rpc' } = options;

  const rpcMiddleware = async (
    request: Request,
    context: any,
    next: () => Promise<Response>
  ): Promise<Response> => {
    const url = new URL(request.url);

    // Check if this is an RPC request
    if (url.pathname === endpoint) {
      // Check for WebSocket upgrade
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader?.toLowerCase() === 'websocket') {
        // WebSocket upgrade is handled by the server, not middleware
        // Return a special response that signals the server to upgrade
        return new Response(null, {
          status: 101,
          headers: {
            'X-Ereo-RPC-Upgrade': 'websocket',
          },
        });
      }

      // HTTP request - handle with router
      return router.handler(request, context);
    }

    return next();
  };

  return {
    name: '@ereo/rpc',
    endpoint,

    runtimeMiddleware: [rpcMiddleware],

    // Virtual module for typed client
    virtualModules: {
      'virtual:ereo-rpc-client': `
        import { createClient } from '@ereo/rpc/client';

        const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsEndpoint = typeof window !== 'undefined'
          ? wsProtocol + '//' + window.location.host + '${endpoint}'
          : 'ws://localhost:3000${endpoint}';

        export const rpc = createClient({
          httpEndpoint: '${endpoint}',
          wsEndpoint,
        });
      `,
    },

    getWebSocketConfig() {
      return router.websocket;
    },

    upgradeToWebSocket(server: any, request: Request, ctx: any): boolean {
      const url = new URL(request.url);
      if (url.pathname !== endpoint) {
        return false;
      }

      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader?.toLowerCase() !== 'websocket') {
        return false;
      }

      // Upgrade the connection - preserve original request for middleware access
      const data: WSConnectionData = {
        subscriptions: new Map(),
        ctx,
        originalRequest: request,
      };

      const success = server.upgrade(request, { data });
      return success;
    },
  };
}

/**
 * Helper to create server options that integrate RPC WebSocket support
 *
 * Usage:
 *   const rpc = rpcPlugin({ router: api });
 *
 *   Bun.serve({
 *     port: 3000,
 *     fetch(request, server) {
 *       // Try WebSocket upgrade first
 *       if (rpc.upgradeToWebSocket(server, request, createContext(request))) {
 *         return; // Upgraded
 *       }
 *       // Handle normal requests...
 *     },
 *     websocket: rpc.getWebSocketConfig(),
 *   });
 */
