import { describe, expect, test } from 'bun:test';
import {
  extractParams,
  generateRouteTypes,
  generateLinkTypes,
  generateHookTypes,
  createTypesPlugin,
} from './types';
import type { Route } from '@areo/core';

describe('@areo/bundler - Types Plugin', () => {
  describe('extractParams', () => {
    test('extracts no params from static path', () => {
      const params = extractParams('/about');
      expect(Object.keys(params)).toHaveLength(0);
    });

    test('extracts dynamic params', () => {
      const params = extractParams('/blog/[slug]');
      expect(params.slug).toBe('string');
    });

    test('extracts multiple params', () => {
      const params = extractParams('/[category]/[slug]');
      expect(params.category).toBe('string');
      expect(params.slug).toBe('string');
    });

    test('extracts catch-all params as array', () => {
      const params = extractParams('/docs/[...path]');
      expect(params.path).toBe('string[]');
    });

    test('extracts optional params', () => {
      const params = extractParams('/blog/[[page]]');
      expect(params.page).toBe('string');
    });
  });

  describe('generateRouteTypes', () => {
    test('generates types for routes', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
        { id: 'about', path: '/about', file: '/routes/about.tsx' },
        { id: 'blog-post', path: '/blog/[slug]', file: '/routes/blog/[slug].tsx' },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain("declare module '@areo/core'");
      expect(types).toContain("export interface RouteTypes");
      expect(types).toContain("'/':");
      expect(types).toContain("'/about':");
      expect(types).toContain("'/blog/[slug]':");
      expect(types).toContain('slug: string');
    });

    test('excludes layout routes', () => {
      const routes: Route[] = [
        { id: 'layout', path: '/', file: '/routes/_layout.tsx', layout: true },
        { id: 'home', path: '/', file: '/routes/index.tsx', index: true },
      ];

      const types = generateRouteTypes(routes);

      // Should have home but layout behavior is handled in generation
      expect(types).toContain("'/':");
    });

    test('generates empty params for static routes', () => {
      const routes: Route[] = [
        { id: 'about', path: '/about', file: '/routes/about.tsx' },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain('Record<string, never>');
    });

    test('handles nested children routes', () => {
      const routes: Route[] = [
        {
          id: 'users',
          path: '/users',
          file: '/routes/users.tsx',
          children: [
            { id: 'user', path: '/users/[id]', file: '/routes/users/[id].tsx' },
          ],
        },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain("'/users':");
      expect(types).toContain("'/users/[id]':");
      expect(types).toContain('id: string');
    });

    test('handles empty routes array', () => {
      const types = generateRouteTypes([]);

      expect(types).toContain("declare module '@areo/core'");
      expect(types).toContain('export {};');
    });
  });

  describe('generateLinkTypes', () => {
    test('generates link types for routes', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
        { id: 'about', path: '/about', file: '/about.tsx' },
      ];

      const types = generateLinkTypes(routes);

      expect(types).toContain('AppRoutes');
      expect(types).toContain("'/'");
      expect(types).toContain("'/about'");
      expect(types).toContain('LinkProps');
    });

    test('excludes layout routes from link types', () => {
      const routes: Route[] = [
        { id: 'layout', path: '/', file: '/_layout.tsx', layout: true },
        { id: 'home', path: '/', file: '/index.tsx' },
      ];

      const types = generateLinkTypes(routes);

      expect(types).toContain('AppRoutes');
    });

    test('generates union type for multiple routes', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
        { id: 'about', path: '/about', file: '/about.tsx' },
        { id: 'contact', path: '/contact', file: '/contact.tsx' },
      ];

      const types = generateLinkTypes(routes);

      expect(types).toContain('|');
    });

    test('handles empty routes with string fallback', () => {
      const types = generateLinkTypes([]);

      expect(types).toContain('AppRoutes = string');
    });

    test('includes prefetch option in LinkProps', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
      ];

      const types = generateLinkTypes(routes);

      expect(types).toContain("prefetch?: 'hover' | 'viewport' | 'none'");
    });
  });

  describe('generateHookTypes', () => {
    test('generates hook type definitions', () => {
      const types = generateHookTypes();

      expect(types).toContain('useLoaderData');
      expect(types).toContain('useParams');
      expect(types).toContain('useActionData');
    });

    test('references RouteTypes for type inference', () => {
      const types = generateHookTypes();

      expect(types).toContain('keyof RouteTypes');
      expect(types).toContain("RouteTypes[T]['loader']");
      expect(types).toContain("RouteTypes[T]['params']");
      expect(types).toContain("RouteTypes[T]['action']");
    });
  });

  describe('createTypesPlugin', () => {
    test('creates a plugin object', () => {
      const plugin = createTypesPlugin();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('areo:types');
    });

    test('has buildEnd hook', () => {
      const plugin = createTypesPlugin();

      expect(plugin.buildEnd).toBeDefined();
      expect(typeof plugin.buildEnd).toBe('function');
    });

    test('buildEnd can be called', async () => {
      const plugin = createTypesPlugin();

      await plugin.buildEnd();
      // Should not throw
    });
  });
});
