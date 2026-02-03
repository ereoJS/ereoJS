/**
 * @ereo/testing - Render Tests
 */

import { describe, expect, test } from 'bun:test';
import type { ComponentType, ReactElement } from 'react';
import type { RouteModule, LoaderFunction, RouteComponentProps, RouteParams } from '@ereo/core';
import {
  renderRoute,
  createRouteRenderer,
  renderComponent,
  renderRouteMatrix,
  testRouteRenders,
  getRouteMeta,
} from './render';

// Sample components and loaders for testing
const SimpleComponent = (props: RouteComponentProps<{ title: string }>) => {
  return { type: 'div', props: { children: props.loaderData?.title } } as unknown as ReactElement;
};

const simpleLoader: LoaderFunction<{ title: string }> = async ({ params }) => {
  return { title: `Post: ${(params as { slug?: string }).slug || 'default'}` };
};

const asyncLoader: LoaderFunction<{ data: string }> = async () => {
  await new Promise(resolve => setTimeout(resolve, 10));
  return { data: 'loaded' };
};

const errorLoader: LoaderFunction<never> = async () => {
  throw new Error('Loader error');
};

const metaFn = ({ data, params, location }: { data: unknown; params: RouteParams; location: { pathname: string; search: string; hash: string } }) => {
  const loaderData = data as { title?: string } | undefined;
  return [
    { title: loaderData?.title || 'Default Title' },
    { name: 'description', content: `Page at ${location.pathname}` },
    { property: 'og:title', content: loaderData?.title },
  ];
};

describe('renderRoute', () => {
  test('renders route with loader data', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const result = await renderRoute(module, {
      params: { slug: 'test-post' },
    });

    expect(result.loaderData).toEqual({ title: 'Post: test-post' });
    expect(result.element).toBeDefined();
    expect(result.element.type).toBe(SimpleComponent);
    expect(result.props.loaderData).toEqual({ title: 'Post: test-post' });
  });

  test('renders route without loader', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const result = await renderRoute(module);

    expect(result.loaderData).toBeUndefined();
    expect(result.element.type).toBe(SimpleComponent);
  });

  test('uses provided loaderData instead of calling loader', async () => {
    const loaderCalled = { value: false };
    const trackingLoader: LoaderFunction = async () => {
      loaderCalled.value = true;
      return { title: 'From Loader' };
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: trackingLoader,
    };

    const result = await renderRoute(module, {
      loaderData: { title: 'Provided Data' },
    });

    expect(loaderCalled.value).toBe(false);
    expect(result.loaderData).toEqual({ title: 'Provided Data' });
  });

  test('throws when module has no default export', async () => {
    const module: RouteModule = {
      loader: simpleLoader,
    } as RouteModule;

    await expect(renderRoute(module)).rejects.toThrow('Route module has no default export');
  });

  test('provides request to loader', async () => {
    let capturedRequest: Request | null = null;
    const capturingLoader: LoaderFunction = async ({ request }) => {
      capturedRequest = request;
      return {};
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: capturingLoader,
    };

    await renderRoute(module, {
      request: {
        url: '/test?query=value',
        headers: { 'X-Custom': 'header' },
      },
    });

    expect(capturedRequest?.url).toContain('/test');
    expect(capturedRequest?.headers.get('X-Custom')).toBe('header');
  });

  test('provides context to loader', async () => {
    let capturedEnv: Record<string, string> | null = null;
    const capturingLoader: LoaderFunction = async ({ context }) => {
      capturedEnv = context.env;
      return {};
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: capturingLoader,
    };

    await renderRoute(module, {
      context: {
        env: { API_URL: 'http://api.test.com' },
      },
    });

    expect(capturedEnv?.API_URL).toBe('http://api.test.com');
  });

  test('provides params to component props', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const result = await renderRoute(module, {
      params: { slug: 'my-slug', id: '123' },
    });

    expect(result.props.params).toEqual({ slug: 'my-slug', id: '123' });
  });

  test('provides children to component props', async () => {
    const childElement = { type: 'span', props: { children: 'child' }, key: null } as unknown as ReactElement;

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const result = await renderRoute(module, {
      children: childElement,
    });

    expect(result.props.children).toBe(childElement);
  });

  test('returns context from render', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const result = await renderRoute(module, {
      context: { store: { user: { id: 1 } } },
    });

    expect(result.context.get('user')).toEqual({ id: 1 });
  });

  test('returns request from render', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const result = await renderRoute(module, {
      request: { url: '/my-path', method: 'GET' },
    });

    expect(result.request.url).toContain('/my-path');
    expect(result.request.method).toBe('GET');
  });

  test('handles async loader', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: asyncLoader,
    };

    const result = await renderRoute(module);

    expect(result.loaderData).toEqual({ data: 'loaded' });
  });

  test('uses default empty params when not provided', async () => {
    let capturedParams: RouteParams | null = null;
    const paramLoader: LoaderFunction = async ({ params }) => {
      capturedParams = params;
      return {};
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: paramLoader,
    };

    await renderRoute(module);

    expect(capturedParams).toEqual({});
  });
});

describe('createRouteRenderer', () => {
  test('creates renderer with base options', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const render = createRouteRenderer(module, {
      context: { store: { user: { id: 1 } } },
    });

    const result = await render({ params: { slug: 'test' } });

    expect(result.loaderData).toEqual({ title: 'Post: test' });
    expect(result.context.get('user')).toEqual({ id: 1 });
  });

  test('overrides base params', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const render = createRouteRenderer(module, {
      params: { slug: 'base-slug' },
    });

    const result = await render({ params: { slug: 'override-slug' } });

    expect(result.loaderData).toEqual({ title: 'Post: override-slug' });
  });

  test('merges store values', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const render = createRouteRenderer(module, {
      context: { store: { base: 'value' } },
    });

    const result = await render({
      context: { store: { override: 'value' } },
    });

    expect(result.context.get('base')).toBe('value');
    expect(result.context.get('override')).toBe('value');
  });

  test('merges env values', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const render = createRouteRenderer(module, {
      context: { env: { BASE_URL: 'http://base.com' } },
    });

    const result = await render({
      context: { env: { API_KEY: 'key123' } },
    });

    expect(result.context.env.BASE_URL).toBe('http://base.com');
    expect(result.context.env.API_KEY).toBe('key123');
  });

  test('overrides request options', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const render = createRouteRenderer(module, {
      request: { url: '/base', headers: { 'X-Base': 'header' } },
    });

    const result = await render({
      request: { url: '/override' },
    });

    expect(result.request.url).toContain('/override');
  });

  test('works with empty overrides', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const render = createRouteRenderer(module, {
      params: { slug: 'default' },
    });

    const result = await render();

    expect(result.loaderData).toEqual({ title: 'Post: default' });
  });
});

describe('renderComponent', () => {
  test('renders component with props', () => {
    const Counter = ({ count }: { count: number }) => null;

    const element = renderComponent(Counter, { count: 5 });

    expect(element.type).toBe(Counter);
    expect(element.props).toEqual({ count: 5 });
  });

  test('sets key to null', () => {
    const Counter = ({ count }: { count: number }) => null;

    const element = renderComponent(Counter, { count: 10 });

    expect(element.key).toBeNull();
  });

  test('handles complex props', () => {
    interface ComplexProps {
      items: string[];
      onClick: () => void;
      nested: { a: number; b: string };
    }

    const ComplexComponent = (_props: ComplexProps) => null;
    const onClick = () => {};

    const element = renderComponent(ComplexComponent, {
      items: ['a', 'b', 'c'],
      onClick,
      nested: { a: 1, b: 'test' },
    });

    expect(element.props.items).toEqual(['a', 'b', 'c']);
    expect(element.props.onClick).toBe(onClick);
    expect(element.props.nested).toEqual({ a: 1, b: 'test' });
  });
});

describe('renderRouteMatrix', () => {
  test('renders route with multiple param sets', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const results = await renderRouteMatrix(module, {
      params: [
        { slug: 'post-1' },
        { slug: 'post-2' },
        { slug: 'post-3' },
      ],
    });

    expect(results.length).toBe(3);
    expect(results[0].loaderData).toEqual({ title: 'Post: post-1' });
    expect(results[1].loaderData).toEqual({ title: 'Post: post-2' });
    expect(results[2].loaderData).toEqual({ title: 'Post: post-3' });
  });

  test('uses shared request options', async () => {
    let requestCount = 0;
    const countingLoader: LoaderFunction = async ({ request }) => {
      requestCount++;
      return { method: request.method };
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: countingLoader,
    };

    const results = await renderRouteMatrix(module, {
      params: [{}, {}],
      request: { method: 'POST' },
    });

    expect(requestCount).toBe(2);
    expect(results[0].loaderData).toEqual({ method: 'POST' });
    expect(results[1].loaderData).toEqual({ method: 'POST' });
  });

  test('uses shared context options', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const results = await renderRouteMatrix(module, {
      params: [{}, {}],
      context: { store: { shared: 'value' } },
    });

    expect(results[0].context.get('shared')).toBe('value');
    expect(results[1].context.get('shared')).toBe('value');
  });

  test('returns results in order', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const results = await renderRouteMatrix(module, {
      params: [
        { slug: 'first' },
        { slug: 'second' },
        { slug: 'third' },
      ],
    });

    expect(results[0].props.params).toEqual({ slug: 'first' });
    expect(results[1].props.params).toEqual({ slug: 'second' });
    expect(results[2].props.params).toEqual({ slug: 'third' });
  });
});

describe('testRouteRenders', () => {
  test('returns true when route renders successfully', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const result = await testRouteRenders(module, {
      params: { slug: 'test' },
    });

    expect(result.renders).toBe(true);
    expect(result.error).toBeNull();
    expect(result.result).not.toBeNull();
    expect(result.result?.loaderData).toEqual({ title: 'Post: test' });
  });

  test('returns false when loader throws', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: errorLoader,
    };

    const result = await testRouteRenders(module);

    expect(result.renders).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Loader error');
    expect(result.result).toBeNull();
  });

  test('returns false when module has no default export', async () => {
    const module: RouteModule = {
      loader: simpleLoader,
    } as RouteModule;

    const result = await testRouteRenders(module);

    expect(result.renders).toBe(false);
    expect(result.error?.message).toBe('Route module has no default export');
    expect(result.result).toBeNull();
  });

  test('handles non-Error exceptions', async () => {
    const stringThrowingLoader: LoaderFunction = async () => {
      throw 'string error';
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: stringThrowingLoader,
    };

    const result = await testRouteRenders(module);

    expect(result.renders).toBe(false);
    expect(result.error?.message).toBe('string error');
  });

  test('works with empty options', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
    };

    const result = await testRouteRenders(module);

    expect(result.renders).toBe(true);
    expect(result.error).toBeNull();
  });
});

describe('getRouteMeta', () => {
  test('returns meta from meta function', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
      meta: metaFn,
    };

    const meta = await getRouteMeta(module, {
      params: { slug: 'test-post' },
    });

    expect(meta).toHaveLength(3);
    expect(meta[0]).toEqual({ title: 'Post: test-post' });
    expect(meta[1]).toEqual({ name: 'description', content: 'Page at /' });
    expect(meta[2]).toEqual({ property: 'og:title', content: 'Post: test-post' });
  });

  test('returns empty array when no meta function', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: simpleLoader,
    };

    const meta = await getRouteMeta(module, {
      params: { slug: 'test' },
    });

    expect(meta).toEqual([]);
  });

  test('uses provided loaderData', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      meta: metaFn,
    };

    const meta = await getRouteMeta(module, {
      loaderData: { title: 'Custom Title' },
    });

    expect(meta[0]).toEqual({ title: 'Custom Title' });
  });

  test('provides location to meta function', async () => {
    const locationCapturingMeta = ({ location }: { location: { pathname: string; search: string; hash: string } }) => {
      return [{ pathname: location.pathname, search: location.search, hash: location.hash }];
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      meta: locationCapturingMeta,
    };

    const meta = await getRouteMeta(module, {
      request: { url: '/blog/post?id=123#section' },
    });

    expect(meta[0]).toEqual({
      pathname: '/blog/post',
      search: '?id=123',
      hash: '#section',
    });
  });

  test('provides params to meta function', async () => {
    const paramsCapturingMeta = ({ params }: { params: RouteParams }) => {
      return [{ params }];
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      meta: paramsCapturingMeta,
    };

    const meta = await getRouteMeta(module, {
      params: { slug: 'test', id: '123' },
    });

    expect(meta[0]).toEqual({ params: { slug: 'test', id: '123' } });
  });

  test('handles meta with no loader data', async () => {
    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      meta: metaFn,
    };

    const meta = await getRouteMeta(module);

    expect(meta[0]).toEqual({ title: 'Default Title' });
  });

  test('calls loader to get data for meta', async () => {
    let loaderCalled = false;
    const trackingLoader: LoaderFunction = async () => {
      loaderCalled = true;
      return { title: 'From Loader' };
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      loader: trackingLoader,
      meta: metaFn,
    };

    const meta = await getRouteMeta(module);

    expect(loaderCalled).toBe(true);
    expect(meta[0]).toEqual({ title: 'From Loader' });
  });

  test('uses default empty params', async () => {
    let capturedParams: RouteParams | null = null;
    const paramMeta = ({ params }: { params: RouteParams }) => {
      capturedParams = params;
      return [];
    };

    const module: RouteModule = {
      default: SimpleComponent as unknown as ComponentType,
      meta: paramMeta,
    };

    await getRouteMeta(module);

    expect(capturedParams).toEqual({});
  });
});
