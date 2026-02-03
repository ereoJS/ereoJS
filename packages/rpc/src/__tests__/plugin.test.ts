/**
 * Tests for RPC plugin
 */

import { describe, test, expect, mock } from 'bun:test';
import { rpcPlugin } from '../plugin';
import { createRouter } from '../router';
import { procedure } from '../procedure';

describe('rpcPlugin', () => {
  const createTestRouter = () =>
    createRouter({
      health: procedure.query(() => ({ status: 'ok' })),
      users: {
        list: procedure.query(() => []),
      },
      events: procedure.subscription(async function* () {
        yield { event: 'test' };
      }),
    });

  describe('basic configuration', () => {
    test('creates plugin with name', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router });

      expect(plugin.name).toBe('@ereo/rpc');
    });

    test('uses default endpoint', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router });

      expect(plugin.virtualModules).toBeDefined();
      const clientModule = plugin.virtualModules!['virtual:ereo-rpc-client'];
      expect(clientModule).toContain('/api/rpc');
    });

    test('uses custom endpoint', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/custom/rpc' });

      const clientModule = plugin.virtualModules!['virtual:ereo-rpc-client'];
      expect(clientModule).toContain('/custom/rpc');
    });
  });

  describe('runtime middleware', () => {
    test('includes RPC middleware', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router });

      expect(plugin.runtimeMiddleware).toBeDefined();
      expect(plugin.runtimeMiddleware).toHaveLength(1);
    });

    test('middleware handles RPC requests', async () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      const middleware = plugin.runtimeMiddleware![0];
      const nextCalled = { value: false };
      const next = async () => {
        nextCalled.value = true;
        return new Response('next');
      };

      // RPC request
      const rpcRequest = new Request('http://localhost/api/rpc?path=health');
      const response = await middleware(rpcRequest, {}, next);
      const data = await response.json();

      expect(nextCalled.value).toBe(false);
      expect(data.ok).toBe(true);
      expect(data.data).toEqual({ status: 'ok' });
    });

    test('middleware passes through non-RPC requests', async () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      const middleware = plugin.runtimeMiddleware![0];
      const nextCalled = { value: false };
      const next = async () => {
        nextCalled.value = true;
        return new Response('next response');
      };

      // Non-RPC request
      const otherRequest = new Request('http://localhost/other/path');
      const response = await middleware(otherRequest, {}, next);
      const text = await response.text();

      expect(nextCalled.value).toBe(true);
      expect(text).toBe('next response');
    });

    test('middleware returns 101 for WebSocket upgrade', async () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      const middleware = plugin.runtimeMiddleware![0];
      const next = async () => new Response('next');

      const wsRequest = new Request('http://localhost/api/rpc', {
        headers: { 'Upgrade': 'websocket' },
      });
      const response = await middleware(wsRequest, {}, next);

      expect(response.status).toBe(101);
      expect(response.headers.get('X-Ereo-RPC-Upgrade')).toBe('websocket');
    });
  });

  describe('virtual modules', () => {
    test('generates client virtual module', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      expect(plugin.virtualModules).toHaveProperty('virtual:ereo-rpc-client');
    });

    test('virtual module imports createClient', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router });

      const clientModule = plugin.virtualModules!['virtual:ereo-rpc-client'];
      expect(clientModule).toContain("import { createClient } from '@ereo/rpc/client'");
    });

    test('virtual module configures both http and ws endpoints', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/my/rpc' });

      const clientModule = plugin.virtualModules!['virtual:ereo-rpc-client'];
      expect(clientModule).toContain("httpEndpoint: '/my/rpc'");
      expect(clientModule).toContain('/my/rpc');
    });
  });

  describe('getWebSocketConfig', () => {
    test('returns websocket handlers', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router });

      const wsConfig = plugin.getWebSocketConfig();

      expect(wsConfig).toBeDefined();
      expect(typeof wsConfig.message).toBe('function');
      expect(typeof wsConfig.open).toBe('function');
      expect(typeof wsConfig.close).toBe('function');
    });
  });

  describe('upgradeToWebSocket', () => {
    test('returns false for non-matching path', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      const mockServer = {
        upgrade: mock(() => true),
      };

      const request = new Request('http://localhost/other/path', {
        headers: { 'Upgrade': 'websocket' },
      });

      const result = plugin.upgradeToWebSocket(mockServer, request, {});

      expect(result).toBe(false);
      expect(mockServer.upgrade).not.toHaveBeenCalled();
    });

    test('returns false for non-websocket request', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      const mockServer = {
        upgrade: mock(() => true),
      };

      const request = new Request('http://localhost/api/rpc');

      const result = plugin.upgradeToWebSocket(mockServer, request, {});

      expect(result).toBe(false);
      expect(mockServer.upgrade).not.toHaveBeenCalled();
    });

    test('upgrades valid websocket request', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      const mockServer = {
        upgrade: mock(() => true),
      };

      const request = new Request('http://localhost/api/rpc', {
        headers: { 'Upgrade': 'websocket' },
      });

      const ctx = { user: { id: '1' } };
      const result = plugin.upgradeToWebSocket(mockServer, request, ctx);

      expect(result).toBe(true);
      expect(mockServer.upgrade).toHaveBeenCalledTimes(1);

      // Verify upgrade was called with connection data
      const upgradeCall = mockServer.upgrade.mock.calls[0];
      expect(upgradeCall[0]).toBe(request);
      expect(upgradeCall[1].data).toHaveProperty('subscriptions');
      expect(upgradeCall[1].data.ctx).toBe(ctx);
    });

    test('returns upgrade result from server', () => {
      const router = createTestRouter();
      const plugin = rpcPlugin({ router, endpoint: '/api/rpc' });

      const mockServer = {
        upgrade: mock(() => false), // Server rejects upgrade
      };

      const request = new Request('http://localhost/api/rpc', {
        headers: { 'Upgrade': 'websocket' },
      });

      const result = plugin.upgradeToWebSocket(mockServer, request, {});

      expect(result).toBe(false);
    });
  });
});
