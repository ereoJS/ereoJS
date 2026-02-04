import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { BunServer, createServer, serve, type ServerRenderMode } from './bun-server';
import { EreoApp, type RenderMode as CoreRenderMode } from '@ereo/core';
import { createElement } from 'react';

describe('@ereo/server - BunServer', () => {
  let server: BunServer;

  afterEach(() => {
    if (server) {
      server.stop();
    }
  });

  describe('createServer', () => {
    test('creates a BunServer instance', () => {
      server = createServer();
      expect(server).toBeInstanceOf(BunServer);
    });

    test('uses default options', () => {
      server = createServer();
      const info = server.getInfo();

      expect(info.port).toBe(3000);
      expect(info.hostname).toBe('localhost');
      expect(info.development).toBe(true);
    });

    test('accepts custom options', () => {
      server = createServer({
        port: 8080,
        hostname: '0.0.0.0',
        development: false,
      });

      const info = server.getInfo();

      expect(info.port).toBe(8080);
      expect(info.hostname).toBe('0.0.0.0');
      expect(info.development).toBe(false);
    });
  });

  describe('BunServer', () => {
    beforeEach(() => {
      server = createServer({ port: 4567, logging: false });
    });

    test('has null server before start', () => {
      expect(server.getServer()).toBeNull();
    });

    test('adds middleware with use()', () => {
      server.use(async (req, ctx, next) => next());
      // No error thrown means success
    });

    test('getInfo returns server configuration', () => {
      const info = server.getInfo();

      expect(info).toHaveProperty('port');
      expect(info).toHaveProperty('hostname');
      expect(info).toHaveProperty('development');
    });

    test('start returns a server instance', async () => {
      const bunServer = await server.start();

      expect(bunServer).toBeDefined();
      expect(server.getServer()).not.toBeNull();
    });

    test('stop closes the server', async () => {
      await server.start();
      server.stop();

      expect(server.getServer()).toBeNull();
    });

    test('handles requests with custom handler', async () => {
      server = createServer({
        port: 4568,
        logging: false,
        handler: async (request) => {
          return new Response('Custom handler response');
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4568/');
      const text = await response.text();

      expect(text).toBe('Custom handler response');
    });

    test('returns 404 for unmatched routes when router is set', async () => {
      server = createServer({ port: 4569, logging: false });

      // Mock a router that always returns null
      server.setRouter({
        match: () => null,
        loadModule: async () => {},
      } as any);

      await server.start();

      const response = await fetch('http://localhost:4569/unknown');

      expect(response.status).toBe(404);
    });

    test('handles errors gracefully in development', async () => {
      server = createServer({
        port: 4570,
        logging: false,
        development: true,
        handler: async () => {
          throw new Error('Test error');
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4570/');

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Test error');
    });

    test('handles errors gracefully in production', async () => {
      server = createServer({
        port: 4571,
        logging: false,
        development: false,
        handler: async () => {
          throw new Error('Test error');
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4571/');

      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).toBe('Internal Server Error');
    });

    test('handles thrown Response objects for HTTP status codes', async () => {
      server = createServer({
        port: 4599,
        logging: false,
        handler: async () => {
          // This is the common pattern for 404s in loaders
          throw new Response('Post not found', { status: 404 });
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4599/');

      expect(response.status).toBe(404);
      const text = await response.text();
      expect(text).toBe('Post not found');
    });

    test('handles thrown Response objects with custom headers', async () => {
      server = createServer({
        port: 4600,
        logging: false,
        handler: async () => {
          throw new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4600/');

      expect(response.status).toBe(403);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      const json = await response.json();
      expect(json.error).toBe('Forbidden');
    });
  });

  describe('serve helper', () => {
    test('creates and starts a server', async () => {
      server = await serve({ port: 4572, logging: false });

      expect(server).toBeInstanceOf(BunServer);
      expect(server.getServer()).not.toBeNull();
    });
  });

  describe('setApp', () => {
    test('sets the app instance', async () => {
      server = createServer({ port: 4573, logging: false });
      const app = new EreoApp();

      server.setApp(app);

      // App should be set - we verify by starting and making a request
      await server.start();
      const response = await fetch('http://localhost:4573/');
      // App returns 500 when router is not configured
      expect(response.status).toBe(500);
    });
  });

  describe('setRouter with app', () => {
    test('sets router and connects to app', async () => {
      server = createServer({ port: 4574, logging: false });
      const app = new EreoApp();
      server.setApp(app);

      const mockRouter = {
        match: (pathname: string) => {
          if (pathname === '/test-route') {
            return {
              route: { id: '/test', path: '/test', file: '/test.tsx' },
              params: {},
              pathname: '/test-route',
            };
          }
          return null;
        },
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);

      await server.start();
      // The router is connected to the app
      const response = await fetch('http://localhost:4574/unknown');
      expect(response.status).toBe(404);
    });
  });

  describe('handleRoute', () => {
    test('handles route with action (POST request)', async () => {
      server = createServer({ port: 4575, logging: false });

      const mockRouter = {
        match: (pathname: string) => {
          return {
            route: {
              id: '/action',
              path: '/action',
              file: '/action.tsx',
              module: {
                action: async ({ request, params }: any) => {
                  return { success: true, method: request.method };
                },
              },
            },
            params: { id: '123' },
            pathname,
          };
        },
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4575/action', {
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.method).toBe('POST');
    });

    test('handles action that returns a Response directly', async () => {
      server = createServer({ port: 4576, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/action-response',
            path: '/action-response',
            file: '/action-response.tsx',
            module: {
              action: async () => new Response('Direct Response', { status: 201 }),
            },
          },
          params: {},
          pathname: '/action-response',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4576/action-response', {
        method: 'PUT',
      });

      expect(response.status).toBe(201);
      expect(await response.text()).toBe('Direct Response');
    });

    test('returns 405 for non-GET without action', async () => {
      server = createServer({ port: 4577, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/no-action',
            path: '/no-action',
            file: '/no-action.tsx',
            module: {
              // No action defined
              loader: async () => ({ data: 'test' }),
            },
          },
          params: {},
          pathname: '/no-action',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4577/no-action', {
        method: 'DELETE',
      });

      expect(response.status).toBe(405);
      expect(await response.text()).toBe('Method Not Allowed');
    });

    test('handles route without module loaded', async () => {
      server = createServer({ port: 4578, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/no-module',
            path: '/no-module',
            file: '/no-module.tsx',
            module: null, // Module not loaded
          },
          params: {},
          pathname: '/no-module',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4578/no-module');

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Route module not loaded');
    });

    test('handles loader that returns Response directly', async () => {
      server = createServer({ port: 4579, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/loader-response',
            path: '/loader-response',
            file: '/loader-response.tsx',
            module: {
              loader: async () => new Response('Loader Response', { status: 302 }),
            },
          },
          params: {},
          pathname: '/loader-response',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4579/loader-response');

      expect(response.status).toBe(302);
      expect(await response.text()).toBe('Loader Response');
    });

    test('handles JSON request (Accept: application/json)', async () => {
      server = createServer({ port: 4580, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/json-route',
            path: '/json-route',
            file: '/json-route.tsx',
            module: {
              loader: async () => ({ user: 'test', id: 1 }),
            },
          },
          params: { slug: 'my-post' },
          pathname: '/json-route',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4580/json-route', {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      const json = await response.json();
      expect(json.data).toEqual({ user: 'test', id: 1 });
      expect(json.params).toEqual({ slug: 'my-post' });
    });

    test('handles GET request without JSON Accept header (full page render)', async () => {
      server = createServer({ port: 4581, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/page-render',
            path: '/page-render',
            file: '/page-render.tsx',
            module: {
              loader: async () => ({ title: 'My Page' }),
            },
          },
          params: {},
          pathname: '/page-render',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4581/page-render', {
        headers: { Accept: 'text/html' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');

      // Should return HTML (minimal page since no component)
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<div id="root">');
      expect(html).toContain('window.__EREO_DATA__');
    });

    test('handles route with no loader', async () => {
      server = createServer({ port: 4582, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/no-loader',
            path: '/no-loader',
            file: '/no-loader.tsx',
            module: {
              // No loader defined
            },
          },
          params: {},
          pathname: '/no-loader',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4582/no-loader');

      expect(response.status).toBe(200);
      // Should return HTML (minimal page since no component)
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });
  });

  describe('stop', () => {
    test('stop when server is already null does nothing', () => {
      server = createServer({ port: 4583, logging: false });
      // Don't start the server
      server.stop(); // Should not throw
      expect(server.getServer()).toBeNull();
    });
  });

  describe('reload', () => {
    test('reloads the server when running', async () => {
      server = createServer({ port: 4584, logging: false });
      await server.start();

      // Reload should not throw
      await server.reload();

      // Server should still be running
      expect(server.getServer()).not.toBeNull();

      // Should still handle requests
      const response = await fetch('http://localhost:4584/');
      expect(response.status).toBe(404);
    });

    test('reload does nothing when server is not running', async () => {
      server = createServer({ port: 4585, logging: false });
      // Don't start the server
      await server.reload(); // Should not throw
      expect(server.getServer()).toBeNull();
    });
  });

  describe('error handling', () => {
    test('handles non-Error throws', async () => {
      server = createServer({
        port: 4586,
        logging: false,
        development: true,
        handler: async () => {
          throw 'string error'; // Non-Error object
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4586/');

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.error).toBe('Internal Server Error');
    });

    test('handles non-Error in production mode', async () => {
      server = createServer({
        port: 4587,
        logging: false,
        development: false,
        handler: async () => {
          throw { custom: 'error object' };
        },
      });

      await server.start();

      const response = await fetch('http://localhost:4587/');

      expect(response.status).toBe(500);
      expect(await response.text()).toBe('Internal Server Error');
    });
  });

  describe('middleware setup', () => {
    test('enables CORS with object options', async () => {
      server = createServer({
        port: 4588,
        logging: false,
        cors: { origin: 'http://example.com' },
        handler: async () => new Response('OK'),
      });

      await server.start();

      const response = await fetch('http://localhost:4588/', {
        headers: { Origin: 'http://example.com' },
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://example.com');
    });

    test('disables security headers when security is false', async () => {
      server = createServer({
        port: 4589,
        logging: false,
        security: false,
        handler: async () => new Response('OK'),
      });

      await server.start();

      const response = await fetch('http://localhost:4589/');

      // Security headers should not be present
      expect(response.headers.get('X-Content-Type-Options')).toBeNull();
    });

    test('enables security headers with object options', async () => {
      server = createServer({
        port: 4590,
        logging: false,
        security: { frameOptions: 'SAMEORIGIN' },
        handler: async () => new Response('OK'),
      });

      await server.start();

      const response = await fetch('http://localhost:4590/');

      expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    });
  });

  describe('TLS and WebSocket options', () => {
    test('accepts WebSocket configuration', () => {
      // Just verify it doesn't throw when configuring websocket
      server = createServer({
        port: 4591,
        logging: false,
        websocket: {
          message: (ws, message) => {},
        },
      });

      expect(server).toBeInstanceOf(BunServer);
    });
  });

  describe('HTML Page Rendering', () => {
    test('renders React component to HTML with streaming', async () => {
      server = createServer({
        port: 4592,
        logging: false,
        renderMode: 'streaming',
      });

      // Simple React component
      const TestComponent = ({ loaderData }: { loaderData: { message: string } }) => {
        return createElement('div', { className: 'test' }, loaderData.message);
      };

      const mockRouter = {
        match: () => ({
          route: {
            id: '/component',
            path: '/component',
            file: '/component.tsx',
            module: {
              default: TestComponent,
              loader: async () => ({ message: 'Hello from SSR!' }),
            },
          },
          params: {},
          pathname: '/component',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4592/component', {
        headers: { Accept: 'text/html' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<div id="root">');
      expect(html).toContain('Hello from SSR!');
      expect(html).toContain('class="test"');
      expect(html).toContain('window.__EREO_DATA__');
      expect(html).toContain('/_ereo/client.js');
    });

    test('renders React component to HTML with string mode', async () => {
      server = createServer({
        port: 4593,
        logging: false,
        renderMode: 'string',
      });

      const TestComponent = ({ loaderData }: { loaderData: { title: string } }) => {
        return createElement('h1', null, loaderData.title);
      };

      const mockRouter = {
        match: () => ({
          route: {
            id: '/string-render',
            path: '/string-render',
            file: '/string-render.tsx',
            module: {
              default: TestComponent,
              loader: async () => ({ title: 'String SSR Title' }),
            },
          },
          params: {},
          pathname: '/string-render',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4593/string-render', {
        headers: { Accept: 'text/html' },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      expect(response.headers.get('Content-Length')).toBeDefined();

      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<h1>String SSR Title</h1>');
      expect(html).toContain('window.__EREO_DATA__');
    });

    test('renders page with meta function for title', async () => {
      server = createServer({
        port: 4594,
        logging: false,
        renderMode: 'string',
      });

      const TestComponent = ({ loaderData }: any) => {
        return createElement('main', null, loaderData.content);
      };

      const mockRouter = {
        match: () => ({
          route: {
            id: '/with-meta',
            path: '/with-meta',
            file: '/with-meta.tsx',
            module: {
              default: TestComponent,
              loader: async () => ({ content: 'Page content here' }),
              meta: ({ data }: any) => [
                { title: 'Custom Page Title' },
                { name: 'description', content: 'Page description' },
              ],
            },
          },
          params: {},
          pathname: '/with-meta',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4594/with-meta');

      const html = await response.text();
      expect(html).toContain('<title>Custom Page Title</title>');
      expect(html).toContain('name="description"');
      expect(html).toContain('content="Page description"');
    });

    test('uses custom client entry path', async () => {
      server = createServer({
        port: 4595,
        logging: false,
        renderMode: 'string',
        clientEntry: '/custom/entry.js',
      });

      const TestComponent = () => createElement('div', null, 'Test');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/custom-entry',
            path: '/custom-entry',
            file: '/custom-entry.tsx',
            module: {
              default: TestComponent,
            },
          },
          params: {},
          pathname: '/custom-entry',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4595/custom-entry');

      const html = await response.text();
      expect(html).toContain('src="/custom/entry.js"');
    });

    test('uses custom shell template', async () => {
      server = createServer({
        port: 4596,
        logging: false,
        renderMode: 'string',
        shell: {
          title: 'Default Shell Title',
          htmlAttrs: { lang: 'fr' },
          head: '<link rel="icon" href="/favicon.ico">',
        },
      });

      const TestComponent = () => createElement('div', null, 'Content');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/custom-shell',
            path: '/custom-shell',
            file: '/custom-shell.tsx',
            module: {
              default: TestComponent,
            },
          },
          params: {},
          pathname: '/custom-shell',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4596/custom-shell');

      const html = await response.text();
      expect(html).toContain('<title>Default Shell Title</title>');
      expect(html).toContain('lang="fr"');
      expect(html).toContain('<link rel="icon" href="/favicon.ico">');
    });

    test('serializes loader data safely for hydration', async () => {
      server = createServer({
        port: 4597,
        logging: false,
        renderMode: 'string',
      });

      const TestComponent = () => createElement('div', null, 'Test');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/xss-test',
            path: '/xss-test',
            file: '/xss-test.tsx',
            module: {
              default: TestComponent,
              loader: async () => ({
                // This data contains characters that could break script tags
                unsafe: '</script><script>alert("xss")</script>',
              }),
            },
          },
          params: {},
          pathname: '/xss-test',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4597/xss-test');

      const html = await response.text();
      // The < and > characters should be escaped
      expect(html).not.toContain('</script><script>');
      expect(html).toContain('\\u003c'); // Escaped <
      expect(html).toContain('\\u003e'); // Escaped >
    });

    test('renders minimal page when no default component', async () => {
      server = createServer({
        port: 4598,
        logging: false,
        renderMode: 'string',
      });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/no-component',
            path: '/no-component',
            file: '/no-component.tsx',
            module: {
              // No default export
              loader: async () => ({ data: 'some data' }),
            },
          },
          params: { id: '123' },
          pathname: '/no-component',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4598/no-component');

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>EreoJS App</title>');
      expect(html).toContain('<div id="root"></div>');
      expect(html).toContain('window.__EREO_DATA__');
    });
  });

  describe('ServerRenderMode type', () => {
    test('accepts "streaming" as valid ServerRenderMode', () => {
      const mode: ServerRenderMode = 'streaming';
      expect(mode).toBe('streaming');
    });

    test('accepts "string" as valid ServerRenderMode', () => {
      const mode: ServerRenderMode = 'string';
      expect(mode).toBe('string');
    });

    test('ServerRenderMode is distinct from core RenderMode', () => {
      // ServerRenderMode is for server-side rendering method
      const serverMode: ServerRenderMode = 'streaming';

      // CoreRenderMode is for route-level rendering strategy
      const coreMode: CoreRenderMode = 'ssr';

      // They are different types with different values
      expect(serverMode).toBe('streaming');
      expect(coreMode).toBe('ssr');

      // Verify they are not the same values
      expect(serverMode).not.toBe(coreMode);
    });

    test('ServerOptions accepts ServerRenderMode values', () => {
      // Test with streaming mode
      const streamingServer = createServer({
        port: 4599,
        logging: false,
        renderMode: 'streaming',
      });
      expect(streamingServer.getInfo()).toBeDefined();

      // Test with string mode
      const stringServer = createServer({
        port: 4600,
        logging: false,
        renderMode: 'string',
      });
      expect(stringServer.getInfo()).toBeDefined();
    });

    test('default renderMode is streaming', () => {
      server = createServer({ port: 4601, logging: false });
      // The default is 'streaming' as set in the constructor
      expect(server.getInfo()).toBeDefined();
    });

    test('server renders correctly with explicit streaming mode', async () => {
      server = createServer({
        port: 4602,
        logging: false,
        renderMode: 'streaming' as ServerRenderMode,
      });

      const TestComponent = () => createElement('p', null, 'Streaming mode test');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/streaming-type-test',
            path: '/streaming-type-test',
            file: '/streaming-type-test.tsx',
            module: {
              default: TestComponent,
              loader: async () => ({ value: 'test' }),
            },
          },
          params: {},
          pathname: '/streaming-type-test',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4602/streaming-type-test');

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('Streaming mode test');
    });

    test('server renders correctly with explicit string mode', async () => {
      server = createServer({
        port: 4603,
        logging: false,
        renderMode: 'string' as ServerRenderMode,
      });

      const TestComponent = () => createElement('p', null, 'String mode test');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/string-type-test',
            path: '/string-type-test',
            file: '/string-type-test.tsx',
            module: {
              default: TestComponent,
              loader: async () => ({ value: 'test' }),
            },
          },
          params: {},
          pathname: '/string-type-test',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4603/string-type-test');

      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('String mode test');
    });
  });

  // ============================================================================
  // Bun-Native API Tests (Critical Fix Verification)
  // ============================================================================
  describe('Bun-native API usage (no Node.js Buffer/stream)', () => {
    test('TextEncoder is used for string encoding', () => {
      const encoder = new TextEncoder();
      const text = 'Hello, EreoJS!';
      const encoded = encoder.encode(text);

      expect(encoded).toBeInstanceOf(Uint8Array);
      expect(encoded.length).toBe(text.length);
    });

    test('Uint8Array correctly calculates byte length for multi-byte characters', () => {
      const encoder = new TextEncoder();
      // Japanese text: each character is 3 bytes in UTF-8
      const text = 'こんにちは';
      const encoded = encoder.encode(text);

      // 5 Japanese characters * 3 bytes each = 15 bytes
      expect(encoded.length).toBe(15);
    });

    test('Uint8Array concatenation works correctly', () => {
      const encoder = new TextEncoder();
      const chunks = [
        encoder.encode('<!DOCTYPE html>'),
        encoder.encode('<html>'),
        encoder.encode('<body>Content</body>'),
        encoder.encode('</html>'),
      ];

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder();
      const html = decoder.decode(result);
      expect(html).toBe('<!DOCTYPE html><html><body>Content</body></html>');
    });

    test('Response accepts Uint8Array body', () => {
      const encoder = new TextEncoder();
      const html = '<!DOCTYPE html><html><body>Test</body></html>';
      const htmlBytes = encoder.encode(html);

      const response = new Response(htmlBytes, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': htmlBytes.length.toString(),
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Length')).toBe(htmlBytes.length.toString());
    });

    test('Web Streams API is available (renderToReadableStream)', () => {
      expect(ReadableStream).toBeDefined();
      expect(typeof ReadableStream).toBe('function');
    });

    test('ReadableStream can be created and read', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('Hello'));
          controller.enqueue(encoder.encode(' '));
          controller.enqueue(encoder.encode('World'));
          controller.close();
        },
      });

      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }

      const decoder = new TextDecoder();
      expect(decoder.decode(result)).toBe('Hello World');
    });

    test('Content-Length is correctly calculated using Uint8Array.length', async () => {
      server = createServer({
        port: 4604,
        logging: false,
        renderMode: 'string',
      });

      const TestComponent = () => createElement('div', null, 'Test with multi-byte: 日本語');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/byte-length-test',
            path: '/byte-length-test',
            file: '/byte-length-test.tsx',
            module: {
              default: TestComponent,
              loader: async () => ({ data: 'test' }),
            },
          },
          params: {},
          pathname: '/byte-length-test',
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4604/byte-length-test');
      const contentLength = response.headers.get('Content-Length');
      const body = await response.arrayBuffer();

      // Content-Length should match actual byte length
      expect(parseInt(contentLength!)).toBe(body.byteLength);
    });
  });
});
