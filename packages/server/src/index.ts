/**
 * @ereo/server
 *
 * High-performance Bun HTTP server for the EreoJS framework.
 */

// Server
export {
  BunServer,
  createServer,
  serve,
} from './bun-server';

export type { ServerOptions, ServerRenderMode } from './bun-server';

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

// Re-export core middleware types for convenience
// Users can import these from either @ereo/core or @ereo/server
export type {
  MiddlewareHandler,
  NextFunction,
  Middleware,
  AppContext,
} from '@ereo/core';

// Auth Enforcement
export {
  enforceAuthConfig,
  resolveAuthDenial,
  resolveCheckResult,
} from './auth-enforcement';

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
