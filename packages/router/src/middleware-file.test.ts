import { describe, expect, test } from 'bun:test';
import { buildRouteTree, filePathToUrlPath } from './route-tree';

describe('Middleware file support', () => {
  test('filePathToUrlPath recognizes _middleware.ts', () => {
    const result = filePathToUrlPath('/_middleware.ts', '');
    expect(result.middleware).toBe(true);
    expect(result.path).toBe('/');
  });

  test('filePathToUrlPath recognizes nested _middleware.ts', () => {
    const result = filePathToUrlPath('/api/_middleware.ts', '');
    expect(result.middleware).toBe(true);
    expect(result.path).toBe('/api');
  });

  test('buildRouteTree attaches middleware to tree', () => {
    const files = [
      { relativePath: '/index.tsx', absolutePath: '/app/routes/index.tsx' },
      { relativePath: '/api/posts.ts', absolutePath: '/app/routes/api/posts.ts' },
      { relativePath: '/api/_middleware.ts', absolutePath: '/app/routes/api/_middleware.ts' },
      { relativePath: '/_middleware.ts', absolutePath: '/app/routes/_middleware.ts' },
    ];

    const tree = buildRouteTree(files, '');

    // Find the api/posts route
    const postsRoute = tree.findById('/api/posts');
    expect(postsRoute).not.toBeNull();

    // Get middleware chain for api/posts
    const chain = tree.getMiddlewareChain('/api/posts');
    expect(chain.length).toBe(2); // Root middleware + API middleware
    expect(chain[0].file).toBe('/app/routes/_middleware.ts');
    expect(chain[1].file).toBe('/app/routes/api/_middleware.ts');
  });

  test('middleware chain is in correct order (root to leaf)', () => {
    const files = [
      { relativePath: '/dashboard/settings.tsx', absolutePath: '/app/routes/dashboard/settings.tsx' },
      { relativePath: '/dashboard/_middleware.ts', absolutePath: '/app/routes/dashboard/_middleware.ts' },
      { relativePath: '/_middleware.ts', absolutePath: '/app/routes/_middleware.ts' },
    ];

    const tree = buildRouteTree(files, '');
    const chain = tree.getMiddlewareChain('/dashboard/settings');

    expect(chain.length).toBe(2);
    expect(chain[0].file).toBe('/app/routes/_middleware.ts'); // Root first
    expect(chain[1].file).toBe('/app/routes/dashboard/_middleware.ts'); // Then dashboard
  });

  test('middleware only applies to routes under its path', () => {
    const files = [
      { relativePath: '/about.tsx', absolutePath: '/app/routes/about.tsx' },
      { relativePath: '/api/posts.ts', absolutePath: '/app/routes/api/posts.ts' },
      { relativePath: '/api/_middleware.ts', absolutePath: '/app/routes/api/_middleware.ts' },
    ];

    const tree = buildRouteTree(files, '');

    // About route should not have API middleware
    const aboutChain = tree.getMiddlewareChain('/about');
    expect(aboutChain.length).toBe(0);

    // API posts route should have API middleware
    const postsChain = tree.getMiddlewareChain('/api/posts');
    expect(postsChain.length).toBe(1);
    expect(postsChain[0].file).toBe('/app/routes/api/_middleware.ts');
  });
});
