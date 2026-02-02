/**
 * @areo/core - Application Container
 *
 * The main application class that ties together routing, plugins,
 * and request handling.
 */

import type {
  Application,
  ApplicationOptions,
  FrameworkConfig,
  Plugin,
  Route,
  RouteMatch,
  MiddlewareHandler,
} from './types';
import { createContext, RequestContext } from './context';
import { PluginRegistry } from './plugin';

/**
 * Default configuration values.
 */
const defaultConfig: FrameworkConfig = {
  server: {
    port: 3000,
    hostname: 'localhost',
    development: process.env.NODE_ENV !== 'production',
  },
  build: {
    target: 'bun',
    outDir: '.areo',
    minify: true,
    sourcemap: true,
  },
  plugins: [],
  basePath: '',
  routesDir: 'app/routes',
};

/**
 * Create a new Areo application.
 */
export function createApp(options: ApplicationOptions = {}): AreoApp {
  return new AreoApp(options);
}

/**
 * Define framework configuration with type safety.
 */
export function defineConfig(config: FrameworkConfig): FrameworkConfig {
  return config;
}

/**
 * The main Areo application class.
 */
export class AreoApp implements Application {
  readonly config: FrameworkConfig;
  routes: Route[] = [];
  plugins: Plugin[] = [];

  private pluginRegistry: PluginRegistry;
  private middlewares: MiddlewareHandler[] = [];
  private routeMatcher: ((pathname: string) => RouteMatch | null) | null = null;

  constructor(options: ApplicationOptions = {}) {
    // Merge config with defaults
    this.config = this.mergeConfig(defaultConfig, options.config || {});

    // Initialize plugin registry
    const mode = this.config.server?.development ? 'development' : 'production';
    this.pluginRegistry = new PluginRegistry(this.config, mode, process.cwd());

    // Set initial routes
    if (options.routes) {
      this.routes = options.routes;
    }
  }

  /**
   * Deep merge configuration objects.
   */
  private mergeConfig(
    defaults: FrameworkConfig,
    overrides: Partial<FrameworkConfig>
  ): FrameworkConfig {
    return {
      server: { ...defaults.server, ...overrides.server },
      build: { ...defaults.build, ...overrides.build },
      plugins: [...(defaults.plugins || []), ...(overrides.plugins || [])],
      basePath: overrides.basePath ?? defaults.basePath,
      routesDir: overrides.routesDir ?? defaults.routesDir,
    };
  }

  /**
   * Register a plugin.
   */
  use(plugin: Plugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Register middleware.
   */
  middleware(handler: MiddlewareHandler): this {
    this.middlewares.push(handler);
    return this;
  }

  /**
   * Set the route matcher function.
   * This is typically provided by @areo/router.
   */
  setRouteMatcher(matcher: (pathname: string) => RouteMatch | null): void {
    this.routeMatcher = matcher;
  }

  /**
   * Set routes directly.
   */
  setRoutes(routes: Route[]): void {
    this.routes = routes;
  }

  /**
   * Initialize all plugins.
   */
  private async initializePlugins(): Promise<void> {
    // Register config plugins
    if (this.config.plugins) {
      await this.pluginRegistry.registerAll(this.config.plugins);
    }

    // Register manually added plugins
    await this.pluginRegistry.registerAll(this.plugins);
  }

  /**
   * Handle an incoming request.
   */
  async handle(request: Request): Promise<Response> {
    const context = createContext(request);

    try {
      // Run through middleware chain
      const response = await this.runMiddleware(request, context, async () => {
        return this.handleRoute(request, context);
      });

      // Apply context headers and cache control
      return context.applyToResponse(response);
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  /**
   * Run middleware chain.
   */
  private async runMiddleware(
    request: Request,
    context: RequestContext,
    final: () => Promise<Response>
  ): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware(request, context, next);
      }
      return final();
    };

    return next();
  }

  /**
   * Handle a route request.
   */
  private async handleRoute(
    request: Request,
    context: RequestContext
  ): Promise<Response> {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Remove base path if configured
    if (this.config.basePath && pathname.startsWith(this.config.basePath)) {
      pathname = pathname.slice(this.config.basePath.length) || '/';
    }

    // Match route
    if (!this.routeMatcher) {
      return new Response('Router not configured', { status: 500 });
    }

    const match = this.routeMatcher(pathname);
    if (!match) {
      return new Response('Not Found', { status: 404 });
    }

    // Load route module if not already loaded
    if (!match.route.module) {
      return new Response('Route module not loaded', { status: 500 });
    }

    const module = match.route.module;

    // Handle actions (POST, PUT, DELETE, PATCH)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (module.action) {
        const actionData = await module.action({
          request,
          params: match.params,
          context,
        });

        // If action returns a Response, return it directly
        if (actionData instanceof Response) {
          return actionData;
        }

        // Otherwise, serialize as JSON
        return new Response(JSON.stringify(actionData), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Handle loaders (GET)
    let loaderData: unknown = null;
    if (module.loader) {
      loaderData = await module.loader({
        request,
        params: match.params,
        context,
      });

      // If loader returns a Response, return it directly
      if (loaderData instanceof Response) {
        return loaderData;
      }
    }

    // If this is a data request (e.g., client-side navigation)
    if (request.headers.get('Accept')?.includes('application/json')) {
      return new Response(JSON.stringify(loaderData), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For full page requests, we need the renderer
    // This will be handled by @areo/server with React rendering
    return new Response(JSON.stringify({ loaderData, params: match.params }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle errors.
   */
  private handleError(error: unknown, context: RequestContext): Response {
    const isDev = this.config.server?.development;
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const stack = error instanceof Error ? error.stack : undefined;

    console.error('Request error:', error);

    if (isDev) {
      return new Response(
        JSON.stringify({
          error: message,
          stack: stack?.split('\n'),
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response('Internal Server Error', { status: 500 });
  }

  /**
   * Start development server.
   * This is typically called by @areo/cli.
   */
  async dev(): Promise<void> {
    await this.initializePlugins();

    console.log(`Starting dev server on http://${this.config.server?.hostname}:${this.config.server?.port}`);

    // The actual server is started by @areo/server
    // This is a placeholder that signals dev mode is ready
  }

  /**
   * Build for production.
   */
  async build(): Promise<void> {
    await this.initializePlugins();
    await this.pluginRegistry.buildStart();

    console.log('Building for production...');
    console.log(`Target: ${this.config.build?.target}`);
    console.log(`Output: ${this.config.build?.outDir}`);

    // The actual build is handled by @areo/bundler
    // This is called by @areo/cli

    await this.pluginRegistry.buildEnd();
  }

  /**
   * Start production server.
   */
  async start(): Promise<void> {
    await this.initializePlugins();

    console.log(`Starting production server on http://${this.config.server?.hostname}:${this.config.server?.port}`);

    // The actual server is started by @areo/server
    // This is a placeholder that signals production mode is ready
  }

  /**
   * Get the plugin registry for advanced usage.
   */
  getPluginRegistry(): PluginRegistry {
    return this.pluginRegistry;
  }
}

/**
 * Type guard to check if a value is an AreoApp.
 */
export function isAreoApp(value: unknown): value is AreoApp {
  return value instanceof AreoApp;
}
