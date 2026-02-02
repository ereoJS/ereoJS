/**
 * @oreo/server - Bun HTTP Server
 *
 * High-performance HTTP server using Bun.serve().
 * Designed for 5-6x faster performance than Node.js.
 */

import type { Server } from 'bun';
import type { FrameworkConfig, RouteMatch, Route } from '@oreo/core';
import { createContext, RequestContext, OreoApp } from '@oreo/core';
import { FileRouter, createFileRouter } from '@oreo/router';
import {
  MiddlewareChain,
  createMiddlewareChain,
  logger,
  cors,
  securityHeaders,
} from './middleware';
import { serveStatic, type StaticOptions } from './static';
import { createShell, createResponse, renderToString, type ShellTemplate } from './streaming';

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
}

/**
 * Bun server instance.
 */
export class BunServer {
  private server: Server | null = null;
  private app: OreoApp | null = null;
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
  setApp(app: OreoApp): void {
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
  use(handler: Parameters<MiddlewareChain['use']>[0]): void {
    this.middleware.use(handler as any);
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

    // Full page render
    // For now, return JSON until React rendering is fully set up
    return new Response(JSON.stringify({ data: loaderData, params: match.params }), {
      headers: { 'Content-Type': 'application/json' },
    });
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
  async start(): Promise<Server> {
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
      serverOptions.websocket = websocket;
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
        fetch: (request) => this.handleRequest(request),
      });
    }
  }

  /**
   * Get the server instance.
   */
  getServer(): Server | null {
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
