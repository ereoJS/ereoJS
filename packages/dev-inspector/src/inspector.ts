/**
 * @ereo/dev-inspector - Visual route inspector
 *
 * Provides a visual interface for exploring routes during development.
 */

import type { Plugin, Route } from '@ereo/core';

/** Inspector configuration */
export interface InspectorConfig {
  /** Path to mount inspector (default: /__ereo) */
  mountPath?: string;
  /** Enable route testing */
  enableTesting?: boolean;
  /** Show loader data */
  showLoaderData?: boolean;
}

/** Route info for display */
export interface RouteInfo {
  id: string;
  path: string;
  file: string;
  renderMode: string;
  islandCount: number;
  hasLoader: boolean;
  hasAction: boolean;
  middlewareCount: number;
  cacheTags?: string[];
  authRequired?: boolean;
}

/** Generate HTML for the route inspector UI */
export function generateInspectorHTML(routes: RouteInfo[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ereo Route Inspector</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
    header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #334155;
    }
    .logo {
      width: 40px; height: 40px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-weight: bold; font-size: 1.2rem;
    }
    h1 { font-size: 1.5rem; font-weight: 600; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: #1e293b;
      padding: 1.5rem;
      border-radius: 12px;
      border: 1px solid #334155;
    }
    .stat-value { font-size: 2rem; font-weight: 700; color: #3b82f6; }
    .stat-label { font-size: 0.875rem; color: #94a3b8; }
    .route-tree { background: #1e293b; border-radius: 12px; border: 1px solid #334155; }
    .route-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid #334155;
      transition: background 0.2s;
    }
    .route-item:hover { background: #252f47; }
    .route-item:last-child { border-bottom: none; }
    .method-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .method-ssr { background: #3b82f6; color: white; }
    .method-ssg { background: #10b981; color: white; }
    .method-csr { background: #f59e0b; color: white; }
    .method-api { background: #8b5cf6; color: white; }
    .method-rsc { background: #ec4899; color: white; }
    .route-path { font-family: 'Monaco', 'Menlo', monospace; font-size: 0.9rem; }
    .route-file { font-size: 0.8rem; color: #64748b; margin-left: auto; }
    .route-tags {
      display: flex;
      gap: 0.5rem;
      margin-left: 1rem;
    }
    .tag {
      padding: 0.125rem 0.375rem;
      background: #334155;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .tag-islands { background: #059669; }
    .tag-loader { background: #2563eb; }
    .tag-action { background: #dc2626; }
    .tag-auth { background: #f59e0b; }
    .search-box {
      width: 100%;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 1rem;
    }
    .search-box:focus { outline: none; border-color: #3b82f6; }
    .section-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">O</div>
      <h1>Route Inspector</h1>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${routes.length}</div>
        <div class="stat-label">Total Routes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${routes.filter(r => r.renderMode === 'ssr').length}</div>
        <div class="stat-label">SSR Routes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${routes.filter(r => r.renderMode === 'ssg').length}</div>
        <div class="stat-label">SSG Routes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${routes.filter(r => r.renderMode === 'api' || r.file.includes('.api.')).length}</div>
        <div class="stat-label">API Routes</div>
      </div>
    </div>

    <div class="section-title">Route Tree</div>
    <input type="text" class="search-box" placeholder="Search routes..." id="search">

    <div class="route-tree">
      ${routes.map(route => `
        <div class="route-item" data-path="${route.path.toLowerCase()}">
          <span class="method-badge method-${route.renderMode}">${route.renderMode}</span>
          <span class="route-path">${route.path}</span>
          <div class="route-tags">
            ${route.islandCount > 0 ? `<span class="tag tag-islands">${route.islandCount} islands</span>` : ''}
            ${route.hasLoader ? `<span class="tag tag-loader">loader</span>` : ''}
            ${route.hasAction ? `<span class="tag tag-action">action</span>` : ''}
            ${route.authRequired ? `<span class="tag tag-auth">auth</span>` : ''}
          </div>
          <span class="route-file">${route.file}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    const searchInput = document.getElementById('search');
    const routeItems = document.querySelectorAll('.route-item');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      routeItems.forEach(item => {
        const path = item.getAttribute('data-path');
        item.style.display = path.includes(query) ? 'flex' : 'none';
      });
    });
  </script>
</body>
</html>`;
}

/** Create route info from routes */
export function createRouteInfo(routes: Route[]): RouteInfo[] {
  return routes.map(route => {
    const config = route.config || {};
    const renderMode = config.render?.mode || 'ssr';

    return {
      id: route.id,
      path: route.path,
      file: route.file,
      renderMode,
      islandCount: config.islands?.components?.length || 0,
      hasLoader: route.module?.loader !== undefined,
      hasAction: route.module?.action !== undefined,
      middlewareCount: config.middleware?.length || 0,
      cacheTags: config.cache?.data?.tags as string[] | undefined,
      authRequired: config.auth?.required,
    };
  });
}

/** Create the dev inspector plugin */
export function createDevInspector(config: InspectorConfig = {}): Plugin {
  const mountPath = config.mountPath || '/__ereo';

  return {
    name: '@ereo/dev-inspector',

    configureServer(server) {
      // Store routes for inspection
      let routeInfo: RouteInfo[] = [];

      // Add route inspector endpoint
      server.middlewares.push(async (request, _ctx, next) => {
        const url = new URL(request.url);

        if (url.pathname === mountPath) {
          const html = generateInspectorHTML(routeInfo);
          return new Response(html, {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        if (url.pathname === `${mountPath}/api/routes`) {
          return new Response(JSON.stringify(routeInfo), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return next();
      });

      console.log(`[inspector] Mounted at ${mountPath}`);
    },
  };
}

/** Format route tree for CLI display */
export function formatRouteTree(routes: RouteInfo[]): string {
  const lines: string[] = ['Route Tree:', ''];

  routes.forEach(route => {
    const icon = getRenderModeIcon(route.renderMode);
    const tags: string[] = [];
    if (route.hasLoader) tags.push('loader');
    if (route.hasAction) tags.push('action');
    if (route.islandCount > 0) tags.push(`${route.islandCount} islands`);
    if (route.authRequired) tags.push('auth');

    const tagStr = tags.length > 0 ? ` [${tags.join(', ')}]` : '';
    lines.push(`  ${icon} ${route.path}${tagStr}`);
    lines.push(`     → ${route.file}`);
  });

  return lines.join('\n');
}

function getRenderModeIcon(mode: string): string {
  switch (mode) {
    case 'ssr': return '⚡';
    case 'ssg': return '📄';
    case 'csr': return '💻';
    case 'api': return '🔌';
    case 'rsc': return '🚀';
    default: return '•';
  }
}
