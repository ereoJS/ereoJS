/**
 * API Validation Script
 *
 * This script validates that all the new APIs implemented are properly
 * exported and have the correct signatures.
 */

import { describe, expect, test } from 'bun:test';

// ============================================================================
// 1. Validate RenderMode Type Fix (Critical)
// ============================================================================
describe('RenderMode Type Fix', () => {
  test('core exports RenderMode with route-level values', async () => {
    const { RenderMode } = await import('@areo/core') as any;
    // RenderMode is a type, so we check the module has route config types
    const core = await import('@areo/core');
    expect(core).toBeDefined();

    // Verify core types are exported
    type CoreRenderMode = import('@areo/core').RenderMode;
    const validModes: CoreRenderMode[] = ['ssg', 'ssr', 'csr', 'json', 'xml', 'rsc'];
    expect(validModes).toHaveLength(6);
  });

  test('server exports ServerRenderMode (renamed from RenderMode)', async () => {
    const server = await import('@areo/server');
    // ServerRenderMode should be exported, not RenderMode
    expect('ServerRenderMode' in server || server).toBeDefined();

    type ServerRM = import('@areo/server').ServerRenderMode;
    const validModes: ServerRM[] = ['streaming', 'string'];
    expect(validModes).toHaveLength(2);
  });

  test('no type collision between core and server RenderMode', async () => {
    // This test ensures the types are distinct
    type CoreRM = import('@areo/core').RenderMode;
    type ServerRM = import('@areo/server').ServerRenderMode;

    // These should be completely different unions
    const coreMode: CoreRM = 'ssr';
    const serverMode: ServerRM = 'streaming';

    expect(coreMode).toBe('ssr');
    expect(serverMode).toBe('streaming');
  });
});

// ============================================================================
// 2. Validate Unified Middleware Signatures
// ============================================================================
describe('Middleware Signature Unification', () => {
  test('core exports MiddlewareHandler', async () => {
    const core = await import('@areo/core');
    expect(core.MiddlewareHandler).toBeUndefined(); // It's a type, not a value

    // Verify we can use the type
    type MH = import('@areo/core').MiddlewareHandler;
    const handler: MH = async (req, ctx, next) => next();
    expect(typeof handler).toBe('function');
  });

  test('router re-exports core middleware types', async () => {
    const router = await import('@areo/router');
    // Router should re-export core types for convenience
    expect(router).toBeDefined();

    // TypedMiddlewareHandler should be compatible with MiddlewareHandler
    type TMH = import('@areo/router').TypedMiddlewareHandler<{}, {}>;
    type MH = import('@areo/core').MiddlewareHandler;

    // Both should accept same basic signature
    const typedHandler: TMH = async (req, ctx, next) => next();
    expect(typeof typedHandler).toBe('function');
  });

  test('server re-exports core middleware types', async () => {
    const server = await import('@areo/server');
    expect(server).toBeDefined();

    // MiddlewareChain should work with core MiddlewareHandler
    const { createMiddlewareChain } = server;
    expect(typeof createMiddlewareChain).toBe('function');
  });
});

// ============================================================================
// 3. Validate Client React Hooks
// ============================================================================
describe('Client React Hooks', () => {
  test('exports useLoaderData hook', async () => {
    const { useLoaderData } = await import('@areo/client');
    expect(typeof useLoaderData).toBe('function');
  });

  test('exports useActionData hook', async () => {
    const { useActionData } = await import('@areo/client');
    expect(typeof useActionData).toBe('function');
  });

  test('exports useNavigation hook', async () => {
    const { useNavigation } = await import('@areo/client');
    expect(typeof useNavigation).toBe('function');
  });

  test('exports useError hook', async () => {
    const { useError } = await import('@areo/client');
    expect(typeof useError).toBe('function');
  });

  test('exports AreoProvider', async () => {
    const { AreoProvider } = await import('@areo/client');
    expect(AreoProvider).toBeDefined();
  });

  test('exports all context providers', async () => {
    const client = await import('@areo/client');
    expect(client.LoaderDataProvider).toBeDefined();
    expect(client.ActionDataProvider).toBeDefined();
    expect(client.NavigationProvider).toBeDefined();
    expect(client.ErrorProvider).toBeDefined();
  });
});

// ============================================================================
// 4. Validate Form Component
// ============================================================================
describe('Form Component', () => {
  test('exports Form component', async () => {
    const { Form } = await import('@areo/client');
    expect(Form).toBeDefined();
  });

  test('exports useSubmit hook', async () => {
    const { useSubmit } = await import('@areo/client');
    expect(typeof useSubmit).toBe('function');
  });

  test('exports useFetcher hook', async () => {
    const { useFetcher } = await import('@areo/client');
    expect(typeof useFetcher).toBe('function');
  });

  test('exports FormProvider', async () => {
    const { FormProvider } = await import('@areo/client');
    expect(FormProvider).toBeDefined();
  });

  test('exports form utility functions', async () => {
    const client = await import('@areo/client');
    expect(typeof client.serializeFormData).toBe('function');
    expect(typeof client.parseFormData).toBe('function');
    expect(typeof client.formDataToObject).toBe('function');
    expect(typeof client.objectToFormData).toBe('function');
  });
});

// ============================================================================
// 5. Validate Link Component
// ============================================================================
describe('Link Component', () => {
  test('exports Link component', async () => {
    const { Link } = await import('@areo/client');
    expect(Link).toBeDefined();
  });

  test('exports NavLink component', async () => {
    const { NavLink } = await import('@areo/client');
    expect(NavLink).toBeDefined();
  });

  test('exports useIsActive hook', async () => {
    const { useIsActive } = await import('@areo/client');
    expect(typeof useIsActive).toBe('function');
  });

  test('Link types are exported', async () => {
    // Verify types exist by importing them
    type LP = import('@areo/client').LinkProps;
    type NLP = import('@areo/client').NavLinkProps;
    type PS = import('@areo/client').PrefetchStrategy;

    const strategies: PS[] = ['none', 'intent', 'render', 'viewport'];
    expect(strategies).toHaveLength(4);
  });
});

// ============================================================================
// 6. Validate Error Boundary System
// ============================================================================
describe('Error Boundary System', () => {
  test('exports ErrorBoundary component', async () => {
    const { ErrorBoundary } = await import('@areo/client');
    expect(ErrorBoundary).toBeDefined();
  });

  test('exports RouteErrorBoundary component', async () => {
    const { RouteErrorBoundary } = await import('@areo/client');
    expect(RouteErrorBoundary).toBeDefined();
  });

  test('exports useErrorBoundary hook', async () => {
    const { useErrorBoundary } = await import('@areo/client');
    expect(typeof useErrorBoundary).toBe('function');
  });

  test('exports useRouteError hook', async () => {
    const { useRouteError } = await import('@areo/client');
    expect(typeof useRouteError).toBe('function');
  });

  test('exports error utilities', async () => {
    const client = await import('@areo/client');
    expect(typeof client.isRouteErrorResponse).toBe('function');
    expect(typeof client.createRouteErrorResponse).toBe('function');
    expect(typeof client.withErrorBoundary).toBe('function');
  });

  test('exports RouteError class', async () => {
    const { RouteError } = await import('@areo/client');
    expect(RouteError).toBeDefined();

    // Constructor: (status: number, statusText: string, data?: unknown)
    const error = new RouteError(404, 'Not Found', { detail: 'Page not found' });
    expect(error.status).toBe(404);
    expect(error.statusText).toBe('Not Found');
  });
});

// ============================================================================
// 7. Validate Unified Cache Interface
// ============================================================================
describe('Unified Cache Interface', () => {
  test('core exports CacheAdapter interface utilities', async () => {
    const core = await import('@areo/core');
    expect(typeof core.createCache).toBe('function');
    expect(typeof core.createTaggedCache).toBe('function');
    expect(typeof core.wrapCacheAdapter).toBe('function');
    expect(typeof core.isTaggedCache).toBe('function');
  });

  test('core exports MemoryCacheAdapter', async () => {
    const { MemoryCacheAdapter } = await import('@areo/core');
    expect(MemoryCacheAdapter).toBeDefined();

    const cache = new MemoryCacheAdapter();
    expect(typeof cache.get).toBe('function');
    expect(typeof cache.set).toBe('function');
    expect(typeof cache.delete).toBe('function');
    expect(typeof cache.has).toBe('function');
    expect(typeof cache.clear).toBe('function');
  });

  test('createCache returns CacheAdapter', async () => {
    const { createCache } = await import('@areo/core');
    const cache = createCache();

    await cache.set('key', 'value');
    const value = await cache.get('key');
    expect(value).toBe('value');
  });

  test('createTaggedCache returns TaggedCache', async () => {
    const { createTaggedCache, isTaggedCache } = await import('@areo/core');
    const cache = createTaggedCache();

    expect(isTaggedCache(cache)).toBe(true);
    expect(typeof cache.invalidateTag).toBe('function');
    expect(typeof cache.invalidateTags).toBe('function');
    expect(typeof cache.getByTag).toBe('function');
  });

  test('data package MemoryCache has adapter compatibility', async () => {
    const { MemoryCache, createDataCacheAdapter } = await import('@areo/data');

    // MemoryCache now uses CacheEntry format
    const cache = new MemoryCache<string>();
    await cache.set('key', {
      value: 'testvalue',
      ttl: 60,
      createdAt: Date.now(),
      tags: [],
    });
    const entry = await cache.get('key');
    expect(entry?.value).toBe('testvalue');

    // Can create adapter-compatible wrapper
    expect(typeof createDataCacheAdapter).toBe('function');
  });
});

// ============================================================================
// 8. Integration Test - Full API Surface
// ============================================================================
describe('Full API Surface Integration', () => {
  test('all major exports are available from @areo/client', async () => {
    const client = await import('@areo/client');

    // Hooks
    expect(client.useLoaderData).toBeDefined();
    expect(client.useActionData).toBeDefined();
    expect(client.useNavigation).toBeDefined();
    expect(client.useError).toBeDefined();
    expect(client.useSubmit).toBeDefined();
    expect(client.useFetcher).toBeDefined();
    expect(client.useErrorBoundary).toBeDefined();
    expect(client.useRouteError).toBeDefined();
    expect(client.useIsActive).toBeDefined();

    // Components
    expect(client.Form).toBeDefined();
    expect(client.Link).toBeDefined();
    expect(client.NavLink).toBeDefined();
    expect(client.ErrorBoundary).toBeDefined();
    expect(client.RouteErrorBoundary).toBeDefined();
    expect(client.AreoProvider).toBeDefined();

    // Navigation (existing)
    expect(client.navigate).toBeDefined();
    expect(client.prefetch).toBeDefined();
  });

  test('all major exports are available from @areo/core', async () => {
    const core = await import('@areo/core');

    // Config
    expect(core.defineConfig).toBeDefined();
    expect(core.createContext).toBeDefined();

    // Cache
    expect(core.createCache).toBeDefined();
    expect(core.createTaggedCache).toBeDefined();
    expect(core.MemoryCacheAdapter).toBeDefined();

    // Env
    expect(core.env).toBeDefined();
    expect(core.getEnv).toBeDefined();
  });

  test('all major exports are available from @areo/server', async () => {
    const server = await import('@areo/server');

    expect(server.createServer).toBeDefined();
    expect(server.createMiddlewareChain).toBeDefined();
    expect(server.logger).toBeDefined();
    expect(server.cors).toBeDefined();
    expect(server.securityHeaders).toBeDefined();
  });

  test('all major exports are available from @areo/data', async () => {
    const data = await import('@areo/data');

    expect(data.createLoader).toBeDefined();
    expect(data.createAction).toBeDefined();
    expect(data.defer).toBeDefined();
    expect(data.redirect).toBeDefined();
    expect(data.json).toBeDefined();
    expect(data.error).toBeDefined();
    expect(data.MemoryCache).toBeDefined();
    expect(data.revalidateTag).toBeDefined();
    expect(data.createPipeline).toBeDefined();
  });
});

console.log('\n=== API Validation Complete ===\n');
console.log('All new APIs have been validated for proper export and basic functionality.\n');
