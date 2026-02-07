import { describe, it, expect } from 'bun:test';
import { createTracer } from '../tracer';
import { createCollector } from '../collector';
import type { SpanData } from '../types';

describe('TraceCollector', () => {
  it('mergeClientSpans delegates to tracer', () => {
    const tracer = createTracer();
    const collector = createCollector(tracer);

    const root = tracer.startTrace('GET /', 'request');
    const traceId = root.traceId;
    root.end();

    const clientSpan: SpanData = {
      id: 'client-1',
      traceId,
      parentId: root.id,
      name: 'client-fetch',
      layer: 'request',
      status: 'ok',
      startTime: 100,
      endTime: 200,
      duration: 100,
      attributes: {},
      events: [],
      children: [],
    };

    collector.mergeClientSpans(traceId, [clientSpan]);

    const trace = tracer.getTrace(traceId)!;
    expect(trace.spans.size).toBe(2);
    expect(trace.spans.get('client-1')).toBeDefined();
  });

  it('getUnifiedTrace returns merged trace', () => {
    const tracer = createTracer();
    const collector = createCollector(tracer);

    const root = tracer.startTrace('GET /page', 'request');
    const traceId = root.traceId;
    root.end();

    const clientSpan: SpanData = {
      id: 'hydrate-1',
      traceId,
      parentId: root.id,
      name: 'hydrate:Counter',
      layer: 'islands',
      status: 'ok',
      startTime: 50,
      endTime: 80,
      duration: 30,
      attributes: { 'island.component': 'Counter' },
      events: [],
      children: [],
    };

    collector.mergeClientSpans(traceId, [clientSpan]);

    const unified = collector.getUnifiedTrace(traceId);
    expect(unified).toBeDefined();
    expect(unified!.spans.size).toBe(2);
    expect(unified!.spans.get('hydrate-1')?.attributes['island.component']).toBe('Counter');
  });

  it('getUnifiedTrace returns undefined for unknown trace', () => {
    const tracer = createTracer();
    const collector = createCollector(tracer);

    expect(collector.getUnifiedTrace('nonexistent')).toBeUndefined();
  });

  it('mergeClientSpans with multiple spans', () => {
    const tracer = createTracer();
    const collector = createCollector(tracer);

    const root = tracer.startTrace('GET /app', 'request');
    const traceId = root.traceId;
    root.end();

    const clientSpans: SpanData[] = [
      {
        id: 'cs-1',
        traceId,
        parentId: root.id,
        name: 'hydrate:Nav',
        layer: 'islands',
        status: 'ok',
        startTime: 10,
        endTime: 20,
        duration: 10,
        attributes: {},
        events: [],
        children: ['cs-2'],
      },
      {
        id: 'cs-2',
        traceId,
        parentId: 'cs-1',
        name: 'fetch:menu',
        layer: 'data',
        status: 'ok',
        startTime: 12,
        endTime: 18,
        duration: 6,
        attributes: {},
        events: [],
        children: [],
      },
    ];

    collector.mergeClientSpans(traceId, clientSpans);

    const unified = collector.getUnifiedTrace(traceId);
    expect(unified!.spans.size).toBe(3); // root + 2 client
  });
});
