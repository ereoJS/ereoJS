/**
 * @areo/router - Route Configuration Parser
 *
 * Parses and validates route-level configuration exports.
 */
import type { RouteConfig, RenderConfig, IslandsConfig, RouteCacheConfig, ProgressiveConfig, AuthConfig, DevConfig, RouteVariant, MiddlewareReference } from '@areo/core';
/** Parse and validate middleware chain */
export declare function parseMiddleware(middleware: unknown): MiddlewareReference[] | undefined;
/** Parse render configuration */
export declare function parseRenderConfig(config: unknown): RenderConfig;
/** Parse islands configuration */
export declare function parseIslandsConfig(config: unknown): IslandsConfig;
/** Parse cache configuration */
export declare function parseCacheConfig(config: unknown): RouteCacheConfig | undefined;
/** Parse progressive enhancement config */
export declare function parseProgressiveConfig(config: unknown): ProgressiveConfig;
/** Parse auth configuration */
export declare function parseAuthConfig(config: unknown): AuthConfig | undefined;
/** Parse dev configuration */
export declare function parseDevConfig(config: unknown): DevConfig | undefined;
/** Parse route variants */
export declare function parseVariants(config: unknown): RouteVariant[] | undefined;
/** Parse complete route configuration */
export declare function parseRouteConfig(config: unknown): RouteConfig;
/** Merge parent and child route configs */
export declare function mergeRouteConfigs(parent: RouteConfig | undefined, child: RouteConfig | undefined): RouteConfig;
//# sourceMappingURL=route-config.d.ts.map