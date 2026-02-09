/**
 * @ereo/router - File-based Route Discovery
 *
 * Discovers routes from the filesystem and builds a route tree.
 * Supports watching for changes in development mode.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import type { Route, RouteConfig } from '@ereo/core';
import type { FileRoute, RouterOptions, RouterEvents } from './types';
import { buildRouteTree, RouteTree } from './route-tree';
import { createMatcher, RouteMatcher } from './matcher';
import { parseRouteConfig, mergeRouteConfigs } from './route-config';

/** Normalize Windows backslashes to forward slashes for URL paths */
function toUrlPath(p: string): string {
  return p.split('\\').join('/');
}

/**
 * Default router options.
 */
const defaultOptions: Required<RouterOptions> = {
  routesDir: 'app/routes',
  basePath: '',
  extensions: ['.tsx', '.ts', '.jsx', '.js'],
  watch: false,
};

/**
 * File-based router.
 */
export class FileRouter {
  private options: Required<RouterOptions>;
  private routesDir: string;
  private routes: Route[] = [];
  private tree: RouteTree | null = null;
  private matcher: RouteMatcher | null = null;
  private watcher: ReturnType<typeof import('node:fs').watch> | null = null;
  private eventHandlers: Partial<RouterEvents> = {};
  /** Tracks file mtimes to detect changes in dev mode */
  private mtimeCache = new Map<string, number>();

  constructor(options: RouterOptions = {}) {
    this.options = { ...defaultOptions, ...options };
    // Handle both relative and absolute paths
    const routesDir = this.options.routesDir;
    this.routesDir = routesDir.startsWith('/')
      ? routesDir
      : join(process.cwd(), routesDir);
  }

  /**
   * Initialize the router by discovering routes.
   */
  async init(): Promise<void> {
    await this.discoverRoutes();

    if (this.options.watch) {
      this.startWatching();
    }
  }

  /**
   * Discover all routes from the filesystem.
   */
  async discoverRoutes(): Promise<Route[]> {
    const files = await this.scanDirectory(this.routesDir);

    this.tree = buildRouteTree(
      files.map((f) => ({
        relativePath: f.relativePath,
        absolutePath: f.absolutePath,
      })),
      ''
    );

    this.routes = this.tree.toRoutes();
    this.matcher = createMatcher(this.routes);

    this.emit('reload', this.routes);

    return this.routes;
  }

  /**
   * Scan a directory recursively for route files.
   */
  private async scanDirectory(dir: string, base: string = ''): Promise<FileRoute[]> {
    const files: FileRoute[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = toUrlPath(join(base, entry.name));

        if (entry.isDirectory()) {
          // Recurse into subdirectory
          const subFiles = await this.scanDirectory(fullPath, relativePath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = extname(entry.name);

          // Check if it's a valid route file
          if (this.options.extensions.includes(ext)) {
            files.push({
              relativePath: '/' + relativePath,
              absolutePath: fullPath,
              extension: ext,
            });
          }
        }
      }
    } catch (error) {
      // Directory might not exist yet
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return files;
  }

  /**
   * Start watching for file changes.
   */
  private startWatching(): void {
    // Use Node.js fs.watch which works in Bun
    this.watchWithNode();
  }

  /**
   * Watch using Node.js file system watcher (works in Bun too).
   */
  private watchWithNode(): void {
    const { watch } = require('node:fs');

    try {
      this.watcher = watch(
        this.routesDir,
        { recursive: true },
        (event: string, filename: string | null) => {
          if (!filename) return;

          const ext = extname(filename);
          if (!this.options.extensions.includes(ext)) return;

          this.handleFileChange(filename, event as 'rename' | 'change');
        }
      );
    } catch (error) {
      console.warn('File watching not available:', error);
    }
  }

  /**
   * Handle file change event.
   */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private handleFileChange(filename: string, event: 'rename' | 'change'): void {
    // Debounce to avoid multiple rapid updates
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const fullPath = join(this.routesDir, filename);

      try {
        const stats = await stat(fullPath);

        if (stats.isFile()) {
          if (event === 'rename') {
            // File added or renamed
            await this.discoverRoutes();
          } else {
            // File changed — invalidate module on both tree node and routes array
            const routeId = '/' + toUrlPath(filename).replace(/\.(tsx?|jsx?)$/, '');
            const node = this.tree?.findById(routeId);

            if (node) {
              delete node.module;
              // Also clear from the routes array so loadModule re-imports
              this.invalidateRouteModule(routeId);
              this.emit('change', this.nodeToRoute(node));
            }
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // File deleted
          const routeId = '/' + toUrlPath(filename).replace(/\.(tsx?|jsx?)$/, '');
          this.tree?.removeById(routeId);
          this.routes = this.tree?.toRoutes() || [];
          this.matcher = createMatcher(this.routes);
          this.emit('remove', routeId);
        }
      }
    }, 50);
  }

  /**
   * Clear cached module for a route by ID (searches nested children).
   */
  private invalidateRouteModule(routeId: string): void {
    const search = (routes: Route[]): void => {
      for (const route of routes) {
        if (route.id === routeId) {
          delete route.module;
          delete route.config;
          return;
        }
        if (route.children) search(route.children);
      }
    };
    search(this.routes);
  }

  /**
   * Convert route node to Route type.
   */
  private nodeToRoute(node: any): Route {
    return {
      id: node.id,
      path: node.path,
      file: node.file,
      index: node.index,
      layout: node.layout,
      module: node.module,
      children: node.children?.map((c: any) => this.nodeToRoute(c)),
    };
  }

  /**
   * Stop watching for changes.
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Get all discovered routes.
   */
  getRoutes(): Route[] {
    return this.routes;
  }

  /**
   * Get the route tree.
   */
  getTree(): RouteTree | null {
    return this.tree;
  }

  /**
   * Get the route matcher.
   */
  getMatcher(): RouteMatcher | null {
    return this.matcher;
  }

  /**
   * Match a URL pathname.
   */
  match(pathname: string) {
    return this.matcher?.match(pathname) ?? null;
  }

  /**
   * Register an event handler.
   */
  on<K extends keyof RouterEvents>(event: K, handler: RouterEvents[K]): void {
    this.eventHandlers[event] = handler;
  }

  /**
   * Emit an event.
   */
  private emit<K extends keyof RouterEvents>(
    event: K,
    ...args: Parameters<RouterEvents[K]>
  ): void {
    const handler = this.eventHandlers[event];
    if (handler) {
      (handler as (...args: any[]) => void)(...args);
    }
  }

  /**
   * Load a route module and parse its configuration.
   * In dev mode (watch: true), checks file mtime to detect changes
   * and re-imports when the file has been modified on disk.
   */
  async loadModule(route: Route): Promise<void> {
    if (this.options.watch) {
      // Dev mode: validate freshness via file mtime
      try {
        const fileStat = await stat(route.file);
        const mtime = fileStat.mtimeMs;
        const cachedMtime = this.mtimeCache.get(route.file);

        if (route.module && cachedMtime === mtime) {
          return; // File unchanged since last import
        }

        // File changed or first load — re-import with mtime-based cache key
        const mod = await import(`${route.file}?v=${mtime}`);
        route.module = mod;
        this.mtimeCache.set(route.file, mtime);

        // Re-parse config from fresh module
        route.config = undefined;
        if (mod.config) {
          route.config = parseRouteConfig(mod.config);
        }
        const parent = this.findParentRoute(route);
        if (parent?.config) {
          route.config = mergeRouteConfigs(parent.config, route.config);
        }
      } catch (error) {
        console.error(`Failed to load route module: ${route.file}`, error);
        throw error;
      }
      return;
    }

    // Production: simple cache — load once
    if (route.module) return;

    try {
      const mod = await import(route.file);
      route.module = mod;

      if (mod.config) {
        route.config = parseRouteConfig(mod.config);
      }

      const parent = this.findParentRoute(route);
      if (parent?.config) {
        route.config = mergeRouteConfigs(parent.config, route.config);
      }
    } catch (error) {
      console.error(`Failed to load route module: ${route.file}`, error);
      throw error;
    }
  }

  /**
   * Load middleware for a route path.
   * Returns an array of middleware functions from root to the route's segment.
   */
  async loadMiddlewareForRoute(routeId: string): Promise<Array<{ file: string; middleware: Function }>> {
    if (!this.tree) return [];

    const middlewareChain = this.tree.getMiddlewareChain(routeId);
    const result: Array<{ file: string; middleware: Function }> = [];

    for (const mw of middlewareChain) {
      if (!mw.module) {
        try {
          const mod = await import(mw.file);
          mw.module = mod;
        } catch (error) {
          console.error(`Failed to load middleware: ${mw.file}`, error);
          continue;
        }
      }

      if (mw.module?.middleware) {
        result.push({
          file: mw.file,
          middleware: mw.module.middleware,
        });
      }
    }

    return result;
  }

  /**
   * Get middleware chain for a matched route.
   */
  getMiddlewareChain(routeId: string): Array<{ file: string; module?: any }> {
    if (!this.tree) return [];
    return this.tree.getMiddlewareChain(routeId);
  }

  /**
   * Find parent route for a given route.
   */
  private findParentRoute(route: Route): Route | undefined {
    // Walk up the path hierarchy until we find an existing parent route
    const segments = route.id.split('/');
    for (let i = segments.length - 1; i >= 1; i--) {
      const parentId = segments.slice(0, i).join('/') || '/';
      const parent = this.routes.find((r) => r.id === parentId);
      if (parent) return parent;
    }
    return undefined;
  }

  /**
   * Get route configuration (loads module if needed).
   */
  async getRouteConfig(route: Route): Promise<RouteConfig | undefined> {
    if (!route.config && !route.module) {
      await this.loadModule(route);
    }
    return route.config;
  }

  /**
   * Get all routes with their configurations loaded.
   * Only loads modules for routes that don't already have configs.
   */
  async getRoutesWithConfig(): Promise<Route[]> {
    // Only load modules for routes without configs
    const loadPromises = this.routes.map(async (route) => {
      if (!route.config && !route.module) {
        await this.loadModule(route);
      }
    });
    await Promise.all(loadPromises);
    return this.routes;
  }

  /**
   * Find routes by render mode.
   */
  async findRoutesByRenderMode(mode: 'ssg' | 'ssr' | 'csr' | 'json' | 'xml'): Promise<Route[]> {
    const routes = await this.getRoutesWithConfig();
    return routes.filter((r) => r.config?.render?.mode === mode);
  }

  /**
   * Find routes that require authentication.
   */
  async findProtectedRoutes(): Promise<Route[]> {
    const routes = await this.getRoutesWithConfig();
    return routes.filter((r) => r.config?.auth?.required);
  }

  /**
   * Get all prerender paths from routes with SSG config.
   */
  async getPrerenderPaths(): Promise<string[]> {
    const routes = await this.findRoutesByRenderMode('ssg');
    const paths: string[] = [];

    for (const route of routes) {
      const prerender = route.config?.render?.prerender;
      if (prerender?.enabled && prerender.paths) {
        if (Array.isArray(prerender.paths)) {
          paths.push(...prerender.paths);
        } else if (typeof prerender.paths === 'function') {
          const result = await prerender.paths();
          paths.push(...(Array.isArray(result) ? result : []));
        }
      }
    }

    return paths;
  }

  /**
   * Load all route modules.
   */
  async loadAllModules(): Promise<void> {
    const loadRecursive = async (routes: Route[]): Promise<void> => {
      for (const route of routes) {
        await this.loadModule(route);
        if (route.children) {
          await loadRecursive(route.children);
        }
      }
    };

    await loadRecursive(this.routes);
  }
}

/**
 * Create a file-based router.
 */
export function createFileRouter(options?: RouterOptions): FileRouter {
  return new FileRouter(options);
}

/**
 * Initialize a file router and discover routes.
 */
export async function initFileRouter(options?: RouterOptions): Promise<FileRouter> {
  const router = createFileRouter(options);
  await router.init();
  return router;
}
