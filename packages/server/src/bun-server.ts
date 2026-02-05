/**
 * @ereo/server - Bun HTTP Server
 *
 * High-performance HTTP server using Bun.serve().
 * Designed for 5-6x faster performance than Node.js.
 */

import type { Server } from 'bun';
import type { FrameworkConfig, RouteMatch, Route, RouteModule, MetaDescriptor, MiddlewareHandler, HeadersFunction } from '@ereo/core';
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
import { serializeLoaderData } from '@ereo/data';
import { createElement, type ReactElement, type ComponentType, type ReactNode } from 'react';
import { OutletProvider } from '@ereo/client';

/**
 * Type for the streaming renderer result.
 */
type StreamingRenderer = {
  renderToReadableStream?: (
    element: ReactElement,
    options?: { onError?: (error: unknown) => void }
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
}

/**
 * Bun server instance.
 */
export class BunServer {
  private server: Server<unknown> | null = null;
  private app: EreoApp | null = null;
  private router: FileRouter | null = null;
  private middleware: MiddlewareChain;
  private staticHandler: ((request: Request) => Promise<Response | null>) | null = null;
  private options: ServerOptions;

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

  /**
   * Handle incoming request.
   */
  private async handleRequest(request: Request): Promise<Response> {
    const context = createContext(request);

    try {
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
            const matchResult = matchWithLayouts(pathname, routes);

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
          return await mw.middleware(request, currentNext, context);
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

    // Handle actions (POST, PUT, DELETE, PATCH)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
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

        const actionResponse = new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
        const routeHeaders = this.buildRouteHeaders(match);
        return this.applyRouteHeaders(actionResponse, routeHeaders);
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Run all loaders in parallel: route loader + layout loaders
    const layouts = match.layouts || [];
    const loaderArgs = { request, params: match.params, context };

    // Build array of loader promises: [route, ...layouts]
    const loaderPromises: Promise<unknown>[] = [];

    // Route loader
    loaderPromises.push(
      module.loader ? Promise.resolve(module.loader(loaderArgs)) : Promise.resolve(null)
    );

    // Layout loaders (run in parallel with route loader)
    for (const layout of layouts) {
      loaderPromises.push(
        layout.module?.loader ? Promise.resolve(layout.module.loader(loaderArgs)) : Promise.resolve(null)
      );
    }

    const loaderResults = await Promise.all(loaderPromises);

    // First result is the route loader data
    const loaderData = loaderResults[0];
    if (loaderData instanceof Response) {
      return loaderData;
    }

    // Build layout data map (keyed by layout route ID)
    const layoutLoaderData = new Map<string, unknown>();
    for (let i = 0; i < layouts.length; i++) {
      const layoutData = loaderResults[i + 1];
      if (layoutData instanceof Response) {
        return layoutData; // Layout loader threw a Response (e.g., redirect)
      }
      if (layoutData !== null) {
        layoutLoaderData.set(layouts[i].id, layoutData);
      }
    }

    // Build merged route headers from headers functions
    const routeHeaders = this.buildRouteHeaders(match);

    // JSON request (client-side navigation)
    if (request.headers.get('Accept')?.includes('application/json')) {
      const jsonPayload: Record<string, unknown> = {
        data: loaderData,
        params: match.params,
      };

      // Include layout data if any layouts have loaders
      if (layoutLoaderData.size > 0) {
        const layoutDataObj: Record<string, unknown> = {};
        for (const [id, data] of layoutLoaderData) {
          layoutDataObj[id] = data;
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
    const htmlResponse = await this.renderPage(request, match, context, loaderData, layoutLoaderData);
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
    layoutLoaderData: Map<string, unknown> = new Map()
  ): Promise<Response> {
    const module = match.route.module;
    if (!module?.default) {
      // No component to render, return a minimal HTML page with just the data
      return this.renderMinimalPage(match, loaderData);
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
      // Layout provides the full HTML document structure
      if (this.options.renderMode === 'streaming') {
        return this.renderStreamingPageDirect(element, allLoaderData);
      } else {
        return this.renderStringPageDirect(element, allLoaderData);
      }
    }

    // No layout - use shell template wrapper
    if (this.options.renderMode === 'streaming') {
      return this.renderStreamingPage(element, shell, allLoaderData);
    } else {
      return this.renderStringPage(element, shell, allLoaderData);
    }
  }

  /**
   * Render page using React 18 streaming SSR.
   * Uses renderToReadableStream for Bun environments with native Web Streams API.
   */
  private async renderStreamingPage(
    element: ReactElement,
    shell: ShellTemplate,
    loaderData: unknown
  ): Promise<Response> {
    try {
      const { renderToReadableStream } = await getStreamingRenderer();

      // If renderToReadableStream is not available, fallback to string rendering
      if (!renderToReadableStream) {
        return this.renderStringPage(element, shell, loaderData);
      }

      const scripts = [this.options.clientEntry!];
      const { head, tail } = createShell({ shell, scripts, loaderData });

      const encoder = new TextEncoder();
      const headBytes = encoder.encode(head);
      const tailBytes = encoder.encode(tail);

      // Use renderToReadableStream which is the Web Streams API version
      const reactStream = await renderToReadableStream(element, {
        onError(error: unknown) {
          console.error('Streaming render error:', error);
        },
      });

      // Wait for the shell to be ready
      await reactStream.allReady;

      // Read the React stream and combine with head/tail
      const reader = reactStream.getReader();
      const chunks: Uint8Array[] = [headBytes];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      chunks.push(tailBytes);

      // Calculate total length and combine chunks
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const fullHtml = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fullHtml.set(chunk, offset);
        offset += chunk.length;
      }

      return new Response(fullHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': totalLength.toString(),
        },
      });
    } catch (error) {
      console.error('Streaming render failed:', error);
      // Fallback to string rendering on error
      return this.renderStringPage(element, shell, loaderData);
    }
  }

  /**
   * Render page using traditional string-based SSR.
   */
  private async renderStringPage(
    element: ReactElement,
    shell: ShellTemplate,
    loaderData: unknown
  ): Promise<Response> {
    try {
      const { renderToString: reactRenderToString } = await import('react-dom/server');

      const scripts = [this.options.clientEntry!];
      const { head, tail } = createShell({ shell, scripts, loaderData });

      const content = reactRenderToString(element);
      const html = head + content + tail;
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
   */
  private async renderStreamingPageDirect(
    element: ReactElement,
    loaderData: unknown
  ): Promise<Response> {
    try {
      const { renderToReadableStream } = await getStreamingRenderer();

      // If renderToReadableStream is not available, fallback to string rendering
      if (!renderToReadableStream) {
        return this.renderStringPageDirect(element, loaderData);
      }

      // Render the element directly - layout provides html/head/body
      const reactStream = await renderToReadableStream(element, {
        onError(error: unknown) {
          console.error('Streaming render error:', error);
        },
      });

      // Wait for the shell to be ready
      await reactStream.allReady;

      // Read the React stream
      const reader = reactStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Inject loader data script before closing body tag
      const encoder = new TextEncoder();
      const loaderScript = loaderData
        ? `<script>window.__EREO_DATA__=${serializeLoaderData(loaderData)}</script>`
        : '';
      const clientScript = `<script type="module" src="${this.options.clientEntry}"></script>`;
      const injectedScripts = encoder.encode(loaderScript + clientScript);

      // Calculate total length
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0) + injectedScripts.length;
      const fullHtml = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        fullHtml.set(chunk, offset);
        offset += chunk.length;
      }
      fullHtml.set(injectedScripts, offset);

      return new Response(fullHtml, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': totalLength.toString(),
        },
      });
    } catch (error) {
      console.error('Streaming render failed:', error);
      return this.renderStringPageDirect(element, loaderData);
    }
  }

  /**
   * Render page directly using string when layout provides HTML structure.
   */
  private async renderStringPageDirect(
    element: ReactElement,
    loaderData: unknown
  ): Promise<Response> {
    try {
      const { renderToString: reactRenderToString } = await import('react-dom/server');

      let html = reactRenderToString(element);

      // Inject loader data and client script before closing body tag
      const loaderScript = loaderData
        ? `<script>window.__EREO_DATA__=${serializeLoaderData(loaderData)}</script>`
        : '';
      const clientScript = `<script type="module" src="${this.options.clientEntry}"></script>`;
      html = html.replace('</body>', `${loaderScript}${clientScript}</body>`);

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
  private renderMinimalPage(match: RouteMatch, loaderData: unknown): Response {
    const serializedData = serializeLoaderData({
      loaderData,
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
  <script>window.__EREO_DATA__=${serializedData}</script>
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

    const serverOptions: Parameters<typeof Bun.serve>[0] = {
      port,
      hostname,
      fetch: (request: Request, server: Server<unknown>) => {
        // Handle WebSocket upgrade for HMR
        if (websocket) {
          const url = new URL(request.url);
          if (url.pathname === '/__hmr') {
            if (server.upgrade(request, { data: {} })) return undefined as any;
          }
        }
        return this.handleRequest(request);
      },
      error: (error) => this.handleError(error, {} as RequestContext),
    };

    if (tls) {
      serverOptions.tls = tls;
    }

    if (websocket) {
      (serverOptions as any).websocket = websocket;
    }

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
