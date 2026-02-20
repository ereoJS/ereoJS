/**
 * @ereo/router - Route Tree
 *
 * Builds a hierarchical route tree from flat routes.
 * Handles layout nesting and route groups.
 */

import type { Route } from '@ereo/core';
import type { RouteNode, RouteSegment } from './types';
import { parsePathSegments, calculateRouteScore } from './matcher';
import { SPECIAL_FILES, ROUTE_GROUP_PATTERN } from './types';

/**
 * Route tree builder.
 */
export class RouteTree {
  private root: RouteNode;

  constructor() {
    this.root = this.createNode('/', '/', '', false, false);
  }

  /**
   * Create a route node.
   */
  private createNode(
    id: string,
    path: string,
    file: string,
    index: boolean,
    layout: boolean
  ): RouteNode {
    const segments = parsePathSegments(path);
    return {
      id,
      path,
      segments,
      file,
      index,
      layout,
      children: [],
      score: calculateRouteScore(segments),
    };
  }

  /**
   * Add a route to the tree.
   */
  addRoute(
    id: string,
    path: string,
    file: string,
    options: { index?: boolean; layout?: boolean } = {}
  ): RouteNode {
    const { index = false, layout = false } = options;
    const node = this.createNode(id, path, file, index, layout);

    // Find parent based on path
    const parent = this.findParent(path);
    node.parent = parent;
    parent.children.push(node);

    // Sort children by score
    parent.children.sort((a, b) => b.score - a.score);

    return node;
  }

  /**
   * Find the parent node for a path.
   */
  private findParent(path: string): RouteNode {
    if (path === '/') {
      return this.root;
    }

    const segments = path.split('/').filter(Boolean);
    segments.pop(); // Remove the last segment

    if (segments.length === 0) {
      return this.root;
    }

    let current = this.root;
    let currentPath = '';

    for (const segment of segments) {
      currentPath += '/' + segment;

      const child = current.children.find(
        (c) => c.path === currentPath || (c.layout && c.path === currentPath)
      );

      if (child) {
        current = child;
      }
    }

    return current;
  }

  /**
   * Get the root node.
   */
  getRoot(): RouteNode {
    return this.root;
  }

  /**
   * Convert tree to flat Route array.
   */
  toRoutes(): Route[] {
    return this.nodeToRoute(this.root).children || [];
  }

  /**
   * Convert a node to a Route.
   */
  private nodeToRoute(node: RouteNode): Route {
    const route: Route = {
      id: node.id,
      path: node.path,
      file: node.file,
      index: node.index,
      layout: node.layout,
    };

    if (node.children.length > 0) {
      route.children = node.children.map((child) => this.nodeToRoute(child));
    }

    if (node.module) {
      route.module = node.module;
    }

    return route;
  }

  /**
   * Find a node by path.
   */
  findByPath(path: string): RouteNode | null {
    const search = (node: RouteNode): RouteNode | null => {
      if (node.path === path) {
        return node;
      }
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    return search(this.root);
  }

  /**
   * Find a node by ID.
   */
  findById(id: string): RouteNode | null {
    const search = (node: RouteNode): RouteNode | null => {
      if (node.id === id) {
        return node;
      }
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
      return null;
    };
    return search(this.root);
  }

  /**
   * Remove a route by ID.
   */
  removeById(id: string): boolean {
    const remove = (parent: RouteNode): boolean => {
      const index = parent.children.findIndex((c) => c.id === id);
      if (index !== -1) {
        parent.children.splice(index, 1);
        return true;
      }
      for (const child of parent.children) {
        if (remove(child)) return true;
      }
      return false;
    };
    return remove(this.root);
  }

  /**
   * Get all routes as a flat array.
   */
  flatten(): RouteNode[] {
    const result: RouteNode[] = [];
    const collect = (node: RouteNode): void => {
      if (node !== this.root) {
        result.push(node);
      }
      for (const child of node.children) {
        collect(child);
      }
    };
    collect(this.root);
    return result;
  }

  /**
   * Get all layout routes.
   */
  getLayouts(): RouteNode[] {
    return this.flatten().filter((n) => n.layout);
  }

  /**
   * Get the layout chain for a route.
   */
  getLayoutChain(routeId: string): RouteNode[] {
    const node = this.findById(routeId);
    if (!node) return [];

    const layouts: RouteNode[] = [];
    let current: RouteNode | undefined = node.parent;

    while (current) {
      if (current.layout) {
        layouts.push(current);
      }
      current = current.parent;
    }

    // Reverse to get root-first order. O(n) vs O(n^2) with unshift.
    return layouts.reverse();
  }

  /**
   * Middleware stored by path prefix.
   * Separate from route nodes since middleware can exist without a route at that path.
   */
  private middlewareByPath: Map<string, { file: string; module?: { middleware?: any; default?: any } }> = new Map();

  /**
   * Attach middleware to a route segment.
   * Middleware applies to all routes in and below this segment.
   */
  attachMiddleware(path: string, middlewareFile: string): void {
    // Store middleware by path prefix - it applies to all routes under this path
    this.middlewareByPath.set(path, { file: middlewareFile });
  }

  /**
   * Get the middleware chain for a route (from root to leaf).
   */
  getMiddlewareChain(routeId: string): Array<{ file: string; module?: { middleware?: any; default?: any } }> {
    const node = this.findById(routeId);
    if (!node) return [];

    const routePath = node.path;
    const middlewares: Array<{ file: string; module?: { middleware?: any; default?: any } }> = [];

    // Get all middleware paths, sorted by length (shortest first = root first)
    const sortedPaths = Array.from(this.middlewareByPath.keys()).sort(
      (a, b) => a.length - b.length
    );

    // Collect middleware whose path is a prefix of the route path
    for (const middlewarePath of sortedPaths) {
      // A middleware at "/" applies to all routes
      // A middleware at "/api" applies to "/api", "/api/posts", etc.
      if (
        middlewarePath === '/' ||
        routePath === middlewarePath ||
        routePath.startsWith(middlewarePath + '/')
      ) {
        const mw = this.middlewareByPath.get(middlewarePath);
        if (mw) {
          middlewares.push(mw);
        }
      }
    }

    return middlewares;
  }
}

/**
 * Convert a file path to a URL path.
 */
export function filePathToUrlPath(
  filePath: string,
  routesDir: string
): { path: string; index: boolean; layout: boolean; middleware: boolean } {
  // Remove routes directory prefix and extension
  let path = filePath
    .replace(routesDir, '')
    .replace(/\.(tsx?|jsx?)$/, '');

  // Handle special files
  const fileName = path.split('/').pop() || '';
  const isLayout = fileName === SPECIAL_FILES.LAYOUT;
  const isMiddleware = fileName === SPECIAL_FILES.MIDDLEWARE;
  const isIndex = fileName === 'index';

  // Remove special file names from path
  if (isLayout || isIndex || isMiddleware) {
    path = path.replace(/\/?(index|_layout|_middleware)$/, '');
  }

  // Handle route groups - remove from URL but keep in structure
  // Replace route group segments like /(marketing)/ with /
  path = path.replace(/\/\([^)]+\)/g, '');

  // Ensure path starts with /
  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  // Remove trailing slashes except for root
  if (path !== '/' && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Convert [param] to :param for consistency
  // But keep original bracket notation for type generation

  return {
    path: path || '/',
    index: isIndex,
    layout: isLayout,
    middleware: isMiddleware,
  };
}

/**
 * Build a route tree from file paths.
 */
export function buildRouteTree(
  files: Array<{ relativePath: string; absolutePath: string }>,
  routesDir: string
): RouteTree {
  const tree = new RouteTree();

  // Separate middleware files from route files
  const middlewareFiles: Array<{ relativePath: string; absolutePath: string; path: string }> = [];
  const routeFiles: Array<{ relativePath: string; absolutePath: string }> = [];

  for (const file of files) {
    const { path, middleware } = filePathToUrlPath(file.relativePath, routesDir);
    if (middleware) {
      middlewareFiles.push({ ...file, path });
    } else {
      routeFiles.push(file);
    }
  }

  // Sort route files to ensure layouts are processed first
  const sortedFiles = [...routeFiles].sort((a, b) => {
    const aIsLayout = a.relativePath.includes(SPECIAL_FILES.LAYOUT);
    const bIsLayout = b.relativePath.includes(SPECIAL_FILES.LAYOUT);
    if (aIsLayout && !bIsLayout) return -1;
    if (!aIsLayout && bIsLayout) return 1;
    return a.relativePath.localeCompare(b.relativePath);
  });

  for (const file of sortedFiles) {
    const { path, index, layout } = filePathToUrlPath(file.relativePath, routesDir);
    const id = file.relativePath.replace(/\.(tsx?|jsx?)$/, '');

    tree.addRoute(id, path, file.absolutePath, { index, layout });
  }

  // Attach middleware files to their corresponding route segments
  for (const mw of middlewareFiles) {
    tree.attachMiddleware(mw.path, mw.absolutePath);
  }

  return tree;
}

/**
 * Create an empty route tree.
 */
export function createRouteTree(): RouteTree {
  return new RouteTree();
}
