/**
 * @areo/router
 *
 * File-based routing for the Areo framework.
 * Supports dynamic routes, catch-all routes, layouts, and route groups.
 */

// File Router
export {
  FileRouter,
  createFileRouter,
  initFileRouter,
} from './file-router';

// Route Config
export {
  parseMiddleware,
  parseRenderConfig,
  parseIslandsConfig,
  parseCacheConfig,
  parseProgressiveConfig,
  parseAuthConfig,
  parseDevConfig,
  parseVariants,
  parseRouteConfig,
  mergeRouteConfigs,
} from './route-config';

// Route Tree
export {
  RouteTree,
  buildRouteTree,
  createRouteTree,
  filePathToUrlPath,
} from './route-tree';

// URL Matcher
export {
  RouteMatcher,
  createMatcher,
  matchRoute,
  matchWithLayouts,
  parsePathSegments,
  calculateRouteScore,
  patternToRegex,
} from './matcher';

// Middleware Chain
export {
  // Basic middleware functions
  registerMiddleware,
  getMiddleware,
  hasMiddleware,
  unregisterMiddleware,
  clearMiddlewareRegistry,
  resolveMiddleware,
  executeMiddlewareChain,
  createMiddlewareExecutor,
  composeMiddleware,
  when,
  method,
  path,
  // Built-in middleware
  createLoggerMiddleware,
  createCorsMiddleware,
  createRateLimitMiddleware,
  // Type-safe middleware
  createMiddleware,
  chainMiddleware,
  registerTypedMiddleware,
  getTypedMiddleware,
  validateMiddlewareChain,
  // Utilities
  globToRegex,
} from './middleware-chain';

export type {
  TypedMiddlewareContext,
  TypedMiddlewareHandler,
  TypedMiddleware,
  MiddlewareChainOptions,
} from './middleware-chain';

// Re-export core middleware types for convenience
// Users can import these from either @areo/core or @areo/router
export type {
  MiddlewareHandler,
  NextFunction,
  Middleware,
  MiddlewareReference,
  AppContext,
} from '@areo/core';

// Validation
export {
  ParamValidationError,
  validators,
  validateParams,
  safeValidateParams,
  validateSearchParams,
  createRouteValidator,
  matchParamPattern,
  extractParamNames,
} from './validation';

// Types
export type {
  FileRoute,
  RouteSegment,
  RouteNode,
  RouterOptions,
  MatchResult,
  RouteRegistry,
  RouterEvents,
} from './types';

// Constants
export {
  ROUTE_SCORE,
  SPECIAL_FILES,
  ROUTE_GROUP_PATTERN,
  DYNAMIC_SEGMENT_PATTERN,
  CATCH_ALL_PATTERN,
  OPTIONAL_PATTERN,
} from './types';
