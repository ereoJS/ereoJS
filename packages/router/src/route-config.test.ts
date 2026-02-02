/**
 * @oreo/router - Route Configuration Tests
 */

import { describe, it, expect } from 'bun:test';
import type {
  RouteConfig,
  MiddlewareReference,
  HydrationStrategy,
  RouteParams,
  AppContext,
} from '@oreo/core';
import {
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

describe('parseMiddleware', () => {
  it('should return undefined for undefined input', () => {
    expect(parseMiddleware(undefined)).toBeUndefined();
  });

  it('should throw for non-array input', () => {
    expect(() => parseMiddleware('auth')).toThrow('Middleware must be an array');
    expect(() => parseMiddleware({})).toThrow('Middleware must be an array');
  });

  it('should parse string middleware references', () => {
    const middleware = parseMiddleware(['auth', 'rate-limit']);
    expect(middleware).toEqual(['auth', 'rate-limit']);
  });

  it('should parse function middleware references', () => {
    const handler: MiddlewareReference = async (req, ctx, next) => next();
    const middleware = parseMiddleware([handler]);
    expect(middleware).toHaveLength(1);
    expect(typeof middleware![0]).toBe('function');
  });

  it('should parse mixed middleware references', () => {
    const handler: MiddlewareReference = async (req, ctx, next) => next();
    const middleware = parseMiddleware(['auth', handler, 'csrf']);
    expect(middleware).toHaveLength(3);
    expect(middleware![0]).toBe('auth');
    expect(typeof middleware![1]).toBe('function');
    expect(middleware![2]).toBe('csrf');
  });

  it('should throw for invalid middleware items', () => {
    expect(() => parseMiddleware(['auth', 123])).toThrow('Invalid middleware item');
  });
});

describe('parseRenderConfig', () => {
  it('should return default SSR config for undefined input', () => {
    const config = parseRenderConfig(undefined);
    expect(config.mode).toBe('ssr');
    expect(config.streaming?.enabled).toBe(true);
  });

  it('should parse SSR mode', () => {
    const config = parseRenderConfig({ mode: 'ssr' });
    expect(config.mode).toBe('ssr');
  });

  it('should parse SSG mode with prerender config', () => {
    const config = parseRenderConfig({
      mode: 'ssg',
      prerender: {
        enabled: true,
        paths: ['/about', '/contact'],
        revalidate: 3600,
        fallback: 'blocking',
      },
    });
    expect(config.mode).toBe('ssg');
    expect(config.prerender?.enabled).toBe(true);
    expect(config.prerender?.paths).toEqual(['/about', '/contact']);
    expect(config.prerender?.revalidate).toBe(3600);
    expect(config.prerender?.fallback).toBe('blocking');
  });

  it('should parse CSR mode', () => {
    const clientLoader = async (params: RouteParams) => ({ data: 'test' });
    const config = parseRenderConfig({
      mode: 'csr',
      csr: {
        enabled: true,
        clientLoader,
      },
    });
    expect(config.mode).toBe('csr');
    expect(config.csr?.enabled).toBe(true);
    expect(config.csr?.clientLoader).toBe(clientLoader);
  });

  it('should throw for invalid render mode', () => {
    expect(() => parseRenderConfig({ mode: 'invalid' })).toThrow('Invalid render mode');
  });

  it('should parse streaming config with suspense boundaries', () => {
    const config = parseRenderConfig({
      mode: 'ssr',
      streaming: {
        enabled: true,
        suspenseBoundaries: ['comments', 'related-posts'],
      },
    });
    expect(config.streaming?.enabled).toBe(true);
    expect(config.streaming?.suspenseBoundaries).toEqual(['comments', 'related-posts']);
  });

  it('should support function-based prerender paths', () => {
    const getPaths = async () => ['/post-1', '/post-2'];
    const config = parseRenderConfig({
      mode: 'ssg',
      prerender: {
        enabled: true,
        paths: getPaths,
      },
    });
    expect(typeof config.prerender?.paths).toBe('function');
  });

  it('should throw for invalid prerender paths', () => {
    expect(() =>
      parseRenderConfig({
        mode: 'ssg',
        prerender: {
          enabled: true,
          paths: 'invalid-paths' as any,
        },
      })
    ).toThrow('Invalid prerender paths');
  });
});

describe('parseIslandsConfig', () => {
  it('should return default config for undefined input', () => {
    const config = parseIslandsConfig(undefined);
    expect(config.defaultStrategy).toBe('load');
    expect(config.disabled).toBe(false);
  });

  it('should parse with valid hydration strategies', () => {
    const strategies: HydrationStrategy[] = ['load', 'idle', 'visible', 'media', 'none'];
    for (const strategy of strategies) {
      const config = parseIslandsConfig({ defaultStrategy: strategy });
      expect(config.defaultStrategy).toBe(strategy);
    }
  });

  it('should throw for invalid hydration strategy', () => {
    expect(() => parseIslandsConfig({ defaultStrategy: 'invalid' as HydrationStrategy })).toThrow(
      'Invalid hydration strategy'
    );
  });

  it('should parse component-specific strategies', () => {
    const config = parseIslandsConfig({
      defaultStrategy: 'visible',
      components: [
        { component: 'SearchBar', strategy: 'load' },
        { component: 'Comments', strategy: 'visible' },
        { component: 'Chart', strategy: 'idle' },
        { component: 'MobileNav', strategy: 'media', mediaQuery: '(max-width: 768px)' },
      ],
    });
    expect(config.defaultStrategy).toBe('visible');
    expect(config.components).toHaveLength(4);
    expect(config.components![0].strategy).toBe('load');
  });

  it('should parse disabled flag', () => {
    const config = parseIslandsConfig({ disabled: true });
    expect(config.disabled).toBe(true);
  });
});

describe('parseCacheConfig', () => {
  it('should return undefined for undefined input', () => {
    expect(parseCacheConfig(undefined)).toBeUndefined();
  });

  it('should parse edge cache config', () => {
    const config = parseCacheConfig({
      edge: {
        maxAge: 3600,
        staleWhileRevalidate: 86400,
        vary: ['Accept-Language', 'Cookie:session'],
      },
    });
    expect(config?.edge?.maxAge).toBe(3600);
    expect(config?.edge?.staleWhileRevalidate).toBe(86400);
    expect(config?.edge?.vary).toEqual(['Accept-Language', 'Cookie:session']);
  });

  it('should parse edge cache with custom key generator', () => {
    const keyGenerator = ({ request, params }: { request: Request; params: RouteParams }) =>
      `post:${params.slug}`;
    const config = parseCacheConfig({
      edge: {
        maxAge: 3600,
        keyGenerator,
      },
    });
    expect(config?.edge?.keyGenerator).toBe(keyGenerator);
  });

  it('should parse browser cache config', () => {
    const config = parseCacheConfig({
      browser: {
        maxAge: 300,
        private: true,
      },
    });
    expect(config?.browser?.maxAge).toBe(300);
    expect(config?.browser?.private).toBe(true);
  });

  it('should parse data cache config', () => {
    const config = parseCacheConfig({
      data: {
        key: 'posts',
        tags: ['posts', 'blog'],
      },
    });
    expect(config?.data?.key).toBe('posts');
    expect(config?.data?.tags).toEqual(['posts', 'blog']);
  });

  it('should parse data cache with function-based key and tags', () => {
    const keyFn = (params: Record<string, string>) => `post:${params.slug}`;
    const tagsFn = (params: Record<string, string>) => [`post:${params.slug}`, 'all-posts'];
    const config = parseCacheConfig({
      data: {
        key: keyFn,
        tags: tagsFn,
      },
    });
    expect(typeof config?.data?.key).toBe('function');
    expect(typeof config?.data?.tags).toBe('function');
  });

  it('should parse complete cache config', () => {
    const config = parseCacheConfig({
      edge: { maxAge: 3600 },
      browser: { maxAge: 300, private: true },
      data: { key: 'data', tags: ['tag1'] },
    });
    expect(config?.edge?.maxAge).toBe(3600);
    expect(config?.browser?.maxAge).toBe(300);
    expect(config?.data?.key).toBe('data');
  });

  it('should throw for invalid cache tags', () => {
    expect(() =>
      parseCacheConfig({
        data: {
          key: 'test',
          tags: 'invalid-tags' as any,
        },
      })
    ).toThrow('Invalid cache tags');
  });
});

describe('parseProgressiveConfig', () => {
  it('should return default config for undefined input', () => {
    const config = parseProgressiveConfig(undefined);
    expect(config.forms?.fallback).toBe('server');
    expect(config.prefetch?.trigger).toBe('hover');
    expect(config.prefetch?.data).toBe(true);
    expect(config.prefetch?.ttl).toBe(60000);
  });

  it('should parse form fallback config', () => {
    const config = parseProgressiveConfig({
      forms: { fallback: 'spa', redirect: 'manual' },
    });
    expect(config.forms?.fallback).toBe('spa');
    expect(config.forms?.redirect).toBe('manual');
  });

  it('should throw for invalid form fallback', () => {
    expect(() =>
      parseProgressiveConfig({ forms: { fallback: 'invalid' as 'server' | 'spa' } })
    ).toThrow('Invalid form fallback');
  });

  it('should parse prefetch config', () => {
    const triggers = ['hover', 'visible', 'intent', 'never'] as const;
    for (const trigger of triggers) {
      const config = parseProgressiveConfig({
        prefetch: { trigger, data: false, ttl: 30000 },
      });
      expect(config.prefetch?.trigger).toBe(trigger);
      expect(config.prefetch?.data).toBe(false);
      expect(config.prefetch?.ttl).toBe(30000);
    }
  });

  it('should throw for invalid prefetch trigger', () => {
    expect(() =>
      parseProgressiveConfig({ prefetch: { trigger: 'invalid' as 'hover' } })
    ).toThrow('Invalid prefetch trigger');
  });
});

describe('parseAuthConfig', () => {
  it('should return undefined for undefined input', () => {
    expect(parseAuthConfig(undefined)).toBeUndefined();
  });

  it('should parse required auth', () => {
    const config = parseAuthConfig({ required: true });
    expect(config?.required).toBe(true);
  });

  it('should parse roles and permissions', () => {
    const config = parseAuthConfig({
      required: true,
      roles: ['admin', 'editor'],
      permissions: ['posts:write', 'posts:delete'],
    });
    expect(config?.roles).toEqual(['admin', 'editor']);
    expect(config?.permissions).toEqual(['posts:write', 'posts:delete']);
  });

  it('should parse custom auth check', () => {
    const check = async (args: { request: Request; context: AppContext; params: RouteParams }) =>
      true;
    const config = parseAuthConfig({
      required: true,
      check,
      redirect: '/login?from={pathname}',
      unauthorized: { status: 401, body: { error: 'Unauthorized' } },
    });
    expect(config?.check).toBe(check);
    expect(config?.redirect).toBe('/login?from={pathname}');
    expect(config?.unauthorized?.status).toBe(401);
  });
});

describe('parseDevConfig', () => {
  it('should return undefined for undefined input', () => {
    expect(parseDevConfig(undefined)).toBeUndefined();
  });

  it('should parse mock config', () => {
    const config = parseDevConfig({
      mock: {
        enabled: true,
        data: { posts: [{ id: 1, title: 'Mock' }] },
      },
    });
    expect(config?.mock?.enabled).toBe(true);
    expect(config?.mock?.data?.posts).toHaveLength(1);
  });

  it('should parse latency', () => {
    const config = parseDevConfig({ latency: 500 });
    expect(config?.latency).toBe(500);
  });

  it('should parse error rate', () => {
    const config = parseDevConfig({ errorRate: 0.1 });
    expect(config?.errorRate).toBe(0.1);
  });
});

describe('parseVariants', () => {
  it('should return undefined for undefined input', () => {
    expect(parseVariants(undefined)).toBeUndefined();
  });

  it('should throw for non-array input', () => {
    expect(() => parseVariants({})).toThrow();
  });

  it('should parse route variants', () => {
    const variants = parseVariants([
      { path: '/blog/[slug]', params: { slug: 'string' } },
      { path: '/api/posts/[slug]', params: { slug: 'string' }, config: { render: { mode: 'json' } } },
    ]);
    expect(variants).toHaveLength(2);
    expect(variants![0].path).toBe('/blog/[slug]');
    expect(variants![0].params).toEqual({ slug: 'string' });
    expect(variants![1].path).toBe('/api/posts/[slug]');
  });

  it('should throw for variant missing path', () => {
    expect(() => parseVariants([{ params: { slug: 'string' } }])).toThrow('missing path');
  });
});

describe('parseRouteConfig', () => {
  it('should return empty config for undefined input', () => {
    const config = parseRouteConfig(undefined);
    expect(config).toEqual({});
  });

  it('should parse complete route config', () => {
    const routeConfig: RouteConfig = {
      middleware: ['auth'],
      render: { mode: 'ssg', prerender: { enabled: true } },
      islands: { defaultStrategy: 'visible' },
      cache: { edge: { maxAge: 3600 } },
      progressive: { prefetch: { trigger: 'visible' } },
      auth: { required: true },
    };

    const config = parseRouteConfig(routeConfig);
    expect(config.middleware).toEqual(['auth']);
    expect(config.render?.mode).toBe('ssg');
    expect(config.islands?.defaultStrategy).toBe('visible');
    expect(config.cache?.edge?.maxAge).toBe(3600);
    expect(config.progressive?.prefetch?.trigger).toBe('visible');
    expect(config.auth?.required).toBe(true);
  });
});

describe('mergeRouteConfigs', () => {
  it('should return empty config when both are undefined', () => {
    const merged = mergeRouteConfigs(undefined, undefined);
    expect(merged).toEqual({});
  });

  it('should return child config when parent is undefined', () => {
    const child = { middleware: ['auth'] };
    const merged = mergeRouteConfigs(undefined, child);
    expect(merged.middleware).toEqual(['auth']);
  });

  it('should return parent config when child is undefined', () => {
    const parent = { middleware: ['csrf'] };
    const merged = mergeRouteConfigs(parent, undefined);
    expect(merged.middleware).toEqual(['csrf']);
  });

  it('should concatenate middleware arrays', () => {
    const parent = { middleware: ['csrf'] };
    const child = { middleware: ['auth'] };
    const merged = mergeRouteConfigs(parent, child);
    expect(merged.middleware).toEqual(['csrf', 'auth']);
  });

  it('should prefer child render config', () => {
    const parent = { render: { mode: 'ssr' as const } };
    const child = { render: { mode: 'ssg' as const } };
    const merged = mergeRouteConfigs(parent, child);
    expect(merged.render?.mode).toBe('ssg');
  });

  it('should merge nested objects (shallow)', () => {
    const parent = {
      islands: { defaultStrategy: 'load' as const, disabled: false },
      cache: { edge: { maxAge: 3600 } },
    };
    const child = {
      islands: { defaultStrategy: 'visible' as const },
    };
    const merged = mergeRouteConfigs(parent, child);
    expect(merged.islands?.defaultStrategy).toBe('visible');
    // Shallow merge: child.islands completely replaces parent.islands
    expect(merged.islands?.disabled).toBeUndefined();
    expect(merged.cache?.edge?.maxAge).toBe(3600);
  });
});
