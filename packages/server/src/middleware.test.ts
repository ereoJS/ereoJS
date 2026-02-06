import { describe, expect, test, beforeEach } from 'bun:test';
import {
  MiddlewareChain,
  createMiddlewareChain,
  logger,
  cors,
  securityHeaders,
  compress,
  rateLimit,
} from './middleware';
import { createContext, RequestContext } from '@ereo/core';

describe('@ereo/server - Middleware', () => {
  describe('MiddlewareChain', () => {
    let chain: MiddlewareChain;

    beforeEach(() => {
      chain = createMiddlewareChain();
    });

    test('creates an empty chain', () => {
      expect(chain).toBeInstanceOf(MiddlewareChain);
    });

    test('adds middleware with use()', () => {
      chain.use(async (req, ctx, next) => next());
      // Chain should have one middleware (no public accessor, but we can test execution)
    });

    test('adds path-scoped middleware', () => {
      chain.use('/api', async (req, ctx, next) => next());
    });

    test('executes middleware in order', async () => {
      const order: number[] = [];

      chain.use(async (req, ctx, next) => {
        order.push(1);
        const res = await next();
        order.push(4);
        return res;
      });

      chain.use(async (req, ctx, next) => {
        order.push(2);
        const res = await next();
        order.push(3);
        return res;
      });

      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      await chain.execute(request, context, async () => {
        return new Response('OK');
      });

      expect(order).toEqual([1, 2, 3, 4]);
    });

    test('filters middleware by path', async () => {
      let apiCalled = false;
      let globalCalled = false;

      chain.use(async (req, ctx, next) => {
        globalCalled = true;
        return next();
      });

      chain.use('/api', async (req, ctx, next) => {
        apiCalled = true;
        return next();
      });

      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      await chain.execute(request, context, async () => new Response('OK'));

      expect(globalCalled).toBe(true);
      expect(apiCalled).toBe(false);
    });

    test('executes path-specific middleware for matching paths', async () => {
      let apiCalled = false;

      chain.use('/api/*', async (req, ctx, next) => {
        apiCalled = true;
        return next();
      });

      const request = new Request('http://localhost:3000/api/users');
      const context = createContext(request);

      await chain.execute(request, context, async () => new Response('OK'));

      expect(apiCalled).toBe(true);
    });

    test('supports wildcard path matching', async () => {
      let called = false;

      chain.use('*', async (req, ctx, next) => {
        called = true;
        return next();
      });

      const request = new Request('http://localhost:3000/any/path');
      const context = createContext(request);

      await chain.execute(request, context, async () => new Response('OK'));

      expect(called).toBe(true);
    });
  });

  describe('logger middleware', () => {
    test('creates logger middleware', () => {
      const middleware = logger();
      expect(typeof middleware).toBe('function');
    });

    test('logs request and response', async () => {
      const middleware = logger();
      const request = new Request('http://localhost:3000/test');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK', { status: 200 });
      });

      expect(response.status).toBe(200);
    });
  });

  describe('cors middleware', () => {
    test('creates cors middleware with defaults', () => {
      const middleware = cors();
      expect(typeof middleware).toBe('function');
    });

    test('handles preflight OPTIONS request', async () => {
      const middleware = cors();
      const request = new Request('http://localhost:3000/', {
        method: 'OPTIONS',
        headers: { Origin: 'http://example.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('Should not reach here');
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    test('adds CORS headers to response', async () => {
      const middleware = cors();
      const request = new Request('http://localhost:3000/', {
        headers: { Origin: 'http://example.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    test('respects origin allowlist', async () => {
      const middleware = cors({ origin: ['http://allowed.com'] });
      const request = new Request('http://localhost:3000/', {
        headers: { Origin: 'http://allowed.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://allowed.com');
    });

    test('respects origin function', async () => {
      const middleware = cors({
        origin: (origin) => origin.endsWith('.example.com'),
      });
      const request = new Request('http://localhost:3000/', {
        headers: { Origin: 'http://api.example.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://api.example.com');
    });

    test('adds credentials header when enabled', async () => {
      const middleware = cors({ credentials: true });
      const request = new Request('http://localhost:3000/', {
        method: 'OPTIONS',
        headers: { Origin: 'http://example.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    test('adds exposed headers', async () => {
      const middleware = cors({ exposedHeaders: ['X-Custom-Header'] });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-Custom-Header');
    });
  });

  describe('securityHeaders middleware', () => {
    test('creates security headers middleware', () => {
      const middleware = securityHeaders();
      expect(typeof middleware).toBe('function');
    });

    test('adds default security headers', async () => {
      const middleware = securityHeaders();
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' https: data:; img-src 'self' data:; connect-src 'self' ws: wss:");
      expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    test('respects custom options', async () => {
      const middleware = securityHeaders({
        contentSecurityPolicy: "default-src 'none'",
        xFrameOptions: 'DENY',
      });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    test('allows disabling headers', async () => {
      const middleware = securityHeaders({
        contentSecurityPolicy: false,
        xFrameOptions: false,
      });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Content-Security-Policy')).toBeNull();
      expect(response.headers.get('X-Frame-Options')).toBeNull();
    });

    test('adds permissions policy when provided', async () => {
      const middleware = securityHeaders({
        permissionsPolicy: 'geolocation=()',
      });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('Permissions-Policy')).toBe('geolocation=()');
    });
  });

  describe('compress middleware', () => {
    test('creates compress middleware', () => {
      const middleware = compress();
      expect(typeof middleware).toBe('function');
    });

    test('compresses text content when client accepts gzip', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip, deflate' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('Hello World', {
          headers: { 'Content-Type': 'text/plain' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBe('gzip');
    });

    test('compresses JSON content', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('{"key": "value"}', {
          headers: { 'Content-Type': 'application/json' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBe('gzip');
    });

    test('does not compress when client does not accept gzip', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'identity' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('Hello World', {
          headers: { 'Content-Type': 'text/plain' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBeNull();
    });

    test('does not compress binary content', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Type': 'image/png' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBeNull();
    });
  });

  describe('rateLimit middleware', () => {
    test('creates rate limit middleware', () => {
      const middleware = rateLimit();
      expect(typeof middleware).toBe('function');
    });

    test('allows requests under limit', async () => {
      const middleware = rateLimit({ max: 10, windowMs: 60000 });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    });

    test('returns 429 when rate limit exceeded', async () => {
      const middleware = rateLimit({ max: 2, windowMs: 60000 });

      for (let i = 0; i < 3; i++) {
        const request = new Request('http://localhost:3000/', {
          headers: { 'X-Forwarded-For': 'test-ip' },
        });
        const context = createContext(request);

        const response = await middleware(request, context, async () => {
          return new Response('OK');
        });

        if (i < 2) {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(429);
          expect(response.headers.get('Retry-After')).toBeDefined();
        }
      }
    });

    test('uses custom key generator', async () => {
      const middleware = rateLimit({
        max: 1,
        keyGenerator: (req) => req.headers.get('X-API-Key') || 'unknown',
      });

      // First request with key1
      const request1 = new Request('http://localhost:3000/', {
        headers: { 'X-API-Key': 'key1' },
      });
      const context1 = createContext(request1);
      const response1 = await middleware(request1, context1, async () => new Response('OK'));
      expect(response1.status).toBe(200);

      // Second request with key2 should also pass
      const request2 = new Request('http://localhost:3000/', {
        headers: { 'X-API-Key': 'key2' },
      });
      const context2 = createContext(request2);
      const response2 = await middleware(request2, context2, async () => new Response('OK'));
      expect(response2.status).toBe(200);
    });

    test('includes rate limit headers in response', async () => {
      const middleware = rateLimit({ max: 10, windowMs: 60000 });
      const request = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'header-test-ip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('OK');
      });

      expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });
});
