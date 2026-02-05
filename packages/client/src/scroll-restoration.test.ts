import { describe, expect, test, beforeEach } from 'bun:test';
import { ScrollRestoration, clearScrollPositions } from './scroll-restoration';
import type { ScrollRestorationProps } from './scroll-restoration';
import { createElement } from 'react';

beforeEach(() => {
  clearScrollPositions();
});

// =================================================================
// ScrollRestoration component tests
// =================================================================

describe('@ereo/client - ScrollRestoration', () => {
  test('ScrollRestoration is a function component', () => {
    expect(typeof ScrollRestoration).toBe('function');
    expect(ScrollRestoration.length).toBeLessThanOrEqual(1); // single props arg
  });

  test('can create element without props', () => {
    const el = createElement(ScrollRestoration);
    expect(el).toBeDefined();
    expect(el.type).toBe(ScrollRestoration);
  });

  test('can create element with nonce prop', () => {
    const el = createElement(ScrollRestoration, { nonce: 'abc123' });
    expect(el.props.nonce).toBe('abc123');
  });

  test('can create element with getKey prop', () => {
    const getKey = (pathname: string) => `custom-${pathname}`;
    const el = createElement(ScrollRestoration, { getKey });
    expect(el.props.getKey).toBe(getKey);
  });

  test('can create element with storageKey prop', () => {
    const el = createElement(ScrollRestoration, { storageKey: 'my-app' });
    expect(el.props.storageKey).toBe('my-app');
  });

  test('can create element with all props', () => {
    const el = createElement(ScrollRestoration, {
      getKey: (p: string) => p,
      nonce: 'xyz',
      storageKey: 'custom',
    });
    expect(el.props.nonce).toBe('xyz');
    expect(el.props.storageKey).toBe('custom');
    expect(typeof el.props.getKey).toBe('function');
  });

  test('clearScrollPositions does not throw', () => {
    expect(() => clearScrollPositions()).not.toThrow();
  });

  test('clearScrollPositions can be called multiple times', () => {
    clearScrollPositions();
    clearScrollPositions();
    clearScrollPositions();
  });
});

// =================================================================
// ScrollRestorationProps type tests
// =================================================================

describe('@ereo/client - ScrollRestorationProps', () => {
  test('all props are optional', () => {
    const props: ScrollRestorationProps = {};
    expect(props.getKey).toBeUndefined();
    expect(props.nonce).toBeUndefined();
    expect(props.storageKey).toBeUndefined();
  });

  test('getKey is a function from pathname to string', () => {
    const props: ScrollRestorationProps = {
      getKey: (pathname: string) => `key-${pathname}`,
    };
    expect(props.getKey!('/about')).toBe('key-/about');
  });

  test('nonce is a string', () => {
    const props: ScrollRestorationProps = { nonce: 'abc123' };
    expect(props.nonce).toBe('abc123');
  });

  test('storageKey is a string', () => {
    const props: ScrollRestorationProps = { storageKey: 'my-scroll' };
    expect(props.storageKey).toBe('my-scroll');
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/client - ScrollRestoration exports from index', () => {
  test('ScrollRestoration is exported', async () => {
    const exports = await import('./index');
    expect(exports.ScrollRestoration).toBeDefined();
    expect(typeof exports.ScrollRestoration).toBe('function');
  });

  test('clearScrollPositions is exported', async () => {
    const exports = await import('./index');
    expect(exports.clearScrollPositions).toBeDefined();
    expect(typeof exports.clearScrollPositions).toBe('function');
  });
});
