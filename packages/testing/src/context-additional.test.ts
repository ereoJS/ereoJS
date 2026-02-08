/**
 * @ereo/testing - Additional Context Tests
 *
 * Edge cases for cache.addTags, cache get/set sequencing,
 * context factory deep merging, and reset behavior.
 */

import { describe, expect, test } from 'bun:test';
import { createTestContext, createContextFactory } from './context';

describe('createTestContext - cache.addTags', () => {
  test('adds tags to empty tag set', () => {
    const ctx = createTestContext();
    ctx.cache.addTags(['post:1', 'post:2']);

    expect(ctx.cache.getTags()).toContain('post:1');
    expect(ctx.cache.getTags()).toContain('post:2');
  });

  test('adds tags to existing initial tags', () => {
    const ctx = createTestContext({ cacheTags: ['global'] });
    ctx.cache.addTags(['user:1']);

    const tags = ctx.cache.getTags();
    expect(tags).toContain('global');
    expect(tags).toContain('user:1');
  });

  test('deduplicates tags added via addTags', () => {
    const ctx = createTestContext({ cacheTags: ['tag-a'] });
    ctx.cache.addTags(['tag-a', 'tag-b']);

    const tags = ctx.cache.getTags();
    const tagACounts = tags.filter(t => t === 'tag-a').length;
    expect(tagACounts).toBe(1);
    expect(tags).toContain('tag-b');
  });

  test('deduplicates tags added via cache.set', () => {
    const ctx = createTestContext();
    ctx.cache.set({ tags: ['x'] });
    ctx.cache.set({ tags: ['x', 'y'] });

    const tags = ctx.cache.getTags();
    const xCount = tags.filter(t => t === 'x').length;
    expect(xCount).toBe(1);
    expect(tags).toContain('y');
  });

  test('addTags with empty array does not change tags', () => {
    const ctx = createTestContext({ cacheTags: ['existing'] });
    ctx.cache.addTags([]);

    expect(ctx.cache.getTags()).toEqual(['existing']);
  });
});

describe('createTestContext - cache get/set sequencing', () => {
  test('get returns undefined before any set', () => {
    const ctx = createTestContext();
    const result = ctx.cache.get();
    expect(result).toBeUndefined();
  });

  test('get returns the last set options', () => {
    const ctx = createTestContext();
    ctx.cache.set({ maxAge: 100 });
    ctx.cache.set({ maxAge: 200, tags: ['updated'] });

    const result = ctx.cache.get();
    expect(result?.maxAge).toBe(200);
  });

  test('cache operations are recorded with timestamps', () => {
    const ctx = createTestContext();
    const before = Date.now();
    ctx.cache.set({ maxAge: 60 });
    ctx.cache.get();
    const after = Date.now();

    const ops = ctx.getCacheOperations();
    expect(ops).toHaveLength(2);
    expect(ops[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(ops[0].timestamp).toBeLessThanOrEqual(after);
    expect(ops[1].timestamp).toBeGreaterThanOrEqual(before);
    expect(ops[1].timestamp).toBeLessThanOrEqual(after);
  });

  test('set operations record a copy of options', () => {
    const ctx = createTestContext();
    const opts = { maxAge: 300, tags: ['a', 'b'] };
    ctx.cache.set(opts);

    const ops = ctx.getCacheOperations();
    expect(ops[0].options).toEqual({ maxAge: 300, tags: ['a', 'b'] });

    // Mutating original opts should not affect recorded operation
    opts.maxAge = 999;
    expect(ops[0].options?.maxAge).toBe(300);
  });

  test('getCacheOperations returns a copy', () => {
    const ctx = createTestContext();
    ctx.cache.set({ maxAge: 1 });

    const ops1 = ctx.getCacheOperations();
    const ops2 = ctx.getCacheOperations();
    expect(ops1).toEqual(ops2);
    expect(ops1).not.toBe(ops2); // different reference
  });
});

describe('createTestContext - store operations', () => {
  test('set overwrites existing values', () => {
    const ctx = createTestContext({ store: { key: 'original' } });
    ctx.set('key', 'updated');
    expect(ctx.get('key')).toBe('updated');
  });

  test('get returns undefined for nonexistent keys', () => {
    const ctx = createTestContext();
    expect(ctx.get('nonexistent')).toBeUndefined();
  });

  test('getStore returns snapshot of all values', () => {
    const ctx = createTestContext();
    ctx.set('a', 1);
    ctx.set('b', 2);
    ctx.set('c', 3);

    const store = ctx.getStore();
    expect(store).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('getStore returns empty object for empty context', () => {
    const ctx = createTestContext();
    expect(ctx.getStore()).toEqual({});
  });

  test('typed get preserves type', () => {
    const ctx = createTestContext();
    ctx.set('user', { id: 1, name: 'Test' });

    const user = ctx.get<{ id: number; name: string }>('user');
    expect(user?.id).toBe(1);
    expect(user?.name).toBe('Test');
  });
});

describe('createTestContext - reset behavior', () => {
  test('reset restores initial store values but removes added values', () => {
    const ctx = createTestContext({
      store: { initial: 'value' },
    });

    ctx.set('initial', 'changed');
    ctx.set('extra', 'new');

    ctx.reset();

    expect(ctx.get('initial')).toBe('value');
    expect(ctx.get('extra')).toBeUndefined();
  });

  test('reset clears cache operations', () => {
    const ctx = createTestContext();
    ctx.cache.set({ maxAge: 100 });
    ctx.cache.get();

    expect(ctx.getCacheOperations()).toHaveLength(2);

    ctx.reset();
    expect(ctx.getCacheOperations()).toHaveLength(0);
  });

  test('reset restores initial cache tags', () => {
    const ctx = createTestContext({ cacheTags: ['init-tag'] });
    ctx.cache.addTags(['added-tag']);

    ctx.reset();

    const tags = ctx.cache.getTags();
    expect(tags).toContain('init-tag');
    expect(tags).not.toContain('added-tag');
  });

  test('reset restores initial response headers', () => {
    const ctx = createTestContext({
      responseHeaders: { 'X-Initial': 'yes' },
    });

    ctx.responseHeaders.set('X-Added', 'also');
    ctx.responseHeaders.set('X-Initial', 'changed');

    ctx.reset();

    expect(ctx.responseHeaders.get('X-Initial')).toBe('yes');
    expect(ctx.responseHeaders.get('X-Added')).toBeNull();
  });

  test('reset with no initial options results in clean state', () => {
    const ctx = createTestContext();
    ctx.set('key', 'value');
    ctx.cache.set({ maxAge: 60, tags: ['tag'] });
    ctx.responseHeaders.set('X-Header', 'val');

    ctx.reset();

    expect(ctx.getStore()).toEqual({});
    expect(ctx.getCacheOperations()).toEqual([]);
    expect(ctx.cache.getTags()).toEqual([]);
    expect(ctx.responseHeaders.get('X-Header')).toBeNull();
  });

  test('can use context normally after reset', () => {
    const ctx = createTestContext({ store: { base: true } });
    ctx.reset();

    ctx.set('newKey', 'newVal');
    ctx.cache.set({ maxAge: 30 });

    expect(ctx.get('newKey')).toBe('newVal');
    expect(ctx.get('base')).toBe(true);
    expect(ctx.getCacheOperations()).toHaveLength(1);
  });
});

describe('createContextFactory - advanced merging', () => {
  test('creates independent contexts that do not share state', () => {
    const factory = createContextFactory({
      store: { shared: 'base' },
    });

    const ctx1 = factory();
    const ctx2 = factory();

    ctx1.set('shared', 'modified-by-ctx1');
    expect(ctx2.get('shared')).toBe('base');
  });

  test('override store completely replaces base store key', () => {
    const factory = createContextFactory({
      store: { user: { id: 1, role: 'user' } },
    });

    const ctx = factory({
      store: { user: { id: 2, role: 'admin' } },
    });

    expect(ctx.get('user')).toEqual({ id: 2, role: 'admin' });
  });

  test('factory with no base options creates empty context', () => {
    const factory = createContextFactory();
    const ctx = factory();

    expect(ctx.getStore()).toEqual({});
    expect(ctx.cache.getTags()).toEqual([]);
  });

  test('factory merges cacheTags from both base and override', () => {
    const factory = createContextFactory({
      cacheTags: ['base-1', 'base-2'],
    });

    const ctx = factory({
      cacheTags: ['override-1'],
    });

    const tags = ctx.cache.getTags();
    expect(tags).toContain('base-1');
    expect(tags).toContain('base-2');
    expect(tags).toContain('override-1');
  });

  test('factory overrides URL when provided', () => {
    const factory = createContextFactory({
      url: 'https://base.com/path',
    });

    const ctx1 = factory();
    expect(ctx1.url.hostname).toBe('base.com');

    const ctx2 = factory({ url: 'https://override.com/other' });
    expect(ctx2.url.hostname).toBe('override.com');
  });
});
