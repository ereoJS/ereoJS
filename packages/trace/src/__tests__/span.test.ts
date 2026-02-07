import { describe, it, expect } from 'bun:test';
import { SpanImpl, generateSpanId, generateTraceId } from '../span';

describe('generateSpanId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSpanId()));
    expect(ids.size).toBe(100);
  });

  it('generates 16-char hex strings', () => {
    const id = generateSpanId();
    expect(id.length).toBe(16);
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });

  it('always produces exactly 16 chars across many runs', () => {
    for (let i = 0; i < 1000; i++) {
      const id = generateSpanId();
      expect(id.length).toBe(16);
    }
  });
});

describe('generateTraceId', () => {
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
    expect(ids.size).toBe(100);
  });

  it('generates 32-char hex strings', () => {
    const id = generateTraceId();
    expect(id.length).toBe(32);
    expect(/^[0-9a-f]+$/.test(id)).toBe(true);
  });

  it('always produces exactly 32 chars across many runs', () => {
    for (let i = 0; i < 1000; i++) {
      const id = generateTraceId();
      expect(id.length).toBe(32);
    }
  });
});

describe('SpanImpl', () => {
  const noopEndCb = () => {};
  const noopChildFactory = (name: string, layer: any, parentId: string) => {
    return new SpanImpl('trace1', parentId, name, layer, noopEndCb, noopChildFactory);
  };

  it('creates span with correct fields', () => {
    const span = new SpanImpl('trace1', null, 'test-span', 'request', noopEndCb, noopChildFactory);
    expect(span.traceId).toBe('trace1');
    expect(span.id).toBeTruthy();
    expect(span.ended).toBe(false);
  });

  it('sets attributes', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.setAttribute('key', 'value');
    span.setAttribute('count', 42);
    const data = span.toData();
    expect(data.attributes.key).toBe('value');
    expect(data.attributes.count).toBe(42);
  });

  it('ignores setAttribute after end', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.setAttribute('before', true);
    span.end();
    span.setAttribute('after', true);
    const data = span.toData();
    expect(data.attributes.before).toBe(true);
    expect(data.attributes.after).toBeUndefined();
  });

  it('records events', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.event('something-happened', { detail: 'info' });
    const data = span.toData();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].name).toBe('something-happened');
    expect(data.events[0].attributes?.detail).toBe('info');
  });

  it('records errors', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.error(new Error('test error'));
    const data = span.toData();
    expect(data.status).toBe('error');
    expect(data.attributes['error.message']).toBe('test error');
    expect(data.attributes['error.name']).toBe('Error');
  });

  it('creates child spans', () => {
    const span = new SpanImpl('trace1', null, 'parent', 'request', noopEndCb, noopChildFactory);
    const child = span.child('child-span', 'data');
    expect(child.traceId).toBe('trace1');
    const parentData = span.toData();
    expect(parentData.children).toContain(child.id);
  });

  it('end sets ended flag and calls callback', () => {
    let endCalled = false;
    const span = new SpanImpl('trace1', null, 'test', 'request', () => { endCalled = true; }, noopChildFactory);
    span.end();
    expect(span.ended).toBe(true);
    expect(endCalled).toBe(true);
  });

  it('end is idempotent', () => {
    let callCount = 0;
    const span = new SpanImpl('trace1', null, 'test', 'request', () => { callCount++; }, noopChildFactory);
    span.end();
    span.end();
    expect(callCount).toBe(1);
  });

  it('calls onEvent callback when event is recorded', () => {
    const emitted: { spanId: string; name: string }[] = [];
    const onEvent = (spanId: string, event: { name: string }) => {
      emitted.push({ spanId, name: event.name });
    };
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory, onEvent);
    span.event('first');
    span.event('second');
    expect(emitted).toHaveLength(2);
    expect(emitted[0].name).toBe('first');
    expect(emitted[0].spanId).toBe(span.id);
    expect(emitted[1].name).toBe('second');
  });

  it('does not call onEvent after span ends', () => {
    let callCount = 0;
    const onEvent = () => { callCount++; };
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory, onEvent);
    span.event('before');
    span.end();
    span.event('after');
    expect(callCount).toBe(1);
  });

  it('error with non-Error string', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.error('string error message');
    const data = span.toData();
    expect(data.status).toBe('error');
    expect(data.attributes['error.message']).toBe('string error message');
    // Should NOT have error.name or error.stack for non-Error values
    expect(data.attributes['error.name']).toBeUndefined();
    expect(data.attributes['error.stack']).toBeUndefined();
  });

  it('error with non-Error object', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.error({ code: 'FAIL', detail: 'something' });
    const data = span.toData();
    expect(data.status).toBe('error');
    expect(data.attributes['error.message']).toBe('[object Object]');
  });

  it('error with null', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.error(null);
    const data = span.toData();
    expect(data.status).toBe('error');
    expect(data.attributes['error.message']).toBe('null');
  });

  it('error is no-op after end', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.end();
    span.error(new Error('too late'));
    const data = span.toData();
    expect(data.status).toBe('ok');
    expect(data.attributes['error.message']).toBeUndefined();
  });

  it('toData returns duration', () => {
    const span = new SpanImpl('trace1', null, 'test', 'request', noopEndCb, noopChildFactory);
    span.end();
    const data = span.toData();
    expect(data.duration).toBeGreaterThanOrEqual(0);
    expect(data.endTime).toBeGreaterThan(0);
  });
});
