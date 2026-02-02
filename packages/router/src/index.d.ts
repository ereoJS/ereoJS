/**
 * @areo/router
 *
 * File-based routing for the Areo framework.
 * Supports dynamic routes, catch-all routes, layouts, and route groups.
 */
export { FileRouter, createFileRouter, initFileRouter, } from './file-router';
export { parseMiddleware, parseRenderConfig, parseIslandsConfig, parseCacheConfig, parseProgressiveConfig, parseAuthConfig, parseDevConfig, parseVariants, parseRouteConfig, mergeRouteConfigs, } from './route-config';
export { RouteTree, buildRouteTree, createRouteTree, filePathToUrlPath, } from './route-tree';
export { RouteMatcher, createMatcher, matchRoute, matchWithLayouts, parsePathSegments, calculateRouteScore, patternToRegex, } from './matcher';
export { registerMiddleware, getMiddleware, hasMiddleware, unregisterMiddleware, clearMiddlewareRegistry, resolveMiddleware, executeMiddlewareChain, createMiddlewareExecutor, composeMiddleware, when, method, path, createLoggerMiddleware, createCorsMiddleware, createRateLimitMiddleware, createMiddleware, chainMiddleware, registerTypedMiddleware, getTypedMiddleware, validateMiddlewareChain, globToRegex, } from './middleware-chain';
export type { TypedMiddlewareContext, TypedMiddlewareHandler, TypedMiddleware, MiddlewareChainOptions, } from './middleware-chain';
export { ParamValidationError, validators, validateParams, safeValidateParams, validateSearchParams, createRouteValidator, matchParamPattern, extractParamNames, } from './validation';
export type { FileRoute, RouteSegment, RouteNode, RouterOptions, MatchResult, RouteRegistry, RouterEvents, } from './types';
export { ROUTE_SCORE, SPECIAL_FILES, ROUTE_GROUP_PATTERN, DYNAMIC_SEGMENT_PATTERN, CATCH_ALL_PATTERN, OPTIONAL_PATTERN, } from './types';
//# sourceMappingURL=index.d.ts.map