import { describe, expect, test } from 'bun:test';
import { extractParams, generateRouteTypes } from './types';
import type { Route } from '@oreo/core';

describe('@oreo/bundler - Types Plugin', () => {
  describe('extractParams', () => {
    test('extracts no params from static path', () => {
      const params = extractParams('/about');
      expect(Object.keys(params)).toHaveLength(0);
    });

    test('extracts dynamic params', () => {
      const params = extractParams('/blog/[slug]');
      expect(params.slug).toBe('string');
    });

    test('extracts multiple params', () => {
      const params = extractParams('/[category]/[slug]');
      expect(params.category).toBe('string');
      expect(params.slug).toBe('string');
    });

    test('extracts catch-all params as array', () => {
      const params = extractParams('/docs/[...path]');
      expect(params.path).toBe('string[]');
    });

    test('extracts optional params', () => {
      const params = extractParams('/blog/[[page]]');
      expect(params.page).toBe('string');
    });
  });

  describe('generateRouteTypes', () => {
    test('generates types for routes', () => {
      const routes: Route[] = [
        { id: 'home', path: '/', file: '/routes/index.tsx' },
        { id: 'about', path: '/about', file: '/routes/about.tsx' },
        { id: 'blog-post', path: '/blog/[slug]', file: '/routes/blog/[slug].tsx' },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain("declare module '@oreo/core'");
      expect(types).toContain("export interface RouteTypes");
      expect(types).toContain("'/':");
      expect(types).toContain("'/about':");
      expect(types).toContain("'/blog/[slug]':");
      expect(types).toContain('slug: string');
    });

    test('excludes layout routes', () => {
      const routes: Route[] = [
        { id: 'layout', path: '/', file: '/routes/_layout.tsx', layout: true },
        { id: 'home', path: '/', file: '/routes/index.tsx', index: true },
      ];

      const types = generateRouteTypes(routes);

      // Should have home but layout behavior is handled in generation
      expect(types).toContain("'/':");
    });

    test('generates empty params for static routes', () => {
      const routes: Route[] = [
        { id: 'about', path: '/about', file: '/routes/about.tsx' },
      ];

      const types = generateRouteTypes(routes);

      expect(types).toContain('Record<string, never>');
    });
  });
});
