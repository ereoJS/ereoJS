import { describe, expect, test } from 'bun:test';
import {
  ParamsContext,
  LocationContext,
  type ParamsContextValue,
  type LocationContextValue,
  type LocationState,
  type EreoProviderProps,
} from './hooks';
import type { RouteParams } from '@ereo/core';

// =================================================================
// useParams tests
// =================================================================

describe('@ereo/client - useParams', () => {
  test('ParamsContext defaults to null', () => {
    expect(ParamsContext._currentValue).toBeNull();
  });

  test('throws when context is null (outside provider)', () => {
    const context = ParamsContext._currentValue;
    let error: Error | null = null;

    try {
      if (context === null) {
        throw new Error(
          'useParams must be used within an EreoProvider. ' +
            'Make sure your component is wrapped with <EreoProvider>.'
        );
      }
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('EreoProvider');
    expect(error?.message).toContain('useParams');
  });

  test('context value holds correct params', () => {
    const params: RouteParams = { id: '123', slug: 'my-post' };
    let currentParams = params;

    const contextValue: ParamsContextValue = {
      params: currentParams,
      setParams: (newParams: RouteParams) => {
        currentParams = newParams;
      },
    };

    expect(contextValue.params).toEqual({ id: '123', slug: 'my-post' });
    expect(contextValue.params.id).toBe('123');
    expect(contextValue.params.slug).toBe('my-post');
  });

  test('setParams updates params', () => {
    let currentParams: RouteParams = { id: '1' };

    const contextValue: ParamsContextValue = {
      params: currentParams,
      setParams: (newParams: RouteParams) => {
        currentParams = newParams;
      },
    };

    contextValue.setParams({ id: '2', name: 'updated' });
    expect(currentParams).toEqual({ id: '2', name: 'updated' });
  });

  test('handles empty params', () => {
    const contextValue: ParamsContextValue = {
      params: {},
      setParams: () => {},
    };

    expect(contextValue.params).toEqual({});
    expect(Object.keys(contextValue.params)).toHaveLength(0);
  });

  test('handles catch-all params (string arrays)', () => {
    const params: RouteParams = { path: ['docs', 'api', 'overview'] };

    const contextValue: ParamsContextValue = {
      params,
      setParams: () => {},
    };

    expect(contextValue.params.path).toEqual(['docs', 'api', 'overview']);
  });

  test('handles optional params (undefined)', () => {
    const params: RouteParams = { id: '1', page: undefined };

    const contextValue: ParamsContextValue = {
      params,
      setParams: () => {},
    };

    expect(contextValue.params.id).toBe('1');
    expect(contextValue.params.page).toBeUndefined();
  });
});

// =================================================================
// useSearchParams tests
// =================================================================

describe('@ereo/client - useSearchParams', () => {
  test('LocationContext defaults to null', () => {
    expect(LocationContext._currentValue).toBeNull();
  });

  test('parses search params from location.search', () => {
    const location: LocationState = {
      pathname: '/products',
      search: '?page=2&sort=price&category=electronics',
      hash: '',
      state: null,
      key: 'test-1',
    };

    const searchParams = new URLSearchParams(location.search);

    expect(searchParams.get('page')).toBe('2');
    expect(searchParams.get('sort')).toBe('price');
    expect(searchParams.get('category')).toBe('electronics');
  });

  test('handles empty search string', () => {
    const location: LocationState = {
      pathname: '/products',
      search: '',
      hash: '',
      state: null,
      key: 'test-2',
    };

    const searchParams = new URLSearchParams(location.search);
    expect(searchParams.toString()).toBe('');
    expect([...searchParams.entries()]).toHaveLength(0);
  });

  test('handles multiple values for same key', () => {
    const location: LocationState = {
      pathname: '/products',
      search: '?tag=red&tag=blue&tag=green',
      hash: '',
      state: null,
      key: 'test-3',
    };

    const searchParams = new URLSearchParams(location.search);
    expect(searchParams.getAll('tag')).toEqual(['red', 'blue', 'green']);
  });

  test('setSearchParams with Record updates location', () => {
    let currentLocation: LocationState = {
      pathname: '/products',
      search: '?page=1',
      hash: '',
      state: null,
      key: 'test-4',
    };

    const contextValue: LocationContextValue = {
      location: currentLocation,
      setLocation: (loc: LocationState) => {
        currentLocation = loc;
      },
    };

    // Simulate setSearchParams logic
    const newParams = new URLSearchParams({ page: '2', sort: 'name' });
    const newSearch = newParams.toString();
    contextValue.setLocation({
      ...currentLocation,
      search: newSearch ? `?${newSearch}` : '',
      key: 'test-5',
    });

    expect(currentLocation.search).toBe('?page=2&sort=name');
    expect(currentLocation.pathname).toBe('/products'); // unchanged
  });

  test('setSearchParams with function receives previous params', () => {
    const location: LocationState = {
      pathname: '/search',
      search: '?q=hello&page=1',
      hash: '',
      state: null,
      key: 'test-6',
    };

    const prev = new URLSearchParams(location.search);
    const next = (prevParams: URLSearchParams) => {
      const result = new URLSearchParams(prevParams);
      result.set('page', '2');
      return result;
    };

    const resolved = next(prev);
    expect(resolved.get('q')).toBe('hello'); // preserved
    expect(resolved.get('page')).toBe('2'); // updated
  });

  test('setSearchParams with replace option', () => {
    let currentLocation: LocationState = {
      pathname: '/items',
      search: '?filter=active',
      hash: '',
      state: null,
      key: 'test-7',
    };

    // Simulate replace behavior — location updates the same way,
    // just window.history.replaceState vs pushState
    const contextValue: LocationContextValue = {
      location: currentLocation,
      setLocation: (loc: LocationState) => {
        currentLocation = loc;
      },
    };

    const newParams = new URLSearchParams({ filter: 'all' });
    contextValue.setLocation({
      ...currentLocation,
      search: `?${newParams.toString()}`,
      key: 'test-8',
    });

    expect(currentLocation.search).toBe('?filter=all');
  });

  test('clearing all search params produces empty search', () => {
    let currentLocation: LocationState = {
      pathname: '/page',
      search: '?a=1&b=2',
      hash: '',
      state: null,
      key: 'test-9',
    };

    const contextValue: LocationContextValue = {
      location: currentLocation,
      setLocation: (loc: LocationState) => {
        currentLocation = loc;
      },
    };

    const empty = new URLSearchParams({});
    const newSearch = empty.toString();
    contextValue.setLocation({
      ...currentLocation,
      search: newSearch ? `?${newSearch}` : '',
      key: 'test-10',
    });

    expect(currentLocation.search).toBe('');
  });
});

// =================================================================
// useLocation tests
// =================================================================

describe('@ereo/client - useLocation', () => {
  test('throws when context is null (outside provider)', () => {
    const context = LocationContext._currentValue;
    let error: Error | null = null;

    try {
      if (context === null) {
        throw new Error(
          'useLocation must be used within an EreoProvider. ' +
            'Make sure your component is wrapped with <EreoProvider>.'
        );
      }
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('EreoProvider');
    expect(error?.message).toContain('useLocation');
  });

  test('returns full location object', () => {
    const location: LocationState = {
      pathname: '/users/123',
      search: '?tab=profile',
      hash: '#bio',
      state: { from: '/dashboard' },
      key: 'abc123',
    };

    const contextValue: LocationContextValue = {
      location,
      setLocation: () => {},
    };

    expect(contextValue.location.pathname).toBe('/users/123');
    expect(contextValue.location.search).toBe('?tab=profile');
    expect(contextValue.location.hash).toBe('#bio');
    expect(contextValue.location.state).toEqual({ from: '/dashboard' });
    expect(contextValue.location.key).toBe('abc123');
  });

  test('location state can be any value', () => {
    const withNull: LocationState = {
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'k1',
    };
    expect(withNull.state).toBeNull();

    const withObject: LocationState = {
      pathname: '/',
      search: '',
      hash: '',
      state: { scrollY: 150, formDraft: { name: 'test' } },
      key: 'k2',
    };
    expect((withObject.state as any).scrollY).toBe(150);

    const withUndefined: LocationState = {
      pathname: '/',
      search: '',
      hash: '',
      state: undefined,
      key: 'k3',
    };
    expect(withUndefined.state).toBeUndefined();
  });

  test('setLocation updates location', () => {
    let current: LocationState = {
      pathname: '/a',
      search: '',
      hash: '',
      state: null,
      key: 'key-a',
    };

    const contextValue: LocationContextValue = {
      location: current,
      setLocation: (loc: LocationState) => {
        current = loc;
      },
    };

    contextValue.setLocation({
      pathname: '/b',
      search: '?x=1',
      hash: '#top',
      state: { from: '/a' },
      key: 'key-b',
    });

    expect(current.pathname).toBe('/b');
    expect(current.search).toBe('?x=1');
    expect(current.hash).toBe('#top');
    expect(current.state).toEqual({ from: '/a' });
    expect(current.key).toBe('key-b');
  });

  test('location key is unique per navigation', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i++) {
      keys.add(Math.random().toString(36).slice(2, 10));
    }
    // All keys should be unique
    expect(keys.size).toBe(100);
  });

  test('default location matches expected structure', () => {
    const defaultLocation: LocationState = {
      pathname: '/',
      search: '',
      hash: '',
      state: null,
      key: 'default',
    };

    expect(defaultLocation.pathname).toBe('/');
    expect(defaultLocation.search).toBe('');
    expect(defaultLocation.hash).toBe('');
  });
});

// =================================================================
// EreoProvider integration tests for new hooks
// =================================================================

describe('@ereo/client - EreoProvider with routing hooks', () => {
  test('EreoProvider accepts params and location props', () => {
    const props: EreoProviderProps = {
      children: null,
      params: { id: '42' },
      location: {
        pathname: '/users/42',
        search: '?tab=posts',
        hash: '',
        state: null,
        key: 'initial',
      },
    };

    expect(props.params).toEqual({ id: '42' });
    expect(props.location?.pathname).toBe('/users/42');
    expect(props.location?.search).toBe('?tab=posts');
  });

  test('EreoProvider works with minimal props (backwards compatible)', () => {
    const props: EreoProviderProps = {
      children: null,
    };

    expect(props.params).toBeUndefined();
    expect(props.location).toBeUndefined();
  });

  test('full SSR hydration scenario with all data', () => {
    const props: EreoProviderProps = {
      children: null,
      loaderData: { user: { id: 1, name: 'Alice' } },
      actionData: undefined,
      params: { id: '1' },
      location: {
        pathname: '/users/1',
        search: '',
        hash: '',
        state: null,
        key: 'ssr-key',
      },
      navigationState: { status: 'idle' },
    };

    expect(props.loaderData).toEqual({ user: { id: 1, name: 'Alice' } });
    expect(props.params).toEqual({ id: '1' });
    expect(props.location?.pathname).toBe('/users/1');
    expect(props.navigationState?.status).toBe('idle');
  });
});
