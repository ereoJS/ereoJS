import { describe, it, expect } from 'bun:test';
import { setTracer, getTracer, setActiveSpan, getActiveSpan } from '../context';
import { createTracer } from '../tracer';
import type { AppContext } from '@ereo/core';

/** Minimal AppContext mock */
function createMockContext(): AppContext {
  const store = new Map<string, unknown>();
  return {
    cache: { set() {}, get: () => undefined, getTags: () => [], addTags() {} },
    get<T>(key: string): T | undefined { return store.get(key) as T | undefined; },
    set<T>(key: string, value: T): void { store.set(key, value); },
    responseHeaders: new Headers(),
    url: new URL('http://localhost/'),
    env: {},
  };
}

describe('Context integration', () => {
  it('stores and retrieves a tracer', () => {
    const ctx = createMockContext();
    const tracer = createTracer();

    expect(getTracer(ctx)).toBeUndefined();
    setTracer(ctx, tracer);
    expect(getTracer(ctx)).toBe(tracer);
  });

  it('stores and retrieves an active span', () => {
    const ctx = createMockContext();
    const tracer = createTracer();
    const span = tracer.startTrace('test', 'request');

    expect(getActiveSpan(ctx)).toBeUndefined();
    setActiveSpan(ctx, span);
    expect(getActiveSpan(ctx)).toBe(span);

    span.end();
  });

  it('different contexts are isolated', () => {
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();
    const tracer = createTracer();

    setTracer(ctx1, tracer);
    expect(getTracer(ctx1)).toBe(tracer);
    expect(getTracer(ctx2)).toBeUndefined();
  });
});
