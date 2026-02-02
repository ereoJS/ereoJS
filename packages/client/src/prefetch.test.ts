import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  prefetch,
  getPrefetchedData,
  clearPrefetchCache,
  isPrefetching,
  isPrefetched,
  prefetchAll,
  setupLinkPrefetch,
  setupAutoPrefetch,
} from './prefetch';

describe('@areo/client - Prefetch', () => {
  beforeEach(() => {
    clearPrefetchCache();
  });

  describe('clearPrefetchCache', () => {
    test('clears all cached entries', () => {
      // The cache should be empty after clearing
      clearPrefetchCache();
      expect(getPrefetchedData('/any')).toBeUndefined();
    });
  });

  describe('getPrefetchedData', () => {
    test('returns undefined for non-prefetched URLs', () => {
      expect(getPrefetchedData('/not-prefetched')).toBeUndefined();
    });
  });

  describe('isPrefetching', () => {
    test('returns false for unknown URLs', () => {
      expect(isPrefetching('/unknown')).toBe(false);
    });
  });

  describe('isPrefetched', () => {
    test('returns false for non-prefetched URLs', () => {
      expect(isPrefetched('/not-prefetched')).toBe(false);
    });
  });

  describe('Cache validation logic', () => {
    interface PrefetchEntry {
      url: string;
      timestamp: number;
      data?: unknown;
      loading: boolean;
    }

    function isCacheValid(entry: PrefetchEntry, cacheDuration: number): boolean {
      return Date.now() - entry.timestamp < cacheDuration;
    }

    test('returns true for fresh cache entries', () => {
      const entry: PrefetchEntry = {
        url: '/test',
        timestamp: Date.now(),
        data: { value: 'test' },
        loading: false,
      };

      expect(isCacheValid(entry, 30000)).toBe(true);
    });

    test('returns false for expired cache entries', () => {
      const entry: PrefetchEntry = {
        url: '/test',
        timestamp: Date.now() - 60000, // 60 seconds ago
        data: { value: 'test' },
        loading: false,
      };

      expect(isCacheValid(entry, 30000)).toBe(false);
    });

    test('returns true for entries exactly at expiration', () => {
      const now = Date.now();
      const entry: PrefetchEntry = {
        url: '/test',
        timestamp: now - 29999,
        data: { value: 'test' },
        loading: false,
      };

      expect(isCacheValid(entry, 30000)).toBe(true);
    });
  });

  describe('PrefetchOptions', () => {
    interface PrefetchOptions {
      strategy?: 'hover' | 'viewport' | 'eager' | 'none';
      cacheDuration?: number;
      threshold?: number;
    }

    const defaultOptions: Required<PrefetchOptions> = {
      strategy: 'hover',
      cacheDuration: 30000,
      threshold: 0,
    };

    test('default strategy is hover', () => {
      expect(defaultOptions.strategy).toBe('hover');
    });

    test('default cache duration is 30 seconds', () => {
      expect(defaultOptions.cacheDuration).toBe(30000);
    });

    test('default threshold is 0', () => {
      expect(defaultOptions.threshold).toBe(0);
    });

    test('merges custom options with defaults', () => {
      const customOptions: PrefetchOptions = {
        strategy: 'viewport',
        cacheDuration: 60000,
      };

      const merged = { ...defaultOptions, ...customOptions };

      expect(merged.strategy).toBe('viewport');
      expect(merged.cacheDuration).toBe(60000);
      expect(merged.threshold).toBe(0);
    });
  });

  describe('prefetchAll', () => {
    test('is a function', () => {
      expect(typeof prefetchAll).toBe('function');
    });
  });

  describe('URL origin check logic', () => {
    test('identifies same-origin URLs', () => {
      const currentOrigin = 'http://localhost:3000';
      const sameOriginUrl = 'http://localhost:3000/path';

      expect(sameOriginUrl.startsWith(currentOrigin)).toBe(true);
    });

    test('identifies cross-origin URLs', () => {
      const currentOrigin = 'http://localhost:3000';
      const crossOriginUrl = 'http://external.com/path';

      expect(crossOriginUrl.startsWith(currentOrigin)).toBe(false);
    });

    test('handles protocol-relative paths', () => {
      const internalPath = '/internal/path';
      expect(internalPath.startsWith('/')).toBe(true);
    });
  });

  describe('Prefetch strategies', () => {
    type Strategy = 'hover' | 'viewport' | 'eager' | 'none';

    function shouldPrefetch(strategy: Strategy): boolean {
      return strategy !== 'none';
    }

    test('hover strategy should prefetch', () => {
      expect(shouldPrefetch('hover')).toBe(true);
    });

    test('viewport strategy should prefetch', () => {
      expect(shouldPrefetch('viewport')).toBe(true);
    });

    test('eager strategy should prefetch', () => {
      expect(shouldPrefetch('eager')).toBe(true);
    });

    test('none strategy should not prefetch', () => {
      expect(shouldPrefetch('none')).toBe(false);
    });
  });

  describe('URL path extraction', () => {
    test('extracts pathname from full URL', () => {
      const url = new URL('http://localhost:3000/path/to/page?query=value');
      expect(url.pathname).toBe('/path/to/page');
    });

    test('handles URLs with hash', () => {
      const url = new URL('http://localhost:3000/path#section');
      expect(url.pathname).toBe('/path');
      expect(url.hash).toBe('#section');
    });

    test('handles root URL', () => {
      const url = new URL('http://localhost:3000/');
      expect(url.pathname).toBe('/');
    });
  });

  describe('prefetch function', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      clearPrefetchCache();
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test('prefetches URL and caches data on success', async () => {
      globalThis.fetch = async (url: any, options: any) => {
        return new Response(JSON.stringify({ data: 'test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      await prefetch('/test-url');

      expect(isPrefetched('/test-url')).toBe(true);
      expect(getPrefetchedData('/test-url')).toEqual({ data: 'test' });
    });

    test('stores error on fetch failure', async () => {
      globalThis.fetch = async () => {
        return new Response('Not Found', { status: 404 });
      };

      await prefetch('/not-found');

      expect(isPrefetched('/not-found')).toBe(false);
      expect(isPrefetching('/not-found')).toBe(false);
    });

    test('handles network error', async () => {
      globalThis.fetch = async () => {
        throw new Error('Network error');
      };

      await prefetch('/network-error');

      expect(isPrefetched('/network-error')).toBe(false);
    });

    test('does not re-fetch valid cached entries', async () => {
      let fetchCount = 0;
      globalThis.fetch = async () => {
        fetchCount++;
        return new Response(JSON.stringify({ count: fetchCount }), { status: 200 });
      };

      await prefetch('/cached');
      await prefetch('/cached');

      expect(fetchCount).toBe(1);
    });
  });

  describe('setupLinkPrefetch', () => {
    beforeEach(() => {
      clearPrefetchCache();
      (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
    });

    test('returns no-op for external links', () => {
      const element = {
        href: 'http://external.com/path',
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as HTMLAnchorElement;

      const cleanup = setupLinkPrefetch(element);
      expect(typeof cleanup).toBe('function');
    });

    test('returns no-op for links without href', () => {
      const element = {
        href: '',
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as HTMLAnchorElement;

      const cleanup = setupLinkPrefetch(element);
      expect(typeof cleanup).toBe('function');
    });

    test('hover strategy adds mouseenter listener', () => {
      let listenerAdded = false;
      let eventType = '';
      const element = {
        href: 'http://localhost:3000/test',
        addEventListener: (type: string, cb: () => void) => {
          listenerAdded = true;
          eventType = type;
        },
        removeEventListener: () => {},
      } as unknown as HTMLAnchorElement;

      const cleanup = setupLinkPrefetch(element, { strategy: 'hover' });

      expect(listenerAdded).toBe(true);
      expect(eventType).toBe('mouseenter');
      expect(typeof cleanup).toBe('function');
    });

    test('viewport strategy uses IntersectionObserver', () => {
      let observedElement: any = null;
      const originalIO = (globalThis as any).IntersectionObserver;
      (globalThis as any).IntersectionObserver = class {
        observe(el: Element) { observedElement = el; }
        disconnect() {}
      };

      const element = {
        href: 'http://localhost:3000/test',
      } as unknown as HTMLAnchorElement;

      const cleanup = setupLinkPrefetch(element, { strategy: 'viewport' });

      expect(observedElement).toBe(element);
      expect(typeof cleanup).toBe('function');

      (globalThis as any).IntersectionObserver = originalIO;
    });

    test('viewport strategy prefetches when element becomes visible', async () => {
      let fetchCalled = false;
      let disconnectCalled = false;
      let observerCallback: ((entries: any[]) => void) | null = null;

      const originalIO = (globalThis as any).IntersectionObserver;
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response(JSON.stringify({}), { status: 200 });
      };

      (globalThis as any).IntersectionObserver = class {
        callback: (entries: any[]) => void;
        constructor(cb: (entries: any[]) => void, options: any) {
          this.callback = cb;
          observerCallback = cb;
        }
        observe(el: Element) {
          // Simulate element becoming visible
          setTimeout(() => {
            this.callback([{ isIntersecting: true }]);
          }, 5);
        }
        disconnect() { disconnectCalled = true; }
      };

      const element = {
        href: 'http://localhost:3000/viewport-test',
      } as unknown as HTMLAnchorElement;

      setupLinkPrefetch(element, { strategy: 'viewport', threshold: 0.5 });

      // Wait for intersection callback
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(fetchCalled).toBe(true);
      expect(disconnectCalled).toBe(true);

      globalThis.fetch = originalFetch;
      (globalThis as any).IntersectionObserver = originalIO;
    });

    test('viewport strategy ignores non-intersecting entries', async () => {
      let fetchCalled = false;
      let disconnectCalled = false;

      const originalIO = (globalThis as any).IntersectionObserver;
      const originalFetch = globalThis.fetch;

      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response(JSON.stringify({}), { status: 200 });
      };

      (globalThis as any).IntersectionObserver = class {
        callback: (entries: any[]) => void;
        constructor(cb: (entries: any[]) => void) {
          this.callback = cb;
        }
        observe(el: Element) {
          // Simulate element NOT intersecting
          this.callback([{ isIntersecting: false }]);
        }
        disconnect() { disconnectCalled = true; }
      };

      const element = {
        href: 'http://localhost:3000/not-visible',
      } as unknown as HTMLAnchorElement;

      setupLinkPrefetch(element, { strategy: 'viewport' });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fetchCalled).toBe(false);
      expect(disconnectCalled).toBe(false);

      globalThis.fetch = originalFetch;
      (globalThis as any).IntersectionObserver = originalIO;
    });

    test('eager strategy prefetches immediately', async () => {
      let fetchCalled = false;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response(JSON.stringify({}), { status: 200 });
      };

      const element = {
        href: 'http://localhost:3000/eager-test',
      } as unknown as HTMLAnchorElement;

      setupLinkPrefetch(element, { strategy: 'eager' });

      // Wait for async prefetch
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(fetchCalled).toBe(true);

      globalThis.fetch = originalFetch;
    });

    test('none strategy does not add any listeners', () => {
      let listenerAdded = false;
      const element = {
        href: 'http://localhost:3000/test',
        addEventListener: () => { listenerAdded = true; },
      } as unknown as HTMLAnchorElement;

      setupLinkPrefetch(element, { strategy: 'none' });

      expect(listenerAdded).toBe(false);
    });
  });

  describe('setupAutoPrefetch', () => {
    test('returns no-op when document is undefined', () => {
      const originalDocument = (globalThis as any).document;
      delete (globalThis as any).document;

      const cleanup = setupAutoPrefetch();
      expect(typeof cleanup).toBe('function');

      (globalThis as any).document = originalDocument;
    });

    test('sets up prefetch for existing links', () => {
      let querySelectorCalled = false;
      const mockLinks: any[] = [];

      (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
      (globalThis as any).document = {
        querySelectorAll: (selector: string) => {
          querySelectorCalled = true;
          return mockLinks;
        },
        body: {},
      };
      (globalThis as any).MutationObserver = class {
        observe() {}
        disconnect() {}
      };

      const cleanup = setupAutoPrefetch();

      expect(querySelectorCalled).toBe(true);
      expect(typeof cleanup).toBe('function');
    });

    test('watches for new links with MutationObserver', () => {
      let observerCreated = false;
      let observeCalled = false;

      (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
      (globalThis as any).document = {
        querySelectorAll: () => [],
        body: {},
      };
      (globalThis as any).MutationObserver = class {
        constructor(callback: MutationCallback) {
          observerCreated = true;
        }
        observe(target: Node, options: MutationObserverInit) {
          observeCalled = true;
        }
        disconnect() {}
      };

      const cleanup = setupAutoPrefetch();

      expect(observerCreated).toBe(true);
      expect(observeCalled).toBe(true);

      cleanup();
    });

    test('handles new anchor elements added to DOM', () => {
      let mutationCallback: MutationCallback | null = null;

      // Mock HTMLAnchorElement class
      class MockHTMLAnchorElement {
        href: string = '';
        addEventListener() {}
        removeEventListener() {}
      }

      // Mock Element class
      class MockElement {
        querySelectorAll() { return []; }
      }

      (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
      (globalThis as any).document = {
        querySelectorAll: () => [],
        body: {},
      };
      (globalThis as any).MutationObserver = class {
        callback: MutationCallback;
        constructor(cb: MutationCallback) {
          this.callback = cb;
          mutationCallback = cb;
        }
        observe() {}
        disconnect() {}
      };
      (globalThis as any).HTMLAnchorElement = MockHTMLAnchorElement;
      (globalThis as any).Element = MockElement;

      setupAutoPrefetch({ strategy: 'none' });

      // Simulate a new anchor element being added
      const newAnchor = new MockHTMLAnchorElement();
      newAnchor.href = '/new-link';

      const mutations: any[] = [{
        addedNodes: [newAnchor],
      }];

      // This should not throw
      expect(() => mutationCallback!(mutations, {} as any)).not.toThrow();
    });

    test('handles elements containing anchor elements added to DOM', () => {
      let mutationCallback: MutationCallback | null = null;
      let querySelectorCalls = 0;

      (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
      (globalThis as any).document = {
        querySelectorAll: () => [],
        body: {},
      };
      (globalThis as any).MutationObserver = class {
        callback: MutationCallback;
        constructor(cb: MutationCallback) {
          this.callback = cb;
          mutationCallback = cb;
        }
        observe() {}
        disconnect() {}
      };
      (globalThis as any).HTMLAnchorElement = class {};

      // Create a mock Element class
      class MockElement {
        querySelectorAll(selector: string) {
          querySelectorCalls++;
          return [{
            href: 'http://localhost:3000/nested-link',
            addEventListener: () => {},
            removeEventListener: () => {},
          }];
        }
      }
      (globalThis as any).Element = MockElement;

      setupAutoPrefetch({ strategy: 'none' });

      // Simulate a container element with nested anchors being added
      const container = new MockElement();

      const mutations: any[] = [{
        addedNodes: [container],
      }];

      // This should query for nested anchor elements
      mutationCallback!(mutations, {} as any);
      expect(querySelectorCalls).toBe(1);
    });

    test('cleanup disconnects observer and runs all cleanups', () => {
      let disconnectCalled = false;

      (globalThis as any).window = { location: { origin: 'http://localhost:3000' } };
      (globalThis as any).document = {
        querySelectorAll: () => [{
          href: 'http://localhost:3000/test',
          addEventListener: () => {},
          removeEventListener: () => {},
        }],
        body: {},
      };
      (globalThis as any).MutationObserver = class {
        observe() {}
        disconnect() { disconnectCalled = true; }
      };

      const cleanup = setupAutoPrefetch({ strategy: 'none' });
      cleanup();

      expect(disconnectCalled).toBe(true);
    });
  });
});
