/**
 * @ereo/dev-inspector - Tests
 */

import { describe, it, expect } from 'bun:test';
import {
  createDevInspector,
  generateInspectorHTML,
  createRouteInfo,
  formatRouteTree,
} from './inspector';
import type { Route } from '@ereo/core';

describe('createDevInspector', () => {
  it('should create inspector plugin', () => {
    const plugin = createDevInspector();

    expect(plugin.name).toBe('@ereo/dev-inspector');
    expect(typeof plugin.configureServer).toBe('function');
  });

  it('should accept custom mount path', () => {
    const plugin = createDevInspector({ mountPath: '/custom-inspector' });
    expect(plugin.name).toBe('@ereo/dev-inspector');
  });
});

describe('generateInspectorHTML', () => {
  it('should generate HTML with routes', () => {
    const routes = [
      {
        id: 'home',
        path: '/',
        file: 'index.tsx',
        renderMode: 'ssr',
        islandCount: 0,
        hasLoader: true,
        hasAction: false,
        middlewareCount: 0,
      },
      {
        id: 'blog',
        path: '/blog',
        file: 'blog.ssg.tsx',
        renderMode: 'ssg',
        islandCount: 2,
        hasLoader: true,
        hasAction: false,
        middlewareCount: 1,
      },
    ];

    const html = generateInspectorHTML(routes);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Route Inspector');
    expect(html).toContain('/blog');
    expect(html).toContain('ssg');
  });

  it('should include search functionality', () => {
    const routes: typeof routes = [];
    const html = generateInspectorHTML(routes);

    expect(html).toContain('search');
    expect(html).toContain('search-box');
  });

  it('should display route stats', () => {
    const routes = [
      { id: '1', path: '/', file: 'index.tsx', renderMode: 'ssr', islandCount: 0, hasLoader: false, hasAction: false, middlewareCount: 0 },
      { id: '2', path: '/api', file: 'api.ts', renderMode: 'api', islandCount: 0, hasLoader: false, hasAction: false, middlewareCount: 1, file: 'api/api.ts' },
    ];

    const html = generateInspectorHTML(routes);

    expect(html).toContain('Total Routes');
    expect(html).toContain('SSR Routes');
    expect(html).toContain('API Routes');
  });
});

describe('createRouteInfo', () => {
  it('should extract info from routes', () => {
    const routes: Route[] = [
      {
        id: 'home',
        path: '/',
        file: 'index.tsx',
        config: {
          render: { mode: 'ssr' },
        },
      },
      {
        id: 'blog',
        path: '/blog',
        file: 'blog.tsx',
        config: {
          render: { mode: 'ssg' },
          islands: { components: [{ component: 'Counter', strategy: 'load' }] },
          auth: { required: true },
        },
        module: {
          loader: async () => ({}),
        },
      },
    ];

    const info = createRouteInfo(routes);

    expect(info).toHaveLength(2);
    expect(info[1].renderMode).toBe('ssg');
    expect(info[1].islandCount).toBe(1);
    expect(info[1].authRequired).toBe(true);
    expect(info[1].hasLoader).toBe(true);
  });

  it('should default to ssr render mode', () => {
    const routes: Route[] = [
      {
        id: 'home',
        path: '/',
        file: 'index.tsx',
      },
    ];

    const info = createRouteInfo(routes);
    expect(info[0].renderMode).toBe('ssr');
  });
});

describe('formatRouteTree', () => {
  it('should format routes for CLI display', () => {
    const routes = [
      {
        id: 'home',
        path: '/',
        file: 'index.tsx',
        renderMode: 'ssr',
        islandCount: 0,
        hasLoader: true,
        hasAction: false,
        middlewareCount: 0,
      },
      {
        id: 'blog',
        path: '/blog',
        file: 'blog.tsx',
        renderMode: 'ssg',
        islandCount: 2,
        hasLoader: false,
        hasAction: true,
        middlewareCount: 0,
      },
    ];

    const output = formatRouteTree(routes);

    expect(output).toContain('Route Tree:');
    expect(output).toContain('/');
    expect(output).toContain('/blog');
    expect(output).toContain('loader');
    expect(output).toContain('action');
    expect(output).toContain('2 islands');
  });

  it('should display correct icons for all render modes', () => {
    const routes = [
      {
        id: 'ssr',
        path: '/ssr',
        file: 'ssr.tsx',
        renderMode: 'ssr',
        islandCount: 0,
        hasLoader: false,
        hasAction: false,
        middlewareCount: 0,
      },
      {
        id: 'ssg',
        path: '/ssg',
        file: 'ssg.tsx',
        renderMode: 'ssg',
        islandCount: 0,
        hasLoader: false,
        hasAction: false,
        middlewareCount: 0,
      },
      {
        id: 'csr',
        path: '/csr',
        file: 'csr.tsx',
        renderMode: 'csr',
        islandCount: 0,
        hasLoader: false,
        hasAction: false,
        middlewareCount: 0,
      },
      {
        id: 'api',
        path: '/api',
        file: 'api.ts',
        renderMode: 'api',
        islandCount: 0,
        hasLoader: false,
        hasAction: false,
        middlewareCount: 0,
      },
      {
        id: 'rsc',
        path: '/rsc',
        file: 'rsc.tsx',
        renderMode: 'rsc',
        islandCount: 0,
        hasLoader: false,
        hasAction: false,
        middlewareCount: 0,
      },
      {
        id: 'unknown',
        path: '/unknown',
        file: 'unknown.tsx',
        renderMode: 'custom',
        islandCount: 0,
        hasLoader: false,
        hasAction: false,
        middlewareCount: 0,
      },
    ];

    const output = formatRouteTree(routes);

    // SSR icon
    expect(output).toContain('⚡');
    // SSG icon
    expect(output).toContain('📄');
    // CSR icon
    expect(output).toContain('💻');
    // API icon
    expect(output).toContain('🔌');
    // RSC icon
    expect(output).toContain('🚀');
    // Default icon for unknown mode
    expect(output).toContain('•');
  });

  it('should display auth tag when authRequired is true', () => {
    const routes = [
      {
        id: 'protected',
        path: '/protected',
        file: 'protected.tsx',
        renderMode: 'ssr',
        islandCount: 0,
        hasLoader: false,
        hasAction: false,
        middlewareCount: 0,
        authRequired: true,
      },
    ];

    const output = formatRouteTree(routes);

    expect(output).toContain('auth');
  });
});

describe('createDevInspector configureServer', () => {
  it('should return inspector HTML at mount path', async () => {
    const plugin = createDevInspector({ mountPath: '/__test-inspector' });

    let middleware: (
      request: Request,
      ctx: unknown,
      next: () => Promise<Response>
    ) => Promise<Response>;
    const mockServer = {
      middlewares: {
        push: (fn: typeof middleware) => {
          middleware = fn;
        },
      },
    };

    plugin.configureServer!(mockServer);

    const request = new Request('http://localhost:3000/__test-inspector');
    const next = () => Promise.resolve(new Response('fallback'));

    const response = await middleware!(request, {}, next);

    expect(response.headers.get('Content-Type')).toBe('text/html');
    const text = await response.text();
    expect(text).toContain('<!DOCTYPE html>');
    expect(text).toContain('Route Inspector');
  });

  it('should return routes JSON at api/routes endpoint', async () => {
    const plugin = createDevInspector({ mountPath: '/__ereo' });

    let middleware: (
      request: Request,
      ctx: unknown,
      next: () => Promise<Response>
    ) => Promise<Response>;
    const mockServer = {
      middlewares: {
        push: (fn: typeof middleware) => {
          middleware = fn;
        },
      },
    };

    plugin.configureServer!(mockServer);

    const request = new Request('http://localhost:3000/__ereo/api/routes');
    const next = () => Promise.resolve(new Response('fallback'));

    const response = await middleware!(request, {}, next);

    expect(response.headers.get('Content-Type')).toBe('application/json');
    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
  });

  it('should call next for unmatched paths', async () => {
    const plugin = createDevInspector();

    let middleware: (
      request: Request,
      ctx: unknown,
      next: () => Promise<Response>
    ) => Promise<Response>;
    const mockServer = {
      middlewares: {
        push: (fn: typeof middleware) => {
          middleware = fn;
        },
      },
    };

    plugin.configureServer!(mockServer);

    const request = new Request('http://localhost:3000/some-other-path');
    const next = () => Promise.resolve(new Response('next handler'));

    const response = await middleware!(request, {}, next);

    expect(await response.text()).toBe('next handler');
  });

  it('should use default mount path when not specified', async () => {
    const plugin = createDevInspector();

    let middleware: (
      request: Request,
      ctx: unknown,
      next: () => Promise<Response>
    ) => Promise<Response>;
    const mockServer = {
      middlewares: {
        push: (fn: typeof middleware) => {
          middleware = fn;
        },
      },
    };

    plugin.configureServer!(mockServer);

    const request = new Request('http://localhost:3000/__ereo');
    const next = () => Promise.resolve(new Response('fallback'));

    const response = await middleware!(request, {}, next);

    expect(response.headers.get('Content-Type')).toBe('text/html');
  });
});
