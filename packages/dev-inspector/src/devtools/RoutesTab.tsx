/**
 * @ereo/dev-inspector - Routes Tab
 *
 * Visualize all routes with render modes, middleware, and configuration.
 */

import type { RouteVisualization } from './types';

/**
 * Generate HTML for the Routes tab.
 */
export function generateRoutesTabHTML(routes: RouteVisualization[]): string {
  const stats = calculateRouteStats(routes);

  const routeRows = routes
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((route) => generateRouteRow(route))
    .join('\n');

  return `
    <div class="routes-container">
      <div class="routes-header">
        <h3>Routes</h3>
        <div class="route-stats">
          <span class="stat">
            <span class="stat-value">${stats.total}</span>
            <span class="stat-label">Total</span>
          </span>
          <span class="stat">
            <span class="stat-value">${stats.ssr}</span>
            <span class="stat-label">SSR</span>
          </span>
          <span class="stat">
            <span class="stat-value">${stats.ssg}</span>
            <span class="stat-label">SSG</span>
          </span>
          <span class="stat">
            <span class="stat-value">${stats.api}</span>
            <span class="stat-label">API</span>
          </span>
        </div>
      </div>

      <div class="routes-filter">
        <input type="text"
               id="route-search"
               placeholder="Search routes..."
               class="search-input">
        <div class="filter-buttons">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="ssr">SSR</button>
          <button class="filter-btn" data-filter="ssg">SSG</button>
          <button class="filter-btn" data-filter="api">API</button>
        </div>
      </div>

      <div class="routes-table">
        <div class="routes-table-header">
          <span>Path</span>
          <span>Mode</span>
          <span>Features</span>
          <span>Timing</span>
        </div>
        <div class="routes-table-body">
          ${routeRows}
        </div>
      </div>
    </div>

    <script>
      (function() {
        const searchInput = document.getElementById('route-search');
        const rows = document.querySelectorAll('.route-row');
        const filterBtns = document.querySelectorAll('.filter-btn');

        searchInput.addEventListener('input', filterRoutes);
        filterBtns.forEach(btn => btn.addEventListener('click', handleFilterClick));

        function filterRoutes() {
          const query = searchInput.value.toLowerCase();
          const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;

          rows.forEach(row => {
            const path = row.dataset.path.toLowerCase();
            const mode = row.dataset.mode;
            const matchesSearch = path.includes(query);
            const matchesFilter = activeFilter === 'all' || mode === activeFilter;

            row.style.display = matchesSearch && matchesFilter ? 'grid' : 'none';
          });
        }

        function handleFilterClick(e) {
          filterBtns.forEach(btn => btn.classList.remove('active'));
          e.target.classList.add('active');
          filterRoutes();
        }
      })();
    </script>
  `;
}

/**
 * Generate HTML for a single route row.
 */
function generateRouteRow(route: RouteVisualization): string {
  const modeClass = `mode-${route.renderMode}`;
  const features = [];

  if (route.hasLoader) features.push('loader');
  if (route.hasAction) features.push('action');
  if (route.islandCount > 0) features.push(`${route.islandCount} islands`);
  if (route.authRequired) features.push('auth');
  if (route.middleware.length > 0) features.push(`${route.middleware.length} middleware`);

  return `
    <div class="route-row"
         data-path="${escapeHtml(route.path)}"
         data-mode="${route.renderMode}">
      <div class="route-path-cell">
        <span class="route-path">${escapeHtml(route.path)}</span>
        <span class="route-file">${escapeHtml(route.file)}</span>
      </div>
      <div class="route-mode-cell">
        <span class="mode-badge ${modeClass}">${route.renderMode.toUpperCase()}</span>
      </div>
      <div class="route-features-cell">
        ${features.map((f) => `<span class="feature-tag">${f}</span>`).join('')}
      </div>
      <div class="route-timing-cell">
        ${route.lastTiming ? `<span class="timing">${route.lastTiming.toFixed(0)}ms</span>` : '<span class="timing-na">-</span>'}
      </div>
    </div>
  `;
}

/**
 * Calculate route statistics.
 */
function calculateRouteStats(routes: RouteVisualization[]): {
  total: number;
  ssr: number;
  ssg: number;
  api: number;
  csr: number;
  rsc: number;
} {
  return {
    total: routes.length,
    ssr: routes.filter((r) => r.renderMode === 'ssr').length,
    ssg: routes.filter((r) => r.renderMode === 'ssg').length,
    api: routes.filter((r) => r.renderMode === 'api').length,
    csr: routes.filter((r) => r.renderMode === 'csr').length,
    rsc: routes.filter((r) => r.renderMode === 'rsc').length,
  };
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * CSS styles for the Routes tab.
 */
export const ROUTES_TAB_STYLES = `
  .routes-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 1.5rem;
    border-radius: 12px;
  }

  .routes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #334155;
  }

  .routes-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .route-stats {
    display: flex;
    gap: 1.5rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #3b82f6;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
  }

  .routes-filter {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .search-input {
    flex: 1;
    padding: 0.5rem 1rem;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #e2e8f0;
    font-size: 0.875rem;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .filter-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .filter-btn {
    padding: 0.5rem 1rem;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .filter-btn:hover {
    border-color: #3b82f6;
  }

  .filter-btn.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .routes-table {
    background: #1e293b;
    border-radius: 8px;
    overflow: hidden;
  }

  .routes-table-header {
    display: grid;
    grid-template-columns: 2fr 100px 1fr 80px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #0f172a;
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .route-row {
    display: grid;
    grid-template-columns: 2fr 100px 1fr 80px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #0f172a;
    transition: background 0.2s;
  }

  .route-row:hover {
    background: #334155;
  }

  .route-path-cell {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .route-path {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    color: #f8fafc;
  }

  .route-file {
    font-size: 0.75rem;
    color: #64748b;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
  }

  .mode-ssr { background: #3b82f6; color: white; }
  .mode-ssg { background: #10b981; color: white; }
  .mode-csr { background: #f59e0b; color: white; }
  .mode-api { background: #8b5cf6; color: white; }
  .mode-rsc { background: #ec4899; color: white; }

  .route-features-cell {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .feature-tag {
    padding: 0.125rem 0.375rem;
    background: #334155;
    border-radius: 4px;
    font-size: 0.625rem;
    color: #94a3b8;
  }

  .route-timing-cell {
    text-align: right;
  }

  .timing {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    color: #10b981;
  }

  .timing-na {
    color: #475569;
  }
`;

/**
 * React component placeholder.
 */
export function RoutesTab({ routes }: { routes: RouteVisualization[] }) {
  return null;
}
