/**
 * @ereo/testing - Context Tests
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { createTestContext, createContextFactory, type TestContext } from './context';

describe('createTestContext', () => {
  test('creates context with default values', () => {
    const ctx = createTestContext();

    expect(ctx.url.toString()).toBe('http://localhost:3000/');
    expect(ctx.getStore()).toEqual({});
    expect(ctx.getCacheOperations()).toEqual([]);
  });

  test('creates context with custom URL', () => {
    const ctx = createTestContext({
      url: 'https://example.com/blog/post-1',
    });

    expect(ctx.url.pathname).toBe('/blog/post-1');
    expect(ctx.url.hostname).toBe('example.com');
  });

  test('creates context with store values', () => {
    const user = { id: 1, name: 'Test User' };
    const ctx = createTestContext({
      store: { user },
    });

    expect(ctx.get('user')).toEqual(user);
    expect(ctx.getStore()).toEqual({ user });
  });

  test('creates context with env values', () => {
    const ctx = createTestContext({
      env: {
        DATABASE_URL: 'postgres://localhost/test',
        DEBUG: 'true',
      },
    });

    expect(ctx.env.DATABASE_URL).toBe('postgres://localhost/test');
    expect(ctx.env.DEBUG).toBe('true');
  });

  test('allows setting and getting values', () => {
    const ctx = createTestContext();

    ctx.set('myValue', { foo: 'bar' });
    expect(ctx.get('myValue')).toEqual({ foo: 'bar' });
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

  test('returns cache tags', () => {
    const ctx = createTestContext({ cacheTags: ['initial'] });

    ctx.cache.set({ tags: ['posts', 'user:1'] });

    expect(ctx.cache.getTags()).toContain('initial');
    expect(ctx.cache.getTags()).toContain('posts');
    expect(ctx.cache.getTags()).toContain('user:1');
  });

  test('resets to initial state', () => {
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

  test('creates context with URL object', () => {
    const urlObj = new URL('https://api.example.com/v1/users');
    const ctx = createTestContext({
      url: urlObj,
    });

    expect(ctx.url.pathname).toBe('/v1/users');
    expect(ctx.url.hostname).toBe('api.example.com');
  });

  test('creates context with response headers', () => {
    const ctx = createTestContext({
      responseHeaders: {
        'X-Custom-Header': 'custom-value',
        'Cache-Control': 'no-cache',
      },
    });

    expect(ctx.responseHeaders.get('X-Custom-Header')).toBe('custom-value');
    expect(ctx.responseHeaders.get('Cache-Control')).toBe('no-cache');
  });

  test('cache set without tags', () => {
    const ctx = createTestContext();

    ctx.cache.set({ maxAge: 3600 });

    const operations = ctx.getCacheOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0].options?.maxAge).toBe(3600);
    expect(ctx.cache.getTags()).toEqual([]);
  });

  test('resets cache tags and response headers', () => {
    const ctx = createTestContext({
      cacheTags: ['initial-tag'],
      responseHeaders: { 'X-Initial': 'value' },
    });

    ctx.cache.set({ tags: ['added-tag'] });
    ctx.responseHeaders.set('X-Added', 'new-value');

    ctx.reset();

    expect(ctx.cache.getTags()).toEqual(['initial-tag']);
    expect(ctx.responseHeaders.get('X-Initial')).toBe('value');
    expect(ctx.responseHeaders.get('X-Added')).toBeNull();
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

  test('allows overriding base options', () => {
    const factory = createContextFactory({
      store: { user: { id: 1, role: 'user' } },
    });

    const ctx = factory({
      store: { user: { id: 2, role: 'admin' } },
    });

    expect(ctx.get('user')).toEqual({ id: 2, role: 'admin' });
  });

  test('merges store values', () => {
    const factory = createContextFactory({
      store: { user: { id: 1 } },
    });

    const ctx = factory({
      store: { settings: { theme: 'dark' } },
    });

    expect(ctx.get('user')).toEqual({ id: 1 });
    expect(ctx.get('settings')).toEqual({ theme: 'dark' });
  });

  test('creates independent contexts', () => {
    const factory = createContextFactory();

    const ctx1 = factory();
    const ctx2 = factory();

    ctx1.set('value', 'ctx1');
    ctx2.set('value', 'ctx2');

    expect(ctx1.get('value')).toBe('ctx1');
    expect(ctx2.get('value')).toBe('ctx2');
  });

  test('merges env values', () => {
    const factory = createContextFactory({
      env: { BASE_URL: 'http://base.com' },
    });

    const ctx = factory({
      env: { API_KEY: 'key123' },
    });

    expect(ctx.env.BASE_URL).toBe('http://base.com');
    expect(ctx.env.API_KEY).toBe('key123');
  });

  test('merges response headers', () => {
    const factory = createContextFactory({
      responseHeaders: { 'X-Base': 'value' },
    });

    const ctx = factory({
      responseHeaders: { 'X-Override': 'new-value' },
    });

    expect(ctx.responseHeaders.get('X-Base')).toBe('value');
    expect(ctx.responseHeaders.get('X-Override')).toBe('new-value');
  });

  test('merges cache tags', () => {
    const factory = createContextFactory({
      cacheTags: ['base-tag'],
    });

    const ctx = factory({
      cacheTags: ['override-tag'],
    });

    expect(ctx.cache.getTags()).toContain('base-tag');
    expect(ctx.cache.getTags()).toContain('override-tag');
  });
});
