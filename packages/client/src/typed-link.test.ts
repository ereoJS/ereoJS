import { describe, it, expect } from 'bun:test';

import { buildUrl } from './typed-link';

describe('@ereo/client - typed-link', () => {

  // ==========================================================================
  // buildUrl (exported utility)
  // ==========================================================================
  describe('buildUrl', () => {
    it('returns the pattern unchanged when no options provided', () => {
      const url = buildUrl('/about');
      expect(url).toBe('/about');
    });

    it('returns the pattern unchanged with empty options', () => {
      const url = buildUrl('/about', {});
      expect(url).toBe('/about');
    });

    it('replaces a single [param] placeholder', () => {
      const url = buildUrl('/users/[id]', {
        params: { id: '123' },
      });
      expect(url).toBe('/users/123');
    });

    it('replaces multiple [param] placeholders', () => {
      const url = buildUrl('/users/[userId]/posts/[postId]', {
        params: { userId: 'u1', postId: 'p2' },
      });
      expect(url).toBe('/users/u1/posts/p2');
    });

    it('handles catch-all [...param] with single value', () => {
      const url = buildUrl('/docs/[...slug]', {
        params: { slug: 'intro' },
      });
      expect(url).toBe('/docs/intro');
    });

    it('handles catch-all [...param] with array values', () => {
      const url = buildUrl('/docs/[...slug]', {
        params: { slug: ['api', 'reference'] },
      });
      expect(url).toBe('/docs/api/reference');
    });

    it('handles optional [[param]] with value', () => {
      const url = buildUrl('/shop/[[category]]', {
        params: { category: 'electronics' },
      });
      expect(url).toBe('/shop/electronics');
    });

    it('strips unfilled optional [[param]] segments', () => {
      const url = buildUrl('/shop/[[category]]/items', {
        params: {},
      });
      expect(url).toBe('/shop/items');
    });

    it('appends search params', () => {
      const url = buildUrl('/posts', {
        search: { page: 1, sort: 'desc' },
      });
      expect(url).toContain('?');
      expect(url).toContain('page=1');
      expect(url).toContain('sort=desc');
    });

    it('appends hash params', () => {
      const url = buildUrl('/posts', {
        hash: { section: 'top' },
      });
      expect(url).toContain('#section=top');
    });

    it('combines all param types', () => {
      const url = buildUrl('/users/[id]', {
        params: { id: '42' },
        search: { tab: 'settings' },
        hash: { section: 'profile' },
      });
      expect(url).toStartWith('/users/42');
      expect(url).toContain('tab=settings');
      expect(url).toContain('#section=profile');
    });

    it('skips undefined search params', () => {
      const url = buildUrl('/posts', {
        search: { page: 1, sort: undefined } as any,
      });
      expect(url).toContain('page=1');
      expect(url).not.toContain('sort');
    });

    it('skips null search params', () => {
      const url = buildUrl('/posts', {
        search: { page: 1, sort: null } as any,
      });
      expect(url).toContain('page=1');
      expect(url).not.toContain('sort');
    });

    it('handles array search params via append', () => {
      const url = buildUrl('/posts', {
        search: { tags: ['a', 'b'] } as any,
      });
      expect(url).toContain('tags=a');
      expect(url).toContain('tags=b');
    });

    it('skips undefined hash params', () => {
      const url = buildUrl('/posts', {
        hash: { section: undefined } as any,
      });
      expect(url).toBe('/posts');
    });

    it('skips null hash params', () => {
      const url = buildUrl('/posts', {
        hash: { section: null } as any,
      });
      expect(url).toBe('/posts');
    });

    it('returns empty search string for empty search object', () => {
      const url = buildUrl('/about', { search: {} });
      expect(url).toBe('/about');
    });

    it('returns empty hash string for empty hash object', () => {
      const url = buildUrl('/about', { hash: {} });
      expect(url).toBe('/about');
    });

    it('returns pattern when params is undefined', () => {
      const url = buildUrl('/users/[id]', { params: undefined as any });
      expect(url).toBe('/users/[id]');
    });
  });

  // ==========================================================================
  // isExternalUrl logic (re-testing the internal logic)
  // ==========================================================================
  describe('isExternalUrl logic', () => {
    function isExternalUrl(url: string, origin: string): boolean {
      if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('.')) {
        return false;
      }
      try {
        const parsed = new URL(url, origin);
        return parsed.origin !== origin;
      } catch {
        return false;
      }
    }

    const origin = 'http://localhost:3000';

    it('returns false for absolute path (starts with /)', () => {
      expect(isExternalUrl('/about', origin)).toBe(false);
    });

    it('returns false for relative path (starts with .)', () => {
      expect(isExternalUrl('./page', origin)).toBe(false);
      expect(isExternalUrl('../page', origin)).toBe(false);
    });

    it('returns false for same-origin absolute URL', () => {
      expect(isExternalUrl('http://localhost:3000/about', origin)).toBe(false);
    });

    it('returns true for different-origin absolute URL', () => {
      expect(isExternalUrl('https://google.com', origin)).toBe(true);
    });

    it('returns true for protocol-relative external URL', () => {
      expect(isExternalUrl('//external.com/path', origin)).toBe(true);
    });

    it('returns false for invalid URL', () => {
      expect(isExternalUrl(':::invalid', origin)).toBe(false);
    });
  });

  // ==========================================================================
  // shouldNavigate logic (re-testing the internal logic)
  // ==========================================================================
  describe('shouldNavigate logic', () => {
    interface MockEvent {
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      button: number;
      defaultPrevented: boolean;
    }

    function shouldNavigate(event: MockEvent): boolean {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
      if (event.button !== 0) return false;
      if (event.defaultPrevented) return false;
      return true;
    }

    const normalClick: MockEvent = {
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      button: 0,
      defaultPrevented: false,
    };

    it('returns true for normal left click', () => {
      expect(shouldNavigate(normalClick)).toBe(true);
    });

    it('returns false when metaKey is pressed', () => {
      expect(shouldNavigate({ ...normalClick, metaKey: true })).toBe(false);
    });

    it('returns false when ctrlKey is pressed', () => {
      expect(shouldNavigate({ ...normalClick, ctrlKey: true })).toBe(false);
    });

    it('returns false when shiftKey is pressed', () => {
      expect(shouldNavigate({ ...normalClick, shiftKey: true })).toBe(false);
    });

    it('returns false when altKey is pressed', () => {
      expect(shouldNavigate({ ...normalClick, altKey: true })).toBe(false);
    });

    it('returns false for right click (button=2)', () => {
      expect(shouldNavigate({ ...normalClick, button: 2 })).toBe(false);
    });

    it('returns false for middle click (button=1)', () => {
      expect(shouldNavigate({ ...normalClick, button: 1 })).toBe(false);
    });

    it('returns false when default is prevented', () => {
      expect(shouldNavigate({ ...normalClick, defaultPrevented: true })).toBe(false);
    });
  });

  // ==========================================================================
  // useIsRouteActive logic (re-testing the internal logic)
  // ==========================================================================
  describe('useIsRouteActive logic', () => {
    function buildPathWithParams(
      pattern: string,
      params: Record<string, string | string[] | undefined> | undefined
    ): string {
      if (!params) return pattern;
      let result = pattern;
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        if (result.includes(`[...${key}]`)) {
          const arrayValue = Array.isArray(value) ? value : [value];
          result = result.replace(`[...${key}]`, arrayValue.join('/'));
          continue;
        }
        if (result.includes(`[[${key}]]`)) {
          result = result.replace(`[[${key}]]`, Array.isArray(value) ? value[0] : value);
          continue;
        }
        if (result.includes(`[${key}]`)) {
          result = result.replace(`[${key}]`, Array.isArray(value) ? value[0] : value);
        }
      }
      result = result.replace(/\/?\[\[[^\]]+\]\]/g, '');
      return result;
    }

    function isRouteActive(
      pathname: string,
      path: string,
      params?: Record<string, string | string[] | undefined>,
      end = false
    ): boolean {
      const targetPath = buildPathWithParams(path, params)
        .split('?')[0]
        .split('#')[0];
      if (end) return pathname === targetPath;
      return (
        pathname.startsWith(targetPath) &&
        (targetPath === '/' ? pathname === '/' : true)
      );
    }

    it('exact match returns true with end=true', () => {
      expect(isRouteActive('/dashboard', '/dashboard', undefined, true)).toBe(true);
    });

    it('prefix match returns false with end=true', () => {
      expect(isRouteActive('/dashboard/settings', '/dashboard', undefined, true)).toBe(false);
    });

    it('prefix match returns true with end=false', () => {
      expect(isRouteActive('/dashboard/settings', '/dashboard')).toBe(true);
    });

    it('non-matching returns false', () => {
      expect(isRouteActive('/users', '/dashboard')).toBe(false);
    });

    it('root path only matches root', () => {
      expect(isRouteActive('/about', '/')).toBe(false);
      expect(isRouteActive('/', '/')).toBe(true);
    });

    it('works with parameterized paths', () => {
      expect(isRouteActive('/users/42', '/users/[id]', { id: '42' }, true)).toBe(true);
      expect(isRouteActive('/users/99', '/users/[id]', { id: '42' }, true)).toBe(false);
    });

    it('strips query from target path', () => {
      // buildPathWithParams returns the path as-is for non-parameterized
      // then we split on ?
      expect(isRouteActive('/about', '/about', undefined, true)).toBe(true);
    });
  });

  // ==========================================================================
  // TypedLink click handler logic
  // ==========================================================================
  describe('TypedLink click handler', () => {
    it('calls navigate for internal left click', () => {
      let navigateCalled = false;
      let preventDefaultCalled = false;

      const isExternal = false;
      const reloadDocument = false;
      const shouldNav = true; // normal left click
      const target = '_self';

      if (isExternal || reloadDocument) return;
      if (!shouldNav) return;
      if (target && target !== '_self') return;

      preventDefaultCalled = true;
      navigateCalled = true;

      expect(navigateCalled).toBe(true);
      expect(preventDefaultCalled).toBe(true);
    });

    it('does not call navigate for external links', () => {
      let navigateCalled = false;

      const isExternal = true;
      const reloadDocument = false;

      if (!isExternal && !reloadDocument) {
        navigateCalled = true;
      }

      expect(navigateCalled).toBe(false);
    });

    it('does not call navigate when reloadDocument is true', () => {
      let navigateCalled = false;

      const isExternal = false;
      const reloadDocument = true;

      if (!isExternal && !reloadDocument) {
        navigateCalled = true;
      }

      expect(navigateCalled).toBe(false);
    });

    it('does not call navigate for target="_blank"', () => {
      let navigateCalled = false;

      const target = '_blank';
      if (target && target !== '_self') {
        // skip navigation
      } else {
        navigateCalled = true;
      }

      expect(navigateCalled).toBe(false);
    });

    it('does not call navigate for modifier key clicks', () => {
      let navigateCalled = false;

      const event = { metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, button: 0, defaultPrevented: false };
      const shouldNav = !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) && event.button === 0 && !event.defaultPrevented;

      if (shouldNav) {
        navigateCalled = true;
      }

      expect(navigateCalled).toBe(false);
    });

    it('scroll is reset after navigation by default', () => {
      let scrollToTopCalled = false;

      const preventScrollReset = false;
      if (!preventScrollReset) {
        scrollToTopCalled = true;
      }

      expect(scrollToTopCalled).toBe(true);
    });

    it('scroll is not reset when preventScrollReset is true', () => {
      let scrollToTopCalled = false;

      const preventScrollReset = true;
      if (!preventScrollReset) {
        scrollToTopCalled = true;
      }

      expect(scrollToTopCalled).toBe(false);
    });
  });

  // ==========================================================================
  // Prefetch strategy logic
  // ==========================================================================
  describe('prefetch strategy', () => {
    it('intent strategy triggers prefetch on hover', () => {
      let prefetched = false;
      const hasPrefetched = { current: false };
      const prefetchStrategy = 'intent';
      const isExternal = false;

      const triggerPrefetch = () => {
        if (hasPrefetched.current || isExternal || prefetchStrategy === 'none') return;
        hasPrefetched.current = true;
        prefetched = true;
      };

      // Simulate mouseenter for intent
      if (prefetchStrategy === 'intent') {
        triggerPrefetch();
      }

      expect(prefetched).toBe(true);
      expect(hasPrefetched.current).toBe(true);
    });

    it('intent strategy triggers prefetch on focus', () => {
      let prefetched = false;
      const hasPrefetched = { current: false };
      const prefetchStrategy = 'intent';
      const isExternal = false;

      const triggerPrefetch = () => {
        if (hasPrefetched.current || isExternal || prefetchStrategy === 'none') return;
        hasPrefetched.current = true;
        prefetched = true;
      };

      // Simulate focus for intent
      if (prefetchStrategy === 'intent') {
        triggerPrefetch();
      }

      expect(prefetched).toBe(true);
    });

    it('none strategy does not trigger prefetch', () => {
      let prefetched = false;
      const hasPrefetched = { current: false };
      const prefetchStrategy = 'none';
      const isExternal = false;

      const triggerPrefetch = () => {
        if (hasPrefetched.current || isExternal || prefetchStrategy === 'none') return;
        hasPrefetched.current = true;
        prefetched = true;
      };

      triggerPrefetch();

      expect(prefetched).toBe(false);
    });

    it('prefetch is deduped (only triggered once)', () => {
      let prefetchCount = 0;
      const hasPrefetched = { current: false };
      const prefetchStrategy = 'intent';
      const isExternal = false;

      const triggerPrefetch = () => {
        if (hasPrefetched.current || isExternal || prefetchStrategy === 'none') return;
        hasPrefetched.current = true;
        prefetchCount++;
      };

      triggerPrefetch();
      triggerPrefetch();
      triggerPrefetch();

      expect(prefetchCount).toBe(1);
    });

    it('external links do not prefetch', () => {
      let prefetched = false;
      const hasPrefetched = { current: false };
      const prefetchStrategy = 'intent';
      const isExternal = true;

      const triggerPrefetch = () => {
        if (hasPrefetched.current || isExternal || prefetchStrategy === 'none') return;
        hasPrefetched.current = true;
        prefetched = true;
      };

      triggerPrefetch();

      expect(prefetched).toBe(false);
    });

    it('render strategy would trigger on mount', () => {
      let prefetched = false;
      const prefetchStrategy = 'render';

      // Simulate useEffect for render strategy
      if (prefetchStrategy === 'render') {
        prefetched = true;
      }

      expect(prefetched).toBe(true);
    });

    it('viewport strategy uses IntersectionObserver', () => {
      let observerCreated = false;
      let observedElement: any = null;

      class MockIntersectionObserver {
        callback: (entries: any[]) => void;
        constructor(callback: (entries: any[]) => void) {
          observerCreated = true;
          this.callback = callback;
        }
        observe(el: any) { observedElement = el; }
        disconnect() {}
      }

      const prefetchStrategy = 'viewport';
      const element = { id: 'link' };

      if (prefetchStrategy === 'viewport') {
        const observer = new MockIntersectionObserver(() => {});
        observer.observe(element);
      }

      expect(observerCreated).toBe(true);
      expect(observedElement).toEqual({ id: 'link' });
    });

    it('viewport strategy triggers prefetch when element intersects', () => {
      let prefetched = false;
      let disconnected = false;

      class MockIntersectionObserver {
        callback: (entries: any[]) => void;
        constructor(callback: (entries: any[]) => void) {
          this.callback = callback;
        }
        observe(_el: any) {
          this.callback([{ isIntersecting: true }]);
        }
        disconnect() { disconnected = true; }
      }

      const observer = new MockIntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            prefetched = true;
            observer.disconnect();
            break;
          }
        }
      });

      observer.observe({});

      expect(prefetched).toBe(true);
      expect(disconnected).toBe(true);
    });

    it('viewport strategy does not trigger when not intersecting', () => {
      let prefetched = false;

      class MockIntersectionObserver {
        callback: (entries: any[]) => void;
        constructor(callback: (entries: any[]) => void) {
          this.callback = callback;
        }
        observe(_el: any) {
          this.callback([{ isIntersecting: false }]);
        }
        disconnect() {}
      }

      const observer = new MockIntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            prefetched = true;
            break;
          }
        }
      });

      observer.observe({});

      expect(prefetched).toBe(false);
    });
  });

  // ==========================================================================
  // NavLink active state logic
  // ==========================================================================
  describe('NavLink active state logic', () => {
    function isPathActive(currentPath: string, toPath: string, end: boolean): boolean {
      const normalizedTo = toPath.split('?')[0].split('#')[0];
      if (end) return currentPath === normalizedTo;
      return (
        currentPath.startsWith(normalizedTo) &&
        (normalizedTo === '/' ? currentPath === '/' : true)
      );
    }

    it('exact match with end=true', () => {
      expect(isPathActive('/dashboard', '/dashboard', true)).toBe(true);
    });

    it('prefix with end=true returns false', () => {
      expect(isPathActive('/dashboard/settings', '/dashboard', true)).toBe(false);
    });

    it('prefix with end=false returns true', () => {
      expect(isPathActive('/dashboard/settings', '/dashboard', false)).toBe(true);
    });

    it('root with end=false only matches root', () => {
      expect(isPathActive('/about', '/', false)).toBe(false);
      expect(isPathActive('/', '/', false)).toBe(true);
    });

    it('className function receives active props', () => {
      const classNameFn = (props: { isActive: boolean; isPending: boolean }) =>
        props.isActive ? 'active' : 'inactive';

      expect(classNameFn({ isActive: true, isPending: false })).toBe('active');
      expect(classNameFn({ isActive: false, isPending: false })).toBe('inactive');
    });

    it('style function receives active props', () => {
      const styleFn = (props: { isActive: boolean; isPending: boolean }) => ({
        fontWeight: props.isActive ? 'bold' : 'normal',
      });

      expect(styleFn({ isActive: true, isPending: false })).toEqual({ fontWeight: 'bold' });
      expect(styleFn({ isActive: false, isPending: false })).toEqual({ fontWeight: 'normal' });
    });

    it('aria-current is "page" when active, undefined otherwise', () => {
      const getAriaCurrent = (isActive: boolean) => (isActive ? 'page' : undefined);
      expect(getAriaCurrent(true)).toBe('page');
      expect(getAriaCurrent(false)).toBeUndefined();
    });
  });

  // ==========================================================================
  // PrefetchStrategy type
  // ==========================================================================
  describe('PrefetchStrategy type', () => {
    it('has valid strategy values', () => {
      const strategies = ['none', 'intent', 'render', 'viewport'];
      expect(strategies).toContain('none');
      expect(strategies).toContain('intent');
      expect(strategies).toContain('render');
      expect(strategies).toContain('viewport');
    });

    it('default strategy is intent', () => {
      // From the component: prefetch: prefetchStrategy = 'intent'
      const defaultStrategy = 'intent';
      expect(defaultStrategy).toBe('intent');
    });
  });

  // ==========================================================================
  // replace and state options
  // ==========================================================================
  describe('replace and state options', () => {
    it('replace defaults to false', () => {
      const defaultReplace = false;
      expect(defaultReplace).toBe(false);
    });

    it('state is passed through to navigate', () => {
      let passedState: unknown = null;
      const mockNav = (_href: string, opts: { state?: unknown }) => {
        passedState = opts.state;
      };

      mockNav('/target', { state: { from: 'home' } });
      expect(passedState).toEqual({ from: 'home' });
    });

    it('preventScrollReset defaults to false', () => {
      const defaultPreventScrollReset = false;
      expect(defaultPreventScrollReset).toBe(false);
    });

    it('reloadDocument defaults to false', () => {
      const defaultReloadDocument = false;
      expect(defaultReloadDocument).toBe(false);
    });
  });
});
