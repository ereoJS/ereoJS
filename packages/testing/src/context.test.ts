/**
 * @areo/testing - Context Tests
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
});
