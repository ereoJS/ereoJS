import { describe, expect, test, beforeEach } from 'bun:test';
import { createApp, defineConfig, EreoApp, isEreoApp } from './app';
import type { FrameworkConfig, Plugin, RouteMatch, RequestContext, RouteErrorComponentProps, ErrorBoundaryProps } from './types';

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
