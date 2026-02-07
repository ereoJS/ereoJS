import { describe, it, expect } from 'bun:test';
import { createTracer } from '../tracer';
import type { SpanData, TraceStreamEvent } from '../types';

describe('Tracer', () => {
  it('creates a trace with root span', () => {
    const tracer = createTracer();
    const span = tracer.startTrace('GET /', 'request', { method: 'GET', pathname: '/' });
    expect(span.id).toBeTruthy();
    expect(span.traceId).toBeTruthy();
  });

  it('stores completed traces', () => {
    const tracer = createTracer();
    const span = tracer.startTrace('GET /', 'request');
    span.end();

    const traces = tracer.getTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].id).toBe(span.traceId);
  });

  it('retrieves trace by ID', () => {
    const tracer = createTracer();
    const span = tracer.startTrace('GET /test', 'request');
    const traceId = span.traceId;
    span.end();

    const trace = tracer.getTrace(traceId);
    expect(trace).toBeDefined();
    expect(trace?.id).toBe(traceId);
  });

  it('startSpan creates child of active span', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /', 'request');
    const child = root.child('route.match', 'routing');
    child.end();
    root.end();

    const traces = tracer.getTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].spans.size).toBe(2);
  });

  it('withSpan auto-ends span on sync function', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    tracer.withSpan('sync-op', 'data', (span) => {
      span.setAttribute('key', 'value');
      return 42;
    });
    root.end();

    const traces = tracer.getTraces();
    expect(traces[0].spans.size).toBe(2);
  });

  it('withSpan auto-ends span on async function', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');
    const result = await tracer.withSpan('async-op', 'data', async (span) => {
      span.setAttribute('async', true);
      return 'done';
    });
    expect(result).toBe('done');
    root.end();

    const traces = tracer.getTraces();
    expect(traces[0].spans.size).toBe(2);
  });

  it('withSpan captures errors', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('test', 'request');

    expect(() => {
      tracer.withSpan('fail-op', 'data', () => {
        throw new Error('boom');
      });
    }).toThrow('boom');

    root.end();
    const traces = tracer.getTraces();
    const failSpan = Array.from(traces[0].spans.values()).find((s) => s.name === 'fail-op');
    expect(failSpan?.status).toBe('error');
  });

  it('emits events to subscribers', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    tracer.subscribe((e) => events.push(e));

    const span = tracer.startTrace('test', 'request');
    span.end();

    expect(events.length).toBeGreaterThan(0);
    const traceEnd = events.find((e) => e.type === 'trace:end');
    expect(traceEnd).toBeDefined();
  });

  it('unsubscribe stops events', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    const unsub = tracer.subscribe((e) => events.push(e));

    const span1 = tracer.startTrace('test1', 'request');
    span1.end();
    const countAfterFirst = events.length;

    unsub();

    const span2 = tracer.startTrace('test2', 'request');
    span2.end();
    expect(events.length).toBe(countAfterFirst);
  });

  it('respects maxTraces config', () => {
    const tracer = createTracer({ maxTraces: 2 });

    for (let i = 0; i < 5; i++) {
      const span = tracer.startTrace(`req ${i}`, 'request');
      span.end();
    }

    expect(tracer.getTraces()).toHaveLength(2);
  });

  it('records trace metadata', () => {
    const tracer = createTracer();
    const span = tracer.startTrace('GET /api', 'request', {
      method: 'GET',
      pathname: '/api',
      origin: 'server',
    });
    span.end();

    const trace = tracer.getTraces()[0];
    expect(trace.metadata.method).toBe('GET');
    expect(trace.metadata.pathname).toBe('/api');
    expect(trace.metadata.origin).toBe('server');
  });

  it('isolates concurrent traces via span.child()', () => {
    const tracer = createTracer();

    // Two traces active simultaneously on the same tracer
    const rootA = tracer.startTrace('GET /a', 'request');
    const rootB = tracer.startTrace('GET /b', 'request');

    // Create children via span.child() (the primary instrumentor API)
    const childA = rootA.child('auth', 'auth');
    const childB = rootB.child('auth', 'auth');
    const grandchildA = childA.child('db.query', 'database');

    // End in interleaved order
    grandchildA.end();
    childB.end();
    childA.end();
    rootB.end();
    rootA.end();

    const traces = tracer.getTraces();
    expect(traces).toHaveLength(2);

    const traceA = traces.find((t) => t.id === rootA.traceId)!;
    const traceB = traces.find((t) => t.id === rootB.traceId)!;

    // Trace A: root + auth + db.query = 3 spans
    expect(traceA.spans.size).toBe(3);
    // Trace B: root + auth = 2 spans
    expect(traceB.spans.size).toBe(2);

    // All spans in A must belong to A's trace
    for (const span of traceA.spans.values()) {
      expect(span.traceId).toBe(rootA.traceId);
    }
    // All spans in B must belong to B's trace
    for (const span of traceB.spans.values()) {
      expect(span.traceId).toBe(rootB.traceId);
    }

    // Parent-child relationships must be within the same trace
    const authA = Array.from(traceA.spans.values()).find((s) => s.name === 'auth')!;
    expect(authA.parentId).toBe(rootA.id);

    const dbA = Array.from(traceA.spans.values()).find((s) => s.name === 'db.query')!;
    expect(dbA.parentId).toBe(childA.id);

    const authB = Array.from(traceB.spans.values()).find((s) => s.name === 'auth')!;
    expect(authB.parentId).toBe(rootB.id);
  });

  it('emits span:event when span records an event', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    tracer.subscribe((e) => events.push(e));

    const root = tracer.startTrace('test', 'request');
    root.event('cache.hit', { key: 'user:1' });
    root.end();

    const spanEvents = events.filter((e) => e.type === 'span:event');
    expect(spanEvents).toHaveLength(1);
    expect(spanEvents[0].type === 'span:event' && spanEvents[0].event.name).toBe('cache.hit');
  });

  it('enforces maxSpansPerTrace', () => {
    const tracer = createTracer({ maxSpansPerTrace: 3 });
    const root = tracer.startTrace('test', 'request');

    // Create 5 child spans (root + 5 = 6, but limit is 3)
    const children = [];
    for (let i = 0; i < 5; i++) {
      const child = root.child(`child-${i}`, 'data');
      children.push(child);
    }

    // End all in reverse
    for (const child of children.reverse()) {
      child.end();
    }
    root.end();

    const trace = tracer.getTraces()[0];
    // Should be capped at maxSpansPerTrace
    expect(trace.spans.size).toBe(3);
  });

  it('startSpan creates orphan trace when no active trace', () => {
    const tracer = createTracer();
    // No startTrace called, so startSpan should create an orphan
    const span = tracer.startSpan('orphan', 'data');
    expect(span.id).toBeTruthy();
    expect(span.traceId).toBeTruthy();
    span.end();

    const traces = tracer.getTraces();
    expect(traces).toHaveLength(1);
  });

  it('minDuration filter drops short traces', () => {
    const tracer = createTracer({ minDuration: 1000 });
    // This trace will be near-instant, well under 1000ms
    const span = tracer.startTrace('fast', 'request');
    span.end();

    expect(tracer.getTraces()).toHaveLength(0);
  });

  it('minDuration filter keeps long traces', async () => {
    const tracer = createTracer({ minDuration: 1 });
    const span = tracer.startTrace('slow', 'request');
    // Wait a bit to exceed minDuration
    await new Promise((r) => setTimeout(r, 5));
    span.end();

    expect(tracer.getTraces()).toHaveLength(1);
  });

  it('mergeClientSpans adds spans to completed trace', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /', 'request');
    const traceId = root.traceId;
    root.end();

    const clientSpan: SpanData = {
      id: 'client-span-1',
      traceId,
      parentId: root.id,
      name: 'fetch',
      layer: 'request',
      status: 'ok',
      startTime: 100,
      endTime: 200,
      duration: 100,
      attributes: {},
      events: [],
      children: [],
    };

    tracer.mergeClientSpans(traceId, [clientSpan]);

    const trace = tracer.getTrace(traceId)!;
    expect(trace.spans.size).toBe(2); // root + client span
    expect(trace.spans.get('client-span-1')).toBeDefined();
  });

  it('mergeClientSpans updates endTime if client span is later', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /', 'request');
    const traceId = root.traceId;
    root.end();

    const trace = tracer.getTrace(traceId)!;
    const originalEndTime = trace.endTime;

    const clientSpan: SpanData = {
      id: 'late-span',
      traceId,
      parentId: root.id,
      name: 'hydrate',
      layer: 'islands',
      status: 'ok',
      startTime: 100,
      endTime: originalEndTime + 5000,
      duration: 5000,
      attributes: {},
      events: [],
      children: [],
    };

    tracer.mergeClientSpans(traceId, [clientSpan]);

    expect(trace.endTime).toBe(originalEndTime + 5000);
    expect(trace.duration).toBe(trace.endTime - trace.startTime);
  });

  it('mergeClientSpans ignores unknown traceId', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /', 'request');
    root.end();

    // Should not throw
    tracer.mergeClientSpans('nonexistent-trace-id', [{
      id: 'x',
      traceId: 'nonexistent-trace-id',
      parentId: null,
      name: 'orphan',
      layer: 'request',
      status: 'ok',
      startTime: 0,
      endTime: 0,
      duration: 0,
      attributes: {},
      events: [],
      children: [],
    }]);

    // Only the original trace exists
    expect(tracer.getTraces()).toHaveLength(1);
  });

  it('mergeClientSpans respects maxSpansPerTrace', () => {
    const tracer = createTracer({ maxSpansPerTrace: 2 });
    const root = tracer.startTrace('GET /', 'request');
    const traceId = root.traceId;
    root.end();

    // Trace already has 1 span (root), max is 2, so only 1 more fits
    const clientSpans: SpanData[] = Array.from({ length: 5 }, (_, i) => ({
      id: `client-${i}`,
      traceId,
      parentId: root.id,
      name: `span-${i}`,
      layer: 'request' as const,
      status: 'ok' as const,
      startTime: 0,
      endTime: 0,
      duration: 0,
      attributes: {},
      events: [],
      children: [],
    }));

    tracer.mergeClientSpans(traceId, clientSpans);

    const trace = tracer.getTrace(traceId)!;
    expect(trace.spans.size).toBe(2); // capped at maxSpansPerTrace
  });

  it('handles nested child spans', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('request', 'request');
    const routing = root.child('routing', 'routing');
    const data = root.child('data', 'data');
    const db = data.child('db.query', 'database');
    db.end();
    data.end();
    routing.end();
    root.end();

    const traces = tracer.getTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].spans.size).toBe(4);

    const rootData = traces[0].spans.get(root.id);
    expect(rootData?.children).toContain(routing.id);
    expect(rootData?.children).toContain(data.id);

    const dataSpan = traces[0].spans.get(data.id);
    expect(dataSpan?.children).toContain(db.id);
  });
});
