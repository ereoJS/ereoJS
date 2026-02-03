/**
 * @ereo/bundler - Hot Module Replacement
 *
 * Sub-100ms HMR for rapid development with granular JS updates.
 */

import type { Server, ServerWebSocket } from 'bun';

/**
 * HMR update types.
 */
export type HMRUpdateType =
  | 'full-reload'
  | 'css-update'
  | 'js-update'
  | 'island-update'
  | 'loader-update'
  | 'component-update'
  | 'error';

/**
 * HMR update message.
 */
export interface HMRUpdate {
  type: HMRUpdateType;
  path?: string;
  timestamp: number;
  error?: {
    message: string;
    stack?: string;
  };
  /** For granular JS updates */
  module?: {
    id: string;
    exports?: string[];
    isIsland?: boolean;
    isLoader?: boolean;
    isAction?: boolean;
    isComponent?: boolean;
  };
  /** Explanation for why this update type was chosen */
  reason?: string;
}

/**
 * Module dependency graph for granular HMR.
 */
export interface ModuleDependencyGraph {
  /** Module ID -> list of modules that depend on it */
  dependents: Map<string, Set<string>>;
  /** Module ID -> list of modules it imports */
  dependencies: Map<string, Set<string>>;
  /** Module ID -> export names */
  exports: Map<string, Set<string>>;
  /** Module ID -> whether it's an island component */
  islands: Set<string>;
  /** Module ID -> whether it's a route module */
  routes: Set<string>;
}

/**
 * HMR client code injected into the page.
 * Supports granular JS updates for islands and components.
 */
export const HMR_CLIENT_CODE = `
(function() {
  const ws = new WebSocket('ws://' + location.host + '/__hmr');

  // Module registry for hot updates
  window.__EREO_HMR__ = window.__EREO_HMR__ || {
    modules: new Map(),
    islands: new Map(),
    acceptedModules: new Set(),
  };

  ws.onmessage = function(event) {
    const update = JSON.parse(event.data);
    const startTime = performance.now();

    // Log with timing info
    const logUpdate = (msg) => {
      const duration = (performance.now() - startTime).toFixed(1);
      console.log('[HMR] ' + msg + ' (' + duration + 'ms)');
    };

    switch (update.type) {
      case 'full-reload':
        logHMRReason(update);
        location.reload();
        break;

      case 'css-update':
        updateCSS(update.path);
        logUpdate('CSS updated: ' + update.path);
        break;

      case 'island-update':
        if (handleIslandUpdate(update)) {
          logUpdate('Island hot-updated: ' + (update.module?.id || update.path));
        } else {
          logHMRReason(update);
          location.reload();
        }
        break;

      case 'component-update':
        if (handleComponentUpdate(update)) {
          logUpdate('Component hot-updated: ' + (update.module?.id || update.path));
        } else {
          logHMRReason(update);
          location.reload();
        }
        break;

      case 'loader-update':
        // Loaders require data refetch, do soft reload
        logUpdate('Loader changed, refreshing data...');
        refreshLoaderData(update.path);
        break;

      case 'js-update':
        // Check if we can do granular update
        if (update.module?.isIsland && handleIslandUpdate(update)) {
          logUpdate('Island hot-updated: ' + (update.module?.id || update.path));
        } else if (update.module?.isComponent && handleComponentUpdate(update)) {
          logUpdate('Component hot-updated: ' + (update.module?.id || update.path));
        } else {
          logHMRReason(update);
          location.reload();
        }
        break;

      case 'error':
        showErrorOverlay(update.error);
        break;
    }
  };

  ws.onclose = function() {
    console.log('[HMR] Connection lost, attempting reconnect...');
    setTimeout(function() {
      location.reload();
    }, 1000);
  };

  function updateCSS(path) {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    for (const link of links) {
      if (link.href.includes(path)) {
        const newHref = link.href.split('?')[0] + '?t=' + Date.now();
        link.href = newHref;
      }
    }
  }

  function handleIslandUpdate(update) {
    const moduleId = update.module?.id || update.path;
    if (!moduleId) return false;

    // Find all island elements for this component
    const componentName = moduleId.split('/').pop()?.replace(/\\.[jt]sx?$/, '');
    if (!componentName) return false;

    const islands = document.querySelectorAll('[data-component="' + componentName + '"]');
    if (islands.length === 0) return false;

    // Fetch the updated module and re-hydrate islands
    return fetchAndRehydrate(moduleId, islands);
  }

  function handleComponentUpdate(update) {
    // For now, component updates trigger a soft reload
    // Future: implement React Fast Refresh integration
    return false;
  }

  function fetchAndRehydrate(moduleId, islands) {
    // Dynamic import with cache busting
    const importUrl = '/' + moduleId + '?t=' + Date.now();

    import(importUrl)
      .then(function(module) {
        const Component = module.default;
        if (!Component) return;

        // Re-render each island
        islands.forEach(function(element) {
          const propsJson = element.getAttribute('data-props');
          const props = propsJson ? JSON.parse(propsJson) : {};

          // Use React to re-render
          if (window.__EREO_REACT__) {
            const { createRoot } = window.__EREO_REACT_DOM__;
            const { createElement } = window.__EREO_REACT__;

            // Unmount existing
            const existingRoot = window.__EREO_HMR__.islands.get(element);
            if (existingRoot) {
              existingRoot.unmount();
            }

            // Create new root and render
            const root = createRoot(element);
            root.render(createElement(Component, props));
            window.__EREO_HMR__.islands.set(element, root);
          }
        });
      })
      .catch(function(err) {
        console.error('[HMR] Failed to hot-update island:', err);
        location.reload();
      });

    return true;
  }

  function refreshLoaderData(path) {
    // Fetch fresh loader data and update the page
    const routePath = path.replace(/\\/routes\\//, '/').replace(/\\.[jt]sx?$/, '');
    fetch('/__ereo/loader-data' + routePath + '?t=' + Date.now())
      .then(function(res) { return res.json(); })
      .then(function(data) {
        // Emit event for components to update
        window.dispatchEvent(new CustomEvent('ereo:loader-update', {
          detail: { path: routePath, data: data }
        }));
      })
      .catch(function() {
        location.reload();
      });
  }

  function logHMRReason(update) {
    if (update.reason) {
      console.log('[HMR] ' + update.reason);
    }
  }

  function showErrorOverlay(error) {
    if (!error) return;

    let overlay = document.getElementById('ereo-error-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ereo-error-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);color:#ff5555;padding:2rem;font-family:monospace;white-space:pre-wrap;overflow:auto;z-index:99999';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = '<h2 style="color:#ff5555;margin:0 0 1rem">Error</h2>' +
      '<p style="color:#fff">' + escapeHtml(error.message) + '</p>' +
      (error.stack ? '<pre style="color:#888;margin-top:1rem">' + escapeHtml(error.stack) + '</pre>' : '') +
      '<button onclick="this.parentElement.remove()" style="position:absolute;top:1rem;right:1rem;background:none;border:1px solid #666;color:#fff;padding:0.5rem 1rem;cursor:pointer">Close</button>';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Clear error overlay on successful update
  ws.addEventListener('message', function(event) {
    const update = JSON.parse(event.data);
    if (update.type !== 'error') {
      const overlay = document.getElementById('ereo-error-overlay');
      if (overlay) overlay.remove();
    }
  });
})();
`;

/**
 * HMR server for WebSocket connections.
 * Supports granular JS updates through module analysis.
 */
export class HMRServer {
  private clients = new Set<ServerWebSocket<unknown>>();
  private lastUpdate: HMRUpdate | null = null;
  private depGraph: ModuleDependencyGraph;
  private moduleAnalyzer: ModuleAnalyzer;

  constructor() {
    this.depGraph = {
      dependents: new Map(),
      dependencies: new Map(),
      exports: new Map(),
      islands: new Set(),
      routes: new Set(),
    };
    this.moduleAnalyzer = new ModuleAnalyzer();
  }

  /**
   * Handle new WebSocket connection.
   */
  handleConnection(ws: ServerWebSocket<unknown>): void {
    this.clients.add(ws);

    // Send last error if any
    if (this.lastUpdate?.type === 'error') {
      ws.send(JSON.stringify(this.lastUpdate));
    }
  }

  /**
   * Handle WebSocket close.
   */
  handleClose(ws: ServerWebSocket<unknown>): void {
    this.clients.delete(ws);
  }

  /**
   * Send update to all connected clients.
   */
  send(update: HMRUpdate): void {
    this.lastUpdate = update;
    const message = JSON.stringify(update);

    for (const client of this.clients) {
      try {
        client.send(message);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Trigger a full reload.
   */
  reload(reason?: string): void {
    this.send({
      type: 'full-reload',
      timestamp: Date.now(),
      reason: reason || 'Full reload triggered',
    });
  }

  /**
   * Notify of a CSS update.
   */
  cssUpdate(path: string): void {
    this.send({
      type: 'css-update',
      path,
      timestamp: Date.now(),
    });
  }

  /**
   * Notify of a JS update with granular analysis.
   */
  async jsUpdate(path: string): Promise<void> {
    const analysis = await this.moduleAnalyzer.analyze(path);

    // Determine update type based on analysis
    if (analysis.isIsland) {
      this.send({
        type: 'island-update',
        path,
        timestamp: Date.now(),
        module: {
          id: path,
          exports: analysis.exports,
          isIsland: true,
        },
        reason: `Island component changed: ${path}`,
      });
      return;
    }

    if (analysis.isLoader && !analysis.isComponent) {
      this.send({
        type: 'loader-update',
        path,
        timestamp: Date.now(),
        module: {
          id: path,
          exports: analysis.exports,
          isLoader: true,
        },
        reason: `Loader changed: ${path}`,
      });
      return;
    }

    if (analysis.isComponent && !analysis.hasNonComponentExports) {
      this.send({
        type: 'component-update',
        path,
        timestamp: Date.now(),
        module: {
          id: path,
          exports: analysis.exports,
          isComponent: true,
        },
        reason: `Component changed: ${path}`,
      });
      return;
    }

    // Fall back to full reload with explanation
    this.send({
      type: 'js-update',
      path,
      timestamp: Date.now(),
      module: {
        id: path,
        exports: analysis.exports,
        isIsland: analysis.isIsland,
        isLoader: analysis.isLoader,
        isAction: analysis.isAction,
        isComponent: analysis.isComponent,
      },
      reason: this.getReloadReason(path, analysis),
    });
  }

  /**
   * Get human-readable reason for full reload.
   */
  private getReloadReason(path: string, analysis: ModuleAnalysis): string {
    const reasons: string[] = [];

    if (analysis.hasNonComponentExports) {
      reasons.push(`exports changed (${analysis.exports.join(', ')})`);
    }

    if (analysis.isLoader && analysis.isComponent) {
      reasons.push('mixed loader and component in same file');
    }

    if (path.includes('_layout') || path.includes('_error')) {
      reasons.push('layout/error boundary changed');
    }

    if (reasons.length === 0) {
      reasons.push('module structure changed');
    }

    return `Full reload: ${path} - ${reasons.join(', ')}`;
  }

  /**
   * Register a module in the dependency graph.
   */
  registerModule(moduleId: string, info: {
    dependencies?: string[];
    exports?: string[];
    isIsland?: boolean;
    isRoute?: boolean;
  }): void {
    if (info.dependencies) {
      this.depGraph.dependencies.set(moduleId, new Set(info.dependencies));

      // Update dependents
      for (const dep of info.dependencies) {
        if (!this.depGraph.dependents.has(dep)) {
          this.depGraph.dependents.set(dep, new Set());
        }
        this.depGraph.dependents.get(dep)!.add(moduleId);
      }
    }

    if (info.exports) {
      this.depGraph.exports.set(moduleId, new Set(info.exports));
    }

    if (info.isIsland) {
      this.depGraph.islands.add(moduleId);
    }

    if (info.isRoute) {
      this.depGraph.routes.add(moduleId);
    }
  }

  /**
   * Check if a module can be hot-updated without full reload.
   */
  canHotUpdate(moduleId: string): boolean {
    // Islands can always be hot-updated
    if (this.depGraph.islands.has(moduleId)) {
      return true;
    }

    // Check if any dependent is a route (requires full reload)
    const dependents = this.depGraph.dependents.get(moduleId);
    if (dependents) {
      for (const dep of dependents) {
        if (this.depGraph.routes.has(dep)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Send error to clients.
   */
  error(message: string, stack?: string): void {
    this.send({
      type: 'error',
      timestamp: Date.now(),
      error: { message, stack },
    });
  }

  /**
   * Clear error state.
   */
  clearError(): void {
    if (this.lastUpdate?.type === 'error') {
      this.lastUpdate = null;
    }
  }

  /**
   * Get number of connected clients.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get the dependency graph (for debugging).
   */
  getDependencyGraph(): ModuleDependencyGraph {
    return this.depGraph;
  }
}

/**
 * Module analysis result.
 */
interface ModuleAnalysis {
  exports: string[];
  isIsland: boolean;
  isComponent: boolean;
  isLoader: boolean;
  isAction: boolean;
  hasNonComponentExports: boolean;
}

/**
 * Analyzes modules to determine update strategy.
 */
class ModuleAnalyzer {
  private cache = new Map<string, { analysis: ModuleAnalysis; mtime: number }>();

  /**
   * Analyze a module file.
   */
  async analyze(filePath: string): Promise<ModuleAnalysis> {
    try {
      const file = Bun.file(filePath);
      const stat = await file.stat();
      const mtime = stat?.mtime?.getTime() || 0;

      // Check cache
      const cached = this.cache.get(filePath);
      if (cached && cached.mtime === mtime) {
        return cached.analysis;
      }

      const content = await file.text();
      const analysis = this.analyzeContent(content, filePath);

      this.cache.set(filePath, { analysis, mtime });
      return analysis;
    } catch {
      return {
        exports: [],
        isIsland: false,
        isComponent: false,
        isLoader: false,
        isAction: false,
        hasNonComponentExports: true,
      };
    }
  }

  /**
   * Analyze module content.
   */
  private analyzeContent(content: string, filePath: string): ModuleAnalysis {
    const exports: string[] = [];
    let isIsland = false;
    let isComponent = false;
    let isLoader = false;
    let isAction = false;

    // Check for island markers
    isIsland =
      content.includes('client:load') ||
      content.includes('client:idle') ||
      content.includes('client:visible') ||
      content.includes('client:media') ||
      content.includes('data-island') ||
      content.includes('createIsland(') ||
      filePath.includes('/islands/');

    // Check for loader export
    isLoader =
      content.includes('export const loader') ||
      content.includes('export async function loader') ||
      content.includes('export function loader');

    // Check for action export
    isAction =
      content.includes('export const action') ||
      content.includes('export async function action') ||
      content.includes('export function action');

    // Check for default component export
    isComponent =
      content.includes('export default function') ||
      content.includes('export default class') ||
      /export\s+default\s+\w+/.test(content);

    // Find all exports
    const exportMatches = content.matchAll(
      /export\s+(?:const|let|var|function|async\s+function|class)\s+(\w+)/g
    );
    for (const match of exportMatches) {
      exports.push(match[1]);
    }

    if (content.includes('export default')) {
      exports.push('default');
    }

    // Named exports
    const namedExportMatch = content.match(/export\s*{([^}]+)}/g);
    if (namedExportMatch) {
      for (const match of namedExportMatch) {
        const names = match.replace(/export\s*{/, '').replace('}', '').split(',');
        for (const name of names) {
          const cleanName = name.trim().split(' as ')[0].trim();
          if (cleanName) exports.push(cleanName);
        }
      }
    }

    // Determine if there are non-component exports
    const componentExports = new Set(['default', 'loader', 'action', 'meta', 'headers', 'config', 'handle', 'ErrorBoundary']);
    const hasNonComponentExports = exports.some((e) => !componentExports.has(e));

    return {
      exports,
      isIsland,
      isComponent,
      isLoader,
      isAction,
      hasNonComponentExports,
    };
  }

  /**
   * Clear the analysis cache.
   */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Create HMR server.
 */
export function createHMRServer(): HMRServer {
  return new HMRServer();
}

/**
 * Create WebSocket handler for HMR.
 */
export function createHMRWebSocket(hmr: HMRServer) {
  return {
    open(ws: ServerWebSocket<unknown>) {
      hmr.handleConnection(ws);
    },
    close(ws: ServerWebSocket<unknown>) {
      hmr.handleClose(ws);
    },
    message() {
      // No client messages expected
    },
  };
}

/**
 * File watcher for HMR with intelligent change detection.
 */
export class HMRWatcher {
  private hmr: HMRServer;
  private watching = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingChanges = new Set<string>();
  private watchDir: string = '';

  constructor(hmr: HMRServer) {
    this.hmr = hmr;
  }

  /**
   * Start watching a directory.
   */
  watch(dir: string): void {
    if (this.watching) return;
    this.watching = true;
    this.watchDir = dir;

    try {
      const { watch } = require('node:fs');

      watch(dir, { recursive: true }, (event: string, filename: string | null) => {
        if (!filename) return;

        // Skip hidden files and node_modules
        if (filename.startsWith('.') || filename.includes('node_modules')) return;

        // Add to pending changes
        this.pendingChanges.add(filename);

        // Debounce rapid changes
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          this.processPendingChanges();
        }, 50);
      });
    } catch (error) {
      console.warn('File watching not available:', error);
    }
  }

  /**
   * Process all pending changes as a batch.
   */
  private async processPendingChanges(): Promise<void> {
    const changes = Array.from(this.pendingChanges);
    this.pendingChanges.clear();

    // Categorize changes
    const cssChanges: string[] = [];
    const jsChanges: string[] = [];
    const configChanges: string[] = [];
    const otherChanges: string[] = [];

    for (const filename of changes) {
      const ext = filename.split('.').pop()?.toLowerCase();

      switch (ext) {
        case 'css':
        case 'scss':
        case 'less':
          cssChanges.push(filename);
          break;

        case 'ts':
        case 'tsx':
        case 'js':
        case 'jsx':
          if (filename.includes('.config.') || filename === 'ereo.config.ts') {
            configChanges.push(filename);
          } else {
            jsChanges.push(filename);
          }
          break;

        case 'json':
          if (filename === 'package.json' || filename === 'tsconfig.json') {
            configChanges.push(filename);
          } else {
            otherChanges.push(filename);
          }
          break;

        default:
          otherChanges.push(filename);
      }
    }

    // Handle config changes first (require full reload)
    if (configChanges.length > 0) {
      this.hmr.reload(`Config changed: ${configChanges.join(', ')}`);
      return;
    }

    // Handle CSS changes (can be granular)
    for (const css of cssChanges) {
      this.hmr.cssUpdate(css);
    }

    // Handle JS changes (analyze for granularity)
    for (const js of jsChanges) {
      const fullPath = `${this.watchDir}/${js}`;
      await this.hmr.jsUpdate(fullPath);
    }

    // Handle other changes
    if (otherChanges.length > 0 && cssChanges.length === 0 && jsChanges.length === 0) {
      this.hmr.reload(`Files changed: ${otherChanges.join(', ')}`);
    }
  }

  /**
   * Stop watching.
   */
  stop(): void {
    this.watching = false;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.pendingChanges.clear();
  }
}

/**
 * Create file watcher for HMR.
 */
export function createHMRWatcher(hmr: HMRServer): HMRWatcher {
  return new HMRWatcher(hmr);
}
