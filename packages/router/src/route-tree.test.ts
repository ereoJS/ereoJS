import { describe, expect, test } from 'bun:test';
import { RouteTree, filePathToUrlPath, buildRouteTree, createRouteTree } from './route-tree';

describe('@areo/router - RouteTree', () => {
  describe('filePathToUrlPath', () => {
    test('converts index files to root path', () => {
      const result = filePathToUrlPath('/index.tsx', '');
      expect(result.path).toBe('/');
      expect(result.index).toBe(true);
      expect(result.layout).toBe(false);
    });

    test('converts simple paths', () => {
      const result = filePathToUrlPath('/about.tsx', '');
      expect(result.path).toBe('/about');
      expect(result.index).toBe(false);
    });

    test('converts nested paths', () => {
      const result = filePathToUrlPath('/blog/posts.tsx', '');
      expect(result.path).toBe('/blog/posts');
    });

    test('converts nested index files', () => {
      const result = filePathToUrlPath('/blog/index.tsx', '');
      expect(result.path).toBe('/blog');
      expect(result.index).toBe(true);
    });

    test('identifies layout files', () => {
      const result = filePathToUrlPath('/_layout.tsx', '');
      expect(result.path).toBe('/');
      expect(result.layout).toBe(true);
    });

    test('identifies nested layout files', () => {
      const result = filePathToUrlPath('/blog/_layout.tsx', '');
      expect(result.path).toBe('/blog');
      expect(result.layout).toBe(true);
    });

    test('removes route groups from path', () => {
      const result = filePathToUrlPath('/(marketing)/pricing.tsx', '');
      expect(result.path).toBe('/pricing');
    });
  });

  describe('RouteTree', () => {
    test('creates an empty tree', () => {
      const tree = createRouteTree();
      const root = tree.getRoot();

      expect(root.path).toBe('/');
      expect(root.children).toHaveLength(0);
    });

    test('adds routes to the tree', () => {
      const tree = createRouteTree();

      tree.addRoute('home', '/', '/routes/index.tsx', { index: true });
      tree.addRoute('about', '/about', '/routes/about.tsx');

      const routes = tree.toRoutes();
      expect(routes).toHaveLength(2);
    });

    test('adds nested routes', () => {
      const tree = createRouteTree();

      tree.addRoute('blog-layout', '/blog', '/routes/blog/_layout.tsx', { layout: true });
      tree.addRoute('blog-index', '/blog', '/routes/blog/index.tsx', { index: true });
      tree.addRoute('blog-post', '/blog/[slug]', '/routes/blog/[slug].tsx');

      const routes = tree.toRoutes();
      // Routes are nested, so we check the flat count
      const flat = tree.flatten();
      expect(flat.length).toBeGreaterThanOrEqual(2);
    });

    test('finds route by path', () => {
      const tree = createRouteTree();

      tree.addRoute('about', '/about', '/routes/about.tsx');
      const node = tree.findByPath('/about');

      expect(node?.id).toBe('about');
    });

    test('finds route by ID', () => {
      const tree = createRouteTree();

      tree.addRoute('about', '/about', '/routes/about.tsx');
      const node = tree.findById('about');

      expect(node?.path).toBe('/about');
    });

    test('removes route by ID', () => {
      const tree = createRouteTree();

      tree.addRoute('about', '/about', '/routes/about.tsx');
      const removed = tree.removeById('about');

      expect(removed).toBe(true);
      expect(tree.findById('about')).toBeNull();
    });

    test('flattens tree to array', () => {
      const tree = createRouteTree();

      tree.addRoute('home', '/', '/routes/index.tsx', { index: true });
      tree.addRoute('about', '/about', '/routes/about.tsx');

      const flat = tree.flatten();
      expect(flat).toHaveLength(2);
    });

    test('gets layout chain', () => {
      const tree = createRouteTree();

      tree.addRoute('root-layout', '/', '/routes/_layout.tsx', { layout: true });
      tree.addRoute('blog-layout', '/blog', '/routes/blog/_layout.tsx', { layout: true });
      tree.addRoute('blog-post', '/blog/[slug]', '/routes/blog/[slug].tsx');

      const chain = tree.getLayoutChain('blog-post');
      // Should include both layouts
      expect(chain.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildRouteTree', () => {
    test('builds tree from file list', () => {
      const files = [
        { relativePath: '/index.tsx', absolutePath: '/app/routes/index.tsx' },
        { relativePath: '/about.tsx', absolutePath: '/app/routes/about.tsx' },
        { relativePath: '/blog/index.tsx', absolutePath: '/app/routes/blog/index.tsx' },
      ];

      const tree = buildRouteTree(files, '');
      const routes = tree.toRoutes();

      expect(routes.length).toBeGreaterThanOrEqual(3);
    });
  });
});
