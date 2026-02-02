/**
 * @areo/server - Bun HTTP Server
 *
 * High-performance HTTP server using Bun.serve().
 * Designed for 5-6x faster performance than Node.js.
 */
import type { Server } from 'bun';
import { AreoApp } from '@areo/core';
import { FileRouter } from '@areo/router';
import { MiddlewareChain, cors, securityHeaders } from './middleware';
import { type StaticOptions } from './static';
import { type ShellTemplate } from './streaming';
/**
 * Render mode options.
 */
export type RenderMode = 'streaming' | 'string';
/**
 * Server options.
 */
export interface ServerOptions {
    /** Port to listen on */
    port?: number;
    /** Hostname to bind to */
    hostname?: string;
    /** Development mode */
    development?: boolean;
    /** Static file options */
    static?: StaticOptions;
    /** Enable logging */
    logging?: boolean;
    /** Enable CORS */
    cors?: boolean | Parameters<typeof cors>[0];
    /** Enable security headers */
    security?: boolean | Parameters<typeof securityHeaders>[0];
    /** Custom request handler */
    handler?: (request: Request) => Response | Promise<Response>;
    /** WebSocket handler */
    websocket?: Parameters<typeof Bun.serve>[0]['websocket'];
    /** TLS options */
    tls?: {
        cert: string;
        key: string;
    };
    /** Render mode: 'streaming' for React 18 streaming SSR, 'string' for traditional SSR */
    renderMode?: RenderMode;
    /** Base path for client assets */
    assetsPath?: string;
    /** Client entry script path */
    clientEntry?: string;
    /** Default shell template */
    shell?: ShellTemplate;
}
/**
 * Bun server instance.
 */
export declare class BunServer {
    private server;
    private app;
    private router;
    private middleware;
    private staticHandler;
    private options;
    constructor(options?: ServerOptions);
    /**
     * Setup default middleware.
     */
    private setupMiddleware;
    /**
     * Set the Oreo app instance.
     */
    setApp(app: AreoApp): void;
    /**
     * Set the file router.
     */
    setRouter(router: FileRouter): void;
    /**
     * Add middleware.
     */
    use(handler: Parameters<MiddlewareChain['use']>[0]): void;
    /**
     * Handle incoming request.
     */
    private handleRequest;
    /**
     * Handle a matched route.
     */
    private handleRoute;
    /**
     * Render a full HTML page with the route component.
     */
    private renderPage;
    /**
     * Render page using React 18 streaming SSR.
     * Uses renderToPipeableStream for Node.js/Bun environments and converts to a web ReadableStream.
     */
    private renderStreamingPage;
    /**
     * Render page using traditional string-based SSR.
     */
    private renderStringPage;
    /**
     * Render a minimal HTML page when no component is available.
     */
    private renderMinimalPage;
    /**
     * Render an error page.
     */
    private renderErrorPage;
    /**
     * Build meta descriptors from route's meta function.
     */
    private buildMeta;
    /**
     * Extract title from meta descriptors.
     */
    private extractTitle;
    /**
     * Extract meta tags from meta descriptors (excluding title).
     */
    private extractMetaTags;
    /**
     * Escape HTML special characters.
     */
    private escapeHtml;
    /**
     * Handle errors.
     */
    private handleError;
    /**
     * Start the server.
     */
    start(): Promise<Server>;
    /**
     * Stop the server.
     */
    stop(): void;
    /**
     * Reload the server (for HMR).
     */
    reload(): Promise<void>;
    /**
     * Get the server instance.
     */
    getServer(): Server | null;
    /**
     * Get server info.
     */
    getInfo(): {
        port: number;
        hostname: string;
        development: boolean;
    };
}
/**
 * Create a Bun server.
 */
export declare function createServer(options?: ServerOptions): BunServer;
/**
 * Quick start helper.
 */
export declare function serve(options?: ServerOptions): Promise<BunServer>;
//# sourceMappingURL=bun-server.d.ts.map