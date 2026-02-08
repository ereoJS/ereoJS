/**
 * Integration tests for @ereo/core
 *
 * These tests verify that app, context, plugins, cache, and env modules
 * work together as a unified system in realistic request lifecycle scenarios.
 */
import { describe, expect, test, beforeEach } from 'bun:test';
import { createApp, EreoApp } from './app';
import { createContext, RequestContext, attachContext, getContext } from './context';
import { PluginRegistry, definePlugin, composePlugins } from './plugin';
import { MemoryCacheAdapter, createCache, createTaggedCache, isTaggedCache } from './cache';
import { NotFoundError, notFound } from './types';
import type { RouteMatch, Plugin, MiddlewareHandler } from './types';

// ============================================================================
// Full Request Lifecycle: middleware → loader → response
// ============================================================================
describe('Integration: Full request lifecycle', () => {
  test('middleware sets context data, loader reads it, response includes headers', async () => {
    const app = createApp();

    // Auth middleware sets user in context
    app.middleware((req, ctx, next) => {
      ctx.set('user', { id: 1, role: 'admin' });
      ctx.responseHeaders.set('X-Auth', 'verified');
      return next();
    });

    // Logging middleware adds request ID
    app.middleware((req, ctx, next) => {
      ctx.responseHeaders.set('X-Request-Id', 'req-001');
      return next();
    });

    // Loader reads context
    const mockModule = {
      loader: async ({ context }: any) => {
        const user = context.get('user');
        return { greeting: `Hello, user ${user.id}` };
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    // Verify data
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.greeting).toBe('Hello, user 1');

    // Verify headers from middleware
    expect(response.headers.get('X-Auth')).toBe('verified');
    expect(response.headers.get('X-Request-Id')).toBe('req-001');
  });

  test('cache control flows through middleware to response', async () => {
    const app = createApp();

    // Caching middleware
    app.middleware((req, ctx, next) => {
      ctx.cache.set({ maxAge: 3600, staleWhileRevalidate: 86400, tags: ['page'] });
      return next();
    });

    const mockModule = {
      loader: async ({ context }: any) => {
        // Loader adds more cache tags
        context.cache.addTags(['data', 'users']);
        return { users: [] };
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'users', path: '/users', file: '/users.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/users', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600, stale-while-revalidate=86400');
    expect(response.headers.get('X-Cache-Tags')).toBe('page,data,users');
  });

  test('cookies set in middleware persist through to response', async () => {
    const app = createApp();

    app.middleware((req, ctx, next) => {
      (ctx as any).cookies.set('session', 'new-session', {
        maxAge: 7200,
        secure: true,
        sameSite: 'Lax',
      });
      return next();
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: { loader: async () => ({}) } },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    }));

    const setCookies = response.headers.getSetCookie();
    expect(setCookies.length).toBe(1);
    expect(setCookies[0]).toContain('session=new-session');
    expect(setCookies[0]).toContain('Max-Age=7200');
    expect(setCookies[0]).toContain('Secure');
    expect(setCookies[0]).toContain('SameSite=Lax');
  });
});

// ============================================================================
// Error Handling Pipeline
// ============================================================================
describe('Integration: Error handling pipeline', () => {
  test('NotFoundError from loader returns 404 with JSON data', async () => {
    const app = createApp();

    const mockModule = {
      loader: async ({ params }: any) => {
        throw new NotFoundError({ message: `User ${params.id} not found` });
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'user', path: '/users/[id]', file: '/users.tsx', module: mockModule },
      params: { id: '999' },
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/users/999'));

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Not Found');
    expect(data.data.message).toBe('User 999 not found');
  });

  test('middleware error prevents loader from running', async () => {
    const app = createApp({ config: { server: { development: true } } });
    let loaderCalled = false;

    app.middleware((_req, _ctx, _next) => {
      throw new Error('Auth required');
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: {
        id: 'home', path: '/', file: '/index.tsx',
        module: {
          loader: async () => {
            loaderCalled = true;
            return {};
          },
        },
      },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/'));

    expect(response.status).toBe(500);
    expect(loaderCalled).toBe(false);
    const data = await response.json();
    expect(data.error).toBe('Auth required');
  });

  test('middleware can catch and transform errors from later middleware', async () => {
    const app = createApp();

    // Error-catching middleware
    app.middleware(async (req, ctx, next) => {
      try {
        return await next();
      } catch (error) {
        if (error instanceof NotFoundError) {
          return new Response(JSON.stringify({ custom: 'Custom 404' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw error;
      }
    });

    // Route that throws NotFoundError
    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: {
        id: 'home', path: '/', file: '/index.tsx',
        module: {
          loader: async () => { throw new NotFoundError(); },
        },
      },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    }));

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.custom).toBe('Custom 404');
  });
});

// ============================================================================
// Plugin System Integration
// ============================================================================
describe('Integration: Plugin system with app lifecycle', () => {
  test('plugins registered via config are initialized on dev()', async () => {
    const events: string[] = [];

    const analyticsPlugin = definePlugin({
      name: 'analytics',
      setup: (ctx) => {
        events.push(`analytics:setup:${ctx.mode}`);
      },
      buildStart: async () => {
        events.push('analytics:buildStart');
      },
      buildEnd: async () => {
        events.push('analytics:buildEnd');
      },
    });

    const app = createApp({ config: { plugins: [analyticsPlugin] } });
    await app.dev();

    expect(events).toEqual(['analytics:setup:development']);
  });

  test('plugins registered via config and use() both initialize on build()', async () => {
    const events: string[] = [];

    const configPlugin = definePlugin({
      name: 'config-plugin',
      setup: () => { events.push('config:setup'); },
      buildStart: async () => { events.push('config:buildStart'); },
      buildEnd: async () => { events.push('config:buildEnd'); },
    });

    const usePlugin = definePlugin({
      name: 'use-plugin',
      setup: () => { events.push('use:setup'); },
      buildStart: async () => { events.push('use:buildStart'); },
      buildEnd: async () => { events.push('use:buildEnd'); },
    });

    const app = createApp({ config: { plugins: [configPlugin] } });
    app.use(usePlugin);
    await app.build();

    expect(events).toEqual([
      'config:setup',
      'use:setup',
      'config:buildStart',
      'use:buildStart',
      'config:buildEnd',
      'use:buildEnd',
    ]);
  });

  test('composed plugins work with plugin registry', async () => {
    const transforms: string[] = [];

    const composed = composePlugins('ereo:composed', [
      definePlugin({
        name: 'minifier',
        transform: (code, id) => {
          transforms.push(`minify:${id}`);
          return code.replace(/\s+/g, ' ');
        },
      }),
      definePlugin({
        name: 'banner',
        transform: (code, id) => {
          transforms.push(`banner:${id}`);
          return `/* ereo */ ${code}`;
        },
      }),
    ]);

    const registry = new PluginRegistry({}, 'development', '/test');
    await registry.register(composed);

    const result = await registry.transform('const  x  =  1;', 'app.ts');

    expect(transforms).toEqual(['minify:app.ts', 'banner:app.ts']);
    expect(result).toBe('/* ereo */ const x = 1;');
  });

  test('plugin virtual modules work end-to-end', async () => {
    const envPlugin = definePlugin({
      name: 'env-virtual',
      resolveId: (id) => id === 'virtual:env' ? '\0virtual:env' : null,
      load: async (id) => id === '\0virtual:env'
        ? 'export const API_URL = "https://api.example.com";'
        : null,
    });

    const registry = new PluginRegistry({}, 'production', '/app');
    await registry.register(envPlugin);

    const resolved = registry.resolveId('virtual:env');
    expect(resolved).toBe('\0virtual:env');

    const content = await registry.load(resolved!);
    expect(content).toContain('API_URL');
    expect(content).toContain('https://api.example.com');
  });
});

// ============================================================================
// Cache + Context Integration
// ============================================================================
describe('Integration: Cache and context', () => {
  test('cache stores and retrieves loader data between requests', async () => {
    const cache = new MemoryCacheAdapter();
    const app = createApp();

    let dbCallCount = 0;

    const mockModule = {
      loader: async ({ params, context }: any) => {
        const cacheKey = `user:${params.id}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
          context.cache.set({ maxAge: 300 });
          return cached;
        }

        dbCallCount++;
        const data = { id: params.id, name: 'User' };
        await cache.set(cacheKey, data, { ttl: 300, tags: ['users'] });
        context.cache.set({ maxAge: 300, tags: ['users'] });
        return data;
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => {
      const match = pathname.match(/^\/users\/(\w+)$/);
      if (match) {
        return {
          route: { id: 'user', path: '/users/[id]', file: '/users.tsx', module: mockModule },
          params: { id: match[1] },
          pathname,
        };
      }
      return null;
    });

    // First request — hits "database"
    const r1 = await app.handle(new Request('http://localhost:3000/users/42', {
      headers: { Accept: 'application/json' },
    }));
    expect(r1.status).toBe(200);
    expect(dbCallCount).toBe(1);

    // Second request — should use cache
    const r2 = await app.handle(new Request('http://localhost:3000/users/42', {
      headers: { Accept: 'application/json' },
    }));
    expect(r2.status).toBe(200);
    expect(dbCallCount).toBe(1); // still 1 — cache hit

    // Invalidate cache
    await cache.invalidateTag('users');

    // Third request — cache miss after invalidation
    const r3 = await app.handle(new Request('http://localhost:3000/users/42', {
      headers: { Accept: 'application/json' },
    }));
    expect(r3.status).toBe(200);
    expect(dbCallCount).toBe(2); // incremented
  });

  test('tagged cache invalidation works with tag-based groups', async () => {
    const cache = createTaggedCache();

    await cache.set('post:1', { title: 'Post 1' }, { tags: ['posts', 'user:alice'] });
    await cache.set('post:2', { title: 'Post 2' }, { tags: ['posts', 'user:bob'] });
    await cache.set('profile:alice', { name: 'Alice' }, { tags: ['user:alice'] });

    // Invalidate all posts by alice
    await cache.invalidateTag('user:alice');

    expect(await cache.has('post:1')).toBe(false);    // alice's post — gone
    expect(await cache.has('post:2')).toBe(true);      // bob's post — safe
    expect(await cache.has('profile:alice')).toBe(false); // alice's profile — gone
  });
});

// ============================================================================
// Context Isolation Between Requests
// ============================================================================
describe('Integration: Request isolation', () => {
  test('each request gets its own isolated context', async () => {
    const app = createApp();
    const contexts: any[] = [];

    app.middleware((req, ctx, next) => {
      ctx.set('requestUrl', req.url);
      contexts.push(ctx);
      return next();
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: { loader: async () => ({}) } },
      params: {},
      pathname,
    }));

    await Promise.all([
      app.handle(new Request('http://localhost:3000/a')),
      app.handle(new Request('http://localhost:3000/b')),
      app.handle(new Request('http://localhost:3000/c')),
    ]);

    expect(contexts.length).toBe(3);
    expect(contexts[0].get('requestUrl')).toContain('/a');
    expect(contexts[1].get('requestUrl')).toContain('/b');
    expect(contexts[2].get('requestUrl')).toContain('/c');

    // Verify they are different instances
    expect(contexts[0]).not.toBe(contexts[1]);
    expect(contexts[1]).not.toBe(contexts[2]);
  });

  test('cookies from different requests do not leak', async () => {
    const req1 = new Request('http://localhost:3000/', {
      headers: { Cookie: 'session=user1' },
    });
    const req2 = new Request('http://localhost:3000/', {
      headers: { Cookie: 'session=user2' },
    });

    const ctx1 = createContext(req1);
    const ctx2 = createContext(req2);

    expect(ctx1.cookies.get('session')).toBe('user1');
    expect(ctx2.cookies.get('session')).toBe('user2');
  });
});

// ============================================================================
// Middleware Chain With Response Modification
// ============================================================================
describe('Integration: Middleware response modification', () => {
  test('middleware can modify response from next()', async () => {
    const app = createApp();

    // Timing middleware
    app.middleware(async (req, ctx, next) => {
      const start = Date.now();
      const response = await next();
      ctx.responseHeaders.set('X-Response-Time', `${Date.now() - start}ms`);
      return response;
    });

    // CORS middleware
    app.middleware(async (req, ctx, next) => {
      ctx.responseHeaders.set('Access-Control-Allow-Origin', '*');
      return next();
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'api', path: '/api', file: '/api.tsx', module: { loader: async () => ({ ok: true }) } },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/api', {
      headers: { Accept: 'application/json' },
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Response-Time')).toBeDefined();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  test('middleware can short-circuit with redirect', async () => {
    const app = createApp();

    app.middleware((req, ctx, next) => {
      const url = new URL(req.url);
      if (url.pathname === '/old-path') {
        return new Response(null, {
          status: 302,
          headers: { Location: '/new-path' },
        });
      }
      return next();
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: { loader: async () => ({}) } },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/old-path'));

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/new-path');
  });
});

// ============================================================================
// attachContext/getContext integration
// ============================================================================
describe('Integration: Context attachment', () => {
  test('context attached in middleware is retrievable later', () => {
    const request = new Request('http://localhost:3000/');
    const context = createContext(request);

    context.set('user', { id: 1 });
    attachContext(request, context);

    // Later, retrieve context
    const retrieved = getContext(request);
    expect(retrieved).toBe(context);
    expect(retrieved!.get('user')).toEqual({ id: 1 });
  });
});

// ============================================================================
// Type Guards Integration
// ============================================================================
describe('Integration: Type guards work correctly', () => {
  test('isTaggedCache correctly identifies cache types', () => {
    const basic = createCache();
    const tagged = createTaggedCache();
    const memory = new MemoryCacheAdapter();

    // MemoryCacheAdapter always implements TaggedCache
    expect(isTaggedCache(basic)).toBe(true);
    expect(isTaggedCache(tagged)).toBe(true);
    expect(isTaggedCache(memory)).toBe(true);
  });
});

// ============================================================================
// Multiple HTTP methods on same route
// ============================================================================
describe('Integration: Multiple HTTP methods', () => {
  test('GET uses loader, POST/PUT/DELETE/PATCH use action on same route', async () => {
    const app = createApp();
    const events: string[] = [];

    const mockModule = {
      loader: async () => {
        events.push('loader');
        return { items: [] };
      },
      action: async ({ request }: any) => {
        events.push(`action:${request.method}`);
        return { success: true };
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'items', path: '/items', file: '/items.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    // GET → loader
    await app.handle(new Request('http://localhost:3000/items', {
      headers: { Accept: 'application/json' },
    }));

    // POST → action
    await app.handle(new Request('http://localhost:3000/items', { method: 'POST' }));

    // PUT → action
    await app.handle(new Request('http://localhost:3000/items', { method: 'PUT' }));

    // DELETE → action
    await app.handle(new Request('http://localhost:3000/items', { method: 'DELETE' }));

    // PATCH → action
    await app.handle(new Request('http://localhost:3000/items', { method: 'PATCH' }));

    // HEAD → loader (treated as GET)
    await app.handle(new Request('http://localhost:3000/items', { method: 'HEAD' }));

    expect(events).toEqual([
      'loader',
      'action:POST',
      'action:PUT',
      'action:DELETE',
      'action:PATCH',
      'loader', // HEAD treated as GET
    ]);
  });
});
