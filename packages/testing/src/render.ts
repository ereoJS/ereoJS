/**
 * @oreo/testing - Component/Route Rendering
 *
 * Utilities for testing route components with their loaders.
 */

import type { ComponentType, ReactElement } from 'react';
import type { RouteParams, RouteComponentProps, LoaderFunction, RouteModule } from '@oreo/core';
import { createTestContext, type TestContextOptions, type TestContext } from './context';
import { createMockRequest, type MockRequestOptions } from './request';

/**
 * Options for rendering a route.
 */
export interface RenderRouteOptions<P = RouteParams> {
  /** Route parameters */
  params?: P;
  /** Request options */
  request?: MockRequestOptions;
  /** Context options */
  context?: TestContextOptions;
  /** Initial loader data (skip loader execution) */
  loaderData?: unknown;
  /** Children to render */
  children?: ReactElement;
}

/**
 * Result of rendering a route.
 */
export interface RenderResult<T = unknown> {
  /** The rendered element */
  element: ReactElement;
  /** The loader data used */
  loaderData: T;
  /** The test context */
  context: TestContext;
  /** The request used */
  request: Request;
  /** Props passed to the component */
  props: RouteComponentProps<T>;
}

/**
 * Render a route component with its loader data.
 *
 * @example
 * import { renderRoute } from '@oreo/testing';
 * import { default as BlogPost, loader } from './routes/blog/[slug]';
 *
 * test('renders blog post', async () => {
 *   const result = await renderRoute(
 *     { default: BlogPost, loader },
 *     { params: { slug: 'my-post' } }
 *   );
 *
 *   // Use with your testing library
 *   const { getByText } = render(result.element);
 *   expect(getByText('My Post')).toBeInTheDocument();
 * });
 */
export async function renderRoute<T = unknown, P = RouteParams>(
  module: RouteModule,
  options: RenderRouteOptions<P> = {}
): Promise<RenderResult<T>> {
  const request = createMockRequest(options.request);
  const context = createTestContext(options.context);
  const params = (options.params || {}) as P;

  // Get loader data
  let loaderData: T;

  if (options.loaderData !== undefined) {
    loaderData = options.loaderData as T;
  } else if (module.loader) {
    loaderData = await module.loader({ request, params: params as RouteParams, context }) as T;
  } else {
    loaderData = undefined as T;
  }

  // Get component
  const Component = module.default;
  if (!Component) {
    throw new Error('Route module has no default export');
  }

  // Build props
  const props: RouteComponentProps<T> = {
    loaderData,
    params: params as RouteParams,
    children: options.children,
  };

  // Create element (without React import to avoid SSR issues)
  const element = {
    type: Component,
    props,
    key: null,
  } as unknown as ReactElement;

  return {
    element,
    loaderData,
    context,
    request,
    props,
  };
}

/**
 * Create a reusable route renderer.
 *
 * @example
 * const renderBlogPost = createRouteRenderer(
 *   { default: BlogPost, loader },
 *   { context: { store: { user: testUser } } }
 * );
 *
 * test('renders for authenticated user', async () => {
 *   const result = await renderBlogPost({ params: { slug: 'test' } });
 *   // ...
 * });
 */
export function createRouteRenderer<T = unknown, P = RouteParams>(
  module: RouteModule,
  baseOptions: RenderRouteOptions<P> = {}
) {
  return async (overrides: Partial<RenderRouteOptions<P>> = {}): Promise<RenderResult<T>> => {
    return renderRoute(module, {
      ...baseOptions,
      ...overrides,
      params: { ...baseOptions.params, ...overrides.params } as P,
      request: { ...baseOptions.request, ...overrides.request },
      context: {
        ...baseOptions.context,
        ...overrides.context,
        store: { ...baseOptions.context?.store, ...overrides.context?.store },
        env: { ...baseOptions.context?.env, ...overrides.context?.env },
      },
    });
  };
}

/**
 * Render a standalone component with props.
 *
 * @example
 * const element = renderComponent(Counter, { count: 5 });
 */
export function renderComponent<P extends object>(
  Component: ComponentType<P>,
  props: P
): ReactElement {
  return {
    type: Component,
    props,
    key: null,
  } as unknown as ReactElement;
}

/**
 * Render a route with multiple param sets for snapshot testing.
 *
 * @example
 * const renders = await renderRouteMatrix(
 *   { default: BlogPost, loader },
 *   {
 *     params: [
 *       { slug: 'post-1' },
 *       { slug: 'post-2' },
 *     ],
 *   }
 * );
 *
 * renders.forEach((result, index) => {
 *   expect(result.element).toMatchSnapshot(`render-${index}`);
 * });
 */
export async function renderRouteMatrix<T = unknown, P = RouteParams>(
  module: RouteModule,
  options: {
    params: P[];
    request?: MockRequestOptions;
    context?: TestContextOptions;
  }
): Promise<RenderResult<T>[]> {
  return Promise.all(
    options.params.map((params) =>
      renderRoute(module, {
        params,
        request: options.request,
        context: options.context,
      })
    )
  );
}

/**
 * Test that a route renders without throwing.
 *
 * @example
 * test('renders without errors', async () => {
 *   const result = await testRouteRenders(
 *     { default: BlogPost, loader },
 *     { params: { slug: 'test' } }
 *   );
 *
 *   expect(result.renders).toBe(true);
 *   expect(result.error).toBeNull();
 * });
 */
export async function testRouteRenders<P = RouteParams>(
  module: RouteModule,
  options: RenderRouteOptions<P> = {}
): Promise<{
  renders: boolean;
  error: Error | null;
  result: RenderResult | null;
}> {
  try {
    const result = await renderRoute(module, options);
    return { renders: true, error: null, result };
  } catch (error) {
    return {
      renders: false,
      error: error instanceof Error ? error : new Error(String(error)),
      result: null,
    };
  }
}

/**
 * Get the meta tags for a route.
 *
 * @example
 * const meta = await getRouteMeta(
 *   { default: BlogPost, loader, meta: metaFn },
 *   { params: { slug: 'my-post' } }
 * );
 *
 * expect(meta.find(m => m.title)).toEqual({ title: 'My Post' });
 */
export async function getRouteMeta<P = RouteParams>(
  module: RouteModule,
  options: RenderRouteOptions<P> = {}
): Promise<ReturnType<NonNullable<RouteModule['meta']>>> {
  if (!module.meta) {
    return [];
  }

  const request = createMockRequest(options.request);
  const context = createTestContext(options.context);
  const params = (options.params || {}) as P;
  const url = new URL(request.url);

  // Get loader data
  let data: unknown;
  if (options.loaderData !== undefined) {
    data = options.loaderData;
  } else if (module.loader) {
    data = await module.loader({ request, params: params as RouteParams, context });
  }

  return module.meta({
    data,
    params: params as RouteParams,
    location: {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
    },
  });
}
