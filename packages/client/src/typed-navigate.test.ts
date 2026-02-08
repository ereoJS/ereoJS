import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// We need to mock the navigation module before importing typed-navigate
// Since typed-navigate imports from './navigation', we mock at module level
const mockNavigate = mock(() => Promise.resolve());
const mockRouterBack = mock(() => {});
const mockRouterForward = mock(() => {});
const mockRouterGo = mock((_delta: number) => {});

mock.module('./navigation', () => ({
  navigate: mockNavigate,
  router: {
    back: mockRouterBack,
    forward: mockRouterForward,
    go: mockRouterGo,
    getState: () => ({ pathname: '/', search: '', hash: '' }),
  },
  onNavigate: () => () => {},
}));

import {
  buildTypedUrl,
  typedRedirect,
  typedNavigate,
  parseTypedSearchParams,
  parseTypedHashParams,
  isCurrentPath,
  goBack,
  goForward,
  go,
  preloadRoute,
  useTypedNavigate,
} from './typed-navigate';

describe('@ereo/client - typed-navigate', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRouterBack.mockClear();
    mockRouterForward.mockClear();
    mockRouterGo.mockClear();
  });

  // ==========================================================================
  // buildTypedUrl
  // ==========================================================================
  describe('buildTypedUrl', () => {
    it('returns the pattern unchanged when no options are provided', () => {
      const url = buildTypedUrl('/about');
      expect(url).toBe('/about');
    });

    it('returns the pattern unchanged when options is empty object', () => {
      const url = buildTypedUrl('/about', {});
      expect(url).toBe('/about');
    });

    it('replaces a single [param] with value', () => {
      const url = buildTypedUrl('/users/[id]', {
        params: { id: '123' },
      });
      expect(url).toBe('/users/123');
    });

    it('replaces multiple [param] placeholders', () => {
      const url = buildTypedUrl('/users/[userId]/posts/[postId]', {
        params: { userId: '42', postId: '99' },
      });
      expect(url).toBe('/users/42/posts/99');
    });

    it('handles catch-all [...param] with a single value', () => {
      const url = buildTypedUrl('/docs/[...slug]', {
        params: { slug: 'getting-started' },
      });
      expect(url).toBe('/docs/getting-started');
    });

    it('handles catch-all [...param] with array values joined by slash', () => {
      const url = buildTypedUrl('/docs/[...slug]', {
        params: { slug: ['api', 'reference', 'hooks'] },
      });
      expect(url).toBe('/docs/api/reference/hooks');
    });

    it('handles optional [[param]] with value provided', () => {
      const url = buildTypedUrl('/users/[[lang]]', {
        params: { lang: 'en' },
      });
      expect(url).toBe('/users/en');
    });

    it('does not strip optional [[param]] when params is not provided', () => {
      // When options is {} or omitted, params destructures to undefined
      // buildPathWithParams returns pattern as-is since !params is true
      const url = buildTypedUrl('/users/[[lang]]', {});
      expect(url).toBe('/users/[[lang]]');
    });

    it('removes unfilled optional [[param]] when params object is provided but empty', () => {
      // When params is explicitly an empty object, buildPathWithParams processes the regex
      const url = buildTypedUrl('/users/[[lang]]', { params: {} as any });
      expect(url).toBe('/users');
    });

    it('removes unfilled optional params with leading slash', () => {
      const url = buildTypedUrl('/shop/[[category]]/items', {
        params: {},
      });
      // The regex /\/?\[\[[^\]]+\]\]/g strips optional params (with optional leading /)
      expect(url).toBe('/shop/items');
    });

    it('appends search params as query string', () => {
      const url = buildTypedUrl('/posts', {
        search: { page: 1, sort: 'desc' },
      });
      expect(url).toContain('?');
      expect(url).toContain('page=1');
      expect(url).toContain('sort=desc');
    });

    it('appends hash params after hash', () => {
      const url = buildTypedUrl('/posts', {
        hash: { section: 'comments' },
      });
      expect(url).toContain('#');
      expect(url).toContain('section=comments');
    });

    it('combines params, search, and hash', () => {
      const url = buildTypedUrl('/posts/[slug]', {
        params: { slug: 'hello-world' },
        search: { page: 1 },
        hash: { section: 'comments' },
      });
      expect(url).toStartWith('/posts/hello-world');
      expect(url).toContain('?page=1');
      expect(url).toContain('#section=comments');
    });

    it('skips undefined search params', () => {
      const url = buildTypedUrl('/posts', {
        search: { page: 1, sort: undefined } as any,
      });
      expect(url).toContain('page=1');
      expect(url).not.toContain('sort');
    });

    it('skips null search params', () => {
      const url = buildTypedUrl('/posts', {
        search: { page: 1, sort: null } as any,
      });
      expect(url).toContain('page=1');
      expect(url).not.toContain('sort');
    });

    it('handles array search params with append', () => {
      const url = buildTypedUrl('/posts', {
        search: { tags: ['react', 'typescript'] } as any,
      });
      expect(url).toContain('tags=react');
      expect(url).toContain('tags=typescript');
    });

    it('returns empty search string when search is empty', () => {
      const url = buildTypedUrl('/posts', { search: {} });
      expect(url).toBe('/posts');
    });

    it('returns empty hash string when hash is empty', () => {
      const url = buildTypedUrl('/posts', { hash: {} });
      expect(url).toBe('/posts');
    });

    it('skips undefined param values', () => {
      const url = buildTypedUrl('/users/[id]', {
        params: { id: undefined } as any,
      });
      // When value is undefined, the placeholder is not replaced
      expect(url).toBe('/users/[id]');
    });

    it('handles [param] with array value (takes first element)', () => {
      const url = buildTypedUrl('/users/[id]', {
        params: { id: ['first', 'second'] } as any,
      });
      expect(url).toBe('/users/first');
    });

    it('handles [[param]] with array value (takes first element)', () => {
      const url = buildTypedUrl('/users/[[lang]]', {
        params: { lang: ['en', 'fr'] } as any,
      });
      expect(url).toBe('/users/en');
    });
  });

  // ==========================================================================
  // typedRedirect
  // ==========================================================================
  describe('typedRedirect', () => {
    it('returns a Response with 302 status by default', () => {
      const response = typedRedirect('/login');
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(302);
    });

    it('sets the Location header to the built URL', () => {
      const response = typedRedirect('/login');
      expect(response.headers.get('Location')).toBe('/login');
    });

    it('uses the specified status code', () => {
      const response = typedRedirect('/login', { status: 301 });
      expect(response.status).toBe(301);
    });

    it('supports 303 status', () => {
      const response = typedRedirect('/login', { status: 303 });
      expect(response.status).toBe(303);
    });

    it('supports 307 status', () => {
      const response = typedRedirect('/login', { status: 307 });
      expect(response.status).toBe(307);
    });

    it('supports 308 status', () => {
      const response = typedRedirect('/login', { status: 308 });
      expect(response.status).toBe(308);
    });

    it('builds the URL with params', () => {
      const response = typedRedirect('/users/[id]', {
        params: { id: '456' },
      });
      expect(response.headers.get('Location')).toBe('/users/456');
    });

    it('builds the URL with search params', () => {
      const response = typedRedirect('/login', {
        search: { returnTo: '/dashboard' },
      });
      const location = response.headers.get('Location');
      expect(location).toContain('returnTo=%2Fdashboard');
    });

    it('builds the URL with hash params', () => {
      const response = typedRedirect('/posts', {
        hash: { section: 'comments' },
      });
      const location = response.headers.get('Location');
      expect(location).toContain('#section=comments');
    });

    it('includes custom headers', () => {
      const response = typedRedirect('/login', {
        headers: { 'X-Custom': 'value' },
      });
      expect(response.headers.get('Location')).toBe('/login');
      expect(response.headers.get('X-Custom')).toBe('value');
    });

    it('includes custom headers from Headers object', () => {
      const headers = new Headers();
      headers.set('X-Custom', 'from-headers');
      const response = typedRedirect('/login', { headers });
      expect(response.headers.get('X-Custom')).toBe('from-headers');
    });

    it('has null body', () => {
      const response = typedRedirect('/login');
      expect(response.body).toBeNull();
    });

    it('combines params, search, and hash in Location', () => {
      const response = typedRedirect('/users/[id]', {
        params: { id: '42' },
        search: { tab: 'settings' },
        hash: { section: 'profile' },
      });
      const location = response.headers.get('Location')!;
      expect(location).toStartWith('/users/42');
      expect(location).toContain('tab=settings');
      expect(location).toContain('#section=profile');
    });
  });

  // ==========================================================================
  // typedNavigate
  // ==========================================================================
  describe('typedNavigate', () => {
    let originalWindow: any;
    let scrollToMock: ReturnType<typeof mock>;

    beforeEach(() => {
      scrollToMock = mock(() => {});
      originalWindow = globalThis.window;
      // @ts-ignore
      globalThis.window = {
        scrollTo: scrollToMock,
        location: { pathname: '/', origin: 'http://localhost:3000' },
      };
    });

    afterEach(() => {
      globalThis.window = originalWindow;
    });

    it('calls baseNavigate with the built URL', async () => {
      await typedNavigate('/about');
      expect(mockNavigate).toHaveBeenCalledWith('/about', {
        replace: undefined,
        state: undefined,
      });
    });

    it('passes replace option to baseNavigate', async () => {
      await typedNavigate('/about', { replace: true });
      expect(mockNavigate).toHaveBeenCalledWith('/about', {
        replace: true,
        state: undefined,
      });
    });

    it('passes state option to baseNavigate', async () => {
      const state = { from: 'home' };
      await typedNavigate('/about', { state });
      expect(mockNavigate).toHaveBeenCalledWith('/about', {
        replace: undefined,
        state,
      });
    });

    it('builds URL with params before navigating', async () => {
      await typedNavigate('/users/[id]', { params: { id: '789' } });
      expect(mockNavigate).toHaveBeenCalledWith('/users/789', expect.any(Object));
    });

    it('builds URL with search params before navigating', async () => {
      await typedNavigate('/posts', { search: { page: 2 } } as any);
      const calledUrl = mockNavigate.mock.calls[0][0];
      expect(calledUrl).toContain('page=2');
    });

    it('builds URL with hash params before navigating', async () => {
      await typedNavigate('/posts', { hash: { section: 'top' } } as any);
      const calledUrl = mockNavigate.mock.calls[0][0];
      expect(calledUrl).toContain('#section=top');
    });

    it('calls window.scrollTo(0, 0) by default', async () => {
      await typedNavigate('/about');
      expect(scrollToMock).toHaveBeenCalledWith(0, 0);
    });

    it('does not call scrollTo when scroll is false', async () => {
      await typedNavigate('/about', { scroll: false });
      expect(scrollToMock).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // parseTypedSearchParams
  // ==========================================================================
  describe('parseTypedSearchParams', () => {
    it('parses search params from a URL object', () => {
      const url = new URL('http://localhost:3000/posts?page=1&sort=desc');
      const params = parseTypedSearchParams(url);
      expect(params).toEqual({ page: '1', sort: 'desc' });
    });

    it('parses search params from a URL string', () => {
      const params = parseTypedSearchParams('http://localhost:3000/posts?page=2&sort=asc');
      expect(params).toEqual({ page: '2', sort: 'asc' });
    });

    it('returns empty object when no search params', () => {
      const url = new URL('http://localhost:3000/posts');
      const params = parseTypedSearchParams(url);
      expect(params).toEqual({});
    });

    it('combines duplicate keys into arrays', () => {
      const url = new URL('http://localhost:3000/posts?tag=react&tag=typescript');
      const params = parseTypedSearchParams(url);
      expect(params).toEqual({ tag: ['react', 'typescript'] });
    });

    it('handles three duplicate keys as an array', () => {
      const url = new URL('http://localhost:3000/posts?tag=a&tag=b&tag=c');
      const params = parseTypedSearchParams(url);
      expect(params).toEqual({ tag: ['a', 'b', 'c'] });
    });

    it('handles mixed single and duplicate keys', () => {
      const url = new URL('http://localhost:3000/posts?page=1&tag=react&tag=node');
      const params = parseTypedSearchParams(url);
      expect(params).toEqual({ page: '1', tag: ['react', 'node'] });
    });

    it('handles encoded values', () => {
      const url = new URL('http://localhost:3000/posts?returnTo=%2Fdashboard');
      const params = parseTypedSearchParams(url);
      expect(params).toEqual({ returnTo: '/dashboard' });
    });

    it('handles empty value for a key', () => {
      const url = new URL('http://localhost:3000/posts?filter=');
      const params = parseTypedSearchParams(url);
      expect(params).toEqual({ filter: '' });
    });
  });

  // ==========================================================================
  // parseTypedHashParams
  // ==========================================================================
  describe('parseTypedHashParams', () => {
    it('parses hash params from a URL object', () => {
      const url = new URL('http://localhost:3000/posts#section=comments');
      const params = parseTypedHashParams(url);
      expect(params).toEqual({ section: 'comments' });
    });

    it('parses hash params from a URL string', () => {
      const params = parseTypedHashParams('http://localhost:3000/posts#section=header&tab=info');
      expect(params).toEqual({ section: 'header', tab: 'info' });
    });

    it('returns empty object when no hash present', () => {
      const url = new URL('http://localhost:3000/posts');
      const params = parseTypedHashParams(url);
      expect(params).toEqual({});
    });

    it('returns empty object when hash is empty string', () => {
      const url = new URL('http://localhost:3000/posts');
      // URL with no hash -> urlObj.hash is ''
      const params = parseTypedHashParams(url);
      expect(params).toEqual({});
    });

    it('handles multiple hash params', () => {
      const url = new URL('http://localhost:3000/page#a=1&b=2&c=3');
      const params = parseTypedHashParams(url);
      expect(params).toEqual({ a: '1', b: '2', c: '3' });
    });

    it('handles encoded hash values', () => {
      const url = new URL('http://localhost:3000/page#path=%2Ftest%2Fvalue');
      const params = parseTypedHashParams(url);
      expect(params).toEqual({ path: '/test/value' });
    });
  });

  // ==========================================================================
  // isCurrentPath
  // ==========================================================================
  describe('isCurrentPath', () => {
    let originalWindow: any;

    beforeEach(() => {
      originalWindow = globalThis.window;
    });

    afterEach(() => {
      globalThis.window = originalWindow;
    });

    it('returns false when window is undefined (SSR)', () => {
      // @ts-ignore
      globalThis.window = undefined;
      const result = isCurrentPath('/about');
      expect(result).toBe(false);
    });

    it('returns true for exact match when exact is true', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/about' } };
      expect(isCurrentPath('/about', { exact: true })).toBe(true);
    });

    it('returns false for prefix match when exact is true', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/about/team' } };
      expect(isCurrentPath('/about', { exact: true })).toBe(false);
    });

    it('returns true for prefix match when exact is not set', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/users/42/posts' } };
      expect(isCurrentPath('/users')).toBe(true);
    });

    it('returns true for exact path match without exact option', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/about' } };
      expect(isCurrentPath('/about')).toBe(true);
    });

    it('returns false when paths do not match', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/posts' } };
      expect(isCurrentPath('/about')).toBe(false);
    });

    it('root path "/" only matches root, not other paths', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/about' } };
      expect(isCurrentPath('/')).toBe(false);
    });

    it('root path "/" matches itself', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/' } };
      expect(isCurrentPath('/')).toBe(true);
    });

    it('uses params to build the target path for comparison', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/users/42' } };
      expect(isCurrentPath('/users/[id]', { params: { id: '42' }, exact: true })).toBe(true);
    });

    it('returns false when parameterized path does not match', () => {
      // @ts-ignore
      globalThis.window = { location: { pathname: '/users/99' } };
      expect(isCurrentPath('/users/[id]', { params: { id: '42' }, exact: true })).toBe(false);
    });
  });

  // ==========================================================================
  // goBack, goForward, go
  // ==========================================================================
  describe('goBack', () => {
    it('calls router.back()', () => {
      goBack();
      expect(mockRouterBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('goForward', () => {
    it('calls router.forward()', () => {
      goForward();
      expect(mockRouterForward).toHaveBeenCalledTimes(1);
    });
  });

  describe('go', () => {
    it('calls router.go with the specified delta', () => {
      go(-2);
      expect(mockRouterGo).toHaveBeenCalledWith(-2);
    });

    it('calls router.go with positive delta', () => {
      go(3);
      expect(mockRouterGo).toHaveBeenCalledWith(3);
    });

    it('calls router.go with zero', () => {
      go(0);
      expect(mockRouterGo).toHaveBeenCalledWith(0);
    });
  });

  // ==========================================================================
  // preloadRoute
  // ==========================================================================
  describe('preloadRoute', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('fetches the built URL with preload headers', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response('{}', { status: 200 }))
      );
      globalThis.fetch = fetchMock as any;

      await preloadRoute('/about');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe('/about');
      expect(options.headers.Accept).toBe('application/json');
      expect(options.headers['X-Ereo-Preload']).toBe('true');
    });

    it('builds URL with params before fetching', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response('{}', { status: 200 }))
      );
      globalThis.fetch = fetchMock as any;

      await preloadRoute('/users/[id]', { params: { id: '42' } });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe('/users/42');
    });

    it('builds URL with search params before fetching', async () => {
      const fetchMock = mock(() =>
        Promise.resolve(new Response('{}', { status: 200 }))
      );
      globalThis.fetch = fetchMock as any;

      await preloadRoute('/posts', { search: { page: 1 } } as any);

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('page=1');
    });

    it('silently fails on fetch error', async () => {
      const fetchMock = mock(() => Promise.reject(new Error('Network error')));
      globalThis.fetch = fetchMock as any;

      // Should not throw
      await preloadRoute('/about');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // useTypedNavigate
  // ==========================================================================
  describe('useTypedNavigate', () => {
    it('returns a function', () => {
      const navigate = useTypedNavigate();
      expect(typeof navigate).toBe('function');
    });

    it('calls router.go when passed a number', () => {
      const navigate = useTypedNavigate();
      navigate(-1);
      expect(mockRouterGo).toHaveBeenCalledWith(-1);
    });

    it('calls typedNavigate when passed a string path', async () => {
      const navigate = useTypedNavigate();
      const result = navigate('/about');
      // It should return a promise (from typedNavigate)
      expect(result).toBeInstanceOf(Promise);
    });
  });
});
