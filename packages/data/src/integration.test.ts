/**
 * @ereo/data - Integration Tests
 *
 * Tests that verify modules work together as a unified system.
 * Covers cross-module interactions: action↔loader, cache↔revalidate,
 * pipeline+cache, defineRoute lifecycle, and schema+action validation.
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { createContext } from '@ereo/core';

// Import from the public API (index.ts) to test the unified surface
import {
  // Loader
  createLoader,
  serializeLoaderData,
  parseLoaderData,
  combineLoaders,
  defer,
  isDeferred,
  resolveDeferred,
  hasDeferredData,
  resolveAllDeferred,
  // Action
  typedAction,
  data,
  json,
  error,
  redirect,
  formDataToObject,
  parseRequestBody,
  // Cache
  MemoryCache,
  setCache,
  cached,
  cacheKey,
  // Revalidate
  revalidateTag,
  revalidatePath,
  revalidate,
  unstable_cache,
  tags,
  // Pipeline
  createPipeline,
  dataSource,
  cachedSource,
  // Route
  defineRoute,
  // Schema
  schemaBuilder,
} from './index';

// =========================================================================
// action.ts ↔ loader.ts integration: data() uses serializeLoaderData
// =========================================================================
describe('action ↔ loader integration', () => {
  test('data() response body uses serializeLoaderData for XSS protection', async () => {
    const dangerousPayload = {
      script: '</script><script>alert("xss")</script>',
      html: '<img onerror="alert(1)" src=x>',
    };

    const response = data(dangerousPayload);
    const body = await response.text();

    // serializeLoaderData escapes </ sequences
    expect(body).not.toContain('</script>');
    // But the data should be recoverable via parseLoaderData
    const parsed = parseLoaderData(body);
    expect(parsed.script).toBe('</script><script>alert("xss")</script>');
    expect(parsed.html).toBe('<img onerror="alert(1)" src=x>');
  });

  test('serializeLoaderData → parseLoaderData round-trip preserves all types', () => {
    const payload = {
      string: 'hello',
      number: 42,
      boolean: true,
      null: null,
      nested: { a: { b: [1, 2, 3] } },
      array: [{ id: 1 }, { id: 2 }],
    };

    const serialized = serializeLoaderData(payload);
    const parsed = parseLoaderData(serialized);

    expect(parsed).toEqual(payload);
  });

  test('data() response has correct Content-Type', async () => {
    const response = data({ value: 1 });
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  test('json() response returns valid JSON', async () => {
    const response = json({ users: [{ id: 1 }] });
    const body = await response.json();
    expect(body).toEqual({ users: [{ id: 1 }] });
  });
});

// =========================================================================
// cache.ts ↔ revalidate.ts integration
// =========================================================================
describe('cache ↔ revalidate integration', () => {
  beforeEach(() => {
    setCache(new MemoryCache());
  });

  test('cached() stores data, revalidateTag() invalidates it', async () => {
    let callCount = 0;
    const fetchUser = async () => {
      callCount++;
      return { name: 'John', counter: callCount };
    };

    const key = cacheKey('user', '1');

    // First call - caches the result
    const result1 = await cached(key, fetchUser, { maxAge: 60, tags: ['users'] });
    expect(result1).toEqual({ name: 'John', counter: 1 });
    expect(callCount).toBe(1);

    // Second call - returns cached value
    const result2 = await cached(key, fetchUser, { maxAge: 60, tags: ['users'] });
    expect(result2).toEqual({ name: 'John', counter: 1 });
    expect(callCount).toBe(1); // Not called again

    // Invalidate by tag
    await revalidateTag('users');

    // Third call - cache was invalidated, fetches fresh data
    const result3 = await cached(key, fetchUser, { maxAge: 60, tags: ['users'] });
    expect(result3).toEqual({ name: 'John', counter: 2 });
    expect(callCount).toBe(2);
  });

  test('revalidatePath() invalidates entries matching a path', async () => {
    let userCalls = 0;
    let postCalls = 0;

    await cached('/api/users', async () => ++userCalls, { maxAge: 60 });
    await cached('/api/posts', async () => ++postCalls, { maxAge: 60 });

    expect(userCalls).toBe(1);
    expect(postCalls).toBe(1);

    // Invalidate only /api/users
    await revalidatePath('/api/users');

    // Users cache is invalidated
    await cached('/api/users', async () => ++userCalls, { maxAge: 60 });
    expect(userCalls).toBe(2);

    // Posts cache is still valid
    await cached('/api/posts', async () => ++postCalls, { maxAge: 60 });
    expect(postCalls).toBe(1);
  });

  test('revalidate({ all: true }) clears the entire cache', async () => {
    let calls = 0;

    await cached('key1', async () => ++calls, { maxAge: 60 });
    await cached('key2', async () => ++calls, { maxAge: 60 });
    expect(calls).toBe(2);

    // Clear everything
    await revalidate({ all: true });

    await cached('key1', async () => ++calls, { maxAge: 60 });
    await cached('key2', async () => ++calls, { maxAge: 60 });
    expect(calls).toBe(4); // Both re-fetched
  });

  test('tags helper creates structured resource tags', () => {
    const resourceTag = tags.resource('post', '123');
    expect(resourceTag).toBe('post:123');

    const collectionTag = tags.collection('posts');
    expect(collectionTag).toBe('posts');

    const userTag = tags.userScoped('42', 'posts');
    expect(userTag).toBe('user:42:posts');
  });

  test('unstable_cache wraps a function with caching', async () => {
    let callCount = 0;
    const getUser = async (id: number) => {
      callCount++;
      return { id, name: `User ${id}` };
    };

    const cachedGetUser = unstable_cache(getUser, ['users'], {
      revalidate: 60,
    });

    const result1 = await cachedGetUser(1);
    expect(result1).toEqual({ id: 1, name: 'User 1' });
    expect(callCount).toBe(1);

    const result2 = await cachedGetUser(1);
    expect(result2).toEqual({ id: 1, name: 'User 1' });
    expect(callCount).toBe(1); // Cached
  });
});

// =========================================================================
// Pipeline + Cache integration
// =========================================================================
describe('pipeline + cache integration', () => {
  beforeEach(() => {
    setCache(new MemoryCache());
  });

  test('pipeline executes multiple sources in parallel', async () => {
    const order: string[] = [];

    const pipeline = createPipeline({
      loaders: {
        users: dataSource(async () => {
          order.push('users');
          return [{ id: 1, name: 'Alice' }];
        }),
        posts: dataSource(async () => {
          order.push('posts');
          return [{ id: 1, title: 'Hello' }];
        }),
      },
    });

    const request = new Request('http://localhost/');
    const result = await pipeline.execute({
      request,
      params: {},
      context: createContext(request),
    });

    expect(result.data.users).toEqual([{ id: 1, name: 'Alice' }]);
    expect(result.data.posts).toEqual([{ id: 1, title: 'Hello' }]);
    expect(order).toHaveLength(2);
  });

  test('pipeline with dependencies executes in order', async () => {
    const order: string[] = [];

    const pipeline = createPipeline({
      loaders: {
        user: dataSource(async () => {
          order.push('user');
          return { id: 1, name: 'Alice' };
        }),
        posts: dataSource(async () => {
          order.push('posts');
          return [{ title: 'Post 1' }];
        }),
      },
      dependencies: {
        posts: ['user'],
      },
    });

    const request = new Request('http://localhost/');
    const result = await pipeline.execute({
      request,
      params: {},
      context: createContext(request),
    });

    expect(result.data.user).toEqual({ id: 1, name: 'Alice' });
    expect(result.data.posts).toEqual([{ title: 'Post 1' }]);
    // posts depends on user, so user must execute first
    expect(order[0]).toBe('user');
    expect(order[1]).toBe('posts');
  });
});

// =========================================================================
// defineRoute full lifecycle
// =========================================================================
describe('defineRoute full lifecycle', () => {
  test('loader → data serialization → parse round trip', async () => {
    const route = defineRoute('/api/users')
      .loader(async () => {
        return {
          users: [
            { id: 1, name: 'Alice', bio: '<script>alert(1)</script>' },
          ],
        };
      })
      .build();

    // Execute the loader
    const request = new Request('http://localhost/api/users');
    const loaderData = await route.loader!({
      request,
      params: {},
      context: createContext(request),
    });

    // Serialize with XSS protection
    const serialized = serializeLoaderData(loaderData);
    expect(serialized).not.toContain('</script>');

    // Parse back
    const parsed = parseLoaderData(serialized);
    expect(parsed.users[0].name).toBe('Alice');
    expect(parsed.users[0].bio).toBe('<script>alert(1)</script>');
  });

  test('action with schema validation via defineRoute', async () => {
    const schema = {
      parse: (data: unknown) => {
        const d = data as { name?: string; age?: number };
        if (!d.name) throw new Error('Name required');
        if (typeof d.age !== 'number' || d.age < 0) throw new Error('Invalid age');
        return d as { name: string; age: number };
      },
    };

    const route = defineRoute('/api/users')
      .loader(async () => null)
      .action(
        async ({ body }) => {
          return { created: true, user: body };
        },
        { schema }
      )
      .build();

    // Valid request
    const validReq = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John', age: 30 }),
    });

    const result = await route.action!({
      request: validReq,
      params: {},
      context: createContext(validReq),
    });
    expect(result).toEqual({ created: true, user: { name: 'John', age: 30 } });
  });

  test('action parses FormData and converts to typed object', async () => {
    const route = defineRoute('/signup')
      .loader(async () => null)
      .action(async ({ body }) => {
        return { received: body };
      })
      .build();

    const formData = new FormData();
    formData.set('name', 'Jane');
    formData.set('email', 'jane@test.com');
    formData.append('roles[]', 'admin');
    formData.append('roles[]', 'editor');

    const request = new Request('http://localhost/signup', {
      method: 'POST',
      body: formData,
    });

    const result = await route.action!({
      request,
      params: {},
      context: createContext(request),
    });

    const body = (result as any).received;
    expect(body.name).toBe('Jane');
    expect(body.email).toBe('jane@test.com');
    expect(body.roles).toEqual(['admin', 'editor']);
  });

  test('head() receives loader data for SEO', async () => {
    const route = defineRoute('/posts/[slug]')
      .loader(async ({ params }) => ({
        title: `Post: ${params.slug}`,
        description: 'A great article',
      }))
      .head(({ data }) => ({
        title: data.title,
        description: data.description,
      }))
      .build();

    const request = new Request('http://localhost/posts/hello-world');
    const loaderData = await route.loader!({
      request,
      params: { slug: 'hello-world' },
      context: createContext(request),
    });

    const head = route.head!({
      data: loaderData,
      params: { slug: 'hello-world' },
      request,
    });

    expect(head.title).toBe('Post: hello-world');
    expect(head.description).toBe('A great article');
  });
});

// =========================================================================
// Schema + Action validation integration
// =========================================================================
describe('schema + action validation integration', () => {
  test('schemaBuilder parses and coerces typedAction input', async () => {
    const schema = schemaBuilder<{ email: string; page: number }>()
      .string('email')
      .number('page', { min: 1, max: 100 })
      .build();

    const actionFn = typedAction<{ email: string; page: number }>({
      schema,
      handler: async ({ body }) => ({ email: body.email, page: body.page }),
    });

    const validRequest = new Request('http://localhost/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', page: 5 }),
    });

    const result = await actionFn({
      request: validRequest,
      params: {},
      context: createContext(validRequest),
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'test@test.com', page: 5 });
  });

  test('typedAction with validate function rejects invalid input', async () => {
    const actionFn = typedAction<{ email: string; password: string }>({
      validate: (body) => {
        if (!body.password || body.password.length < 8) {
          return { success: false, errors: { password: ['Must be at least 8 characters'] } };
        }
        return { success: true };
      },
      handler: async ({ body }) => ({ email: body.email }),
    });

    const invalidRequest = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'short' }),
    });

    const result = await actionFn({
      request: invalidRequest,
      params: {},
      context: createContext(invalidRequest),
    });

    expect(result.success).toBe(false);
    expect(result.errors!.password).toBeDefined();
  });

  test('schemaBuilder parse coerces values and safeParse succeeds', () => {
    const schema = schemaBuilder<{ name: string; age: number }>()
      .string('name')
      .number('age', { min: 0, max: 150 })
      .build();

    // parse valid data
    const parsed = schema.parse({ name: 'Alice', age: 25 });
    expect(parsed.name).toBe('Alice');
    expect(parsed.age).toBe(25);

    // schemaBuilder coerces rather than rejects:
    // age -1 gets clamped to min (0)
    const coerced = schema.parse({ name: '', age: -1 });
    expect(coerced.name).toBe('');
    expect(coerced.age).toBe(0); // Clamped to min

    // safeParse wraps parse - always succeeds for coercing schemas
    const result = schema.safeParse({ name: 'Bob', age: 200 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.age).toBe(150); // Clamped to max
    }
  });
});

// =========================================================================
// Loader + Deferred data integration
// =========================================================================
describe('loader deferred data integration', () => {
  test('defer() creates deferred values that resolve later', async () => {
    const loaderFn = createLoader(async () => {
      return {
        immediate: 'fast data',
        delayed: defer(
          new Promise<string>((resolve) => {
            setTimeout(() => resolve('slow data'), 10);
          })
        ),
      };
    });

    const request = new Request('http://localhost/');
    const result = await loaderFn({
      request,
      params: {},
      context: createContext(request),
    });

    expect(result.immediate).toBe('fast data');
    expect(isDeferred(result.delayed)).toBe(true);
    expect(hasDeferredData(result)).toBe(true);

    // Resolve all deferred values
    const resolved = await resolveAllDeferred(result);
    expect(resolved.immediate).toBe('fast data');
    expect(resolved.delayed).toBe('slow data');
  });

  test('resolveDeferred handles individual deferred values', async () => {
    const deferred = defer(Promise.resolve({ users: ['Alice', 'Bob'] }));

    expect(isDeferred(deferred)).toBe(true);
    const resolved = await resolveDeferred(deferred);
    expect(resolved).toEqual({ users: ['Alice', 'Bob'] });
  });

  test('combineLoaders merges multiple loader results', async () => {
    const userLoader = createLoader(async () => ({
      users: [{ id: 1, name: 'Alice' }],
    }));

    const postLoader = createLoader(async () => ({
      posts: [{ id: 1, title: 'Hello' }],
    }));

    const combined = combineLoaders({ userLoader, postLoader });
    const request = new Request('http://localhost/');
    const result = await combined({
      request,
      params: {},
      context: createContext(request),
    });

    expect(result.userLoader.users).toHaveLength(1);
    expect(result.postLoader.posts).toHaveLength(1);
  });
});

// =========================================================================
// FormData → parseRequestBody → action integration
// =========================================================================
describe('request body parsing integration', () => {
  test('parseRequestBody auto-detects JSON and returns structured result', async () => {
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    });

    const result = await parseRequestBody(request);
    expect(result.contentType).toBe('json');
    expect(result.body).toEqual({ key: 'value' });
  });

  test('parseRequestBody auto-detects FormData and returns form result', async () => {
    const formData = new FormData();
    formData.set('name', 'John');

    const request = new Request('http://localhost/', {
      method: 'POST',
      body: formData,
    });

    const result = await parseRequestBody(request);
    expect(result.contentType).toBe('form');
    expect(result.formData).toBeDefined();
    expect((result.body as any).name).toBe('John');
  });

  test('parseRequestBody auto-detects URL-encoded form', async () => {
    const request = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'name=John&email=john%40test.com',
    });

    const result = await parseRequestBody(request);
    expect(result.contentType).toBe('form');
    expect((result.body as any).name).toBe('John');
    expect((result.body as any).email).toBe('john@test.com');
  });

  test('formDataToObject converts FormData to plain object with nested paths', () => {
    const formData = new FormData();
    formData.set('user.name', 'Alice');
    formData.set('user.email', 'alice@test.com');
    formData.append('user.roles[]', 'admin');
    formData.append('user.roles[]', 'editor');

    const result = formDataToObject(formData);

    expect((result as any).user.name).toBe('Alice');
    expect((result as any).user.email).toBe('alice@test.com');
    expect((result as any).user.roles).toEqual(['admin', 'editor']);
  });
});

// =========================================================================
// Error response helpers integration
// =========================================================================
describe('response helpers integration', () => {
  test('error() creates proper error response', () => {
    const response = error('Not found', 404);
    expect(response.status).toBe(404);
  });

  test('redirect() creates Location header', () => {
    const response = redirect('/login', 302);
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/login');
  });

  test('json() with custom status', async () => {
    const response = json({ error: 'bad request' }, { status: 400 });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('bad request');
  });
});

// =========================================================================
// End-to-end: Route definition → execution → caching
// =========================================================================
describe('end-to-end route lifecycle', () => {
  beforeEach(() => {
    setCache(new MemoryCache());
  });

  test('complete route with loader, action, head, meta, and middleware', async () => {
    const mw = async (_req: any, _ctx: any, _params: any, next: any) => next();

    const route = defineRoute('/posts/[id]')
      .middleware(mw)
      .beforeLoad(async () => {})
      .loader(async ({ params }) => ({
        id: params.id,
        title: 'My Post',
        content: 'Hello world',
      }))
      .action(async ({ body }) => ({
        updated: true,
        body,
      }))
      .head(({ data }) => ({
        title: data.title,
      }))
      .meta(({ data }) => [
        { title: data.title },
        { name: 'description', content: data.content },
      ])
      .shouldRevalidate(() => true)
      .cache({ maxAge: 300, tags: ['posts'] })
      .build();

    // Verify all parts are defined
    expect(route.path).toBe('/posts/[id]');
    expect(route.loader).toBeDefined();
    expect(route.action).toBeDefined();
    expect(route.head).toBeDefined();
    expect(route.meta).toBeDefined();
    expect(route.middleware).toHaveLength(1);
    expect(route.beforeLoad).toBeDefined();
    expect(route.shouldRevalidate).toBeDefined();
    expect(route.cache).toEqual({ maxAge: 300, tags: ['posts'] });

    // Execute loader
    const request = new Request('http://localhost/posts/42');
    const loaderData = await route.loader!({
      request,
      params: { id: '42' },
      context: createContext(request),
    });

    expect(loaderData).toEqual({ id: '42', title: 'My Post', content: 'Hello world' });

    // Execute head with loader data
    const head = route.head!({ data: loaderData, params: { id: '42' }, request });
    expect(head.title).toBe('My Post');

    // Execute meta with loader data
    const meta = route.meta!({
      data: loaderData,
      params: { id: '42' },
      location: { pathname: '/posts/42', search: '', hash: '' },
    });
    expect(meta).toHaveLength(2);
    expect(meta[0].title).toBe('My Post');

    // Execute action
    const actionReq = new Request('http://localhost/posts/42', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Post' }),
    });

    const actionResult = await route.action!({
      request: actionReq,
      params: { id: '42' },
      context: createContext(actionReq),
    });

    expect(actionResult).toEqual({
      updated: true,
      body: { title: 'Updated Post' },
    });
  });
});
