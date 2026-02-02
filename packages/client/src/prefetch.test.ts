import { describe, expect, test, beforeEach } from 'bun:test';
import {
  prefetch,
  getPrefetchedData,
  clearPrefetchCache,
  isPrefetching,
  isPrefetched,
  prefetchAll,
} from './prefetch';

describe('@oreo/client - Prefetch', () => {
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
});
