import { describe, it, expect } from 'bun:test';
import { createTracer } from '../tracer';
import { traceMiddleware } from '../instrumentors/request';
import { getTracer, getActiveSpan } from '../context';
import type { AppContext } from '@ereo/core';

/** Minimal AppContext mock that implements the interface */
function createMockContext(url: string = 'http://localhost/'): AppContext {
  const store = new Map<string, unknown>();
  return {
    cache: { set() {}, get: () => undefined, getTags: () => [], addTags() {} },
    get<T>(key: string): T | undefined { return store.get(key) as T | undefined; },
    set<T>(key: string, value: T): void { store.set(key, value); },
    responseHeaders: new Headers(),
    url: new URL(url),
    env: {},
  };
}

describe('traceMiddleware', () => {
  it('creates a trace for each request', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer);

    const request = new Request('http://localhost/api/users');
    const context = createMockContext('http://localhost/api/users');
    const next = async () => new Response('OK', { status: 200 });

    const response = await mw(request, context, next);

    expect(response.status).toBe(200);

    // Verify trace was recorded
    const traces = tracer.getTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].metadata.method).toBe('GET');
    expect(traces[0].metadata.pathname).toBe('/api/users');

    // Verify trace ID header
    expect(response.headers.get('X-Ereo-Trace-Id')).toBeTruthy();
  });

  it('attaches tracer to request context', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer);

    const request = new Request('http://localhost/test');
    const context = createMockContext('http://localhost/test');

    let capturedTracer: unknown = null;
    let capturedSpan: unknown = null;

    const next = async () => {
      capturedTracer = getTracer(context);
      capturedSpan = getActiveSpan(context);
      return new Response('OK');
    };

    await mw(request, context, next);

    expect(capturedTracer).toBe(tracer);
    expect(capturedSpan).toBeTruthy();
  });

  it('records status code in trace', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer);

    const request = new Request('http://localhost/not-found');
    const context = createMockContext('http://localhost/not-found');
    const next = async () => new Response('Not Found', { status: 404 });

    await mw(request, context, next);

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.attributes['http.status_code']).toBe(404);
    expect(rootSpan.attributes['http.error']).toBe(true);
  });

  it('captures errors', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer);

    const request = new Request('http://localhost/error');
    const context = createMockContext('http://localhost/error');
    const next = async () => { throw new Error('Server error'); };

    try {
      await mw(request, context, next);
    } catch (e) {
      expect((e as Error).message).toBe('Server error');
    }

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.status).toBe('error');
    expect(rootSpan.attributes['http.status_code']).toBe(500);
  });

  it('skips excluded paths', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer, { exclude: ['/_ereo/', '/favicon.ico'] });

    const request = new Request('http://localhost/_ereo/client.js');
    const context = createMockContext('http://localhost/_ereo/client.js');
    const next = async () => new Response('JS');

    await mw(request, context, next);

    expect(tracer.getTraces()).toHaveLength(0);
  });

  it('does not skip non-excluded paths', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer, { exclude: ['/_ereo/'] });

    const request = new Request('http://localhost/api/data');
    const context = createMockContext('http://localhost/api/data');
    const next = async () => new Response('data');

    await mw(request, context, next);

    expect(tracer.getTraces()).toHaveLength(1);
  });

  it('reads incoming X-Ereo-Trace-Id header', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer);

    const request = new Request('http://localhost/test', {
      headers: { 'X-Ereo-Trace-Id': 'client-trace-abc123' },
    });
    const context = createMockContext('http://localhost/test');
    const next = async () => new Response('OK');

    await mw(request, context, next);

    const trace = tracer.getTraces()[0];
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.attributes['trace.client_id']).toBe('client-trace-abc123');
  });

  it('records request method and path for POST', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer);

    const request = new Request('http://localhost/api/users', { method: 'POST' });
    const context = createMockContext('http://localhost/api/users');
    const next = async () => new Response('Created', { status: 201 });

    const response = await mw(request, context, next);

    const trace = tracer.getTraces()[0];
    expect(trace.metadata.method).toBe('POST');
    const rootSpan = trace.spans.get(trace.rootSpanId)!;
    expect(rootSpan.attributes['http.method']).toBe('POST');
    expect(rootSpan.attributes['http.status_code']).toBe(201);
  });

  it('handles multiple sequential requests', async () => {
    const tracer = createTracer();
    const mw = traceMiddleware(tracer);

    for (let i = 0; i < 5; i++) {
      const request = new Request(`http://localhost/page/${i}`);
      const context = createMockContext(`http://localhost/page/${i}`);
      const next = async () => new Response('OK');
      await mw(request, context, next);
    }

    expect(tracer.getTraces()).toHaveLength(5);
  });
});
