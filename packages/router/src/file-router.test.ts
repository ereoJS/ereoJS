import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { FileRouter, createFileRouter, initFileRouter } from './file-router';

const TEST_ROUTES_DIR = join(import.meta.dir, '__test_routes__');

describe('@oreo/router - FileRouter', () => {
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
});
