/**
 * @ereo/server - React Streaming Support
 *
 * Server-side rendering with streaming support for React 18+.
 */

import type { ReactElement } from 'react';
import type { Route, RouteMatch, AppContext, LoaderFunction, LinkDescriptor } from '@ereo/core';
import { serializeLoaderData, hasDeferredData, resolveAllDeferred } from '@ereo/data';

/**
 * Render options.
 */
export interface RenderOptions {
  /** Route match */
  match: RouteMatch;
  /** Request context */
  context: AppContext;
  /** The original request (passed to loaders) */
  request?: Request;
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
  /** Link descriptors for stylesheets, preloads, etc. */
  links?: LinkDescriptor[];
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

  const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  const htmlAttrs = Object.entries(shell.htmlAttrs || {})
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(' ');

  const bodyAttrs = Object.entries(shell.bodyAttrs || {})
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(' ');

  const metaTags = (shell.meta || [])
    .map((m) => {
      const key = m.name ? `name="${escapeAttr(m.name)}"` : `property="${escapeAttr(m.property || '')}"`;
      return `<meta ${key} content="${escapeAttr(m.content || '')}">`;
    })
    .join('\n    ');

  const styleLinks = styles
    .map((href) => `<link rel="stylesheet" href="${escapeAttr(href)}">`)
    .join('\n    ');

  const linkTags = (shell.links || [])
    .map((link) => {
      const attrs = Object.entries(link)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}="${escapeAttr(String(v))}"`)
        .join(' ');
      return `<link ${attrs}>`;
    })
    .join('\n    ');

  const scriptTags = scripts
    .map((src) => `<script type="module" src="${escapeAttr(src)}"></script>`)
    .join('\n    ');

  const loaderScript = loaderData === undefined
    ? ''
    : `<script>window.__EREO_DATA__=${serializeLoaderData(loaderData)}</script>`;

  const head = `<!DOCTYPE html>
<html ${htmlAttrs}>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${shell.title ? `<title>${escapeAttr(shell.title)}</title>` : ''}
    ${metaTags}
    ${linkTags}
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
 *
 * Returns a ReadableStream body that progressively sends:
 *   shell head → React content (with $RC scripts for Suspense) → tail
 *
 * Deferred data is NOT resolved upfront — React streams Suspense fallbacks
 * and resolves them out-of-order via inline $RC scripts. Loader data is
 * serialized into the tail only after all Suspense boundaries resolve.
 */
export async function renderToStream(
  element: ReactElement,
  options: RenderOptions
): Promise<RenderResult> {
  // Dynamic import to avoid issues when React DOM isn't installed
  const { renderToPipeableStream } = await import('react-dom/server');

  const { shell, scripts = [], styles = [] } = options;

  // Execute loader if available
  let loaderData: unknown = undefined;
  if (options.match.route.module?.loader) {
    loaderData = await options.match.route.module.loader({
      request: options.request ?? new Request('http://localhost'),
      params: options.match.params,
      context: options.context,
    });
    if (loaderData === undefined) {
      loaderData = null;
    }
  }

  const hasDeferred = loaderData !== undefined && hasDeferredData(loaderData);

  // Don't pass scripts to createShell — React's bootstrapModules handles
  // the client entry injection, avoiding double <script> tags.
  const { head, tail } = createShell({
    shell,
    scripts: [],
    styles,
    loaderData: hasDeferred ? undefined : loaderData,
  });

  return new Promise((resolve, reject) => {
    const { PassThrough } = require('stream');

    const DEFERRED_TIMEOUT_MS = 10_000;
    const RENDER_TIMEOUT_MS = 10_000;

    const timeoutId = setTimeout(() => {
      abort();
    }, RENDER_TIMEOUT_MS);

    const { pipe, abort } = renderToPipeableStream(element, {
      bootstrapModules: scripts,
      onShellReady() {
        const passThrough = new PassThrough();
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            // Send head immediately so the browser can parse CSS/meta
            controller.enqueue(encoder.encode(head));

            passThrough.on('data', (chunk: Buffer) => {
              controller.enqueue(new Uint8Array(chunk));
            });

            passThrough.on('end', () => {
              // Wrap async work in a self-executing function with error handling
              // to prevent unhandled promise rejections.
              (async () => {
                // React stream complete — resolve deferred data if needed.
                // React's stream already included the $RC scripts and client entry.
                if (hasDeferred) {
                  let resolvedData: unknown;
                  try {
                    resolvedData = await Promise.race([
                      resolveAllDeferred(loaderData),
                      new Promise<null>((_, rejectTimeout) =>
                        setTimeout(() => rejectTimeout(new Error('Deferred data resolution timed out')), DEFERRED_TIMEOUT_MS)
                      ),
                    ]);
                  } catch (error) {
                    console.error('Deferred data resolution failed:', error);
                    resolvedData = null;
                  }
                  const loaderScript = `<script>window.__EREO_DATA__=${serializeLoaderData(resolvedData)}</script>`;
                  const resolvedTail = `</div>\n    ${loaderScript}\n</body>\n</html>`;
                  controller.enqueue(encoder.encode(resolvedTail));
                } else {
                  controller.enqueue(encoder.encode(tail));
                }
                controller.close();
              })().catch((error) => {
                // Catch errors from controller methods (e.g. stream already cancelled)
                console.error('Stream finalization error:', error);
                try { controller.error(error); } catch { /* already errored/closed */ }
              }).finally(() => {
                clearTimeout(timeoutId);
              });
            });

            passThrough.on('error', (error: Error) => {
              clearTimeout(timeoutId);
              console.error('Stream error:', error);
              controller.error(error);
            });
          },
          cancel() {
            clearTimeout(timeoutId);
            passThrough.destroy();
          },
        });

        resolve({
          body: stream,
          headers: new Headers({
            'Content-Type': 'text/html; charset=utf-8',
          }),
          status: 200,
        });

        pipe(passThrough);
      },
      onShellError(error: unknown) {
        clearTimeout(timeoutId);
        console.error('Shell render error:', error);
        reject(error);
      },
      onError(error: unknown) {
        console.error('Render error:', error);
      },
    });
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
  let loaderData: unknown = undefined;
  if (options.match.route.module?.loader) {
    loaderData = await options.match.route.module.loader({
      request: options.request ?? new Request('http://localhost'),
      params: options.match.params,
      context: options.context,
    });
    if (loaderData === undefined) {
      loaderData = null;
    }
  }

  // Resolve any deferred data before serialization
  if (loaderData !== undefined && hasDeferredData(loaderData)) {
    loaderData = await resolveAllDeferred(loaderData);
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

