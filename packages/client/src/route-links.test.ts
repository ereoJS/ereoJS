import { describe, expect, test } from 'bun:test';
import {
  renderLinkTags,
  updateRouteLinks,
  removeRouteLinks,
  getActiveLinksCount,
} from './route-links';
import type { LinkDescriptor } from '@ereo/core';

// =================================================================
// renderLinkTags (SSR) tests
// =================================================================

describe('@ereo/client - renderLinkTags', () => {
  test('renders a single stylesheet link', () => {
    const links: LinkDescriptor[] = [
      { rel: 'stylesheet', href: '/styles/main.css' },
    ];

    const html = renderLinkTags(links);
    expect(html).toContain('rel="stylesheet"');
    expect(html).toContain('href="/styles/main.css"');
    expect(html).toContain('data-ereo-link');
  });

  test('renders multiple links', () => {
    const links: LinkDescriptor[] = [
      { rel: 'stylesheet', href: '/styles/base.css' },
      { rel: 'stylesheet', href: '/styles/theme.css' },
      { rel: 'preload', href: '/fonts/inter.woff2', as: 'font', type: 'font/woff2' },
    ];

    const html = renderLinkTags(links);
    const linkCount = (html.match(/<link /g) || []).length;
    expect(linkCount).toBe(3);
    expect(html).toContain('/styles/base.css');
    expect(html).toContain('/styles/theme.css');
    expect(html).toContain('/fonts/inter.woff2');
    expect(html).toContain('as="font"');
  });

  test('renders empty string for no links', () => {
    const html = renderLinkTags([]);
    expect(html).toBe('');
  });

  test('includes all link attributes', () => {
    const links: LinkDescriptor[] = [
      {
        rel: 'preload',
        href: '/fonts/inter.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
    ];

    const html = renderLinkTags(links);
    expect(html).toContain('rel="preload"');
    expect(html).toContain('href="/fonts/inter.woff2"');
    expect(html).toContain('as="font"');
    expect(html).toContain('type="font/woff2"');
    expect(html).toContain('crossOrigin="anonymous"');
  });

  test('skips undefined attributes', () => {
    const links: LinkDescriptor[] = [
      { rel: 'stylesheet', href: '/style.css', media: undefined },
    ];

    const html = renderLinkTags(links);
    expect(html).not.toContain('media');
  });

  test('escapes attribute values', () => {
    const links: LinkDescriptor[] = [
      { rel: 'stylesheet', href: '/style.css?v=1&theme=dark' },
    ];

    const html = renderLinkTags(links);
    expect(html).toContain('&amp;');
  });

  test('renders icon links', () => {
    const links: LinkDescriptor[] = [
      { rel: 'icon', href: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ];

    const html = renderLinkTags(links);
    expect(html).toContain('rel="icon"');
    expect(html).toContain('sizes="32x32"');
  });
});

// =================================================================
// Client-side link management tests (SSR-safe)
// =================================================================

describe('@ereo/client - route links management', () => {
  test('getActiveLinksCount starts at 0', () => {
    removeRouteLinks(); // reset
    expect(getActiveLinksCount()).toBe(0);
  });

  test('updateRouteLinks is SSR-safe (no document)', () => {
    // In Bun test environment, document is not defined
    // updateRouteLinks should not throw
    expect(() => {
      updateRouteLinks([{ rel: 'stylesheet', href: '/test.css' }]);
    }).not.toThrow();
  });

  test('removeRouteLinks is SSR-safe', () => {
    expect(() => {
      removeRouteLinks();
    }).not.toThrow();
  });
});

// =================================================================
// LinksFunction type tests
// =================================================================

describe('@ereo/client - LinksFunction type contracts', () => {
  test('LinkDescriptor has required rel and href', () => {
    const link: LinkDescriptor = { rel: 'stylesheet', href: '/style.css' };
    expect(link.rel).toBe('stylesheet');
    expect(link.href).toBe('/style.css');
  });

  test('LinkDescriptor supports all standard attributes', () => {
    const link: LinkDescriptor = {
      rel: 'preload',
      href: '/font.woff2',
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
      media: '(min-width: 768px)',
      integrity: 'sha384-abc',
      sizes: '32x32',
      imageSrcSet: '/img-1x.png 1x, /img-2x.png 2x',
      imageSizes: '(max-width: 600px) 100vw, 50vw',
      title: 'Alternate Style',
    };

    expect(link.as).toBe('font');
    expect(link.crossOrigin).toBe('anonymous');
    expect(link.media).toBe('(min-width: 768px)');
    expect(link.integrity).toBe('sha384-abc');
    expect(link.imageSrcSet).toContain('img-2x');
  });

  test('LinksFunction returns array of LinkDescriptors', () => {
    type LinksFunction = () => LinkDescriptor[];

    const links: LinksFunction = () => [
      { rel: 'stylesheet', href: '/a.css' },
      { rel: 'stylesheet', href: '/b.css' },
    ];

    const result = links();
    expect(result).toHaveLength(2);
    expect(result[0].href).toBe('/a.css');
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/client - links exports from index', () => {
  test('all route-links exports available', async () => {
    const exports = await import('./index');

    expect(exports.renderLinkTags).toBeDefined();
    expect(exports.updateRouteLinks).toBeDefined();
    expect(exports.removeRouteLinks).toBeDefined();
    expect(exports.getActiveLinksCount).toBeDefined();

    expect(typeof exports.renderLinkTags).toBe('function');
    expect(typeof exports.updateRouteLinks).toBe('function');
    expect(typeof exports.removeRouteLinks).toBe('function');
    expect(typeof exports.getActiveLinksCount).toBe('function');
  });
});
