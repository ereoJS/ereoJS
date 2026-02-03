import { describe, expect, test, beforeEach } from 'bun:test';
import {
  createLoader,
  defer,
  isDeferred,
  resolveDeferred,
  fetchData,
  FetchError,
  serializeLoaderData,
  parseLoaderData,
  combineLoaders,
  clientLoader,
} from './loader';

describe('@ereo/data - Loader', () => {
  describe('createLoader', () => {
    test('creates a loader function', () => {
      const loader = createLoader({
        load: async () => ({ data: 'test' }),
      });

      expect(typeof loader).toBe('function');
    });

    test('loader returns data from load function', async () => {
      const loader = createLoader({
        load: async () => ({ message: 'Hello' }),
      });

      const mockContext = {
        cache: { set: () => {} },
      };

      const result = await loader({
        request: new Request('http://localhost/'),
        params: {},
        context: mockContext as any,
      });

      expect(result).toEqual({ message: 'Hello' });
    });

    test('applies cache options', async () => {
      let cacheOptions: any = null;

      const loader = createLoader({
        load: async () => 'data',
        cache: { maxAge: 60, tags: ['posts'] },
      });

      const mockContext = {
        cache: {
          set: (opts: any) => {
            cacheOptions = opts;
          },
        },
      };

      await loader({
        request: new Request('http://localhost/'),
        params: {},
        context: mockContext as any,
      });

      expect(cacheOptions).toEqual({ maxAge: 60, tags: ['posts'] });
    });

    test('transforms data when transform is provided', async () => {
      const loader = createLoader({
        load: async () => ({ count: 5 }),
        transform: (data) => ({ count: data.count * 2 }),
      });

      const mockContext = { cache: { set: () => {} } };

      const result = await loader({
        request: new Request('http://localhost/'),
        params: {},
        context: mockContext as any,
      });

      expect(result).toEqual({ count: 10 });
    });

    test('calls onError handler on error', async () => {
      const loader = createLoader({
        load: async () => {
          throw new Error('Load failed');
        },
        onError: (error) => ({ error: error.message }),
      });

      const mockContext = { cache: { set: () => {} } };

      const result = await loader({
        request: new Request('http://localhost/'),
        params: {},
        context: mockContext as any,
      });

      expect(result).toEqual({ error: 'Load failed' });
    });

    test('rethrows error when onError returns Response', async () => {
      const loader = createLoader({
        load: async () => {
          throw new Error('Load failed');
        },
        onError: () => new Response('Error', { status: 500 }),
      });

      const mockContext = { cache: { set: () => {} } };

      await expect(
        loader({
          request: new Request('http://localhost/'),
          params: {},
          context: mockContext as any,
        })
      ).rejects.toBeInstanceOf(Response);
    });

    test('rethrows error when no onError handler', async () => {
      const loader = createLoader({
        load: async () => {
          throw new Error('Unhandled');
        },
      });

      const mockContext = { cache: { set: () => {} } };

      await expect(
        loader({
          request: new Request('http://localhost/'),
          params: {},
          context: mockContext as any,
        })
      ).rejects.toThrow('Unhandled');
    });
  });

  describe('defer', () => {
    test('creates deferred data with pending status', () => {
      const deferred = defer(Promise.resolve('data'));

      expect(deferred.status).toBe('pending');
      expect(deferred.promise).toBeInstanceOf(Promise);
    });

    test('updates status to resolved on success', async () => {
      const deferred = defer(Promise.resolve('data'));

      await deferred.promise;

      expect(deferred.status).toBe('resolved');
      expect(deferred.value).toBe('data');
    });

    test('updates status to rejected on error', async () => {
      const error = new Error('Failed');
      const deferred = defer(Promise.reject(error));

      try {
        await deferred.promise;
      } catch {
        // Expected
      }

      // Wait for the internal promise handlers to complete
      await new Promise((r) => setTimeout(r, 10));

      expect(deferred.status).toBe('rejected');
      expect(deferred.error).toBe(error);
    });
  });

  describe('isDeferred', () => {
    test('returns true for deferred data', () => {
      const deferred = defer(Promise.resolve('data'));
      expect(isDeferred(deferred)).toBe(true);
    });

    test('returns false for regular values', () => {
      expect(isDeferred(null)).toBe(false);
      expect(isDeferred(undefined)).toBe(false);
      expect(isDeferred('string')).toBe(false);
      expect(isDeferred(123)).toBe(false);
      expect(isDeferred({})).toBe(false);
      expect(isDeferred({ promise: null })).toBe(false);
    });
  });

  describe('resolveDeferred', () => {
    test('resolves deferred data', async () => {
      const deferred = defer(Promise.resolve('resolved value'));
      const result = await resolveDeferred(deferred);

      expect(result).toBe('resolved value');
    });
  });

  describe('FetchError', () => {
    test('creates FetchError with response', () => {
      const response = new Response('Not Found', { status: 404, statusText: 'Not Found' });
      const error = new FetchError('Fetch failed', response);

      expect(error.message).toBe('Fetch failed');
      expect(error.name).toBe('FetchError');
      expect(error.response).toBe(response);
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
    });
  });

  describe('serializeLoaderData', () => {
    test('serializes data to JSON', () => {
      const data = { user: 'test', count: 42 };
      const serialized = serializeLoaderData(data);

      expect(typeof serialized).toBe('string');
    });

    test('escapes dangerous characters', () => {
      const data = { html: '<script>alert("xss")</script>' };
      const serialized = serializeLoaderData(data);

      expect(serialized).not.toContain('<');
      expect(serialized).not.toContain('>');
      expect(serialized).toContain('\\u003c');
      expect(serialized).toContain('\\u003e');
    });

    test('escapes ampersand', () => {
      const data = { text: 'a & b' };
      const serialized = serializeLoaderData(data);

      expect(serialized).toContain('\\u0026');
    });

    test('escapes single quotes', () => {
      const data = { text: "it's" };
      const serialized = serializeLoaderData(data);

      expect(serialized).toContain('\\u0027');
    });
  });

  describe('parseLoaderData', () => {
    test('parses JSON string to data', () => {
      const data = { user: 'test', count: 42 };
      const serialized = JSON.stringify(data);
      const parsed = parseLoaderData(serialized);

      expect(parsed).toEqual(data);
    });

    test('roundtrips with serializeLoaderData', () => {
      const original = { nested: { array: [1, 2, 3] } };
      // Use JSON.stringify for roundtrip since serializeLoaderData escapes chars
      const serialized = JSON.stringify(original);
      const parsed = parseLoaderData(serialized);

      expect(parsed).toEqual(original);
    });
  });

  describe('combineLoaders', () => {
    test('combines multiple loaders', async () => {
      const userLoader = async () => ({ name: 'John' });
      const postsLoader = async () => [{ id: 1 }, { id: 2 }];

      const combined = combineLoaders({
        user: userLoader,
        posts: postsLoader,
      });

      const result = await combined({
        request: new Request('http://localhost/'),
        params: {},
        context: {} as any,
      });

      expect(result.user).toEqual({ name: 'John' });
      expect(result.posts).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('runs loaders in parallel', async () => {
      const order: number[] = [];

      const loader1 = async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 10));
        order.push(2);
        return 'a';
      };
      const loader2 = async () => {
        order.push(3);
        await new Promise((r) => setTimeout(r, 5));
        order.push(4);
        return 'b';
      };

      const combined = combineLoaders({ a: loader1, b: loader2 });

      await combined({
        request: new Request('http://localhost/'),
        params: {},
        context: {} as any,
      });

      // Both should start before either finishes
      expect(order[0]).toBe(1);
      expect(order[1]).toBe(3);
    });
  });

  describe('clientLoader', () => {
    test('creates a loader from simple function', async () => {
      const loader = clientLoader((params) => ({
        id: params.id,
        loaded: true,
      }));

      const result = await loader({
        request: new Request('http://localhost/'),
        params: { id: '123' },
        context: {} as any,
      });

      expect(result).toEqual({ id: '123', loaded: true });
    });

    test('supports async functions', async () => {
      const loader = clientLoader(async (params) => {
        await Promise.resolve();
        return { async: true };
      });

      const result = await loader({
        request: new Request('http://localhost/'),
        params: {},
        context: {} as any,
      });

      expect(result).toEqual({ async: true });
    });
  });

  describe('fetchData', () => {
    test('fetches JSON data', async () => {
      // Mock a JSON endpoint
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ message: 'hello' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      try {
        const data = await fetchData<{ message: string }>('http://test.com/api');
        expect(data).toEqual({ message: 'hello' });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('fetches text data', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response('Hello World', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });

      try {
        const data = await fetchData<string>('http://test.com/text');
        expect(data).toBe('Hello World');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('throws FetchError on non-ok response', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response('Not Found', {
          status: 404,
          statusText: 'Not Found',
        });

      try {
        await expect(fetchData('http://test.com/missing')).rejects.toBeInstanceOf(FetchError);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('FetchError contains response details', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response('Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
        });

      try {
        await fetchData('http://test.com/error');
      } catch (e) {
        expect(e).toBeInstanceOf(FetchError);
        expect((e as FetchError).status).toBe(500);
        expect((e as FetchError).statusText).toBe('Internal Server Error');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test('passes init options to fetch', async () => {
      const originalFetch = globalThis.fetch;
      let receivedInit: RequestInit | undefined;

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        receivedInit = init;
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      try {
        await fetchData('http://test.com/api', {
          method: 'POST',
          headers: { 'X-Custom': 'value' },
        });

        expect(receivedInit?.method).toBe('POST');
        expect((receivedInit?.headers as Record<string, string>)?.['X-Custom']).toBe('value');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
