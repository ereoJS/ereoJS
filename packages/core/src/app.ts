/**
 * @ereo/core - Application Container
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
import { NotFoundError } from './types';
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
    outDir: '.ereo',
    minify: true,
    sourcemap: true,
  },
  plugins: [],
  basePath: '',
  routesDir: 'app/routes',
};

/**
 * Create a new EreoJS application.
 */
export function createApp(options: ApplicationOptions = {}): EreoApp {
  return new EreoApp(options);
}

/**
 * Define framework configuration with type safety.
 */
export function defineConfig(config: FrameworkConfig): FrameworkConfig {
  return config;
}

/**
 * The main EreoJS application class.
 */
export class EreoApp implements Application {
  readonly config: FrameworkConfig;
  routes: Route[] = [];
  plugins: Plugin[] = [];

  private pluginRegistry: PluginRegistry;
  private middlewares: MiddlewareHandler[] = [];
  private routeMatcher: ((pathname: string) => RouteMatch | null) | null = null;

  private static readonly METHOD_OVERRIDE_HEADER = '_method';
  private static readonly METHOD_OVERRIDE_ALLOWED = new Set(['PUT', 'PATCH', 'DELETE']);

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
   * This is typically provided by @ereo/router.
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
      // Apply context headers (e.g., CORS) to error responses too
      const errorResponse = this.handleError(error, context);
      return context.applyToResponse(errorResponse);
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
        const currentIndex = index++;
        const middleware = this.middlewares[currentIndex];
        let called = false;
        return middleware(request, context, async () => {
          if (called) {
            throw new Error('next() called multiple times in middleware');
          }
          called = true;
          return next();
        });
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

    const effectiveMethod = await this.getEffectiveMethod(request);

    // Remove base path if configured
    const normalizedBasePath = this.normalizeBasePath(this.config.basePath);
    if (
      normalizedBasePath &&
      (pathname === normalizedBasePath || pathname.startsWith(normalizedBasePath + '/'))
    ) {
      pathname = pathname.slice(normalizedBasePath.length) || '/';
      if (!pathname.startsWith('/')) {
        pathname = '/' + pathname;
      }
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
    if (effectiveMethod !== 'GET' && effectiveMethod !== 'HEAD') {
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
        return this.jsonResponse(actionData);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Handle loaders (GET)
    let loaderData: unknown = null;
    if (module.loader) {
      const result = await module.loader({
        request,
        params: match.params,
        context,
      });

      // If loader returns a Response, return it directly
      if (result instanceof Response) {
        return result;
      }

      // Normalize undefined to null for safe JSON serialization
      loaderData = result === undefined ? null : result;
    }

    // If this is a data request (e.g., client-side navigation)
    if (request.headers.get('Accept')?.includes('application/json')) {
      return this.jsonResponse(loaderData);
    }

    // For full page requests, we need the renderer
    // This will be handled by @ereo/server with React rendering
    return this.jsonResponse({ loaderData, params: match.params });
  }

  private normalizeBasePath(basePath: string | undefined): string {
    if (!basePath || basePath === '/') {
      return '';
    }
    // Collapse consecutive slashes and remove trailing slashes
    return basePath.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  }

  private async getEffectiveMethod(request: Request): Promise<string> {
    const method = request.method.toUpperCase();

    if (method !== 'POST') {
      return method;
    }

    const contentType = request.headers.get('Content-Type') || '';
    const isFormSubmission =
      contentType.includes('application/x-www-form-urlencoded') ||
      contentType.includes('multipart/form-data');

    if (!isFormSubmission) {
      return method;
    }

    try {
      const formData = await request.clone().formData();
      const override = formData.get(EreoApp.METHOD_OVERRIDE_HEADER);
      if (typeof override !== 'string') {
        return method;
      }

      const normalized = override.toUpperCase();
      return EreoApp.METHOD_OVERRIDE_ALLOWED.has(normalized) ? normalized : method;
    } catch {
      return method;
    }
  }

  /**
   * Safely serialize data as a JSON response.
   */
  private jsonResponse(data: unknown, status = 200): Response {
    try {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to serialize response data' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  /**
   * Handle errors.
   */
  private handleError(error: unknown, context: RequestContext): Response {
    // Handle NotFoundError specially - return 404
    if (error instanceof NotFoundError) {
      return this.jsonResponse({ error: 'Not Found', data: error.data }, 404);
    }

    const isDev = this.config.server?.development;
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const stack = error instanceof Error ? error.stack : undefined;

    console.error('Request error:', error);

    if (isDev) {
      return this.jsonResponse(
        { error: message, stack: stack?.split('\n') },
        500
      );
    }

    return new Response('Internal Server Error', { status: 500 });
  }

  /**
   * Start development server.
   * This is typically called by @ereo/cli.
   */
  async dev(): Promise<void> {
    await this.initializePlugins();

    console.log(`Starting dev server on http://${this.config.server?.hostname}:${this.config.server?.port}`);

    // The actual server is started by @ereo/server
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

    // The actual build is handled by @ereo/bundler
    // This is called by @ereo/cli

    await this.pluginRegistry.buildEnd();
  }

  /**
   * Start production server.
   */
  async start(): Promise<void> {
    await this.initializePlugins();

    console.log(`Starting production server on http://${this.config.server?.hostname}:${this.config.server?.port}`);

    // The actual server is started by @ereo/server
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
 * Type guard to check if a value is an EreoApp.
 */
export function isEreoApp(value: unknown): value is EreoApp {
  return value instanceof EreoApp;
}
