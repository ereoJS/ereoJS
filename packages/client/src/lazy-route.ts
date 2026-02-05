/**
 * @ereo/client - Lazy Route Loading
 *
 * Route-level code splitting using dynamic import().
 * Routes are lazy-loaded on navigation, reducing initial bundle size.
 * Supports preloading for hover/intent-based prefetching.
 */

import type { RouteModule } from '@ereo/core';

// ============================================================================
// Types
// ============================================================================

/**
 * A route module loader — returns a dynamic import promise.
 */
export type RouteModuleLoader = () => Promise<RouteModule>;

/**
 * A lazy route definition for client-side code splitting.
 */
export interface LazyRouteDefinition {
  /** Route identifier */
  id: string;
  /** Route path pattern */
  path: string;
  /** Dynamic import function for the route module */
  loader: RouteModuleLoader;
  /** Whether this route module has been loaded */
  loaded: boolean;
  /** The cached module after loading */
  module?: RouteModule;
}

/**
 * Client-side route manifest entry (generated at build time).
 * Maps route IDs to their chunk URLs for preloading.
 */
export interface RouteManifestEntry {
  /** Route ID */
  id: string;
  /** JavaScript chunk URL */
  js: string;
  /** CSS files associated with this route */
  css?: string[];
  /** Other asset files to preload */
  assets?: string[];
  /** Module imports (for dependency preloading) */
  imports?: string[];
}

/**
 * Full route manifest mapping route IDs to chunks.
 */
export type RouteManifest = Record<string, RouteManifestEntry>;

// ============================================================================
// Lazy Route Registry
// ============================================================================

/** Registry of lazy route loaders */
const lazyRoutes = new Map<string, LazyRouteDefinition>();

/** Cache of loaded modules */
const moduleCache = new Map<string, RouteModule>();

/** In-flight loading promises (deduplication) */
const loadingPromises = new Map<string, Promise<RouteModule>>();

/**
 * Register a lazy route with a dynamic import loader.
 *
 * @param id - Route identifier
 * @param path - Route path pattern
 * @param loader - Dynamic import function
 *
 * @example
 * ```typescript
 * registerLazyRoute('home', '/', () => import('./routes/home'));
 * registerLazyRoute('users', '/users/[id]', () => import('./routes/users/[id]'));
 * ```
 */
export function registerLazyRoute(
  id: string,
  path: string,
  loader: RouteModuleLoader,
): void {
  lazyRoutes.set(id, {
    id,
    path,
    loader,
    loaded: false,
  });
}

/**
 * Register multiple lazy routes at once.
 *
 * @example
 * ```typescript
 * registerLazyRoutes({
 *   home: { path: '/', loader: () => import('./routes/home') },
 *   about: { path: '/about', loader: () => import('./routes/about') },
 * });
 * ```
 */
export function registerLazyRoutes(
  routes: Record<string, { path: string; loader: RouteModuleLoader }>,
): void {
  for (const [id, { path, loader }] of Object.entries(routes)) {
    registerLazyRoute(id, path, loader);
  }
}

/**
 * Load a lazy route module. Returns the cached module if already loaded.
 * Deduplicates concurrent loads of the same route.
 *
 * @param id - Route identifier
 * @returns The loaded route module
 * @throws Error if route is not registered
 */
export async function loadLazyRoute(id: string): Promise<RouteModule> {
  // Check cache first
  const cached = moduleCache.get(id);
  if (cached) return cached;

  // Check if already loading (dedup)
  const inflight = loadingPromises.get(id);
  if (inflight) return inflight;

  const route = lazyRoutes.get(id);
  if (!route) {
    throw new Error(
      `Lazy route "${id}" is not registered. ` +
        'Make sure to call registerLazyRoute() before loading.'
    );
  }

  // Start loading
  const promise = route.loader().then((module) => {
    moduleCache.set(id, module);
    route.loaded = true;
    route.module = module;
    loadingPromises.delete(id);
    return module;
  }).catch((error) => {
    loadingPromises.delete(id);
    throw error;
  });

  loadingPromises.set(id, promise);
  return promise;
}

/**
 * Preload a route module without executing it.
 * Useful for hover/intent-based prefetching.
 *
 * @param id - Route identifier
 * @returns Promise that resolves when the module is loaded
 */
export async function preloadLazyRoute(id: string): Promise<void> {
  if (moduleCache.has(id)) return;
  await loadLazyRoute(id);
}

/**
 * Check if a lazy route's module has been loaded.
 */
export function isRouteLoaded(id: string): boolean {
  return moduleCache.has(id);
}

/**
 * Get a loaded route module (returns undefined if not loaded).
 */
export function getLoadedModule(id: string): RouteModule | undefined {
  return moduleCache.get(id);
}

/**
 * Get all registered lazy route IDs.
 */
export function getLazyRouteIds(): string[] {
  return Array.from(lazyRoutes.keys());
}

/**
 * Clear the module cache and reset all lazy routes.
 * Useful for testing or hot module replacement.
 */
export function clearLazyRouteCache(): void {
  moduleCache.clear();
  loadingPromises.clear();
  for (const route of lazyRoutes.values()) {
    route.loaded = false;
    route.module = undefined;
  }
}

/**
 * Remove all registered lazy routes and clear caches.
 */
export function resetLazyRoutes(): void {
  lazyRoutes.clear();
  moduleCache.clear();
  loadingPromises.clear();
}

// ============================================================================
// Route Manifest Support
// ============================================================================

/** The current route manifest (set at initialization) */
let manifest: RouteManifest | null = null;

/**
 * Set the route manifest (typically loaded from the build output).
 *
 * @example
 * ```typescript
 * // In your entry point
 * import manifest from './__manifest.json';
 * setRouteManifest(manifest);
 * ```
 */
export function setRouteManifest(m: RouteManifest): void {
  manifest = m;
}

/**
 * Get the route manifest entry for a route ID.
 */
export function getRouteManifestEntry(id: string): RouteManifestEntry | undefined {
  return manifest?.[id];
}

/**
 * Preload route assets (JS chunks, CSS files) by injecting
 * <link rel="modulepreload"> and <link rel="preload"> into <head>.
 *
 * @param id - Route ID to preload assets for
 */
export function preloadRouteAssets(id: string): void {
  if (typeof document === 'undefined') return;
  if (!manifest) return;

  const entry = manifest[id];
  if (!entry) return;

  const head = document.head;
  const existing = new Set(
    Array.from(head.querySelectorAll('link[rel="modulepreload"], link[rel="preload"]'))
      .map((el) => el.getAttribute('href'))
  );

  // Preload the JS chunk
  if (!existing.has(entry.js)) {
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = entry.js;
    head.appendChild(link);
  }

  // Preload CSS files
  for (const css of entry.css || []) {
    if (!existing.has(css)) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = css;
      link.as = 'style';
      head.appendChild(link);
    }
  }

  // Preload imported modules
  for (const imp of entry.imports || []) {
    if (!existing.has(imp)) {
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = imp;
      head.appendChild(link);
    }
  }
}
