/**
 * @ereo/server - Bun HTTP Server
 *
 * High-performance HTTP server using Bun.serve().
 * Designed for 5-6x faster performance than Node.js.
 */

import type { Server } from 'bun';
import type { FrameworkConfig, RouteMatch, Route, RouteModule, MetaDescriptor, MiddlewareHandler, HeadersFunction, MethodHandlerFunction } from '@ereo/core';
import { createContext, RequestContext, EreoApp, NotFoundError } from '@ereo/core';
import { FileRouter, createFileRouter, matchWithLayouts, type MatchResult } from '@ereo/router';
import {
  MiddlewareChain,
  createMiddlewareChain,
  logger,
  cors,
  securityHeaders,
} from './middleware';
import { serveStatic, type StaticOptions } from './static';
import { createShell, createResponse, renderToString, type ShellTemplate } from './streaming';
import { serializeLoaderData, hasDeferredData, resolveAllDeferred } from '@ereo/data';
import { createElement, type ReactElement, type ComponentType, type ReactNode } from 'react';
import { OutletProvider, EreoProvider } from '@ereo/client';
import { enforceAuthConfig } from './auth-enforcement';

/**
 * Type for the streaming renderer result.
 */
type StreamingRenderer = {
  renderToReadableStream?: (
    element: ReactElement,
    options?: {
      bootstrapModules?: string[];
      bootstrapScripts?: string[];
      bootstrapScriptContent?: string;
      signal?: AbortSignal;
      onError?: (error: unknown) => void;
      progressiveChunkSize?: number;
    }
  ) => Promise<ReadableStream<Uint8Array> & { allReady: Promise<void> }>;
  renderToString: (element: ReactElement) => string;
};

/**
 * Helper to get renderToReadableStream from react-dom/server.
 * React 18 exports this from different paths depending on the environment:
 * - 'react-dom/server.browser' for Web Streams API (renderToReadableStream)
 * - 'react-dom/server' for Node.js (renderToPipeableStream)
 *
 * Bun supports Web Streams natively, so we prefer renderToReadableStream.
 */
async function getStreamingRenderer(): Promise<StreamingRenderer> {
  try {
    // Try to import from react-dom/server.browser first (Web Streams API)
    // This is the correct path for renderToReadableStream in React 18+
    // @ts-expect-error - react-dom/server.browser may not have types
    const browserServer = await import('react-dom/server.browser');
    if (typeof browserServer.renderToReadableStream === 'function') {
      return {
        renderToReadableStream: browserServer.renderToReadableStream,
        renderToString: browserServer.renderToString,
      };
    }
  } catch {
    // Browser build not available, try the main export
  }

  try {
    // Fallback to react-dom/server
    const server = await import('react-dom/server');
    return {
      renderToReadableStream: (server as any).renderToReadableStream,
      renderToString: server.renderToString,
    };
  } catch {
    // Last resort - return undefined for streaming, will fallback to string
    return {
      renderToReadableStream: undefined,
      renderToString: (await import('react-dom/server')).renderToString,
    };
  }
}

/**
 * Server render mode options.
 *
 * This type is distinct from the route-level RenderMode in @ereo/core.
 * - ServerRenderMode: How the server renders React components ('streaming' vs 'string')
 * - RenderMode (core): What type of rendering a route uses ('ssg', 'ssr', 'csr', etc.)
 */
export type ServerRenderMode = 'streaming' | 'string';

/**
 * Server options.
 */
export interface ServerOptions {
  /** Port to listen on */
  port?: number;
  /** Hostname to bind to */
  hostname?: string;
  /** Development mode */
  development?: boolean;
  /** Static file options */
  static?: StaticOptions;
  /** Enable logging */
  logging?: boolean;
  /** Enable CORS */
  cors?: boolean | Parameters<typeof cors>[0];
  /** Enable security headers */
  security?: boolean | Parameters<typeof securityHeaders>[0];
  /** Custom request handler */
  handler?: (request: Request) => Response | Promise<Response>;
  /** WebSocket handler */
  websocket?: Parameters<typeof Bun.serve>[0]['websocket'];
  /** TLS options */
  tls?: {
    cert: string;
    key: string;
  };
  /** Render mode: 'streaming' for React 18 streaming SSR, 'string' for traditional SSR */
  renderMode?: ServerRenderMode;
  /** Base path for client assets */
  assetsPath?: string;
  /** Client entry script path */
  clientEntry?: string;
  /** Default shell template */
  shell?: ShellTemplate;
  /** Enable request tracing (dev only). Pass a Tracer instance or true for auto-creation. */
  trace?: boolean | {
    tracer: unknown;
    middleware: MiddlewareHandler;
    viewerHandler?: (req: Request) => Response;
    tracesAPIHandler?: (req: Request) => Response;
    /** WebSocket handler for live trace streaming */
    traceWebSocket?: {
      websocket: {
        open: (ws: any) => void;
        close: (ws: any) => void;
        message: (ws: any, message: string | Buffer) => void;
      };
    };
    /** Auto-instrumentation functions from @ereo/trace */
    instrumentors?: {
      getActiveSpan: (ctx: any) => any;
      traceRouteMatch: <T>(span: any, fn: () => T) => T;
      traceLoader: <T>(span: any, key: string, fn: () => T | Promise<T>) => T | Promise<T>;
    };
  };
}

/**
 * Bun server instance.
 */
export class BunServer {
  private static readonly HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const;
  private static readonly METHOD_OVERRIDE_HEADER = '_method';
  private static readonly METHOD_OVERRIDE_ALLOWED = new Set(['PUT', 'PATCH', 'DELETE']);

  private server: Server<unknown> | null = null;
  private app: EreoApp | null = null;
  private router: FileRouter | null = null;
  private middleware: MiddlewareChain;
  private staticHandler: ((request: Request) => Promise<Response | null>) | null = null;
  private options: ServerOptions;
  private wsUpgradeHandlers: Array<{
    path: string;
    upgrader: (server: any, request: Request) => boolean;
    wsConfig: any;
  }> = [];

  constructor(options: ServerOptions = {}) {
    this.options = {
      port: 3000,
      hostname: 'localhost',
      development: process.env.NODE_ENV !== 'production',
      logging: true,
      renderMode: 'streaming',
      assetsPath: '/_ereo',
      clientEntry: '/_ereo/client.js',
      ...options,
    };

    this.middleware = createMiddlewareChain();
    this.setupMiddleware();

    if (options.static) {
      this.staticHandler = serveStatic(options.static);
    }
  }

  /**
   * Setup default middleware.
   */
  private setupMiddleware(): void {
    // Trace middleware (must be FIRST to wrap entire request lifecycle)
    if (this.options.trace && typeof this.options.trace === 'object' && this.options.trace.middleware) {
      this.middleware.use(this.options.trace.middleware);
    }

    // Logging
    if (this.options.logging) {
      this.middleware.use(logger());
    }

    // CORS
    if (this.options.cors) {
      const corsOptions = typeof this.options.cors === 'object' ? this.options.cors : {};
      this.middleware.use(cors(corsOptions));
    }

    // Security headers
    if (this.options.security !== false) {
      const securityOptions = typeof this.options.security === 'object' ? this.options.security : {};
      this.middleware.use(securityHeaders(securityOptions));
    }
  }

  /**
   * Set the EreoJS app instance.
   */
  setApp(app: EreoApp): void {
    this.app = app;
  }

  /**
   * Set the file router.
   */
  setRouter(router: FileRouter): void {
    this.router = router;
    if (this.app) {
      this.app.setRouteMatcher((pathname) => router.match(pathname));
    }
  }

  /**
   * Add middleware.
   */
  use(handler: MiddlewareHandler): void;
  use(path: string, handler: MiddlewareHandler): void;
  use(pathOrHandler: string | MiddlewareHandler, maybeHandler?: MiddlewareHandler): void {
    if (typeof pathOrHandler === 'function') {
      this.middleware.use(pathOrHandler);
    } else if (maybeHandler) {
      this.middleware.use(pathOrHandler, maybeHandler);
    }
  }

  /** Get auto-instrumentation helpers if tracing is enabled */
  private get traceInstrumentors() {
    if (this.options.trace && typeof this.options.trace === 'object' && this.options.trace.instrumentors) {
      return this.options.trace.instrumentors;
    }
    return null;
  }

  /** Generate a <script> tag to inject the trace ID into the page for client tracing */
  private getTraceIdScript(context: RequestContext): string {
    const inst = this.traceInstrumentors;
    if (!inst) return '';
    const span = inst.getActiveSpan(context);
    if (!span?.traceId) return '';
    // Sanitize traceId to prevent XSS — allow only hex and dash characters
    const safeTraceId = span.traceId.replace(/[^a-fA-F0-9\-]/g, '');
    return `<script>window.__EREO_TRACE_ID__="${safeTraceId}"</script>`;
  }

  /**
   * Register a WebSocket upgrade handler for a specific path.
   * Plugins can use this to add WebSocket support alongside HMR.
   */
  addWebSocketUpgrade(path: string, upgrader: (server: any, request: Request) => boolean, wsConfig: any): void {
    this.wsUpgradeHandlers.push({ path, upgrader, wsConfig });
  }

  /**
   * Handle incoming request.
   */
  private async handleRequest(request: Request, wsType?: string): Promise<Response> {
    const context = createContext(request);

    // Make the Bun server available to route handlers for WebSocket upgrades.
    // If wsType is provided, wrap the server to inject _wsType automatically.
    if (this.server) {
      if (wsType) {
        const actualServer = this.server;
        context.set('server', {
          upgrade(req: Request, opts?: { data?: Record<string, any> }) {
            const data = { ...opts?.data, _wsType: wsType };
            return actualServer.upgrade(req, { ...opts, data });
          },
        });
      } else {
        context.set('server', this.server);
      }
    }

    try {
      // Handle trace endpoints (dev only)
      if (this.options.trace && typeof this.options.trace === 'object') {
        const url = new URL(request.url);
        if (url.pathname === '/__ereo/traces' && this.options.trace.viewerHandler) {
          return this.options.trace.viewerHandler(request);
        }
        if (url.pathname === '/__devtools/api/traces' && this.options.trace.tracesAPIHandler) {
          return this.options.trace.tracesAPIHandler(request);
        }
      }

      // Check for static files first
      if (this.staticHandler) {
        const staticResponse = await this.staticHandler(request);
        if (staticResponse) {
          return staticResponse;
        }
      }

      // Run through middleware chain
      const response = await this.middleware.execute(request, context, async () => {
        // Custom handler takes precedence
        if (this.options.handler) {
          return this.options.handler(request);
        }

        // Use router for matching and BunServer for rendering
        // This ensures we get full HTML SSR instead of JSON from EreoApp
        if (this.router) {
          const pathname = new URL(request.url).pathname;

          // Check if router has getRoutes (FileRouter) or is a simple mock
          if (typeof this.router.getRoutes === 'function') {
            // Full FileRouter - use matchWithLayouts for layout support
            const routes = this.router.getRoutes();
            const inst = this.traceInstrumentors;
            const activeSpan = inst?.getActiveSpan(context);

            const matchResult = activeSpan
              ? inst!.traceRouteMatch(activeSpan, () => matchWithLayouts(pathname, routes))
              : matchWithLayouts(pathname, routes);

            if (!matchResult) {
              return new Response('Not Found', { status: 404 });
            }

            // Load the main route module
            await this.router.loadModule(matchResult.route);

            // Load all layout modules
            for (const layout of matchResult.layouts) {
              await this.router.loadModule(layout);
            }

            // Load and execute route-level middleware
            if (typeof this.router.loadMiddlewareForRoute === 'function') {
              const middlewareChain = await this.router.loadMiddlewareForRoute(matchResult.route.id);

              if (middlewareChain.length > 0) {
                // Execute middleware chain before handling route
                return this.executeRouteMiddleware(
                  request,
                  context,
                  middlewareChain,
                  () => this.handleRoute(request, matchResult, context)
                );
              }
            }

            // Use BunServer's handleRoute for full HTML rendering with layouts
            return this.handleRoute(request, matchResult, context);
          } else {
            // Simple router (e.g., mock in tests) - use basic match
            const match = this.router.match(pathname);
            if (!match) {
              return new Response('Not Found', { status: 404 });
            }

            // Load module if the router supports it
            if (typeof this.router.loadModule === 'function') {
              await this.router.loadModule(match.route);
            }

            // Preserve layouts if provided in match result, otherwise empty
            return this.handleRoute(request, { ...match, layouts: (match as any).layouts || [] }, context);
          }
        }

        // Fallback to app handler (returns JSON, no SSR)
        if (this.app) {
          return this.app.handle(request);
        }

        return new Response('Not Found', { status: 404 });
      });

      return context.applyToResponse(response);
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  /**
   * Execute route-level middleware chain.
   */
  private async executeRouteMiddleware(
    request: Request,
    context: RequestContext,
    middlewareChain: Array<{ file: string; middleware: Function }>,
    handler: () => Promise<Response>
  ): Promise<Response> {
    // Build the middleware chain from inside out
    let next = handler;

    // Process middleware in reverse order so they execute in correct order
    for (let i = middlewareChain.length - 1; i >= 0; i--) {
      const mw = middlewareChain[i];
      const currentNext = next;

      next = async () => {
        try {
          return await mw.middleware(request, context, currentNext);
        } catch (error) {
          console.error(`Middleware error (${mw.file}):`, error);
          throw error;
        }
      };
    }

    return next();
  }

  /**
   * Handle a matched route.
   */
  private async handleRoute(
    request: Request,
    match: MatchResult,
    context: RequestContext
  ): Promise<Response> {
    const module = match.route.module;
    if (!module) {
      return new Response('Route module not loaded', { status: 500 });
    }

    // Execute inline middleware if the route module exports any
    if (module.middleware && module.middleware.length > 0) {
      return this.executeInlineMiddleware(
        request,
        context,
        module.middleware,
        () => this.handleRouteInner(request, match, context)
      );
    }

    return this.handleRouteInner(request, match, context);
  }

  /**
   * Execute inline middleware exported from the route module.
   */
  private async executeInlineMiddleware(
    request: Request,
    context: RequestContext,
    middleware: MiddlewareHandler[],
    handler: () => Promise<Response>
  ): Promise<Response> {
    let index = 0;

    const next = async (): Promise<Response> => {
      if (index >= middleware.length) {
        return handler();
      }

      const mw = middleware[index++];
      return mw(request, context as any, next);
    };

    return next();
  }

  /**
   * Inner route handler (after middleware).
   */
  private async handleRouteInner(
    request: Request,
    match: MatchResult,
    context: RequestContext
  ): Promise<Response> {
    const module = match.route.module!;
    const httpMethod = await this.getEffectiveMethod(request);

    // --- Auth Config Enforcement ---
    const routeAuthConfig = match.route.config?.auth || module.config?.auth;
    if (routeAuthConfig) {
      const denied = await enforceAuthConfig(routeAuthConfig, request, context, match.params);
      if (denied) return denied;
    }

    // --- Method Handler Dispatch (API Routes) ---
    if (BunServer.HTTP_METHODS.includes(httpMethod as any)) {
      const methodHandler = (module as Record<string, unknown>)[httpMethod] as MethodHandlerFunction | undefined;
      if (typeof methodHandler === 'function') {
        const result = await methodHandler({ request, params: match.params, context });
        if (result instanceof Response) {
          const routeHeaders = this.buildRouteHeaders(match);
          return this.applyRouteHeaders(result, routeHeaders);
        }
        // If the handler returned undefined/null (e.g., after WebSocket upgrade), return empty response.
        // Bun ignores the response after a successful upgrade, so this is safe.
        if (result === undefined || result === null) {
          return new Response(null, { status: 200 });
        }
        const jsonResponse = new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
        const routeHeaders = this.buildRouteHeaders(match);
        return this.applyRouteHeaders(jsonResponse, routeHeaders);
      }
    }

    // --- beforeLoad Route Guards ---
    const layouts = match.layouts || [];
    for (const layout of layouts) {
      if (layout.module?.beforeLoad) {
        await layout.module.beforeLoad({ request, params: match.params, context });
      }
    }
    if (module.beforeLoad) {
      await module.beforeLoad({ request, params: match.params, context });
    }

    // Handle actions (POST, PUT, DELETE, PATCH)
    if (httpMethod !== 'GET' && httpMethod !== 'HEAD') {
      if (module.action) {
        const result = await module.action({
          request,
          params: match.params,
          context,
        });

        if (result instanceof Response) {
          // Apply route headers to action Response
          const actionHeaders = new Headers(result.headers);
          const routeHeaders = this.buildRouteHeaders(match, actionHeaders);
          return this.applyRouteHeaders(result, routeHeaders);
        }

        // Fetch/AJAX requests get JSON
        if (request.headers.get('Accept')?.includes('application/json')) {
          const actionResponse = new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          });
          const routeHeaders = this.buildRouteHeaders(match);
          return this.applyRouteHeaders(actionResponse, routeHeaders);
        }

        // Traditional form submission — re-render the page with actionData
        const loaderArgs = { request, params: match.params, context };
        const loaderPromises: Promise<unknown>[] = [];
        loaderPromises.push(
          module.loader ? Promise.resolve(module.loader(loaderArgs)) : Promise.resolve(undefined)
        );
        for (const layout of layouts) {
          loaderPromises.push(
            layout.module?.loader ? Promise.resolve(layout.module.loader(loaderArgs)) : Promise.resolve(undefined)
          );
        }
        const loaderResults = await Promise.all(loaderPromises);
        const loaderData = module.loader && loaderResults[0] === undefined
          ? null
          : loaderResults[0];
        if (loaderData instanceof Response) return loaderData;
        const layoutLoaderData = new Map<string, unknown>();
        for (let i = 0; i < layouts.length; i++) {
          let layoutData = loaderResults[i + 1];
          if (layouts[i].module?.loader && layoutData === undefined) {
            layoutData = null;
          }
          if (layoutData instanceof Response) return layoutData;
          if (layoutData !== undefined) layoutLoaderData.set(layouts[i].id, layoutData);
        }
        const routeHeaders = this.buildRouteHeaders(match);
        const htmlResponse = await this.renderPage(request, match, context, loaderData, layoutLoaderData, result);
        return this.applyRouteHeaders(htmlResponse, routeHeaders);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Run all loaders in parallel: route loader + layout loaders
    // (layouts already declared above for beforeLoad guards)
    const loaderArgs = { request, params: match.params, context };
    const inst = this.traceInstrumentors;
    const activeSpan = inst?.getActiveSpan(context);

    // Build array of loader promises: [route, ...layouts]
    const loaderPromises: Promise<unknown>[] = [];

    // Route loader (with optional tracing)
    if (module.loader) {
      const loaderFn = () => module.loader!(loaderArgs);
      loaderPromises.push(
        activeSpan
          ? Promise.resolve(inst!.traceLoader(activeSpan, match.route.id || 'route', loaderFn))
          : Promise.resolve(loaderFn())
      );
    } else {
      loaderPromises.push(Promise.resolve(undefined));
    }

    // Layout loaders (run in parallel with route loader)
    for (const layout of layouts) {
      if (layout.module?.loader) {
        const layoutLoaderFn = () => layout.module!.loader!(loaderArgs);
        loaderPromises.push(
          activeSpan
            ? Promise.resolve(inst!.traceLoader(activeSpan, `layout:${layout.id}`, layoutLoaderFn))
            : Promise.resolve(layoutLoaderFn())
        );
      } else {
        loaderPromises.push(Promise.resolve(undefined));
      }
    }

    let loaderResults: unknown[];
    try {
      loaderResults = await Promise.all(loaderPromises);
    } catch (thrownError) {
      // Handle thrown Responses from loaders (e.g., throw new Response('Not Found', { status: 404 }))
      if (thrownError instanceof Response) {
        // Redirects pass through
        if (thrownError.status >= 300 && thrownError.status < 400) {
          return thrownError;
        }
        // For 4xx/5xx errors, try to render the nearest error boundary
        const errorRoute = await this.findErrorBoundary(match);
        if (errorRoute) {
          return this.renderErrorBoundaryPage(request, match, context, thrownError, errorRoute);
        }
        return thrownError;
      }
      throw thrownError;
    }

    // First result is the route loader data
    const loaderData = module.loader && loaderResults[0] === undefined
      ? null
      : loaderResults[0];
    if (loaderData instanceof Response) {
      return loaderData;
    }

    // Build layout data map (keyed by layout route ID)
    const layoutLoaderData = new Map<string, unknown>();
    for (let i = 0; i < layouts.length; i++) {
      let layoutData = loaderResults[i + 1];
      if (layouts[i].module?.loader && layoutData === undefined) {
        layoutData = null;
      }
      if (layoutData instanceof Response) {
        return layoutData; // Layout loader returned a Response (e.g., redirect)
      }
      if (layoutData !== undefined) {
        layoutLoaderData.set(layouts[i].id, layoutData);
      }
    }

    // Build merged route headers from headers functions
    const routeHeaders = this.buildRouteHeaders(match);

    // JSON request (client-side navigation)
    if (request.headers.get('Accept')?.includes('application/json')) {
      // Resolve any deferred data before JSON serialization
      const resolvedLoaderData = loaderData === undefined
        ? null
        : (hasDeferredData(loaderData)
          ? await resolveAllDeferred(loaderData)
          : loaderData);

      const jsonPayload: Record<string, unknown> = {
        data: resolvedLoaderData,
        params: match.params,
      };

      // Include layout data if any layouts have loaders
      if (layoutLoaderData.size > 0) {
        const layoutDataObj: Record<string, unknown> = {};
        for (const [id, data] of layoutLoaderData) {
          layoutDataObj[id] = hasDeferredData(data) ? await resolveAllDeferred(data) : data;
        }
        jsonPayload.layoutData = layoutDataObj;
      }

      // Include link descriptors for client-side link management
      const module = match.route.module;
      const routeLinks = module?.links ? module.links() : [];
      const layoutLinksList = (match.layouts || []).flatMap(
        (layout: any) => layout.module?.links ? layout.module.links() : []
      );
      const allLinks = [...layoutLinksList, ...routeLinks];
      if (allLinks.length > 0) {
        jsonPayload.links = allLinks;
      }

      // Include route matches for useMatches (handle metadata, etc.)
      const matchesData = this.buildMatchesData(match, loaderData, layoutLoaderData);
      jsonPayload.matches = matchesData;

      const jsonResponse = new Response(JSON.stringify(jsonPayload), {
        headers: { 'Content-Type': 'application/json' },
      });
      return this.applyRouteHeaders(jsonResponse, routeHeaders);
    }

    // Full page render - render React component to HTML with layouts
    let htmlResponse: Response;
    if (activeSpan) {
      const renderSpan = activeSpan.child('render', 'custom');
      try {
        htmlResponse = await this.renderPage(request, match, context, loaderData, layoutLoaderData);
        renderSpan.end();
      } catch (err) {
        renderSpan.error(err);
        renderSpan.end();
        throw err;
      }
    } else {
      htmlResponse = await this.renderPage(request, match, context, loaderData, layoutLoaderData);
    }
    return this.applyRouteHeaders(htmlResponse, routeHeaders);
  }

  /**
   * Render a full HTML page with the route component and layouts.
   */
  private async renderPage(
    request: Request,
    match: MatchResult,
    context: RequestContext,
    loaderData: unknown,
    layoutLoaderData: Map<string, unknown> = new Map(),
    actionData?: unknown
  ): Promise<Response> {
    const traceScript = this.getTraceIdScript(context);
    const module = match.route.module;
    if (!module?.default) {
      // No component to render, return a minimal HTML page with just the data
      return this.renderMinimalPage(match, loaderData, traceScript);
    }

    const url = new URL(request.url);

    // Build meta descriptors from route's meta function
    const metaDescriptors = this.buildMeta(module, loaderData, match.params, url);

    // Collect link descriptors from route and layouts
    const routeLinks = module.links ? module.links() : [];
    const layoutLinks = (match.layouts || []).flatMap(
      (layout) => layout.module?.links ? layout.module.links() : []
    );
    const allLinks = [...layoutLinks, ...routeLinks];

    // Build the shell template (only used if no root layout provides html/head/body)
    const shell: ShellTemplate = {
      ...this.options.shell,
      title: this.extractTitle(metaDescriptors) || this.options.shell?.title,
      meta: this.extractMetaTags(metaDescriptors),
      links: allLinks.length > 0 ? allLinks : undefined,
    };

    // Create the page component element
    const PageComponent = module.default;
    let element: ReactElement = createElement(PageComponent, {
      loaderData,
      params: match.params,
      ...(actionData !== undefined ? { actionData } : {}),
    });

    // Wrap with EreoProvider so hooks (useActionData, useNavigation, etc.) work during SSR
    element = createElement(EreoProvider, {
      loaderData,
      actionData,
      params: match.params,
      location: { pathname: url.pathname, search: url.search, hash: '', state: null, key: 'ssr' },
      children: element,
    });

    // Compose with layouts from innermost to outermost
    // Each layout is wrapped with OutletProvider so <Outlet /> renders child content.
    // Layouts also receive `children` as a prop for backwards compatibility.
    const layouts = match.layouts || [];
    for (let i = layouts.length - 1; i >= 0; i--) {
      const layout = layouts[i];
      if (layout.module?.default) {
        const LayoutComponent = layout.module.default;
        const childElement = element;
        // Wrap in OutletProvider so <Outlet /> inside the layout renders childElement
        element = createElement(
          OutletProvider,
          { element: childElement } as any,
          createElement(LayoutComponent, {
            loaderData: layoutLoaderData.get(layout.id) ?? null,
            params: match.params,
            children: childElement,
          })
        );
      }
    }

    // Combine all loader data for hydration script
    // Include layout data so the client can access it
    const allLoaderData = layoutLoaderData.size > 0
      ? { __routeData: loaderData, __layoutData: Object.fromEntries(layoutLoaderData) }
      : loaderData;

    // Check if the outermost layout already provides the html structure
    // If so, we render directly without the shell wrapper
    const hasRootLayout = layouts.length > 0 && layouts[0].module?.default;

    if (hasRootLayout) {
      // Layout provides the full HTML document structure.
      // Pass meta descriptors so they can be injected into the layout's <head>.
      if (this.options.renderMode === 'streaming') {
        return this.renderStreamingPageDirect(element, allLoaderData, metaDescriptors, traceScript);
      } else {
        return this.renderStringPageDirect(element, allLoaderData, metaDescriptors, traceScript);
      }
    }

    // No layout - use shell template wrapper
    if (this.options.renderMode === 'streaming') {
      return this.renderStreamingPage(element, shell, allLoaderData, traceScript);
    } else {
      return this.renderStringPage(element, shell, allLoaderData, traceScript);
    }
  }

  /**
   * Render page using React 18 streaming SSR.
   * Uses renderToReadableStream for Bun environments with native Web Streams API.
   *
   * Bytes flow progressively: shell head → React chunks as they render → tail.
   * The browser can parse the head (CSS, meta) and start rendering immediately
   * while React continues resolving Suspense boundaries on the server.
   */
  private async renderStreamingPage(
    element: ReactElement,
    shell: ShellTemplate,
    loaderData: unknown,
    traceScript: string = ''
  ): Promise<Response> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const { renderToReadableStream } = await getStreamingRenderer();

      // If renderToReadableStream is not available, fallback to string rendering
      if (!renderToReadableStream) {
        return this.renderStringPage(element, shell, loaderData, traceScript);
      }

      const hasDeferred = hasDeferredData(loaderData);
      const clientEntry = this.options.clientEntry!;

      // Don't pass scripts to createShell — React's bootstrapModules injects
      // the client entry <script> at the end of its own stream.
      const { head, tail } = createShell({
        shell,
        scripts: [],
        loaderData: hasDeferred ? null : loaderData,
      });

      const encoder = new TextEncoder();
      const headBytes = encoder.encode(head);
      const tailBytes = hasDeferred ? null : encoder.encode(tail);

      // Abort streaming after 10s to prevent hanging on unresolved Suspense.
      const abortController = new AbortController();
      timeoutId = setTimeout(() => abortController.abort(), 10000);

      // bootstrapModules tells React to:
      // 1. Emit $RC/$RX inline scripts for out-of-order Suspense boundary completion
      // 2. Inject <script type="module" src="..."> at the end of its stream
      const reactStream = await renderToReadableStream(element, {
        bootstrapModules: [clientEntry],
        signal: abortController.signal,
        onError(error: unknown) {
          console.error('Streaming render error:', error);
        },
      });

      // Pipe progressively: head → React content (with $RC scripts) → tail
      // Do NOT await allReady — that defeats streaming by buffering everything.
      const reader = reactStream.getReader();
      let phase: 'head' | 'body' | 'done' = 'head';

      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          switch (phase) {
            case 'head':
              // Send shell head immediately so the browser can parse CSS/meta
              controller.enqueue(headBytes);
              phase = 'body';
              break;
            case 'body': {
              const { done, value } = await reader.read();
              if (done) {
                // React finished rendering — all Suspense boundaries resolved.
                // React's stream already included the client entry <script> via bootstrapModules.
                if (hasDeferred) {
                  let resolvedData: unknown;
                  try {
                    // Race against a timeout so a hanging deferred can't stall the stream forever.
                    resolvedData = await Promise.race([
                      resolveAllDeferred(loaderData),
                      new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Deferred data resolution timed out')), 10000)
                      ),
                    ]);
                  } catch (error) {
                    console.error('Deferred data resolution failed:', error);
                    resolvedData = null;
                  }
                  const loaderScript = `${traceScript}<script>window.__EREO_DATA__=${serializeLoaderData(resolvedData)}</script>`;
                  const resolvedTail = `</div>\n    ${loaderScript}\n</body>\n</html>`;
                  controller.enqueue(encoder.encode(resolvedTail));
                } else {
                  controller.enqueue(tailBytes!);
                }
                clearTimeout(timeoutId);
                controller.close();
                phase = 'done';
              } else {
                controller.enqueue(value);
              }
              break;
            }
          }
        },
        cancel() {
          reader.cancel();
          clearTimeout(timeoutId);
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Streaming render failed:', error);
      // Fallback to string rendering on error
      return this.renderStringPage(element, shell, loaderData, traceScript);
    }
  }

  /**
   * Render page using traditional string-based SSR.
   */
  private async renderStringPage(
    element: ReactElement,
    shell: ShellTemplate,
    loaderData: unknown,
    traceScript: string = ''
  ): Promise<Response> {
    try {
      const { renderToString: reactRenderToString } = await import('react-dom/server');

      // String mode doesn't support Suspense streaming — resolve deferred data upfront
      const resolvedData = hasDeferredData(loaderData)
        ? await resolveAllDeferred(loaderData)
        : loaderData;

      const scripts = [this.options.clientEntry!];
      const { head, tail } = createShell({ shell, scripts, loaderData: resolvedData });

      const content = reactRenderToString(element);
      const html = head + content + (traceScript ? tail.replace('</body>', `${traceScript}</body>`) : tail);
      const encoder = new TextEncoder();
      const htmlBytes = encoder.encode(html);

      return new Response(htmlBytes, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': htmlBytes.length.toString(),
        },
      });
    } catch (error) {
      console.error('String render failed:', error);
      // Return error page
      return this.renderErrorPage(error);
    }
  }

  /**
   * Render page directly using streaming when layout provides HTML structure.
   * The layout component is expected to render the full HTML document.
   *
   * React content streams progressively. Hydration scripts are appended
   * after the stream completes (browsers tolerate post-body scripts).
   */
  private async renderStreamingPageDirect(
    element: ReactElement,
    loaderData: unknown,
    metaDescriptors: MetaDescriptor[] = [],
    traceScript: string = ''
  ): Promise<Response> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const { renderToReadableStream } = await getStreamingRenderer();

      // If renderToReadableStream is not available, fallback to string rendering
      if (!renderToReadableStream) {
        return this.renderStringPageDirect(element, loaderData, metaDescriptors, traceScript);
      }

      const hasDeferred = hasDeferredData(loaderData);
      const clientEntry = this.options.clientEntry!;
      const encoder = new TextEncoder();

      // Abort streaming after 10s to prevent hanging on unresolved Suspense.
      const abortController = new AbortController();
      timeoutId = setTimeout(() => abortController.abort(), 10000);

      // Layout provides full HTML structure. bootstrapModules tells React to
      // emit $RC scripts for Suspense and inject client entry at stream end.
      const reactStream = await renderToReadableStream(element, {
        bootstrapModules: [clientEntry],
        signal: abortController.signal,
        onError(error: unknown) {
          console.error('Streaming render error:', error);
        },
      });

      // Pre-build loader script if no deferred data (fast path).
      // Client entry is NOT included here — React handles it via bootstrapModules.
      const loaderScript = (!hasDeferred && loaderData !== undefined)
        ? encoder.encode(`${traceScript}<script>window.__EREO_DATA__=${serializeLoaderData(loaderData)}</script>`)
        : (traceScript ? encoder.encode(traceScript) : null);

      // Build meta injection HTML for streaming
      const metaHtml = metaDescriptors.length > 0
        ? this.buildMetaHtml(metaDescriptors)
        : '';
      let metaInjected = metaHtml.length === 0;
      const decoder = new TextDecoder();

      // Pipe progressively: React content (with $RC scripts) → loader data
      // Do NOT await allReady — stream bytes to the client as React renders.
      const reader = reactStream.getReader();
      let done = false;
      const self = this;

      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (done) return;

          const result = await reader.read();
          if (result.done) {
            // React finished — all Suspense boundaries resolved.
            // React's stream already included the client entry <script> via bootstrapModules.
            if (hasDeferred) {
              let resolvedData: unknown;
              try {
                // Race against a timeout so a hanging deferred can't stall the stream forever.
                resolvedData = await Promise.race([
                  resolveAllDeferred(loaderData),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Deferred data resolution timed out')), 10000)
                  ),
                ]);
              } catch (error) {
                console.error('Deferred data resolution failed:', error);
                resolvedData = null;
              }
              // Always emit __EREO_DATA__ (even null) so the client has a consistent contract.
              controller.enqueue(encoder.encode(
                `${traceScript}<script>window.__EREO_DATA__=${serializeLoaderData(resolvedData)}</script>`
              ));
            } else if (loaderScript) {
              controller.enqueue(loaderScript);
            }
            clearTimeout(timeoutId);
            controller.close();
            done = true;
          } else {
            // Inject route meta tags into the layout's <head> on first matching chunk
            if (!metaInjected) {
              const chunk = decoder.decode(result.value, { stream: true });
              if (chunk.includes('</head>')) {
                const injected = self.injectMetaIntoHtml(chunk, metaDescriptors);
                controller.enqueue(encoder.encode(injected));
                metaInjected = true;
                return;
              }
            }
            controller.enqueue(result.value);
          }
        },
        cancel() {
          reader.cancel();
          clearTimeout(timeoutId);
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Streaming render failed:', error);
      return this.renderStringPageDirect(element, loaderData, metaDescriptors, traceScript);
    }
  }

  /**
   * Render page directly using string when layout provides HTML structure.
   */
  private async renderStringPageDirect(
    element: ReactElement,
    loaderData: unknown,
    metaDescriptors: MetaDescriptor[] = [],
    traceScript: string = ''
  ): Promise<Response> {
    try {
      const { renderToString: reactRenderToString } = await import('react-dom/server');

      // String mode doesn't support Suspense streaming — resolve deferred data upfront
      const resolvedData = hasDeferredData(loaderData)
        ? await resolveAllDeferred(loaderData)
        : loaderData;

      let html = reactRenderToString(element);

      // Inject route meta tags into the layout's <head>.
      // This handles the case where the root layout provides <html>/<head>/<body>
      // but the route defines a meta() function for SEO tags.
      if (metaDescriptors.length > 0) {
        html = this.injectMetaIntoHtml(html, metaDescriptors);
      }

      // Inject loader data and client script before closing body tag
      const loaderScript = resolvedData !== undefined
        ? `${traceScript}<script>window.__EREO_DATA__=${serializeLoaderData(resolvedData)}</script>`
        : traceScript;
      const clientScript = `<script type="module" src="${this.options.clientEntry}"></script>`;
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${loaderScript}${clientScript}</body>`);
      } else {
        html += `${loaderScript}${clientScript}`;
      }

      const encoder = new TextEncoder();
      const htmlBytes = encoder.encode(html);

      return new Response(htmlBytes, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': htmlBytes.length.toString(),
        },
      });
    } catch (error) {
      console.error('String render failed:', error);
      return this.renderErrorPage(error);
    }
  }

  /**
   * Render a minimal HTML page when no component is available.
   */
  private async renderMinimalPage(match: RouteMatch, loaderData: unknown, traceScript: string = ''): Promise<Response> {
    // Resolve any deferred data before serialization
    const resolvedData = hasDeferredData(loaderData)
      ? await resolveAllDeferred(loaderData)
      : loaderData;

    const serializedData = serializeLoaderData({
      loaderData: resolvedData,
      params: match.params,
    });

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>EreoJS App</title>
</head>
<body>
  <div id="root"></div>
  ${traceScript}<script>window.__EREO_DATA__=${serializedData}</script>
  <script type="module" src="${this.options.clientEntry}"></script>
</body>
</html>`;

    const encoder = new TextEncoder();
    const htmlBytes = encoder.encode(html);

    return new Response(htmlBytes, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': htmlBytes.length.toString(),
      },
    });
  }

  /**
   * Render an error page.
   */
  private renderErrorPage(error: unknown): Response {
    const message = error instanceof Error ? error.message : 'An error occurred';
    const stack = this.options.development && error instanceof Error ? error.stack : undefined;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error - EreoJS</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { color: #dc2626; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 1rem; overflow-x: auto; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Render Error</h1>
  <p>${this.escapeHtml(message)}</p>
  ${stack ? `<pre>${this.escapeHtml(stack)}</pre>` : ''}
</body>
</html>`;

    return new Response(html, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
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
      const override = formData.get(BunServer.METHOD_OVERRIDE_HEADER);
      if (typeof override !== 'string') {
        return method;
      }

      const normalized = override.toUpperCase();
      return BunServer.METHOD_OVERRIDE_ALLOWED.has(normalized) ? normalized : method;
    } catch {
      return method;
    }
  }

  /**
   * Build meta descriptors from route's meta function.
   */
  private buildMeta(
    module: RouteModule,
    loaderData: unknown,
    params: Record<string, string | string[] | undefined>,
    url: URL
  ): MetaDescriptor[] {
    if (!module.meta) {
      return [];
    }

    try {
      return module.meta({
        data: loaderData,
        params,
        location: {
          pathname: url.pathname,
          search: url.search,
          hash: url.hash,
        },
      });
    } catch (error) {
      console.error('Error building meta:', error);
      return [];
    }
  }

  /**
   * Extract title from meta descriptors.
   */
  private extractTitle(meta: MetaDescriptor[]): string | undefined {
    for (const descriptor of meta) {
      if (descriptor.title) {
        return descriptor.title;
      }
    }
    return undefined;
  }

  /**
   * Extract meta tags from meta descriptors (excluding title).
   */
  private extractMetaTags(meta: MetaDescriptor[]): Array<{ name?: string; property?: string; content: string }> {
    const tags: Array<{ name?: string; property?: string; content: string }> = [];

    for (const descriptor of meta) {
      if (descriptor.name && descriptor.content) {
        tags.push({ name: descriptor.name, content: descriptor.content });
      } else if (descriptor.property && descriptor.content) {
        tags.push({ property: descriptor.property, content: descriptor.content });
      }
    }

    return tags;
  }

  /**
   * Build HTML string for meta tags from descriptors.
   */
  private buildMetaHtml(meta: MetaDescriptor[]): string {
    let html = '';
    for (const descriptor of meta) {
      if (descriptor.name && descriptor.content) {
        const name = descriptor.name.replace(/"/g, '&quot;');
        const content = descriptor.content.replace(/"/g, '&quot;');
        html += `<meta name="${name}" content="${content}"/>`;
      } else if (descriptor.property && descriptor.content) {
        const property = descriptor.property.replace(/"/g, '&quot;');
        const content = descriptor.content.replace(/"/g, '&quot;');
        html += `<meta property="${property}" content="${content}"/>`;
      } else if (descriptor['script:ld+json']) {
        // Escape closing script tags to prevent XSS breakout
        const safeJsonLd = String(descriptor['script:ld+json']).replace(/<\//g, '<\\/');
        html += `<script type="application/ld+json">${safeJsonLd}</script>`;
      } else if (descriptor.tagName === 'link') {
        const attrs = Object.entries(descriptor)
          .filter(([k]) => k !== 'tagName')
          .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
          .join(' ');
        html += `<link ${attrs}/>`;
      }
    }
    return html;
  }

  /**
   * Inject route meta tags into layout-rendered HTML.
   * Replaces the <title> if a meta title is provided, and inserts
   * meta/link tags before </head>.
   */
  private injectMetaIntoHtml(html: string, meta: MetaDescriptor[]): string {
    const title = this.extractTitle(meta);
    const metaHtml = this.buildMetaHtml(meta);

    // Replace existing <title> with the route's meta title
    if (title) {
      const escapedTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapedTitle}</title>`);
    }

    // Inject meta tags before </head>
    if (metaHtml) {
      html = html.replace('</head>', `${metaHtml}</head>`);
    }

    return html;
  }

  /**
   * Build matches data for useMatches hook.
   * Returns array of matched routes from outermost layout to page.
   */
  private buildMatchesData(
    match: MatchResult,
    loaderData: unknown,
    layoutLoaderData: Map<string, unknown>
  ): Array<{ id: string; pathname: string; params: Record<string, string | string[] | undefined>; data: unknown; handle: unknown }> {
    const matches: Array<{ id: string; pathname: string; params: Record<string, string | string[] | undefined>; data: unknown; handle: unknown }> = [];

    // Add layouts (outermost first)
    for (const layout of match.layouts || []) {
      matches.push({
        id: layout.id,
        pathname: match.pathname,
        params: match.params,
        data: layoutLoaderData.get(layout.id) ?? null,
        handle: layout.module?.handle ?? undefined,
      });
    }

    // Add the route itself
    matches.push({
      id: match.route.id,
      pathname: match.pathname,
      params: match.params,
      data: loaderData,
      handle: match.route.module?.handle ?? undefined,
    });

    return matches;
  }

  /**
   * Build merged response headers from route and layout headers functions.
   * Cascades from outermost layout → innermost layout → route.
   * Each headers function receives the parent headers from the layout above it.
   */
  private buildRouteHeaders(
    match: MatchResult,
    actionHeaders: Headers = new Headers()
  ): Headers {
    const layouts = match.layouts || [];
    const module = match.route.module;

    // Start with empty parent headers
    let parentHeaders = new Headers();

    // Process layouts from outermost to innermost
    for (const layout of layouts) {
      const headersFn = layout.module?.headers as HeadersFunction | undefined;
      if (headersFn) {
        try {
          const result = headersFn({
            loaderHeaders: new Headers(),
            actionHeaders,
            parentHeaders,
          });
          parentHeaders = result instanceof Headers ? result : new Headers(result as HeadersInit);
        } catch (error) {
          console.error(`Error in layout headers function (${layout.id}):`, error);
        }
      }
    }

    // Process route headers function
    if (module?.headers) {
      try {
        const result = (module.headers as HeadersFunction)({
          loaderHeaders: new Headers(),
          actionHeaders,
          parentHeaders,
        });
        return result instanceof Headers ? result : new Headers(result as HeadersInit);
      } catch (error) {
        console.error('Error in route headers function:', error);
      }
    }

    return parentHeaders;
  }

  /**
   * Apply custom route headers to a Response, preserving required headers.
   */
  private applyRouteHeaders(response: Response, routeHeaders: Headers): Response {
    // If no custom headers, return as-is
    let hasHeaders = false;
    routeHeaders.forEach(() => { hasHeaders = true; });
    if (!hasHeaders) return response;

    const newHeaders = new Headers(response.headers);
    routeHeaders.forEach((value, key) => {
      // Don't override content-type or content-length set by the framework
      const lower = key.toLowerCase();
      if (lower === 'content-type' || lower === 'content-length') return;
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  /**
   * Escape HTML special characters.
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Find the nearest _error route for a given match.
   * Searches from the matched route's directory upward to root.
   */
  private async findErrorBoundary(match: MatchResult): Promise<Route | null> {
    if (!this.router || typeof this.router.getRoutes !== 'function') return null;

    // Flatten the route tree since getRoutes() returns nested structure
    const flattenRoutes = (routes: Route[]): Route[] => {
      const result: Route[] = [];
      for (const route of routes) {
        result.push(route);
        if (route.children) {
          result.push(...flattenRoutes(route.children));
        }
      }
      return result;
    };

    const allRoutes = flattenRoutes(this.router.getRoutes());
    const matchPath = match.route.path;

    // Build candidate paths: from most specific to root
    // e.g., for /posts/[slug] → try /posts/_error, then /_error
    const segments = matchPath.split('/').filter(Boolean);
    const candidates: string[] = [];
    for (let i = segments.length; i >= 0; i--) {
      const prefix = '/' + segments.slice(0, i).join('/');
      candidates.push(prefix === '/' ? '/_error' : prefix + '/_error');
    }

    for (const candidate of candidates) {
      const errorRoute = allRoutes.find((r: Route) => {
        // Match by path
        if (r.path === candidate) return true;
        // Also check file path for _error in the matching directory
        if (r.file?.includes('_error')) {
          const normalizedCandidate = candidate.replace('/_error', '') || '/';
          const normalizedRoutePath = r.path.replace('/_error', '') || '/';
          return normalizedRoutePath === normalizedCandidate;
        }
        return false;
      });
      if (errorRoute) {
        if (typeof this.router.loadModule === 'function') {
          await this.router.loadModule(errorRoute);
        }
        if (errorRoute.module?.default) {
          return errorRoute;
        }
      }
    }
    return null;
  }

  /**
   * Render an error page using the nearest _error boundary component.
   */
  private async renderErrorBoundaryPage(
    request: Request,
    match: MatchResult,
    context: RequestContext,
    errorResponse: Response,
    errorRoute: Route
  ): Promise<Response> {
    const url = new URL(request.url);
    const ErrorComponent = errorRoute.module!.default!;

    // Create an error object that satisfies both Error type and isRouteErrorResponse() check
    const bodyText = await errorResponse.clone().text();
    const routeError = Object.assign(new Error(bodyText || errorResponse.statusText), {
      status: errorResponse.status,
      statusText: errorResponse.statusText || (errorResponse.status === 404 ? 'Not Found' : 'Error'),
      data: bodyText,
    });

    // Build element with error prop
    let element: ReactElement = createElement(ErrorComponent as any, { error: routeError });

    // Wrap with EreoProvider with error context so useRouteError() works
    element = createElement(EreoProvider, {
      loaderData: null,
      actionData: undefined,
      params: match.params,
      location: { pathname: url.pathname, search: url.search, hash: '', state: null, key: 'ssr' },
      error: routeError,
      children: element,
    });

    // Compose with layouts (error pages still render inside layouts)
    const layouts = match.layouts || [];
    for (let i = layouts.length - 1; i >= 0; i--) {
      const layout = layouts[i];
      if (layout.module?.default) {
        const LayoutComponent = layout.module.default;
        const childElement = element;
        // Match the same pattern as normal page rendering
        element = createElement(
          OutletProvider,
          { element: childElement } as any,
          createElement(LayoutComponent, {
            loaderData: null,
            params: match.params,
            children: childElement,
          })
        );
      }
    }

    const { renderToString: reactRenderToString } = await import('react-dom/server');
    const content = reactRenderToString(element);

    // If layouts provided full HTML structure, content already has DOCTYPE/html/body.
    // Otherwise wrap in a minimal HTML document so the browser renders correctly.
    const hasHtmlTag = content.includes('<html') || content.includes('<!DOCTYPE') || content.includes('<!doctype');
    const html = hasHtmlTag
      ? content
      : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error</title>
</head>
<body>
  <div id="root">${content}</div>
  <script type="module" src="${this.options.clientEntry}"></script>
</body>
</html>`;

    return new Response(html, {
      status: errorResponse.status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  /**
   * Handle errors.
   */
  private handleError(error: unknown, context: RequestContext): Response {
    // Check if error is a thrown Response (e.g., for redirects thrown from loaders)
    if (error instanceof Response) {
      return error;
    }

    // Handle notFound() errors — return 404 with optional data
    if (error instanceof NotFoundError) {
      return new Response(
        JSON.stringify({
          error: 'Not Found',
          status: 404,
          data: error.data,
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error';
    const stack = error instanceof Error ? error.stack : undefined;

    console.error('Server error:', error);

    if (this.options.development) {
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
   * Start the server.
   */
  async start(): Promise<Server<unknown>> {
    const { port, hostname, tls, websocket } = this.options;
    const upgradeHandlers = this.wsUpgradeHandlers;

    // Always build a unified multiplexed WebSocket handler.
    // This routes events to HMR, plugin, or route-level handlers based on ws.data._wsType.
    // Route-level handlers can be registered dynamically after server start.
    const resolveHandler = (ws: any) => {
      const type = ws.data?._wsType;
      if (type === 'hmr' && websocket) return websocket;
      if (type) return upgradeHandlers.find(h => h.path === type)?.wsConfig;
      return undefined;
    };

    const mergedWebSocket: any = {
      message(ws: any, message: any) {
        const handler = resolveHandler(ws);
        if (!handler) { console.warn(`[ereo] WebSocket message with unknown _wsType: ${ws.data?._wsType ?? 'undefined'}`); return; }
        handler.message?.(ws, message);
      },
      open(ws: any) {
        const handler = resolveHandler(ws);
        if (!handler) { console.warn(`[ereo] WebSocket open with unknown _wsType: ${ws.data?._wsType ?? 'undefined'}`); ws.close(); return; }
        handler.open?.(ws);
      },
      close(ws: any) { resolveHandler(ws)?.close?.(ws); },
      drain(ws: any) { resolveHandler(ws)?.drain?.(ws); },
    };

    const serverOptions: Parameters<typeof Bun.serve>[0] = {
      port,
      hostname,
      fetch: async (request: Request, server: Server<unknown>) => {
        const url = new URL(request.url);

        // Handle WebSocket upgrade for HMR
        if (websocket && url.pathname === '/__hmr') {
          if (server.upgrade(request, { data: { _wsType: 'hmr' } })) return undefined as any;
        }

        // Handle WebSocket upgrade for trace streaming
        if (url.pathname === '/__ereo/trace-ws' && typeof this.options.trace === 'object' && this.options.trace.traceWebSocket) {
          const traceWsType = '__ereo_trace_ws';
          if (!upgradeHandlers.some(h => h.path === traceWsType)) {
            upgradeHandlers.push({
              path: traceWsType,
              upgrader: () => true,
              wsConfig: this.options.trace.traceWebSocket.websocket,
            });
          }
          if (server.upgrade(request, { data: { _wsType: traceWsType } })) return undefined as any;
        }

        // Handle plugin WebSocket upgrades
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
          for (const handler of upgradeHandlers) {
            if (url.pathname === handler.path) {
              const data = { _wsType: handler.path, subscriptions: new Map(), ctx: {}, originalRequest: request };
              if (server.upgrade(request, { data })) return undefined as any;
            }
          }

          // Handle route-level WebSocket upgrades
          if (this.router && typeof this.router.getRoutes === 'function') {
            const routes = this.router.getRoutes();
            const matchResult = matchWithLayouts(url.pathname, routes);
            if (matchResult) {
              await this.router.loadModule(matchResult.route);
              const mod = matchResult.route.module;
              if (mod?.websocket) {
                const wsType = 'route:' + url.pathname;
                // Register the handler dynamically if not already registered
                if (!upgradeHandlers.some(h => h.path === wsType)) {
                  upgradeHandlers.push({
                    path: wsType,
                    upgrader: () => true,
                    wsConfig: mod.websocket,
                  });
                }
                // If route has a GET handler, let it handle the upgrade with custom data
                if (typeof mod.GET === 'function') {
                  return this.handleRequest(request, wsType);
                }
                // Auto-upgrade without GET handler
                if (server.upgrade(request, { data: { _wsType: wsType } })) {
                  return undefined as any;
                }
                return new Response('WebSocket upgrade failed', { status: 400 });
              }
            }
          }
        }

        return this.handleRequest(request);
      },
      error: (error) => this.handleError(error, {} as RequestContext),
    };

    if (tls) {
      serverOptions.tls = tls;
    }

    // Always set WebSocket handler for multiplexing support
    (serverOptions as any).websocket = mergedWebSocket;

    this.server = Bun.serve(serverOptions);

    const protocol = tls ? 'https' : 'http';
    console.log(`Server running at ${protocol}://${hostname}:${port}`);

    return this.server;
  }

  /**
   * Stop the server.
   */
  stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  /**
   * Reload the server (for HMR).
   */
  async reload(): Promise<void> {
    if (this.server) {
      this.server.reload({
        fetch: (request: Request) => this.handleRequest(request),
      });
    }
  }

  /**
   * Get the server instance.
   */
  getServer(): Server<unknown> | null {
    return this.server;
  }

  /**
   * Get server info.
   */
  getInfo(): { port: number; hostname: string; development: boolean } {
    return {
      port: this.options.port!,
      hostname: this.options.hostname!,
      development: this.options.development!,
    };
  }
}

/**
 * Create a Bun server.
 */
export function createServer(options?: ServerOptions): BunServer {
  return new BunServer(options);
}

/**
 * Quick start helper.
 */
export async function serve(options?: ServerOptions): Promise<BunServer> {
  const server = createServer(options);
  await server.start();
  return server;
}
