/**
 * @ereo/server - React Streaming Support
 *
 * Server-side rendering with streaming support for React 18+.
 */

import type { ReactElement } from 'react';
import type { Route, RouteMatch, AppContext, LoaderFunction } from '@ereo/core';
import { serializeLoaderData } from '@ereo/data';

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
  meta?: Array<{ name?: string; property?: string; content: string }>;
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
export function createShell(options: {
  shell?: ShellTemplate;
  scripts?: string[];
  styles?: string[];
  loaderData?: unknown;
}): { head: string; tail: string } {
  const { shell = {}, scripts = [], styles = [], loaderData } = options;

  const htmlAttrs = Object.entries(shell.htmlAttrs || {})
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  const bodyAttrs = Object.entries(shell.bodyAttrs || {})
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');

  const metaTags = (shell.meta || [])
    .map((m) => {
      const key = m.name ? `name="${m.name}"` : `property="${m.property}"`;
      return `<meta ${key} content="${m.content}">`;
    })
    .join('\n    ');

  const styleLinks = styles
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n    ');

  const scriptTags = scripts
    .map((src) => `<script type="module" src="${src}"></script>`)
    .join('\n    ');

  const loaderScript = loaderData
    ? `<script>window.__EREO_DATA__=${serializeLoaderData(loaderData)}</script>`
    : '';

  const head = `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${shell.title ? `<title>${shell.title}</title>` : ''}
    ${metaTags}
    ${styleLinks}
    ${shell.head || ''}
</head>
<body ${bodyAttrs}>
<div id="root">`;

  const tail = `</div>
    ${loaderScript}
    ${scriptTags}
</body>
</html>`;

  return { head, tail };
}

/**
 * Render a route to a streaming response.
 * Uses renderToPipeableStream for Node.js/Bun environments.
 */
export async function renderToStream(
  element: ReactElement,
  options: RenderOptions
): Promise<RenderResult> {
  // Dynamic import to avoid issues when React DOM isn't installed
  const { renderToPipeableStream } = await import('react-dom/server');

  const { shell, scripts = [], styles = [] } = options;

  // Execute loader if available
  let loaderData: unknown = null;
  if (options.match.route.module?.loader) {
    loaderData = await options.match.route.module.loader({
      request: new Request('http://localhost'),
      params: options.match.params,
      context: options.context,
    });
  }

  const { head, tail } = createShell({ shell, scripts, styles, loaderData });

  return new Promise((resolve, reject) => {
    const { PassThrough } = require('stream');

    const { pipe, abort } = renderToPipeableStream(element, {
      bootstrapScripts: scripts,
      onShellReady() {
        const passThrough = new PassThrough();
        const chunks: Buffer[] = [];
        chunks.push(Buffer.from(head));

        passThrough.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        passThrough.on('end', () => {
          chunks.push(Buffer.from(tail));
          const fullHtml = Buffer.concat(chunks).toString('utf-8');

          resolve({
            body: fullHtml,
            headers: new Headers({
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Length': Buffer.byteLength(fullHtml).toString(),
            }),
            status: 200,
          });
        });

        passThrough.on('error', (error: Error) => {
          console.error('Stream error:', error);
          reject(error);
        });

        pipe(passThrough);
      },
      onShellError(error: unknown) {
        console.error('Shell render error:', error);
        reject(error);
      },
      onError(error: unknown) {
        console.error('Render error:', error);
      },
    });

    // Set a timeout to abort if rendering takes too long
    setTimeout(() => {
      abort();
    }, 10000);
  });
}

/**
 * Render a route to a string (non-streaming).
 */
export async function renderToString(
  element: ReactElement,
  options: RenderOptions
): Promise<RenderResult> {
  const { renderToString: reactRenderToString } = await import('react-dom/server');

  const { shell, scripts = [], styles = [] } = options;

  // Execute loader if available
  let loaderData: unknown = null;
  if (options.match.route.module?.loader) {
    loaderData = await options.match.route.module.loader({
      request: new Request('http://localhost'),
      params: options.match.params,
      context: options.context,
    });
  }

  const { head, tail } = createShell({ shell, scripts, styles, loaderData });
  const content = reactRenderToString(element);
  const html = head + content + tail;

  return {
    body: html,
    headers: new Headers({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html).toString(),
    }),
    status: 200,
  };
}

/**
 * Create a Response from render result.
 */
export function createResponse(result: RenderResult): Response {
  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

/**
 * Stream helper for sending chunks with delays (Suspense boundaries).
 */
export function createSuspenseStream(): {
  stream: ReadableStream<Uint8Array>;
  push: (chunk: string) => void;
  close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  return {
    stream,
    push: (chunk: string) => {
      controller.enqueue(encoder.encode(chunk));
    },
    close: () => {
      controller.close();
    },
  };
}
