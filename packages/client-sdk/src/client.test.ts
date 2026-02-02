/**
 * @areo/client-sdk - Client tests
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  ApiClient,
  createClient,
  getGlobalClient,
  configureClient,
  api,
} from './client';

describe('ApiClient', () => {
  let mockFetch: typeof fetch;

  beforeEach(() => {
    mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
  });

  it('should create a client with default config', () => {
    const client = new ApiClient();
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('should create a client with custom config', () => {
    const client = new ApiClient({
      baseUrl: 'https://api.example.com',
      timeout: 5000,
      headers: { 'X-Custom': 'value' },
    });
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('should update configuration', () => {
    const client = new ApiClient();
    client.configure({ baseUrl: 'https://api.example.com' });
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('should make GET request', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.request({
      path: '/api/posts',
      method: 'GET',
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ success: true });
  });

  it('should make POST request with body', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.request({
      path: '/api/posts',
      method: 'POST',
      body: { title: 'Hello' },
    });

    expect(response.ok).toBe(true);
  });

  it('should make PUT request', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.request({
      path: '/api/posts/1',
      method: 'PUT',
      body: { title: 'Updated' },
    });

    expect(response.ok).toBe(true);
  });

  it('should make PATCH request', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.request({
      path: '/api/posts/1',
      method: 'PATCH',
      body: { title: 'Patched' },
    });

    expect(response.ok).toBe(true);
  });

  it('should make DELETE request', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.request({
      path: '/api/posts/1',
      method: 'DELETE',
    });

    expect(response.ok).toBe(true);
  });

  it('should replace path parameters', async () => {
    let capturedUrl = '';
    const customFetch = (url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    };

    const client = new ApiClient({ baseUrl: 'https://api.example.com', fetch: customFetch });
    await client.request({
      path: '/api/posts/[id]',
      method: 'GET',
      params: { id: '123' },
    });

    expect(capturedUrl).toBe('https://api.example.com/api/posts/123');
  });

  it('should add query parameters', async () => {
    let capturedUrl = '';
    const customFetch = (url: string) => {
      capturedUrl = url;
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    };

    const client = new ApiClient({ baseUrl: 'https://api.example.com', fetch: customFetch });
    await client.request({
      path: '/api/posts',
      method: 'GET',
      query: { limit: 10, offset: 20 },
    });

    expect(capturedUrl).toContain('limit=10');
    expect(capturedUrl).toContain('offset=20');
  });

  it('should use get() method', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.get('/api/posts', { query: { limit: 10 } });
    expect(response.ok).toBe(true);
  });

  it('should use post() method', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.post('/api/posts', { body: { title: 'Hello' } });
    expect(response.ok).toBe(true);
  });

  it('should use put() method', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.put('/api/posts/1', { body: { title: 'Updated' } });
    expect(response.ok).toBe(true);
  });

  it('should use patch() method', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.patch('/api/posts/1', { body: { title: 'Patched' } });
    expect(response.ok).toBe(true);
  });

  it('should use delete() method', async () => {
    const client = new ApiClient({ fetch: mockFetch });
    const response = await client.delete('/api/posts/1');
    expect(response.ok).toBe(true);
  });

  it('should merge default headers', async () => {
    let capturedHeaders: HeadersInit = {};
    const customFetch = (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers || {};
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    };

    const client = new ApiClient({
      fetch: customFetch,
      headers: { 'X-Default': 'value' },
    });

    await client.get('/api/posts', { headers: { 'X-Custom': 'other' } });

    const headers = capturedHeaders as Record<string, string>;
    expect(headers['X-Default']).toBe('value');
    expect(headers['X-Custom']).toBe('other');
  });

  it('should handle request interceptor', async () => {
    const client = new ApiClient({
      fetch: mockFetch,
      onRequest: (config) => {
        return {
          ...config,
          headers: { ...config.headers, 'X-Intercepted': 'true' },
        };
      },
    });

    const response = await client.get('/api/posts');
    expect(response.ok).toBe(true);
  });

  it('should handle response interceptor', async () => {
    const client = new ApiClient({
      fetch: mockFetch,
      onResponse: (response) => {
        return {
          ...response,
          data: { ...response.data, modified: true },
        };
      },
    });

    const response = await client.get('/api/posts');
    expect(response.data).toHaveProperty('modified');
  });

  it('should handle text responses', async () => {
    const textFetch = () =>
      Promise.resolve(
        new Response('Plain text response', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

    const client = new ApiClient({ fetch: textFetch });
    const response = await client.get('/api/posts');

    expect(response.data).toBe('Plain text response');
  });
});

describe('createClient', () => {
  it('should create a new client', () => {
    const client = createClient({ baseUrl: 'https://api.example.com' });
    expect(client).toBeInstanceOf(ApiClient);
  });
});

describe('getGlobalClient', () => {
  it('should return global client instance', () => {
    const client1 = getGlobalClient();
    const client2 = getGlobalClient();
    expect(client1).toBe(client2);
  });
});

describe('configureClient', () => {
  it('should configure global client', () => {
    configureClient({ baseUrl: 'https://api.example.com' });
    const client = getGlobalClient();
    expect(client).toBeInstanceOf(ApiClient);
  });
});

describe('api helper', () => {
  it('should provide api methods', () => {
    const postsApi = api('/api/posts');
    expect(typeof postsApi.get).toBe('function');
    expect(typeof postsApi.post).toBe('function');
    expect(typeof postsApi.put).toBe('function');
    expect(typeof postsApi.patch).toBe('function');
    expect(typeof postsApi.delete).toBe('function');
  });

  it('should call get method on global client', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    configureClient({ fetch: mockFetch, baseUrl: '' });

    const response = await api('/api/posts').get();
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ items: [] });
  });

  it('should call post method on global client', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    configureClient({ fetch: mockFetch, baseUrl: '' });

    const response = await api('/api/posts').post({ body: { title: 'Test' } });
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ id: 1 });
  });

  it('should call put method on global client', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ updated: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    configureClient({ fetch: mockFetch, baseUrl: '' });

    const response = await api('/api/posts/1').put({ body: { title: 'Updated' } });
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ updated: true });
  });

  it('should call patch method on global client', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ patched: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    configureClient({ fetch: mockFetch, baseUrl: '' });

    const response = await api('/api/posts/1').patch({ body: { title: 'Patched' } });
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ patched: true });
  });

  it('should call delete method on global client', async () => {
    const mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ deleted: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    configureClient({ fetch: mockFetch, baseUrl: '' });

    const response = await api('/api/posts/1').delete();
    expect(response.ok).toBe(true);
    expect(response.data).toEqual({ deleted: true });
  });
});

describe('ApiClient error handling', () => {
  it('should create API error with correct properties', async () => {
    const errorFetch = () => Promise.reject(new Error('Network error'));

    const client = new ApiClient({ fetch: errorFetch });

    try {
      await client.get('/api/posts');
      expect(true).toBe(false); // Should not reach here
    } catch (error: unknown) {
      const apiError = error as {
        message: string;
        status: number;
        path: string;
        method: string;
        name: string;
      };
      expect(apiError.message).toBe('Network error');
      expect(apiError.status).toBe(0);
      expect(apiError.path).toBe('/api/posts');
      expect(apiError.method).toBe('GET');
      expect(apiError.name).toBe('ApiError');
    }
  });

  it('should call onError callback when request fails', async () => {
    const errorFetch = () => Promise.reject(new Error('Connection refused'));
    let capturedError: unknown = null;

    const client = new ApiClient({
      fetch: errorFetch,
      onError: async (error) => {
        capturedError = error;
      },
    });

    try {
      await client.get('/api/data');
    } catch {
      // Expected to throw
    }

    expect(capturedError).not.toBeNull();
    const err = capturedError as { message: string; path: string };
    expect(err.message).toBe('Connection refused');
    expect(err.path).toBe('/api/data');
  });

  it('should set correct method in error for POST requests', async () => {
    const errorFetch = () => Promise.reject(new Error('Server error'));

    const client = new ApiClient({ fetch: errorFetch });

    try {
      await client.post('/api/items', { body: { name: 'test' } });
    } catch (error: unknown) {
      const apiError = error as { method: string };
      expect(apiError.method).toBe('POST');
    }
  });
});

describe('ApiClient request body handling', () => {
  it('should handle FormData body', async () => {
    let capturedInit: RequestInit | undefined;
    const customFetch = (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    };

    const client = new ApiClient({ fetch: customFetch });
    const formData = new FormData();
    formData.append('file', 'test');

    await client.request({
      path: '/api/upload',
      method: 'POST',
      body: formData,
    });

    expect(capturedInit?.body).toBe(formData);
    // Content-Type should not be set for FormData
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('should handle URLSearchParams body', async () => {
    let capturedInit: RequestInit | undefined;
    const customFetch = (_url: string, init?: RequestInit) => {
      capturedInit = init;
      return Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    };

    const client = new ApiClient({ fetch: customFetch });
    const params = new URLSearchParams();
    params.append('key', 'value');

    await client.request({
      path: '/api/form',
      method: 'POST',
      body: params,
    });

    expect(capturedInit?.body).toBe(params);
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });
});

describe('ApiClient debug mode', () => {
  it('should log requests when debug is enabled', async () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.join(' '));
    };

    const mockFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const client = new ApiClient({ fetch: mockFetch, debug: true });
    await client.get('/api/test');

    console.log = originalLog;

    expect(logs.some((log) => log.includes('[API]') && log.includes('GET') && log.includes('/api/test'))).toBe(
      true
    );
  });
});
