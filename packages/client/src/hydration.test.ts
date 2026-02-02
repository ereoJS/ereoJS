import { describe, expect, test, beforeEach } from 'bun:test';
import {
  parseHydrationDirective,
  stripHydrationProps,
  generateIslandId,
  resetIslandCounter,
  getIslandCount,
  shouldHydrate,
  createHydrationTrigger,
} from './hydration';

describe('@oreo/client - Hydration', () => {
  beforeEach(() => {
    resetIslandCounter();
  });

  describe('parseHydrationDirective', () => {
    test('parses client:load', () => {
      const result = parseHydrationDirective({ 'client:load': true });
      expect(result.strategy).toBe('load');
    });

    test('parses client:idle', () => {
      const result = parseHydrationDirective({ 'client:idle': true });
      expect(result.strategy).toBe('idle');
    });

    test('parses client:visible', () => {
      const result = parseHydrationDirective({ 'client:visible': true });
      expect(result.strategy).toBe('visible');
    });

    test('parses client:media with value', () => {
      const result = parseHydrationDirective({ 'client:media': '(max-width: 768px)' });
      expect(result.strategy).toBe('media');
      expect(result.media).toBe('(max-width: 768px)');
    });

    test('parses client:only as load', () => {
      const result = parseHydrationDirective({ 'client:only': true });
      expect(result.strategy).toBe('load');
    });

    test('returns none for no directives', () => {
      const result = parseHydrationDirective({});
      expect(result.strategy).toBe('none');
    });
  });

  describe('stripHydrationProps', () => {
    test('removes hydration props', () => {
      const props = {
        'client:load': true,
        className: 'test',
        onClick: () => {},
      };

      const stripped = stripHydrationProps(props);

      expect(stripped).not.toHaveProperty('client:load');
      expect(stripped).toHaveProperty('className');
      expect(stripped).toHaveProperty('onClick');
    });

    test('removes all hydration props', () => {
      const props = {
        'client:load': true,
        'client:idle': true,
        'client:visible': true,
        'client:media': '(max-width: 768px)',
        'client:only': true,
        otherProp: 'value',
      };

      const stripped = stripHydrationProps(props);

      expect(Object.keys(stripped)).toEqual(['otherProp']);
    });
  });

  describe('generateIslandId', () => {
    test('generates unique IDs', () => {
      const id1 = generateIslandId();
      const id2 = generateIslandId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^island-\d+$/);
    });

    test('increments counter', () => {
      generateIslandId();
      generateIslandId();
      generateIslandId();

      expect(getIslandCount()).toBe(3);
    });
  });

  describe('resetIslandCounter', () => {
    test('resets counter to 0', () => {
      generateIslandId();
      generateIslandId();

      resetIslandCounter();

      expect(getIslandCount()).toBe(0);
    });
  });

  describe('shouldHydrate', () => {
    test('returns true for load strategy', () => {
      expect(shouldHydrate('load')).toBe(true);
    });

    test('returns false for idle strategy (deferred)', () => {
      expect(shouldHydrate('idle')).toBe(false);
    });

    test('returns false for visible strategy (deferred)', () => {
      expect(shouldHydrate('visible')).toBe(false);
    });

    test('returns false for none strategy', () => {
      expect(shouldHydrate('none')).toBe(false);
    });

    test('returns false for media strategy without media query', () => {
      expect(shouldHydrate('media')).toBe(false);
    });

    test('returns function for media strategy with media query', () => {
      // Mock matchMedia
      const originalMatchMedia = globalThis.window?.matchMedia;
      (globalThis as any).window = {
        matchMedia: (query: string) => ({ matches: query === '(max-width: 768px)' }),
      };

      const result = shouldHydrate('media', '(max-width: 768px)');
      expect(typeof result).toBe('function');
      expect((result as () => boolean)()).toBe(true);

      const result2 = shouldHydrate('media', '(min-width: 1024px)');
      expect((result2 as () => boolean)()).toBe(false);

      // Restore
      if (originalMatchMedia) {
        (globalThis as any).window.matchMedia = originalMatchMedia;
      }
    });
  });

  describe('createHydrationTrigger', () => {
    test('load strategy calls onHydrate immediately', () => {
      let called = false;
      const onHydrate = () => { called = true; };
      const element = {} as Element;

      const cleanup = createHydrationTrigger('load', element, onHydrate);

      expect(called).toBe(true);
      expect(typeof cleanup).toBe('function');
    });

    test('none strategy does not call onHydrate', () => {
      let called = false;
      const onHydrate = () => { called = true; };
      const element = {} as Element;

      const cleanup = createHydrationTrigger('none', element, onHydrate);

      expect(called).toBe(false);
      expect(typeof cleanup).toBe('function');
    });

    test('idle strategy uses requestIdleCallback when available', () => {
      let called = false;
      const onHydrate = () => { called = true; };
      const element = {} as Element;

      // Mock both window (for 'in' check) and global requestIdleCallback (for the call)
      const originalWindow = (globalThis as any).window;
      const originalRIC = (globalThis as any).requestIdleCallback;
      const originalCIC = (globalThis as any).cancelIdleCallback;

      const mockRIC = (cb: () => void) => {
        cb();
        return 123;
      };

      (globalThis as any).window = {
        ...(originalWindow || {}),
        requestIdleCallback: mockRIC,
        cancelIdleCallback: () => {},
      };
      (globalThis as any).requestIdleCallback = mockRIC;
      (globalThis as any).cancelIdleCallback = () => {};

      const cleanup = createHydrationTrigger('idle', element, onHydrate);

      expect(called).toBe(true);
      expect(typeof cleanup).toBe('function');

      // Restore
      if (originalWindow) {
        (globalThis as any).window = originalWindow;
      } else {
        delete (globalThis as any).window;
      }
      if (originalRIC) {
        (globalThis as any).requestIdleCallback = originalRIC;
      } else {
        delete (globalThis as any).requestIdleCallback;
      }
      if (originalCIC) {
        (globalThis as any).cancelIdleCallback = originalCIC;
      } else {
        delete (globalThis as any).cancelIdleCallback;
      }
    });

    test('idle strategy falls back to setTimeout', () => {
      let called = false;
      const onHydrate = () => { called = true; };
      const element = {} as Element;

      // Ensure requestIdleCallback is not available
      const originalRIC = (globalThis as any).requestIdleCallback;
      delete (globalThis as any).requestIdleCallback;

      const cleanup = createHydrationTrigger('idle', element, onHydrate);

      // Wait for setTimeout
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(called).toBe(true);
          expect(typeof cleanup).toBe('function');

          // Restore
          if (originalRIC) {
            (globalThis as any).requestIdleCallback = originalRIC;
          }
          resolve();
        }, 250);
      });
    });

    test('visible strategy uses IntersectionObserver', () => {
      let observedElement: Element | null = null;
      let disconnectCalled = false;
      let onHydrateCalled = false;
      const onHydrate = () => { onHydrateCalled = true; };
      const element = { id: 'test' } as Element;

      // Mock IntersectionObserver
      const originalIO = (globalThis as any).IntersectionObserver;
      (globalThis as any).IntersectionObserver = class {
        callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback, options: any) {
          this.callback = callback;
        }
        observe(el: Element) {
          observedElement = el;
          // Simulate intersection
          this.callback([{ isIntersecting: true }] as IntersectionObserverEntry[], this as any);
        }
        disconnect() {
          disconnectCalled = true;
        }
      };

      const cleanup = createHydrationTrigger('visible', element, onHydrate);

      expect(observedElement).toBe(element);
      expect(onHydrateCalled).toBe(true);
      expect(disconnectCalled).toBe(true);
      expect(typeof cleanup).toBe('function');

      // Restore
      (globalThis as any).IntersectionObserver = originalIO;
    });

    test('media strategy calls onHydrate when media matches', () => {
      let called = false;
      const onHydrate = () => { called = true; };
      const element = {} as Element;

      // Mock matchMedia
      const originalMatchMedia = (globalThis as any).window?.matchMedia;
      (globalThis as any).window = {
        matchMedia: (query: string) => ({
          matches: true,
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      };

      const cleanup = createHydrationTrigger('media', element, onHydrate, '(max-width: 768px)');

      expect(called).toBe(true);
      expect(typeof cleanup).toBe('function');

      // Restore
      if (originalMatchMedia) {
        (globalThis as any).window.matchMedia = originalMatchMedia;
      }
    });

    test('media strategy adds listener when media does not match', () => {
      let listenerAdded = false;
      let listenerCallback: ((e: any) => void) | null = null;
      let called = false;
      const onHydrate = () => { called = true; };
      const element = {} as Element;

      // Mock matchMedia
      (globalThis as any).window = {
        matchMedia: (query: string) => ({
          matches: false,
          addEventListener: (event: string, cb: (e: any) => void) => {
            listenerAdded = true;
            listenerCallback = cb;
          },
          removeEventListener: () => {},
        }),
      };

      const cleanup = createHydrationTrigger('media', element, onHydrate, '(max-width: 768px)');

      expect(called).toBe(false);
      expect(listenerAdded).toBe(true);
      expect(typeof cleanup).toBe('function');

      // Simulate media change
      if (listenerCallback) {
        listenerCallback({ matches: true });
      }
      expect(called).toBe(true);
    });

    test('media strategy does nothing without media query', () => {
      let called = false;
      const onHydrate = () => { called = true; };
      const element = {} as Element;

      const cleanup = createHydrationTrigger('media', element, onHydrate);

      expect(called).toBe(false);
      expect(typeof cleanup).toBe('function');
    });
  });
});
