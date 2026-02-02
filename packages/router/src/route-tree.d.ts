/**
 * @areo/router - Route Tree
 *
 * Builds a hierarchical route tree from flat routes.
 * Handles layout nesting and route groups.
 */
import type { Route } from '@areo/core';
import type { RouteNode } from './types';
/**
 * Route tree builder.
 */
export declare class RouteTree {
    private root;
    constructor();
    /**
     * Create a route node.
     */
    private createNode;
    /**
     * Add a route to the tree.
     */
    addRoute(id: string, path: string, file: string, options?: {
        index?: boolean;
        layout?: boolean;
    }): RouteNode;
    /**
     * Find the parent node for a path.
     */
    private findParent;
    /**
     * Get the root node.
     */
    getRoot(): RouteNode;
    /**
     * Convert tree to flat Route array.
     */
    toRoutes(): Route[];
    /**
     * Convert a node to a Route.
     */
    private nodeToRoute;
    /**
     * Find a node by path.
     */
    findByPath(path: string): RouteNode | null;
    /**
     * Find a node by ID.
     */
    findById(id: string): RouteNode | null;
    /**
     * Remove a route by ID.
     */
    removeById(id: string): boolean;
    /**
     * Get all routes as a flat array.
     */
    flatten(): RouteNode[];
    /**
     * Get all layout routes.
     */
    getLayouts(): RouteNode[];
    /**
     * Get the layout chain for a route.
     */
    getLayoutChain(routeId: string): RouteNode[];
}
/**
 * Convert a file path to a URL path.
 */
export declare function filePathToUrlPath(filePath: string, routesDir: string): {
    path: string;
    index: boolean;
    layout: boolean;
};
/**
 * Build a route tree from file paths.
 */
export declare function buildRouteTree(files: Array<{
    relativePath: string;
    absolutePath: string;
}>, routesDir: string): RouteTree;
/**
 * Create an empty route tree.
 */
export declare function createRouteTree(): RouteTree;
//# sourceMappingURL=route-tree.d.ts.map