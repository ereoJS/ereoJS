/**
 * @areo/router - File-based Route Discovery
 *
 * Discovers routes from the filesystem and builds a route tree.
 * Supports watching for changes in development mode.
 */
import type { Route, RouteConfig } from '@areo/core';
import type { RouterOptions, RouterEvents } from './types';
import { RouteTree } from './route-tree';
import { RouteMatcher } from './matcher';
/**
 * File-based router.
 */
export declare class FileRouter {
    private options;
    private routesDir;
    private routes;
    private tree;
    private matcher;
    private watcher;
    private eventHandlers;
    constructor(options?: RouterOptions);
    /**
     * Initialize the router by discovering routes.
     */
    init(): Promise<void>;
    /**
     * Discover all routes from the filesystem.
     */
    discoverRoutes(): Promise<Route[]>;
    /**
     * Scan a directory recursively for route files.
     */
    private scanDirectory;
    /**
     * Start watching for file changes.
     */
    private startWatching;
    /**
     * Watch using Node.js file system watcher (works in Bun too).
     */
    private watchWithNode;
    /**
     * Handle file change event.
     */
    private debounceTimer;
    private handleFileChange;
    /**
     * Convert route node to Route type.
     */
    private nodeToRoute;
    /**
     * Stop watching for changes.
     */
    stopWatching(): void;
    /**
     * Get all discovered routes.
     */
    getRoutes(): Route[];
    /**
     * Get the route tree.
     */
    getTree(): RouteTree | null;
    /**
     * Get the route matcher.
     */
    getMatcher(): RouteMatcher | null;
    /**
     * Match a URL pathname.
     */
    match(pathname: string): import("@areo/core").RouteMatch | null;
    /**
     * Register an event handler.
     */
    on<K extends keyof RouterEvents>(event: K, handler: RouterEvents[K]): void;
    /**
     * Emit an event.
     */
    private emit;
    /**
     * Load a route module and parse its configuration.
     */
    loadModule(route: Route): Promise<void>;
    /**
     * Find parent route for a given route.
     */
    private findParentRoute;
    /**
     * Get route configuration (loads module if needed).
     */
    getRouteConfig(route: Route): Promise<RouteConfig | undefined>;
    /**
     * Get all routes with their configurations loaded.
     * Only loads modules for routes that don't already have configs.
     */
    getRoutesWithConfig(): Promise<Route[]>;
    /**
     * Find routes by render mode.
     */
    findRoutesByRenderMode(mode: 'ssg' | 'ssr' | 'csr' | 'json' | 'xml'): Promise<Route[]>;
    /**
     * Find routes that require authentication.
     */
    findProtectedRoutes(): Promise<Route[]>;
    /**
     * Get all prerender paths from routes with SSG config.
     */
    getPrerenderPaths(): Promise<string[]>;
    /**
     * Load all route modules.
     */
    loadAllModules(): Promise<void>;
}
/**
 * Create a file-based router.
 */
export declare function createFileRouter(options?: RouterOptions): FileRouter;
/**
 * Initialize a file router and discover routes.
 */
export declare function initFileRouter(options?: RouterOptions): Promise<FileRouter>;
//# sourceMappingURL=file-router.d.ts.map