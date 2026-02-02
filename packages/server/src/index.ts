/**
 * @areo/server
 *
 * High-performance Bun HTTP server for the Areo framework.
 */

// Server
export {
  BunServer,
  createServer,
  serve,
} from './bun-server';

export type { ServerOptions, RenderMode } from './bun-server';

// Middleware
export {
  MiddlewareChain,
  createMiddlewareChain,
  logger,
  cors,
  securityHeaders,
  compress,
  rateLimit,
} from './middleware';

export type {
  MiddlewareDefinition,
  CorsOptions,
  SecurityHeadersOptions,
  RateLimitOptions,
} from './middleware';

// Static Files
export {
  serveStatic,
  staticMiddleware,
  getMimeType,
} from './static';

export type { StaticOptions } from './static';

// Streaming
export {
  createShell,
  renderToStream,
  renderToString,
  createResponse,
  createSuspenseStream,
} from './streaming';

export type {
  RenderOptions,
  ShellTemplate,
  RenderResult,
} from './streaming';
