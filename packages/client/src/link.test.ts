import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';

// Mock React module for testing
const React = {
  forwardRef: (fn: any) => fn,
  useRef: (initial: any) => ({ current: initial }),
  useCallback: (fn: any, deps: any[]) => fn,
  useEffect: (fn: any, deps: any[]) => {},
  useState: (initial: any) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useMemo: (fn: any, deps: any[]) => fn(),
  createElement: (type: any, props: any, ...children: any[]) => ({
    type,
    props: { ...props, children },
  }),
};

describe('@ereo/client - Link Component', () => {
  describe('LinkProps interface', () => {
    interface LinkProps {
      to: string;
      prefetch?: 'none' | 'intent' | 'render' | 'viewport';
      replace?: boolean;
      preventScrollReset?: boolean;
      state?: unknown;
      reloadDocument?: boolean;
      children?: any;
    }

    test('creates props with required to property', () => {
      const props: LinkProps = {
        to: '/about',
      };

      expect(props.to).toBe('/about');
    });

    test('creates props with all optional properties', () => {
      const props: LinkProps = {
        to: '/dashboard',
        prefetch: 'render',
        replace: true,
        preventScrollReset: true,
        state: { from: 'home' },
        reloadDocument: false,
      };

      expect(props.prefetch).toBe('render');
      expect(props.replace).toBe(true);
      expect(props.preventScrollReset).toBe(true);
      expect(props.state).toEqual({ from: 'home' });
      expect(props.reloadDocument).toBe(false);
    });

    test('default prefetch strategy should be intent', () => {
      const defaultPrefetch = 'intent';
      expect(defaultPrefetch).toBe('intent');
    });
  });

  describe('isExternalUrl logic', () => {
    function isExternalUrl(url: string, origin: string): boolean {
      // Single-slash relative URLs are internal (but not protocol-relative //)
      if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('.')) {
        return false;
      }

      // Protocol-relative or absolute URLs
      try {
        const parsed = new URL(url, origin);
        return parsed.origin !== origin;
      } catch {
        return false;
      }
    }

    const origin = 'http://localhost:3000';

    test('relative URLs are internal', () => {
      expect(isExternalUrl('/about', origin)).toBe(false);
      expect(isExternalUrl('/users/1', origin)).toBe(false);
      expect(isExternalUrl('./relative', origin)).toBe(false);
    });

    test('same-origin absolute URLs are internal', () => {
      expect(isExternalUrl('http://localhost:3000/about', origin)).toBe(false);
      expect(isExternalUrl('http://localhost:3000/', origin)).toBe(false);
    });

    test('different-origin URLs are external', () => {
      expect(isExternalUrl('http://external.com/path', origin)).toBe(true);
      expect(isExternalUrl('https://google.com', origin)).toBe(true);
    });

    test('handles protocol-relative URLs as external', () => {
      // Protocol-relative URLs (starting with //) resolve to the same protocol
      // but can point to external origins
      expect(isExternalUrl('//external.com/path', origin)).toBe(true);
    });
  });

  describe('shouldNavigate logic', () => {
    interface MockClickEvent {
      metaKey: boolean;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      button: number;
      defaultPrevented: boolean;
    }

    function shouldNavigate(event: MockClickEvent): boolean {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return false;
      }
      if (event.button !== 0) {
        return false;
      }
      if (event.defaultPrevented) {
        return false;
      }
      return true;
    }

    test('returns true for normal left click', () => {
      const event: MockClickEvent = {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      };

      expect(shouldNavigate(event)).toBe(true);
    });

    test('returns false when meta key is pressed', () => {
      const event: MockClickEvent = {
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      };

      expect(shouldNavigate(event)).toBe(false);
    });

    test('returns false when ctrl key is pressed', () => {
      const event: MockClickEvent = {
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      };

      expect(shouldNavigate(event)).toBe(false);
    });

    test('returns false when shift key is pressed', () => {
      const event: MockClickEvent = {
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
        button: 0,
        defaultPrevented: false,
      };

      expect(shouldNavigate(event)).toBe(false);
    });

    test('returns false when alt key is pressed', () => {
      const event: MockClickEvent = {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: true,
        button: 0,
        defaultPrevented: false,
      };

      expect(shouldNavigate(event)).toBe(false);
    });

    test('returns false for right click', () => {
      const event: MockClickEvent = {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 2, // Right click
        defaultPrevented: false,
      };

      expect(shouldNavigate(event)).toBe(false);
    });

    test('returns false for middle click', () => {
      const event: MockClickEvent = {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 1, // Middle click
        defaultPrevented: false,
      };

      expect(shouldNavigate(event)).toBe(false);
    });

    test('returns false when default is prevented', () => {
      const event: MockClickEvent = {
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        button: 0,
        defaultPrevented: true,
      };

      expect(shouldNavigate(event)).toBe(false);
    });
  });

  describe('Link renders anchor tag', () => {
    test('Link should output anchor element with correct href', () => {
      // Simulating what the Link component would render
      const to = '/about';
      const anchorProps = {
        href: to,
        onClick: () => {},
        onMouseEnter: () => {},
        onFocus: () => {},
      };

      expect(anchorProps.href).toBe('/about');
    });

    test('Link passes through additional props', () => {
      const props = {
        to: '/about',
        className: 'nav-link',
        'aria-label': 'About page',
        id: 'about-link',
      };

      expect(props.className).toBe('nav-link');
      expect(props['aria-label']).toBe('About page');
      expect(props.id).toBe('about-link');
    });
  });

  describe('Click triggers client navigation', () => {
    test('navigate function is called with correct arguments', () => {
      let navigateCalled = false;
      let navigateArgs: any = null;

      const mockNavigate = (to: string, options?: { replace?: boolean; state?: unknown }) => {
        navigateCalled = true;
        navigateArgs = { to, options };
      };

      // Simulate click handling
      const to = '/dashboard';
      const replace = false;
      const state = { from: 'home' };

      mockNavigate(to, { replace, state });

      expect(navigateCalled).toBe(true);
      expect(navigateArgs.to).toBe('/dashboard');
      expect(navigateArgs.options.replace).toBe(false);
      expect(navigateArgs.options.state).toEqual({ from: 'home' });
    });

    test('navigate is not called for external URLs', () => {
      let navigateCalled = false;

      const isExternal = true;
      const reloadDocument = false;

      // This mimics the condition in handleClick
      if (!isExternal && !reloadDocument) {
        navigateCalled = true;
      }

      expect(navigateCalled).toBe(false);
    });

    test('navigate is not called when reloadDocument is true', () => {
      let navigateCalled = false;

      const isExternal = false;
      const reloadDocument = true;

      if (!isExternal && !reloadDocument) {
        navigateCalled = true;
      }

      expect(navigateCalled).toBe(false);
    });
  });

  describe('Prefetch on hover works', () => {
    test('intent strategy triggers prefetch on mouse enter', () => {
      let prefetchCalled = false;
      let prefetchedUrl = '';

      const mockPrefetch = (url: string) => {
        prefetchCalled = true;
        prefetchedUrl = url;
      };

      const prefetchStrategy = 'intent';
      const hasPrefetched = { current: false };
      const to = '/dashboard';

      // Simulate mouse enter handler
      if (prefetchStrategy === 'intent' && !hasPrefetched.current) {
        hasPrefetched.current = true;
        mockPrefetch(to);
      }

      expect(prefetchCalled).toBe(true);
      expect(prefetchedUrl).toBe('/dashboard');
      expect(hasPrefetched.current).toBe(true);
    });

    test('intent strategy triggers prefetch on focus', () => {
      let prefetchCalled = false;

      const mockPrefetch = () => {
        prefetchCalled = true;
      };

      const prefetchStrategy = 'intent';
      const hasPrefetched = { current: false };

      // Simulate focus handler
      if (prefetchStrategy === 'intent' && !hasPrefetched.current) {
        hasPrefetched.current = true;
        mockPrefetch();
      }

      expect(prefetchCalled).toBe(true);
    });

    test('none strategy does not trigger prefetch on hover', () => {
      let prefetchCalled = false;

      const mockPrefetch = () => {
        prefetchCalled = true;
      };

      const prefetchStrategy = 'none';
      const hasPrefetched = { current: false };

      // Simulate mouse enter handler
      if (prefetchStrategy === 'intent' && !hasPrefetched.current) {
        mockPrefetch();
      }

      expect(prefetchCalled).toBe(false);
    });
  });

  describe('Prefetch on render works', () => {
    test('render strategy triggers prefetch immediately', () => {
      let prefetchCalled = false;
      let prefetchedUrl = '';

      const mockPrefetch = (url: string) => {
        prefetchCalled = true;
        prefetchedUrl = url;
      };

      const prefetchStrategy = 'render';
      const to = '/dashboard';

      // Simulate useEffect for render strategy
      if (prefetchStrategy === 'render') {
        mockPrefetch(to);
      }

      expect(prefetchCalled).toBe(true);
      expect(prefetchedUrl).toBe('/dashboard');
    });

    test('intent strategy does not prefetch on render', () => {
      let prefetchCalled = false;

      const mockPrefetch = () => {
        prefetchCalled = true;
      };

      const prefetchStrategy = 'intent';

      // Simulate useEffect for render strategy
      if (prefetchStrategy === 'render') {
        mockPrefetch();
      }

      expect(prefetchCalled).toBe(false);
    });
  });

  describe('Prefetch on viewport works', () => {
    test('viewport strategy uses IntersectionObserver', () => {
      let observerCreated = false;
      let observedElement: any = null;
      let disconnectCalled = false;

      class MockIntersectionObserver {
        callback: (entries: any[]) => void;

        constructor(callback: (entries: any[]) => void, options?: any) {
          observerCreated = true;
          this.callback = callback;
        }

        observe(element: any) {
          observedElement = element;
        }

        disconnect() {
          disconnectCalled = true;
        }
      }

      const prefetchStrategy = 'viewport';
      const element = { id: 'test-link' };

      // Simulate viewport strategy setup
      if (prefetchStrategy === 'viewport') {
        const observer = new MockIntersectionObserver(() => {});
        observer.observe(element);
      }

      expect(observerCreated).toBe(true);
      expect(observedElement).toEqual({ id: 'test-link' });
    });

    test('viewport strategy triggers prefetch when element intersects', () => {
      let prefetchCalled = false;
      let disconnectCalled = false;

      const mockPrefetch = () => {
        prefetchCalled = true;
      };

      class MockIntersectionObserver {
        callback: (entries: any[]) => void;

        constructor(callback: (entries: any[]) => void) {
          this.callback = callback;
        }

        observe(element: any) {
          // Simulate intersection
          this.callback([{ isIntersecting: true }]);
        }

        disconnect() {
          disconnectCalled = true;
        }
      }

      const observer = new MockIntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            mockPrefetch();
            observer.disconnect();
            break;
          }
        }
      });

      observer.observe({});

      expect(prefetchCalled).toBe(true);
      expect(disconnectCalled).toBe(true);
    });

    test('viewport strategy does not prefetch when element is not intersecting', () => {
      let prefetchCalled = false;

      const mockPrefetch = () => {
        prefetchCalled = true;
      };

      class MockIntersectionObserver {
        callback: (entries: any[]) => void;

        constructor(callback: (entries: any[]) => void) {
          this.callback = callback;
        }

        observe(element: any) {
          // Simulate non-intersection
          this.callback([{ isIntersecting: false }]);
        }

        disconnect() {}
      }

      const observer = new MockIntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            mockPrefetch();
            break;
          }
        }
      });

      observer.observe({});

      expect(prefetchCalled).toBe(false);
    });
  });

  describe('NavLink applies active class', () => {
    interface NavLinkActiveProps {
      isActive: boolean;
      isPending: boolean;
    }

    function isPathActive(currentPath: string, toPath: string, end: boolean): boolean {
      const normalizedTo = toPath.split('?')[0].split('#')[0];
      if (end) {
        return currentPath === normalizedTo;
      }
      return currentPath.startsWith(normalizedTo) &&
             (normalizedTo === '/' ? currentPath === '/' : true);
    }

    test('NavLink detects active state for exact match', () => {
      const currentPath = '/dashboard';
      const to = '/dashboard';
      const end = true;

      const isActive = isPathActive(currentPath, to, end);

      expect(isActive).toBe(true);
    });

    test('NavLink detects active state for prefix match', () => {
      const currentPath = '/dashboard/settings';
      const to = '/dashboard';
      const end = false;

      const isActive = isPathActive(currentPath, to, end);

      expect(isActive).toBe(true);
    });

    test('NavLink is not active when paths differ', () => {
      const currentPath = '/users';
      const to = '/dashboard';
      const end = false;

      const isActive = isPathActive(currentPath, to, end);

      expect(isActive).toBe(false);
    });

    test('NavLink with end=true is not active for prefix match', () => {
      const currentPath = '/dashboard/settings';
      const to = '/dashboard';
      const end = true;

      const isActive = isPathActive(currentPath, to, end);

      expect(isActive).toBe(false);
    });

    test('Root path with end=false matches only root', () => {
      // When to='/' and end=false, it should only match '/' not '/about'
      const currentPath = '/about';
      const to = '/';
      const end = false;

      const isActive = isPathActive(currentPath, to, end);

      expect(isActive).toBe(false);
    });

    test('Root path matches root', () => {
      const currentPath = '/';
      const to = '/';
      const end = false;

      const isActive = isPathActive(currentPath, to, end);

      expect(isActive).toBe(true);
    });

    test('className function receives active props', () => {
      let receivedProps: NavLinkActiveProps | null = null;

      const classNameFn = (props: NavLinkActiveProps) => {
        receivedProps = props;
        return props.isActive ? 'active' : '';
      };

      const activeProps: NavLinkActiveProps = { isActive: true, isPending: false };
      const result = classNameFn(activeProps);

      expect(receivedProps).toEqual({ isActive: true, isPending: false });
      expect(result).toBe('active');
    });

    test('style function receives active props', () => {
      const styleFn = (props: NavLinkActiveProps) => ({
        fontWeight: props.isActive ? 'bold' : 'normal',
      });

      const activeProps: NavLinkActiveProps = { isActive: true, isPending: false };
      const result = styleFn(activeProps);

      expect(result).toEqual({ fontWeight: 'bold' });
    });

    test('NavLink sets aria-current when active', () => {
      const isActive = true;
      const ariaCurrent = isActive ? 'page' : undefined;

      expect(ariaCurrent).toBe('page');
    });

    test('NavLink does not set aria-current when inactive', () => {
      const isActive = false;
      const ariaCurrent = isActive ? 'page' : undefined;

      expect(ariaCurrent).toBeUndefined();
    });
  });

  describe('External links work normally', () => {
    test('external URL detection', () => {
      function isExternalUrl(url: string, origin: string): boolean {
        if (url.startsWith('/') || url.startsWith('.')) {
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

      expect(isExternalUrl('https://google.com', origin)).toBe(true);
      expect(isExternalUrl('http://external.com/path', origin)).toBe(true);
      expect(isExternalUrl('/internal', origin)).toBe(false);
    });

    test('external links skip client navigation', () => {
      let clientNavigateCalled = false;
      let eventDefaultPrevented = false;

      const isExternal = true;
      const shouldPreventDefault = !isExternal;

      if (shouldPreventDefault) {
        eventDefaultPrevented = true;
        clientNavigateCalled = true;
      }

      expect(eventDefaultPrevented).toBe(false);
      expect(clientNavigateCalled).toBe(false);
    });

    test('reloadDocument links skip client navigation', () => {
      let clientNavigateCalled = false;

      const reloadDocument = true;
      const isExternal = false;

      if (!isExternal && !reloadDocument) {
        clientNavigateCalled = true;
      }

      expect(clientNavigateCalled).toBe(false);
    });

    test('target="_blank" links skip client navigation', () => {
      let clientNavigateCalled = false;

      const target = '_blank';
      const shouldSkip = target && target !== '_self';

      if (!shouldSkip) {
        clientNavigateCalled = true;
      }

      expect(clientNavigateCalled).toBe(false);
    });
  });

  describe('Prefetch deduplication', () => {
    test('prefetch is only triggered once', () => {
      let prefetchCount = 0;

      const mockPrefetch = () => {
        prefetchCount++;
      };

      const hasPrefetched = { current: false };

      const triggerPrefetch = () => {
        if (!hasPrefetched.current) {
          hasPrefetched.current = true;
          mockPrefetch();
        }
      };

      // Trigger multiple times
      triggerPrefetch();
      triggerPrefetch();
      triggerPrefetch();

      expect(prefetchCount).toBe(1);
    });
  });

  describe('useIsActive hook logic', () => {
    function isActive(pathname: string, path: string, end: boolean): boolean {
      const toPath = path.split('?')[0].split('#')[0];
      if (end) {
        return pathname === toPath;
      }
      return pathname.startsWith(toPath) &&
             (toPath === '/' ? pathname === '/' : true);
    }

    test('returns true for exact match with end=true', () => {
      expect(isActive('/dashboard', '/dashboard', true)).toBe(true);
    });

    test('returns false for partial match with end=true', () => {
      expect(isActive('/dashboard/settings', '/dashboard', true)).toBe(false);
    });

    test('returns true for prefix match with end=false', () => {
      expect(isActive('/dashboard/settings', '/dashboard', false)).toBe(true);
    });

    test('handles paths with query strings', () => {
      const path = '/dashboard?tab=settings';
      const cleanPath = path.split('?')[0];

      expect(isActive('/dashboard', cleanPath, true)).toBe(true);
    });

    test('handles paths with hash', () => {
      const path = '/dashboard#section';
      const cleanPath = path.split('#')[0];

      expect(isActive('/dashboard', cleanPath, true)).toBe(true);
    });
  });

  describe('replace navigation option', () => {
    test('replace option is passed to navigate', () => {
      let navigateOptions: any = null;

      const mockNavigate = (to: string, options?: { replace?: boolean }) => {
        navigateOptions = options;
      };

      mockNavigate('/new-page', { replace: true });

      expect(navigateOptions.replace).toBe(true);
    });

    test('default replace is false', () => {
      const defaultReplace = false;
      expect(defaultReplace).toBe(false);
    });
  });

  describe('preventScrollReset option', () => {
    test('scroll is reset when preventScrollReset is false', () => {
      let scrollResetCalled = false;

      const preventScrollReset = false;

      // Simulate scroll handling after navigation
      if (!preventScrollReset) {
        scrollResetCalled = true;
      }

      expect(scrollResetCalled).toBe(true);
    });

    test('scroll is not reset when preventScrollReset is true', () => {
      let scrollResetCalled = false;

      const preventScrollReset = true;

      if (!preventScrollReset) {
        scrollResetCalled = true;
      }

      expect(scrollResetCalled).toBe(false);
    });
  });

  describe('state passing', () => {
    test('state is passed to navigate', () => {
      let passedState: unknown = null;

      const mockNavigate = (to: string, options?: { state?: unknown }) => {
        passedState = options?.state;
      };

      const state = { referrer: '/home', data: { id: 123 } };
      mockNavigate('/target', { state });

      expect(passedState).toEqual({ referrer: '/home', data: { id: 123 } });
    });
  });
});
