import { describe, it, expect } from 'bun:test';
import { noopTracer, noopSpan } from '../noop';

describe('NoopTracer', () => {
  it('startTrace returns noop span', () => {
    const span = noopTracer.startTrace('test', 'request');
    expect(span).toBe(noopSpan);
  });

  it('startSpan returns noop span', () => {
    const span = noopTracer.startSpan('test', 'data');
    expect(span).toBe(noopSpan);
  });

  it('activeSpan returns null', () => {
    expect(noopTracer.activeSpan()).toBeNull();
  });

  it('withSpan runs function without error', () => {
    const result = noopTracer.withSpan('test', 'data', () => 42);
    expect(result).toBe(42);
  });

  it('withSpan runs async function', async () => {
    const result = await noopTracer.withSpan('test', 'data', async () => 'done');
    expect(result).toBe('done');
  });

  it('getTraces returns empty array', () => {
    expect(noopTracer.getTraces()).toEqual([]);
  });

  it('subscribe returns noop unsubscribe', () => {
    const unsub = noopTracer.subscribe(() => {});
    expect(typeof unsub).toBe('function');
    unsub(); // should not throw
  });

  it('mergeClientSpans does not throw', () => {
    noopTracer.mergeClientSpans('trace-id', []);
  });
});

describe('noopSpan', () => {
  it('setAttribute does not throw', () => {
    noopSpan.setAttribute('key', 'value');
  });

  it('event does not throw', () => {
    noopSpan.event('test');
  });

  it('end does not throw', () => {
    noopSpan.end();
  });

  it('error does not throw', () => {
    noopSpan.error(new Error('test'));
  });

  it('child returns noop span', () => {
    const child = noopSpan.child('child', 'data');
    expect(child).toBe(noopSpan);
  });
});
