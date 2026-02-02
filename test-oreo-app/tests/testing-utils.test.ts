/**
 * Test: @oreo/testing Utilities
 *
 * Validates the testing package features:
 * - createTestContext
 * - testLoader
 * - testAction
 * - Request utilities
 */

import { describe, expect, test } from 'bun:test';
import {
  createTestContext,
  createContextFactory,
  createMockRequest,
  createFormRequest,
  testLoader,
  testAction,
} from '@oreo/testing';

describe('createTestContext', () => {
  test('creates context with default values', () => {
    const ctx = createTestContext();

    expect(ctx.url.toString()).toBe('http://localhost:3000/');
    expect(ctx.getStore()).toEqual({});
    expect(ctx.getCacheOperations()).toEqual([]);
  });

  test('creates context with custom URL', () => {
    const ctx = createTestContext({
      url: 'https://example.com/blog/my-post',
    });

    expect(ctx.url.pathname).toBe('/blog/my-post');
    expect(ctx.url.hostname).toBe('example.com');
  });

  test('creates context with pre-populated store', () => {
    const user = { id: 1, name: 'Test User' };
    const ctx = createTestContext({
      store: { user },
    });

    expect(ctx.get('user')).toEqual(user);
  });

  test('allows setting and getting values', () => {
    const ctx = createTestContext();

    ctx.set('myKey', { value: 42 });
    expect(ctx.get('myKey')).toEqual({ value: 42 });
  });

  test('tracks cache operations', () => {
    const ctx = createTestContext();

    ctx.cache.set({ maxAge: 3600, tags: ['posts'] });
    ctx.cache.get();

    const operations = ctx.getCacheOperations();
    expect(operations).toHaveLength(2);
    expect(operations[0].type).toBe('set');
    expect(operations[0].options?.maxAge).toBe(3600);
    expect(operations[1].type).toBe('get');
  });

  test('reset() restores initial state', () => {
    const ctx = createTestContext({
      store: { initial: 'value' },
    });

    ctx.set('added', 'new value');
    ctx.cache.set({ maxAge: 100 });

    ctx.reset();

    expect(ctx.get('added')).toBeUndefined();
    expect(ctx.get('initial')).toBe('value');
    expect(ctx.getCacheOperations()).toEqual([]);
  });
});

describe('createContextFactory', () => {
  test('creates factory with base options', () => {
    const factory = createContextFactory({
      store: { user: { id: 1 } },
      env: { API_URL: 'https://api.example.com' },
    });

    const ctx = factory();

    expect(ctx.get('user')).toEqual({ id: 1 });
    expect(ctx.env.API_URL).toBe('https://api.example.com');
  });

  test('factory allows overriding base options', () => {
    const factory = createContextFactory({
      store: { role: 'user' },
    });

    const ctx = factory({
      store: { role: 'admin' },
    });

    expect(ctx.get('role')).toBe('admin');
  });

  test('creates independent contexts', () => {
    const factory = createContextFactory();

    const ctx1 = factory();
    const ctx2 = factory();

    ctx1.set('key', 'ctx1-value');
    ctx2.set('key', 'ctx2-value');

    expect(ctx1.get('key')).toBe('ctx1-value');
    expect(ctx2.get('key')).toBe('ctx2-value');
  });
});

describe('Request Utilities', () => {
  test('createMockRequest creates basic request', () => {
    const request = createMockRequest('/api/users', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer token123' },
    });

    expect(request.url).toContain('/api/users');
    expect(request.method).toBe('GET');
    expect(request.headers.get('Authorization')).toBe('Bearer token123');
  });

  test('createFormRequest creates form data request', () => {
    const request = createFormRequest('/api/submit', {
      name: 'John',
      email: 'john@example.com',
    });

    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toContain('application/x-www-form-urlencoded');
  });
});

describe('testLoader', () => {
  test('executes loader and returns result', async () => {
    const loader = async () => ({
      message: 'Hello',
      timestamp: Date.now(),
    });

    const result = await testLoader(loader);

    expect(result.data.message).toBe('Hello');
    expect(result.data.timestamp).toBeDefined();
  });

  test('passes params to loader', async () => {
    const loader = async ({ params }: { params: { id: string } }) => ({
      id: params.id,
    });

    const result = await testLoader(loader, {
      params: { id: '123' },
    });

    expect(result.data.id).toBe('123');
  });

  test('provides context to loader via context options', async () => {
    const loader = async ({ context }: any) => ({
      user: context.get('user'),
    });

    const result = await testLoader(loader, {
      context: {
        store: { user: { id: 1, name: 'Test' } },
      },
    });

    expect(result.data.user).toEqual({ id: 1, name: 'Test' });
  });
});

describe('testAction', () => {
  test('executes action with form data', async () => {
    const action = async ({ request }: { request: Request }) => {
      const formData = await request.formData();
      return {
        received: formData.get('name'),
      };
    };

    const result = await testAction(action, {
      formData: { name: 'John' },
    });

    expect(result.data.received).toBe('John');
  });

  test('executes action with JSON body', async () => {
    const action = async ({ request }: { request: Request }) => {
      const body = await request.json();
      return { data: body };
    };

    const result = await testAction(action, {
      body: { key: 'value' },
    });

    expect(result.data.data).toEqual({ key: 'value' });
  });
});
