/**
 * Tests for RPC client
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { createClient } from '../client';
import type { Router, RouterDef, RPCResponse } from '../types';

// Type-only router definition for testing client types
type TestRouterDef = {
  health: { _type: 'query'; _ctx: any; _input: void; _output: { status: string } };
  users: {
    get: { _type: 'query'; _ctx: any; _input: { id: string }; _output: { id: string; name: string } };
    create: { _type: 'mutation'; _ctx: any; _input: { name: string }; _output: { id: string; name: string } };
  };
  events: { _type: 'subscription'; _ctx: any; _input: void; _output: { event: string } };
};

type TestRouter = Router<TestRouterDef>;

describe('createClient', () => {
  let mockFetch: ReturnType<typeof mock>;
  let originalFetch: typeof globalThis.fetch;

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
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).window;
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
    test('calls query without input', async () => {
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
});

describe('client type inference', () => {
  // These tests verify TypeScript types work correctly at compile time
  // We use a mock setup to avoid runtime issues

  beforeEach(() => {
    // Ensure window.location is set for URL construction
    (globalThis as any).window = {
      location: {
        origin: 'http://localhost:3000',
        protocol: 'http:',
        host: 'localhost:3000',
      },
    };

    // Mock fetch for these tests
    (globalThis as any).fetch = async () =>
      new Response(JSON.stringify({ ok: true, data: { status: 'ok', id: '1', name: 'Test' } }));
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  test('query return type matches procedure output', async () => {
    const client = createClient<TestRouter>('/api/rpc');

    // This should compile - health returns { status: string }
    const health = await client.health.query();
    expect(health).toHaveProperty('status');
  });

  test('mutation input type matches procedure input', async () => {
    const client = createClient<TestRouter>('/api/rpc');

    // This should compile - create takes { name: string }
    const user = await client.users.create.mutate({ name: 'Test' });

    // Type check: user should have id and name
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
  });
});
