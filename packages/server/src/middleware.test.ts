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

    test('allows exactly max requests and blocks the next one', async () => {
      const middleware = rateLimit({ max: 5, windowMs: 60000 });

      for (let i = 0; i < 6; i++) {
        const request = new Request('http://localhost:3000/', {
          headers: { 'X-Forwarded-For': 'exact-limit-ip' },
        });
        const context = createContext(request);

        const response = await middleware(request, context, async () => {
          return new Response('OK');
        });

        if (i < 5) {
          expect(response.status).toBe(200);
          expect(response.headers.get('X-RateLimit-Remaining')).toBe(String(5 - (i + 1)));
        } else {
          expect(response.status).toBe(429);
          const body = await response.json();
          expect(body.error).toBe('Too many requests');
        }
      }
    });

    test('rate limit headers have correct values across requests', async () => {
      const middleware = rateLimit({ max: 3, windowMs: 60000 });

      for (let i = 0; i < 3; i++) {
        const request = new Request('http://localhost:3000/', {
          headers: { 'X-Forwarded-For': 'headers-check-ip' },
        });
        const context = createContext(request);

        const response = await middleware(request, context, async () => {
          return new Response('OK');
        });

        expect(response.headers.get('X-RateLimit-Limit')).toBe('3');
        expect(response.headers.get('X-RateLimit-Remaining')).toBe(String(3 - (i + 1)));
        // Reset should be a Unix timestamp in seconds (roughly current time + windowMs)
        const resetValue = Number(response.headers.get('X-RateLimit-Reset'));
        expect(resetValue).toBeGreaterThan(0);
        expect(resetValue).toBeGreaterThanOrEqual(Math.floor(Date.now() / 1000));
      }
    });

    test('resets count after window expires', async () => {
      const windowMs = 50; // 50ms window for fast test
      const middleware = rateLimit({ max: 1, windowMs });

      // First request: should pass
      const request1 = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'window-reset-ip' },
      });
      const context1 = createContext(request1);
      const response1 = await middleware(request1, context1, async () => new Response('OK'));
      expect(response1.status).toBe(200);

      // Second request immediately: should be blocked
      const request2 = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'window-reset-ip' },
      });
      const context2 = createContext(request2);
      const response2 = await middleware(request2, context2, async () => new Response('OK'));
      expect(response2.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

      // Third request after window: should pass again
      const request3 = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'window-reset-ip' },
      });
      const context3 = createContext(request3);
      const response3 = await middleware(request3, context3, async () => new Response('OK'));
      expect(response3.status).toBe(200);
      expect(response3.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    test('custom keyGenerator isolates rate limits per key', async () => {
      const middleware = rateLimit({
        max: 1,
        windowMs: 60000,
        keyGenerator: (req) => req.headers.get('X-API-Key') || 'unknown',
      });

      // key1 first request: allowed
      const req1 = new Request('http://localhost:3000/', {
        headers: { 'X-API-Key': 'key-alpha' },
      });
      const res1 = await middleware(req1, createContext(req1), async () => new Response('OK'));
      expect(res1.status).toBe(200);

      // key1 second request: blocked
      const req2 = new Request('http://localhost:3000/', {
        headers: { 'X-API-Key': 'key-alpha' },
      });
      const res2 = await middleware(req2, createContext(req2), async () => new Response('OK'));
      expect(res2.status).toBe(429);

      // key2 first request: allowed (different key, separate counter)
      const req3 = new Request('http://localhost:3000/', {
        headers: { 'X-API-Key': 'key-beta' },
      });
      const res3 = await middleware(req3, createContext(req3), async () => new Response('OK'));
      expect(res3.status).toBe(200);

      // key2 second request: blocked
      const req4 = new Request('http://localhost:3000/', {
        headers: { 'X-API-Key': 'key-beta' },
      });
      const res4 = await middleware(req4, createContext(req4), async () => new Response('OK'));
      expect(res4.status).toBe(429);
    });

    test('cleans up expired entries when map exceeds MAX_ENTRIES (10000)', async () => {
      // Use a very short window so entries expire quickly
      const windowMs = 10;
      const middleware = rateLimit({ max: 100, windowMs });

      // Generate over 10,000 unique keys to trigger the size-based cleanup
      // Each key gets a unique X-Forwarded-For to simulate spoofed headers
      for (let i = 0; i < 10_050; i++) {
        const request = new Request('http://localhost:3000/', {
          headers: { 'X-Forwarded-For': `spoofed-ip-${i}` },
        });
        const context = createContext(request);
        await middleware(request, context, async () => new Response('OK'));
      }

      // Wait for the window to expire so entries become stale
      await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

      // This request should trigger the size-based cleanup (requests.size > MAX_ENTRIES)
      // and also succeed since the window has reset
      const cleanupRequest = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'post-cleanup-ip' },
      });
      const cleanupContext = createContext(cleanupRequest);
      const response = await middleware(cleanupRequest, cleanupContext, async () => new Response('OK'));

      // Should succeed - memory hasn't grown unbounded and this is a fresh window
      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('99');
    });

    test('falls back to "unknown" when no X-Forwarded-For header', async () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000 });

      // Request without X-Forwarded-For
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));
      expect(response.status).toBe(200);
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    test('429 response includes Retry-After header in seconds', async () => {
      const middleware = rateLimit({ max: 1, windowMs: 30000 });

      // Exhaust the limit
      const req1 = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'retry-after-ip' },
      });
      await middleware(req1, createContext(req1), async () => new Response('OK'));

      // Trigger 429
      const req2 = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'retry-after-ip' },
      });
      const res = await middleware(req2, createContext(req2), async () => new Response('OK'));

      expect(res.status).toBe(429);
      const retryAfter = Number(res.headers.get('Retry-After'));
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(30);
    });

    test('does not set rate limit headers on 429 response', async () => {
      const middleware = rateLimit({ max: 1, windowMs: 60000 });

      // Exhaust the limit
      const req1 = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'no-headers-on-429-ip' },
      });
      await middleware(req1, createContext(req1), async () => new Response('OK'));

      // Trigger 429
      const req2 = new Request('http://localhost:3000/', {
        headers: { 'X-Forwarded-For': 'no-headers-on-429-ip' },
      });
      const res = await middleware(req2, createContext(req2), async () => new Response('OK'));

      expect(res.status).toBe(429);
      // 429 responses use Retry-After, not X-RateLimit-* headers
      expect(res.headers.get('X-RateLimit-Limit')).toBeNull();
      expect(res.headers.get('Retry-After')).toBeDefined();
    });
  });

  // ============================================================================
  // Additional Tests: CORS with function-based origin matcher
  // ============================================================================
  describe('cors middleware - function-based origin', () => {
    test('function origin rejects non-matching origins', async () => {
      const middleware = cors({
        origin: (origin) => origin.endsWith('.trusted.com'),
      });

      const request = new Request('http://localhost:3000/', {
        headers: { Origin: 'http://evil.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      // Should not have Access-Control-Allow-Origin set (allowedOrigin is null)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    test('function origin accepts matching subdomain', async () => {
      const middleware = cors({
        origin: (origin) => origin.endsWith('.trusted.com'),
      });

      const request = new Request('http://localhost:3000/', {
        headers: { Origin: 'http://app.trusted.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://app.trusted.com');
    });

    test('function origin with preflight for matching origin', async () => {
      const middleware = cors({
        origin: (origin) => origin === 'http://exact.match.com',
        credentials: true,
      });

      const request = new Request('http://localhost:3000/', {
        method: 'OPTIONS',
        headers: { Origin: 'http://exact.match.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('Should not reach'));

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://exact.match.com');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    test('function origin with preflight for non-matching origin falls back to *', async () => {
      const middleware = cors({
        origin: (origin) => origin === 'http://only-this.com',
      });

      const request = new Request('http://localhost:3000/', {
        method: 'OPTIONS',
        headers: { Origin: 'http://other.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('Should not reach'));

      expect(response.status).toBe(204);
      // Fallback to * when allowedOrigin is null
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    test('cors without Origin header returns no CORS headers on regular request', async () => {
      const middleware = cors({
        origin: ['http://allowed.com'],
      });

      // No Origin header at all
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      // allowedOrigin is null (no requestOrigin to match)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  // ============================================================================
  // Additional Tests: Multiple path patterns (array form)
  // ============================================================================
  describe('MiddlewareChain - multiple path patterns (array form)', () => {
    let chain: MiddlewareChain;

    beforeEach(() => {
      chain = createMiddlewareChain();
    });

    test('middleware matches first path in array', async () => {
      let called = false;

      // The MiddlewareDefinition supports path as string | string[]
      // We need to add it directly since .use() signature takes a single string
      (chain as any).middlewares = [{
        path: ['/api/*', '/admin/*'],
        handler: async (req: Request, ctx: any, next: () => Promise<Response>) => {
          called = true;
          return next();
        },
      }];

      const request = new Request('http://localhost:3000/api/users');
      const context = createContext(request);
      await chain.execute(request, context, async () => new Response('OK'));

      expect(called).toBe(true);
    });

    test('middleware matches second path in array', async () => {
      let called = false;

      (chain as any).middlewares = [{
        path: ['/api/*', '/admin/*'],
        handler: async (req: Request, ctx: any, next: () => Promise<Response>) => {
          called = true;
          return next();
        },
      }];

      const request = new Request('http://localhost:3000/admin/dashboard');
      const context = createContext(request);
      await chain.execute(request, context, async () => new Response('OK'));

      expect(called).toBe(true);
    });

    test('middleware does not match when none of the paths match', async () => {
      let called = false;

      (chain as any).middlewares = [{
        path: ['/api/*', '/admin/*'],
        handler: async (req: Request, ctx: any, next: () => Promise<Response>) => {
          called = true;
          return next();
        },
      }];

      const request = new Request('http://localhost:3000/public/page');
      const context = createContext(request);
      await chain.execute(request, context, async () => new Response('OK'));

      expect(called).toBe(false);
    });

    test('array path with exact match and wildcard', async () => {
      let called = false;

      (chain as any).middlewares = [{
        path: ['/health', '/api/*'],
        handler: async (req: Request, ctx: any, next: () => Promise<Response>) => {
          called = true;
          return next();
        },
      }];

      const request = new Request('http://localhost:3000/health');
      const context = createContext(request);
      await chain.execute(request, context, async () => new Response('OK'));

      expect(called).toBe(true);
    });
  });

  // ============================================================================
  // Additional Tests: Middleware error propagation
  // ============================================================================
  describe('MiddlewareChain - error propagation', () => {
    let chain: MiddlewareChain;

    beforeEach(() => {
      chain = createMiddlewareChain();
    });

    test('error in middleware propagates to caller', async () => {
      chain.use(async (req, ctx, next) => {
        throw new Error('Middleware failed');
      });

      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      expect(
        chain.execute(request, context, async () => new Response('OK'))
      ).rejects.toThrow('Middleware failed');
    });

    test('error in second middleware propagates correctly', async () => {
      const order: string[] = [];

      chain.use(async (req, ctx, next) => {
        order.push('first-before');
        try {
          const res = await next();
          order.push('first-after');
          return res;
        } catch (error) {
          order.push('first-catch');
          throw error;
        }
      });

      chain.use(async (req, ctx, next) => {
        order.push('second');
        throw new Error('Second middleware error');
      });

      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      try {
        await chain.execute(request, context, async () => new Response('OK'));
      } catch (error: any) {
        expect(error.message).toBe('Second middleware error');
      }

      expect(order).toEqual(['first-before', 'second', 'first-catch']);
    });

    test('error in final handler propagates through middleware', async () => {
      const order: string[] = [];

      chain.use(async (req, ctx, next) => {
        order.push('middleware');
        try {
          return await next();
        } catch (error) {
          order.push('caught');
          throw error;
        }
      });

      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      try {
        await chain.execute(request, context, async () => {
          throw new Error('Handler error');
        });
      } catch (error: any) {
        expect(error.message).toBe('Handler error');
      }

      expect(order).toEqual(['middleware', 'caught']);
    });

    test('middleware can catch and replace errors with responses', async () => {
      chain.use(async (req, ctx, next) => {
        try {
          return await next();
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      });

      chain.use(async (req, ctx, next) => {
        throw new Error('Something broke');
      });

      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await chain.execute(request, context, async () => new Response('OK'));

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Something broke');
    });
  });

  // ============================================================================
  // Additional Tests: compress() with various content types
  // ============================================================================
  describe('compress middleware - content type variations', () => {
    test('compresses text/html content', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('<html><body>Hello</body></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBe('gzip');
    });

    test('compresses text/css content', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('body { color: red; }', {
          headers: { 'Content-Type': 'text/css' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBe('gzip');
    });

    test('compresses application/javascript content', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('console.log("hello")', {
          headers: { 'Content-Type': 'application/javascript' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBe('gzip');
    });

    test('does not compress application/octet-stream', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'Content-Type': 'application/octet-stream' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBeNull();
    });

    test('does not compress when response has no body', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response(null, {
          status: 204,
          headers: { 'Content-Type': 'text/plain' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBeNull();
    });

    test('removes Content-Length when compressing', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'gzip' },
      });
      const context = createContext(request);

      const body = 'Hello World - a string to compress';
      const response = await middleware(request, context, async () => {
        return new Response(body, {
          headers: {
            'Content-Type': 'text/plain',
            'Content-Length': body.length.toString(),
          },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBe('gzip');
      // Content-Length should be removed since it no longer matches
      expect(response.headers.get('Content-Length')).toBeNull();
    });

    test('does not compress when Accept-Encoding is missing', async () => {
      const middleware = compress();
      // No Accept-Encoding header
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('Hello', {
          headers: { 'Content-Type': 'text/plain' },
        });
      });

      expect(response.headers.get('Content-Encoding')).toBeNull();
    });

    test('does not compress when Accept-Encoding has only deflate', async () => {
      const middleware = compress();
      const request = new Request('http://localhost:3000/', {
        headers: { 'Accept-Encoding': 'deflate, br' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('Hello', {
          headers: { 'Content-Type': 'text/plain' },
        });
      });

      // gzip not accepted, should not compress
      expect(response.headers.get('Content-Encoding')).toBeNull();
    });
  });

  // ============================================================================
  // Additional Tests: Security headers - full disable and custom policies
  // ============================================================================
  describe('securityHeaders middleware - additional options', () => {
    test('disables referrer policy when set to false', async () => {
      const middleware = securityHeaders({ referrerPolicy: false });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      expect(response.headers.get('Referrer-Policy')).toBeNull();
      // Other headers should still be set
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    test('disables X-Content-Type-Options when set to false', async () => {
      const middleware = securityHeaders({ xContentTypeOptions: false });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      expect(response.headers.get('X-Content-Type-Options')).toBeNull();
      // Other defaults should still be set
      expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    });

    test('all security headers disabled', async () => {
      const middleware = securityHeaders({
        contentSecurityPolicy: false,
        xFrameOptions: false,
        xContentTypeOptions: false,
        referrerPolicy: false,
        permissionsPolicy: false,
      });
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      expect(response.headers.get('Content-Security-Policy')).toBeNull();
      expect(response.headers.get('X-Frame-Options')).toBeNull();
      expect(response.headers.get('X-Content-Type-Options')).toBeNull();
      expect(response.headers.get('Referrer-Policy')).toBeNull();
      expect(response.headers.get('Permissions-Policy')).toBeNull();
    });

    test('preserves original response status and body', async () => {
      const middleware = securityHeaders();
      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await middleware(request, context, async () => {
        return new Response('Custom body', { status: 201, statusText: 'Created' });
      });

      expect(response.status).toBe(201);
      expect(response.statusText).toBe('Created');
      const body = await response.text();
      expect(body).toBe('Custom body');
    });
  });

  // ============================================================================
  // Additional Tests: MiddlewareChain - use() chaining
  // ============================================================================
  describe('MiddlewareChain - chaining', () => {
    test('use() returns this for chaining', () => {
      const chain = createMiddlewareChain();

      const result = chain
        .use(async (req, ctx, next) => next())
        .use(async (req, ctx, next) => next())
        .use(async (req, ctx, next) => next());

      expect(result).toBe(chain);
    });

    test('execute with empty chain calls final handler directly', async () => {
      const chain = createMiddlewareChain();
      let finalCalled = false;

      const request = new Request('http://localhost:3000/');
      const context = createContext(request);

      const response = await chain.execute(request, context, async () => {
        finalCalled = true;
        return new Response('Final');
      });

      expect(finalCalled).toBe(true);
      expect(await response.text()).toBe('Final');
    });

    test('path matching with exact path', async () => {
      const chain = createMiddlewareChain();
      let called = false;

      chain.use('/exact', async (req, ctx, next) => {
        called = true;
        return next();
      });

      // Exact match
      const request = new Request('http://localhost:3000/exact');
      const context = createContext(request);
      await chain.execute(request, context, async () => new Response('OK'));
      expect(called).toBe(true);

      // Non-match with same prefix
      called = false;
      const request2 = new Request('http://localhost:3000/exact/extra');
      const context2 = createContext(request2);
      await chain.execute(request2, context2, async () => new Response('OK'));
      expect(called).toBe(false);
    });
  });

  // ============================================================================
  // Additional Tests: CORS middleware edge cases
  // ============================================================================
  describe('cors middleware - additional edge cases', () => {
    test('array origin rejects non-listed origin', async () => {
      const middleware = cors({
        origin: ['http://allowed1.com', 'http://allowed2.com'],
      });

      const request = new Request('http://localhost:3000/', {
        headers: { Origin: 'http://evil.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      // Should not set CORS header for non-matching origin
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    test('custom methods in preflight', async () => {
      const middleware = cors({
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'X-Custom'],
        maxAge: 3600,
      });

      const request = new Request('http://localhost:3000/', {
        method: 'OPTIONS',
        headers: { Origin: 'http://test.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('nope'));

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, X-Custom');
      expect(response.headers.get('Access-Control-Max-Age')).toBe('3600');
    });

    test('credentials on regular request', async () => {
      const middleware = cors({
        origin: 'http://app.com',
        credentials: true,
        exposedHeaders: ['X-Request-Id', 'X-Total-Count'],
      });

      const request = new Request('http://localhost:3000/', {
        headers: { Origin: 'http://app.com' },
      });
      const context = createContext(request);

      const response = await middleware(request, context, async () => new Response('OK'));

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://app.com');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(response.headers.get('Access-Control-Expose-Headers')).toBe('X-Request-Id, X-Total-Count');
    });
  });
});
