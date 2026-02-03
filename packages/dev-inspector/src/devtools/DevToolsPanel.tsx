/**
 * @ereo/dev-inspector - DevTools Panel
 *
 * Main DevTools panel combining all tabs.
 */

import { DATA_PIPELINE_STYLES, generateDataPipelineHTML } from './DataPipelineTab';
import { ROUTES_TAB_STYLES, generateRoutesTabHTML } from './RoutesTab';
import { ISLANDS_TAB_STYLES, generateIslandsTabHTML } from './IslandsTab';
import { CACHE_TAB_STYLES, generateCacheTabHTML } from './CacheTab';
import type {
  DataPipelineVisualization,
  RouteVisualization,
  IslandVisualization,
  CacheVisualization,
  HMREvent,
} from './types';

/**
 * DevTools panel data.
 */
export interface DevToolsPanelData {
  pipeline?: DataPipelineVisualization;
  routes: RouteVisualization[];
  islands: IslandVisualization[];
  cache: CacheVisualization;
  hmrEvents: HMREvent[];
}

/**
 * Generate the complete DevTools panel HTML.
 */
export function generateDevToolsPanelHTML(data: DevToolsPanelData): string {
  const { pipeline, routes, islands, cache, hmrEvents } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EreoJS DevTools</title>
  <style>
    ${DEVTOOLS_BASE_STYLES}
    ${DATA_PIPELINE_STYLES}
    ${ROUTES_TAB_STYLES}
    ${ISLANDS_TAB_STYLES}
    ${CACHE_TAB_STYLES}
  </style>
</head>
<body>
  <div class="devtools-container">
    <header class="devtools-header">
      <div class="logo">
        <span class="logo-icon">⬡</span>
        <span class="logo-text">EreoJS DevTools</span>
      </div>
      <nav class="devtools-nav">
        <button class="nav-btn active" data-tab="data">Data Pipeline</button>
        <button class="nav-btn" data-tab="routes">Routes</button>
        <button class="nav-btn" data-tab="islands">Islands</button>
        <button class="nav-btn" data-tab="cache">Cache</button>
        <button class="nav-btn" data-tab="hmr">HMR</button>
      </nav>
      <div class="devtools-actions">
        <button class="action-icon" onclick="window.__EREO_DEVTOOLS__.refresh()" title="Refresh">
          🔄
        </button>
        <button class="action-icon" onclick="window.__EREO_DEVTOOLS__.togglePosition()" title="Toggle Position">
          📐
        </button>
        <button class="action-icon" onclick="window.__EREO_DEVTOOLS__.close()" title="Close">
          ✕
        </button>
      </div>
    </header>

    <main class="devtools-content">
      <div class="tab-panel active" id="data-panel">
        ${pipeline ? generateDataPipelineHTML(pipeline) : `
          <div class="no-data">
            <span class="no-data-icon">📊</span>
            <span class="no-data-text">No data pipeline metrics yet</span>
            <span class="no-data-hint">Navigate to a route with loaders to see the pipeline visualization</span>
          </div>
        `}
      </div>

      <div class="tab-panel" id="routes-panel">
        ${generateRoutesTabHTML(routes)}
      </div>

      <div class="tab-panel" id="islands-panel">
        ${generateIslandsTabHTML(islands)}
      </div>

      <div class="tab-panel" id="cache-panel">
        ${generateCacheTabHTML(cache)}
      </div>

      <div class="tab-panel" id="hmr-panel">
        ${generateHMRTabHTML(hmrEvents)}
      </div>
    </main>
  </div>

  <script>
    ${DEVTOOLS_CLIENT_SCRIPT}
  </script>
</body>
</html>
  `;
}

/**
 * Generate HTML for the HMR events tab.
 */
function generateHMRTabHTML(events: HMREvent[]): string {
  if (events.length === 0) {
    return `
      <div class="hmr-container">
        <div class="hmr-header">
          <h3>HMR Events</h3>
          <div class="hmr-status">
            <span class="status-dot connected"></span>
            <span>Connected</span>
          </div>
        </div>
        <div class="no-events">
          <span class="no-events-icon">⚡</span>
          <span class="no-events-text">No HMR events yet</span>
          <span class="no-events-hint">Make changes to your code to see HMR updates</span>
        </div>
      </div>
    `;
  }

  const eventRows = events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 50)
    .map((event) => `
      <div class="hmr-event hmr-${event.type}">
        <span class="event-icon">${getEventIcon(event.type)}</span>
        <span class="event-type">${event.type}</span>
        <span class="event-path">${escapeHtml(event.path)}</span>
        ${event.reason ? `<span class="event-reason">${escapeHtml(event.reason)}</span>` : ''}
        ${event.duration ? `<span class="event-duration">${event.duration.toFixed(0)}ms</span>` : ''}
        <span class="event-time">${formatTime(event.timestamp)}</span>
      </div>
    `)
    .join('\n');

  return `
    <div class="hmr-container">
      <div class="hmr-header">
        <h3>HMR Events</h3>
        <div class="hmr-status">
          <span class="status-dot connected"></span>
          <span>Connected</span>
        </div>
      </div>
      <div class="hmr-events-list">
        ${eventRows}
      </div>
    </div>
  `;
}

/**
 * Get icon for HMR event type.
 */
function getEventIcon(type: string): string {
  switch (type) {
    case 'full-reload': return '🔄';
    case 'css-update': return '🎨';
    case 'island-update': return '🏝️';
    case 'loader-update': return '📦';
    case 'component-update': return '⚛️';
    default: return '⚡';
  }
}

/**
 * Format timestamp.
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

/**
 * Escape HTML.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Base CSS styles for DevTools.
 */
const DEVTOOLS_BASE_STYLES = `
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    overflow: hidden;
  }

  .devtools-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .devtools-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #1e293b;
    border-bottom: 1px solid #334155;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  .logo-icon {
    color: #3b82f6;
    font-size: 1.25rem;
  }

  .devtools-nav {
    display: flex;
    gap: 0.25rem;
    flex: 1;
  }

  .nav-btn {
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .nav-btn:hover {
    color: #f8fafc;
    background: #334155;
  }

  .nav-btn.active {
    color: #3b82f6;
    background: rgba(59, 130, 246, 0.1);
  }

  .devtools-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  .action-icon:hover {
    background: #334155;
  }

  .devtools-content {
    flex: 1;
    overflow: auto;
    padding: 1rem;
  }

  .tab-panel {
    display: none;
  }

  .tab-panel.active {
    display: block;
  }

  .no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 300px;
    color: #64748b;
  }

  .no-data-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .no-data-text {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }

  .no-data-hint {
    font-size: 0.875rem;
    color: #475569;
  }

  /* HMR Tab Styles */
  .hmr-container {
    background: #0f172a;
    padding: 1.5rem;
    border-radius: 12px;
  }

  .hmr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #334155;
  }

  .hmr-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .hmr-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #94a3b8;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #64748b;
  }

  .status-dot.connected {
    background: #10b981;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
  }

  .hmr-events-list {
    background: #1e293b;
    border-radius: 8px;
    overflow: hidden;
  }

  .hmr-event {
    display: grid;
    grid-template-columns: 30px 120px 1fr auto auto;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #0f172a;
    align-items: center;
    font-size: 0.875rem;
  }

  .hmr-event:hover {
    background: #334155;
  }

  .hmr-full-reload { border-left: 3px solid #f59e0b; }
  .hmr-css-update { border-left: 3px solid #10b981; }
  .hmr-island-update { border-left: 3px solid #3b82f6; }
  .hmr-loader-update { border-left: 3px solid #8b5cf6; }
  .hmr-component-update { border-left: 3px solid #ec4899; }

  .event-icon {
    font-size: 1rem;
  }

  .event-type {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .event-path {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    color: #f8fafc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-reason {
    font-size: 0.75rem;
    color: #64748b;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-duration {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    color: #10b981;
  }

  .event-time {
    font-size: 0.75rem;
    color: #475569;
  }

  .no-events {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    color: #64748b;
  }

  .no-events-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .no-events-hint {
    font-size: 0.75rem;
    color: #475569;
    margin-top: 0.5rem;
  }
`;

/**
 * Client-side JavaScript for DevTools interactivity.
 */
const DEVTOOLS_CLIENT_SCRIPT = `
  (function() {
    // Tab switching
    const navBtns = document.querySelectorAll('.nav-btn');
    const panels = document.querySelectorAll('.tab-panel');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const tabId = btn.dataset.tab + '-panel';
        document.getElementById(tabId).classList.add('active');
      });
    });

    // DevTools API
    window.__EREO_DEVTOOLS__ = {
      refresh() {
        location.reload();
      },
      togglePosition() {
        // Send message to parent to toggle position
        window.parent?.postMessage({ type: 'ereo-devtools-toggle-position' }, '*');
      },
      close() {
        window.parent?.postMessage({ type: 'ereo-devtools-close' }, '*');
      },
      highlightIslands() {
        window.parent?.postMessage({ type: 'ereo-devtools-highlight-islands' }, '*');
      },
      hydrateAll() {
        window.parent?.postMessage({ type: 'ereo-devtools-hydrate-all' }, '*');
      },
      scrollToIsland(id) {
        window.parent?.postMessage({ type: 'ereo-devtools-scroll-to-island', id }, '*');
      },
      inspectIsland(id) {
        window.parent?.postMessage({ type: 'ereo-devtools-inspect-island', id }, '*');
      },
      inspectEntry(key) {
        window.parent?.postMessage({ type: 'ereo-devtools-inspect-entry', key }, '*');
      },
      clearCache() {
        window.parent?.postMessage({ type: 'ereo-devtools-clear-cache' }, '*');
      },
      refreshCache() {
        window.parent?.postMessage({ type: 'ereo-devtools-refresh-cache' }, '*');
      },
      invalidateKey(key) {
        window.parent?.postMessage({ type: 'ereo-devtools-invalidate-key', key }, '*');
      },
      invalidateTag(tag) {
        window.parent?.postMessage({ type: 'ereo-devtools-invalidate-tag', tag }, '*');
      },
    };

    // Listen for updates from parent
    window.addEventListener('message', (event) => {
      if (event.data.type === 'ereo-devtools-update') {
        // Handle live updates
        console.log('[DevTools] Received update:', event.data);
      }
    });
  })();
`;

/**
 * React component placeholder.
 */
export function DevToolsPanel({ data }: { data: DevToolsPanelData }) {
  return null;
}
