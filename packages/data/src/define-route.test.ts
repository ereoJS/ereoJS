/**
 * @ereo/data - Route Definition Builder Tests
 *
 * Comprehensive tests for the defineRoute() builder pattern API.
 */

import { describe, expect, test } from 'bun:test';
import { defineRoute } from './define-route';
import { createContext } from '@ereo/core';

// Mock context helper
const createMockArgs = (url = 'http://localhost:3000/', method = 'GET') => {
  const request = new Request(url, { method });
  return {
    request,
    params: {} as Record<string, string>,
    context: createContext(request),
  };
};

const createMockActionArgs = (
  body: unknown,
  contentType = 'application/json',
  url = 'http://localhost:3000/'
) => {
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return {
    request,
    params: {} as Record<string, string>,
    context: createContext(request),
  };
};

describe('@ereo/data - defineRoute', () => {
  // ===========================================================================
  // Basic builder creation
  // ===========================================================================
  describe('basic builder', () => {
    test('creates a route builder from a path', () => {
      const builder = defineRoute('/users');
      expect(builder).toBeDefined();
      expect(typeof builder.loader).toBe('function');
      expect(typeof builder.build).toBe('function');
    });

    test('build() returns route definition with path', () => {
      const route = defineRoute('/users').build();

      expect(route.path).toBe('/users');
      expect(route._types).toBeDefined();
    });

    test('build() without loader returns no loader/action', () => {
      const route = defineRoute('/static').build();

      expect(route.loader).toBeUndefined();
      expect(route.action).toBeUndefined();
    });
  });

  // ===========================================================================
  // Loader
  // ===========================================================================
  describe('loader', () => {
    test('defines and invokes a loader', async () => {
      const route = defineRoute('/users')
        .loader(async () => {
          return { users: [{ id: 1, name: 'John' }] };
        })
        .build();

      expect(route.loader).toBeDefined();

      const data = await route.loader!(createMockArgs());
      expect(data).toEqual({ users: [{ id: 1, name: 'John' }] });
    });

    test('loader receives request and params', async () => {
      const route = defineRoute('/users/[id]')
        .loader(async ({ request, params }) => {
          return { url: request.url, params };
        })
        .build();

      const args = createMockArgs('http://localhost:3000/users/42');
      args.params = { id: '42' };
      const data = await route.loader!(args);

      expect(data.url).toBe('http://localhost:3000/users/42');
      expect(data.params).toEqual({ id: '42' });
    });

    test('loader applies cache options to context', async () => {
      let cacheSet = false;
      const route = defineRoute('/cached')
        .loader(async () => 'data')
        .cache({ maxAge: 60, tags: ['test'] })
        .build();

      const args = createMockArgs();
      // The cache.set on context is called internally
      await route.loader!(args);
      // Just verifying it doesn't throw
      expect(route.cache).toEqual({ maxAge: 60, tags: ['test'] });
    });
  });

  // ===========================================================================
  // Action
  // ===========================================================================
  describe('action', () => {
    test('defines and invokes an action with JSON body', async () => {
      const route = defineRoute('/users')
        .loader(async () => ({ users: [] }))
        .action(async ({ body }) => {
          return { created: true, name: (body as any).name };
        })
        .build();

      expect(route.action).toBeDefined();

      const result = await route.action!(
        createMockActionArgs({ name: 'John' })
      );
      expect(result).toEqual({ created: true, name: 'John' });
    });

    test('action with FormData body', async () => {
      const route = defineRoute('/submit')
        .loader(async () => null)
        .action(async ({ body, formData }) => {
          return { received: true, body };
        })
        .build();

      const formData = new FormData();
      formData.set('name', 'Jane');
      formData.set('email', 'jane@example.com');

      const request = new Request('http://localhost:3000/submit', {
        method: 'POST',
        body: formData,
      });

      const result = await route.action!({
        request,
        params: {},
        context: createContext(request),
      });

      expect(result.received).toBe(true);
      expect((result.body as any).name).toBe('Jane');
    });

    test('action with schema validation', async () => {
      const schema = {
        parse: (data: unknown) => {
          const d = data as { name?: string };
          if (!d.name) throw new Error('Name required');
          return d as { name: string };
        },
      };

      const route = defineRoute('/validated')
        .loader(async () => null)
        .action(
          async ({ body }) => {
            return { name: body.name };
          },
          { schema }
        )
        .build();

      // Valid body
      const result = await route.action!(
        createMockActionArgs({ name: 'John' })
      );
      expect(result).toEqual({ name: 'John' });

      // Invalid body - should throw
      await expect(
        route.action!(createMockActionArgs({ name: '' }))
      ).rejects.toThrow('Name required');
    });

    test('action throws on unparseable body', async () => {
      const route = defineRoute('/api')
        .loader(async () => null)
        .action(async ({ body }) => body)
        .build();

      const request = new Request('http://localhost:3000/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: 'not json at all {{{',
      });

      await expect(
        route.action!({
          request,
          params: {},
          context: createContext(request),
        })
      ).rejects.toThrow('Failed to parse action request body');
    });
  });

  // ===========================================================================
  // Search params schema
  // ===========================================================================
  describe('searchParams', () => {
    test('parses search params with schema', async () => {
      const schema = {
        parse: (data: unknown) => {
          const d = data as Record<string, string>;
          return { page: Number(d.page) || 1, q: d.q || '' };
        },
      };

      const route = defineRoute('/search')
        .searchParams(schema)
        .loader(async ({ searchParams }) => {
          return { searchParams };
        })
        .build();

      const result = await route.loader!(
        createMockArgs('http://localhost:3000/search?page=2&q=test')
      );

      expect(result.searchParams).toEqual({ page: 2, q: 'test' });
    });

    test('search params with duplicate keys become arrays', async () => {
      let receivedParams: any;
      const schema = {
        parse: (data: unknown) => data,
      };

      const route = defineRoute('/filter')
        .searchParams(schema)
        .loader(async ({ searchParams }) => {
          receivedParams = searchParams;
          return null;
        })
        .build();

      await route.loader!(
        createMockArgs('http://localhost:3000/filter?tag=a&tag=b')
      );

      expect(receivedParams.tag).toEqual(['a', 'b']);
    });
  });

  // ===========================================================================
  // Hash params schema
  // ===========================================================================
  describe('hashParams', () => {
    test('parses hash params with schema', async () => {
      const schema = {
        parse: (data: unknown) => data,
      };

      const route = defineRoute('/page')
        .hashParams(schema)
        .loader(async ({ hashParams }) => {
          return { hashParams };
        })
        .build();

      const result = await route.loader!(
        createMockArgs('http://localhost:3000/page#section=intro&scroll=top')
      );

      expect(result.hashParams).toEqual({ section: 'intro', scroll: 'top' });
    });

    test('loader works when no hash is present', async () => {
      const schema = {
        parse: (data: unknown) => data,
      };

      const route = defineRoute('/page')
        .hashParams(schema)
        .loader(async ({ hashParams }) => {
          return { hashParams };
        })
        .build();

      const result = await route.loader!(
        createMockArgs('http://localhost:3000/page')
      );

      expect(result.hashParams).toBeUndefined();
    });
  });

  // ===========================================================================
  // Head and Meta
  // ===========================================================================
  describe('head and meta', () => {
    test('defines head function that receives loader data', () => {
      const route = defineRoute('/posts/[slug]')
        .loader(async () => ({ title: 'My Post', description: 'About stuff' }))
        .head(({ data }) => ({
          title: data.title,
          description: data.description,
        }))
        .build();

      expect(route.head).toBeDefined();
      const headData = route.head!({
        data: { title: 'My Post', description: 'About stuff' },
        params: { slug: 'test' },
        request: new Request('http://localhost/'),
      });

      expect(headData.title).toBe('My Post');
      expect(headData.description).toBe('About stuff');
    });

    test('defines meta function that receives loader data', () => {
      const route = defineRoute('/posts/[slug]')
        .loader(async () => ({ title: 'My Post' }))
        .meta(({ data }) => [
          { title: data.title },
          { name: 'description', content: 'A great post' },
        ])
        .build();

      expect(route.meta).toBeDefined();
      const meta = route.meta!({
        data: { title: 'My Post' },
        params: { slug: 'test' },
        location: { pathname: '/posts/test', search: '', hash: '' },
      });

      expect(meta).toHaveLength(2);
      expect(meta[0].title).toBe('My Post');
    });

    test('head after action still preserves loader data', () => {
      const route = defineRoute('/posts/[slug]')
        .loader(async () => ({ title: 'Post' }))
        .action(async () => ({ success: true }))
        .head(({ data }) => ({ title: data.title }))
        .build();

      expect(route.head).toBeDefined();
      expect(route.loader).toBeDefined();
      expect(route.action).toBeDefined();
    });

    test('meta after action still preserves loader data', () => {
      const route = defineRoute('/posts')
        .loader(async () => ({ title: 'Posts' }))
        .action(async () => ({ ok: true }))
        .meta(({ data }) => [{ title: data.title }])
        .build();

      expect(route.meta).toBeDefined();
    });
  });

  // ===========================================================================
  // Middleware
  // ===========================================================================
  describe('middleware', () => {
    test('attaches middleware to route (base builder)', () => {
      const authMiddleware = async (
        _req: Request,
        _ctx: any,
        _params: any,
        next: () => Promise<Response>
      ) => next();

      const route = defineRoute('/admin')
        .middleware(authMiddleware)
        .build();

      expect(route.middleware).toHaveLength(1);
    });

    test('attaches middleware to route (with loader)', () => {
      const mw = async (_req: any, _ctx: any, _params: any, next: any) =>
        next();

      const route = defineRoute('/admin')
        .loader(async () => 'data')
        .middleware(mw)
        .build();

      expect(route.middleware).toHaveLength(1);
    });

    test('attaches middleware to route (with loader and action)', () => {
      const mw = async (_req: any, _ctx: any, _params: any, next: any) =>
        next();

      const route = defineRoute('/admin')
        .loader(async () => 'data')
        .action(async () => 'result')
        .middleware(mw)
        .build();

      expect(route.middleware).toHaveLength(1);
    });

    test('accumulates multiple middleware calls', () => {
      const mw1 = async (_req: any, _ctx: any, _params: any, next: any) =>
        next();
      const mw2 = async (_req: any, _ctx: any, _params: any, next: any) =>
        next();

      const route = defineRoute('/admin')
        .middleware(mw1)
        .middleware(mw2)
        .build();

      expect(route.middleware).toHaveLength(2);
    });
  });

  // ===========================================================================
  // Configure
  // ===========================================================================
  describe('configure', () => {
    test('sets route configuration (base builder)', () => {
      const route = defineRoute('/page')
        .configure({ middleware: [] })
        .build();

      expect(route.config).toBeDefined();
    });

    test('sets route configuration (with loader)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .configure({ middleware: [] })
        .build();

      expect(route.config).toBeDefined();
    });

    test('sets route configuration (with loader and action)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .action(async () => null)
        .configure({ middleware: [] })
        .build();

      expect(route.config).toBeDefined();
    });
  });

  // ===========================================================================
  // shouldRevalidate
  // ===========================================================================
  describe('shouldRevalidate', () => {
    test('sets shouldRevalidate (base builder)', () => {
      const route = defineRoute('/page')
        .shouldRevalidate(() => true)
        .build();

      expect(route.shouldRevalidate).toBeDefined();
    });

    test('sets shouldRevalidate (with loader)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .shouldRevalidate(() => false)
        .build();

      expect(route.shouldRevalidate).toBeDefined();
    });

    test('sets shouldRevalidate (with loader and action)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .action(async () => null)
        .shouldRevalidate(() => true)
        .build();

      expect(route.shouldRevalidate).toBeDefined();
    });
  });

  // ===========================================================================
  // Client loader and action
  // ===========================================================================
  describe('clientLoader and clientAction', () => {
    test('sets clientLoader (base builder)', () => {
      const route = defineRoute('/page')
        .clientLoader(async () => 'data')
        .build();

      expect(route.clientLoader).toBeDefined();
    });

    test('sets clientAction (base builder)', () => {
      const route = defineRoute('/page')
        .clientAction(async () => 'result')
        .build();

      expect(route.clientAction).toBeDefined();
    });

    test('sets clientLoader (with loader)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .clientLoader(async () => 'data')
        .build();

      expect(route.clientLoader).toBeDefined();
    });

    test('sets clientAction (with loader)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .clientAction(async () => 'result')
        .build();

      expect(route.clientAction).toBeDefined();
    });

    test('sets clientLoader (with loader and action)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .action(async () => null)
        .clientLoader(async () => 'data')
        .build();

      expect(route.clientLoader).toBeDefined();
    });

    test('sets clientAction (with loader and action)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .action(async () => null)
        .clientAction(async () => 'result')
        .build();

      expect(route.clientAction).toBeDefined();
    });
  });

  // ===========================================================================
  // Links
  // ===========================================================================
  describe('links', () => {
    test('sets links function (base builder)', () => {
      const route = defineRoute('/page')
        .links(() => [{ rel: 'stylesheet', href: '/styles.css' }])
        .build();

      expect(route.links).toBeDefined();
    });

    test('sets links function (with loader)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .links(() => [])
        .build();

      expect(route.links).toBeDefined();
    });

    test('sets links function (with loader and action)', () => {
      const route = defineRoute('/page')
        .loader(async () => null)
        .action(async () => null)
        .links(() => [])
        .build();

      expect(route.links).toBeDefined();
    });
  });

  // ===========================================================================
  // beforeLoad
  // ===========================================================================
  describe('beforeLoad', () => {
    test('sets beforeLoad guard (base builder)', () => {
      const route = defineRoute('/protected')
        .beforeLoad(async () => {
          // auth check
        })
        .build();

      expect(route.beforeLoad).toBeDefined();
    });

    test('sets beforeLoad guard (with loader)', () => {
      const route = defineRoute('/protected')
        .loader(async () => null)
        .beforeLoad(async () => {})
        .build();

      expect(route.beforeLoad).toBeDefined();
    });

    test('sets beforeLoad guard (with loader and action)', () => {
      const route = defineRoute('/protected')
        .loader(async () => null)
        .action(async () => null)
        .beforeLoad(async () => {})
        .build();

      expect(route.beforeLoad).toBeDefined();
    });
  });

  // ===========================================================================
  // HTTP Method Handlers
  // ===========================================================================
  describe('method handlers', () => {
    test('sets GET handler (base builder)', () => {
      const route = defineRoute('/api/users')
        .get(async () => new Response('users'))
        .build();

      expect(route.GET).toBeDefined();
    });

    test('sets POST handler (base builder)', () => {
      const route = defineRoute('/api/users')
        .post(async () => new Response('created'))
        .build();

      expect(route.POST).toBeDefined();
    });

    test('sets PUT handler (base builder)', () => {
      const route = defineRoute('/api/users/[id]')
        .put(async () => new Response('updated'))
        .build();

      expect(route.PUT).toBeDefined();
    });

    test('sets DELETE handler (base builder)', () => {
      const route = defineRoute('/api/users/[id]')
        .delete(async () => new Response('deleted'))
        .build();

      expect(route.DELETE).toBeDefined();
    });

    test('sets PATCH handler (base builder)', () => {
      const route = defineRoute('/api/users/[id]')
        .patch(async () => new Response('patched'))
        .build();

      expect(route.PATCH).toBeDefined();
    });

    test('sets multiple method handlers', () => {
      const route = defineRoute('/api/items')
        .get(async () => new Response('list'))
        .post(async () => new Response('create'))
        .build();

      expect(route.GET).toBeDefined();
      expect(route.POST).toBeDefined();
    });

    test('sets method handlers with loader', () => {
      const route = defineRoute('/api/items')
        .loader(async () => [])
        .get(async () => new Response('list'))
        .post(async () => new Response('create'))
        .build();

      expect(route.GET).toBeDefined();
      expect(route.POST).toBeDefined();
    });

    test('sets PUT handler with loader', () => {
      const route = defineRoute('/api/items/[id]')
        .loader(async () => [])
        .put(async () => new Response('updated'))
        .build();

      expect(route.PUT).toBeDefined();
    });

    test('sets DELETE handler with loader', () => {
      const route = defineRoute('/api/items/[id]')
        .loader(async () => [])
        .delete(async () => new Response('deleted'))
        .build();

      expect(route.DELETE).toBeDefined();
    });

    test('sets PATCH handler with loader', () => {
      const route = defineRoute('/api/items/[id]')
        .loader(async () => [])
        .patch(async () => new Response('patched'))
        .build();

      expect(route.PATCH).toBeDefined();
    });

    test('sets method handlers with loader and action', () => {
      const route = defineRoute('/api/items')
        .loader(async () => [])
        .action(async () => null)
        .get(async () => new Response('list'))
        .put(async () => new Response('update'))
        .delete(async () => new Response('delete'))
        .patch(async () => new Response('patch'))
        .build();

      expect(route.GET).toBeDefined();
      expect(route.PUT).toBeDefined();
      expect(route.DELETE).toBeDefined();
      expect(route.PATCH).toBeDefined();
    });

    test('sets POST handler with loader and action', () => {
      const route = defineRoute('/api/items')
        .loader(async () => [])
        .action(async () => null)
        .post(async () => new Response('created'))
        .build();

      expect(route.POST).toBeDefined();
    });
  });

  // ===========================================================================
  // Full builder chain
  // ===========================================================================
  describe('full builder chain', () => {
    test('chains all builder methods without breaking', () => {
      const mw = async (_req: any, _ctx: any, _params: any, next: any) =>
        next();

      const route = defineRoute('/users/[id]')
        .searchParams({ parse: (d: unknown) => d })
        .hashParams({ parse: (d: unknown) => d })
        .middleware(mw)
        .configure({})
        .shouldRevalidate(() => true)
        .clientLoader(async () => 'data')
        .clientAction(async () => 'result')
        .links(() => [])
        .beforeLoad(async () => {})
        .get(async () => new Response('ok'))
        .loader(async ({ params }) => {
          return { id: params.id };
        })
        .action(async ({ body }) => {
          return { updated: true };
        })
        .head(({ data }) => ({
          title: `User ${data.id}`,
        }))
        .meta(({ data }) => [{ title: `User ${data.id}` }])
        .cache({ maxAge: 300 })
        .build();

      expect(route.path).toBe('/users/[id]');
      expect(route.loader).toBeDefined();
      expect(route.action).toBeDefined();
      expect(route.head).toBeDefined();
      expect(route.meta).toBeDefined();
      expect(route.cache).toEqual({ maxAge: 300 });
      expect(route.searchParamsSchema).toBeDefined();
      expect(route.hashParamsSchema).toBeDefined();
      expect(route.middleware).toBeDefined();
      expect(route.shouldRevalidate).toBeDefined();
      expect(route.clientLoader).toBeDefined();
      expect(route.clientAction).toBeDefined();
      expect(route.links).toBeDefined();
      expect(route.beforeLoad).toBeDefined();
    });
  });

  // ===========================================================================
  // Route definition output structure
  // ===========================================================================
  describe('route definition output', () => {
    test('includes _types brand for inference', () => {
      const route = defineRoute('/test')
        .loader(async () => ({ value: 42 }))
        .action(async () => ({ ok: true }))
        .build();

      expect(route._types).toBeDefined();
    });

    test('includes actionBodySchema when action has schema', () => {
      const schema = { parse: (d: unknown) => d as { name: string } };

      const route = defineRoute('/test')
        .loader(async () => null)
        .action(async ({ body }) => body, { schema })
        .build();

      expect(route.actionBodySchema).toBeDefined();
    });

    test('omits actionBodySchema when no schema provided', () => {
      const route = defineRoute('/test')
        .loader(async () => null)
        .action(async () => null)
        .build();

      expect(route.actionBodySchema).toBeUndefined();
    });
  });

  // ===========================================================================
  // FormData handling in define-route action
  // ===========================================================================
  describe('action FormData handling', () => {
    test('handles array fields in FormData', async () => {
      const route = defineRoute('/submit')
        .loader(async () => null)
        .action(async ({ body }) => body)
        .build();

      const formData = new FormData();
      formData.append('tags[]', 'react');
      formData.append('tags[]', 'typescript');

      const request = new Request('http://localhost:3000/submit', {
        method: 'POST',
        body: formData,
      });

      const result = await route.action!({
        request,
        params: {},
        context: createContext(request),
      });

      expect((result as any).tags).toEqual(['react', 'typescript']);
    });

    test('handles multiple values with same key', async () => {
      const route = defineRoute('/submit')
        .loader(async () => null)
        .action(async ({ body }) => body)
        .build();

      const formData = new FormData();
      formData.append('color', 'red');
      formData.append('color', 'blue');

      const request = new Request('http://localhost:3000/submit', {
        method: 'POST',
        body: formData,
      });

      const result = await route.action!({
        request,
        params: {},
        context: createContext(request),
      });

      expect((result as any).color).toEqual(['red', 'blue']);
    });
  });

  // ===========================================================================
  // Cache configuration on builder
  // ===========================================================================
  describe('cache on builder', () => {
    test('sets cache on builder with loader and action', () => {
      const route = defineRoute('/cached')
        .loader(async () => null)
        .action(async () => null)
        .cache({ maxAge: 120, tags: ['data'] })
        .build();

      expect(route.cache).toEqual({ maxAge: 120, tags: ['data'] });
    });
  });

  // ===========================================================================
  // URL-encoded form data for action
  // ===========================================================================
  describe('action with URL-encoded form', () => {
    test('parses URL-encoded form data', async () => {
      const route = defineRoute('/login')
        .loader(async () => null)
        .action(async ({ body }) => body)
        .build();

      const params = new URLSearchParams();
      params.set('username', 'admin');
      params.set('password', 'secret');

      const request = new Request('http://localhost:3000/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const result = await route.action!({
        request,
        params: {},
        context: createContext(request),
      });

      expect((result as any).username).toBe('admin');
      expect((result as any).password).toBe('secret');
    });
  });
});
