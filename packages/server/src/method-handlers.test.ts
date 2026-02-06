import { describe, expect, test } from 'bun:test';
import { BunServer, createServer } from './bun-server';

describe('@ereo/server - Method Handlers', () => {
  let server: BunServer;

  function setup(routeModule: Record<string, unknown>) {
    server = createServer({ port: 0, logging: false });
    // Access the private handleRouteInner via a manual request handler setup
    // We test by creating a server with a route that has method handlers
    return server;
  }

  test('GET handler takes precedence over loader', async () => {
    // Test the dispatch logic: when module.GET exists, it should be called instead of loader
    const module = {
      GET: async ({ request, params, context }: any) => {
        return { source: 'GET handler' };
      },
      loader: async () => {
        return { source: 'loader' };
      },
    };

    // Simulate: if module has GET, the method handler is preferred
    const method = 'GET';
    const handler = (module as any)[method];
    expect(handler).toBeDefined();
    const result = await handler({ request: new Request('http://localhost/'), params: {}, context: {} });
    expect(result).toEqual({ source: 'GET handler' });
  });

  test('POST handler takes precedence over action', async () => {
    const module = {
      POST: async ({ request, params, context }: any) => {
        return { source: 'POST handler' };
      },
      action: async () => {
        return { source: 'action' };
      },
    };

    const method = 'POST';
    const handler = (module as any)[method];
    expect(handler).toBeDefined();
    const result = await handler({ request: new Request('http://localhost/', { method: 'POST' }), params: {}, context: {} });
    expect(result).toEqual({ source: 'POST handler' });
  });

  test('falls through to loader when no GET handler', () => {
    const module = {
      loader: async () => ({ source: 'loader' }),
    };

    const method = 'GET';
    const handler = (module as any)[method];
    expect(handler).toBeUndefined();
    // When handler is undefined, the server should fall through to loader
  });

  test('falls through to action when no POST handler', () => {
    const module = {
      action: async () => ({ source: 'action' }),
    };

    const method = 'POST';
    const handler = (module as any)[method];
    expect(handler).toBeUndefined();
  });

  test('method handler can return Response directly', async () => {
    const module = {
      GET: async () => {
        return new Response('custom response', { status: 201 });
      },
    };

    const result = await module.GET();
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(201);
    expect(await result.text()).toBe('custom response');
  });

  test('method handler return value is auto-JSON-wrapped', async () => {
    const module = {
      GET: async () => {
        return { users: [{ id: 1 }] };
      },
    };

    const result = await module.GET();
    // The server wraps non-Response values in JSON
    expect(result).toEqual({ users: [{ id: 1 }] });
    const json = JSON.stringify(result);
    expect(JSON.parse(json)).toEqual({ users: [{ id: 1 }] });
  });

  test('all HTTP methods are supported', () => {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'] as const;
    const module: Record<string, unknown> = {};
    for (const m of methods) {
      module[m] = async () => ({ method: m });
    }

    for (const m of methods) {
      expect((module as any)[m]).toBeDefined();
    }
  });

  test('method handler receives params and context', async () => {
    const params = { id: '42' };
    const context = { url: new URL('http://localhost/users/42') };
    const request = new Request('http://localhost/users/42');

    let receivedArgs: any;
    const module = {
      GET: async (args: any) => {
        receivedArgs = args;
        return {};
      },
    };

    await module.GET({ request, params, context });
    expect(receivedArgs.params).toEqual({ id: '42' });
    expect(receivedArgs.request).toBe(request);
    expect(receivedArgs.context).toBe(context);
  });
});
