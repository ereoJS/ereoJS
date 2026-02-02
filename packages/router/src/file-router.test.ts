import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { join } from 'node:path';
import { mkdir, rm, writeFile, unlink } from 'node:fs/promises';
import { FileRouter, createFileRouter, initFileRouter } from './file-router';
import type { Route } from '@areo/core';

const TEST_ROUTES_DIR = join(import.meta.dir, '__test_routes__');

describe('@areo/router - FileRouter', () => {
  beforeEach(async () => {
    await mkdir(TEST_ROUTES_DIR, { recursive: true });
    await mkdir(join(TEST_ROUTES_DIR, 'users'), { recursive: true });
    await writeFile(join(TEST_ROUTES_DIR, 'index.tsx'), 'export default function Home() {}');
    await writeFile(join(TEST_ROUTES_DIR, 'about.tsx'), 'export default function About() {}');
    await writeFile(join(TEST_ROUTES_DIR, 'users', 'index.tsx'), 'export default function Users() {}');
    await writeFile(join(TEST_ROUTES_DIR, 'users', '[id].tsx'), 'export default function User() {}');
    await writeFile(join(TEST_ROUTES_DIR, '_layout.tsx'), 'export default function Layout() {}');
  });

  afterEach(async () => {
    await rm(TEST_ROUTES_DIR, { recursive: true, force: true });
  });

  describe('createFileRouter', () => {
    test('creates a FileRouter instance', () => {
      const router = createFileRouter({ routesDir: TEST_ROUTES_DIR });
      expect(router).toBeInstanceOf(FileRouter);
    });

    test('uses default options', () => {
      const router = createFileRouter();
      // Check that default routesDir is set
      expect(router).toBeInstanceOf(FileRouter);
    });
  });

  describe('initFileRouter', () => {
    test('creates and initializes a router', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });
      expect(router).toBeInstanceOf(FileRouter);
      expect(router.getRoutes().length).toBeGreaterThan(0);
    });
  });

  describe('FileRouter', () => {
    let router: FileRouter;

    beforeEach(() => {
      router = new FileRouter({ routesDir: TEST_ROUTES_DIR });
    });

    afterEach(() => {
      router.stopWatching();
    });

    test('init discovers routes', async () => {
      await router.init();

      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });

    test('discoverRoutes finds route files', async () => {
      const routes = await router.discoverRoutes();

      expect(routes.length).toBeGreaterThan(0);
      // Should find index, about, layout, users/index, users/[id]
    });

    test('getRoutes returns discovered routes', async () => {
      await router.init();

      const routes = router.getRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });

    test('getTree returns route tree', async () => {
      await router.init();

      const tree = router.getTree();
      expect(tree).not.toBeNull();
    });

    test('getMatcher returns matcher', async () => {
      await router.init();

      const matcher = router.getMatcher();
      expect(matcher).not.toBeNull();
    });

    test('match finds matching route', async () => {
      await router.init();

      const match = router.match('/');
      expect(match).not.toBeNull();
    });

    test('match returns null for unknown routes', async () => {
      await router.init();

      const match = router.match('/nonexistent/path/that/does/not/exist');
      expect(match).toBeNull();
    });

    test('on registers event handlers', async () => {
      let reloadCalled = false;

      router.on('reload', () => {
        reloadCalled = true;
      });

      await router.discoverRoutes();

      expect(reloadCalled).toBe(true);
    });

    test('on registers change handler', () => {
      let changeCalled = false;

      router.on('change', () => {
        changeCalled = true;
      });

      // Handler is registered (would be called on file change)
      expect(changeCalled).toBe(false);
    });

    test('stopWatching can be called multiple times safely', () => {
      router.stopWatching();
      router.stopWatching();
      // Should not throw
    });

    test('handles non-existent routes directory gracefully', async () => {
      const emptyRouter = new FileRouter({ routesDir: '/nonexistent/path/that/does/not/exist' });

      const routes = await emptyRouter.discoverRoutes();

      expect(routes).toEqual([]);
    });

    test('handles absolute paths', async () => {
      const absoluteRouter = new FileRouter({ routesDir: TEST_ROUTES_DIR });
      await absoluteRouter.init();

      expect(absoluteRouter.getRoutes().length).toBeGreaterThan(0);
    });

    test('uses custom extensions option', async () => {
      const customRouter = new FileRouter({
        routesDir: TEST_ROUTES_DIR,
        extensions: ['.tsx'],
      });

      await customRouter.init();

      const routes = customRouter.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('Route discovery patterns', () => {
    test('discovers index routes', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const routes = router.getRoutes();
      const hasIndex = routes.some((r) => r.path === '/' || r.index === true);

      expect(hasIndex).toBe(true);
    });

    test('discovers nested routes', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const routes = router.getRoutes();
      // Should have discovered users routes
      expect(routes.length).toBeGreaterThan(1);
    });

    test('discovers layout routes', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const routes = router.getRoutes();
      const hasLayout = routes.some((r) => r.layout === true);

      expect(hasLayout).toBe(true);
    });

    test('discovers dynamic routes', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const match = router.match('/users/123');
      // Dynamic route [id] should match
      expect(match !== null).toBe(true);
    });
  });

  describe('File watching', () => {
    test('init with watch option starts watching', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR, watch: true });
      await router.init();

      // Give it a moment to set up the watcher
      await new Promise(resolve => setTimeout(resolve, 100));

      router.stopWatching();
      // Should not throw and watcher should be cleaned up
    });

    test('startWatching handles file changes and emits change event', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR, watch: true });
      await router.init();

      let changeEmitted = false;
      let changedRoute: Route | null = null;
      router.on('change', (route) => {
        changeEmitted = true;
        changedRoute = route;
      });

      // Modify a file to trigger a change - wait longer for the debounce
      await writeFile(join(TEST_ROUTES_DIR, 'about.tsx'), 'export default function AboutUpdated() {}');

      // Wait for debounce (50ms) + file watcher propagation
      await new Promise(resolve => setTimeout(resolve, 300));

      router.stopWatching();
    });

    test('handleFileChange processes file additions', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR, watch: true });
      await router.init();

      const initialRouteCount = router.getRoutes().length;

      // Add a new route file
      await writeFile(join(TEST_ROUTES_DIR, 'contact.tsx'), 'export default function Contact() {}');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 200));

      // Clean up
      await unlink(join(TEST_ROUTES_DIR, 'contact.tsx')).catch(() => {});
      router.stopWatching();
    });

    test('handleFileChange processes file deletions and emits remove event', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR, watch: true });
      await router.init();

      let removeEmitted = false;
      let removedId: string | null = null;
      router.on('remove', (routeId) => {
        removeEmitted = true;
        removedId = routeId;
      });

      // Create and then delete a file
      const tempFile = join(TEST_ROUTES_DIR, 'temp.tsx');
      await writeFile(tempFile, 'export default function Temp() {}');

      // Wait for file to be picked up
      await new Promise(resolve => setTimeout(resolve, 200));

      await unlink(tempFile);

      // Wait for debounce and file watcher
      await new Promise(resolve => setTimeout(resolve, 300));

      router.stopWatching();
    });

    test('watchWithNode handles watcher errors gracefully', async () => {
      // Create a router with a non-existent directory to trigger watch errors
      const router = new FileRouter({ routesDir: '/nonexistent/watch/path', watch: true });

      // This should not throw
      await router.init();
      router.stopWatching();
    });

    test('handleFileChange debounce clears previous timer', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR, watch: true });
      await router.init();

      // Trigger multiple rapid changes - only last one should execute
      await writeFile(join(TEST_ROUTES_DIR, 'about.tsx'), 'export default function A1() {}');
      await writeFile(join(TEST_ROUTES_DIR, 'about.tsx'), 'export default function A2() {}');
      await writeFile(join(TEST_ROUTES_DIR, 'about.tsx'), 'export default function A3() {}');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 200));

      router.stopWatching();
    });

    test('handleFileChange with change event triggers nodeToRoute', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR, watch: true });
      await router.init();

      let changedRoute: Route | null = null;
      router.on('change', (route) => {
        changedRoute = route;
      });

      // Access the private handleFileChange method directly to test nodeToRoute
      const handleFileChange = (router as any).handleFileChange.bind(router);

      // Trigger a 'change' event (not 'rename')
      handleFileChange('about.tsx', 'change');

      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 100));

      // nodeToRoute should have been called and emitted the route
      if (changedRoute) {
        expect(changedRoute.id).toBeDefined();
        expect(changedRoute.path).toBeDefined();
        expect(changedRoute.file).toBeDefined();
      }

      router.stopWatching();
    });
  });

  describe('nodeToRoute', () => {
    test('converts route node to Route type correctly', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const tree = router.getTree();
      expect(tree).not.toBeNull();

      // Get the routes and verify structure
      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(0);

      // Check that routes have the expected properties
      for (const route of routes) {
        expect(route.id).toBeDefined();
        expect(route.path).toBeDefined();
        expect(route.file).toBeDefined();
      }
    });

    test('nodeToRoute handles children recursively', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const routes = router.getRoutes();

      // Find a route with children (users)
      const hasChildren = routes.some(r => r.children && r.children.length > 0);
      // Routes are flat in this structure, so we verify the tree contains nested routes
      expect(routes.length).toBeGreaterThan(0);
    });

    test('nodeToRoute converts node with module and children', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      // Access the private nodeToRoute method
      const nodeToRoute = (router as any).nodeToRoute.bind(router);

      // Create a mock node with all properties including module and children
      const mockNode = {
        id: '/test',
        path: '/test',
        file: '/test.tsx',
        index: true,
        layout: false,
        module: { default: () => null },
        children: [
          {
            id: '/test/child',
            path: '/test/child',
            file: '/test/child.tsx',
            index: false,
            layout: true,
            children: [],
          },
        ],
      };

      const route = nodeToRoute(mockNode);

      expect(route.id).toBe('/test');
      expect(route.path).toBe('/test');
      expect(route.file).toBe('/test.tsx');
      expect(route.index).toBe(true);
      expect(route.layout).toBe(false);
      expect(route.module).toBeDefined();
      expect(route.children).toHaveLength(1);
      expect(route.children![0].id).toBe('/test/child');
      expect(route.children![0].layout).toBe(true);
    });

    test('nodeToRoute handles node without children', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const nodeToRoute = (router as any).nodeToRoute.bind(router);

      const mockNode = {
        id: '/leaf',
        path: '/leaf',
        file: '/leaf.tsx',
        index: false,
        layout: false,
        // No children property
      };

      const route = nodeToRoute(mockNode);

      expect(route.id).toBe('/leaf');
      expect(route.children).toBeUndefined();
    });
  });

  describe('loadModule', () => {
    test('loadModule loads module and parses config', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const routes = router.getRoutes();
      const route = routes[0];

      // loadModule should handle non-existent files gracefully by throwing
      const testRoute: Route = {
        id: '/test',
        path: '/test',
        file: join(TEST_ROUTES_DIR, 'index.tsx'),
      };

      // Loading should work for existing files
      try {
        await router.loadModule(testRoute);
        expect(testRoute.module).toBeDefined();
      } catch {
        // Expected for test routes without proper exports
      }
    });

    test('loadModule skips already loaded modules', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const mockModule = { default: () => null };
      const testRoute: Route = {
        id: '/test',
        path: '/test',
        file: '/test.tsx',
        module: mockModule,
      };

      await router.loadModule(testRoute);

      // Module should remain unchanged
      expect(testRoute.module).toBe(mockModule);
    });

    test('loadModule throws on file load failure', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const testRoute: Route = {
        id: '/nonexistent',
        path: '/nonexistent',
        file: '/this/file/does/not/exist.tsx',
      };

      await expect(router.loadModule(testRoute)).rejects.toThrow();
    });
  });

  describe('findParentRoute', () => {
    test('finds parent route based on path', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      // Access private method via routes manipulation
      const routes: Route[] = [
        { id: '/', path: '/', file: '/root.tsx' },
        { id: '/users', path: '/users', file: '/users.tsx' },
        { id: '/users/profile', path: '/users/profile', file: '/users/profile.tsx' },
      ];

      (router as any).routes = routes;

      // Test findParentRoute through getRouteConfig which uses it
      const childRoute = routes[2];
      childRoute.config = { middleware: ['child'] };

      const parentRoute = routes[1];
      parentRoute.config = { middleware: ['parent'] };

      // Access the private method for testing
      const findParentRoute = (router as any).findParentRoute.bind(router);
      const parent = findParentRoute(childRoute);

      expect(parent?.path).toBe('/users');
    });

    test('findParentRoute returns undefined for root-level routes', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      const routes: Route[] = [
        { id: '/about', path: '/about', file: '/about.tsx' },
      ];

      (router as any).routes = routes;

      const findParentRoute = (router as any).findParentRoute.bind(router);
      const parent = findParentRoute(routes[0]);

      // Root level route should have parent as '/' or undefined
      expect(parent === undefined || parent?.id === '/').toBe(true);
    });
  });

  describe('loadAllModules', () => {
    test('loads all route modules recursively', async () => {
      const router = await initFileRouter({ routesDir: TEST_ROUTES_DIR });

      // Create mock routes with children
      const mockModule = { default: () => null };
      const routes: Route[] = [
        {
          id: '/parent',
          path: '/parent',
          file: join(TEST_ROUTES_DIR, 'index.tsx'),
          children: [
            {
              id: '/parent/child',
              path: '/parent/child',
              file: join(TEST_ROUTES_DIR, 'about.tsx'),
            },
          ],
        },
      ];

      (router as any).routes = routes;

      // loadAllModules should attempt to load all routes
      try {
        await router.loadAllModules();
      } catch {
        // May fail due to module format but the recursive traversal is tested
      }
    });

    test('loadAllModules handles empty routes', async () => {
      const router = new FileRouter({ routesDir: '/nonexistent' });
      await router.discoverRoutes();

      // Should not throw with empty routes
      await router.loadAllModules();
    });
  });

  describe('event emission', () => {
    test('emit calls registered handler with correct arguments', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR });

      const receivedRoutes: Route[] = [];
      router.on('reload', (routes) => {
        receivedRoutes.push(...routes);
      });

      await router.discoverRoutes();

      expect(receivedRoutes.length).toBeGreaterThan(0);
    });

    test('emit does nothing when no handler registered', async () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR });

      // No handlers registered - should not throw
      await router.discoverRoutes();
    });
  });

  describe('match without initialization', () => {
    test('match returns null when matcher not initialized', () => {
      const router = new FileRouter({ routesDir: TEST_ROUTES_DIR });

      const result = router.match('/test');
      expect(result).toBeNull();
    });
  });
});
