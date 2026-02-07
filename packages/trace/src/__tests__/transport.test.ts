import { describe, it, expect } from 'bun:test';
import { serializeTrace, deserializeTrace, serializeEvent, createTracesAPIHandler } from '../transport';
import { createTracer } from '../tracer';
import type { TraceData, TraceStreamEvent, SpanData } from '../types';

describe('serializeTrace / deserializeTrace', () => {
  it('round-trips a trace', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /', 'request', { method: 'GET', pathname: '/' });
    const child = root.child('route.match', 'routing');
    child.setAttribute('route.pattern', '/');
    child.end();
    root.setAttribute('http.status_code', 200);
    root.end();

    const trace = tracer.getTraces()[0];
    expect(trace).toBeDefined();

    const serialized = serializeTrace(trace);
    // serialized.spans should be a plain object, not a Map
    expect(serialized.spans).not.toBeInstanceOf(Map);
    expect(typeof serialized.spans).toBe('object');
    expect(Object.keys(serialized.spans).length).toBe(2);

    const deserialized = deserializeTrace(serialized);
    expect(deserialized.spans).toBeInstanceOf(Map);
    expect(deserialized.spans.size).toBe(2);
    expect(deserialized.id).toBe(trace.id);
    expect(deserialized.metadata.method).toBe('GET');
    expect(deserialized.metadata.pathname).toBe('/');
  });
});

describe('serializeEvent', () => {
  it('serializes trace:start events', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    tracer.subscribe((e) => events.push(e));

    const root = tracer.startTrace('GET /', 'request', { method: 'GET', pathname: '/' });
    root.end();

    const startEvent = events.find((e) => e.type === 'trace:start')!;
    const serialized = serializeEvent(startEvent);
    expect(serialized.type).toBe('trace:start');
    if (serialized.type === 'trace:start') {
      expect(serialized.trace.spans).not.toBeInstanceOf(Map);
      expect(typeof serialized.trace.spans).toBe('object');
    }
  });

  it('serializes trace:end events', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    tracer.subscribe((e) => events.push(e));

    const root = tracer.startTrace('GET /', 'request');
    root.end();

    const endEvent = events.find((e) => e.type === 'trace:end')!;
    const serialized = serializeEvent(endEvent);
    expect(serialized.type).toBe('trace:end');
    if (serialized.type === 'trace:end') {
      expect(serialized.trace.id).toBe(root.traceId);
      expect(typeof serialized.trace.spans).toBe('object');
    }
  });

  it('serializes span:start events unchanged', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    tracer.subscribe((e) => events.push(e));

    const root = tracer.startTrace('test', 'request');
    root.end();

    const spanStart = events.find((e) => e.type === 'span:start')!;
    const serialized = serializeEvent(spanStart);
    expect(serialized.type).toBe('span:start');
    if (serialized.type === 'span:start') {
      expect(serialized.span.name).toBe('test');
    }
  });

  it('serializes span:end events unchanged', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    tracer.subscribe((e) => events.push(e));

    const root = tracer.startTrace('test', 'request');
    root.end();

    const spanEnd = events.find((e) => e.type === 'span:end')!;
    const serialized = serializeEvent(spanEnd);
    expect(serialized.type).toBe('span:end');
    if (serialized.type === 'span:end') {
      expect(serialized.span.name).toBe('test');
    }
  });

  it('serializes span:event events unchanged', () => {
    const tracer = createTracer();
    const events: TraceStreamEvent[] = [];
    tracer.subscribe((e) => events.push(e));

    const root = tracer.startTrace('test', 'request');
    root.event('cache.hit', { key: 'user:1' });
    root.end();

    const spanEvent = events.find((e) => e.type === 'span:event')!;
    const serialized = serializeEvent(spanEvent);
    expect(serialized.type).toBe('span:event');
    if (serialized.type === 'span:event') {
      expect(serialized.event.name).toBe('cache.hit');
    }
  });
});

describe('createTracesAPIHandler', () => {
  it('returns all traces as JSON', () => {
    const tracer = createTracer();

    const root = tracer.startTrace('GET /api', 'request', { method: 'GET', pathname: '/api' });
    root.end();

    const handler = createTracesAPIHandler(tracer);
    const response = handler(new Request('http://localhost/__devtools/api/traces'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns single trace by ID', async () => {
    const tracer = createTracer();

    const root = tracer.startTrace('GET /test', 'request');
    const traceId = root.traceId;
    root.end();

    const handler = createTracesAPIHandler(tracer);
    const response = handler(new Request(`http://localhost/__devtools/api/traces?id=${traceId}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(traceId);
  });

  it('returns 404 for unknown trace ID', () => {
    const tracer = createTracer();
    const handler = createTracesAPIHandler(tracer);
    const response = handler(new Request('http://localhost/__devtools/api/traces?id=nonexistent'));
    expect(response.status).toBe(404);
  });
});
