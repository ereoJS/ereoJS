/**
 * @oreo/bundler - Hot Module Replacement
 *
 * Sub-100ms HMR for rapid development.
 */

import type { Server, ServerWebSocket } from 'bun';

/**
 * HMR update types.
 */
export type HMRUpdateType = 'full-reload' | 'css-update' | 'js-update' | 'error';

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
}

/**
 * HMR client code injected into the page.
 */
export const HMR_CLIENT_CODE = `
(function() {
  const ws = new WebSocket('ws://' + location.host + '/__hmr');

  ws.onmessage = function(event) {
    const update = JSON.parse(event.data);
    console.log('[HMR]', update.type, update.path || '');

    switch (update.type) {
      case 'full-reload':
        location.reload();
        break;

      case 'css-update':
        updateCSS(update.path);
        break;

      case 'js-update':
        // For now, do full reload for JS changes
        location.reload();
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

  function showErrorOverlay(error) {
    if (!error) return;

    let overlay = document.getElementById('oreo-error-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'oreo-error-overlay';
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
      const overlay = document.getElementById('oreo-error-overlay');
      if (overlay) overlay.remove();
    }
  });
})();
`;

/**
 * HMR server for WebSocket connections.
 */
export class HMRServer {
  private clients = new Set<ServerWebSocket<unknown>>();
  private lastUpdate: HMRUpdate | null = null;

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
  reload(): void {
    this.send({
      type: 'full-reload',
      timestamp: Date.now(),
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
   * Notify of a JS update.
   */
  jsUpdate(path: string): void {
    this.send({
      type: 'js-update',
      path,
      timestamp: Date.now(),
    });
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
 * File watcher for HMR.
 */
export class HMRWatcher {
  private hmr: HMRServer;
  private watching = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(hmr: HMRServer) {
    this.hmr = hmr;
  }

  /**
   * Start watching a directory.
   */
  watch(dir: string): void {
    if (this.watching) return;
    this.watching = true;

    try {
      const { watch } = require('node:fs');

      watch(dir, { recursive: true }, (event: string, filename: string | null) => {
        if (!filename) return;

        // Debounce rapid changes
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
          this.handleChange(filename);
        }, 50);
      });
    } catch (error) {
      console.warn('File watching not available:', error);
    }
  }

  /**
   * Handle file change.
   */
  private handleChange(filename: string): void {
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'css':
        this.hmr.cssUpdate(filename);
        break;

      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        this.hmr.jsUpdate(filename);
        break;

      default:
        // For other files, do full reload
        this.hmr.reload();
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
  }
}

/**
 * Create file watcher for HMR.
 */
export function createHMRWatcher(hmr: HMRServer): HMRWatcher {
  return new HMRWatcher(hmr);
}
