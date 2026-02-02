/**
 * @areo/server - React Streaming Support
 *
 * Server-side rendering with streaming support for React 18+.
 */
import type { ReactElement } from 'react';
import type { RouteMatch, AppContext } from '@areo/core';
/**
 * Render options.
 */
export interface RenderOptions {
    /** Route match */
    match: RouteMatch;
    /** Request context */
    context: AppContext;
    /** Shell template */
    shell?: ShellTemplate;
    /** Enable streaming */
    streaming?: boolean;
    /** Bootstrap scripts */
    scripts?: string[];
    /** Stylesheets */
    styles?: string[];
}
/**
 * Shell template for HTML document.
 */
export interface ShellTemplate {
    /** Document title */
    title?: string;
    /** Meta tags */
    meta?: Array<{
        name?: string;
        property?: string;
        content: string;
    }>;
    /** Head content */
    head?: string;
    /** Body attributes */
    bodyAttrs?: Record<string, string>;
    /** HTML attributes */
    htmlAttrs?: Record<string, string>;
}
/**
 * Render result.
 */
export interface RenderResult {
    /** HTML content or stream */
    body: string | ReadableStream<Uint8Array>;
    /** Response headers */
    headers: Headers;
    /** Status code */
    status: number;
}
/**
 * Create the HTML shell wrapper.
 */
export declare function createShell(options: {
    shell?: ShellTemplate;
    scripts?: string[];
    styles?: string[];
    loaderData?: unknown;
}): {
    head: string;
    tail: string;
};
/**
 * Render a route to a streaming response.
 * Uses renderToPipeableStream for Node.js/Bun environments.
 */
export declare function renderToStream(element: ReactElement, options: RenderOptions): Promise<RenderResult>;
/**
 * Render a route to a string (non-streaming).
 */
export declare function renderToString(element: ReactElement, options: RenderOptions): Promise<RenderResult>;
/**
 * Create a Response from render result.
 */
export declare function createResponse(result: RenderResult): Response;
/**
 * Stream helper for sending chunks with delays (Suspense boundaries).
 */
export declare function createSuspenseStream(): {
    stream: ReadableStream<Uint8Array>;
    push: (chunk: string) => void;
    close: () => void;
};
//# sourceMappingURL=streaming.d.ts.map