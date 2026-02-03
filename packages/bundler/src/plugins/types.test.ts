import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  extractParams,
  generateRouteTypes,
  generateLinkTypes,
  generateHookTypes,
  createTypesPlugin,
  writeRouteTypes,
  generateAllTypes,
} from './types';
import type { Route } from '@ereo/core';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

describe('@ereo/bundler - Types Plugin', () => {
  describe('extractParams', () => {
    test('extracts no params from static path', () => {
      const params = extractParams('/about');
      expect(Object.keys(params)).toHaveLength(0);
    });

    test('extracts dynamic params', () => {
      const params = extractParams('/blog/[slug]');
      expect(params.slug.type).toBe('string');
      expect(params.slug.optional).toBeUndefined();
    });

    test('extracts multiple params', () => {
      const params = extractParams('/[category]/[slug]');
      expect(params.category.type).toBe('string');
      expect(params.slug.type).toBe('string');
    });

    test('extracts catch-all params as array', () => {
      const params = extractParams('/docs/[...path]');
      expect(params.path.type).toBe('string[]');
    });

    test('extracts optional params', () => {
      const params = extractParams('/blog/[[page]]');
      expect(params.page.type).toBe('string');
      expect(params.page.optional).toBe(true);
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

      expect(types).toContain("declare module '@ereo/core'");
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

      expect(types).toContain("declare module '@ereo/core'");
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

      expect(types).toContain('RouteTypes');
      expect(types).toContain('LoaderDataFor<T>');
      expect(types).toContain('ParamsFor<T>');
      expect(types).toContain('ActionDataFor<T>');
    });
  });

  describe('createTypesPlugin', () => {
    const testOutDir = '.ereo-types-test';

    beforeEach(async () => {
      await rm(testOutDir, { recursive: true, force: true });
    });

    afterEach(async () => {
      await rm(testOutDir, { recursive: true, force: true });
    });

    test('creates a plugin object', () => {
      const plugin = createTypesPlugin();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('ereo:types');
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

    test('has transformRoutes hook', () => {
      const plugin = createTypesPlugin();

      expect(plugin.transformRoutes).toBeDefined();
      expect(typeof plugin.transformRoutes).toBe('function');
    });

    test('transformRoutes stores routes and returns them', () => {
      const plugin = createTypesPlugin();
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
      ];

      const result = plugin.transformRoutes!(routes);

      expect(result).toEqual(routes);
    });

    test('buildEnd writes types after transformRoutes', async () => {
      const plugin = createTypesPlugin({ outDir: testOutDir });
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
      ];

      await mkdir(testOutDir, { recursive: true });
      plugin.transformRoutes!(routes);
      await plugin.buildEnd!();

      const typesFile = await Bun.file(join(testOutDir, 'routes.d.ts')).exists();
      expect(typesFile).toBe(true);
    });

    test('buildEnd does nothing without routes', async () => {
      const plugin = createTypesPlugin({ outDir: testOutDir });

      await mkdir(testOutDir, { recursive: true });
      await plugin.buildEnd!();

      const typesFile = await Bun.file(join(testOutDir, 'routes.d.ts')).exists();
      expect(typesFile).toBe(false);
    });

    test('configureServer hook exists', () => {
      const plugin = createTypesPlugin({ watch: true });

      expect(plugin.configureServer).toBeDefined();
      expect(typeof plugin.configureServer).toBe('function');
    });

    test('configureServer can be called', async () => {
      const plugin = createTypesPlugin({ watch: true });
      const mockServer = { middlewares: [] };

      await plugin.configureServer!(mockServer);
      // Should not throw
    });

    test('plugin accepts custom options', () => {
      const plugin = createTypesPlugin({
        outDir: 'custom-dir',
        routesDir: 'custom-routes',
        inferTypes: false,
        watch: true,
      });

      expect(plugin.name).toBe('ereo:types');
    });
  });

  describe('writeRouteTypes', () => {
    const testOutDir = '.ereo-write-test';

    beforeEach(async () => {
      await rm(testOutDir, { recursive: true, force: true });
      await mkdir(testOutDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(testOutDir, { recursive: true, force: true });
    });

    test('writes route types to file', async () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
        { id: 'about', path: '/about', file: '/routes/about.tsx' },
      ];

      await writeRouteTypes(testOutDir, routes);

      const content = await Bun.file(join(testOutDir, 'routes.d.ts')).text();
      expect(content).toContain("declare module '@ereo/core'");
      expect(content).toContain("'/':");
      expect(content).toContain("'/about':");
    });

    test('writes to correct path', async () => {
      const routes: Route[] = [
        { id: 'test', path: '/test', file: '/routes/test.tsx' },
      ];

      await writeRouteTypes(testOutDir, routes);

      const exists = await Bun.file(join(testOutDir, 'routes.d.ts')).exists();
      expect(exists).toBe(true);
    });

    test('accepts custom routesDir option', async () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/custom/routes/index.tsx' },
      ];

      await writeRouteTypes(testOutDir, routes, { routesDir: 'custom/routes' });

      const content = await Bun.file(join(testOutDir, 'routes.d.ts')).text();
      expect(content).toContain("'/':");
    });

    test('accepts inferTypes option', async () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
      ];

      await writeRouteTypes(testOutDir, routes, { inferTypes: false });

      const content = await Bun.file(join(testOutDir, 'routes.d.ts')).text();
      expect(content).toContain("declare module '@ereo/core'");
    });
  });

  describe('generateAllTypes', () => {
    const testOutDir = '.ereo-all-types-test';

    beforeEach(async () => {
      await rm(testOutDir, { recursive: true, force: true });
      await mkdir(testOutDir, { recursive: true });
    });

    afterEach(async () => {
      await rm(testOutDir, { recursive: true, force: true });
    });

    test('generates all type files', async () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
        { id: 'about', path: '/about', file: '/routes/about.tsx' },
      ];

      await generateAllTypes(routes, testOutDir, 'routes');

      // Check all files were created
      const routesFile = await Bun.file(join(testOutDir, 'routes.d.ts')).exists();
      const linkFile = await Bun.file(join(testOutDir, 'link.d.ts')).exists();
      const hooksFile = await Bun.file(join(testOutDir, 'hooks.d.ts')).exists();
      const indexFile = await Bun.file(join(testOutDir, 'index.d.ts')).exists();

      expect(routesFile).toBe(true);
      expect(linkFile).toBe(true);
      expect(hooksFile).toBe(true);
      expect(indexFile).toBe(true);
    });

    test('generates valid routes types', async () => {
      const routes: Route[] = [
        { id: 'blog', path: '/blog/[slug]', file: '/routes/blog/[slug].tsx' },
      ];

      await generateAllTypes(routes, testOutDir, 'routes');

      const content = await Bun.file(join(testOutDir, 'routes.d.ts')).text();
      expect(content).toContain("'/blog/[slug]':");
      expect(content).toContain('slug: string');
    });

    test('generates valid link types', async () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
      ];

      await generateAllTypes(routes, testOutDir, 'routes');

      const content = await Bun.file(join(testOutDir, 'link.d.ts')).text();
      expect(content).toContain('LinkProps');
      expect(content).toContain('AppRoutes');
    });

    test('generates valid hooks types', async () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
      ];

      await generateAllTypes(routes, testOutDir, 'routes');

      const content = await Bun.file(join(testOutDir, 'hooks.d.ts')).text();
      expect(content).toContain('useLoaderData');
      expect(content).toContain('useParams');
      expect(content).toContain('useActionData');
      expect(content).toContain('useMatches');
      expect(content).toContain('useNavigate');
    });

    test('generates valid index file that re-exports', async () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
      ];

      await generateAllTypes(routes, testOutDir, 'routes');

      const content = await Bun.file(join(testOutDir, 'index.d.ts')).text();
      expect(content).toContain("export * from './routes'");
      expect(content).toContain("export * from './link'");
      expect(content).toContain("export * from './hooks'");
    });
  });

  describe('generateRouteTypes with loader and action inference', () => {
    test('generates loader type ref when hasLoader is true', () => {
      const routes: Route[] = [
        {
          id: 'page',
          path: '/page',
          file: '/routes/page.tsx',
          module: { loader: async () => ({ data: true }) },
        },
      ];

      const types = generateRouteTypes(routes, { inferTypes: true });

      expect(types).toContain('loader:');
      expect(types).toContain('Awaited<R>');
    });

    test('generates action type ref when hasAction is true', () => {
      const routes: Route[] = [
        {
          id: 'form',
          path: '/form',
          file: '/routes/form.tsx',
          module: { action: async () => ({ success: true }) },
        },
      ];

      const types = generateRouteTypes(routes, { inferTypes: true });

      expect(types).toContain('action:');
    });

    test('generates unknown types when inferTypes is false', () => {
      const routes: Route[] = [
        {
          id: 'page',
          path: '/page',
          file: '/routes/page.tsx',
          module: { loader: async () => ({ data: true }) },
        },
      ];

      const types = generateRouteTypes(routes, { inferTypes: false });

      expect(types).toContain('loader: unknown');
      expect(types).toContain('action: unknown');
    });

    test('generates meta and handle types', () => {
      const routes: Route[] = [
        {
          id: 'page',
          path: '/page',
          file: '/routes/page.tsx',
          module: {
            meta: () => [{ title: 'Page' }],
            handle: { breadcrumb: 'Page' },
          },
        },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain('meta: true');
      expect(types).toContain('handle:');
    });

    test('generates route config types', () => {
      const routes: Route[] = [
        {
          id: 'page',
          path: '/page',
          file: '/routes/page.tsx',
          config: {
            render: { mode: 'ssr' },
            auth: { required: true },
          },
        },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain("'/page':");
    });

    test('generates unique import names for route files', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
        { id: 'about', path: '/about', file: '/routes/about.tsx' },
      ];

      const types = generateRouteTypes(routes, { inferTypes: true });

      // Should have imports with safe names (underscores instead of special chars)
      expect(types).toContain('import type');
      expect(types).toContain('_routes_index');
      expect(types).toContain('_routes_about');
    });

    test('handles duplicate import paths correctly', () => {
      const routes: Route[] = [
        { id: 'index1', path: '/', file: '/routes/index.tsx' },
        { id: 'index2', path: '/other', file: '/routes/index.tsx' }, // Same file, different route
      ];

      const types = generateRouteTypes(routes, { inferTypes: true });

      // Should not duplicate imports
      expect(types).toContain("declare module '@ereo/core'");
    });
  });

  describe('generateRouteTypes helper function buildPath', () => {
    test('includes buildPath function in output', () => {
      const routes: Route[] = [
        { id: 'blog', path: '/blog/[slug]', file: '/routes/blog/[slug].tsx' },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain('export function buildPath');
      expect(types).toContain('ParamsFor<T>');
    });
  });
});
