import { describe, it, expect } from 'bun:test';
import { createTracer } from '../tracer';
import { traceLoader, recordLoaderMetrics, traceCacheOperation } from '../instrumentors/data';
import { traceRPCCall, recordRPCValidation } from '../instrumentors/rpc';
import { traceAuthCheck } from '../instrumentors/auth';
import { traceError, withErrorCapture } from '../instrumentors/errors';
import { traceBuildStage, traceBuild } from '../instrumentors/build';
import { traceHydration, recordHydration } from '../instrumentors/islands';
import { recordSignalUpdate, recordSignalBatch } from '../instrumentors/signals';
import { traceRouteMatch, recordRouteMatch } from '../instrumentors/routing';
import { tracedAdapter, traceQuery } from '../instrumentors/database';
import { traceFormSubmit, recordFormValidation } from '../instrumentors/forms';

describe('Data instrumentor', () => {
  it('traceLoader wraps sync function', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceLoader(root, 'users', () => [{ id: 1 }]);
    expect(result).toEqual([{ id: 1 }]);
    root.end();

    const trace = tracer.getTraces()[0];
    const loaderSpan = Array.from(trace.spans.values()).find(s => s.name === 'loader:users');
    expect(loaderSpan).toBeDefined();
    expect(loaderSpan!.layer).toBe('data');
    expect(loaderSpan!.attributes['loader.key']).toBe('users');
  });

  it('traceLoader wraps async function', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await traceLoader(root, 'posts', async () => {
      return [{ id: 1, title: 'Hello' }];
    });
    expect(result).toHaveLength(1);
    root.end();

    const trace = tracer.getTraces()[0];
    expect(trace.spans.size).toBe(2);
  });

  it('traceLoader captures errors', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    expect(() => {
      traceLoader(root, 'broken', () => { throw new Error('db down'); });
    }).toThrow('db down');

    root.end();
    const trace = tracer.getTraces()[0];
    const brokenSpan = Array.from(trace.spans.values()).find(s => s.name === 'loader:broken');
    expect(brokenSpan?.status).toBe('error');
  });

  it('recordLoaderMetrics creates spans from metrics', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordLoaderMetrics(root, [
      { key: 'user', duration: 12.1, cacheHit: false, source: 'db' },
      { key: 'posts', duration: 18.3, cacheHit: false, source: 'db', waitingFor: ['user'] },
      { key: 'comments', duration: 8.0, cacheHit: true },
    ]);

    root.end();
    const trace = tracer.getTraces()[0];
    // root + 3 loader spans
    expect(trace.spans.size).toBe(4);
  });

  it('traceCacheOperation adds events', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    traceCacheOperation(root, 'get', 'user:123', true);
    traceCacheOperation(root, 'set', 'user:123');
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events).toHaveLength(2);
    expect(rootSpan.events[0].name).toBe('cache.get');
  });
});

describe('RPC instrumentor', () => {
  it('traces a query procedure', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await traceRPCCall(root, 'users.list', 'query', async () => {
      return [{ id: 1 }];
    });

    expect(result).toHaveLength(1);
    root.end();

    const trace = tracer.getTraces()[0];
    const rpcSpan = Array.from(trace.spans.values()).find(s => s.name === 'rpc:users.list');
    expect(rpcSpan).toBeDefined();
    expect(rpcSpan!.attributes['rpc.procedure']).toBe('users.list');
    expect(rpcSpan!.attributes['rpc.type']).toBe('query');
  });
});

describe('Auth instrumentor', () => {
  it('traces successful auth check', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceAuthCheck(root, 'requireAuth', () => ({ userId: '123' }));
    expect(result).toEqual({ userId: '123' });

    root.end();
    const trace = tracer.getTraces()[0];
    const authSpan = Array.from(trace.spans.values()).find(s => s.layer === 'auth');
    expect(authSpan).toBeDefined();
    expect(authSpan!.attributes['auth.result']).toBe('ok');
  });

  it('traces failed auth check', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    expect(() => {
      traceAuthCheck(root, 'requireAuth', () => { throw new Error('Unauthorized'); });
    }).toThrow('Unauthorized');

    root.end();
    const trace = tracer.getTraces()[0];
    const authSpan = Array.from(trace.spans.values()).find(s => s.layer === 'auth');
    expect(authSpan!.attributes['auth.result']).toBe('denied');
    expect(authSpan!.status).toBe('error');
  });
});

describe('Error instrumentor', () => {
  it('traceError records error attributes on span', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    traceError(root, new Error('Something broke'), 'loader');
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.status).toBe('error');
    expect(rootSpan.attributes['error.phase']).toBe('loader');
    expect(rootSpan.attributes['error.class']).toBe('Error');
  });

  it('withErrorCapture catches and rethrows', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    expect(() => {
      withErrorCapture(root, 'render', () => { throw new Error('Render fail'); });
    }).toThrow('Render fail');

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.attributes['error.phase']).toBe('render');
  });

  it('withErrorCapture handles async errors', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    try {
      await withErrorCapture(root, 'middleware', async () => { throw new Error('async fail'); });
    } catch {}

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.attributes['error.phase']).toBe('middleware');
  });
});

describe('Build instrumentor', () => {
  it('traceBuildStage wraps a stage', () => {
    const tracer = createTracer();
    const root = traceBuild(tracer, 'production build');

    traceBuildStage(root, 'route-discovery', () => {
      return { routes: 10 };
    }, { filesCount: 25 });

    root.end();
    const trace = tracer.getTraces()[0];
    const buildSpan = Array.from(trace.spans.values()).find(s => s.name === 'build:route-discovery');
    expect(buildSpan).toBeDefined();
    expect(buildSpan!.attributes['build.stage']).toBe('route-discovery');
    expect(buildSpan!.attributes['build.files_count']).toBe(25);
  });
});

describe('Islands instrumentor', () => {
  it('traceHydration wraps hydration', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceHydration(root, 'Counter', 'load', () => {
      // hydration
    }, { propsSize: 128 });

    root.end();
    const trace = tracer.getTraces()[0];
    const span = Array.from(trace.spans.values()).find(s => s.name === 'hydrate:Counter');
    expect(span).toBeDefined();
    expect(span!.attributes['island.component']).toBe('Counter');
    expect(span!.attributes['island.strategy']).toBe('load');
    expect(span!.attributes['island.props_size']).toBe(128);
  });

  it('recordHydration adds event', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordHydration(root, 'Sidebar', 'visible', 25.5);
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events).toHaveLength(1);
    expect(rootSpan.events[0].name).toBe('island.hydrated');
  });
});

describe('Signals instrumentor', () => {
  it('recordSignalUpdate adds event', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordSignalUpdate(root, 'count', { subscriberCount: 3 });
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].name).toBe('signal.update');
    expect(rootSpan.events[0].attributes?.name).toBe('count');
  });

  it('recordSignalBatch adds batch event', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordSignalBatch(root, ['count', 'total', 'items']);
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].name).toBe('signal.batch');
    expect(rootSpan.events[0].attributes?.count).toBe(3);
  });
});

describe('Routing instrumentor', () => {
  it('recordRouteMatch adds attributes for matched route', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordRouteMatch(root, {
      route: { id: 'blog-slug', path: '/blog/[slug]' },
      params: { slug: 'hello' },
    });
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.attributes['route.pattern']).toBe('/blog/[slug]');
    expect(rootSpan.events[0].name).toBe('route.matched');
  });

  it('recordRouteMatch adds event for miss', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordRouteMatch(root, null);
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].name).toBe('route.miss');
  });
});

describe('Database instrumentor', () => {
  it('tracedAdapter wraps query methods', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query(sql: string, params?: unknown[]) {
        return [{ id: 1, name: 'Alice' }];
      },
      async execute(sql: string) {
        return { changes: 1 };
      },
      notADbMethod() { return 'skip'; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);

    const result = await traced.query!('SELECT * FROM users WHERE id = ?', [1]);
    expect(result).toEqual([{ id: 1, name: 'Alice' }]);

    const execResult = await traced.execute!('UPDATE users SET name = ? WHERE id = ?');
    expect(execResult).toEqual({ changes: 1 });

    root.end();
    const trace = tracer.getTraces()[0];
    // root + db.query + db.execute = 3
    expect(trace.spans.size).toBe(3);

    const querySpan = Array.from(trace.spans.values()).find(s => s.name === 'db.query');
    expect(querySpan).toBeDefined();
    expect(querySpan!.attributes['db.operation']).toBe('query');
    expect(querySpan!.attributes['db.param_count']).toBe(1);
    expect(querySpan!.attributes['db.row_count']).toBe(1);
  });

  it('tracedAdapter passes through non-db methods', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      notADbMethod() { return 'untouched'; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    expect((traced as any).notADbMethod()).toBe('untouched');

    root.end();
    const trace = tracer.getTraces()[0];
    // Only the root span, no db spans
    expect(trace.spans.size).toBe(1);
  });

  it('tracedAdapter skips tracing when no parent span', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query(sql: string) { return [{ id: 1 }]; },
    };

    // getSpan returns undefined
    const traced = tracedAdapter(mockAdapter, () => undefined);
    const result = await traced.query!('SELECT 1');
    expect(result).toEqual([{ id: 1 }]);

    root.end();
    const trace = tracer.getTraces()[0];
    // Only root, no db span created
    expect(trace.spans.size).toBe(1);
  });

  it('tracedAdapter captures db errors', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query() { throw new Error('SQLITE_ERROR'); },
    };

    const traced = tracedAdapter(mockAdapter, () => root);

    try {
      await traced.query!('INVALID SQL');
    } catch (e) {
      expect((e as Error).message).toBe('SQLITE_ERROR');
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.query');
    expect(dbSpan!.status).toBe('error');
    expect(dbSpan!.attributes['error.message']).toBe('SQLITE_ERROR');
  });

  it('traceQuery wraps async query', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await traceQuery(root, 'select', 'SELECT * FROM users', async () => {
      return [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
    });

    expect(result).toHaveLength(2);
    root.end();

    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.select');
    expect(dbSpan).toBeDefined();
    expect(dbSpan!.attributes['db.operation']).toBe('select');
    expect(dbSpan!.attributes['db.statement']).toBe('SELECT * FROM users');
    expect(dbSpan!.attributes['db.row_count']).toBe(2);
  });

  it('traceQuery captures errors', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    try {
      await traceQuery(root, 'insert', 'INSERT INTO t VALUES(?)', async () => {
        throw new Error('constraint violation');
      });
    } catch (e) {
      expect((e as Error).message).toBe('constraint violation');
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.insert');
    expect(dbSpan!.status).toBe('error');
  });

  it('traceQuery truncates long SQL', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const longSql = 'SELECT ' + 'x'.repeat(300) + ' FROM t';
    await traceQuery(root, 'select', longSql, async () => []);
    root.end();

    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.select');
    expect((dbSpan!.attributes['db.statement'] as string).length).toBe(200);
  });
});

describe('Routing instrumentor (span-based)', () => {
  it('traceRouteMatch records match attributes', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const match = traceRouteMatch(root, () => ({
      route: { id: 'user-page', path: '/users/[id]' },
      params: { id: '42' },
    }));

    expect(match.route.path).toBe('/users/[id]');
    root.end();

    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan).toBeDefined();
    expect(routeSpan!.layer).toBe('routing');
    expect(routeSpan!.attributes['route.pattern']).toBe('/users/[id]');
    expect(routeSpan!.attributes['route.id']).toBe('user-page');
  });

  it('traceRouteMatch records 404 for no match', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const match = traceRouteMatch(root, () => null);
    expect(match).toBeNull();
    root.end();

    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.matched']).toBe(false);
    expect(routeSpan!.events.some(e => e.name === '404')).toBe(true);
  });

  it('traceRouteMatch captures errors', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    expect(() => {
      traceRouteMatch(root, () => { throw new Error('route explosion'); });
    }).toThrow('route explosion');

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.status).toBe('error');
  });

  it('traceRouteMatch records layouts', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceRouteMatch(root, () => ({
      route: { id: 'dashboard', path: '/dashboard' },
      params: {},
      layouts: [{ id: 'root-layout' }, { id: 'app-layout' }],
    }));

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.layouts']).toBe('root-layout > app-layout');
  });
});

describe('RPC instrumentor (extended)', () => {
  it('traceRPCCall captures async errors', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    try {
      await traceRPCCall(root, 'users.delete', 'mutation', async () => {
        throw new Error('Permission denied');
      });
    } catch (e) {
      expect((e as Error).message).toBe('Permission denied');
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const rpcSpan = Array.from(trace.spans.values()).find(s => s.name === 'rpc:users.delete');
    expect(rpcSpan!.status).toBe('error');
    expect(rpcSpan!.attributes['rpc.type']).toBe('mutation');
  });

  it('traceRPCCall handles sync function', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceRPCCall(root, 'health.check', 'query', () => ({ status: 'ok' }));
    expect(result).toEqual({ status: 'ok' });

    root.end();
    const trace = tracer.getTraces()[0];
    expect(trace.spans.size).toBe(2);
  });

  it('recordRPCValidation records event', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordRPCValidation(root, 'users.create', 1.5, true);
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events).toHaveLength(1);
    expect(rootSpan.events[0].name).toBe('rpc.validation');
    expect(rootSpan.events[0].attributes?.procedure).toBe('users.create');
    expect(rootSpan.events[0].attributes?.duration_ms).toBe(1.5);
    expect(rootSpan.events[0].attributes?.valid).toBe(true);
  });

  it('recordRPCValidation records failed validation', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordRPCValidation(root, 'users.create', 0.8, false);
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.valid).toBe(false);
  });
});

describe('Forms instrumentor', () => {
  it('traceFormSubmit wraps sync function', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceFormSubmit(root, 'login', () => ({ success: true }), { fieldCount: 3 });
    expect(result).toEqual({ success: true });

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:login');
    expect(formSpan).toBeDefined();
    expect(formSpan!.layer).toBe('forms');
    expect(formSpan!.attributes['form.name']).toBe('login');
    expect(formSpan!.attributes['form.field_count']).toBe(3);
  });

  it('traceFormSubmit wraps async function', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await traceFormSubmit(root, 'register', async () => {
      return { success: true, userId: '123' };
    });
    expect(result).toEqual({ success: true, userId: '123' });

    root.end();
    const trace = tracer.getTraces()[0];
    expect(trace.spans.size).toBe(2);
  });

  it('traceFormSubmit captures sync errors', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    expect(() => {
      traceFormSubmit(root, 'broken', () => { throw new Error('Validation failed'); });
    }).toThrow('Validation failed');

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:broken');
    expect(formSpan!.status).toBe('error');
  });

  it('traceFormSubmit captures async errors', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    try {
      await traceFormSubmit(root, 'signup', async () => {
        throw new Error('Server validation failed');
      });
    } catch (e) {
      expect((e as Error).message).toBe('Server validation failed');
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:signup');
    expect(formSpan!.status).toBe('error');
  });

  it('recordFormValidation records event', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordFormValidation(root, 'checkout', {
      errorCount: 2,
      validationMs: 5.3,
      errorSources: ['sync', 'schema'],
    });
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events).toHaveLength(1);
    expect(rootSpan.events[0].name).toBe('form.validation');
    expect(rootSpan.events[0].attributes?.form).toBe('checkout');
    expect(rootSpan.events[0].attributes?.error_count).toBe(2);
    expect(rootSpan.events[0].attributes?.duration_ms).toBe(5.3);
    expect(rootSpan.events[0].attributes?.sources).toBe('sync, schema');
  });

  it('recordFormValidation without errorSources', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    recordFormValidation(root, 'login', { errorCount: 0, validationMs: 1.0 });
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.sources).toBeUndefined();
  });
});

describe('Auth instrumentor (async)', () => {
  it('traces async successful auth check', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await traceAuthCheck(root, 'requireAuth', async () => {
      return { userId: '456', role: 'admin' };
    }, { provider: 'jwt', roles: ['admin'] });

    expect(result).toEqual({ userId: '456', role: 'admin' });
    root.end();

    const trace = tracer.getTraces()[0];
    const authSpan = Array.from(trace.spans.values()).find(s => s.layer === 'auth');
    expect(authSpan!.attributes['auth.result']).toBe('ok');
    expect(authSpan!.attributes['auth.provider']).toBe('jwt');
    expect(authSpan!.attributes['auth.roles']).toBe('admin');
  });

  it('traces async failed auth check', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    try {
      await traceAuthCheck(root, 'requireRoles', async () => {
        throw new Error('Forbidden');
      }, { roles: ['superadmin'] });
    } catch (e) {
      expect((e as Error).message).toBe('Forbidden');
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const authSpan = Array.from(trace.spans.values()).find(s => s.layer === 'auth');
    expect(authSpan!.attributes['auth.result']).toBe('denied');
    expect(authSpan!.status).toBe('error');
    expect(authSpan!.attributes['auth.roles']).toBe('superadmin');
  });
});

describe('Islands instrumentor (async)', () => {
  it('traces async hydration', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await traceHydration(root, 'AsyncWidget', 'idle', async () => {
      return 'hydrated';
    }, { propsSize: 256 });

    expect(result).toBe('hydrated');
    root.end();

    const trace = tracer.getTraces()[0];
    const span = Array.from(trace.spans.values()).find(s => s.name === 'hydrate:AsyncWidget');
    expect(span).toBeDefined();
    expect(span!.attributes['island.strategy']).toBe('idle');
    expect(span!.attributes['island.props_size']).toBe(256);
  });

  it('traces async hydration failure', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    try {
      await traceHydration(root, 'BrokenWidget', 'load', async () => {
        throw new Error('Hydration mismatch');
      });
    } catch (e) {
      expect((e as Error).message).toBe('Hydration mismatch');
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const span = Array.from(trace.spans.values()).find(s => s.name === 'hydrate:BrokenWidget');
    expect(span!.status).toBe('error');
  });

  it('traces sync hydration failure', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    expect(() => {
      traceHydration(root, 'CrashWidget', 'load', () => {
        throw new Error('render crash');
      });
    }).toThrow('render crash');

    root.end();
    const trace = tracer.getTraces()[0];
    const span = Array.from(trace.spans.values()).find(s => s.name === 'hydrate:CrashWidget');
    expect(span!.status).toBe('error');
  });
});

describe('Build instrumentor (async)', () => {
  it('traces async build stage', async () => {
    const tracer = createTracer();
    const root = traceBuild(tracer, 'dev build');

    const result = await traceBuildStage(root, 'compile', async () => {
      return { files: 42 };
    }, { filesCount: 42 });

    expect(result).toEqual({ files: 42 });
    root.end();

    const trace = tracer.getTraces()[0];
    const span = Array.from(trace.spans.values()).find(s => s.name === 'build:compile');
    expect(span!.attributes['build.files_count']).toBe(42);
  });

  it('traces async build stage failure', async () => {
    const tracer = createTracer();
    const root = traceBuild(tracer);

    try {
      await traceBuildStage(root, 'bundle', async () => {
        throw new Error('Out of memory');
      });
    } catch (e) {
      expect((e as Error).message).toBe('Out of memory');
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const span = Array.from(trace.spans.values()).find(s => s.name === 'build:bundle');
    expect(span!.status).toBe('error');
  });

  it('traces sync build stage failure', () => {
    const tracer = createTracer();
    const root = traceBuild(tracer);

    expect(() => {
      traceBuildStage(root, 'parse', () => { throw new Error('syntax error'); });
    }).toThrow('syntax error');

    root.end();
    const trace = tracer.getTraces()[0];
    const span = Array.from(trace.spans.values()).find(s => s.name === 'build:parse');
    expect(span!.status).toBe('error');
  });
});

describe('Error instrumentor (extended)', () => {
  it('traceError with non-Error value', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    traceError(root, 'string error', 'action');
    root.end();

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.status).toBe('error');
    expect(rootSpan.attributes['error.phase']).toBe('action');
    // error.class should NOT be set for non-Error values
    expect(rootSpan.attributes['error.class']).toBeUndefined();
    // No error event emitted for non-Error values
    expect(rootSpan.events.filter(e => e.name === 'error')).toHaveLength(0);
  });

  it('withErrorCapture succeeds without errors', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = withErrorCapture(root, 'render', () => 'success');
    expect(result).toBe('success');

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.status).toBe('ok');
  });

  it('withErrorCapture succeeds with async function', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await withErrorCapture(root, 'loader', async () => 'async-ok');
    expect(result).toBe('async-ok');

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.status).toBe('ok');
  });
});
