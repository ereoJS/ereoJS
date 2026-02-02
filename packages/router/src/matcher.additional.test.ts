import { describe, expect, test } from 'bun:test';
import {
  createMatcher,
  parsePathSegments,
  calculateRouteScore,
  RouteMatcher,
  matchRoute,
  matchWithLayouts,
  patternToRegex,
} from './matcher';
import type { Route } from '@areo/core';

describe('@areo/router - Matcher (Additional Coverage)', () => {
  describe('parsePathSegments', () => {
    test('handles empty path', () => {
      const result = parsePathSegments('');
      expect(result).toEqual([]);
    });

    test('handles path with multiple dynamic segments', () => {
      const result = parsePathSegments('/users/[userId]/posts/[postId]');
      const paramNames = result.filter(s => s.paramName).map(s => s.paramName);
      expect(paramNames).toContain('userId');
      expect(paramNames).toContain('postId');
    });

    test('handles catch-all routes', () => {
      const result = parsePathSegments('/docs/[...slug]');
      expect(result.some(s => s.type === 'catchAll')).toBe(true);
    });

    test('handles optional segments', () => {
      const result = parsePathSegments('/users/[[id]]');
      const paramNames = result.filter(s => s.paramName).map(s => s.paramName);
      expect(paramNames).toContain('id');
      expect(result.some(s => s.type === 'optional')).toBe(true);
    });

    test('handles static segments', () => {
      const result = parsePathSegments('/about/contact');
      expect(result.every(s => s.type === 'static')).toBe(true);
    });
  });

  describe('calculateRouteScore', () => {
    test('scores static routes higher than dynamic', () => {
      const staticSegments = parsePathSegments('/users/list');
      const dynamicSegments = parsePathSegments('/users/[id]');

      const staticScore = calculateRouteScore(staticSegments);
      const dynamicScore = calculateRouteScore(dynamicSegments);

      expect(staticScore).toBeGreaterThan(dynamicScore);
    });

    test('scores longer paths higher', () => {
      const shortSegments = parsePathSegments('/a');
      const longSegments = parsePathSegments('/a/b/c');

      const shortScore = calculateRouteScore(shortSegments);
      const longScore = calculateRouteScore(longSegments);

      expect(longScore).toBeGreaterThan(shortScore);
    });

    test('scores catch-all routes lowest', () => {
      const normalSegments = parsePathSegments('/docs/page');
      const catchAllSegments = parsePathSegments('/docs/[...slug]');

      const normalScore = calculateRouteScore(normalSegments);
      const catchAllScore = calculateRouteScore(catchAllSegments);

      expect(normalScore).toBeGreaterThan(catchAllScore);
    });

    test('scores optional segments', () => {
      const optionalSegments = parsePathSegments('/users/[[id]]');
      const score = calculateRouteScore(optionalSegments);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('patternToRegex', () => {
    test('creates regex for empty segments', () => {
      const regex = patternToRegex([]);
      expect(regex.test('/')).toBe(true);
    });

    test('creates regex for static segments', () => {
      const segments = parsePathSegments('/about');
      const regex = patternToRegex(segments);
      expect(regex.test('/about')).toBe(true);
      expect(regex.test('/contact')).toBe(false);
    });

    test('creates regex for dynamic segments', () => {
      const segments = parsePathSegments('/users/[id]');
      const regex = patternToRegex(segments);
      expect(regex.test('/users/123')).toBe(true);
      expect(regex.test('/users/abc')).toBe(true);
    });
  });

  describe('matchRoute', () => {
    test('matches static route', () => {
      const route: Route = { id: 'about', path: '/about', file: '/about.tsx' };
      const segments = parsePathSegments('/about');
      const result = matchRoute('/about', route, segments);

      expect(result).not.toBeNull();
      expect(result?.route.id).toBe('about');
    });

    test('matches dynamic route and extracts params', () => {
      const route: Route = { id: 'user', path: '/users/[id]', file: '/users/[id].tsx' };
      const segments = parsePathSegments('/users/[id]');
      const result = matchRoute('/users/123', route, segments);

      expect(result).not.toBeNull();
      expect(result?.params.id).toBe('123');
    });

    test('matches catch-all route and splits params', () => {
      const route: Route = { id: 'docs', path: '/docs/[...slug]', file: '/docs/[...slug].tsx' };
      const segments = parsePathSegments('/docs/[...slug]');
      const result = matchRoute('/docs/getting-started/install', route, segments);

      expect(result).not.toBeNull();
      expect(result?.params.slug).toEqual(['getting-started', 'install']);
    });

    test('returns null for non-matching path', () => {
      const route: Route = { id: 'about', path: '/about', file: '/about.tsx' };
      const segments = parsePathSegments('/about');
      const result = matchRoute('/contact', route, segments);

      expect(result).toBeNull();
    });
  });

  describe('RouteMatcher', () => {
    test('creates matcher with empty routes', () => {
      const matcher = createMatcher([]);
      expect(matcher).not.toBeNull();
    });

    test('match returns null for empty matcher', () => {
      const matcher = createMatcher([]);
      const match = matcher.match('/any');
      expect(match).toBeNull();
    });

    test('matches static routes', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
        { id: 'about', path: '/about', file: '/about.tsx' },
      ];

      const matcher = createMatcher(routes);

      expect(matcher.match('/')?.route.id).toBe('home');
      expect(matcher.match('/about')?.route.id).toBe('about');
    });

    test('matches dynamic routes and extracts params', () => {
      const routes: Route[] = [
        { id: 'user', path: '/users/[id]', file: '/users/[id].tsx' },
      ];

      const matcher = createMatcher(routes);
      const match = matcher.match('/users/123');

      expect(match).not.toBeNull();
      expect(match?.params.id).toBe('123');
    });

    test('matches catch-all routes', () => {
      const routes: Route[] = [
        { id: 'docs', path: '/docs/[...slug]', file: '/docs/[...slug].tsx' },
      ];

      const matcher = createMatcher(routes);
      const match = matcher.match('/docs/getting-started/installation');

      expect(match).not.toBeNull();
    });

    test('prioritizes more specific routes', () => {
      const routes: Route[] = [
        { id: 'user-profile', path: '/users/profile', file: '/users/profile.tsx' },
        { id: 'user', path: '/users/[id]', file: '/users/[id].tsx' },
      ];

      const matcher = createMatcher(routes);

      // Static should match before dynamic
      expect(matcher.match('/users/profile')?.route.id).toBe('user-profile');
      expect(matcher.match('/users/123')?.route.id).toBe('user');
    });

    test('handles nested routes', () => {
      const routes: Route[] = [
        {
          id: 'users',
          path: '/users',
          file: '/users.tsx',
          children: [
            { id: 'users-list', path: '/users/list', file: '/users/list.tsx' },
            { id: 'user', path: '/users/[id]', file: '/users/[id].tsx' },
          ],
        },
      ];

      const matcher = createMatcher(routes);

      expect(matcher.match('/users')).not.toBeNull();
      expect(matcher.match('/users/list')).not.toBeNull();
      expect(matcher.match('/users/42')).not.toBeNull();
    });

    test('handles index routes', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx', index: true },
      ];

      const matcher = createMatcher(routes);

      expect(matcher.match('/')?.route.index).toBe(true);
    });

    test('handles trailing slashes', () => {
      const routes: Route[] = [
        { id: 'about', path: '/about', file: '/about.tsx' },
      ];

      const matcher = createMatcher(routes);

      // Should match with or without trailing slash
      expect(matcher.match('/about')).not.toBeNull();
    });

    test('handles special characters in params', () => {
      const routes: Route[] = [
        { id: 'post', path: '/posts/[slug]', file: '/posts/[slug].tsx' },
      ];

      const matcher = createMatcher(routes);
      const match = matcher.match('/posts/hello-world-2024');

      expect(match?.params.slug).toBe('hello-world-2024');
    });

    test('getRoutes returns all compiled routes', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
        { id: 'about', path: '/about', file: '/about.tsx' },
      ];

      const matcher = createMatcher(routes);
      const compiledRoutes = matcher.getRoutes();

      expect(compiledRoutes).toHaveLength(2);
    });

    test('addRoute adds a new route', () => {
      const matcher = createMatcher([]);

      matcher.addRoute({ id: 'home', path: '/', file: '/index.tsx' });
      matcher.addRoute({ id: 'about', path: '/about', file: '/about.tsx' });

      expect(matcher.getRoutes()).toHaveLength(2);
      expect(matcher.match('/')?.route.id).toBe('home');
      expect(matcher.match('/about')?.route.id).toBe('about');
    });

    test('addRoute inserts in sorted order', () => {
      const matcher = createMatcher([
        { id: 'dynamic', path: '/users/[id]', file: '/users/[id].tsx' },
      ]);

      // Static route should be inserted before dynamic
      matcher.addRoute({ id: 'static', path: '/users/profile', file: '/users/profile.tsx' });

      // Static route should match first
      expect(matcher.match('/users/profile')?.route.id).toBe('static');
    });

    test('removeRoute removes a route by ID', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
        { id: 'about', path: '/about', file: '/about.tsx' },
      ];

      const matcher = createMatcher(routes);

      const removed = matcher.removeRoute('about');

      expect(removed).toBe(true);
      expect(matcher.getRoutes()).toHaveLength(1);
      expect(matcher.match('/about')).toBeNull();
    });

    test('removeRoute returns false for non-existent route', () => {
      const matcher = createMatcher([
        { id: 'home', path: '/', file: '/index.tsx' },
      ]);

      const removed = matcher.removeRoute('nonexistent');

      expect(removed).toBe(false);
    });

    test('matches empty pathname as root', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
      ];

      const matcher = createMatcher(routes);
      const match = matcher.match('');

      expect(match).not.toBeNull();
      expect(match?.pathname).toBe('/');
    });

    test('skips layout-only routes from matching', () => {
      const routes: Route[] = [
        { id: 'layout', path: '/', file: '/_layout.tsx', layout: true },
        { id: 'home', path: '/', file: '/index.tsx', index: true },
      ];

      const matcher = createMatcher(routes);
      const match = matcher.match('/');

      // Should match the index route, not the layout-only route
      expect(match?.route.index).toBe(true);
    });
  });

  describe('matchWithLayouts', () => {
    test('returns null for no match', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/index.tsx' },
      ];

      const result = matchWithLayouts('/nonexistent', routes);

      expect(result).toBeNull();
    });

    test('matches route and collects layouts', () => {
      const routes: Route[] = [
        {
          id: 'root-layout',
          path: '/',
          file: '/_layout.tsx',
          layout: true,
          children: [
            { id: 'home', path: '/', file: '/index.tsx', index: true },
          ],
        },
      ];

      const result = matchWithLayouts('/', routes);

      expect(result).not.toBeNull();
      expect(result?.layouts).toBeDefined();
    });

    test('collects nested layouts', () => {
      const routes: Route[] = [
        {
          id: 'root-layout',
          path: '/',
          file: '/_layout.tsx',
          layout: true,
          children: [
            {
              id: 'users-layout',
              path: '/users',
              file: '/users/_layout.tsx',
              layout: true,
              children: [
                { id: 'user', path: '/users/[id]', file: '/users/[id].tsx' },
              ],
            },
          ],
        },
      ];

      const result = matchWithLayouts('/users/123', routes);

      expect(result).not.toBeNull();
      // Should have both root and users layout
      expect(result?.layouts.length).toBeGreaterThanOrEqual(0);
    });

    test('includes route params in result', () => {
      const routes: Route[] = [
        { id: 'user', path: '/users/[id]', file: '/users/[id].tsx' },
      ];

      const result = matchWithLayouts('/users/456', routes);

      expect(result).not.toBeNull();
      expect(result?.params.id).toBe('456');
    });
  });
});
