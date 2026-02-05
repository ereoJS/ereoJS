import { describe, expect, test, beforeEach } from 'bun:test';
import {
  registerLazyRoute,
  registerLazyRoutes,
  loadLazyRoute,
  preloadLazyRoute,
  isRouteLoaded,
  getLoadedModule,
  getLazyRouteIds,
  clearLazyRouteCache,
  resetLazyRoutes,
  setRouteManifest,
  getRouteManifestEntry,
  preloadRouteAssets,
  type RouteManifest,
  type LazyRouteDefinition,
  type RouteManifestEntry,
  type RouteModuleLoader,
} from './lazy-route';
import type { RouteModule } from '@ereo/core';

beforeEach(() => {
  resetLazyRoutes();
});

// =================================================================
// registerLazyRoute tests
// =================================================================

describe('@ereo/client - registerLazyRoute', () => {
  test('registers a lazy route', () => {
    registerLazyRoute('home', '/', async () => ({ default: () => null }));
    expect(getLazyRouteIds()).toContain('home');
  });

  test('registers multiple routes', () => {
    registerLazyRoute('home', '/', async () => ({}));
    registerLazyRoute('about', '/about', async () => ({}));
    registerLazyRoute('users', '/users', async () => ({}));
    expect(getLazyRouteIds()).toHaveLength(3);
  });

  test('overwrites existing route with same ID', () => {
    registerLazyRoute('home', '/', async () => ({ loader: async () => 'v1' }));
    registerLazyRoute('home', '/', async () => ({ loader: async () => 'v2' }));
    expect(getLazyRouteIds()).toHaveLength(1);
  });
});

// =================================================================
// registerLazyRoutes tests
// =================================================================

describe('@ereo/client - registerLazyRoutes', () => {
  test('registers multiple routes at once', () => {
    registerLazyRoutes({
      home: { path: '/', loader: async () => ({}) },
      about: { path: '/about', loader: async () => ({}) },
      contact: { path: '/contact', loader: async () => ({}) },
    });

    expect(getLazyRouteIds()).toHaveLength(3);
    expect(getLazyRouteIds()).toContain('home');
    expect(getLazyRouteIds()).toContain('about');
    expect(getLazyRouteIds()).toContain('contact');
  });
});

// =================================================================
// loadLazyRoute tests
// =================================================================

describe('@ereo/client - loadLazyRoute', () => {
  test('loads a registered route module', async () => {
    const mockModule: RouteModule = {
      loader: async () => ({ message: 'Hello' }),
    };

    registerLazyRoute('test', '/test', async () => mockModule);

    const result = await loadLazyRoute('test');
    expect(result).toBe(mockModule);
    expect(result.loader).toBeDefined();
  });

  test('caches loaded modules', async () => {
    let loadCount = 0;
    const mockModule: RouteModule = {};

    registerLazyRoute('cached', '/cached', async () => {
      loadCount++;
      return mockModule;
    });

    await loadLazyRoute('cached');
    await loadLazyRoute('cached');
    await loadLazyRoute('cached');

    expect(loadCount).toBe(1); // Only loaded once
  });

  test('deduplicates concurrent loads', async () => {
    let loadCount = 0;

    registerLazyRoute('dedup', '/dedup', async () => {
      loadCount++;
      // Simulate async delay
      await new Promise((r) => setTimeout(r, 10));
      return {};
    });

    // Fire 3 concurrent loads
    const [r1, r2, r3] = await Promise.all([
      loadLazyRoute('dedup'),
      loadLazyRoute('dedup'),
      loadLazyRoute('dedup'),
    ]);

    expect(loadCount).toBe(1);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });

  test('throws for unregistered route', async () => {
    expect(loadLazyRoute('nonexistent')).rejects.toThrow('not registered');
  });

  test('propagates loader errors', async () => {
    registerLazyRoute('broken', '/broken', async () => {
      throw new Error('Failed to load chunk');
    });

    expect(loadLazyRoute('broken')).rejects.toThrow('Failed to load chunk');
  });

  test('allows retry after error', async () => {
    let attempt = 0;

    registerLazyRoute('retry', '/retry', async () => {
      attempt++;
      if (attempt === 1) throw new Error('Network error');
      return { loader: async () => ({ ok: true }) };
    });

    // First attempt fails
    try {
      await loadLazyRoute('retry');
    } catch {
      // expected
    }

    // Second attempt succeeds
    const module = await loadLazyRoute('retry');
    expect(module.loader).toBeDefined();
  });
});

// =================================================================
// preloadLazyRoute tests
// =================================================================

describe('@ereo/client - preloadLazyRoute', () => {
  test('preloads a route module', async () => {
    registerLazyRoute('preload-test', '/preload', async () => ({
      loader: async () => ({ data: 'preloaded' }),
    }));

    expect(isRouteLoaded('preload-test')).toBe(false);
    await preloadLazyRoute('preload-test');
    expect(isRouteLoaded('preload-test')).toBe(true);
  });

  test('is a no-op if already loaded', async () => {
    let loadCount = 0;

    registerLazyRoute('loaded', '/loaded', async () => {
      loadCount++;
      return {};
    });

    await preloadLazyRoute('loaded');
    await preloadLazyRoute('loaded');

    expect(loadCount).toBe(1);
  });
});

// =================================================================
// isRouteLoaded / getLoadedModule tests
// =================================================================

describe('@ereo/client - isRouteLoaded & getLoadedModule', () => {
  test('isRouteLoaded returns false before load', () => {
    registerLazyRoute('check', '/check', async () => ({}));
    expect(isRouteLoaded('check')).toBe(false);
  });

  test('isRouteLoaded returns true after load', async () => {
    registerLazyRoute('check2', '/check2', async () => ({}));
    await loadLazyRoute('check2');
    expect(isRouteLoaded('check2')).toBe(true);
  });

  test('getLoadedModule returns undefined before load', () => {
    registerLazyRoute('mod', '/mod', async () => ({}));
    expect(getLoadedModule('mod')).toBeUndefined();
  });

  test('getLoadedModule returns module after load', async () => {
    const module: RouteModule = { handle: { breadcrumb: 'Test' } };
    registerLazyRoute('mod2', '/mod2', async () => module);
    await loadLazyRoute('mod2');
    expect(getLoadedModule('mod2')).toBe(module);
  });
});

// =================================================================
// clearLazyRouteCache / resetLazyRoutes tests
// =================================================================

describe('@ereo/client - cache management', () => {
  test('clearLazyRouteCache clears loaded modules but keeps registrations', async () => {
    registerLazyRoute('clear-test', '/clear', async () => ({}));
    await loadLazyRoute('clear-test');
    expect(isRouteLoaded('clear-test')).toBe(true);

    clearLazyRouteCache();
    expect(isRouteLoaded('clear-test')).toBe(false);
    expect(getLazyRouteIds()).toContain('clear-test'); // Still registered
  });

  test('resetLazyRoutes clears everything', async () => {
    registerLazyRoute('reset-test', '/reset', async () => ({}));
    await loadLazyRoute('reset-test');

    resetLazyRoutes();
    expect(getLazyRouteIds()).toHaveLength(0);
    expect(isRouteLoaded('reset-test')).toBe(false);
  });
});

// =================================================================
// Route Manifest tests
// =================================================================

describe('@ereo/client - Route Manifest', () => {
  test('setRouteManifest stores manifest', () => {
    const manifest: RouteManifest = {
      home: { id: 'home', js: '/chunks/home-abc123.js', css: ['/chunks/home.css'] },
      about: { id: 'about', js: '/chunks/about-def456.js' },
    };

    setRouteManifest(manifest);

    expect(getRouteManifestEntry('home')).toBeDefined();
    expect(getRouteManifestEntry('home')!.js).toBe('/chunks/home-abc123.js');
    expect(getRouteManifestEntry('home')!.css).toEqual(['/chunks/home.css']);
    expect(getRouteManifestEntry('about')!.js).toBe('/chunks/about-def456.js');
  });

  test('getRouteManifestEntry returns undefined for unknown route', () => {
    setRouteManifest({});
    expect(getRouteManifestEntry('nonexistent')).toBeUndefined();
  });

  test('manifest entry supports all fields', () => {
    const entry: RouteManifestEntry = {
      id: 'dashboard',
      js: '/chunks/dashboard.js',
      css: ['/chunks/dashboard.css', '/chunks/charts.css'],
      assets: ['/images/logo.svg'],
      imports: ['/chunks/shared-utils.js', '/chunks/chart-lib.js'],
    };

    expect(entry.css).toHaveLength(2);
    expect(entry.assets).toHaveLength(1);
    expect(entry.imports).toHaveLength(2);
  });

  test('preloadRouteAssets is SSR-safe', () => {
    // No document in test env
    expect(() => preloadRouteAssets('home')).not.toThrow();
  });
});

// =================================================================
// Type contract tests
// =================================================================

describe('@ereo/client - lazy route type contracts', () => {
  test('RouteModuleLoader is a function returning Promise<RouteModule>', async () => {
    const loader: RouteModuleLoader = async () => ({
      loader: async () => ({ data: 'test' }),
      handle: { breadcrumb: 'Test' },
    });

    const module = await loader();
    expect(module.loader).toBeDefined();
    expect(module.handle?.breadcrumb).toBe('Test');
  });

  test('LazyRouteDefinition has all required fields', () => {
    const def: LazyRouteDefinition = {
      id: 'users',
      path: '/users',
      loader: async () => ({}),
      loaded: false,
    };

    expect(def.id).toBe('users');
    expect(def.path).toBe('/users');
    expect(def.loaded).toBe(false);
    expect(def.module).toBeUndefined();
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/client - lazy route exports from index', () => {
  test('all lazy route exports available', async () => {
    const exports = await import('./index');

    expect(exports.registerLazyRoute).toBeDefined();
    expect(exports.registerLazyRoutes).toBeDefined();
    expect(exports.loadLazyRoute).toBeDefined();
    expect(exports.preloadLazyRoute).toBeDefined();
    expect(exports.isRouteLoaded).toBeDefined();
    expect(exports.getLoadedModule).toBeDefined();
    expect(exports.getLazyRouteIds).toBeDefined();
    expect(exports.clearLazyRouteCache).toBeDefined();
    expect(exports.resetLazyRoutes).toBeDefined();
    expect(exports.setRouteManifest).toBeDefined();
    expect(exports.getRouteManifestEntry).toBeDefined();
    expect(exports.preloadRouteAssets).toBeDefined();
  });
});
