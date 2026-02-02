/**
 * @oreo/router - Route Configuration Parser
 *
 * Parses and validates route-level configuration exports.
 */

import type {
  RouteConfig,
  RenderConfig,
  IslandsConfig,
  RouteCacheConfig,
  ProgressiveConfig,
  AuthConfig,
  DevConfig,
  RouteVariant,
  MiddlewareReference,
  HydrationStrategy,
  RouteParams,
  AppContext,
} from '@oreo/core';

/** Default render configuration */
const defaultRenderConfig: RenderConfig = {
  mode: 'ssr',
  streaming: { enabled: true },
};

/** Default islands configuration */
const defaultIslandsConfig: IslandsConfig = {
  defaultStrategy: 'load',
  disabled: false,
};

/** Default progressive config */
const defaultProgressiveConfig: ProgressiveConfig = {
  forms: { fallback: 'server', redirect: 'follow' },
  prefetch: { trigger: 'hover', data: true, ttl: 60000 },
};

/** Parse and validate middleware chain */
export function parseMiddleware(
  middleware: unknown
): MiddlewareReference[] | undefined {
  if (!middleware) return undefined;
  if (!Array.isArray(middleware)) {
    throw new Error('Middleware must be an array');
  }

  return middleware.map((item) => {
    if (typeof item === 'string') return item;
    if (typeof item === 'function') return item as MiddlewareReference;
    throw new Error(`Invalid middleware item: ${item}`);
  });
}

/** Parse render configuration */
export function parseRenderConfig(config: unknown): RenderConfig {
  if (!config || typeof config !== 'object') {
    return defaultRenderConfig;
  }

  const c = config as Record<string, unknown>;
  const mode = (c.mode as string) || 'ssr';

  if (!['ssg', 'ssr', 'csr', 'json', 'xml'].includes(mode)) {
    throw new Error(`Invalid render mode: ${mode}`);
  }

  return {
    mode: mode as RenderConfig['mode'],
    prerender: parsePrerenderConfig(c.prerender),
    streaming: parseStreamingConfig(c.streaming),
    csr: parseCSRConfig(c.csr),
  };
}

function parsePrerenderConfig(config: unknown): RenderConfig['prerender'] {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    enabled: Boolean(c.enabled),
    paths: parsePaths(c.paths),
    revalidate: typeof c.revalidate === 'number' ? c.revalidate : undefined,
    tags: parseTags(c.tags),
    fallback: (c.fallback as 'blocking' | 'static' | '404') || 'blocking',
  };
}

function parsePaths(
  paths: unknown
): string[] | (() => Promise<string[]> | string[]) | undefined {
  if (!paths) return undefined;
  if (Array.isArray(paths)) return paths as string[];
  if (typeof paths === 'function') return paths as () => Promise<string[]> | string[];
  throw new Error('Invalid prerender paths');
}

function parseTags(
  tags: unknown
): string[] | ((params: RouteParams) => string[]) | undefined {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags as string[];
  if (typeof tags === 'function') return tags as (params: RouteParams) => string[];
  throw new Error('Invalid cache tags');
}

function parseStreamingConfig(config: unknown): RenderConfig['streaming'] {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    enabled: Boolean(c.enabled),
    suspenseBoundaries: Array.isArray(c.suspenseBoundaries)
      ? (c.suspenseBoundaries as string[])
      : undefined,
  };
}

function parseCSRConfig(config: unknown): RenderConfig['csr'] {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    enabled: Boolean(c.enabled),
    clientLoader: typeof c.clientLoader === 'function' 
      ? (c.clientLoader as (params: RouteParams) => unknown | Promise<unknown>) 
      : undefined,
  };
}

/** Parse islands configuration */
export function parseIslandsConfig(config: unknown): IslandsConfig {
  if (!config || typeof config !== 'object') {
    return defaultIslandsConfig;
  }

  const c = config as Record<string, unknown>;
  const strategies: HydrationStrategy[] = ['load', 'idle', 'visible', 'media', 'none'];

  const defaultStrategy = (c.defaultStrategy as HydrationStrategy) || 'load';
  if (!strategies.includes(defaultStrategy)) {
    throw new Error(`Invalid hydration strategy: ${defaultStrategy}`);
  }

  return {
    defaultStrategy,
    components: Array.isArray(c.components) ? c.components : undefined,
    disabled: Boolean(c.disabled),
  };
}

/** Parse cache configuration */
export function parseCacheConfig(config: unknown): RouteCacheConfig | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    edge: parseEdgeCache(c.edge),
    browser: parseBrowserCache(c.browser),
    data: parseDataCache(c.data),
  };
}

function parseEdgeCache(config: unknown): RouteCacheConfig['edge'] {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    maxAge: typeof c.maxAge === 'number' ? c.maxAge : 0,
    staleWhileRevalidate:
      typeof c.staleWhileRevalidate === 'number' ? c.staleWhileRevalidate : undefined,
    vary: Array.isArray(c.vary) ? (c.vary as string[]) : undefined,
    keyGenerator: typeof c.keyGenerator === 'function' 
      ? (c.keyGenerator as (args: { request: Request; params: RouteParams }) => string) 
      : undefined,
  };
}

function parseBrowserCache(config: unknown): RouteCacheConfig['browser'] {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    maxAge: typeof c.maxAge === 'number' ? c.maxAge : 0,
    private: Boolean(c.private),
  };
}

function parseDataCache(config: unknown): RouteCacheConfig['data'] {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    key: typeof c.key === 'string' 
      ? c.key 
      : typeof c.key === 'function' 
        ? (c.key as (params: RouteParams) => string) 
        : undefined,
    tags: parseTags(c.tags),
  };
}

/** Parse progressive enhancement config */
export function parseProgressiveConfig(config: unknown): ProgressiveConfig {
  if (!config || typeof config !== 'object') {
    return defaultProgressiveConfig;
  }

  const c = config as Record<string, unknown>;
  return {
    forms: parseFormsConfig(c.forms),
    prefetch: parsePrefetchConfig(c.prefetch),
  };
}

function parseFormsConfig(config: unknown): ProgressiveConfig['forms'] {
  if (!config || typeof config !== 'object') {
    return defaultProgressiveConfig.forms;
  }
  const c = config as Record<string, unknown>;

  const fallback = (c.fallback as 'server' | 'spa') || 'server';
  if (!['server', 'spa'].includes(fallback)) {
    throw new Error(`Invalid form fallback: ${fallback}`);
  }

  return {
    fallback,
    redirect: (c.redirect as 'follow' | 'manual') || 'follow',
  };
}

function parsePrefetchConfig(config: unknown): ProgressiveConfig['prefetch'] {
  if (!config || typeof config !== 'object') {
    return defaultProgressiveConfig.prefetch!;
  }
  const c = config as Record<string, unknown>;

  const trigger = (c.trigger as 'hover' | 'visible' | 'intent' | 'never') || 'hover';
  if (!['hover', 'visible', 'intent', 'never'].includes(trigger)) {
    throw new Error(`Invalid prefetch trigger: ${trigger}`);
  }

  return {
    trigger,
    data: Boolean(c.data),
    ttl: typeof c.ttl === 'number' ? c.ttl : 60000,
  };
}

/** Parse auth configuration */
export function parseAuthConfig(config: unknown): AuthConfig | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    required: Boolean(c.required),
    roles: Array.isArray(c.roles) ? (c.roles as string[]) : undefined,
    permissions: Array.isArray(c.permissions) ? (c.permissions as string[]) : undefined,
    check: typeof c.check === 'function' 
      ? (c.check as (args: { request: Request; context: AppContext; params: RouteParams }) => boolean | Promise<boolean>) 
      : undefined,
    redirect: typeof c.redirect === 'string' ? c.redirect : undefined,
    unauthorized:
      typeof c.unauthorized === 'object'
        ? (c.unauthorized as AuthConfig['unauthorized'])
        : undefined,
  };
}

/** Parse dev configuration */
export function parseDevConfig(config: unknown): DevConfig | undefined {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    mock: parseMockConfig(c.mock),
    latency: typeof c.latency === 'number' ? c.latency : undefined,
    errorRate: typeof c.errorRate === 'number' ? c.errorRate : undefined,
  };
}

function parseMockConfig(config: unknown): DevConfig['mock'] {
  if (!config || typeof config !== 'object') return undefined;
  const c = config as Record<string, unknown>;

  return {
    enabled: Boolean(c.enabled),
    data: typeof c.data === 'object' ? (c.data as Record<string, unknown>) : undefined,
  };
}

/** Parse route variants */
export function parseVariants(config: unknown): RouteVariant[] | undefined {
  if (config === undefined) return undefined;
  if (!Array.isArray(config)) {
    throw new Error('Variants must be an array');
  }

  return config.map((variant, index) => {
    if (!variant || typeof variant !== 'object') {
      throw new Error(`Invalid variant at index ${index}`);
    }
    const v = variant as Record<string, unknown>;

    if (!v.path || typeof v.path !== 'string') {
      throw new Error(`Variant at index ${index} missing path`);
    }

    return {
      path: v.path,
      params: typeof v.params === 'object' ? (v.params as Record<string, 'string' | 'number'>) : undefined,
      config: v.config ? (parseRouteConfig(v.config) as Partial<RouteConfig>) : undefined,
    };
  });
}

/** Parse complete route configuration */
export function parseRouteConfig(config: unknown): RouteConfig {
  if (!config || typeof config !== 'object') {
    return {};
  }

  const c = config as Record<string, unknown>;

  return {
    middleware: parseMiddleware(c.middleware),
    render: parseRenderConfig(c.render),
    islands: parseIslandsConfig(c.islands),
    cache: parseCacheConfig(c.cache),
    progressive: parseProgressiveConfig(c.progressive),
    auth: parseAuthConfig(c.auth),
    dev: parseDevConfig(c.dev),
    variants: parseVariants(c.variants),
  };
}

/** Merge parent and child route configs */
export function mergeRouteConfigs(
  parent: RouteConfig | undefined,
  child: RouteConfig | undefined
): RouteConfig {
  if (!parent) return child || {};
  if (!child) return parent;

  return {
    middleware: [...(parent.middleware || []), ...(child.middleware || [])],
    render: child.render || parent.render,
    islands: child.islands || parent.islands,
    cache: child.cache || parent.cache,
    progressive: child.progressive || parent.progressive,
    route: child.route || parent.route,
    auth: child.auth || parent.auth,
    dev: child.dev || parent.dev,
    variants: child.variants || parent.variants,
  };
}
