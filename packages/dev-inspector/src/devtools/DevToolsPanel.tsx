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
        <button class="nav-btn" data-tab="traces">Traces</button>
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

      <div class="tab-panel" id="traces-panel">
        ${generateTracesTabHTML()}
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
 * Generate HTML for the Traces tab.
 * Loads trace data from /__devtools/api/traces and renders an interactive waterfall.
 */
function generateTracesTabHTML(): string {
  return `
    <div class="traces-container" id="traces-root">
      <div class="traces-header">
        <h3>Request Traces</h3>
        <button class="traces-refresh" onclick="window.__EREO_DEVTOOLS_TRACES__.refresh()">Refresh</button>
      </div>
      <div class="traces-layout">
        <div class="traces-list" id="traces-list">
          <div class="no-events">
            <span class="no-events-icon">🔍</span>
            <span class="no-events-text">Loading traces...</span>
          </div>
        </div>
        <div class="traces-detail" id="traces-detail">
          <div class="no-events">
            <span class="no-events-text">Select a trace to view its waterfall</span>
          </div>
        </div>
      </div>
    </div>
    <script>
    (function() {
      const TRACES_API = '/__devtools/api/traces';
      let traces = [];
      let selectedId = null;

      function durClass(ms) { return ms < 50 ? 'dur-fast' : ms < 200 ? 'dur-medium' : 'dur-slow'; }
      function statusClass(c) { return c < 300 ? 'status-ok' : c < 400 ? 'status-redirect' : 'status-error'; }
      function fmtDur(ms) { return ms < 1 ? (ms*1000).toFixed(0)+'us' : ms < 1000 ? ms.toFixed(1)+'ms' : (ms/1000).toFixed(2)+'s'; }

      function renderList() {
        const el = document.getElementById('traces-list');
        if (!traces.length) { el.innerHTML = '<div class="no-events"><span class="no-events-icon">🔍</span><span class="no-events-text">No traces yet</span><span class="no-events-hint">Make requests to your app to see traces</span></div>'; return; }
        el.innerHTML = traces.map(t => {
          const s = t.metadata.statusCode || 200;
          return '<div class="trace-row'+(t.id===selectedId?' active':'')+'" data-id="'+t.id+'">' +
            '<span class="trace-method">'+(t.metadata.method||'GET')+'</span>' +
            '<span class="trace-path">'+(t.metadata.pathname||'/')+'</span>' +
            '<span class="trace-status '+statusClass(s)+'">'+s+'</span>' +
            '<span class="trace-dur '+durClass(t.duration)+'">'+fmtDur(t.duration)+'</span></div>';
        }).join('');
        el.querySelectorAll('.trace-row').forEach(r => { r.onclick = () => { selectedId = r.dataset.id; renderList(); renderDetail(); }; });
      }

      function renderDetail() {
        const el = document.getElementById('traces-detail');
        const t = traces.find(x => x.id === selectedId);
        if (!t) { el.innerHTML = '<div class="no-events"><span class="no-events-text">Select a trace</span></div>'; return; }
        const spans = Object.values(t.spans);
        const root = spans.find(s => s.id === t.rootSpanId);
        if (!root) return;
        const flat = []; const minT = t.startTime; const dur = t.duration || 1;
        function walk(s, d) { flat.push({...s, depth: d}); spans.filter(c => c.parentId === s.id && c.id !== s.id).sort((a,b)=>a.startTime-b.startTime).forEach(c => walk(c, d+1)); }
        walk(root, 0);
        el.innerHTML = '<div class="waterfall">' + flat.map(s => {
          const l = ((s.startTime-minT)/dur*100).toFixed(2);
          const w = Math.max(0.5, s.duration/dur*100).toFixed(2);
          return '<div class="wf-row"><div class="wf-name" style="padding-left:'+(s.depth*12)+'px">'+s.name+'</div>' +
            '<div class="wf-bar-bg"><div class="wf-bar layer-'+s.layer+'" style="left:'+l+'%;width:'+w+'%"></div></div>' +
            '<div class="wf-dur '+durClass(s.duration)+'">'+fmtDur(s.duration)+'</div></div>';
        }).join('') + '</div>';
      }

      async function load() {
        try {
          const res = await fetch(TRACES_API);
          const data = await res.json();
          traces = (data.traces || []).reverse();
          renderList();
          if (selectedId) renderDetail();
        } catch {}
      }

      window.__EREO_DEVTOOLS_TRACES__ = { refresh: load };
      load();

      // Live updates via WebSocket
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(proto + '//' + location.host + '/__ereo/trace-ws');
        ws.onmessage = (e) => { try { const d = JSON.parse(e.data); if (d.type === 'trace:end') { traces.unshift(d.trace); renderList(); } } catch {} };
      } catch {}
    })();
    </script>
    <style>
      .traces-container { height: 100%; display: flex; flex-direction: column; }
      .traces-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #2a2f3a; }
      .traces-header h3 { font-size: 13px; color: #e2e8f0; }
      .traces-refresh { background: #2563eb; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; }
      .traces-layout { display: flex; flex: 1; overflow: hidden; }
      .traces-list { width: 320px; border-right: 1px solid #2a2f3a; overflow-y: auto; }
      .traces-detail { flex: 1; overflow-y: auto; padding: 8px; }
      .trace-row { display: flex; align-items: center; padding: 6px 10px; font-size: 12px; cursor: pointer; border-bottom: 1px solid #1e2330; gap: 6px; }
      .trace-row:hover { background: #1e293b; }
      .trace-row.active { background: #1e3a5f; border-left: 2px solid #3b82f6; }
      .trace-method { font-weight: 600; width: 40px; color: #93c5fd; }
      .trace-path { flex: 1; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .trace-status { width: 30px; text-align: center; }
      .trace-dur { width: 55px; text-align: right; font-size: 11px; }
      .status-ok { color: #4ade80; }
      .status-redirect { color: #60a5fa; }
      .status-error { color: #f87171; }
      .dur-fast { color: #4ade80; }
      .dur-medium { color: #facc15; }
      .dur-slow { color: #f87171; }
      .waterfall { padding: 4px 0; }
      .wf-row { display: flex; align-items: center; padding: 3px 6px; font-size: 11px; }
      .wf-row:hover { background: #1e293b; }
      .wf-name { width: 160px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #cbd5e1; }
      .wf-bar-bg { flex: 1; height: 14px; position: relative; margin: 0 8px; background: #1e2330; border-radius: 2px; }
      .wf-bar { position: absolute; height: 10px; top: 2px; border-radius: 2px; min-width: 2px; }
      .wf-dur { width: 50px; text-align: right; flex-shrink: 0; font-size: 10px; }
      .layer-request { background: #64748b; }
      .layer-routing { background: #60a5fa; }
      .layer-data { background: #3b82f6; }
      .layer-database { background: #a78bfa; }
      .layer-auth { background: #facc15; }
      .layer-rpc { background: #60a5fa; }
      .layer-forms { background: #4ade80; }
      .layer-islands { background: #a78bfa; }
      .layer-build { background: #3b82f6; }
      .layer-errors { background: #f87171; }
      .layer-signals { background: #4ade80; }
      .layer-custom { background: #64748b; }
    </style>
  `;
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
