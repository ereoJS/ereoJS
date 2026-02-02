/**
 * @areo/router - File Router Config Integration Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { Route, RouteConfig } from '@areo/core';
import { FileRouter } from './file-router';
import { parseRouteConfig, mergeRouteConfigs } from './route-config';

describe('FileRouter - Route Config Integration', () => {
  let router: FileRouter;

  beforeEach(() => {
    router = new FileRouter({ routesDir: '/test/routes' });
  });

  describe('loadModule with config parsing', () => {
    it('should parse config from module exports', async () => {
      const route: Route = {
        id: '/test',
        path: '/test',
        file: '/test/routes/test.tsx',
      };

      // Mock the module import
      const mockModule = {
        default: () => null,
        config: {
          render: { mode: 'ssg', prerender: { enabled: true } },
          auth: { required: true },
        },
      };

      // We can't easily mock dynamic imports, so test the parsing directly
      const config = parseRouteConfig(mockModule.config);
      route.config = config;

      expect(config.render?.mode).toBe('ssg');
      expect(config.auth?.required).toBe(true);
    });

    it('should merge parent and child configs', () => {
      const parentConfig: RouteConfig = {
        middleware: ['csrf'],
        cache: { edge: { maxAge: 3600 } },
      };

      const childConfig: RouteConfig = {
        middleware: ['auth'],
        render: { mode: 'ssr' },
      };

      const merged = mergeRouteConfigs(parentConfig, childConfig);

      expect(merged.middleware).toEqual(['csrf', 'auth']);
      expect(merged.cache?.edge?.maxAge).toBe(3600);
      expect(merged.render?.mode).toBe('ssr');
    });
  });

  describe('getRouteConfig', () => {
    it('should return undefined for routes without config', async () => {
      const route: Route = {
        id: '/simple',
        path: '/simple',
        file: '/test/routes/simple.tsx',
        module: { default: () => null },
      };

      const config = await router.getRouteConfig(route);
      expect(config).toBeUndefined();
    });

    it('should return cached config without reloading', async () => {
      const route: Route = {
        id: '/cached',
        path: '/cached',
        file: '/test/routes/cached.tsx',
        config: { render: { mode: 'ssg' } },
      };

      const config = await router.getRouteConfig(route);
      expect(config?.render?.mode).toBe('ssg');
    });
  });

  describe('findRoutesByRenderMode', () => {
    it('should filter routes by render mode', async () => {
      // Set up routes with configs and module property to prevent loading
      const mockModule = { default: () => null };
      const routes: Route[] = [
        {
          id: '/ssg',
          path: '/ssg',
          file: '/test/routes/ssg.tsx',
          config: { render: { mode: 'ssg' } },
          module: mockModule,
        },
        {
          id: '/ssr',
          path: '/ssr',
          file: '/test/routes/ssr.tsx',
          config: { render: { mode: 'ssr' } },
          module: mockModule,
        },
        {
          id: '/csr',
          path: '/csr',
          file: '/test/routes/csr.tsx',
          config: { render: { mode: 'csr' } },
          module: mockModule,
        },
      ];

      // Access private routes for testing
      (router as any).routes = routes;

      const ssgRoutes = await router.findRoutesByRenderMode('ssg');
      expect(ssgRoutes).toHaveLength(1);
      expect(ssgRoutes[0].path).toBe('/ssg');

      const ssrRoutes = await router.findRoutesByRenderMode('ssr');
      expect(ssrRoutes).toHaveLength(1);
    });
  });

  describe('findProtectedRoutes', () => {
    it('should find routes requiring authentication', async () => {
      const mockModule = { default: () => null };
      const routes: Route[] = [
        {
          id: '/public',
          path: '/public',
          file: '/test/routes/public.tsx',
          module: mockModule,
        },
        {
          id: '/admin',
          path: '/admin',
          file: '/test/routes/admin.tsx',
          config: { auth: { required: true } },
          module: mockModule,
        },
        {
          id: '/dashboard',
          path: '/dashboard',
          file: '/test/routes/dashboard.tsx',
          config: { auth: { required: true, roles: ['user'] } },
          module: mockModule,
        },
      ];

      (router as any).routes = routes;

      const protectedRoutes = await router.findProtectedRoutes();
      expect(protectedRoutes).toHaveLength(2);
      expect(protectedRoutes.map((r) => r.path)).toContain('/admin');
      expect(protectedRoutes.map((r) => r.path)).toContain('/dashboard');
    });
  });

  describe('getPrerenderPaths', () => {
    it('should collect prerender paths from SSG routes', async () => {
      const mockModule = { default: () => null };
      const routes: Route[] = [
        {
          id: '/blog',
          path: '/blog',
          file: '/test/routes/blog.tsx',
          config: {
            render: {
              mode: 'ssg',
              prerender: {
                enabled: true,
                paths: ['/blog/post-1', '/blog/post-2'],
              },
            },
          },
          module: mockModule,
        },
        {
          id: '/about',
          path: '/about',
          file: '/test/routes/about.tsx',
          config: {
            render: {
              mode: 'ssg',
              prerender: {
                enabled: true,
                paths: async () => ['/about/team', '/about/contact'],
              },
            },
          },
          module: mockModule,
        },
        {
          id: '/dynamic',
          path: '/dynamic',
          file: '/test/routes/dynamic.tsx',
          config: { render: { mode: 'ssr' } },
          module: mockModule,
        },
      ];

      (router as any).routes = routes;

      const paths = await router.getPrerenderPaths();
      expect(paths).toContain('/blog/post-1');
      expect(paths).toContain('/blog/post-2');
      expect(paths).toContain('/about/team');
      expect(paths).toContain('/about/contact');
    });

    it('should handle routes without prerender config', async () => {
      const mockModule = { default: () => null };
      const routes: Route[] = [
        {
          id: '/minimal',
          path: '/minimal',
          file: '/test/routes/minimal.tsx',
          config: { render: { mode: 'ssg', prerender: { enabled: true } } },
          module: mockModule,
        },
      ];

      (router as any).routes = routes;

      const paths = await router.getPrerenderPaths();
      expect(paths).toEqual([]);
    });
  });
});
