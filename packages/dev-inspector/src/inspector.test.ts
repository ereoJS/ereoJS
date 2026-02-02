/**
 * @areo/dev-inspector - Tests
 */

import { describe, it, expect } from 'bun:test';
import {
  createDevInspector,
  generateInspectorHTML,
  createRouteInfo,
  formatRouteTree,
} from './inspector';
import type { Route } from '@areo/core';

describe('createDevInspector', () => {
  it('should create inspector plugin', () => {
    const plugin = createDevInspector();

    expect(plugin.name).toBe('@areo/dev-inspector');
    expect(typeof plugin.configureServer).toBe('function');
  });

  it('should accept custom mount path', () => {
    const plugin = createDevInspector({ mountPath: '/custom-inspector' });
    expect(plugin.name).toBe('@areo/dev-inspector');
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
});
