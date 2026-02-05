import { describe, expect, test } from 'bun:test';
import {
  getRoutesToRevalidate,
  checkShouldRevalidate,
  type RevalidationRoute,
  type RevalidationContext,
} from './revalidation';
import type { ShouldRevalidateArgs, ShouldRevalidateFunction } from '@ereo/core';

function makeUrl(path: string): URL {
  return new URL(path, 'http://localhost:3000');
}

function makeContext(overrides: Partial<RevalidationContext> = {}): RevalidationContext {
  return {
    currentUrl: makeUrl('/'),
    nextUrl: makeUrl('/about'),
    ...overrides,
  };
}

function makeRoute(overrides: Partial<RevalidationRoute> & { id: string }): RevalidationRoute {
  return {
    path: '/' + overrides.id,
    params: {},
    ...overrides,
  };
}

describe('@ereo/client - Revalidation', () => {
  describe('getRoutesToRevalidate', () => {
    test('revalidates all routes with loaders by default (no shouldRevalidate)', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'root',
          module: { loader: async () => ({ user: 'test' }) },
        }),
        makeRoute({
          id: 'dashboard',
          module: { loader: async () => ({ stats: [] }) },
        }),
      ];

      const result = getRoutesToRevalidate(routes, {}, makeContext());
      expect(result).toEqual(['root', 'dashboard']);
    });

    test('skips routes without loaders', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'layout',
          module: { default: (() => null) as any },
        }),
        makeRoute({
          id: 'page',
          module: { loader: async () => ({ data: true }) },
        }),
      ];

      const result = getRoutesToRevalidate(routes, {}, makeContext());
      expect(result).toEqual(['page']);
    });

    test('respects shouldRevalidate returning false', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'root',
          module: {
            loader: async () => ({ user: 'test' }),
            shouldRevalidate: () => false,
          },
        }),
        makeRoute({
          id: 'page',
          module: { loader: async () => ({ data: true }) },
        }),
      ];

      const result = getRoutesToRevalidate(routes, {}, makeContext());
      expect(result).toEqual(['page']);
    });

    test('respects shouldRevalidate returning true', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'root',
          module: {
            loader: async () => ({ user: 'test' }),
            shouldRevalidate: () => true,
          },
        }),
      ];

      const result = getRoutesToRevalidate(routes, {}, makeContext());
      expect(result).toEqual(['root']);
    });

    test('passes correct args to shouldRevalidate', () => {
      let capturedArgs: ShouldRevalidateArgs | null = null;

      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'users',
          params: { id: '1' },
          module: {
            loader: async () => ({}),
            shouldRevalidate: (args) => {
              capturedArgs = args;
              return true;
            },
          },
        }),
      ];

      const context = makeContext({
        currentUrl: makeUrl('/users/1'),
        nextUrl: makeUrl('/users/2'),
        formMethod: 'POST',
        formAction: '/users/2',
      });

      getRoutesToRevalidate(routes, { id: '2' }, context);

      expect(capturedArgs).not.toBeNull();
      expect(capturedArgs!.currentUrl.pathname).toBe('/users/1');
      expect(capturedArgs!.nextUrl.pathname).toBe('/users/2');
      expect(capturedArgs!.currentParams).toEqual({ id: '1' });
      expect(capturedArgs!.nextParams).toEqual({ id: '2' });
      expect(capturedArgs!.formMethod).toBe('POST');
      expect(capturedArgs!.formAction).toBe('/users/2');
      expect(capturedArgs!.defaultShouldRevalidate).toBe(true);
    });

    test('shouldRevalidate can check if search params changed', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'search',
          module: {
            loader: async () => ({}),
            shouldRevalidate: ({ currentUrl, nextUrl }) => {
              return currentUrl.search !== nextUrl.search;
            },
          },
        }),
      ];

      // Same search params — should NOT revalidate
      const sameSearch = getRoutesToRevalidate(
        routes,
        {},
        makeContext({
          currentUrl: makeUrl('/search?q=hello'),
          nextUrl: makeUrl('/search?q=hello'),
        })
      );
      expect(sameSearch).toEqual([]);

      // Different search params — should revalidate
      const diffSearch = getRoutesToRevalidate(
        routes,
        {},
        makeContext({
          currentUrl: makeUrl('/search?q=hello'),
          nextUrl: makeUrl('/search?q=world'),
        })
      );
      expect(diffSearch).toEqual(['search']);
    });

    test('shouldRevalidate can skip revalidation for non-mutating navigations', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'sidebar',
          module: {
            loader: async () => ({ nav: [] }),
            shouldRevalidate: ({ formMethod, defaultShouldRevalidate }) => {
              if (!formMethod) return false; // Skip for GET navigations
              return defaultShouldRevalidate;
            },
          },
        }),
      ];

      // GET navigation — should NOT revalidate
      const getNav = getRoutesToRevalidate(routes, {}, makeContext());
      expect(getNav).toEqual([]);

      // POST mutation — should revalidate
      const postNav = getRoutesToRevalidate(
        routes,
        {},
        makeContext({ formMethod: 'POST' })
      );
      expect(postNav).toEqual(['sidebar']);
    });

    test('defaults to revalidating if shouldRevalidate throws', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'broken',
          module: {
            loader: async () => ({}),
            shouldRevalidate: () => {
              throw new Error('oops');
            },
          },
        }),
      ];

      const result = getRoutesToRevalidate(routes, {}, makeContext());
      expect(result).toEqual(['broken']);
    });

    test('handles empty routes array', () => {
      const result = getRoutesToRevalidate([], {}, makeContext());
      expect(result).toEqual([]);
    });

    test('handles routes with no module', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({ id: 'unloaded', module: undefined }),
      ];

      const result = getRoutesToRevalidate(routes, {}, makeContext());
      expect(result).toEqual([]);
    });

    test('passes actionResult to shouldRevalidate', () => {
      let receivedResult: unknown = undefined;

      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'list',
          module: {
            loader: async () => ({}),
            shouldRevalidate: (args) => {
              receivedResult = args.actionResult;
              return true;
            },
          },
        }),
      ];

      const actionResult = { success: true, id: 42 };
      getRoutesToRevalidate(
        routes,
        {},
        makeContext({ actionResult })
      );

      expect(receivedResult).toEqual(actionResult);
    });

    test('passes formData to shouldRevalidate', () => {
      let receivedFormData: FormData | undefined = undefined;

      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'form-page',
          module: {
            loader: async () => ({}),
            shouldRevalidate: (args) => {
              receivedFormData = args.formData;
              return true;
            },
          },
        }),
      ];

      const formData = new FormData();
      formData.append('name', 'test');
      getRoutesToRevalidate(
        routes,
        {},
        makeContext({ formData, formMethod: 'POST' })
      );

      expect(receivedFormData).toBeDefined();
      expect(receivedFormData!.get('name')).toBe('test');
    });

    test('mixed routes: some with shouldRevalidate, some without', () => {
      const routes: RevalidationRoute[] = [
        makeRoute({
          id: 'root',
          module: {
            loader: async () => ({ user: 'test' }),
            shouldRevalidate: () => false, // Never revalidate
          },
        }),
        makeRoute({
          id: 'sidebar',
          module: {
            loader: async () => ({ nav: [] }),
            // No shouldRevalidate — always revalidates
          },
        }),
        makeRoute({
          id: 'content',
          module: {
            loader: async () => ({ items: [] }),
            shouldRevalidate: ({ formMethod }) => !!formMethod, // Only on mutations
          },
        }),
      ];

      // GET navigation
      const getResult = getRoutesToRevalidate(routes, {}, makeContext());
      expect(getResult).toEqual(['sidebar']); // Only sidebar (no shouldRevalidate)

      // POST mutation
      const postResult = getRoutesToRevalidate(
        routes,
        {},
        makeContext({ formMethod: 'POST' })
      );
      expect(postResult).toEqual(['sidebar', 'content']);
    });
  });

  describe('checkShouldRevalidate', () => {
    const baseArgs: ShouldRevalidateArgs = {
      currentUrl: makeUrl('/a'),
      nextUrl: makeUrl('/b'),
      currentParams: {},
      nextParams: {},
      defaultShouldRevalidate: true,
    };

    test('returns defaultShouldRevalidate when no function provided', () => {
      expect(checkShouldRevalidate(undefined, baseArgs)).toBe(true);
      expect(
        checkShouldRevalidate(undefined, {
          ...baseArgs,
          defaultShouldRevalidate: false,
        })
      ).toBe(false);
    });

    test('calls the function and returns its result', () => {
      const fn: ShouldRevalidateFunction = () => false;
      expect(checkShouldRevalidate(fn, baseArgs)).toBe(false);

      const fn2: ShouldRevalidateFunction = () => true;
      expect(checkShouldRevalidate(fn2, baseArgs)).toBe(true);
    });

    test('returns defaultShouldRevalidate on error', () => {
      const fn: ShouldRevalidateFunction = () => {
        throw new Error('fail');
      };
      expect(checkShouldRevalidate(fn, baseArgs)).toBe(true);
      expect(
        checkShouldRevalidate(fn, {
          ...baseArgs,
          defaultShouldRevalidate: false,
        })
      ).toBe(false);
    });
  });
});
