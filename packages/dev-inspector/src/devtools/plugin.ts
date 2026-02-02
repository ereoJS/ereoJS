/**
 * @areo/dev-inspector - DevTools Plugin
 *
 * Plugin that adds DevTools to the Areo dev server.
 */

import type { Plugin, Route } from '@areo/core';
import { generateDevToolsPanelHTML, type DevToolsPanelData } from './DevToolsPanel';
import type {
  DevToolsConfig,
  DataPipelineVisualization,
  RouteVisualization,
  IslandVisualization,
  CacheVisualization,
  HMREvent,
} from './types';

/**
 * DevTools state.
 */
interface DevToolsState {
  routes: RouteVisualization[];
  pipelineHistory: DataPipelineVisualization[];
  hmrEvents: HMREvent[];
}

/**
 * Create the DevTools plugin.
 *
 * @example
 * import { createDevToolsPlugin } from '@areo/dev-inspector';
 *
 * export default defineConfig({
 *   plugins: [
 *     createDevToolsPlugin({
 *       dataPipeline: true,
 *       islands: true,
 *       cache: true,
 *     }),
 *   ],
 * });
 */
export function createDevToolsPlugin(config: DevToolsConfig = {}): Plugin {
  const {
    mountPath = '/__devtools',
    dataPipeline = true,
    routes: showRoutes = true,
    islands = true,
    cache = true,
    position = 'bottom-right',
  } = config;

  const state: DevToolsState = {
    routes: [],
    pipelineHistory: [],
    hmrEvents: [],
  };

  return {
    name: '@areo/dev-inspector:devtools',

    /**
     * Transform routes to collect route info.
     */
    transformRoutes(routeList: Route[]): Route[] {
      state.routes = routeList
        .filter((r) => !r.layout)
        .map((route) => ({
          path: route.path,
          file: route.file,
          renderMode: (route.config?.render?.mode || 'ssr') as RouteVisualization['renderMode'],
          hasLoader: !!route.module?.loader,
          hasAction: !!route.module?.action,
          middleware: (route.config?.middleware || []).map((m) =>
            typeof m === 'string' ? m : 'inline'
          ),
          islandCount: route.config?.islands?.components?.length || 0,
          cacheTags: (route.config?.cache?.data?.tags || []) as string[],
          authRequired: route.config?.auth?.required || false,
        }));

      return routeList;
    },

    /**
     * Configure dev server with DevTools endpoints.
     */
    configureServer(server) {
      // DevTools panel endpoint
      server.middlewares.push(async (request, context, next) => {
        const url = new URL(request.url);

        // Serve DevTools panel
        if (url.pathname === mountPath) {
          const panelData = await collectPanelData(state);
          const html = generateDevToolsPanelHTML(panelData);

          return new Response(html, {
            headers: {
              'Content-Type': 'text/html',
              'X-Frame-Options': 'SAMEORIGIN',
            },
          });
        }

        // API: Get pipeline metrics
        if (url.pathname === `${mountPath}/api/pipeline`) {
          return new Response(JSON.stringify(state.pipelineHistory), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // API: Get routes
        if (url.pathname === `${mountPath}/api/routes`) {
          return new Response(JSON.stringify(state.routes), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // API: Get HMR events
        if (url.pathname === `${mountPath}/api/hmr`) {
          return new Response(JSON.stringify(state.hmrEvents), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // API: Record pipeline metrics (called by loaders)
        if (url.pathname === `${mountPath}/api/pipeline/record` && request.method === 'POST') {
          try {
            const metrics = await request.json() as DataPipelineVisualization;
            state.pipelineHistory.unshift(metrics);
            // Keep only last 100 records
            if (state.pipelineHistory.length > 100) {
              state.pipelineHistory.pop();
            }
            return new Response(JSON.stringify({ success: true }), {
              headers: { 'Content-Type': 'application/json' },
            });
          } catch {
            return new Response(JSON.stringify({ error: 'Invalid data' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        // Collect pipeline metrics from context after request
        const response = await next();

        // Check if this request has pipeline metrics
        const metrics = context.get<import('@areo/data').PipelineMetrics>('__pipeline_metrics');
        if (metrics) {
          const routePath = url.pathname;
          const visualization: DataPipelineVisualization = {
            route: routePath,
            totalTime: metrics.total,
            loaders: Array.from(metrics.loaders.values()).map((m) => ({
              key: m.key,
              start: m.startTime,
              end: m.endTime,
              duration: m.duration,
              cacheHit: m.cacheHit,
              source: (m.source as 'db' | 'api' | 'cache' | 'compute') || 'unknown',
              waitingFor: m.waitingFor,
            })),
            efficiency: metrics.parallelEfficiency,
            waterfalls: metrics.waterfalls,
            timestamp: Date.now(),
          };

          state.pipelineHistory.unshift(visualization);
          if (state.pipelineHistory.length > 100) {
            state.pipelineHistory.pop();
          }
        }

        return response;
      });

      // Inject DevTools overlay script into HTML responses
      if (dataPipeline || islands || cache) {
        server.middlewares.push(async (request, context, next) => {
          const response = await next();

          if (response.headers.get('Content-Type')?.includes('text/html')) {
            let html = await response.text();

            // Inject DevTools overlay
            const overlayScript = generateOverlayScript(mountPath, position);
            html = html.replace('</body>', `${overlayScript}</body>`);

            return new Response(html, {
              status: response.status,
              headers: response.headers,
            });
          }

          return response;
        });
      }

      console.log(`  \x1b[35m⬡\x1b[0m DevTools available at ${mountPath}`);
    },
  };
}

/**
 * Collect data for the DevTools panel.
 */
async function collectPanelData(state: DevToolsState): Promise<DevToolsPanelData> {
  // Get latest pipeline metrics
  const pipeline = state.pipelineHistory[0];

  // Get islands from the current page (this would be collected from the client)
  const islands: IslandVisualization[] = [];

  // Get cache data (would be collected from the cache system)
  const cache: CacheVisualization = {
    entries: [],
    totalSize: 0,
    hitRate: 0,
    tagStats: new Map(),
  };

  return {
    pipeline,
    routes: state.routes,
    islands,
    cache,
    hmrEvents: state.hmrEvents,
  };
}

/**
 * Generate the DevTools overlay injection script.
 */
function generateOverlayScript(mountPath: string, position: string): string {
  return `
<script>
(function() {
  // DevTools toggle button
  const button = document.createElement('button');
  button.id = 'areo-devtools-toggle';
  button.innerHTML = '⬡';
  button.title = 'Open Areo DevTools';
  button.style.cssText = \`
    position: fixed;
    ${position.includes('bottom') ? 'bottom: 16px;' : 'top: 16px;'}
    ${position.includes('right') ? 'right: 16px;' : 'left: 16px;'}
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    z-index: 99998;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    transition: transform 0.2s, box-shadow 0.2s;
  \`;
  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
  });

  // DevTools iframe
  let iframe = null;
  let isOpen = false;

  button.addEventListener('click', () => {
    if (isOpen) {
      closeDevTools();
    } else {
      openDevTools();
    }
  });

  function openDevTools() {
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'areo-devtools-frame';
      iframe.src = '${mountPath}';
      iframe.style.cssText = \`
        position: fixed;
        ${position.includes('bottom') ? 'bottom: 0;' : 'top: 0;'}
        left: 0;
        right: 0;
        height: 400px;
        border: none;
        background: #0f172a;
        z-index: 99999;
        box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.3);
      \`;
      document.body.appendChild(iframe);
    }
    iframe.style.display = 'block';
    isOpen = true;
    button.innerHTML = '✕';
    button.style.bottom = '416px';
  }

  function closeDevTools() {
    if (iframe) {
      iframe.style.display = 'none';
    }
    isOpen = false;
    button.innerHTML = '⬡';
    button.style.bottom = '16px';
  }

  // Listen for messages from DevTools
  window.addEventListener('message', (event) => {
    if (event.data.type === 'areo-devtools-close') {
      closeDevTools();
    } else if (event.data.type === 'areo-devtools-toggle-position') {
      // Toggle between top and bottom
    } else if (event.data.type === 'areo-devtools-highlight-islands') {
      highlightIslands();
    } else if (event.data.type === 'areo-devtools-scroll-to-island') {
      scrollToIsland(event.data.id);
    }
  });

  function highlightIslands() {
    const islands = document.querySelectorAll('[data-island]');
    islands.forEach(el => {
      el.style.outline = '2px dashed #3b82f6';
      el.style.outlineOffset = '2px';
      setTimeout(() => {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }, 3000);
    });
  }

  function scrollToIsland(id) {
    const island = document.querySelector(\`[data-island="\${id}"]\`);
    if (island) {
      island.scrollIntoView({ behavior: 'smooth', block: 'center' });
      island.style.outline = '3px solid #10b981';
      setTimeout(() => {
        island.style.outline = '';
      }, 2000);
    }
  }

  document.body.appendChild(button);
})();
</script>
  `;
}

/**
 * Record HMR event (called by HMR system).
 */
export function recordHMREvent(
  state: DevToolsState,
  event: Omit<HMREvent, 'timestamp'>
): void {
  state.hmrEvents.unshift({
    ...event,
    timestamp: Date.now(),
  });

  // Keep only last 100 events
  if (state.hmrEvents.length > 100) {
    state.hmrEvents.pop();
  }
}
