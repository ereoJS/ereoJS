/**
 * Tests for RPC client
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { createClient, RPCClientError } from '../client';
import type { Router, RouterDef, RPCResponse } from '../types';

// Type-only router definition for testing client types
type TestRouterDef = {
  health: { _type: 'query'; _ctx: any; _input: void; _output: { status: string } };
  users: {
    get: { _type: 'query'; _ctx: any; _input: { id: string }; _output: { id: string; name: string } };
    create: { _type: 'mutation'; _ctx: any; _input: { name: string }; _output: { id: string; name: string } };
  };
  events: { _type: 'subscription'; _ctx: any; _input: void; _output: { event: string } };
  chat: { _type: 'subscription'; _ctx: any; _input: { room: string }; _output: { message: string } };
};

type TestRouter = Router<TestRouterDef>;

// =============================================================================
// Mock WebSocket
// =============================================================================

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  sentMessages: string[] = [];
  private static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);
  }

  close(_code?: number, _reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({});
  }

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  simulateMessage(data: any) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError(error: any) {
    this.onerror?.(error);
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({});
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  static getAllInstances(): MockWebSocket[] {
    return [...MockWebSocket.instances];
  }

  static clearInstances() {
    MockWebSocket.instances = [];
  }
}

describe('createClient', () => {
  let mockFetch: ReturnType<typeof mock>;
  let originalFetch: typeof globalThis.fetch;
  let originalWebSocket: any;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockFetch = mock((url: string, options?: RequestInit) => {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, data: null })));
    });
    globalThis.fetch = mockFetch as any;

    // Mock window.location for URL construction
    (globalThis as any).window = {
      location: {
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
      },
    };

    // Mock WebSocket
    originalWebSocket = (globalThis as any).WebSocket;
    (globalThis as any).WebSocket = MockWebSocket;
    MockWebSocket.clearInstances();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).window;
    (globalThis as any).WebSocket = originalWebSocket;
  });

  describe('client creation', () => {
    test('creates client with string endpoint', () => {
      const client = createClient<TestRouter>('/api/rpc');
      expect(client).toBeDefined();
    });

    test('creates client with options object', () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
      });
      expect(client).toBeDefined();
    });

    test('client has nested structure matching router', () => {
      const client = createClient<TestRouter>('/api/rpc');

      expect(client.health).toBeDefined();
      expect(client.users).toBeDefined();
      expect(client.users.get).toBeDefined();
      expect(client.users.create).toBeDefined();
    });
  });

  describe('queries', () => {
    test('calls query without input via GET', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: true,
          data: { status: 'ok' },
        })))
      );

      const client = createClient<TestRouter>('/api/rpc');
      const result = await client.health.query();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/rpc');
      expect(url).toContain('path=health');
      expect(options.method).toBe('GET');
      expect(result).toEqual({ status: 'ok' });
    });

    test('calls query with input', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: true,
          data: { id: '1', name: 'John' },
        })))
      );

      const client = createClient<TestRouter>('/api/rpc');
      const result = await client.users.get.query({ id: '1' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('path=users.get');
      expect(url).toContain('input=');
      expect(decodeURIComponent(url)).toContain('"id":"1"');
      expect(result).toEqual({ id: '1', name: 'John' });
    });

    test('throws error on failed query', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'User not found' },
        })))
      );

      const client = createClient<TestRouter>('/api/rpc');

      await expect(client.users.get.query({ id: '999' })).rejects.toMatchObject({
        message: 'User not found',
        code: 'NOT_FOUND',
        path: 'users.get',
      });
    });

    test('uses POST for queries when usePostForQueries is true', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: true,
          data: { status: 'ok' },
        })))
      );

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        usePostForQueries: true,
      });
      await client.health.query();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/rpc');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body).toEqual({ path: ['health'], type: 'query', input: undefined });
    });

    test('uses POST for queries with input when usePostForQueries is true', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: true,
          data: { id: '1', name: 'John' },
        })))
      );

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        usePostForQueries: true,
      });
      await client.users.get.query({ id: '1' });

      const [, options] = mockFetch.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.input).toEqual({ id: '1' });
    });

    test('warns on large query input', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true, data: null })))
      );

      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

      const client = createClient<TestRouter>('/api/rpc');
      const largeInput = { id: 'x'.repeat(1600) };
      await (client.users.get as any).query(largeInput);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('usePostForQueries')
      );
      warnSpy.mockRestore();
    });
  });

  describe('mutations', () => {
    test('calls mutation with input', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: true,
          data: { id: '1', name: 'Alice' },
        })))
      );

      const client = createClient<TestRouter>('/api/rpc');
      const result = await client.users.create.mutate({ name: 'Alice' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/rpc');
      expect(options.method).toBe('POST');
      expect(options.headers).toMatchObject({ 'Content-Type': 'application/json' });

      const body = JSON.parse(options.body);
      expect(body).toEqual({
        path: ['users', 'create'],
        type: 'mutation',
        input: { name: 'Alice' },
      });
      expect(result).toEqual({ id: '1', name: 'Alice' });
    });

    test('throws error on failed mutation', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name is required' },
        })))
      );

      const client = createClient<TestRouter>('/api/rpc');

      await expect(client.users.create.mutate({ name: '' })).rejects.toMatchObject({
        message: 'Name is required',
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('custom headers', () => {
    test('includes static headers', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true, data: null })))
      );

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        headers: { 'Authorization': 'Bearer token123' },
      });

      await client.health.query();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toMatchObject({
        'Authorization': 'Bearer token123',
      });
    });

    test('includes dynamic headers', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: true, data: null })))
      );

      let callCount = 0;
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        headers: () => {
          callCount++;
          return { 'X-Request-Id': `req-${callCount}` };
        },
      });

      await client.health.query();
      await client.health.query();

      expect(mockFetch.mock.calls[0][1].headers).toMatchObject({ 'X-Request-Id': 'req-1' });
      expect(mockFetch.mock.calls[1][1].headers).toMatchObject({ 'X-Request-Id': 'req-2' });
    });
  });

  describe('custom fetch', () => {
    test('uses custom fetch function', async () => {
      const customFetch = mock(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: true,
          data: { custom: true },
        })))
      );

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        fetch: customFetch as any,
      });

      const result = await client.health.query();

      expect(customFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({ custom: true });
    });
  });

  // ===========================================================================
  // handleHttpResponse error paths
  // ===========================================================================

  describe('HTTP response error handling', () => {
    test('throws RPCClientError on invalid JSON response', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response('not json', { status: 200 }))
      );

      const client = createClient<TestRouter>('/api/rpc');

      try {
        await client.health.query();
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe('PARSE_ERROR');
        expect((error as RPCClientError).path).toBe('health');
        expect((error as RPCClientError).message).toContain('invalid JSON');
      }
    });

    test('throws RPCClientError on unexpected response format', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ unexpected: true }), { status: 200 }))
      );

      const client = createClient<TestRouter>('/api/rpc');

      try {
        await client.health.query();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe('INVALID_RESPONSE');
        expect((error as RPCClientError).path).toBe('health');
      }
    });

    test('throws RPCClientError with details on error response', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Bad input',
            details: { field: 'email', issues: ['required'] },
          },
        })))
      );

      const client = createClient<TestRouter>('/api/rpc');

      try {
        await client.health.query();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe('VALIDATION_ERROR');
        expect((error as RPCClientError).details).toEqual({ field: 'email', issues: ['required'] });
      }
    });

    test('handles error response with no error object', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({ ok: false })))
      );

      const client = createClient<TestRouter>('/api/rpc');

      try {
        await client.health.query();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe('UNKNOWN');
        expect((error as RPCClientError).message).toBe('Unknown RPC error');
      }
    });

    test('handles null response body', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(null)))
      );

      const client = createClient<TestRouter>('/api/rpc');

      try {
        await client.health.query();
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(RPCClientError);
        expect((error as RPCClientError).code).toBe('INVALID_RESPONSE');
      }
    });
  });

  // ===========================================================================
  // RPCClientError class
  // ===========================================================================

  describe('RPCClientError', () => {
    test('is a proper Error subclass', () => {
      const error = new RPCClientError('test', 'CODE', 'path.to.fn');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RPCClientError);
      expect(error.name).toBe('RPCClientError');
      expect(error.message).toBe('test');
      expect(error.code).toBe('CODE');
      expect(error.path).toBe('path.to.fn');
    });

    test('supports details parameter', () => {
      const error = new RPCClientError('test', 'CODE', 'path', { field: 'email' });
      expect(error.details).toEqual({ field: 'email' });
    });

    test('details is undefined when not provided', () => {
      const error = new RPCClientError('test', 'CODE', 'path');
      expect(error.details).toBeUndefined();
    });
  });

  // ===========================================================================
  // WebSocket subscriptions
  // ===========================================================================

  describe('subscriptions', () => {
    test('fails subscribe when no wsEndpoint configured', () => {
      const client = createClient<TestRouter>({ httpEndpoint: '/api/rpc' });

      const errorSpy = mock(() => {});

      (client.events as any).subscribe({
        onData: () => {},
        onError: errorSpy,
      });

      // The error happens asynchronously
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(errorSpy).toHaveBeenCalled();
          const errorArg = errorSpy.mock.calls[0][0];
          expect(errorArg.message).toContain('WebSocket endpoint not configured');
          resolve();
        }, 10);
      });
    });

    test('connects WebSocket and subscribes', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      const onData = mock(() => {});

      (client.events as any).subscribe({
        onData,
        onError: () => {},
      });

      // Wait for connection attempt
      await new Promise(r => setTimeout(r, 5));

      const ws = MockWebSocket.getLastInstance()!;
      expect(ws).toBeDefined();
      expect(ws.url).toBe('ws://localhost:3000/api/rpc');

      // Simulate connection open
      ws.simulateOpen();

      // Should have sent a subscribe message
      expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1);
      const subMsg = JSON.parse(ws.sentMessages[0]);
      expect(subMsg.type).toBe('subscribe');
      expect(subMsg.path).toEqual(['events']);
    });

    test('receives data from subscription', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      const receivedData: any[] = [];
      const onData = mock((data: any) => receivedData.push(data));

      (client.events as any).subscribe({
        onData,
        onError: () => {},
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Extract subscription ID from sent message
      const subMsg = JSON.parse(ws.sentMessages[0]);
      const subId = subMsg.id;

      // Simulate server sending data
      ws.simulateMessage({ type: 'data', id: subId, data: { event: 'test-event' } });

      expect(onData).toHaveBeenCalledWith({ event: 'test-event' });
    });

    test('handles subscription error from server', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      const onError = mock(() => {});

      (client.events as any).subscribe({
        onData: () => {},
        onError,
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      const subMsg = JSON.parse(ws.sentMessages[0]);
      ws.simulateMessage({
        type: 'error',
        id: subMsg.id,
        error: { code: 'SUB_ERROR', message: 'Subscription failed' },
      });

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe('Subscription failed');
    });

    test('handles subscription complete from server', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      const onComplete = mock(() => {});

      (client.events as any).subscribe({
        onData: () => {},
        onComplete,
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      const subMsg = JSON.parse(ws.sentMessages[0]);
      ws.simulateMessage({ type: 'complete', id: subMsg.id });

      expect(onComplete).toHaveBeenCalled();
    });

    test('subscribe with input sends input in subscribe message', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      (client.chat as any).subscribe({ room: 'general' }, {
        onData: () => {},
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      const subMsg = JSON.parse(ws.sentMessages[0]);
      expect(subMsg.input).toEqual({ room: 'general' });
      expect(subMsg.path).toEqual(['chat']);
    });

    test('unsubscribe sends unsubscribe message and cleans up', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      const unsub = (client.events as any).subscribe({
        onData: () => {},
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Call unsubscribe
      unsub();

      // Should have sent unsubscribe message
      const unsubMsg = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
      expect(unsubMsg.type).toBe('unsubscribe');

      // WebSocket should be closed (no more subscriptions)
      expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    });

    test('ignores messages for unknown subscription IDs', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      const onData = mock(() => {});

      (client.events as any).subscribe({
        onData,
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Send message with unknown ID — should not crash
      ws.simulateMessage({ type: 'data', id: 'unknown-id', data: { test: true } });

      // onData should only have been called 0 times (unknown ID is ignored)
      expect(onData).not.toHaveBeenCalled();
    });

    test('handles WebSocket message parse errors', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      (client.events as any).subscribe({ onData: () => {} });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Send invalid JSON
      ws.onmessage?.({ data: 'not valid json{{{' });

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });

    test('handles WebSocket error event', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      (client.events as any).subscribe({ onData: () => {} });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();
      ws.simulateError(new Error('ws error'));

      expect(errorSpy).toHaveBeenCalledWith(
        'WebSocket error:',
        expect.any(Error)
      );

      errorSpy.mockRestore();
    });

    test('queues subscriptions while connecting', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      const onData1 = mock(() => {});
      const onData2 = mock(() => {});

      // Start first subscription (triggers connect)
      (client.events as any).subscribe({ onData: onData1 });

      await new Promise(r => setTimeout(r, 5));

      // Start second subscription while first is still connecting
      (client.events as any).subscribe({ onData: onData2 });

      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Both should have been subscribed
      expect(ws.sentMessages.length).toBe(2);
    });

    test('adds to active subscriptions when already connected', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Now already connected — second subscription should be immediate
      (client.chat as any).subscribe({ room: 'test' }, { onData: () => {} });

      // Should have 2 subscribe messages
      expect(ws.sentMessages.length).toBe(2);
    });
  });

  // ===========================================================================
  // Pong handling
  // ===========================================================================

  describe('pong handling', () => {
    test('pong message resets missed pong counter', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Simulate pong — should not crash
      ws.simulateMessage({ type: 'pong' });
    });
  });

  // ===========================================================================
  // WebSocket reconnection
  // ===========================================================================

  describe('reconnection', () => {
    test('reconnects after unexpected close when subscriptions exist', async () => {
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
        reconnect: { enabled: true, delayMs: 10, maxAttempts: 3 },
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws1 = MockWebSocket.getLastInstance()!;
      ws1.simulateOpen();

      // Close unexpectedly (simulates network drop)
      // The onclose handler calls close() which sets readyState, then calls the handler
      ws1.readyState = MockWebSocket.CLOSED;
      ws1.onclose?.({});

      // Wait for reconnect timer
      await new Promise(r => setTimeout(r, 50));

      // Should have created a new WebSocket instance
      const instances = MockWebSocket.getAllInstances();
      expect(instances.length).toBeGreaterThan(1);

      logSpy.mockRestore();
    });

    test('does not reconnect when reconnect is disabled', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
        reconnect: { enabled: false },
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      ws.readyState = MockWebSocket.CLOSED;
      ws.onclose?.({});

      await new Promise(r => setTimeout(r, 50));

      // Should not have created another WebSocket
      expect(MockWebSocket.getAllInstances().length).toBe(1);
    });

    test('notifies subscriptions on max reconnect attempts', async () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
        reconnect: { enabled: true, maxAttempts: 0, delayMs: 10 },
      });

      const onError = mock(() => {});

      (client.events as any).subscribe({
        onData: () => {},
        onError,
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Close — should hit max attempts immediately since maxAttempts=0
      ws.readyState = MockWebSocket.CLOSED;
      ws.onclose?.({});

      await new Promise(r => setTimeout(r, 20));

      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toContain('Connection lost');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });

    test('resubscribes existing subscriptions after reconnect', async () => {
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
        reconnect: { enabled: true, delayMs: 10, maxAttempts: 3 },
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws1 = MockWebSocket.getLastInstance()!;
      ws1.simulateOpen();

      // Close and wait for reconnect
      ws1.readyState = MockWebSocket.CLOSED;
      ws1.onclose?.({});

      await new Promise(r => setTimeout(r, 50));

      // Open the new WebSocket
      const ws2 = MockWebSocket.getLastInstance()!;
      expect(ws2).not.toBe(ws1);
      ws2.simulateOpen();

      // Should have re-sent subscribe message
      expect(ws2.sentMessages.length).toBeGreaterThanOrEqual(1);
      const resubMsg = JSON.parse(ws2.sentMessages[0]);
      expect(resubMsg.type).toBe('subscribe');

      logSpy.mockRestore();
    });

    test('does not reconnect when no active subscriptions', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
        reconnect: { enabled: true, delayMs: 10 },
      });

      const unsub = (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Unsubscribe (closes WS)
      unsub();

      await new Promise(r => setTimeout(r, 50));

      // Should not have created another connection
      expect(MockWebSocket.getAllInstances().length).toBe(1);
    });

    test('connection close rejects queued connection requests', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
        reconnect: { enabled: false },
      });

      const onError = mock(() => {});

      (client.events as any).subscribe({
        onData: () => {},
        onError,
      });

      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;

      // Close before open — rejects connection queue
      ws.simulateClose();

      await new Promise(r => setTimeout(r, 10));

      expect(onError).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Heartbeat
  // ===========================================================================

  describe('heartbeat', () => {
    test('sends ping at configured interval', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: true,
        heartbeatInterval: 50,
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Wait for heartbeat
      await new Promise(r => setTimeout(r, 80));

      const pingMessages = ws.sentMessages.filter(m => {
        const parsed = JSON.parse(m);
        return parsed.type === 'ping';
      });
      expect(pingMessages.length).toBeGreaterThanOrEqual(1);

      // Clean up by unsubscribing
      ws.readyState = MockWebSocket.CLOSED;
      ws.onclose?.({});
    });

    test('does not send heartbeat when disabled', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: false,
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      await new Promise(r => setTimeout(r, 100));

      const pingMessages = ws.sentMessages.filter(m => {
        try {
          return JSON.parse(m).type === 'ping';
        } catch {
          return false;
        }
      });
      expect(pingMessages.length).toBe(0);
    });

    test('closes connection after missed pongs', async () => {
      const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: true,
        heartbeatInterval: 20,
        reconnect: { enabled: false },
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Wait for 3 heartbeat intervals (2 missed pongs triggers close)
      await new Promise(r => setTimeout(r, 80));

      expect(ws.readyState).toBe(MockWebSocket.CLOSED);

      warnSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    test('heartbeat stops when WebSocket is not open', async () => {
      const client = createClient<TestRouter>({
        httpEndpoint: '/api/rpc',
        wsEndpoint: 'ws://localhost:3000/api/rpc',
        heartbeatEnabled: true,
        heartbeatInterval: 20,
        reconnect: { enabled: false },
      });

      (client.events as any).subscribe({ onData: () => {} });
      await new Promise(r => setTimeout(r, 5));
      const ws = MockWebSocket.getLastInstance()!;
      ws.simulateOpen();

      // Manually set readyState to closing (simulates mid-close)
      ws.readyState = MockWebSocket.CLOSING;

      await new Promise(r => setTimeout(r, 40));

      // Should not have crashed
    });
  });
});

describe('client type inference', () => {
  // These tests verify TypeScript types work correctly at compile time

  beforeEach(() => {
    (globalThis as any).window = {
      location: {
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
      },
    };

    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ ok: true, data: { status: 'ok', id: '1', name: 'Test' } }));
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  test('query return type matches procedure output', async () => {
    const client = createClient<TestRouter>('/api/rpc');

    const health = await client.health.query();
    expect(health).toHaveProperty('status');
  });

  test('mutation input type matches procedure input', async () => {
    const client = createClient<TestRouter>('/api/rpc');

    const user = await client.users.create.mutate({ name: 'Test' });

    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
  });
});
