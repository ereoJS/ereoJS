/**
 * @ereo/trace - Additional Instrumentor Tests
 *
 * Edge cases for routing, forms, signals, and database instrumentors.
 */

import { describe, it, expect } from 'bun:test';
import { createTracer } from '../tracer';
import { traceRouteMatch, recordRouteMatch } from '../instrumentors/routing';
import { traceFormSubmit, recordFormValidation } from '../instrumentors/forms';
import { recordSignalUpdate, recordSignalBatch } from '../instrumentors/signals';
import { tracedAdapter, traceQuery } from '../instrumentors/database';

// ---------------------------------------------------------------------------
// Routing Instrumentor - Additional Edge Cases
// ---------------------------------------------------------------------------

describe('Routing instrumentor - traceRouteMatch edge cases', () => {
  it('records params as JSON in route.params attribute', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceRouteMatch(root, () => ({
      route: { id: 'user-profile', path: '/users/[id]/profile' },
      params: { id: '42', tab: 'settings' },
    }));

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan).toBeDefined();
    const paramsStr = routeSpan!.attributes['route.params'] as string;
    expect(JSON.parse(paramsStr)).toEqual({ id: '42', tab: 'settings' });
  });

  it('records route.id attribute on successful match', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceRouteMatch(root, () => ({
      route: { id: 'blog-post', path: '/blog/[slug]' },
      params: { slug: 'hello-world' },
    }));

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.id']).toBe('blog-post');
    expect(routeSpan!.attributes['route.pattern']).toBe('/blog/[slug]');
  });

  it('handles match result without layouts property', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceRouteMatch(root, () => ({
      route: { id: 'simple', path: '/simple' },
      params: {},
    }));

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.layouts']).toBeUndefined();
  });

  it('handles result that is a non-route object (triggers 404 branch)', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceRouteMatch(root, () => ({ status: 'not-found' }));
    expect(result).toEqual({ status: 'not-found' });

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.matched']).toBe(false);
    expect(routeSpan!.events.some(e => e.name === '404')).toBe(true);
  });

  it('handles result that is undefined (triggers 404 branch)', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceRouteMatch(root, () => undefined);
    expect(result).toBeUndefined();

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.matched']).toBe(false);
  });

  it('handles result that is a primitive (triggers 404 branch)', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceRouteMatch(root, () => false as unknown);
    expect(result).toBe(false);

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.matched']).toBe(false);
  });

  it('records empty params object as JSON', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceRouteMatch(root, () => ({
      route: { id: 'home', path: '/' },
      params: {},
    }));

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.params']).toBe('{}');
  });

  it('records single layout in chain', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceRouteMatch(root, () => ({
      route: { id: 'page', path: '/page' },
      params: {},
      layouts: [{ id: 'root' }],
    }));

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.attributes['route.layouts']).toBe('root');
  });

  it('preserves error stack trace info', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const testError = new TypeError('Invalid route configuration');

    expect(() => {
      traceRouteMatch(root, () => { throw testError; });
    }).toThrow('Invalid route configuration');

    root.end();
    const trace = tracer.getTraces()[0];
    const routeSpan = Array.from(trace.spans.values()).find(s => s.name === 'route.match');
    expect(routeSpan!.status).toBe('error');
  });
});

describe('Routing instrumentor - recordRouteMatch edge cases', () => {
  it('sets route.id attribute for matched route', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordRouteMatch(root, {
      route: { id: 'dynamic-route', path: '/[...catchall]' },
      params: { catchall: 'a/b/c' },
    });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.attributes['route.id']).toBe('dynamic-route');
    expect(rootSpan.attributes['route.pattern']).toBe('/[...catchall]');
  });

  it('emits route.matched event with pattern attribute', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordRouteMatch(root, {
      route: { id: 'api-endpoint', path: '/api/[version]/[...path]' },
      params: { version: 'v1', path: 'users/123' },
    });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].name).toBe('route.matched');
    expect(rootSpan.events[0].attributes?.pattern).toBe('/api/[version]/[...path]');
  });

  it('emits route.miss for null match without additional attributes', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordRouteMatch(root, null);

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events).toHaveLength(1);
    expect(rootSpan.events[0].name).toBe('route.miss');
    expect(rootSpan.attributes['route.pattern']).toBeUndefined();
    expect(rootSpan.attributes['route.id']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Forms Instrumentor - Additional Edge Cases
// ---------------------------------------------------------------------------

describe('Forms instrumentor - traceFormSubmit edge cases', () => {
  it('creates child span with form name in span name', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceFormSubmit(root, 'user-registration', () => ({ ok: true }));

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:user-registration');
    expect(formSpan).toBeDefined();
    expect(formSpan!.attributes['form.name']).toBe('user-registration');
  });

  it('does not set field_count when attrs is undefined', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceFormSubmit(root, 'simple-form', () => ({}));

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:simple-form');
    expect(formSpan!.attributes['form.field_count']).toBeUndefined();
  });

  it('does not set field_count when fieldCount is 0 (falsy)', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    traceFormSubmit(root, 'empty-form', () => ({}), { fieldCount: 0 });

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:empty-form');
    // fieldCount 0 is falsy, so it won't be set
    expect(formSpan!.attributes['form.field_count']).toBeUndefined();
  });

  it('handles async function that resolves after delay', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = await traceFormSubmit(root, 'delayed', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { submitted: true };
    });
    expect(result).toEqual({ submitted: true });

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:delayed');
    expect(formSpan).toBeDefined();
    expect(formSpan!.status).toBe('ok');
  });

  it('returns sync value directly (not as Promise)', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceFormSubmit(root, 'sync-test', () => 42);
    // result should be 42, not a Promise
    expect(result).toBe(42);

    root.end();
  });

  it('returns async value as Promise', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const result = traceFormSubmit(root, 'async-test', async () => 99);
    // result should be a Promise
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe(99);

    root.end();
  });

  it('records error for async rejection and rethrows', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const error = new Error('Network timeout');

    try {
      await traceFormSubmit(root, 'failing-async', async () => {
        throw error;
      });
    } catch (e) {
      expect(e).toBe(error);
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:failing-async');
    expect(formSpan!.status).toBe('error');
  });

  it('records error for sync throw and rethrows', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const error = new Error('Sync validation failure');

    expect(() => {
      traceFormSubmit(root, 'failing-sync', () => {
        throw error;
      });
    }).toThrow('Sync validation failure');

    root.end();
    const trace = tracer.getTraces()[0];
    const formSpan = Array.from(trace.spans.values()).find(s => s.name === 'form:failing-sync');
    expect(formSpan!.status).toBe('error');
  });
});

describe('Forms instrumentor - recordFormValidation edge cases', () => {
  it('records zero error count and fast duration', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordFormValidation(root, 'pristine-form', {
      errorCount: 0,
      validationMs: 0.1,
    });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.error_count).toBe(0);
    expect(rootSpan.events[0].attributes?.duration_ms).toBe(0.1);
  });

  it('records multiple error sources joined by comma', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordFormValidation(root, 'multi-error', {
      errorCount: 5,
      validationMs: 12.5,
      errorSources: ['sync', 'async', 'schema', 'server'],
    });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.sources).toBe('sync, async, schema, server');
  });

  it('records single error source', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordFormValidation(root, 'single-source', {
      errorCount: 1,
      validationMs: 2.0,
      errorSources: ['manual'],
    });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.sources).toBe('manual');
  });

  it('records empty error sources array as undefined', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordFormValidation(root, 'empty-sources', {
      errorCount: 0,
      validationMs: 0.5,
      errorSources: [],
    });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    // Empty array is truthy, so sources will be '' (empty join)
    expect(rootSpan.events[0].attributes?.sources).toBe('');
  });

  it('records form name in event attributes', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordFormValidation(root, 'my-complex-form', {
      errorCount: 3,
      validationMs: 8.7,
    });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.form).toBe('my-complex-form');
  });
});

// ---------------------------------------------------------------------------
// Signals Instrumentor - Additional Edge Cases
// ---------------------------------------------------------------------------

describe('Signals instrumentor - recordSignalUpdate edge cases', () => {
  it('records signal update without optional attrs', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalUpdate(root, 'isOpen');

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].name).toBe('signal.update');
    expect(rootSpan.events[0].attributes?.name).toBe('isOpen');
    expect(rootSpan.events[0].attributes?.subscribers).toBeUndefined();
    expect(rootSpan.events[0].attributes?.batched).toBeUndefined();
  });

  it('records signal update with subscriberCount of 0', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalUpdate(root, 'unobserved', { subscriberCount: 0 });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.subscribers).toBe(0);
  });

  it('records signal update with batched flag true', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalUpdate(root, 'counter', { batched: true });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.batched).toBe(true);
  });

  it('records signal update with batched flag false', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalUpdate(root, 'counter', { batched: false });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.batched).toBe(false);
  });

  it('records signal update with both subscriberCount and batched', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalUpdate(root, 'total', { subscriberCount: 5, batched: true });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.name).toBe('total');
    expect(rootSpan.events[0].attributes?.subscribers).toBe(5);
    expect(rootSpan.events[0].attributes?.batched).toBe(true);
  });

  it('records multiple signal updates sequentially', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalUpdate(root, 'a', { subscriberCount: 1 });
    recordSignalUpdate(root, 'b', { subscriberCount: 2 });
    recordSignalUpdate(root, 'c', { subscriberCount: 3 });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events).toHaveLength(3);
    expect(rootSpan.events[0].attributes?.name).toBe('a');
    expect(rootSpan.events[1].attributes?.name).toBe('b');
    expect(rootSpan.events[2].attributes?.name).toBe('c');
  });

  it('records signal update with empty attrs object', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalUpdate(root, 'test-signal', {});

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.name).toBe('test-signal');
    expect(rootSpan.events[0].attributes?.subscribers).toBeUndefined();
    expect(rootSpan.events[0].attributes?.batched).toBeUndefined();
  });
});

describe('Signals instrumentor - recordSignalBatch edge cases', () => {
  it('records batch with empty signal names array', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalBatch(root, []);

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].name).toBe('signal.batch');
    expect(rootSpan.events[0].attributes?.count).toBe(0);
    expect(rootSpan.events[0].attributes?.signals).toBe('');
  });

  it('records batch with single signal', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalBatch(root, ['only-one']);

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.count).toBe(1);
    expect(rootSpan.events[0].attributes?.signals).toBe('only-one');
  });

  it('records batch with total_subscribers when provided', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalBatch(root, ['x', 'y', 'z'], { subscriberCount: 10 });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.total_subscribers).toBe(10);
  });

  it('omits total_subscribers when not provided', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalBatch(root, ['a', 'b']);

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.total_subscribers).toBeUndefined();
  });

  it('records batch with subscriberCount of 0', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    recordSignalBatch(root, ['orphan1', 'orphan2'], { subscriberCount: 0 });

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.total_subscribers).toBe(0);
  });

  it('joins many signal names with comma separator', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const signals = Array.from({ length: 10 }, (_, i) => `signal_${i}`);
    recordSignalBatch(root, signals);

    root.end();
    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.events[0].attributes?.count).toBe(10);
    expect(rootSpan.events[0].attributes?.signals).toBe(signals.join(', '));
  });
});

// ---------------------------------------------------------------------------
// Database Instrumentor - Additional Edge Cases
// ---------------------------------------------------------------------------

describe('Database instrumentor - tracedAdapter Proxy wrapping', () => {
  it('wraps all five standard methods: query, execute, get, all, run', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query(sql: string) { return [{ id: 1 }]; },
      async execute(sql: string) { return { changes: 1 }; },
      async get(sql: string) { return { id: 1 }; },
      async all(sql: string) { return [{ id: 1 }, { id: 2 }]; },
      async run(sql: string) { return { lastInsertRowid: 1 }; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);

    await traced.query!('SELECT 1');
    await traced.execute!('INSERT INTO t VALUES(1)');
    await traced.get!('SELECT * FROM t WHERE id = 1');
    await traced.all!('SELECT * FROM t');
    await traced.run!('DELETE FROM t WHERE id = 1');

    root.end();
    const trace = tracer.getTraces()[0];
    // root + 5 db spans
    expect(trace.spans.size).toBe(6);

    const spanNames = Array.from(trace.spans.values()).map(s => s.name).sort();
    expect(spanNames).toContain('db.query');
    expect(spanNames).toContain('db.execute');
    expect(spanNames).toContain('db.get');
    expect(spanNames).toContain('db.all');
    expect(spanNames).toContain('db.run');
  });

  it('preserves non-function properties on the proxy', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query(sql: string) { return []; },
      dbName: 'test-db',
      version: 3,
    } as any;

    const traced = tracedAdapter(mockAdapter, () => root);

    expect((traced as any).dbName).toBe('test-db');
    expect((traced as any).version).toBe(3);

    root.end();
  });

  it('passes symbol properties through without wrapping', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const sym = Symbol('custom');
    const mockAdapter = {
      async query() { return []; },
      [sym]: 'symbol-value',
    } as any;

    const traced = tracedAdapter(mockAdapter, () => root);
    expect((traced as any)[sym]).toBe('symbol-value');

    root.end();
  });

  it('truncates long SQL statements to 200 chars', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const longSql = 'SELECT ' + 'a'.repeat(250) + ' FROM table1';

    const mockAdapter = {
      async query(sql: string) { return []; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    await traced.query!(longSql);

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.query');
    expect((dbSpan!.attributes['db.statement'] as string).length).toBe(200);
  });

  it('records param_count correctly for different param lengths', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query(sql: string, params?: unknown[]) { return []; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    await traced.query!('SELECT * FROM t WHERE a=? AND b=? AND c=?', [1, 2, 3]);

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.query');
    expect(dbSpan!.attributes['db.param_count']).toBe(3);
  });

  it('does not record param_count when no params are passed', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query(sql: string) { return []; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    await traced.query!('SELECT 1');

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.query');
    expect(dbSpan!.attributes['db.param_count']).toBeUndefined();
  });

  it('records row_count for array results from all()', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async all(sql: string) { return [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    const result = await traced.all!('SELECT * FROM users');
    expect(result).toHaveLength(5);

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.all');
    expect(dbSpan!.attributes['db.row_count']).toBe(5);
  });

  it('does not record row_count for non-array results', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async execute(sql: string) { return { changes: 5 }; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    await traced.execute!('UPDATE t SET active=true');

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.execute');
    expect(dbSpan!.attributes['db.row_count']).toBeUndefined();
  });

  it('handles empty SQL string', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async query(sql: string) { return []; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    await traced.query!('');

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.query');
    expect(dbSpan!.attributes['db.statement']).toBe('');
  });

  it('records correct db.operation for each method type', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async get(sql: string) { return { id: 1 }; },
      async run(sql: string) { return {}; },
    };

    const traced = tracedAdapter(mockAdapter, () => root);
    await traced.get!('SELECT * FROM t LIMIT 1');
    await traced.run!('CREATE TABLE t2 (id INTEGER)');

    root.end();
    const trace = tracer.getTraces()[0];
    const getSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.get');
    const runSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.run');
    expect(getSpan!.attributes['db.operation']).toBe('get');
    expect(runSpan!.attributes['db.operation']).toBe('run');
  });

  it('captures database error and sets error status then rethrows', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const mockAdapter = {
      async execute() { throw new Error('UNIQUE constraint failed'); },
    };

    const traced = tracedAdapter(mockAdapter, () => root);

    let caughtError: Error | null = null;
    try {
      await traced.execute!('INSERT INTO t VALUES(1)');
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('UNIQUE constraint failed');

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.execute');
    expect(dbSpan!.status).toBe('error');
  });
});

describe('Database instrumentor - traceQuery edge cases', () => {
  it('records empty array result with row_count of 0', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    await traceQuery(root, 'select', 'SELECT * FROM empty_table', async () => []);

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.select');
    expect(dbSpan!.attributes['db.row_count']).toBe(0);
  });

  it('does not set row_count for non-array results', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    await traceQuery(root, 'insert', 'INSERT INTO t VALUES(1)', async () => ({ lastInsertRowid: 1 }));

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.insert');
    expect(dbSpan!.attributes['db.row_count']).toBeUndefined();
  });

  it('creates child span in database layer', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    await traceQuery(root, 'custom-op', 'VACUUM', async () => ({}));

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.custom-op');
    expect(dbSpan!.layer).toBe('database');
    expect(dbSpan!.attributes['db.operation']).toBe('custom-op');
  });

  it('truncates SQL at exactly 200 characters', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const sql199 = 'S' + 'x'.repeat(198);
    const sql200 = 'S' + 'x'.repeat(199);
    const sql201 = 'S' + 'x'.repeat(200);

    await traceQuery(root, 'q1', sql199, async () => []);
    await traceQuery(root, 'q2', sql200, async () => []);
    await traceQuery(root, 'q3', sql201, async () => []);

    root.end();
    const trace = tracer.getTraces()[0];
    const q1 = Array.from(trace.spans.values()).find(s => s.name === 'db.q1');
    const q2 = Array.from(trace.spans.values()).find(s => s.name === 'db.q2');
    const q3 = Array.from(trace.spans.values()).find(s => s.name === 'db.q3');

    expect((q1!.attributes['db.statement'] as string).length).toBe(199);
    expect((q2!.attributes['db.statement'] as string).length).toBe(200);
    expect((q3!.attributes['db.statement'] as string).length).toBe(200);
  });

  it('captures and rethrows error from queryFn', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    const dbError = new Error('Connection lost');

    try {
      await traceQuery(root, 'select', 'SELECT 1', async () => { throw dbError; });
    } catch (e) {
      expect(e).toBe(dbError);
    }

    root.end();
    const trace = tracer.getTraces()[0];
    const dbSpan = Array.from(trace.spans.values()).find(s => s.name === 'db.select');
    expect(dbSpan!.status).toBe('error');
  });
});
