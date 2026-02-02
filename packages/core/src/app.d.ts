/**
 * @areo/core - Application Container
 *
 * The main application class that ties together routing, plugins,
 * and request handling.
 */
import type { Application, ApplicationOptions, FrameworkConfig, Plugin, Route, RouteMatch, MiddlewareHandler } from './types';
import { PluginRegistry } from './plugin';
/**
 * Create a new Areo application.
 */
export declare function createApp(options?: ApplicationOptions): AreoApp;
/**
 * Define framework configuration with type safety.
 */
export declare function defineConfig(config: FrameworkConfig): FrameworkConfig;
/**
 * The main Areo application class.
 */
export declare class AreoApp implements Application {
    readonly config: FrameworkConfig;
    routes: Route[];
    plugins: Plugin[];
    private pluginRegistry;
    private middlewares;
    private routeMatcher;
    constructor(options?: ApplicationOptions);
    /**
     * Deep merge configuration objects.
     */
    private mergeConfig;
    /**
     * Register a plugin.
     */
    use(plugin: Plugin): this;
    /**
     * Register middleware.
     */
    middleware(handler: MiddlewareHandler): this;
    /**
     * Set the route matcher function.
     * This is typically provided by @areo/router.
     */
    setRouteMatcher(matcher: (pathname: string) => RouteMatch | null): void;
    /**
     * Set routes directly.
     */
    setRoutes(routes: Route[]): void;
    /**
     * Initialize all plugins.
     */
    private initializePlugins;
    /**
     * Handle an incoming request.
     */
    handle(request: Request): Promise<Response>;
    /**
     * Run middleware chain.
     */
    private runMiddleware;
    /**
     * Handle a route request.
     */
    private handleRoute;
    /**
     * Handle errors.
     */
    private handleError;
    /**
     * Start development server.
     * This is typically called by @areo/cli.
     */
    dev(): Promise<void>;
    /**
     * Build for production.
     */
    build(): Promise<void>;
    /**
     * Start production server.
     */
    start(): Promise<void>;
    /**
     * Get the plugin registry for advanced usage.
     */
    getPluginRegistry(): PluginRegistry;
}
/**
 * Type guard to check if a value is an AreoApp.
 */
export declare function isAreoApp(value: unknown): value is AreoApp;
//# sourceMappingURL=app.d.ts.map