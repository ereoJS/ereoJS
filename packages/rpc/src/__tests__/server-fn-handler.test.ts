/**
 * Tests for server function HTTP handler
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createServerFn,
  clearServerFnRegistry,
  _clearServerFnMiddleware,
  ServerFnError,
  SERVER_FN_BASE,
  type ServerFnMiddleware,
} from '../server-fn';
import { createServerFnHandler } from '../server-fn-handler';
import { buildCorsMiddleware, buildAuthMiddleware } from '../server-block';

// Clean registry between tests
beforeEach(() => {
  clearServerFnRegistry();
  _clearServerFnMiddleware();
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

  // ===========================================================================
  // Path Traversal Protection
  // ===========================================================================

  describe('path traversal protection', () => {
    /**
     * Helper to build a raw request URL without double-encoding.
     * This lets us embed already-encoded sequences like %2e%2e in the path.
     */
    function makeRawRequest(rawPath: string): Request {
      return new Request(`http://localhost${SERVER_FN_BASE}/${rawPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1' },
        body: JSON.stringify({ input: null }),
      });
    }

    test('normal function IDs are accepted', async () => {
      createServerFn('legit-fn', async () => 'ok');
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('legit-fn'));
      expect(response!.status).toBe(200);

      const body = await response!.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBe('ok');
    });

    test('bare ".." as a path segment is resolved by URL constructor (returns null)', async () => {
      // When the URL is "/_server-fn/..", the URL constructor resolves
      // the ".." and the resulting pathname "/" no longer matches the prefix,
      // so the handler returns null (not a server function route).
      const handler = createServerFnHandler();

      const response = await handler(makeRawRequest('..'));
      expect(response).toBeNull();
    });

    test('rejects function IDs containing ".." with encoded slash', async () => {
      const handler = createServerFnHandler();

      // "..%2Ftest" — URL constructor does NOT resolve %2F as a slash,
      // so the pathname is "/_server-fn/..%2Ftest". After decodeURIComponent,
      // fnId becomes "../test" which contains ".." and is rejected.
      const response = await handler(makeRawRequest('..%2Ftest'));
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe('Invalid function ID');
    });

    test('rejects path traversal attempts like "../../../etc/passwd"', async () => {
      const handler = createServerFnHandler();

      const response = await handler(makeRawRequest('..%2F..%2F..%2Fetc%2Fpasswd'));
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe('Invalid function ID');
    });

    test('rejects function IDs containing null bytes', async () => {
      const handler = createServerFnHandler();

      const response = await handler(makeRawRequest('someFn%00.json'));
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe('Invalid function ID');
    });

    test('rejects empty function IDs', async () => {
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Ereo-RPC': '1' },
        body: JSON.stringify({ input: null }),
      });

      const response = await handler(request);
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe('Invalid function ID');
    });

    test('rejects URL-encoded traversal (%2e%2e%2f) after decodeURIComponent', async () => {
      const handler = createServerFnHandler();

      // %2e%2e%2f decodes to "../" — the handler's decodeURIComponent call
      // should decode this before the ".." check catches it
      const response = await handler(makeRawRequest('%2e%2e%2f%2e%2e%2fsecret'));
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
      expect(body.error.message).toBe('Invalid function ID');
    });

    test('rejects ".." embedded in the middle of a function ID', async () => {
      const handler = createServerFnHandler();

      const response = await handler(makeRawRequest('foo..bar'));
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('BAD_REQUEST');
    });

    test('allows function IDs with single dots (not traversal)', async () => {
      createServerFn('config.get', async () => 'value');
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('config.get'));
      expect(response!.status).toBe(200);

      const body = await response!.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBe('value');
    });
  });

  // ===========================================================================
  // CSRF Protection
  // ===========================================================================

  describe('CSRF protection', () => {
    test('rejects requests without X-Ereo-RPC header', async () => {
      createServerFn('csrfTest', async () => 'secret');
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/csrfTest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: null }),
      });

      const response = await handler(request);
      expect(response!.status).toBe(403);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('CSRF_ERROR');
      expect(body.error.message).toContain('X-Ereo-RPC');
    });

    test('allows requests when CSRF protection is disabled', async () => {
      createServerFn('noCsrf', async () => 'open');
      const handler = createServerFnHandler({ disableCsrfProtection: true });

      const request = new Request(`http://localhost${SERVER_FN_BASE}/noCsrf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: null }),
      });

      const response = await handler(request);
      expect(response!.status).toBe(200);

      const body = await response!.json();
      expect(body.ok).toBe(true);
    });
  });

  // ===========================================================================
  // Non-JSON Content Type
  // ===========================================================================

  describe('non-JSON content type', () => {
    test('handles request with non-JSON content type', async () => {
      createServerFn('noBody', async () => 'ok');
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/noBody`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'X-Ereo-RPC': '1' },
        body: 'some text',
      });

      const response = await handler(request);
      expect(response!.status).toBe(200);

      const body = await response!.json();
      expect(body.ok).toBe(true);
      expect(body.data).toBe('ok');
    });

    test('handles request with no content type', async () => {
      createServerFn('noContentType', async () => 'ok');
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/noContentType`, {
        method: 'POST',
        headers: { 'X-Ereo-RPC': '1' },
      });

      const response = await handler(request);
      expect(response!.status).toBe(200);

      const body = await response!.json();
      expect(body.ok).toBe(true);
    });
  });

  // ===========================================================================
  // ZodError thrown from handler (not input validation)
  // ===========================================================================

  describe('ZodError from handler', () => {
    test('handles ZodError thrown inside handler body', async () => {
      createServerFn('zodThrow', async () => {
        const err: any = new Error('Nested validation failed');
        err.name = 'ZodError';
        err.issues = [
          { path: ['nested', 'field'], message: 'Invalid', code: 'invalid_type' },
        ];
        throw err;
      });
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('zodThrow'));
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.issues).toBeArray();
      expect(body.error.details.issues[0].path).toEqual(['nested', 'field']);
    });

    test('handles error with issues array (Zod-like)', async () => {
      createServerFn('zodLike', async () => {
        const err: any = new Error('Issues array');
        err.issues = [{ path: ['a'], message: 'msg', code: 'c' }];
        throw err;
      });
      const handler = createServerFnHandler();

      const response = await handler(makeRequest('zodLike'));
      expect(response!.status).toBe(400);

      const body = await response!.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ===========================================================================
  // defaultMiddleware + allowPublic
  // ===========================================================================

  describe('defaultMiddleware and allowPublic', () => {
    test('runs defaultMiddleware on normal functions', async () => {
      const order: string[] = [];

      const defaultMw: ServerFnMiddleware = async (_ctx, next) => {
        order.push('default');
        return next();
      };

      createServerFn({
        id: 'normalFn',
        handler: async () => {
          order.push('handler');
          return 'done';
        },
      });

      const handler = createServerFnHandler({
        defaultMiddleware: [defaultMw],
      });

      await handler(makeRequest('normalFn'));
      expect(order).toEqual(['default', 'handler']);
    });

    test('skips defaultMiddleware when allowPublic is true', async () => {
      const order: string[] = [];

      const defaultMw: ServerFnMiddleware = async (_ctx, next) => {
        order.push('default');
        return next();
      };

      createServerFn({
        id: 'publicFn',
        allowPublic: true,
        handler: async () => {
          order.push('handler');
          return 'done';
        },
      });

      const handler = createServerFnHandler({
        defaultMiddleware: [defaultMw],
      });

      await handler(makeRequest('publicFn'));
      expect(order).toEqual(['handler']);
    });

    test('global + default + function middleware chain order', async () => {
      const order: string[] = [];

      const globalMw: ServerFnMiddleware = async (_ctx, next) => {
        order.push('global');
        return next();
      };

      const defaultMw: ServerFnMiddleware = async (_ctx, next) => {
        order.push('default');
        return next();
      };

      const fnMw: ServerFnMiddleware = async (_ctx, next) => {
        order.push('fn');
        return next();
      };

      createServerFn({
        id: 'chainedFn',
        middleware: [fnMw],
        handler: async () => {
          order.push('handler');
          return 'done';
        },
      });

      const handler = createServerFnHandler({
        middleware: [globalMw],
        defaultMiddleware: [defaultMw],
      });

      await handler(makeRequest('chainedFn'));
      expect(order).toEqual(['global', 'default', 'fn', 'handler']);
    });
  });

  // ===========================================================================
  // appContext passthrough
  // ===========================================================================

  describe('appContext passthrough', () => {
    test('passes appContext when no createContext is provided', async () => {
      let receivedContext: unknown;

      createServerFn('ctxPassthrough', async (_input: void, ctx) => {
        receivedContext = ctx.appContext;
        return 'ok';
      });

      const handler = createServerFnHandler();
      await handler(makeRequest('ctxPassthrough'), { fromServer: true });

      expect(receivedContext).toEqual({ fromServer: true });
    });

    test('uses empty object when no appContext and no createContext', async () => {
      let receivedContext: unknown;

      createServerFn('noCtx', async (_input: void, ctx) => {
        receivedContext = ctx.appContext;
        return 'ok';
      });

      const handler = createServerFnHandler();
      await handler(makeRequest('noCtx'));

      expect(receivedContext).toEqual({});
    });
  });

  // ===========================================================================
  // extractValidationDetails edge cases
  // ===========================================================================

  describe('validation detail extraction', () => {
    test('extracts message from generic Error in validation', async () => {
      const schema = {
        parse(_data: unknown) {
          throw new Error('plain error');
        },
      };

      createServerFn({
        id: 'plainErr',
        input: schema,
        handler: async () => 'ok',
      });

      const handler = createServerFnHandler();
      const response = await handler(makeRequest('plainErr', 'test'));

      const body = await response!.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.message).toBe('plain error');
    });

    test('extracts generic message from non-Error throw in validation', async () => {
      const schema = {
        parse(_data: unknown) {
          throw 'string error';
        },
      };

      createServerFn({
        id: 'strErr',
        input: schema,
        handler: async () => 'ok',
      });

      const handler = createServerFnHandler();
      const response = await handler(makeRequest('strErr', 'test'));

      const body = await response!.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.message).toBe('Validation failed');
    });
  });

  // ===========================================================================
  // OPTIONS Preflight
  // ===========================================================================

  describe('OPTIONS preflight', () => {
    test('returns 204 for OPTIONS request to known function', async () => {
      createServerFn('preflight-fn', async () => 'ok');
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/preflight-fn`, {
        method: 'OPTIONS',
      });
      const response = await handler(request);
      expect(response!.status).toBe(204);
    });

    test('returns 204 with CORS headers from function middleware', async () => {
      const corsMiddleware = buildCorsMiddleware({
        origins: '*',
      });

      createServerFn({
        id: 'cors-preflight',
        handler: async () => 'ok',
        middleware: [corsMiddleware],
      });

      const handler = createServerFnHandler();
      const request = new Request(`http://localhost${SERVER_FN_BASE}/cors-preflight`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://example.com' },
      });
      const response = await handler(request);

      expect(response!.status).toBe(204);
      expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response!.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
    });

    test('returns 204 for OPTIONS to unknown function', async () => {
      const handler = createServerFnHandler();
      const request = new Request(`http://localhost${SERVER_FN_BASE}/unknown`, {
        method: 'OPTIONS',
      });
      const response = await handler(request);
      expect(response!.status).toBe(204);
    });

    test('OPTIONS does not require X-Ereo-RPC header', async () => {
      createServerFn('no-csrf-preflight', async () => 'ok');
      const handler = createServerFnHandler();

      const request = new Request(`http://localhost${SERVER_FN_BASE}/no-csrf-preflight`, {
        method: 'OPTIONS',
      });
      const response = await handler(request);
      // Should succeed without X-Ereo-RPC header
      expect(response!.status).toBe(204);
    });

    test('CORS headers survive when auth middleware throws during preflight', async () => {
      const corsMiddleware = buildCorsMiddleware({ origins: '*' });
      const authMiddleware = buildAuthMiddleware({
        getUser: async () => null, // Always deny
      });

      createServerFn({
        id: 'cors-auth-preflight',
        handler: async () => 'ok',
        middleware: [corsMiddleware, authMiddleware],
      });

      const handler = createServerFnHandler();
      const request = new Request(`http://localhost${SERVER_FN_BASE}/cors-auth-preflight`, {
        method: 'OPTIONS',
      });
      const response = await handler(request);

      // Should still have CORS headers despite auth throwing
      expect(response!.status).toBe(204);
      expect(response!.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
