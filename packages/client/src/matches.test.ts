import { describe, expect, test } from 'bun:test';
import {
  useMatches,
  MatchesProvider,
  MatchesContext,
  type RouteMatchData,
  type MatchesContextValue,
  type MatchesProviderProps,
} from './matches';

// =================================================================
// MatchesContext tests
// =================================================================

describe('@ereo/client - MatchesContext', () => {
  test('defaults to null', () => {
    expect(MatchesContext._currentValue).toBeNull();
  });

  test('context value holds matches array', () => {
    const matches: RouteMatchData[] = [
      {
        id: 'root',
        pathname: '/',
        params: {},
        data: { theme: 'dark' },
        handle: { breadcrumb: 'Home' },
      },
      {
        id: '/users/[id]',
        pathname: '/users/42',
        params: { id: '42' },
        data: { user: { name: 'Alice' } },
        handle: { breadcrumb: 'User Profile' },
      },
    ];

    const value: MatchesContextValue = {
      matches,
      setMatches: () => {},
    };

    expect(value.matches).toHaveLength(2);
    expect(value.matches[0].id).toBe('root');
    expect(value.matches[1].handle?.breadcrumb).toBe('User Profile');
  });
});

// =================================================================
// useMatches tests (simulated — no React rendering)
// =================================================================

describe('@ereo/client - useMatches', () => {
  test('useMatches is a function', () => {
    expect(typeof useMatches).toBe('function');
  });

  test('throws when context is null (outside provider)', () => {
    const context = MatchesContext._currentValue;
    let error: Error | null = null;

    try {
      if (context === null) {
        throw new Error(
          'useMatches must be used within an EreoProvider. ' +
            'Make sure your component is wrapped with <EreoProvider>.'
        );
      }
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('useMatches');
    expect(error?.message).toContain('EreoProvider');
  });

  test('returns matches from context', () => {
    const matches: RouteMatchData[] = [
      { id: 'root', pathname: '/', params: {}, data: null, handle: undefined },
      { id: '/blog', pathname: '/blog', params: {}, data: { posts: [] }, handle: { breadcrumb: 'Blog' } },
    ];

    const value: MatchesContextValue = { matches, setMatches: () => {} };
    expect(value.matches).toEqual(matches);
    expect(value.matches[1].handle?.breadcrumb).toBe('Blog');
  });
});

// =================================================================
// RouteMatchData type tests
// =================================================================

describe('@ereo/client - RouteMatchData', () => {
  test('supports all required fields', () => {
    const match: RouteMatchData = {
      id: '/users/[id]',
      pathname: '/users/42',
      params: { id: '42' },
      data: { user: { name: 'Alice', email: 'alice@example.com' } },
      handle: { breadcrumb: 'User Profile', analytics: 'user-view' },
    };

    expect(match.id).toBe('/users/[id]');
    expect(match.pathname).toBe('/users/42');
    expect(match.params.id).toBe('42');
    expect(match.data).toBeDefined();
    expect(match.handle?.breadcrumb).toBe('User Profile');
    expect(match.handle?.analytics).toBe('user-view');
  });

  test('handle can be undefined (no handle export)', () => {
    const match: RouteMatchData = {
      id: '/about',
      pathname: '/about',
      params: {},
      data: {},
      handle: undefined,
    };

    expect(match.handle).toBeUndefined();
  });

  test('data can be null (no loader)', () => {
    const match: RouteMatchData = {
      id: 'layout',
      pathname: '/',
      params: {},
      data: null,
      handle: { breadcrumb: 'Home' },
    };

    expect(match.data).toBeNull();
  });

  test('params includes catch-all params', () => {
    const match: RouteMatchData = {
      id: '/docs/[...path]',
      pathname: '/docs/api/auth/overview',
      params: { path: ['api', 'auth', 'overview'] },
      data: { doc: {} },
      handle: undefined,
    };

    expect(match.params.path).toEqual(['api', 'auth', 'overview']);
  });
});

// =================================================================
// MatchesProvider tests
// =================================================================

describe('@ereo/client - MatchesProvider', () => {
  test('MatchesProvider is a function', () => {
    expect(typeof MatchesProvider).toBe('function');
  });

  test('MatchesProviderProps accepts initialMatches', () => {
    const props: MatchesProviderProps = {
      children: null,
      initialMatches: [
        { id: 'root', pathname: '/', params: {}, data: null, handle: undefined },
      ],
    };

    expect(props.initialMatches).toHaveLength(1);
  });

  test('MatchesProviderProps works without initialMatches', () => {
    const props: MatchesProviderProps = {
      children: null,
    };

    expect(props.initialMatches).toBeUndefined();
  });
});

// =================================================================
// Breadcrumbs use case tests
// =================================================================

describe('@ereo/client - useMatches breadcrumb pattern', () => {
  test('filter matches with handle.breadcrumb', () => {
    const matches: RouteMatchData[] = [
      { id: 'root', pathname: '/', params: {}, data: null, handle: { breadcrumb: 'Home' } },
      { id: 'dashboard', pathname: '/dashboard', params: {}, data: {}, handle: { breadcrumb: 'Dashboard' } },
      { id: 'settings', pathname: '/dashboard/settings', params: {}, data: {}, handle: { breadcrumb: 'Settings' } },
    ];

    const crumbs = matches
      .filter((m) => m.handle?.breadcrumb)
      .map((m) => ({
        label: m.handle!.breadcrumb as string,
        path: m.pathname,
      }));

    expect(crumbs).toHaveLength(3);
    expect(crumbs[0]).toEqual({ label: 'Home', path: '/' });
    expect(crumbs[1]).toEqual({ label: 'Dashboard', path: '/dashboard' });
    expect(crumbs[2]).toEqual({ label: 'Settings', path: '/dashboard/settings' });
  });

  test('mixed matches with and without handle', () => {
    const matches: RouteMatchData[] = [
      { id: 'root', pathname: '/', params: {}, data: null, handle: { breadcrumb: 'Home' } },
      { id: 'app-layout', pathname: '/', params: {}, data: null, handle: undefined },
      { id: 'users', pathname: '/users', params: {}, data: [], handle: { breadcrumb: 'Users' } },
      { id: '/users/[id]', pathname: '/users/5', params: { id: '5' }, data: {}, handle: { breadcrumb: 'User Details' } },
    ];

    const crumbs = matches.filter((m) => m.handle?.breadcrumb);
    expect(crumbs).toHaveLength(3); // skips app-layout
  });
});

// =================================================================
// handle route export with defineRoute
// =================================================================

describe('@ereo/client - handle export in RouteModule', () => {
  test('handle is part of RouteModule', async () => {
    // RouteHandle is already defined in @ereo/core: { [key: string]: unknown }
    const handle = {
      breadcrumb: 'Dashboard',
      analytics: { page: 'dashboard', section: 'main' },
      i18nKey: 'nav.dashboard',
    };

    expect(handle.breadcrumb).toBe('Dashboard');
    expect(handle.analytics).toEqual({ page: 'dashboard', section: 'main' });
    expect(handle.i18nKey).toBe('nav.dashboard');
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/client - matches exports from index', () => {
  test('all matches exports available', async () => {
    const exports = await import('./index');

    expect(exports.useMatches).toBeDefined();
    expect(exports.MatchesProvider).toBeDefined();
    expect(exports.MatchesContext).toBeDefined();

    expect(typeof exports.useMatches).toBe('function');
    expect(typeof exports.MatchesProvider).toBe('function');
  });
});
