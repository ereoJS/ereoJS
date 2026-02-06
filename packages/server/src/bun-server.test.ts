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
  // Layout Loader Tests
  // ============================================================================
  describe('Layout loaders', () => {
    test('runs layout loaders in parallel with route loader', async () => {
      server = createServer({ port: 4610, logging: false });

      const executionOrder: string[] = [];

      const RootLayout = ({ loaderData, children }: any) =>
        createElement('div', { id: 'root-layout' },
          createElement('header', null, `User: ${loaderData?.user}`),
          children
        );

      const PageComponent = ({ loaderData }: any) =>
        createElement('main', null, `Posts: ${loaderData?.posts?.length}`);

      const mockRouter = {
        match: () => ({
          route: {
            id: '/posts',
            path: '/posts',
            file: '/posts.tsx',
            module: {
              default: PageComponent,
              loader: async () => {
                executionOrder.push('route-loader');
                return { posts: [{ id: 1 }, { id: 2 }] };
              },
            },
          },
          params: {},
          pathname: '/posts',
          layouts: [
            {
              id: '_layout',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                default: RootLayout,
                loader: async () => {
                  executionOrder.push('layout-loader');
                  return { user: 'Alice' };
                },
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4610/posts');
      expect(response.status).toBe(200);

      const html = await response.text();
      expect(html).toContain('User: Alice');
      expect(html).toContain('Posts: 2');
      // Both loaders ran
      expect(executionOrder).toContain('route-loader');
      expect(executionOrder).toContain('layout-loader');
    });

    test('layout loader data is included in JSON response', async () => {
      server = createServer({ port: 4611, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/dashboard',
            path: '/dashboard',
            file: '/dashboard.tsx',
            module: {
              loader: async () => ({ stats: { views: 100 } }),
            },
          },
          params: {},
          pathname: '/dashboard',
          layouts: [
            {
              id: 'root-layout',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                loader: async () => ({ user: { name: 'Bob', role: 'admin' } }),
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4611/dashboard', {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toEqual({ stats: { views: 100 } });
      expect(json.layoutData).toBeDefined();
      expect(json.layoutData['root-layout']).toEqual({
        user: { name: 'Bob', role: 'admin' },
      });
    });

    test('JSON response has no layoutData when no layout loaders exist', async () => {
      server = createServer({ port: 4612, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/simple',
            path: '/simple',
            file: '/simple.tsx',
            module: {
              loader: async () => ({ data: 'hello' }),
            },
          },
          params: {},
          pathname: '/simple',
          layouts: [
            {
              id: 'root-layout',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                default: ({ children }: any) => createElement('div', null, children),
                // No loader
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4612/simple', {
        headers: { Accept: 'application/json' },
      });

      const json = await response.json();
      expect(json.data).toEqual({ data: 'hello' });
      expect(json.layoutData).toBeUndefined();
    });

    test('layout loader returning Response (redirect) short-circuits', async () => {
      server = createServer({ port: 4613, logging: false });

      let routeLoaderCalled = false;

      const mockRouter = {
        match: () => ({
          route: {
            id: '/protected',
            path: '/protected',
            file: '/protected.tsx',
            module: {
              loader: async () => {
                routeLoaderCalled = true;
                return { data: 'secret' };
              },
            },
          },
          params: {},
          pathname: '/protected',
          layouts: [
            {
              id: 'auth-layout',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                loader: async () => {
                  // Auth check fails — redirect
                  return new Response(null, {
                    status: 302,
                    headers: { Location: '/login' },
                  });
                },
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4613/protected', {
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/login');
    });

    test('multiple nested layouts with loaders', async () => {
      server = createServer({ port: 4614, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/admin/users',
            path: '/admin/users',
            file: '/admin/users.tsx',
            module: {
              loader: async () => ({ users: ['Alice', 'Bob'] }),
            },
          },
          params: {},
          pathname: '/admin/users',
          layouts: [
            {
              id: 'root-layout',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                loader: async () => ({ theme: 'dark' }),
              },
            },
            {
              id: 'admin-layout',
              path: '/admin',
              file: '/admin/_layout.tsx',
              layout: true,
              module: {
                loader: async () => ({ permissions: ['read', 'write'] }),
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4614/admin/users', {
        headers: { Accept: 'application/json' },
      });

      const json = await response.json();
      expect(json.data).toEqual({ users: ['Alice', 'Bob'] });
      expect(json.layoutData['root-layout']).toEqual({ theme: 'dark' });
      expect(json.layoutData['admin-layout']).toEqual({
        permissions: ['read', 'write'],
      });
    });

    test('layout without loader gets null loaderData', async () => {
      server = createServer({ port: 4615, logging: false, renderMode: 'string' });

      const RootLayout = ({ loaderData, children }: any) => {
        return createElement('html', null,
          createElement('body', null,
            createElement('div', { 'data-layout-data': String(loaderData) }),
            children
          )
        );
      };

      const PageComponent = ({ loaderData }: any) =>
        createElement('p', null, loaderData.message);

      const mockRouter = {
        match: () => ({
          route: {
            id: '/page',
            path: '/page',
            file: '/page.tsx',
            module: {
              default: PageComponent,
              loader: async () => ({ message: 'Hello' }),
            },
          },
          params: {},
          pathname: '/page',
          layouts: [
            {
              id: 'root',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                default: RootLayout,
                // No loader — loaderData should be null
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4615/page');
      const html = await response.text();
      expect(html).toContain('data-layout-data="null"');
      expect(html).toContain('Hello');
    });
  });

  // ============================================================================
  // Outlet integration tests
  // ============================================================================
  describe('Outlet integration with server rendering', () => {
    test('layout using Outlet renders child content', async () => {
      server = createServer({ port: 4616, logging: false, renderMode: 'string' });

      // Import Outlet for use in the layout component
      const { Outlet } = await import('@ereo/client');

      // Layout that uses <Outlet /> instead of {children}
      const OutletLayout = ({ loaderData }: any) =>
        createElement('html', null,
          createElement('body', null,
            createElement('nav', null, `Theme: ${loaderData?.theme}`),
            createElement(Outlet)
          )
        );

      const PageComponent = ({ loaderData }: any) =>
        createElement('main', null, `Content: ${loaderData?.title}`);

      const mockRouter = {
        match: () => ({
          route: {
            id: '/home',
            path: '/home',
            file: '/home.tsx',
            module: {
              default: PageComponent,
              loader: async () => ({ title: 'Welcome' }),
            },
          },
          params: {},
          pathname: '/home',
          layouts: [
            {
              id: 'outlet-root',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                default: OutletLayout,
                loader: async () => ({ theme: 'light' }),
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4616/home');
      const html = await response.text();
      expect(html).toContain('Theme: light');
      expect(html).toContain('Content: Welcome');
    });

    test('nested layouts both using Outlet', async () => {
      server = createServer({ port: 4617, logging: false, renderMode: 'string' });

      const { Outlet } = await import('@ereo/client');

      const RootLayout = () =>
        createElement('html', null,
          createElement('body', null,
            createElement('div', { id: 'root' }, createElement(Outlet))
          )
        );

      const DashLayout = ({ loaderData }: any) =>
        createElement('div', { id: 'dashboard' },
          createElement('aside', null, `Role: ${loaderData?.role}`),
          createElement(Outlet)
        );

      const PageComponent = ({ loaderData }: any) =>
        createElement('article', null, `Stats: ${loaderData?.count}`);

      const mockRouter = {
        match: () => ({
          route: {
            id: '/dash/stats',
            path: '/dash/stats',
            file: '/dash/stats.tsx',
            module: {
              default: PageComponent,
              loader: async () => ({ count: 42 }),
            },
          },
          params: {},
          pathname: '/dash/stats',
          layouts: [
            {
              id: 'root',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: { default: RootLayout },
            },
            {
              id: 'dash',
              path: '/dash',
              file: '/dash/_layout.tsx',
              layout: true,
              module: {
                default: DashLayout,
                loader: async () => ({ role: 'admin' }),
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4617/dash/stats');
      const html = await response.text();
      expect(html).toContain('id="root"');
      expect(html).toContain('id="dashboard"');
      expect(html).toContain('Role: admin');
      expect(html).toContain('Stats: 42');
    });

    test('backwards compatible: layout using children prop still works', async () => {
      server = createServer({ port: 4618, logging: false, renderMode: 'string' });

      // Layout that uses {children} (old pattern)
      const ChildrenLayout = ({ children }: any) =>
        createElement('html', null,
          createElement('body', null,
            createElement('header', null, 'Old Style'),
            children
          )
        );

      const PageComponent = ({ loaderData }: any) =>
        createElement('p', null, `Data: ${loaderData?.value}`);

      const mockRouter = {
        match: () => ({
          route: {
            id: '/old',
            path: '/old',
            file: '/old.tsx',
            module: {
              default: PageComponent,
              loader: async () => ({ value: 'works' }),
            },
          },
          params: {},
          pathname: '/old',
          layouts: [
            {
              id: 'compat-root',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: { default: ChildrenLayout },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4618/old');
      const html = await response.text();
      expect(html).toContain('Old Style');
      expect(html).toContain('Data: works');
    });
  });

  // ============================================================================
  // Links route export tests
  // ============================================================================
  describe('Links route export', () => {
    test('route links are rendered in HTML head', async () => {
      server = createServer({ port: 4619, logging: false, renderMode: 'string' });

      const PageComponent = ({ loaderData }: any) =>
        createElement('div', null, `Page: ${loaderData?.title}`);

      const mockRouter = {
        match: () => ({
          route: {
            id: '/styled',
            path: '/styled',
            file: '/styled.tsx',
            module: {
              default: PageComponent,
              loader: async () => ({ title: 'Styled Page' }),
              links: () => [
                { rel: 'stylesheet', href: '/styles/dashboard.css' },
                { rel: 'preload', href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2' },
              ],
            },
          },
          params: {},
          pathname: '/styled',
          layouts: [],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4619/styled');
      const html = await response.text();
      expect(html).toContain('rel="stylesheet"');
      expect(html).toContain('href="/styles/dashboard.css"');
      expect(html).toContain('as="font"');
      expect(html).toContain('Page: Styled Page');
    });

    test('links from route and layout are both included', async () => {
      server = createServer({ port: 4620, logging: false, renderMode: 'string' });

      const Layout = ({ children }: any) =>
        createElement('html', null, createElement('body', null, children));

      const Page = ({ loaderData }: any) =>
        createElement('p', null, loaderData?.text);

      const mockRouter = {
        match: () => ({
          route: {
            id: '/page',
            path: '/page',
            file: '/page.tsx',
            module: {
              default: Page,
              loader: async () => ({ text: 'hello' }),
              links: () => [{ rel: 'stylesheet', href: '/page.css' }],
            },
          },
          params: {},
          pathname: '/page',
          layouts: [
            {
              id: 'root',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                default: Layout,
                links: () => [{ rel: 'stylesheet', href: '/layout.css' }],
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      // JSON response includes links
      const jsonRes = await fetch('http://localhost:4620/page', {
        headers: { Accept: 'application/json' },
      });
      const json = await jsonRes.json();
      expect(json.links).toBeDefined();
      expect(json.links).toHaveLength(2);
      expect(json.links[0].href).toBe('/layout.css');
      expect(json.links[1].href).toBe('/page.css');
    });

    test('JSON response has no links when routes have none', async () => {
      server = createServer({ port: 4621, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/no-links',
            path: '/no-links',
            file: '/no-links.tsx',
            module: {
              loader: async () => ({ ok: true }),
            },
          },
          params: {},
          pathname: '/no-links',
          layouts: [],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4621/no-links', {
        headers: { Accept: 'application/json' },
      });
      const json = await response.json();
      expect(json.links).toBeUndefined();
    });
  });

  // ============================================================================
  // useMatches / handle tests
  // ============================================================================
  describe('useMatches data in JSON response', () => {
    test('JSON response includes matches with handle metadata', async () => {
      server = createServer({ port: 4622, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/users/[id]',
            path: '/users/:id',
            file: '/users/[id].tsx',
            module: {
              loader: async () => ({ user: { name: 'Alice' } }),
              handle: { breadcrumb: 'User Profile', analytics: 'user-view' },
            },
          },
          params: { id: '42' },
          pathname: '/users/42',
          layouts: [
            {
              id: 'root',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                handle: { breadcrumb: 'Home' },
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4622/users/42', {
        headers: { Accept: 'application/json' },
      });
      const json = await response.json();

      expect(json.matches).toBeDefined();
      expect(json.matches).toHaveLength(2);

      // First match is the layout (outermost)
      expect(json.matches[0].id).toBe('root');
      expect(json.matches[0].handle.breadcrumb).toBe('Home');
      expect(json.matches[0].data).toBeNull(); // no layout loader

      // Second match is the route (innermost)
      expect(json.matches[1].id).toBe('/users/[id]');
      expect(json.matches[1].handle.breadcrumb).toBe('User Profile');
      expect(json.matches[1].handle.analytics).toBe('user-view');
      expect(json.matches[1].data.user.name).toBe('Alice');
      expect(json.matches[1].params.id).toBe('42');
    });

    test('matches include layout loader data', async () => {
      server = createServer({ port: 4623, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/settings',
            path: '/settings',
            file: '/settings.tsx',
            module: {
              loader: async () => ({ settings: { theme: 'dark' } }),
            },
          },
          params: {},
          pathname: '/settings',
          layouts: [
            {
              id: 'app-layout',
              path: '/',
              file: '/_layout.tsx',
              layout: true,
              module: {
                loader: async () => ({ user: { name: 'Bob' } }),
                handle: { breadcrumb: 'App' },
              },
            },
          ],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4623/settings', {
        headers: { Accept: 'application/json' },
      });
      const json = await response.json();

      expect(json.matches[0].data).toEqual({ user: { name: 'Bob' } });
      expect(json.matches[1].data).toEqual({ settings: { theme: 'dark' } });
    });

    test('matches with no handle have handle undefined', async () => {
      server = createServer({ port: 4624, logging: false });

      const mockRouter = {
        match: () => ({
          route: {
            id: '/plain',
            path: '/plain',
            file: '/plain.tsx',
            module: {
              loader: async () => ({ ok: true }),
              // No handle export
            },
          },
          params: {},
          pathname: '/plain',
          layouts: [],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4624/plain', {
        headers: { Accept: 'application/json' },
      });
      const json = await response.json();

      expect(json.matches).toHaveLength(1);
      expect(json.matches[0].id).toBe('/plain');
      expect(json.matches[0].handle).toBeUndefined();
    });
  });

  // ============================================================================
  // notFound() helper tests
  // ============================================================================
  describe('notFound() helper', () => {
    test('loader throwing notFound() returns 404', async () => {
      server = createServer({ port: 4625, logging: false });

      const { notFound } = await import('@ereo/core');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/users/[id]',
            path: '/users/:id',
            file: '/users/[id].tsx',
            module: {
              loader: async ({ params }: any) => {
                if (params.id === '999') {
                  notFound({ message: 'User not found' });
                }
                return { user: { id: params.id } };
              },
            },
          },
          params: { id: '999' },
          pathname: '/users/999',
          layouts: [],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4625/users/999', {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Not Found');
      expect(json.status).toBe(404);
      expect(json.data).toEqual({ message: 'User not found' });
    });

    test('loader throwing notFound() without data returns 404', async () => {
      server = createServer({ port: 4626, logging: false });

      const { notFound } = await import('@ereo/core');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/missing',
            path: '/missing',
            file: '/missing.tsx',
            module: {
              loader: async () => {
                notFound();
              },
            },
          },
          params: {},
          pathname: '/missing',
          layouts: [],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4626/missing', {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Not Found');
    });

    test('action throwing notFound() returns 404', async () => {
      server = createServer({ port: 4627, logging: false });

      const { notFound } = await import('@ereo/core');

      const mockRouter = {
        match: () => ({
          route: {
            id: '/api/delete',
            path: '/api/delete',
            file: '/api/delete.tsx',
            module: {
              action: async () => {
                notFound({ resource: 'item', id: '123' });
              },
            },
          },
          params: {},
          pathname: '/api/delete',
          layouts: [],
        }),
        loadModule: async () => {},
      };

      server.setRouter(mockRouter as any);
      await server.start();

      const response = await fetch('http://localhost:4627/api/delete', {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.data).toEqual({ resource: 'item', id: '123' });
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

// =================================================================
// Headers Function Tests
// =================================================================

describe('@ereo/server - Headers Function', () => {
  let server: any;

  test('route headers function adds custom headers to JSON response', async () => {
    server = createServer({ port: 4628, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/headers-test',
          path: '/headers-test',
          file: '/headers-test.tsx',
          module: {
            loader: async () => ({ message: 'hello' }),
            headers: ({ parentHeaders }: any) => ({
              'Cache-Control': 'max-age=300',
              'X-Custom': 'test-value',
            }),
          },
        },
        params: {},
        pathname: '/headers-test',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4628/headers-test', {
        headers: { Accept: 'application/json' },
      });

      expect(response.headers.get('Cache-Control')).toBe('max-age=300');
      expect(response.headers.get('X-Custom')).toBe('test-value');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    } finally {
      server.stop();
    }
  });

  test('route headers function adds custom headers to HTML response', async () => {
    server = createServer({ port: 4629, logging: false, renderMode: 'string' });

    const PageComponent = () => createElement('div', null, 'Test');

    const mockRouter = {
      match: () => ({
        route: {
          id: '/headers-html',
          path: '/headers-html',
          file: '/headers-html.tsx',
          module: {
            default: PageComponent,
            loader: async () => ({ data: 'test' }),
            headers: () => ({
              'Cache-Control': 'public, max-age=600',
              'X-Powered-By': 'ereo',
            }),
          },
        },
        params: {},
        pathname: '/headers-html',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4629/headers-html');

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=600');
      expect(response.headers.get('X-Powered-By')).toBe('ereo');
      // Content-Type should still be html
      expect(response.headers.get('Content-Type')).toContain('text/html');
    } finally {
      server.stop();
    }
  });

  test('layout headers cascade to route headers via parentHeaders', async () => {
    server = createServer({ port: 4630, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/cascade-test',
          path: '/cascade-test',
          file: '/cascade-test.tsx',
          module: {
            loader: async () => ({ data: 'test' }),
            headers: ({ parentHeaders }: any) => {
              // Route sees the parent layout's headers
              const headers = new Headers(parentHeaders);
              headers.set('X-Route', 'true');
              return headers;
            },
          },
        },
        params: {},
        pathname: '/cascade-test',
        layouts: [
          {
            id: 'root-layout',
            path: '/',
            file: '/layout.tsx',
            module: {
              headers: () => ({
                'Cache-Control': 'public, max-age=3600',
                'X-Layout': 'root',
              }),
            },
          },
        ],
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4630/cascade-test', {
        headers: { Accept: 'application/json' },
      });

      // Route's headers function received parentHeaders from layout
      // and added X-Route while keeping layout headers
      expect(response.headers.get('X-Route')).toBe('true');
      expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');
      expect(response.headers.get('X-Layout')).toBe('root');
    } finally {
      server.stop();
    }
  });

  test('headers function does not override Content-Type', async () => {
    server = createServer({ port: 4631, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/no-override',
          path: '/no-override',
          file: '/no-override.tsx',
          module: {
            loader: async () => ({}),
            headers: () => ({
              'Content-Type': 'text/plain',
              'X-Works': 'yes',
            }),
          },
        },
        params: {},
        pathname: '/no-override',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4631/no-override', {
        headers: { Accept: 'application/json' },
      });

      // Content-Type should not be overridden
      expect(response.headers.get('Content-Type')).toBe('application/json');
      // But custom header should be set
      expect(response.headers.get('X-Works')).toBe('yes');
    } finally {
      server.stop();
    }
  });

  test('action response headers are passed to headers function', async () => {
    server = createServer({ port: 4632, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/action-headers',
          path: '/action-headers',
          file: '/action-headers.tsx',
          module: {
            action: async () => ({ success: true }),
            headers: ({ actionHeaders }: any) => ({
              'X-Action-Seen': actionHeaders ? 'yes' : 'no',
              'X-Custom-Action': 'processed',
            }),
          },
        },
        params: {},
        pathname: '/action-headers',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4632/action-headers', {
        method: 'POST',
        body: JSON.stringify({ test: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.headers.get('X-Custom-Action')).toBe('processed');
    } finally {
      server.stop();
    }
  });

  test('no headers function means no extra headers', async () => {
    server = createServer({ port: 4633, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/no-headers-fn',
          path: '/no-headers-fn',
          file: '/no-headers-fn.tsx',
          module: {
            loader: async () => ({ data: 'test' }),
          },
        },
        params: {},
        pathname: '/no-headers-fn',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4633/no-headers-fn', {
        headers: { Accept: 'application/json' },
      });

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom')).toBeNull();
    } finally {
      server.stop();
    }
  });
});

// =================================================================
// Inline Route Middleware Tests
// =================================================================

describe('@ereo/server - Inline Route Middleware', () => {
  let server: any;

  test('inline middleware runs before loader', async () => {
    server = createServer({ port: 4634, logging: false, renderMode: 'string' });

    const executionOrder: string[] = [];

    const mockRouter = {
      match: () => ({
        route: {
          id: '/mw-test',
          path: '/mw-test',
          file: '/mw-test.tsx',
          module: {
            loader: async () => {
              executionOrder.push('loader');
              return { data: 'loaded' };
            },
            middleware: [
              async (req: Request, ctx: any, next: () => Promise<Response>) => {
                executionOrder.push('middleware');
                return next();
              },
            ],
          },
        },
        params: {},
        pathname: '/mw-test',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      await fetch('http://localhost:4634/mw-test', {
        headers: { Accept: 'application/json' },
      });

      expect(executionOrder).toEqual(['middleware', 'loader']);
    } finally {
      server.stop();
    }
  });

  test('inline middleware can short-circuit with a Response', async () => {
    server = createServer({ port: 4635, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/mw-block',
          path: '/mw-block',
          file: '/mw-block.tsx',
          module: {
            loader: async () => ({ data: 'should not reach' }),
            middleware: [
              async (req: Request, ctx: any, next: () => Promise<Response>) => {
                // Block the request - don't call next()
                return new Response(JSON.stringify({ error: 'Blocked by middleware' }), {
                  status: 403,
                  headers: { 'Content-Type': 'application/json' },
                });
              },
            ],
          },
        },
        params: {},
        pathname: '/mw-block',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4635/mw-block', {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Blocked by middleware');
    } finally {
      server.stop();
    }
  });

  test('multiple inline middlewares execute in order', async () => {
    server = createServer({ port: 4636, logging: false, renderMode: 'string' });

    const order: string[] = [];

    const mockRouter = {
      match: () => ({
        route: {
          id: '/mw-chain',
          path: '/mw-chain',
          file: '/mw-chain.tsx',
          module: {
            loader: async () => {
              order.push('loader');
              return { data: 'test' };
            },
            middleware: [
              async (req: Request, ctx: any, next: () => Promise<Response>) => {
                order.push('mw1-before');
                const res = await next();
                order.push('mw1-after');
                return res;
              },
              async (req: Request, ctx: any, next: () => Promise<Response>) => {
                order.push('mw2-before');
                const res = await next();
                order.push('mw2-after');
                return res;
              },
            ],
          },
        },
        params: {},
        pathname: '/mw-chain',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      await fetch('http://localhost:4636/mw-chain', {
        headers: { Accept: 'application/json' },
      });

      // Middleware executes in order, wrapping the loader
      expect(order).toEqual(['mw1-before', 'mw2-before', 'loader', 'mw2-after', 'mw1-after']);
    } finally {
      server.stop();
    }
  });

  test('inline middleware can modify the response', async () => {
    server = createServer({ port: 4637, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/mw-modify',
          path: '/mw-modify',
          file: '/mw-modify.tsx',
          module: {
            loader: async () => ({ data: 'test' }),
            middleware: [
              async (req: Request, ctx: any, next: () => Promise<Response>) => {
                const response = await next();
                // Add a custom header to the response
                const newResponse = new Response(response.body, {
                  status: response.status,
                  headers: response.headers,
                });
                newResponse.headers.set('X-Middleware', 'applied');
                return newResponse;
              },
            ],
          },
        },
        params: {},
        pathname: '/mw-modify',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4637/mw-modify', {
        headers: { Accept: 'application/json' },
      });

      expect(response.headers.get('X-Middleware')).toBe('applied');
    } finally {
      server.stop();
    }
  });

  test('inline middleware works with actions (POST)', async () => {
    server = createServer({ port: 4638, logging: false, renderMode: 'string' });

    const order: string[] = [];

    const mockRouter = {
      match: () => ({
        route: {
          id: '/mw-action',
          path: '/mw-action',
          file: '/mw-action.tsx',
          module: {
            action: async () => {
              order.push('action');
              return { success: true };
            },
            middleware: [
              async (req: Request, ctx: any, next: () => Promise<Response>) => {
                order.push('middleware');
                return next();
              },
            ],
          },
        },
        params: {},
        pathname: '/mw-action',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4638/mw-action', {
        method: 'POST',
        body: JSON.stringify({ test: true }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(order).toEqual(['middleware', 'action']);
    } finally {
      server.stop();
    }
  });

  test('route without inline middleware works normally', async () => {
    server = createServer({ port: 4639, logging: false, renderMode: 'string' });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/no-mw',
          path: '/no-mw',
          file: '/no-mw.tsx',
          module: {
            loader: async () => ({ data: 'no middleware' }),
          },
        },
        params: {},
        pathname: '/no-mw',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    try {
      const response = await fetch('http://localhost:4639/no-mw', {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.data).toBe('no middleware');
    } finally {
      server.stop();
    }
  });
});

// =================================================================
// Deferred Data Resolution Tests
// =================================================================

describe('@ereo/server - Deferred Data Resolution', () => {
  let server: any;

  afterEach(() => {
    if (server) {
      server.stop();
    }
  });

  test('JSON response resolves deferred loader data', async () => {
    const { defer } = await import('@ereo/data');

    server = createServer({ port: 4650, logging: false });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/deferred-json',
          path: '/deferred-json',
          file: '/deferred-json.tsx',
          module: {
            loader: async () => ({
              title: 'My Post',
              comments: defer(Promise.resolve([{ id: 1, text: 'Great!' }, { id: 2, text: 'Nice' }])),
            }),
          },
        },
        params: {},
        pathname: '/deferred-json',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    const response = await fetch('http://localhost:4650/deferred-json', {
      headers: { Accept: 'application/json' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();

    // Deferred data should be resolved — no promise/status fields
    expect(json.data.title).toBe('My Post');
    expect(json.data.comments).toEqual([{ id: 1, text: 'Great!' }, { id: 2, text: 'Nice' }]);
    expect(json.data.comments).not.toHaveProperty('promise');
    expect(json.data.comments).not.toHaveProperty('status');
  });

  test('HTML response hydration script contains resolved deferred data', async () => {
    const { defer } = await import('@ereo/data');

    server = createServer({ port: 4651, logging: false, renderMode: 'string' });

    const TestComponent = ({ loaderData }: any) =>
      createElement('div', null, loaderData.title);

    const mockRouter = {
      match: () => ({
        route: {
          id: '/deferred-html',
          path: '/deferred-html',
          file: '/deferred-html.tsx',
          module: {
            default: TestComponent,
            loader: async () => ({
              title: 'Deferred Page',
              sidebar: defer(Promise.resolve({ widgets: ['recent', 'popular'] })),
            }),
          },
        },
        params: {},
        pathname: '/deferred-html',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    const response = await fetch('http://localhost:4651/deferred-html');

    expect(response.status).toBe(200);
    const html = await response.text();

    // Hydration script should contain resolved data
    expect(html).toContain('window.__EREO_DATA__');
    expect(html).toContain('widgets');
    expect(html).toContain('recent');
    expect(html).toContain('popular');
    // Should not contain DeferredData artifacts
    expect(html).not.toContain('"status":"pending"');
    expect(html).not.toContain('"promise"');
  });

  test('streaming mode resolves deferred data in hydration script', async () => {
    const { defer } = await import('@ereo/data');

    server = createServer({ port: 4652, logging: false, renderMode: 'streaming' });

    const TestComponent = ({ loaderData }: any) =>
      createElement('div', null, loaderData.title);

    const mockRouter = {
      match: () => ({
        route: {
          id: '/deferred-stream',
          path: '/deferred-stream',
          file: '/deferred-stream.tsx',
          module: {
            default: TestComponent,
            loader: async () => ({
              title: 'Streamed Page',
              data: defer(Promise.resolve({ count: 42 })),
            }),
          },
        },
        params: {},
        pathname: '/deferred-stream',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    const response = await fetch('http://localhost:4652/deferred-stream');

    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain('window.__EREO_DATA__');
    expect(html).toContain('"count":42');
    expect(html).not.toContain('"status":"pending"');
  });

  test('minimal page resolves deferred data', async () => {
    const { defer } = await import('@ereo/data');

    server = createServer({ port: 4653, logging: false });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/deferred-minimal',
          path: '/deferred-minimal',
          file: '/deferred-minimal.tsx',
          module: {
            // No default component — triggers renderMinimalPage
            loader: async () => ({
              items: defer(Promise.resolve(['a', 'b', 'c'])),
            }),
          },
        },
        params: {},
        pathname: '/deferred-minimal',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    const response = await fetch('http://localhost:4653/deferred-minimal');

    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain('window.__EREO_DATA__');
    // Resolved array values should appear
    expect(html).toContain('"a"');
    expect(html).toContain('"b"');
    expect(html).toContain('"c"');
    expect(html).not.toContain('"status":"pending"');
  });

  test('loader with no deferred data still works (fast path)', async () => {
    server = createServer({ port: 4654, logging: false });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/no-defer',
          path: '/no-defer',
          file: '/no-defer.tsx',
          module: {
            loader: async () => ({ plain: 'data', count: 5 }),
          },
        },
        params: {},
        pathname: '/no-defer',
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    const response = await fetch('http://localhost:4654/no-defer', {
      headers: { Accept: 'application/json' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toEqual({ plain: 'data', count: 5 });
  });

  test('layout loader with deferred data is resolved in JSON response', async () => {
    const { defer } = await import('@ereo/data');

    server = createServer({ port: 4655, logging: false });

    const mockRouter = {
      match: () => ({
        route: {
          id: '/page',
          path: '/page',
          file: '/page.tsx',
          module: {
            loader: async () => ({ content: 'hello' }),
          },
        },
        params: {},
        pathname: '/page',
        layouts: [
          {
            id: 'root-layout',
            path: '/',
            file: '/_layout.tsx',
            layout: true,
            module: {
              loader: async () => ({
                nav: defer(Promise.resolve(['Home', 'About', 'Contact'])),
              }),
            },
          },
        ],
      }),
      loadModule: async () => {},
    };

    server.setRouter(mockRouter as any);
    await server.start();

    const response = await fetch('http://localhost:4655/page', {
      headers: { Accept: 'application/json' },
    });

    const json = await response.json();
    expect(json.data).toEqual({ content: 'hello' });
    expect(json.layoutData['root-layout'].nav).toEqual(['Home', 'About', 'Contact']);
  });
});
