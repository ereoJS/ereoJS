/**
 * @ereo/router-conventions - Integration tests
 */

import { describe, it, expect } from 'bun:test';
import {
  integrateConventions,
  generateRouteId,
  isApiRoute,
  isIslandComponent,
  getEffectiveRenderMode,
} from './integration';
import type { Route } from '@ereo/core';

describe('integrateConventions', () => {
  it('should apply SSG config to routes', () => {
    const routes: Route[] = [
      {
        id: 'blog',
        path: '/blog',
        file: 'blog.ssg.tsx',
      },
    ];

    const result = integrateConventions(routes);

    expect(result[0].config?.render?.mode).toBe('ssg');
    expect(result[0].config?.render?.prerender?.enabled).toBe(true);
  });

  it('should apply server-only config', () => {
    const routes: Route[] = [
      {
        id: 'about',
        path: '/about',
        file: 'about.server.tsx',
      },
    ];

    const result = integrateConventions(routes);

    expect(result[0].config?.render?.mode).toBe('ssr');
    expect(result[0].config?.islands?.disabled).toBe(true);
  });

  it('should preserve existing config', () => {
    const routes: Route[] = [
      {
        id: 'blog',
        path: '/blog',
        file: 'blog.ssg.tsx',
        config: {
          cache: {
            edge: { maxAge: 3600 },
          },
        },
      },
    ];

    const result = integrateConventions(routes);

    expect(result[0].config?.render?.mode).toBe('ssg');
    expect(result[0].config?.cache?.edge?.maxAge).toBe(3600);
  });

  it('should let explicit config override convention', () => {
    const routes: Route[] = [
      {
        id: 'blog',
        path: '/blog',
        file: 'blog.ssg.tsx',
        config: {
          render: {
            mode: 'ssr',
            streaming: { enabled: true },
          },
        },
      },
    ];

    const result = integrateConventions(routes);

    expect(result[0].config?.render?.mode).toBe('ssr');
  });

  it('should apply island config', () => {
    const routes: Route[] = [
      {
        id: 'counter',
        path: '/_islands/Counter',
        file: '_islands/Counter.tsx',
      },
    ];

    const result = integrateConventions(routes);

    expect(result[0].config?.islands?.defaultStrategy).toBe('load');
  });

  it('should return routes unchanged when disabled', () => {
    const routes: Route[] = [
      {
        id: 'blog',
        path: '/blog',
        file: 'blog.ssg.tsx',
      },
    ];

    const result = integrateConventions(routes, { enabled: false });

    expect(result[0].config).toBeUndefined();
  });

  it('should handle multiple routes', () => {
    const routes: Route[] = [
      { id: 'home', path: '/', file: 'index.tsx' },
      { id: 'blog', path: '/blog', file: 'blog.ssg.tsx' },
      { id: 'api', path: '/api/users', file: 'api/users.api.tsx' },
    ];

    const result = integrateConventions(routes);

    expect(result[0].config?.render).toBeUndefined();
    expect(result[1].config?.render?.mode).toBe('ssg');
    expect(result[2].config?.render?.mode).toBe('json');
  });
});

describe('generateRouteId', () => {
  it('should strip SSG suffix', () => {
    expect(generateRouteId('blog/[slug].ssg.tsx')).toBe('blog/[slug]');
  });

  it('should strip server suffix', () => {
    expect(generateRouteId('about.server.tsx')).toBe('about');
  });

  it('should return base for regular files', () => {
    expect(generateRouteId('blog/[slug].tsx')).toBe('blog/[slug]');
  });

  it('should handle island paths', () => {
    expect(generateRouteId('_islands/Counter.tsx')).toBe('_islands/Counter');
  });
});

describe('isApiRoute', () => {
  it('should return true for API files', () => {
    expect(isApiRoute('api/users.api.tsx')).toBe(true);
    expect(isApiRoute('routes/api.posts.api.ts')).toBe(true);
  });

  it('should return false for non-API files', () => {
    expect(isApiRoute('blog/[slug].tsx')).toBe(false);
    expect(isApiRoute('about.server.tsx')).toBe(false);
  });
});

describe('isIslandComponent', () => {
  it('should return true for island files', () => {
    expect(isIslandComponent('_islands/Counter.tsx')).toBe(true);
    expect(isIslandComponent('app/_islands/SearchBar.tsx')).toBe(true);
  });

  it('should return false for non-island files', () => {
    expect(isIslandComponent('blog/[slug].tsx')).toBe(false);
    expect(isIslandComponent('components/Button.tsx')).toBe(false);
  });
});

describe('getEffectiveRenderMode', () => {
  it('should return explicit mode when provided', () => {
    expect(getEffectiveRenderMode('page.tsx', 'ssg')).toBe('ssg');
  });

  it('should detect SSG from filename', () => {
    expect(getEffectiveRenderMode('page.ssg.tsx')).toBe('ssg');
  });

  it('should detect server from filename', () => {
    expect(getEffectiveRenderMode('page.server.tsx')).toBe('ssr');
  });

  it('should detect client from filename', () => {
    expect(getEffectiveRenderMode('page.client.tsx')).toBe('csr');
  });

  it('should detect API from filename', () => {
    expect(getEffectiveRenderMode('api/users.api.tsx')).toBe('json');
  });

  it('should default to SSR', () => {
    expect(getEffectiveRenderMode('page.tsx')).toBe('ssr');
  });
});
