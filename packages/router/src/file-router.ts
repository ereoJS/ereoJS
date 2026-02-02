/**
 * @oreo/router - File-based Route Discovery
 *
 * Discovers routes from the filesystem and builds a route tree.
 * Supports watching for changes in development mode.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import type { Route } from '@oreo/core';
import type { FileRoute, RouterOptions, RouterEvents } from './types';
import { buildRouteTree, RouteTree } from './route-tree';
import { createMatcher, RouteMatcher } from './matcher';

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
        const relativePath = join(base, entry.name);

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
            // File changed
            const routeId = '/' + filename.replace(/\.(tsx?|jsx?)$/, '');
            const node = this.tree?.findById(routeId);

            if (node) {
              // Invalidate module cache if needed
              delete node.module;
              this.emit('change', this.nodeToRoute(node));
            }
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // File deleted
          const routeId = '/' + filename.replace(/\.(tsx?|jsx?)$/, '');
          this.tree?.removeById(routeId);
          this.routes = this.tree?.toRoutes() || [];
          this.matcher = createMatcher(this.routes);
          this.emit('remove', routeId);
        }
      }
    }, 50);
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
   * Load a route module.
   */
  async loadModule(route: Route): Promise<void> {
    if (route.module) return;

    try {
      route.module = await import(route.file);
    } catch (error) {
      console.error(`Failed to load route module: ${route.file}`, error);
      throw error;
    }
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
