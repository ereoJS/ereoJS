/**
 * @ereo/testing - Loader Tests
 */

import { describe, expect, test } from 'bun:test';
import type { LoaderFunction } from '@ereo/core';
import {
  testLoader,
  createLoaderTester,
  testLoadersParallel,
  testLoaderMatrix,
  testLoaderError,
} from './loader';

// Sample loaders for testing
const simpleLoader: LoaderFunction<{ message: string }> = async () => {
  return { message: 'Hello World' };
};

const paramLoader: LoaderFunction<{ slug: string }> = async ({ params }) => {
  return { slug: (params as { slug?: string }).slug || 'default' };
};

const requestLoader: LoaderFunction<{ method: string; url: string }> = async ({ request }) => {
  return {
    method: request.method,
    url: request.url,
  };
};

const contextLoader: LoaderFunction<{ user: unknown; env: string }> = async ({ context }) => {
  return {
    user: context.get('user'),
    env: context.env.API_URL || 'not-set',
  };
};

const asyncLoader: LoaderFunction<{ delayed: boolean }> = async () => {
  await new Promise(resolve => setTimeout(resolve, 10));
  return { delayed: true };
};

const errorLoader: LoaderFunction<never> = async () => {
  throw new Error('Loader failed');
};

const conditionalErrorLoader: LoaderFunction<{ found: boolean }> = async ({ params }) => {
  if ((params as { id?: string }).id === 'not-found') {
    throw new Error('Not found');
  }
  return { found: true };
};

describe('testLoader', () => {
  test('tests simple loader', async () => {
    const result = await testLoader(simpleLoader);

    expect(result.data).toEqual({ message: 'Hello World' });
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  test('provides params to loader', async () => {
    const result = await testLoader(paramLoader, {
      params: { slug: 'test-slug' },
    });

    expect(result.data).toEqual({ slug: 'test-slug' });
  });

  test('provides request to loader', async () => {
    const result = await testLoader(requestLoader, {
      request: {
        url: '/api/data',
        method: 'GET',
      },
    });

    expect(result.data.method).toBe('GET');
    expect(result.data.url).toContain('/api/data');
  });

  test('provides context to loader', async () => {
    const result = await testLoader(contextLoader, {
      context: {
        store: { user: { id: 1, name: 'Test' } },
        env: { API_URL: 'http://api.test.com' },
      },
    });

    expect(result.data.user).toEqual({ id: 1, name: 'Test' });
    expect(result.data.env).toBe('http://api.test.com');
  });

  test('returns context for inspection', async () => {
    const result = await testLoader(simpleLoader, {
      context: {
        store: { initial: 'value' },
      },
    });

    expect(result.context.get('initial')).toBe('value');
    expect(result.context.getStore()).toEqual({ initial: 'value' });
  });

  test('returns request object', async () => {
    const result = await testLoader(simpleLoader, {
      request: {
        url: '/test',
        headers: { 'X-Custom': 'header' },
      },
    });

    expect(result.request.url).toContain('/test');
    expect(result.request.headers.get('X-Custom')).toBe('header');
  });

  test('measures duration', async () => {
    const result = await testLoader(asyncLoader);

    expect(result.duration).toBeGreaterThanOrEqual(10);
  });

  test('works with empty options', async () => {
    const result = await testLoader(simpleLoader);

    expect(result.data).toEqual({ message: 'Hello World' });
  });

  test('uses default empty params', async () => {
    let capturedParams: unknown;
    const captureLoader: LoaderFunction = async ({ params }) => {
      capturedParams = params;
      return {};
    };

    await testLoader(captureLoader);

    expect(capturedParams).toEqual({});
  });

  test('provides request with search params', async () => {
    const result = await testLoader(requestLoader, {
      request: {
        url: '/api/search',
        searchParams: { q: 'test', page: '1' },
      },
    });

    expect(result.data.url).toContain('q=test');
    expect(result.data.url).toContain('page=1');
  });

  test('provides request with cookies', async () => {
    let capturedCookie: string | null = null;
    const cookieLoader: LoaderFunction = async ({ request }) => {
      capturedCookie = request.headers.get('Cookie');
      return {};
    };

    await testLoader(cookieLoader, {
      request: {
        cookies: { session: 'abc123', theme: 'dark' },
      },
    });

    expect(capturedCookie).toContain('session=abc123');
    expect(capturedCookie).toContain('theme=dark');
  });
});

describe('createLoaderTester', () => {
  test('creates tester with base options', async () => {
    const testMyLoader = createLoaderTester(contextLoader, {
      context: {
        store: { user: { id: 1 } },
        env: { API_URL: 'http://base.com' },
      },
    });

    const result = await testMyLoader();

    expect(result.data.user).toEqual({ id: 1 });
    expect(result.data.env).toBe('http://base.com');
  });

  test('overrides base params', async () => {
    const testMyLoader = createLoaderTester(paramLoader, {
      params: { slug: 'base-slug' },
    });

    const result = await testMyLoader({
      params: { slug: 'override-slug' },
    });

    expect(result.data).toEqual({ slug: 'override-slug' });
  });

  test('merges store values', async () => {
    const testMyLoader = createLoaderTester(contextLoader, {
      context: { store: { user: { id: 1 } } },
    });

    const result = await testMyLoader({
      context: { store: { extra: 'value' } },
    });

    expect(result.context.get('user')).toEqual({ id: 1 });
    expect(result.context.get('extra')).toBe('value');
  });

  test('merges env values', async () => {
    const testMyLoader = createLoaderTester(contextLoader, {
      context: { env: { API_URL: 'http://base.com' } },
    });

    const result = await testMyLoader({
      context: { env: { OTHER_VAR: 'value' } },
    });

    expect(result.data.env).toBe('http://base.com');
    expect(result.context.env.OTHER_VAR).toBe('value');
  });

  test('merges request options', async () => {
    const testMyLoader = createLoaderTester(requestLoader, {
      request: { url: '/base' },
    });

    const result = await testMyLoader({
      request: { method: 'POST' },
    });

    expect(result.data.method).toBe('POST');
  });

  test('works with empty overrides', async () => {
    const testMyLoader = createLoaderTester(paramLoader, {
      params: { slug: 'default' },
    });

    const result = await testMyLoader();

    expect(result.data).toEqual({ slug: 'default' });
  });
});

describe('testLoadersParallel', () => {
  test('tests multiple loaders in parallel', async () => {
    const results = await testLoadersParallel([
      { loader: simpleLoader },
      { loader: paramLoader, params: { slug: 'test' } },
    ]);

    expect(results.length).toBe(2);
    expect(results[0].data).toEqual({ message: 'Hello World' });
    expect(results[1].data).toEqual({ slug: 'test' });
  });

  test('each loader gets its own options', async () => {
    const results = await testLoadersParallel([
      {
        loader: contextLoader,
        context: { store: { user: 'user1' }, env: { API_URL: 'url1' } },
      },
      {
        loader: contextLoader,
        context: { store: { user: 'user2' }, env: { API_URL: 'url2' } },
      },
    ]);

    expect(results[0].data).toEqual({ user: 'user1', env: 'url1' });
    expect(results[1].data).toEqual({ user: 'user2', env: 'url2' });
  });

  test('returns results in order', async () => {
    const delayLoader = (delay: number): LoaderFunction<{ delay: number }> => async () => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return { delay };
    };

    const results = await testLoadersParallel([
      { loader: delayLoader(20) },
      { loader: delayLoader(10) },
      { loader: delayLoader(5) },
    ]);

    // Results should be in the order they were submitted, not completion order
    expect(results[0].data.delay).toBe(20);
    expect(results[1].data.delay).toBe(10);
    expect(results[2].data.delay).toBe(5);
  });

  test('handles mixed request options', async () => {
    const results = await testLoadersParallel([
      { loader: requestLoader, request: { url: '/path1', method: 'GET' } },
      { loader: requestLoader, request: { url: '/path2', method: 'POST' } },
    ]);

    expect(results[0].data.method).toBe('GET');
    expect(results[0].data.url).toContain('/path1');
    expect(results[1].data.method).toBe('POST');
    expect(results[1].data.url).toContain('/path2');
  });
});

describe('testLoaderMatrix', () => {
  test('tests loader with multiple param combinations', async () => {
    const results = await testLoaderMatrix(paramLoader, {
      params: [
        { slug: 'post-1' },
        { slug: 'post-2' },
        { slug: 'post-3' },
      ],
    });

    expect(results.length).toBe(3);
    expect(results[0].data).toEqual({ slug: 'post-1' });
    expect(results[1].data).toEqual({ slug: 'post-2' });
    expect(results[2].data).toEqual({ slug: 'post-3' });
  });

  test('uses shared request options', async () => {
    const results = await testLoaderMatrix(requestLoader, {
      params: [{}, {}],
      request: { method: 'POST' },
    });

    expect(results[0].data.method).toBe('POST');
    expect(results[1].data.method).toBe('POST');
  });

  test('uses shared context options', async () => {
    const results = await testLoaderMatrix(contextLoader, {
      params: [{}, {}],
      context: {
        store: { user: 'shared' },
        env: { API_URL: 'http://shared.com' },
      },
    });

    expect(results[0].data.user).toBe('shared');
    expect(results[1].data.user).toBe('shared');
  });

  test('returns results in order', async () => {
    interface ParamType {
      id: string;
    }
    const idLoader: LoaderFunction<{ id: string }, ParamType> = async ({ params }) => {
      return { id: params.id };
    };

    const results = await testLoaderMatrix(idLoader, {
      params: [
        { id: 'first' },
        { id: 'second' },
        { id: 'third' },
      ],
    });

    expect(results[0].data.id).toBe('first');
    expect(results[1].data.id).toBe('second');
    expect(results[2].data.id).toBe('third');
  });

  test('handles empty params array', async () => {
    const results = await testLoaderMatrix(simpleLoader, {
      params: [],
    });

    expect(results.length).toBe(0);
  });
});

describe('testLoaderError', () => {
  test('catches loader errors', async () => {
    const result = await testLoaderError(errorLoader);

    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('Loader failed');
  });

  test('returns null error when no error occurs', async () => {
    const result = await testLoaderError(simpleLoader);

    expect(result.error).toBeNull();
  });

  test('returns context even on error', async () => {
    const result = await testLoaderError(errorLoader, {
      context: { store: { initial: 'value' } },
    });

    expect(result.context.get('initial')).toBe('value');
  });

  test('returns request even on error', async () => {
    const result = await testLoaderError(errorLoader, {
      request: { url: '/test' },
    });

    expect(result.request.url).toContain('/test');
  });

  test('handles conditional errors', async () => {
    const successResult = await testLoaderError(conditionalErrorLoader, {
      params: { id: 'valid' },
    });
    const errorResult = await testLoaderError(conditionalErrorLoader, {
      params: { id: 'not-found' },
    });

    expect(successResult.error).toBeNull();
    expect(errorResult.error?.message).toBe('Not found');
  });

  test('handles non-Error throws', async () => {
    const stringThrowLoader: LoaderFunction = async () => {
      throw 'string error';
    };

    const result = await testLoaderError(stringThrowLoader);

    expect(result.error?.message).toBe('string error');
  });

  test('provides params to loader', async () => {
    const result = await testLoaderError(conditionalErrorLoader, {
      params: { id: 'not-found' },
    });

    expect(result.error?.message).toBe('Not found');
  });

  test('provides context to loader', async () => {
    const contextErrorLoader: LoaderFunction = async ({ context }) => {
      if (!context.get('user')) {
        throw new Error('No user');
      }
      return {};
    };

    const errorResult = await testLoaderError(contextErrorLoader);
    const successResult = await testLoaderError(contextErrorLoader, {
      context: { store: { user: { id: 1 } } },
    });

    expect(errorResult.error?.message).toBe('No user');
    expect(successResult.error).toBeNull();
  });
});
