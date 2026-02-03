/**
 * @ereo/router-conventions - Tests for file naming conventions
 */

import { describe, it, expect } from 'bun:test';
import {
  parseConvention,
  conventionToRouteConfig,
  hasConvention,
  stripConvention,
  applyConventionConfig,
  getConventionPatterns,
  CONVENTION_SUFFIXES,
} from './conventions';
import type { RouteConfig } from '@ereo/core';

describe('parseConvention', () => {
  it('should parse basic route files', () => {
    const info = parseConvention('blog/[slug].tsx');
    expect(info.basePath).toBe('blog/[slug]');
    expect(info.renderMode).toBeUndefined();
    expect(info.isApi).toBe(false);
    expect(info.isIsland).toBe(false);
    expect(info.extension).toBe('.tsx');
  });

  it('should parse SSG convention', () => {
    const info = parseConvention('blog/[slug].ssg.tsx');
    expect(info.basePath).toBe('blog/[slug]');
    expect(info.renderMode).toBe('ssg');
    expect(info.isApi).toBe(false);
  });

  it('should parse server-only convention', () => {
    const info = parseConvention('about.server.tsx');
    expect(info.basePath).toBe('about');
    expect(info.renderMode).toBe('ssr');
    expect(info.isApi).toBe(false);
  });

  it('should parse CSR convention', () => {
    const info = parseConvention('dashboard.client.tsx');
    expect(info.basePath).toBe('dashboard');
    expect(info.renderMode).toBe('csr');
    expect(info.isApi).toBe(false);
  });

  it('should parse API convention', () => {
    const info = parseConvention('api/users.api.tsx');
    expect(info.basePath).toBe('api/users');
    expect(info.renderMode).toBeUndefined();
    expect(info.isApi).toBe(true);
  });

  it('should parse RSC convention', () => {
    const info = parseConvention('components/Header.rsc.tsx');
    expect(info.basePath).toBe('components/Header');
    expect(info.renderMode).toBe('rsc');
    expect(info.isApi).toBe(false);
  });

  it('should parse island components', () => {
    const info = parseConvention('_islands/Counter.tsx');
    expect(info.basePath).toBe('_islands/Counter');
    expect(info.isIsland).toBe(true);
    expect(info.isApi).toBe(false);
  });

  it('should parse nested island components', () => {
    const info = parseConvention('app/_islands/SearchBar.tsx');
    expect(info.basePath).toBe('app/_islands/SearchBar');
    expect(info.isIsland).toBe(true);
  });

  it('should parse layout files', () => {
    const info = parseConvention('blog/_layout.tsx');
    expect(info.basePath).toBe('blog/_layout');
    expect(info.isLayout).toBe(true);
  });

  it('should parse root layout', () => {
    const info = parseConvention('_layout.tsx');
    expect(info.basePath).toBe('_layout');
    expect(info.isLayout).toBe(true);
  });

  it('should handle multiple dots in filename', () => {
    const info = parseConvention('some.file.name.ssg.tsx');
    expect(info.basePath).toBe('some.file.name');
    expect(info.renderMode).toBe('ssg');
  });

  it('should handle files without extension', () => {
    const info = parseConvention('README');
    expect(info.basePath).toBe('README');
    expect(info.extension).toBe('');
  });
});

describe('conventionToRouteConfig', () => {
  it('should generate SSG config', () => {
    const info = parseConvention('blog/[slug].ssg.tsx');
    const config = conventionToRouteConfig(info);

    expect(config.render?.mode).toBe('ssg');
    expect(config.render?.prerender?.enabled).toBe(true);
    expect(config.render?.prerender?.fallback).toBe('blocking');
  });

  it('should generate server-only config', () => {
    const info = parseConvention('about.server.tsx');
    const config = conventionToRouteConfig(info);

    expect(config.render?.mode).toBe('ssr');
    expect(config.islands?.disabled).toBe(true);
  });

  it('should generate CSR config', () => {
    const info = parseConvention('dashboard.client.tsx');
    const config = conventionToRouteConfig(info);

    expect(config.render?.mode).toBe('csr');
  });

  it('should generate API config', () => {
    const info = parseConvention('api/users.api.tsx');
    const config = conventionToRouteConfig(info);

    expect(config.render?.mode).toBe('json');
  });

  it('should generate RSC config', () => {
    const info = parseConvention('components/Header.rsc.tsx');
    const config = conventionToRouteConfig(info);

    expect(config.render?.mode).toBe('rsc');
  });

  it('should generate island config', () => {
    const info = parseConvention('_islands/Counter.tsx');
    const config = conventionToRouteConfig(info);

    expect(config.islands?.defaultStrategy).toBe('load');
  });

  it('should enable streaming for SSR', () => {
    const info = parseConvention('page.server.tsx');
    const config = conventionToRouteConfig(info);

    expect(config.render?.streaming?.enabled).toBe(true);
  });
});

describe('hasConvention', () => {
  it('should return true for SSG files', () => {
    expect(hasConvention('page.ssg.tsx')).toBe(true);
  });

  it('should return true for server files', () => {
    expect(hasConvention('page.server.tsx')).toBe(true);
  });

  it('should return true for client files', () => {
    expect(hasConvention('page.client.tsx')).toBe(true);
  });

  it('should return true for API files', () => {
    expect(hasConvention('api.users.api.tsx')).toBe(true);
  });

  it('should return true for RSC files', () => {
    expect(hasConvention('page.rsc.tsx')).toBe(true);
  });

  it('should return true for island files', () => {
    expect(hasConvention('_islands/Counter.tsx')).toBe(true);
  });

  it('should return false for regular files', () => {
    expect(hasConvention('page.tsx')).toBe(false);
    expect(hasConvention('blog/[slug].tsx')).toBe(false);
  });
});

describe('stripConvention', () => {
  it('should strip SSG suffix', () => {
    expect(stripConvention('blog/[slug].ssg')).toBe('blog/[slug]');
  });

  it('should strip server suffix', () => {
    expect(stripConvention('about.server')).toBe('about');
  });

  it('should strip client suffix', () => {
    expect(stripConvention('dashboard.client')).toBe('dashboard');
  });

  it('should strip API suffix', () => {
    expect(stripConvention('api/users.api')).toBe('api/users');
  });

  it('should strip RSC suffix', () => {
    expect(stripConvention('components/Header.rsc')).toBe('components/Header');
  });

  it('should return unchanged if no convention', () => {
    expect(stripConvention('blog/[slug]')).toBe('blog/[slug]');
  });
});

describe('applyConventionConfig', () => {
  it('should apply SSG convention', () => {
    const config = applyConventionConfig('blog.ssg.tsx');
    expect(config.render?.mode).toBe('ssg');
  });

  it('should merge with explicit config', () => {
    const explicit: Partial<RouteConfig> = {
      cache: {
        edge: { maxAge: 3600 },
      },
    };
    const config = applyConventionConfig('blog.ssg.tsx', explicit);

    expect(config.render?.mode).toBe('ssg');
    expect(config.cache?.edge?.maxAge).toBe(3600);
  });

  it('should let explicit config override convention', () => {
    const explicit: Partial<RouteConfig> = {
      render: {
        mode: 'ssr',
        streaming: { enabled: true },
      },
    };
    const config = applyConventionConfig('blog.ssg.tsx', explicit);

    expect(config.render?.mode).toBe('ssr');
  });

  it('should apply island convention', () => {
    const config = applyConventionConfig('app/_islands/Counter.tsx');
    expect(config.islands?.defaultStrategy).toBe('load');
  });
});

describe('getConventionPatterns', () => {
  it('should return all convention patterns', () => {
    const patterns = getConventionPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some((p) => p.includes('.ssg'))).toBe(true);
    expect(patterns.some((p) => p.includes('.server'))).toBe(true);
    expect(patterns.some((p) => p.includes('.client'))).toBe(true);
    expect(patterns.some((p) => p.includes('.api'))).toBe(true);
    expect(patterns.some((p) => p.includes('.rsc'))).toBe(true);
    expect(patterns.some((p) => p.includes('_islands'))).toBe(true);
    expect(patterns.some((p) => p.includes('_layout'))).toBe(true);
  });
});

describe('CONVENTION_SUFFIXES', () => {
  it('should contain all convention suffixes', () => {
    expect(CONVENTION_SUFFIXES['.ssg']).toBe('ssg');
    expect(CONVENTION_SUFFIXES['.server']).toBe('ssr');
    expect(CONVENTION_SUFFIXES['.client']).toBe('csr');
    expect(CONVENTION_SUFFIXES['.api']).toBe('api');
    expect(CONVENTION_SUFFIXES['.rsc']).toBe('rsc');
  });
});
