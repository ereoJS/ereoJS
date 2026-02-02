import { describe, expect, test } from 'bun:test';
import {
  parsePathSegments,
  calculateRouteScore,
  patternToRegex,
  RouteMatcher,
  createMatcher,
} from './matcher';
import type { Route } from '@areo/core';

describe('@areo/router - Matcher', () => {
  describe('parsePathSegments', () => {
    test('parses static segments', () => {
      const segments = parsePathSegments('/blog/posts');
      expect(segments).toHaveLength(2);
      expect(segments[0].type).toBe('static');
      expect(segments[0].raw).toBe('blog');
      expect(segments[1].type).toBe('static');
      expect(segments[1].raw).toBe('posts');
    });

    test('parses dynamic segments', () => {
      const segments = parsePathSegments('/blog/[slug]');
      expect(segments).toHaveLength(2);
      expect(segments[0].type).toBe('static');
      expect(segments[1].type).toBe('dynamic');
      expect(segments[1].paramName).toBe('slug');
    });

    test('parses catch-all segments', () => {
      const segments = parsePathSegments('/docs/[...path]');
      expect(segments).toHaveLength(2);
      expect(segments[1].type).toBe('catchAll');
      expect(segments[1].paramName).toBe('path');
    });

    test('parses optional segments', () => {
      const segments = parsePathSegments('/blog/[[page]]');
      expect(segments).toHaveLength(2);
      expect(segments[1].type).toBe('optional');
      expect(segments[1].paramName).toBe('page');
    });

    test('parses root path', () => {
      const segments = parsePathSegments('/');
      expect(segments).toHaveLength(0);
    });
  });

  describe('calculateRouteScore', () => {
    test('static routes score higher than dynamic', () => {
      const staticScore = calculateRouteScore(parsePathSegments('/blog/posts'));
      const dynamicScore = calculateRouteScore(parsePathSegments('/blog/[slug]'));

      expect(staticScore).toBeGreaterThan(dynamicScore);
    });

    test('dynamic routes score higher than catch-all', () => {
      const dynamicScore = calculateRouteScore(parsePathSegments('/blog/[slug]'));
      const catchAllScore = calculateRouteScore(parsePathSegments('/blog/[...path]'));

      expect(dynamicScore).toBeGreaterThan(catchAllScore);
    });
  });

  describe('patternToRegex', () => {
    test('matches static paths', () => {
      const regex = patternToRegex(parsePathSegments('/blog/posts'));
      expect(regex.test('/blog/posts')).toBe(true);
      expect(regex.test('/blog/posts/')).toBe(true);
      expect(regex.test('/blog/other')).toBe(false);
    });

    test('matches dynamic segments', () => {
      const regex = patternToRegex(parsePathSegments('/blog/[slug]'));
      expect(regex.test('/blog/hello')).toBe(true);
      expect(regex.test('/blog/world')).toBe(true);
      expect(regex.test('/blog/')).toBe(false);
    });

    test('matches catch-all segments', () => {
      const regex = patternToRegex(parsePathSegments('/docs/[...path]'));
      expect(regex.test('/docs/a/b/c')).toBe(true);
      expect(regex.test('/docs/single')).toBe(true);
      expect(regex.test('/docs')).toBe(true);
    });

    test('matches root path', () => {
      const regex = patternToRegex(parsePathSegments('/'));
      expect(regex.test('/')).toBe(true);
      expect(regex.test('/other')).toBe(false);
    });
  });

  describe('RouteMatcher', () => {
    const routes: Route[] = [
      { id: 'home', path: '/', file: '/routes/index.tsx' },
      { id: 'about', path: '/about', file: '/routes/about.tsx' },
      { id: 'blog-list', path: '/blog', file: '/routes/blog/index.tsx' },
      { id: 'blog-post', path: '/blog/[slug]', file: '/routes/blog/[slug].tsx' },
      { id: 'docs', path: '/docs/[...path]', file: '/routes/docs/[...path].tsx' },
    ];

    test('matches static routes', () => {
      const matcher = createMatcher(routes);

      const homeMatch = matcher.match('/');
      expect(homeMatch?.route.id).toBe('home');

      const aboutMatch = matcher.match('/about');
      expect(aboutMatch?.route.id).toBe('about');
    });

    test('matches dynamic routes', () => {
      const matcher = createMatcher(routes);

      const match = matcher.match('/blog/hello-world');
      expect(match?.route.id).toBe('blog-post');
      expect(match?.params.slug).toBe('hello-world');
    });

    test('matches catch-all routes', () => {
      const matcher = createMatcher(routes);

      const match = matcher.match('/docs/getting-started/installation');
      expect(match?.route.id).toBe('docs');
      expect(match?.params.path).toEqual(['getting-started', 'installation']);
    });

    test('returns null for unmatched routes', () => {
      const matcher = createMatcher(routes);

      const match = matcher.match('/unknown');
      expect(match).toBeNull();
    });

    test('prefers more specific routes', () => {
      const matcher = createMatcher(routes);

      // /blog should match blog-list, not blog-post
      const listMatch = matcher.match('/blog');
      expect(listMatch?.route.id).toBe('blog-list');
    });
  });
});
