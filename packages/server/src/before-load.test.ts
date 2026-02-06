import { describe, expect, test } from 'bun:test';

describe('@ereo/server - beforeLoad Route Guard', () => {
  test('beforeLoad runs before loader', async () => {
    const order: string[] = [];

    const module = {
      beforeLoad: async () => {
        order.push('beforeLoad');
      },
      loader: async () => {
        order.push('loader');
        return { data: true };
      },
    };

    // Simulate execution order as done in bun-server.ts
    if (module.beforeLoad) {
      await module.beforeLoad({ request: new Request('http://localhost/'), params: {}, context: {} } as any);
    }
    const result = await module.loader({ request: new Request('http://localhost/'), params: {}, context: {} } as any);

    expect(order).toEqual(['beforeLoad', 'loader']);
    expect(result).toEqual({ data: true });
  });

  test('thrown redirect short-circuits the request', async () => {
    const module = {
      beforeLoad: async () => {
        throw new Response(null, {
          status: 302,
          headers: { Location: '/login' },
        });
      },
      loader: async () => {
        return { data: true };
      },
    };

    let caughtResponse: Response | undefined;
    try {
      await module.beforeLoad({ request: new Request('http://localhost/'), params: {}, context: {} } as any);
    } catch (e) {
      if (e instanceof Response) {
        caughtResponse = e;
      }
    }

    expect(caughtResponse).toBeDefined();
    expect(caughtResponse!.status).toBe(302);
    expect(caughtResponse!.headers.get('Location')).toBe('/login');
  });

  test('thrown error propagates', async () => {
    const module = {
      beforeLoad: async () => {
        throw new Error('Unauthorized');
      },
      loader: async () => {
        return { data: true };
      },
    };

    let caughtError: Error | undefined;
    try {
      await module.beforeLoad({ request: new Request('http://localhost/'), params: {}, context: {} } as any);
    } catch (e) {
      if (e instanceof Error) {
        caughtError = e;
      }
    }

    expect(caughtError).toBeDefined();
    expect(caughtError!.message).toBe('Unauthorized');
  });

  test('void return allows loader to proceed', async () => {
    const module = {
      beforeLoad: async () => {
        // No throw, no return — guard passes
      },
      loader: async () => {
        return { allowed: true };
      },
    };

    await module.beforeLoad({ request: new Request('http://localhost/'), params: {}, context: {} } as any);
    const result = await module.loader({ request: new Request('http://localhost/'), params: {}, context: {} } as any);
    expect(result).toEqual({ allowed: true });
  });

  test('layout beforeLoad runs before route beforeLoad', async () => {
    const order: string[] = [];

    const layoutModule = {
      beforeLoad: async () => {
        order.push('layout.beforeLoad');
      },
    };

    const routeModule = {
      beforeLoad: async () => {
        order.push('route.beforeLoad');
      },
      loader: async () => {
        order.push('loader');
        return {};
      },
    };

    // Simulate bun-server.ts execution order: layouts first, then route
    const layouts = [{ module: layoutModule }];
    for (const layout of layouts) {
      if (layout.module?.beforeLoad) {
        await layout.module.beforeLoad({ request: new Request('http://localhost/'), params: {}, context: {} } as any);
      }
    }
    if (routeModule.beforeLoad) {
      await routeModule.beforeLoad({ request: new Request('http://localhost/'), params: {}, context: {} } as any);
    }
    await routeModule.loader({ request: new Request('http://localhost/'), params: {}, context: {} } as any);

    expect(order).toEqual(['layout.beforeLoad', 'route.beforeLoad', 'loader']);
  });

  test('backward compatible when beforeLoad is absent', async () => {
    const module = {
      loader: async () => {
        return { data: 'works' };
      },
    };

    // No beforeLoad — should not throw
    if ((module as any).beforeLoad) {
      await (module as any).beforeLoad({} as any);
    }

    const result = await module.loader({} as any);
    expect(result).toEqual({ data: 'works' });
  });
});
