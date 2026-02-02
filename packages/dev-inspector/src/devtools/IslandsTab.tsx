/**
 * @oreo/dev-inspector - Islands Tab
 *
 * Visualize island components with hydration status and strategies.
 */

import type { IslandVisualization } from './types';

/**
 * Generate HTML for the Islands tab.
 */
export function generateIslandsTabHTML(islands: IslandVisualization[]): string {
  const stats = calculateIslandStats(islands);

  const islandRows = islands
    .sort((a, b) => a.component.localeCompare(b.component))
    .map((island) => generateIslandRow(island))
    .join('\n');

  return `
    <div class="islands-container">
      <div class="islands-header">
        <h3>Islands</h3>
        <div class="islands-stats">
          <span class="stat">
            <span class="stat-value">${stats.total}</span>
            <span class="stat-label">Total</span>
          </span>
          <span class="stat">
            <span class="stat-value">${stats.hydrated}</span>
            <span class="stat-label">Hydrated</span>
          </span>
          <span class="stat">
            <span class="stat-value">${stats.pending}</span>
            <span class="stat-label">Pending</span>
          </span>
        </div>
      </div>

      <div class="hydration-strategies">
        <div class="strategy-card">
          <div class="strategy-icon">⚡</div>
          <div class="strategy-info">
            <span class="strategy-name">load</span>
            <span class="strategy-count">${stats.byStrategy.load || 0}</span>
          </div>
        </div>
        <div class="strategy-card">
          <div class="strategy-icon">😴</div>
          <div class="strategy-info">
            <span class="strategy-name">idle</span>
            <span class="strategy-count">${stats.byStrategy.idle || 0}</span>
          </div>
        </div>
        <div class="strategy-card">
          <div class="strategy-icon">👁️</div>
          <div class="strategy-info">
            <span class="strategy-name">visible</span>
            <span class="strategy-count">${stats.byStrategy.visible || 0}</span>
          </div>
        </div>
        <div class="strategy-card">
          <div class="strategy-icon">📱</div>
          <div class="strategy-info">
            <span class="strategy-name">media</span>
            <span class="strategy-count">${stats.byStrategy.media || 0}</span>
          </div>
        </div>
      </div>

      ${islands.length > 0 ? `
        <div class="islands-list">
          ${islandRows}
        </div>
      ` : `
        <div class="no-islands">
          <span class="no-islands-icon">🏝️</span>
          <span class="no-islands-text">No islands on this page</span>
        </div>
      `}

      <div class="islands-actions">
        <button class="action-btn" onclick="window.__OREO_DEVTOOLS__.highlightIslands()">
          Highlight Islands
        </button>
        <button class="action-btn" onclick="window.__OREO_DEVTOOLS__.hydrateAll()">
          Force Hydrate All
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a single island row.
 */
function generateIslandRow(island: IslandVisualization): string {
  const statusClass = island.hydrated ? 'hydrated' : 'pending';
  const statusIcon = island.hydrated ? '✅' : '⏳';

  return `
    <div class="island-row ${statusClass}" data-island-id="${escapeHtml(island.id)}">
      <div class="island-main">
        <div class="island-status">${statusIcon}</div>
        <div class="island-info">
          <span class="island-component">${escapeHtml(island.component)}</span>
          <span class="island-selector">${escapeHtml(island.selector)}</span>
        </div>
      </div>
      <div class="island-strategy">
        <span class="strategy-badge strategy-${island.strategy}">
          ${getStrategyIcon(island.strategy)} ${island.strategy}
        </span>
        ${island.mediaQuery ? `<span class="media-query">${escapeHtml(island.mediaQuery)}</span>` : ''}
      </div>
      <div class="island-metrics">
        ${island.hydrationTime !== undefined ? `
          <span class="hydration-time">${island.hydrationTime.toFixed(0)}ms</span>
        ` : ''}
        <span class="props-size">${formatBytes(island.propsSize)}</span>
      </div>
      <div class="island-actions">
        <button class="island-action" onclick="window.__OREO_DEVTOOLS__.inspectIsland('${island.id}')" title="Inspect">
          🔍
        </button>
        <button class="island-action" onclick="window.__OREO_DEVTOOLS__.scrollToIsland('${island.id}')" title="Scroll to">
          📍
        </button>
      </div>
    </div>
  `;
}

/**
 * Get icon for hydration strategy.
 */
function getStrategyIcon(strategy: string): string {
  switch (strategy) {
    case 'load': return '⚡';
    case 'idle': return '😴';
    case 'visible': return '👁️';
    case 'media': return '📱';
    case 'none': return '🚫';
    default: return '❓';
  }
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Calculate island statistics.
 */
function calculateIslandStats(islands: IslandVisualization[]): {
  total: number;
  hydrated: number;
  pending: number;
  byStrategy: Record<string, number>;
} {
  const byStrategy: Record<string, number> = {};

  for (const island of islands) {
    byStrategy[island.strategy] = (byStrategy[island.strategy] || 0) + 1;
  }

  return {
    total: islands.length,
    hydrated: islands.filter((i) => i.hydrated).length,
    pending: islands.filter((i) => !i.hydrated).length,
    byStrategy,
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
 * CSS styles for the Islands tab.
 */
export const ISLANDS_TAB_STYLES = `
  .islands-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 1.5rem;
    border-radius: 12px;
  }

  .islands-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #334155;
  }

  .islands-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .islands-stats {
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

  .hydration-strategies {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .strategy-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #1e293b;
    border-radius: 8px;
  }

  .strategy-icon {
    font-size: 1.5rem;
  }

  .strategy-info {
    display: flex;
    flex-direction: column;
  }

  .strategy-name {
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .strategy-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .islands-list {
    background: #1e293b;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .island-row {
    display: grid;
    grid-template-columns: 1fr 150px 100px 70px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #0f172a;
    align-items: center;
  }

  .island-row:hover {
    background: #334155;
  }

  .island-row.pending {
    opacity: 0.7;
  }

  .island-main {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .island-status {
    font-size: 1rem;
  }

  .island-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .island-component {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    color: #f8fafc;
  }

  .island-selector {
    font-size: 0.75rem;
    color: #64748b;
  }

  .strategy-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .strategy-load { background: #3b82f6; color: white; }
  .strategy-idle { background: #6366f1; color: white; }
  .strategy-visible { background: #10b981; color: white; }
  .strategy-media { background: #f59e0b; color: white; }
  .strategy-none { background: #64748b; color: white; }

  .media-query {
    font-size: 0.625rem;
    color: #94a3b8;
    display: block;
    margin-top: 0.25rem;
  }

  .island-metrics {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: right;
  }

  .hydration-time {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    color: #10b981;
  }

  .props-size {
    font-size: 0.75rem;
    color: #64748b;
  }

  .island-actions {
    display: flex;
    gap: 0.25rem;
  }

  .island-action {
    padding: 0.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .island-action:hover {
    background: #334155;
  }

  .no-islands {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    color: #64748b;
  }

  .no-islands-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .islands-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .action-btn {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .action-btn:hover {
    background: #2563eb;
  }
`;

/**
 * React component placeholder.
 */
export function IslandsTab({ islands }: { islands: IslandVisualization[] }) {
  return null;
}
