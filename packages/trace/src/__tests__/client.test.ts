import { describe, it, expect } from 'bun:test';
import { ClientSpan, ClientTracer, getClientTracer, initClientTracing } from '../client';

describe('ClientSpan', () => {
  it('creates span with correct fields', () => {
    const span = new ClientSpan('trace-1', null, 'page-load', 'request');
    expect(span.id).toBeTruthy();
    expect(span.id.length).toBe(16);
    expect(span.traceId).toBe('trace-1');
    expect(span.parentId).toBeNull();
  });

  it('creates span with parent', () => {
    const span = new ClientSpan('trace-1', 'parent-span-id', 'child', 'data');
    expect(span.parentId).toBe('parent-span-id');
  });

  it('sets attributes', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.setAttribute('key', 'value');
    span.setAttribute('count', 42);
    const data = span.toData();
    expect(data.attributes.key).toBe('value');
    expect(data.attributes.count).toBe(42);
  });

  it('ignores setAttribute after end', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.setAttribute('before', true);
    span.end();
    span.setAttribute('after', true);
    const data = span.toData();
    expect(data.attributes.before).toBe(true);
    expect(data.attributes.after).toBeUndefined();
  });

  it('records events', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.event('dom-ready', { nodeCount: 100 });
    const data = span.toData();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].name).toBe('dom-ready');
    expect(data.events[0].attributes?.nodeCount).toBe(100);
  });

  it('ignores events after end', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.event('before');
    span.end();
    span.event('after');
    const data = span.toData();
    expect(data.events).toHaveLength(1);
  });

  it('records error with Error instance', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.error(new Error('network failure'));
    const data = span.toData();
    expect(data.status).toBe('error');
    expect(data.attributes['error.message']).toBe('network failure');
  });

  it('records error with string', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.error('something broke');
    const data = span.toData();
    expect(data.status).toBe('error');
    expect(data.attributes['error.message']).toBe('something broke');
  });

  it('ignores error after end', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.end();
    span.error(new Error('too late'));
    const data = span.toData();
    expect(data.status).toBe('ok');
  });

  it('end is idempotent', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.end();
    const endTime1 = span.toData().endTime;
    span.end();
    const endTime2 = span.toData().endTime;
    expect(endTime1).toBe(endTime2);
  });

  it('addChild tracks child IDs', () => {
    const span = new ClientSpan('t1', null, 'parent', 'request');
    span.addChild('child-1');
    span.addChild('child-2');
    const data = span.toData();
    expect(data.children).toEqual(['child-1', 'child-2']);
  });

  it('toData returns immutable copies', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.setAttribute('key', 'original');
    const data1 = span.toData();
    span.setAttribute('key', 'modified');
    const data2 = span.toData();
    expect(data1.attributes.key).toBe('original');
    expect(data2.attributes.key).toBe('modified');
  });

  it('toData calculates duration', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    span.end();
    const data = span.toData();
    expect(data.duration).toBeGreaterThanOrEqual(0);
    expect(data.endTime).toBeGreaterThan(0);
  });

  it('toData uses performance.now() for endTime when not ended', () => {
    const span = new ClientSpan('t1', null, 'test', 'request');
    const data = span.toData();
    // Should use current time since span hasn't ended
    expect(data.endTime).toBeGreaterThan(0);
    expect(data.duration).toBeGreaterThanOrEqual(0);
  });
});

describe('ClientTracer', () => {
  it('startSpan creates a span', () => {
    const tracer = new ClientTracer();
    const span = tracer.startSpan('fetch', 'request');
    expect(span.id).toBeTruthy();
    expect(span.traceId).toBeTruthy();
  });

  it('startSpan uses current trace ID', () => {
    const tracer = new ClientTracer();
    tracer.setTraceId('my-trace-123');
    const span = tracer.startSpan('fetch', 'request');
    expect(span.traceId).toBe('my-trace-123');
  });

  it('startSpan uses parent ID when provided', () => {
    const tracer = new ClientTracer();
    const span = tracer.startSpan('child', 'data', 'parent-id');
    expect(span.parentId).toBe('parent-id');
  });

  it('startSpan generates trace ID when none set', () => {
    const tracer = new ClientTracer();
    const span = tracer.startSpan('orphan', 'request');
    // Should generate a 32-char trace ID (two 16-char IDs concatenated)
    expect(span.traceId.length).toBe(32);
  });

  it('setTraceId / getTraceId', () => {
    const tracer = new ClientTracer();
    expect(tracer.getTraceId()).toBeNull();
    tracer.setTraceId('trace-abc');
    expect(tracer.getTraceId()).toBe('trace-abc');
  });

  it('submitSpan buffers spans when not connected', () => {
    const tracer = new ClientTracer();
    const span = tracer.startSpan('test', 'request');
    span.end();
    // Should not throw even without WebSocket
    tracer.submitSpan(span);
  });

  it('destroy cleans up', () => {
    const tracer = new ClientTracer();
    tracer.setTraceId('trace-1');
    tracer.destroy();
    // After destroy, tracer should be cleaned up
    // No assertion for connected state since it's private,
    // but it should not throw
  });

  it('init is no-op in non-browser environment', () => {
    const tracer = new ClientTracer();
    // In Bun (non-browser), init should do nothing since typeof window === 'undefined'
    tracer.init();
    expect(tracer.getTraceId()).toBeNull();
  });
});

describe('getClientTracer', () => {
  it('returns singleton', () => {
    const t1 = getClientTracer();
    const t2 = getClientTracer();
    expect(t1).toBe(t2);
  });
});

describe('initClientTracing', () => {
  it('does not throw in non-browser environment', () => {
    // Should be a no-op since typeof window === 'undefined' in Bun
    initClientTracing();
  });
});
