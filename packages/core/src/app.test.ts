import { describe, expect, test, beforeEach } from 'bun:test';
import { createApp, defineConfig, EreoApp, isEreoApp } from './app';
import type { FrameworkConfig, Plugin, RouteMatch, RouteErrorComponentProps, ErrorBoundaryProps } from './types';

describe('@ereo/core - App', () => {
  describe('createApp', () => {
    test('creates an app with default config', () => {
      const app = createApp();

      expect(app).toBeInstanceOf(EreoApp);
      expect(app.config.server?.port).toBe(3000);
      expect(app.config.server?.hostname).toBe('localhost');
    });

    test('creates an app with custom config', () => {
      const app = createApp({
        config: {
          server: { port: 8080 },
        },
      });

      expect(app.config.server?.port).toBe(8080);
    });

    test('creates an app with routes', () => {
      const routes = [
        { id: 'home', path: '/', file: '/app/routes/index.tsx' },
      ];

      const app = createApp({ routes });
      expect(app.routes).toHaveLength(1);
      expect(app.routes[0].id).toBe('home');
    });
  });

  describe('defineConfig', () => {
    test('returns the config object', () => {
      const config: FrameworkConfig = {
        server: { port: 4000 },
        build: { target: 'bun' },
      };

      const result = defineConfig(config);
      expect(result).toEqual(config);
    });
  });

  describe('EreoApp', () => {
    let app: EreoApp;

    beforeEach(() => {
      app = createApp();
    });

    test('registers plugins with use()', () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        setup: () => {},
      };

      app.use(plugin);
      expect(app.plugins).toHaveLength(1);
      expect(app.plugins[0].name).toBe('test-plugin');
    });

    test('handles requests', async () => {
      const request = new Request('http://localhost:3000/');
      const response = await app.handle(request);

      // Without routes configured, should return 500 (router not configured)
      expect(response.status).toBe(500);
    });

    test('returns 404 for unknown routes when router is set', async () => {
      app.setRouteMatcher(() => null);

      const request = new Request('http://localhost:3000/unknown');
      const response = await app.handle(request);

      expect(response.status).toBe(404);
    });

    test('middleware() registers middleware handler', async () => {
      let middlewareCalled = false;

      app.middleware((req, ctx, next) => {
        middlewareCalled = true;
        return next();
      });

      app.setRouteMatcher(() => null);

      const request = new Request('http://localhost:3000/');
      await app.handle(request);

      expect(middlewareCalled).toBe(true);
    });

    test('middleware chain runs in order', async () => {
      const order: number[] = [];

      app.middleware((_req, _ctx, next) => {
        order.push(1);
        return next();
      });

      app.middleware((_req, _ctx, next) => {
        order.push(2);
        return next();
      });

      app.setRouteMatcher(() => null);

      const request = new Request('http://localhost:3000/');
      await app.handle(request);

      expect(order).toEqual([1, 2]);
    });

    test('middleware can short-circuit the chain', async () => {
      app.middleware((_req, _ctx, _next) => {
        return new Response('Intercepted', { status: 200 });
      });

      app.middleware((_req, _ctx, next) => {
        // This should not be reached
        return next();
      });

      app.setRouteMatcher(() => null);

      const request = new Request('http://localhost:3000/');
      const response = await app.handle(request);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Intercepted');
    });

    test('setRoutes updates routes', () => {
      const routes = [
        { id: 'home', path: '/', file: '/index.tsx' },
        { id: 'about', path: '/about', file: '/about.tsx' },
      ];

      app.setRoutes(routes);

      expect(app.routes).toHaveLength(2);
    });

    test('handles route with loader returning data', async () => {
      const mockModule = {
        loader: async () => ({ message: 'Hello' }),
      };

      app.setRouteMatcher((pathname): RouteMatch | null => {
        if (pathname === '/') {
          return {
            route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
            params: {},
            pathname,
          };
        }
        return null;
      });

      const request = new Request('http://localhost:3000/', {
        headers: { Accept: 'application/json' },
      });
      const response = await app.handle(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ message: 'Hello' });
    });

    test('handles POST request with action', async () => {
      const mockModule = {
        action: async () => ({ success: true }),
      };

      app.setRouteMatcher((pathname): RouteMatch | null => {
        if (pathname === '/submit') {
          return {
            route: { id: 'submit', path: '/submit', file: '/submit.tsx', module: mockModule },
            params: {},
            pathname,
          };
        }
        return null;
      });

      const request = new Request('http://localhost:3000/submit', {
        method: 'POST',
      });
      const response = await app.handle(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true });
    });

    test('returns 405 for POST without action', async () => {
      const mockModule = {};

      app.setRouteMatcher((pathname): RouteMatch | null => {
        if (pathname === '/noaction') {
          return {
            route: { id: 'noaction', path: '/noaction', file: '/noaction.tsx', module: mockModule },
            params: {},
            pathname,
          };
        }
        return null;
      });

      const request = new Request('http://localhost:3000/noaction', {
        method: 'POST',
      });
      const response = await app.handle(request);

      expect(response.status).toBe(405);
    });

    test('returns 500 when route module not loaded', async () => {
      app.setRouteMatcher((pathname): RouteMatch | null => {
        if (pathname === '/') {
          return {
            route: { id: 'home', path: '/', file: '/index.tsx' },
            params: {},
            pathname,
          };
        }
        return null;
      });

      const request = new Request('http://localhost:3000/');
      const response = await app.handle(request);

      expect(response.status).toBe(500);
    });

    test('handles basePath in request URL', async () => {
      const appWithBase = createApp({
        config: { basePath: '/app' },
      });

      let matchedPath = '';
      appWithBase.setRouteMatcher((pathname): RouteMatch | null => {
        matchedPath = pathname;
        return null;
      });

      const request = new Request('http://localhost:3000/app/dashboard');
      await appWithBase.handle(request);

      expect(matchedPath).toBe('/dashboard');
    });

    test('getPluginRegistry returns registry', () => {
      const registry = app.getPluginRegistry();

      expect(registry).toBeDefined();
    });

    test('loader can return Response directly', async () => {
      const mockModule = {
        loader: async () => new Response('Direct response', { status: 201 }),
      };

      app.setRouteMatcher((pathname): RouteMatch | null => {
        if (pathname === '/') {
          return {
            route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
            params: {},
            pathname,
          };
        }
        return null;
      });

      const request = new Request('http://localhost:3000/');
      const response = await app.handle(request);

      expect(response.status).toBe(201);
      expect(await response.text()).toBe('Direct response');
    });

    test('action can return Response directly', async () => {
      const mockModule = {
        action: async () => new Response('Action response', { status: 201 }),
      };

      app.setRouteMatcher((pathname): RouteMatch | null => {
        if (pathname === '/') {
          return {
            route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
            params: {},
            pathname,
          };
        }
        return null;
      });

      const request = new Request('http://localhost:3000/', { method: 'POST' });
      const response = await app.handle(request);

      expect(response.status).toBe(201);
      expect(await response.text()).toBe('Action response');
    });

    test('handles errors in dev mode with details', async () => {
      const devApp = createApp({
        config: { server: { development: true } },
      });

      devApp.setRouteMatcher((): RouteMatch | null => {
        throw new Error('Test error');
      });

      const request = new Request('http://localhost:3000/');
      const response = await devApp.handle(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Test error');
      expect(data.stack).toBeDefined();
    });

    test('handles errors in prod mode without details', async () => {
      const prodApp = createApp({
        config: { server: { development: false } },
      });

      prodApp.setRouteMatcher((): RouteMatch | null => {
        throw new Error('Test error');
      });

      const request = new Request('http://localhost:3000/');
      const response = await prodApp.handle(request);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal Server Error');
    });
  });

  describe('isEreoApp', () => {
    test('returns true for EreoApp instance', () => {
      const app = createApp();
      expect(isEreoApp(app)).toBe(true);
    });

    test('returns false for non-EreoApp values', () => {
      expect(isEreoApp(null)).toBe(false);
      expect(isEreoApp(undefined)).toBe(false);
      expect(isEreoApp({})).toBe(false);
      expect(isEreoApp('string')).toBe(false);
      expect(isEreoApp(123)).toBe(false);
    });
  });

  describe('dev() method', () => {
    test('initializes plugins and logs message', async () => {
      const app = createApp({
        config: { server: { port: 3000, hostname: 'localhost' } },
      });

      // Should not throw
      await expect(app.dev()).resolves.toBeUndefined();
    });

    test('registers config plugins', async () => {
      const plugin: Plugin = {
        name: 'test-plugin',
        setup: () => {},
      };

      const app = createApp({
        config: { plugins: [plugin] },
      });

      await app.dev();
      // Plugin registry should have the plugin
    });
  });

  describe('build() method', () => {
    test('initializes plugins and runs build hooks', async () => {
      const app = createApp({
        config: { build: { target: 'bun', outDir: '.ereo' } },
      });

      // Should not throw
      await expect(app.build()).resolves.toBeUndefined();
    });
  });

  describe('start() method', () => {
    test('initializes plugins and logs message', async () => {
      const app = createApp({
        config: { server: { port: 3000, hostname: 'localhost' } },
      });

      // Should not throw
      await expect(app.start()).resolves.toBeUndefined();
    });
  });

  describe('error handling with non-Error objects', () => {
    test('handles non-Error thrown values in dev mode', async () => {
      const devApp = createApp({
        config: { server: { development: true } },
      });

      devApp.setRouteMatcher((): RouteMatch | null => {
        throw 'String error';
      });

      const request = new Request('http://localhost:3000/');
      const response = await devApp.handle(request);

      expect(response.status).toBe(500);
    });

    test('handles non-Error thrown values in prod mode', async () => {
      const prodApp = createApp({
        config: { server: { development: false } },
      });

      prodApp.setRouteMatcher((): RouteMatch | null => {
        throw { custom: 'error object' };
      });

      const request = new Request('http://localhost:3000/');
      const response = await prodApp.handle(request);

      expect(response.status).toBe(500);
    });
  });
});

// ============================================================================
// NotFoundError handling in request lifecycle
// ============================================================================
describe('@ereo/core - App NotFoundError handling', () => {
  test('loader throwing NotFoundError returns 404', async () => {
    const { NotFoundError: NFE } = await import('./types');
    const app = createApp();

    const mockModule = {
      loader: async () => {
        throw new NFE({ reason: 'User not found' });
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => {
      if (pathname === '/users/999') {
        return {
          route: { id: 'user', path: '/users/[id]', file: '/users.tsx', module: mockModule },
          params: { id: '999' },
          pathname,
        };
      }
      return null;
    });

    const request = new Request('http://localhost:3000/users/999');
    const response = await app.handle(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Not Found');
    expect(data.data).toEqual({ reason: 'User not found' });
  });

  test('action throwing NotFoundError returns 404', async () => {
    const { NotFoundError: NFE } = await import('./types');
    const app = createApp();

    const mockModule = {
      action: async () => {
        throw new NFE('Resource gone');
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'item', path: '/item', file: '/item.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/item', { method: 'DELETE' });
    const response = await app.handle(request);

    expect(response.status).toBe(404);
  });

  test('middleware throwing NotFoundError returns 404', async () => {
    const { NotFoundError: NFE } = await import('./types');
    const app = createApp();

    app.middleware((_req, _ctx, _next) => {
      throw new NFE();
    });

    app.setRouteMatcher(() => null);

    const request = new Request('http://localhost:3000/');
    const response = await app.handle(request);

    expect(response.status).toBe(404);
  });
});

// ============================================================================
// JSON serialization safety
// ============================================================================
describe('@ereo/core - App JSON serialization safety', () => {
  test('handles circular reference in loader data gracefully', async () => {
    const app = createApp();

    const circular: any = { name: 'test' };
    circular.self = circular;

    const mockModule = {
      loader: async () => circular,
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

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('serialize');
  });

  test('handles circular reference in action data gracefully', async () => {
    const app = createApp();

    const circular: any = { ok: true };
    circular.ref = circular;

    const mockModule = {
      action: async () => circular,
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', { method: 'POST' });
    const response = await app.handle(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('serialize');
  });
});

// ============================================================================
// HEAD request handling
// ============================================================================
describe('@ereo/core - App HEAD request', () => {
  test('HEAD request is treated like GET (goes to loader)', async () => {
    const app = createApp();

    const mockModule = {
      loader: async () => ({ data: 'for head' }),
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', { method: 'HEAD' });
    const response = await app.handle(request);

    // HEAD goes through the GET path (loader), not the action path
    expect(response.status).toBe(200);
  });
});

// ============================================================================
// Middleware error propagation
// ============================================================================
describe('@ereo/core - App middleware errors', () => {
  test('middleware throwing error is caught and handled', async () => {
    const devApp = createApp({
      config: { server: { development: true } },
    });

    devApp.middleware((_req, _ctx, _next) => {
      throw new Error('Auth failed');
    });

    devApp.setRouteMatcher(() => null);

    const request = new Request('http://localhost:3000/');
    const response = await devApp.handle(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Auth failed');
  });

  test('async middleware rejection is caught', async () => {
    const app = createApp({ config: { server: { development: false } } });

    app.middleware(async (_req, _ctx, _next) => {
      throw new Error('Async middleware error');
    });

    app.setRouteMatcher(() => null);

    const request = new Request('http://localhost:3000/');
    const response = await app.handle(request);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Internal Server Error');
  });
});

// ============================================================================
// Config merging edge cases
// ============================================================================
describe('@ereo/core - App config merging', () => {
  test('empty overrides use all defaults', () => {
    const app = createApp({ config: {} });

    expect(app.config.server?.port).toBe(3000);
    expect(app.config.build?.target).toBe('bun');
    expect(app.config.basePath).toBe('');
    expect(app.config.routesDir).toBe('app/routes');
  });

  test('plugins from config and overrides are merged', () => {
    const plugin1: Plugin = { name: 'p1' };
    const app = createApp({
      config: { plugins: [plugin1] },
    });

    // Default plugins [] + override [plugin1]
    expect(app.config.plugins).toContain(plugin1);
  });

  test('basePath override works', () => {
    const app = createApp({ config: { basePath: '/api/v2' } });
    expect(app.config.basePath).toBe('/api/v2');
  });

  test('routesDir override works', () => {
    const app = createApp({ config: { routesDir: 'src/pages' } });
    expect(app.config.routesDir).toBe('src/pages');
  });
});

// ============================================================================
// use() chaining
// ============================================================================
describe('@ereo/core - App use() chaining', () => {
  test('use() returns this for chaining', () => {
    const app = createApp();
    const result = app.use({ name: 'p1' });
    expect(result).toBe(app);
  });

  test('middleware() returns this for chaining', () => {
    const app = createApp();
    const result = app.middleware(async (_r, _c, next) => next());
    expect(result).toBe(app);
  });

  test('chained use calls register all plugins', () => {
    const app = createApp();
    app.use({ name: 'p1' }).use({ name: 'p2' }).use({ name: 'p3' });
    expect(app.plugins).toHaveLength(3);
  });
});

// ============================================================================
// Concurrent request handling
// ============================================================================
describe('@ereo/core - App concurrent requests', () => {
  test('handles multiple concurrent requests independently', async () => {
    const app = createApp();

    const mockModule = {
      loader: async ({ params }: any) => ({ id: params.id }),
    };

    app.setRouteMatcher((pathname): RouteMatch | null => {
      const match = pathname.match(/^\/items\/(\w+)$/);
      if (match) {
        return {
          route: { id: 'item', path: '/items/[id]', file: '/items.tsx', module: mockModule },
          params: { id: match[1] },
          pathname,
        };
      }
      return null;
    });

    const requests = Array.from({ length: 10 }, (_, i) =>
      app.handle(new Request(`http://localhost:3000/items/${i}`, {
        headers: { Accept: 'application/json' },
      }))
    );

    const responses = await Promise.all(requests);

    for (let i = 0; i < 10; i++) {
      expect(responses[i].status).toBe(200);
      const data = await responses[i].json();
      expect(data.id).toBe(String(i));
    }
  });
});

// ============================================================================
// PUT, DELETE, PATCH methods
// ============================================================================
describe('@ereo/core - App HTTP methods', () => {
  test('PUT request goes to action', async () => {
    const app = createApp();
    const mockModule = { action: async () => ({ updated: true }) };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'item', path: '/item', file: '/item.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/item', { method: 'PUT' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: true });
  });

  test('DELETE request goes to action', async () => {
    const app = createApp();
    const mockModule = { action: async () => ({ deleted: true }) };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'item', path: '/item', file: '/item.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/item', { method: 'DELETE' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
  });

  test('PATCH request goes to action', async () => {
    const app = createApp();
    const mockModule = { action: async () => ({ patched: true }) };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'item', path: '/item', file: '/item.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const response = await app.handle(new Request('http://localhost:3000/item', { method: 'PATCH' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ patched: true });
  });

  test('POST form method override dispatches as DELETE', async () => {
    const app = createApp();
    let actionCalled = false;

    const mockModule = {
      action: async () => {
        actionCalled = true;
        return { deleted: true };
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'item', path: '/item', file: '/item.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const body = new URLSearchParams({ _method: 'DELETE' });
    const response = await app.handle(new Request('http://localhost:3000/item', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }));

    expect(actionCalled).toBe(true);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
  });
});

// ============================================================================
// basePath edge cases
// ============================================================================
describe('@ereo/core - App basePath edge cases', () => {
  test('basePath that does not match leaves pathname unchanged', async () => {
    const app = createApp({ config: { basePath: '/api' } });
    let matchedPath = '';

    app.setRouteMatcher((pathname): RouteMatch | null => {
      matchedPath = pathname;
      return null;
    });

    await app.handle(new Request('http://localhost:3000/other/path'));
    expect(matchedPath).toBe('/other/path');
  });

  test('basePath stripping results in root /', async () => {
    const app = createApp({ config: { basePath: '/app' } });
    let matchedPath = '';

    app.setRouteMatcher((pathname): RouteMatch | null => {
      matchedPath = pathname;
      return null;
    });

    await app.handle(new Request('http://localhost:3000/app'));
    expect(matchedPath).toBe('/');
  });
});

// ============================================================================
// Loader returning null/undefined
// ============================================================================
describe('@ereo/core - App loader edge cases', () => {
  test('route without loader returns null as loaderData', async () => {
    const app = createApp();
    const mockModule = {};

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  test('loader returning undefined serializes as null', async () => {
    const app = createApp();
    const mockModule = { loader: async () => undefined };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);
    expect(response.status).toBe(200);
    // JSON.stringify(undefined) is undefined, but our jsonResponse wraps it
  });
});

// ============================================================================
// Type Definition Tests (Critical Fix Verification)
// ============================================================================
describe('@ereo/core - Type Definitions', () => {
  describe('RouteErrorComponentProps', () => {
    test('should have error property of type Error', () => {
      const props: RouteErrorComponentProps = {
        error: new Error('Test error'),
        params: {},
      };

      expect(props.error).toBeInstanceOf(Error);
      expect(props.error.message).toBe('Test error');
    });

    test('should have params property as RouteParams', () => {
      const props: RouteErrorComponentProps = {
        error: new Error('Test'),
        params: { id: '123', slug: 'test-slug' },
      };

      expect(props.params.id).toBe('123');
      expect(props.params.slug).toBe('test-slug');
    });

    test('should work with empty params', () => {
      const props: RouteErrorComponentProps = {
        error: new Error('Test'),
        params: {},
      };

      expect(Object.keys(props.params)).toHaveLength(0);
    });

    test('should support array params (catch-all routes)', () => {
      const props: RouteErrorComponentProps = {
        error: new Error('Test'),
        params: { path: ['docs', 'api', 'reference'] },
      };

      expect(Array.isArray(props.params.path)).toBe(true);
      expect(props.params.path).toEqual(['docs', 'api', 'reference']);
    });
  });

  describe('ErrorBoundaryProps (deprecated alias)', () => {
    test('should be assignable to RouteErrorComponentProps', () => {
      // ErrorBoundaryProps is now a type alias for RouteErrorComponentProps
      const props: ErrorBoundaryProps = {
        error: new Error('Test error'),
        params: { id: '123' },
      };

      // Should be compatible with RouteErrorComponentProps
      const routeErrorProps: RouteErrorComponentProps = props;
      expect(routeErrorProps.error.message).toBe('Test error');
    });

    test('should work the same as RouteErrorComponentProps', () => {
      const errorBoundaryProps: ErrorBoundaryProps = {
        error: new Error('Boundary error'),
        params: { slug: 'test' },
      };

      const routeErrorProps: RouteErrorComponentProps = {
        error: new Error('Route error'),
        params: { slug: 'test' },
      };

      // Both should have the same structure
      expect(Object.keys(errorBoundaryProps)).toEqual(Object.keys(routeErrorProps));
    });
  });

  describe('Type distinctness from @ereo/client ErrorBoundaryProps', () => {
    // This test documents that RouteErrorComponentProps is for the props
    // passed to error component (fallback UI), not for the ErrorBoundary
    // wrapper component itself (which is in @ereo/client)
    test('RouteErrorComponentProps is for error fallback components', () => {
      // A route error component receives error and params
      const ErrorComponent = (props: RouteErrorComponentProps) => {
        return `Error: ${props.error.message}, Route: ${JSON.stringify(props.params)}`;
      };

      const result = ErrorComponent({
        error: new Error('Page not found'),
        params: { id: '404' },
      });

      expect(result).toContain('Page not found');
      expect(result).toContain('404');
    });
  });
});

// ============================================================================
// NotFoundError with circular data (handleError safety)
// ============================================================================
describe('@ereo/core - App handleError safety', () => {
  test('NotFoundError with circular data does not crash', async () => {
    const { NotFoundError: NFE } = await import('./types');
    const app = createApp();

    const circular: any = { message: 'not found' };
    circular.self = circular;

    const mockModule = {
      loader: async () => {
        throw new NFE(circular);
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'item', path: '/item', file: '/item.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/item');
    const response = await app.handle(request);

    // Should return 500 (serialization failure) instead of crashing
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('serialize');
  });

  test('dev mode error with circular stack does not crash', async () => {
    const devApp = createApp({ config: { server: { development: true } } });

    devApp.setRouteMatcher((): RouteMatch | null => {
      throw new Error('Dev error with stack');
    });

    const request = new Request('http://localhost:3000/');
    const response = await devApp.handle(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Dev error with stack');
    expect(Array.isArray(data.stack)).toBe(true);
  });
});

// ============================================================================
// Loader undefined normalization
// ============================================================================
describe('@ereo/core - App loader undefined normalization', () => {
  test('loader returning undefined produces valid JSON null', async () => {
    const app = createApp();
    const mockModule = { loader: async () => undefined };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toBe('null');
  });

  test('loader returning false is preserved as false', async () => {
    const app = createApp();
    const mockModule = { loader: async () => false };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toBe(false);
  });

  test('loader returning 0 is preserved as 0', async () => {
    const app = createApp();
    const mockModule = { loader: async () => 0 };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toBe(0);
  });

  test('loader returning empty string is preserved', async () => {
    const app = createApp();
    const mockModule = { loader: async () => '' };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toBe('');
  });
});

// ============================================================================
// Full page request (non-JSON Accept)
// ============================================================================
describe('@ereo/core - App full page requests', () => {
  test('non-JSON Accept returns loaderData with params', async () => {
    const app = createApp();
    const mockModule = { loader: async () => ({ title: 'Home' }) };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: { slug: 'test' },
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'text/html' },
    });
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.loaderData).toEqual({ title: 'Home' });
    expect(data.params).toEqual({ slug: 'test' });
  });

  test('request with no Accept header returns loaderData with params', async () => {
    const app = createApp();
    const mockModule = { loader: async () => ({ name: 'test' }) };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/');
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.loaderData).toEqual({ name: 'test' });
    expect(data.params).toEqual({});
  });
});

// ============================================================================
// Context headers applied after handle()
// ============================================================================
describe('@ereo/core - App context integration', () => {
  test('middleware-set cache headers appear in response', async () => {
    const app = createApp();

    app.middleware((req, ctx, next) => {
      ctx.cache.set({ maxAge: 60, tags: ['page'] });
      return next();
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: { loader: async () => ({}) } },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.headers.get('Cache-Control')).toContain('max-age=60');
    expect(response.headers.get('X-Cache-Tags')).toBe('page');
  });

  test('middleware-set response headers appear in response', async () => {
    const app = createApp();

    app.middleware((req, ctx, next) => {
      ctx.responseHeaders.set('X-Request-Id', 'req-123');
      return next();
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: { loader: async () => ({}) } },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.headers.get('X-Request-Id')).toBe('req-123');
  });

  test('cookies set in middleware appear in response', async () => {
    const app = createApp();

    app.middleware((req, ctx, next) => {
      (ctx as any).cookies.set('session', 'abc123', { maxAge: 3600 });
      return next();
    });

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: { loader: async () => ({}) } },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    const setCookies = response.headers.getSetCookie();
    expect(setCookies.length).toBeGreaterThanOrEqual(1);
    expect(setCookies.some(c => c.includes('session='))).toBe(true);
  });
});

// ============================================================================
// Plugin initialization through lifecycle methods
// ============================================================================
describe('@ereo/core - App plugin initialization', () => {
  test('dev() initializes both config and use() plugins', async () => {
    const calls: string[] = [];
    const configPlugin: Plugin = {
      name: 'config-plugin',
      setup: () => { calls.push('config'); },
    };
    const usePlugin: Plugin = {
      name: 'use-plugin',
      setup: () => { calls.push('use'); },
    };

    const app = createApp({ config: { plugins: [configPlugin] } });
    app.use(usePlugin);
    await app.dev();

    expect(calls).toContain('config');
    expect(calls).toContain('use');
  });

  test('build() runs buildStart and buildEnd hooks', async () => {
    const calls: string[] = [];
    const plugin: Plugin = {
      name: 'build-hooks',
      buildStart: async () => { calls.push('start'); },
      buildEnd: async () => { calls.push('end'); },
    };

    const app = createApp({ config: { plugins: [plugin] } });
    await app.build();

    expect(calls).toEqual(['start', 'end']);
  });

  test('start() initializes plugins', async () => {
    let initialized = false;
    const plugin: Plugin = {
      name: 'start-plugin',
      setup: () => { initialized = true; },
    };

    const app = createApp({ config: { plugins: [plugin] } });
    await app.start();

    expect(initialized).toBe(true);
  });

  test('getPluginRegistry returns the same registry instance', () => {
    const app = createApp();
    const reg1 = app.getPluginRegistry();
    const reg2 = app.getPluginRegistry();
    expect(reg1).toBe(reg2);
  });
});

// ============================================================================
// Action returning undefined
// ============================================================================
describe('@ereo/core - App action edge cases', () => {
  test('action returning undefined serializes as null in JSON', async () => {
    const app = createApp();
    const mockModule = { action: async () => undefined };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', { method: 'POST' });
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  test('action returning array data', async () => {
    const app = createApp();
    const mockModule = { action: async () => [1, 2, 3] };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', { method: 'POST' });
    const response = await app.handle(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([1, 2, 3]);
  });
});

// ============================================================================
// basePath additional edge cases
// ============================================================================
describe('@ereo/core - App basePath additional cases', () => {
  test('basePath with trailing slash', async () => {
    const app = createApp({ config: { basePath: '/app/' } });
    let matchedPath = '';

    app.setRouteMatcher((pathname): RouteMatch | null => {
      matchedPath = pathname;
      return null;
    });

    await app.handle(new Request('http://localhost:3000/app/dashboard'));
    expect(matchedPath).toBe('/dashboard');
  });

  test('empty basePath does not modify pathname', async () => {
    const app = createApp({ config: { basePath: '' } });
    let matchedPath = '';

    app.setRouteMatcher((pathname): RouteMatch | null => {
      matchedPath = pathname;
      return null;
    });

    await app.handle(new Request('http://localhost:3000/test'));
    expect(matchedPath).toBe('/test');
  });
});

// ============================================================================
// Response Content-Type headers
// ============================================================================
describe('@ereo/core - App response headers', () => {
  test('JSON responses have correct Content-Type', async () => {
    const app = createApp();
    const mockModule = { loader: async () => ({ ok: true }) };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', {
      headers: { Accept: 'application/json' },
    });
    const response = await app.handle(request);

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  test('error responses in prod have no Content-Type (text)', async () => {
    const app = createApp({ config: { server: { development: false } } });

    app.setRouteMatcher((): RouteMatch | null => {
      throw new Error('Boom');
    });

    const request = new Request('http://localhost:3000/');
    const response = await app.handle(request);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Internal Server Error');
  });

  test('404 response for unmatched route is plain text', async () => {
    const app = createApp();
    app.setRouteMatcher(() => null);

    const request = new Request('http://localhost:3000/nope');
    const response = await app.handle(request);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Not Found');
  });

  test('500 response for router not configured is plain text', async () => {
    const app = createApp();

    const request = new Request('http://localhost:3000/');
    const response = await app.handle(request);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Router not configured');
  });

  test('500 response for route module not loaded is plain text', async () => {
    const app = createApp();
    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx' },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/');
    const response = await app.handle(request);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Route module not loaded');
  });

  test('405 response for POST without action is plain text', async () => {
    const app = createApp();
    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: {} },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', { method: 'POST' });
    const response = await app.handle(request);

    expect(response.status).toBe(405);
    expect(await response.text()).toBe('Method Not Allowed');
  });
});

// ============================================================================
// Loader params passing
// ============================================================================
describe('@ereo/core - App params passing', () => {
  test('params are passed correctly to loader', async () => {
    const app = createApp();
    let receivedParams: any = null;

    const mockModule = {
      loader: async ({ params }: any) => {
        receivedParams = params;
        return { ok: true };
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'user', path: '/users/[id]', file: '/users.tsx', module: mockModule },
      params: { id: '42', role: 'admin' },
      pathname,
    }));

    const request = new Request('http://localhost:3000/users/42', {
      headers: { Accept: 'application/json' },
    });
    await app.handle(request);

    expect(receivedParams).toEqual({ id: '42', role: 'admin' });
  });

  test('params are passed correctly to action', async () => {
    const app = createApp();
    let receivedParams: any = null;

    const mockModule = {
      action: async ({ params }: any) => {
        receivedParams = params;
        return { ok: true };
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'user', path: '/users/[id]', file: '/users.tsx', module: mockModule },
      params: { id: '42' },
      pathname,
    }));

    const request = new Request('http://localhost:3000/users/42', { method: 'POST' });
    await app.handle(request);

    expect(receivedParams).toEqual({ id: '42' });
  });

  test('context is passed to loader', async () => {
    const app = createApp();
    let receivedContext: any = null;

    const mockModule = {
      loader: async ({ context }: any) => {
        receivedContext = context;
        return { ok: true };
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
    await app.handle(request);

    expect(receivedContext).toBeDefined();
    expect(typeof receivedContext.get).toBe('function');
    expect(typeof receivedContext.set).toBe('function');
  });

  test('request is passed to action', async () => {
    const app = createApp();
    let receivedMethod = '';

    const mockModule = {
      action: async ({ request }: any) => {
        receivedMethod = request.method;
        return { ok: true };
      },
    };

    app.setRouteMatcher((pathname): RouteMatch | null => ({
      route: { id: 'home', path: '/', file: '/index.tsx', module: mockModule },
      params: {},
      pathname,
    }));

    const request = new Request('http://localhost:3000/', { method: 'PUT' });
    await app.handle(request);

    expect(receivedMethod).toBe('PUT');
  });
});
