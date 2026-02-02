/**
 * @areo/server - Bun HTTP Server
 *
 * High-performance HTTP server using Bun.serve().
 * Designed for 5-6x faster performance than Node.js.
 */

import type { Server } from 'bun';
import type { FrameworkConfig, RouteMatch, Route, RouteModule, MetaDescriptor, MiddlewareHandler } from '@areo/core';
import { createContext, RequestContext, AreoApp } from '@areo/core';
import { FileRouter, createFileRouter } from '@areo/router';
import {
  MiddlewareChain,
  createMiddlewareChain,
  logger,
  cors,
  securityHeaders,
} from './middleware';
import { serveStatic, type StaticOptions } from './static';
import { createShell, createResponse, renderToString, type ShellTemplate } from './streaming';
import { serializeLoaderData } from '@areo/data';
import { createElement, type ReactElement, type ComponentType } from 'react';

/**
 * Server render mode options.
 *
 * This type is distinct from the route-level RenderMode in @areo/core.
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
  private app: AreoApp | null = null;
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
      assetsPath: '/_areo',
      clientEntry: '/_areo/client.js',
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
   * Set the Oreo app instance.
   */
  setApp(app: AreoApp): void {
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
        // Custom handler
        if (this.options.handler) {
          return this.options.handler(request);
        }

        // App handler
        if (this.app) {
          return this.app.handle(request);
        }

        // Router only
        if (this.router) {
          const match = this.router.match(new URL(request.url).pathname);
          if (!match) {
            return new Response('Not Found', { status: 404 });
          }

          // Load module if needed
          await this.router.loadModule(match.route);

          return this.handleRoute(request, match, context);
        }

        return new Response('Not Found', { status: 404 });
      });

      return context.applyToResponse(response);
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  /**
   * Handle a matched route.
   */
  private async handleRoute(
    request: Request,
    match: RouteMatch,
    context: RequestContext
  ): Promise<Response> {
    const module = match.route.module;
    if (!module) {
      return new Response('Route module not loaded', { status: 500 });
    }

    // Handle actions (POST, PUT, DELETE, PATCH)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      if (module.action) {
        const result = await module.action({
          request,
          params: match.params,
          context,
        });

        if (result instanceof Response) {
          return result;
        }

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Handle loaders
    let loaderData: unknown = null;
    if (module.loader) {
      loaderData = await module.loader({
        request,
        params: match.params,
        context,
      });

      if (loaderData instanceof Response) {
        return loaderData;
      }
    }

    // JSON request (client-side navigation)
    if (request.headers.get('Accept')?.includes('application/json')) {
      return new Response(JSON.stringify({ data: loaderData, params: match.params }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Full page render - render React component to HTML
    return this.renderPage(request, match, context, loaderData);
  }

  /**
   * Render a full HTML page with the route component.
   */
  private async renderPage(
    request: Request,
    match: RouteMatch,
    context: RequestContext,
    loaderData: unknown
  ): Promise<Response> {
    const module = match.route.module;
    if (!module?.default) {
      // No component to render, return a minimal HTML page with just the data
      return this.renderMinimalPage(match, loaderData);
    }

    const Component = module.default;
    const url = new URL(request.url);

    // Build meta descriptors from route's meta function
    const metaDescriptors = this.buildMeta(module, loaderData, match.params, url);

    // Build the shell template
    const shell: ShellTemplate = {
      ...this.options.shell,
      title: this.extractTitle(metaDescriptors) || this.options.shell?.title,
      meta: this.extractMetaTags(metaDescriptors),
    };

    // Create the React element for the page component
    const element = createElement(Component, {
      loaderData,
      params: match.params,
    });

    // Choose between streaming and string rendering
    if (this.options.renderMode === 'streaming') {
      return this.renderStreamingPage(element, shell, loaderData);
    } else {
      return this.renderStringPage(element, shell, loaderData);
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
      const { renderToReadableStream } = await import('react-dom/server');

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
  <title>Areo App</title>
</head>
<body>
  <div id="root"></div>
  <script>window.__AREO_DATA__=${serializedData}</script>
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
  <title>Error - Areo</title>
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
      fetch: (request) => this.handleRequest(request),
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
