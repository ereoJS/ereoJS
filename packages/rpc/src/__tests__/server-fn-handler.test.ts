/**
 * Tests for server function HTTP handler
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createServerFn,
  clearServerFnRegistry,
  ServerFnError,
  SERVER_FN_BASE,
  type ServerFnMiddleware,
} from '../server-fn';
import { createServerFnHandler } from '../server-fn-handler';

// Clean registry between tests
beforeEach(() => {
  clearServerFnRegistry();
});

function makeRequest(
  fnId: string,
  input?: unknown,
  options?: { method?: string; headers?: Record<string, string> }
): Request {
  const { method = 'POST', headers = {} } = options ?? {};
  const url = `http://localhost${SERVER_FN_BASE}/${encodeURIComponent(fnId)}`;
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1', ...headers },
    body: method !== 'GET' ? JSON.stringify({ input }) : undefined,
  });
}

// =============================================================================
// Basic Request Handling
// =============================================================================

describe('createServerFnHandler', () => {
  describe('routing', () => {
    test('returns null for non-matching paths', async () => {
      const handler = createServerFnHandler();
      const request = new Request('http://localhost/other/path', { method: 'POST' });
      const response = await handler(request);
      expect(response).toBeNull();
    });

    test('handles matching path', async () => {
      createServerFn('hello', async () => 'world');
      const handler = createServerFnHandler();
      const response = await handler(makeRequest('hello'));
      expect(response).not.toBeNull();
      expect(response!.status).toBe(200);
    });

    test('rejects non-POST methods', async () => {
      createServerFn('getOnly', async () => 'nope');
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/getOnly`, {
        method: 'GET',
      });
      const response = await handler(request);
      expect(response!.status).toBe(405);
    });

    test('returns 404 for unknown function', async () => {
      const handler = createServerFnHandler();
      const response = await handler(makeRequest('nonexistent'));
      expect(response!.status).toBe(404);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    test('returns 400 for missing function ID', async () => {
      const handler = createServerFnHandler();
      const request = new Request(`http://localhost${SERVER_FN_BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1' },
        body: JSON.stringify({ input: null }),
      });
      const response = await handler(request);
      expect(response!.status).toBe(400);
    });
  });

  describe('successful execution', () => {
    test('calls function with input and returns result', async () => {
      createServerFn('double', async (n: number) => n * 2);
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('double', 21));
      const body = await response!.json();

      expect(response!.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toBe(42);
    });

    test('handles void input', async () => {
      createServerFn('ping', async () => 'pong');
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('ping'));
      const body = await response!.json();

      expect(body.ok).toBe(true);
      expect(body.data).toBe('pong');
    });

    test('handles complex return values', async () => {
      createServerFn('getUser', async (id: string) => ({
        id,
        name: 'Alice',
        tags: ['admin', 'user'],
      }));
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('getUser', '42'));
      const body = await response!.json();

      expect(body.data).toEqual({
        id: '42',
        name: 'Alice',
        tags: ['admin', 'user'],
      });
    });

    test('handles null return value', async () => {
      createServerFn('nothing', async () => null);
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('nothing'));
      const body = await response!.json();

      expect(body.ok).toBe(true);
      expect(body.data).toBeNull();
    });
  });

  // ===========================================================================
  // Input Validation
  // ===========================================================================

  describe('input validation', () => {
    test('validates input with schema', async () => {
      const schema = {
        parse(data: unknown) {
          const d = data as { email?: string };
          if (!d.email || !d.email.includes('@')) {
            const err: any = new Error('Invalid email');
            err.name = 'ZodError';
            err.issues = [{ path: ['email'], message: 'Invalid email', code: 'custom' }];
            throw err;
          }
          return d as { email: string };
        },
      };

      createServerFn({
        id: 'validated',
        input: schema,
        handler: async (input: { email: string }) => `sent to ${input.email}`,
      });

      const handler = createServerFnHandler();

      // Valid input
      const good = await handler(makeRequest('validated', { email: 'a@b.com' }));
      const goodBody = await good!.json();
      expect(goodBody.ok).toBe(true);
      expect(goodBody.data).toBe('sent to a@b.com');

      // Invalid input
      clearServerFnRegistry();
      createServerFn({
        id: 'validated',
        input: schema,
        handler: async (input: { email: string }) => `sent to ${input.email}`,
      });

      const bad = await handler(makeRequest('validated', { email: 'invalid' }));
      const badBody = await bad!.json();
      expect(bad!.status).toBe(400);
      expect(badBody.ok).toBe(false);
      expect(badBody.error.code).toBe('VALIDATION_ERROR');
      expect(badBody.error.details.issues).toBeArray();
    });

    test('handles malformed JSON body', async () => {
      createServerFn('willFail', async () => 'nope');
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/willFail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1' },
        body: 'not json{{{',
      });

      const response = await handler(request);
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.error.code).toBe('PARSE_ERROR');
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    test('handles ServerFnError with status code', async () => {
      createServerFn('forbidden', async () => {
        throw new ServerFnError('FORBIDDEN', 'Admin only', { statusCode: 403 });
      });
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('forbidden'));
      expect(response!.status).toBe(403);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toBe('Admin only');
    });

    test('handles ServerFnError with details', async () => {
      createServerFn('detailed', async () => {
        throw new ServerFnError('CUSTOM', 'With details', {
          details: { field: 'name', hint: 'too short' },
        });
      });
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('detailed'));
      const body = await response!.json();

      expect(body.error.details).toEqual({ field: 'name', hint: 'too short' });
    });

    test('handles unknown errors as 500 INTERNAL_ERROR', async () => {
      createServerFn('crash', async () => {
        throw new Error('unexpected boom');
      });
      const handler = createServerFnHandler();

      // Suppress console.error during this test
      const originalError = console.error;
      console.error = () => {};
      const response = await handler(makeRequest('crash'));
      console.error = originalError;

      expect(response!.status).toBe(500);

      const body = await response!.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
      // Should NOT expose internal error message
      expect(body.error.message).toBe('Internal server error');
    });

    test('handles non-Error throws', async () => {
      createServerFn('throwString', async () => {
        throw 'oops';
      });
      const handler = createServerFnHandler();

      const originalError = console.error;
      console.error = () => {};
      const response = await handler(makeRequest('throwString'));
      console.error = originalError;

      expect(response!.status).toBe(500);
    });

    test('calls onError callback for unhandled errors', async () => {
      createServerFn('tracked', async () => {
        throw new Error('tracked error');
      });

      let capturedError: unknown;
      let capturedId: string | undefined;

      const handler = createServerFnHandler({
        onError: (error, fnId) => {
          capturedError = error;
          capturedId = fnId;
        },
      });

      const originalError = console.error;
      console.error = () => {};
      await handler(makeRequest('tracked'));
      console.error = originalError;

      expect(capturedError).toBeInstanceOf(Error);
      expect((capturedError as Error).message).toBe('tracked error');
      expect(capturedId).toBe('tracked');
    });
  });

  // ===========================================================================
  // Middleware
  // ===========================================================================

  describe('middleware', () => {
    test('runs global middleware before function middleware', async () => {
      const order: string[] = [];

      const globalMw: ServerFnMiddleware = async (_ctx, next) => {
        order.push('global');
        return next();
      };

      const fnMw: ServerFnMiddleware = async (_ctx, next) => {
        order.push('fn');
        return next();
      };

      createServerFn({
        id: 'mwOrder',
        middleware: [fnMw],
        handler: async () => {
          order.push('handler');
          return 'done';
        },
      });

      const handler = createServerFnHandler({
        middleware: [globalMw],
      });

      await handler(makeRequest('mwOrder'));
      expect(order).toEqual(['global', 'fn', 'handler']);
    });

    test('middleware can throw to short-circuit', async () => {
      const authMw: ServerFnMiddleware = async (_ctx, _next) => {
        throw new ServerFnError('UNAUTHORIZED', 'Login required', { statusCode: 401 });
      };

      createServerFn({
        id: 'protected',
        middleware: [authMw],
        handler: async () => 'secret',
      });

      const handler = createServerFnHandler();
      const response = await handler(makeRequest('protected'));

      expect(response!.status).toBe(401);
      const body = await response!.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    test('middleware receives request context', async () => {
      let receivedHeader: string | null = null;

      const headerMw: ServerFnMiddleware = async (ctx, next) => {
        receivedHeader = ctx.request.headers.get('X-Custom');
        return next();
      };

      createServerFn({
        id: 'headerFn',
        middleware: [headerMw],
        handler: async () => 'ok',
      });

      const handler = createServerFnHandler();
      await handler(makeRequest('headerFn', null, { headers: { 'X-Custom': 'test-value' } }));

      expect(receivedHeader).toBe('test-value');
    });
  });

  // ===========================================================================
  // Response Headers
  // ===========================================================================

  describe('response headers', () => {
    test('handler can set response headers via context', async () => {
      createServerFn('withHeaders', async (_input: void, ctx) => {
        ctx.responseHeaders.set('X-Custom-Header', 'from-server-fn');
        return 'ok';
      });

      const handler = createServerFnHandler();
      const response = await handler(makeRequest('withHeaders'));

      expect(response!.headers.get('X-Custom-Header')).toBe('from-server-fn');
    });
  });

  // ===========================================================================
  // Custom Options
  // ===========================================================================

  describe('handler options', () => {
    test('supports custom base path', async () => {
      createServerFn('customPath', async () => 'found');

      const handler = createServerFnHandler({ basePath: '/api/fn' });

      // Should not match default path
      const defaultReq = new Request(`http://localhost${SERVER_FN_BASE}/customPath`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: null }),
      });
      const defaultResponse = await handler(defaultReq);
      expect(defaultResponse).toBeNull();

      // Should match custom path
      const customReq = new Request('http://localhost/api/fn/customPath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1' },
        body: JSON.stringify({ input: null }),
      });
      const customResponse = await handler(customReq);
      expect(customResponse).not.toBeNull();
      expect(customResponse!.status).toBe(200);
    });

    test('supports createContext option', async () => {
      let receivedContext: unknown;

      createServerFn('ctxFn', async (_input: void, ctx) => {
        receivedContext = ctx.appContext;
        return 'ok';
      });

      const handler = createServerFnHandler({
        createContext: async (request) => ({
          userId: request.headers.get('X-User-Id'),
        }),
      });

      await handler(makeRequest('ctxFn', null, { headers: { 'X-User-Id': 'user-42' } }));

      expect(receivedContext).toEqual({ userId: 'user-42' });
    });
  });

  // ===========================================================================
  // URL-Encoded Function IDs
  // ===========================================================================

  describe('URL encoding', () => {
    test('handles URL-encoded function IDs', async () => {
      createServerFn('my/namespaced.fn', async () => 'namespaced');
      const handler = createServerFnHandler();

      const request = new Request(
        `http://localhost${SERVER_FN_BASE}/${encodeURIComponent('my/namespaced.fn')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1' },
          body: JSON.stringify({ input: null }),
        }
      );

      const response = await handler(request);
      const body = await response!.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBe('namespaced');
    });
  });
});
