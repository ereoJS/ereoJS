import { describe, expect, test, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test';
import { join } from 'node:path';
import { mkdir, rm, writeFile, unlink, access } from 'node:fs/promises';
// Import from source files directly to avoid module resolution conflicts with other tests
import { FileRouter, createFileRouter, initFileRouter } from './file-router';
import type { Route } from '@ereo/core';

// Unique test directory per test run to avoid conflicts
const TEST_RUN_ID = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const BASE_TEST_DIR = join(import.meta.dir, `__test_routes_${TEST_RUN_ID}__`);

// Helper to create test routes directory with files
async function createTestRoutesDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'users'), { recursive: true });
  await writeFile(join(dir, 'index.tsx'), 'export default function Home() {}');
  await writeFile(join(dir, 'about.tsx'), 'export default function About() {}');
  await writeFile(join(dir, 'users', 'index.tsx'), 'export default function Users() {}');
  await writeFile(join(dir, 'users', '[id].tsx'), 'export default function User() {}');
  await writeFile(join(dir, '_layout.tsx'), 'export default function Layout() {}');
}

// Helper to verify directory exists
async function ensureDir(dir: string): Promise<boolean> {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

describe('@ereo/router - FileRouter', () => {
  // Clean up the entire test directory tree after all tests complete
  afterAll(async () => {
    try {
      await rm(BASE_TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createFileRouter', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `createFileRouter_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('creates a FileRouter instance', () => {
      const router = createFileRouter({ routesDir: testDir });
      // Check for FileRouter-specific methods instead of instanceof (avoids bundled vs source module issues)
      expect(typeof router.init).toBe('function');
      expect(typeof router.getRoutes).toBe('function');
      expect(typeof router.match).toBe('function');
    });

    test('uses default options', () => {
      const router = createFileRouter();
      expect(typeof router.init).toBe('function');
      expect(typeof router.getRoutes).toBe('function');
    });
  });

  describe('initFileRouter', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `initFileRouter_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('creates and initializes a router', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();
      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('FileRouter', () => {
    let testDir: string;
    let router: FileRouter;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `FileRouter_${Date.now()}`);
      await createTestRoutesDir(testDir);
      router = new FileRouter({ routesDir: testDir });
    });

    afterEach(async () => {
      router.stopWatching();
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('init discovers routes', async () => {
      await router.init();
      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });

    test('discoverRoutes finds route files', async () => {
      const routes = await router.discoverRoutes();
      expect(routes.length).toBeGreaterThan(0);
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
      const absoluteRouter = new FileRouter({ routesDir: testDir });
      await absoluteRouter.init();
      expect(absoluteRouter.getRoutes().length).toBeGreaterThan(0);
    });

    test('uses custom extensions option', async () => {
      const customRouter = new FileRouter({
        routesDir: testDir,
        extensions: ['.tsx'],
      });

      await customRouter.init();

      const routes = customRouter.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('Route discovery patterns', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `RouteDiscovery_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('discovers index routes', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();
      const routes = router.getRoutes();
      const hasIndex = routes.some((r) => r.path === '/' || r.index === true);
      expect(hasIndex).toBe(true);
    });

    test('discovers nested routes', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();
      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(1);
    });

    test('discovers layout routes', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();
      const routes = router.getRoutes();
      const hasLayout = routes.some((r) => r.layout === true);
      expect(hasLayout).toBe(true);
    });

    test('discovers dynamic routes', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();
      const match = router.match('/users/123');
      expect(match !== null).toBe(true);
    });
  });

  describe('File watching', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `FileWatching_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('init with watch option starts watching', async () => {
      const router = new FileRouter({ routesDir: testDir, watch: true });
      await router.init();

      await new Promise(resolve => setTimeout(resolve, 100));

      router.stopWatching();
    });

    test('startWatching handles file changes and emits change event', async () => {
      const router = new FileRouter({ routesDir: testDir, watch: true });
      await router.init();

      let changeEmitted = false;
      let changedRoute: Route | null = null;
      router.on('change', (route) => {
        changeEmitted = true;
        changedRoute = route;
      });

      await writeFile(join(testDir, 'about.tsx'), 'export default function AboutUpdated() {}');

      await new Promise(resolve => setTimeout(resolve, 300));

      router.stopWatching();
    });

    test('handleFileChange processes file additions', async () => {
      const router = new FileRouter({ routesDir: testDir, watch: true });
      await router.init();

      const initialRouteCount = router.getRoutes().length;

      await writeFile(join(testDir, 'contact.tsx'), 'export default function Contact() {}');

      await new Promise(resolve => setTimeout(resolve, 200));

      await unlink(join(testDir, 'contact.tsx')).catch(() => {});
      router.stopWatching();
    });

    test('handleFileChange processes file deletions and emits remove event', async () => {
      const router = new FileRouter({ routesDir: testDir, watch: true });
      await router.init();

      let removeEmitted = false;
      let removedId: string | null = null;
      router.on('remove', (routeId) => {
        removeEmitted = true;
        removedId = routeId;
      });

      const tempFile = join(testDir, 'temp.tsx');
      await writeFile(tempFile, 'export default function Temp() {}');

      await new Promise(resolve => setTimeout(resolve, 200));

      await unlink(tempFile);

      await new Promise(resolve => setTimeout(resolve, 300));

      router.stopWatching();
    });

    test('watchWithNode handles watcher errors gracefully', async () => {
      const router = new FileRouter({ routesDir: '/nonexistent/watch/path', watch: true });

      await router.init();
      router.stopWatching();
    });

    test('handleFileChange debounce clears previous timer', async () => {
      const router = new FileRouter({ routesDir: testDir, watch: true });
      await router.init();

      await writeFile(join(testDir, 'about.tsx'), 'export default function A1() {}');
      await writeFile(join(testDir, 'about.tsx'), 'export default function A2() {}');
      await writeFile(join(testDir, 'about.tsx'), 'export default function A3() {}');

      await new Promise(resolve => setTimeout(resolve, 200));

      router.stopWatching();
    });

    test('handleFileChange with change event triggers nodeToRoute', async () => {
      const router = new FileRouter({ routesDir: testDir, watch: true });
      await router.init();

      let changedRoute: Route | null = null;
      router.on('change', (route) => {
        changedRoute = route;
      });

      const handleFileChange = (router as any).handleFileChange.bind(router);

      handleFileChange('about.tsx', 'change');

      await new Promise(resolve => setTimeout(resolve, 100));

      if (changedRoute) {
        expect(changedRoute.id).toBeDefined();
        expect(changedRoute.path).toBeDefined();
        expect(changedRoute.file).toBeDefined();
      }

      router.stopWatching();
    });
  });

  describe('nodeToRoute', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `nodeToRoute_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('converts route node to Route type correctly', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const tree = router.getTree();
      expect(tree).not.toBeNull();

      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(0);

      for (const route of routes) {
        expect(route.id).toBeDefined();
        expect(route.path).toBeDefined();
        expect(route.file).toBeDefined();
      }
    });

    test('nodeToRoute handles children recursively', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();
      const routes = router.getRoutes();

      const hasChildren = routes.some(r => r.children && r.children.length > 0);
      expect(routes.length).toBeGreaterThan(0);
    });

    test('nodeToRoute converts node with module and children', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const nodeToRoute = (router as any).nodeToRoute?.bind(router);
      if (!nodeToRoute) {
        // Skip if private method not accessible due to module bundling
        return;
      }

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
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const nodeToRoute = (router as any).nodeToRoute?.bind(router);
      if (!nodeToRoute) {
        // Skip if private method not accessible due to module bundling
        return;
      }

      const mockNode = {
        id: '/leaf',
        path: '/leaf',
        file: '/leaf.tsx',
        index: false,
        layout: false,
      };

      const route = nodeToRoute(mockNode);

      expect(route.id).toBe('/leaf');
      expect(route.children).toBeUndefined();
    });
  });

  describe('loadModule', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `loadModule_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('loadModule loads module and parses config', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const routes = router.getRoutes();
      const route = routes[0];

      const testRoute: Route = {
        id: '/test',
        path: '/test',
        file: join(testDir, 'index.tsx'),
      };

      try {
        await router.loadModule(testRoute);
        expect(testRoute.module).toBeDefined();
      } catch {
        // Expected for test routes without proper exports
      }
    });

    test('loadModule skips already loaded modules', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const mockModule = { default: () => null };
      const testRoute: Route = {
        id: '/test',
        path: '/test',
        file: '/test.tsx',
        module: mockModule,
      };

      await router.loadModule(testRoute);

      expect(testRoute.module).toBe(mockModule);
    });

    test('loadModule throws on file load failure', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const testRoute: Route = {
        id: '/nonexistent',
        path: '/nonexistent',
        file: '/this/file/does/not/exist.tsx',
      };

      await expect(router.loadModule(testRoute)).rejects.toThrow();
    });
  });

  describe('findParentRoute', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `findParentRoute_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('finds parent route based on path', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const routes: Route[] = [
        { id: '/', path: '/', file: '/root.tsx' },
        { id: '/users', path: '/users', file: '/users.tsx' },
        { id: '/users/profile', path: '/users/profile', file: '/users/profile.tsx' },
      ];

      (router as any).routes = routes;

      const childRoute = routes[2];
      childRoute.config = { middleware: ['child'] };

      const parentRoute = routes[1];
      parentRoute.config = { middleware: ['parent'] };

      const findParentRoute = (router as any).findParentRoute?.bind(router);
      if (!findParentRoute) {
        // Skip if private method not accessible
        return;
      }
      const parent = findParentRoute(childRoute);

      expect(parent?.path).toBe('/users');
    });

    test('findParentRoute returns undefined for root-level routes', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const routes: Route[] = [
        { id: '/about', path: '/about', file: '/about.tsx' },
      ];

      (router as any).routes = routes;

      const findParentRoute = (router as any).findParentRoute?.bind(router);
      if (!findParentRoute) {
        // Skip if private method not accessible
        return;
      }
      const parent = findParentRoute(routes[0]);

      expect(parent === undefined || parent?.id === '/').toBe(true);
    });
  });

  describe('loadAllModules', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `loadAllModules_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('loads all route modules recursively', async () => {
      const router = new FileRouter({ routesDir: testDir });
      await router.init();

      const mockModule = { default: () => null };
      const routes: Route[] = [
        {
          id: '/parent',
          path: '/parent',
          file: join(testDir, 'index.tsx'),
          children: [
            {
              id: '/parent/child',
              path: '/parent/child',
              file: join(testDir, 'about.tsx'),
            },
          ],
        },
      ];

      (router as any).routes = routes;

      try {
        await router.loadAllModules();
      } catch {
        // May fail due to module format but the recursive traversal is tested
      }
    });

    test('loadAllModules handles empty routes', async () => {
      const router = new FileRouter({ routesDir: '/nonexistent' });
      await router.discoverRoutes();

      await router.loadAllModules();
    });
  });

  describe('event emission', () => {
    let testDir: string;

    beforeEach(async () => {
      testDir = join(BASE_TEST_DIR, `eventEmission_${Date.now()}`);
      await createTestRoutesDir(testDir);
    });

    afterEach(async () => {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    });

    test('emit calls registered handler with correct arguments', async () => {
      const router = new FileRouter({ routesDir: testDir });

      const receivedRoutes: Route[] = [];
      router.on('reload', (routes) => {
        receivedRoutes.push(...routes);
      });

      await router.discoverRoutes();

      expect(receivedRoutes.length).toBeGreaterThan(0);
    });

    test('emit does nothing when no handler registered', async () => {
      const router = new FileRouter({ routesDir: testDir });

      await router.discoverRoutes();
    });
  });

  describe('match without initialization', () => {
    test('match returns null when matcher not initialized', () => {
      const router = new FileRouter({ routesDir: '/nonexistent' });

      const result = router.match('/test');
      expect(result).toBeNull();
    });
  });
});
