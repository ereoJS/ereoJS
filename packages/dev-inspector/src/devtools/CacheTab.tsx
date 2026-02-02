/**
 * @areo/dev-inspector - Cache Tab
 *
 * Visualize cache entries, tags, TTL, and hit rates.
 */

import type { CacheVisualization, CacheEntry } from './types';

/**
 * Generate HTML for the Cache tab.
 */
export function generateCacheTabHTML(cache: CacheVisualization): string {
  const { entries, totalSize, hitRate, tagStats } = cache;

  const entryRows = entries
    .sort((a, b) => b.lastAccessed - a.lastAccessed)
    .slice(0, 50) // Show top 50 entries
    .map((entry) => generateEntryRow(entry))
    .join('\n');

  const tagRows = Array.from(tagStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([tag, stats]) => generateTagRow(tag, stats))
    .join('\n');

  return `
    <div class="cache-container">
      <div class="cache-header">
        <h3>Cache</h3>
        <div class="cache-stats">
          <span class="stat">
            <span class="stat-value">${entries.length}</span>
            <span class="stat-label">Entries</span>
          </span>
          <span class="stat">
            <span class="stat-value">${formatBytes(totalSize)}</span>
            <span class="stat-label">Size</span>
          </span>
          <span class="stat">
            <span class="stat-value hit-rate ${getHitRateClass(hitRate)}">${(hitRate * 100).toFixed(0)}%</span>
            <span class="stat-label">Hit Rate</span>
          </span>
        </div>
      </div>

      <div class="cache-tabs">
        <button class="cache-tab active" data-tab="entries">Entries</button>
        <button class="cache-tab" data-tab="tags">Tags</button>
      </div>

      <div class="cache-content">
        <div class="tab-content active" id="entries-tab">
          ${entries.length > 0 ? `
            <div class="cache-table">
              <div class="cache-table-header">
                <span>Key</span>
                <span>Tags</span>
                <span>Size</span>
                <span>TTL</span>
                <span>Hits</span>
              </div>
              <div class="cache-table-body">
                ${entryRows}
              </div>
            </div>
          ` : `
            <div class="no-entries">
              <span class="no-entries-icon">💾</span>
              <span class="no-entries-text">Cache is empty</span>
            </div>
          `}
        </div>

        <div class="tab-content" id="tags-tab" style="display: none;">
          ${tagStats.size > 0 ? `
            <div class="tags-table">
              <div class="tags-table-header">
                <span>Tag</span>
                <span>Entries</span>
                <span>Hits</span>
                <span>Misses</span>
                <span>Hit Rate</span>
              </div>
              <div class="tags-table-body">
                ${tagRows}
              </div>
            </div>
          ` : `
            <div class="no-entries">
              <span class="no-entries-icon">🏷️</span>
              <span class="no-entries-text">No cache tags</span>
            </div>
          `}
        </div>
      </div>

      <div class="cache-actions">
        <button class="action-btn danger" onclick="window.__AREO_DEVTOOLS__.clearCache()">
          Clear All Cache
        </button>
        <button class="action-btn" onclick="window.__AREO_DEVTOOLS__.refreshCache()">
          Refresh
        </button>
      </div>
    </div>

    <script>
      (function() {
        const tabs = document.querySelectorAll('.cache-tab');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
          tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.style.display = 'none');

            tab.classList.add('active');
            const tabId = tab.dataset.tab + '-tab';
            document.getElementById(tabId).style.display = 'block';
          });
        });
      })();
    </script>
  `;
}

/**
 * Generate HTML for a single cache entry row.
 */
function generateEntryRow(entry: CacheEntry): string {
  const ttlClass = getTTLClass(entry.ttl);
  const age = Date.now() - entry.created;

  return `
    <div class="cache-entry-row">
      <div class="entry-key" title="${escapeHtml(entry.key)}">
        ${escapeHtml(truncateKey(entry.key))}
      </div>
      <div class="entry-tags">
        ${entry.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="entry-size">
        ${formatBytes(entry.size)}
      </div>
      <div class="entry-ttl ${ttlClass}">
        ${formatTTL(entry.ttl)}
      </div>
      <div class="entry-hits">
        ${entry.accessCount}
      </div>
      <div class="entry-actions">
        <button class="entry-action" onclick="window.__AREO_DEVTOOLS__.invalidateKey('${escapeHtml(entry.key)}')" title="Invalidate">
          🗑️
        </button>
        <button class="entry-action" onclick="window.__AREO_DEVTOOLS__.inspectEntry('${escapeHtml(entry.key)}')" title="Inspect">
          🔍
        </button>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a tag row.
 */
function generateTagRow(tag: string, stats: { count: number; hits: number; misses: number }): string {
  const tagHitRate = stats.hits + stats.misses > 0
    ? stats.hits / (stats.hits + stats.misses)
    : 0;

  return `
    <div class="tag-row">
      <div class="tag-name">
        <span class="tag-badge">${escapeHtml(tag)}</span>
      </div>
      <div class="tag-count">${stats.count}</div>
      <div class="tag-hits">${stats.hits}</div>
      <div class="tag-misses">${stats.misses}</div>
      <div class="tag-hit-rate ${getHitRateClass(tagHitRate)}">
        ${(tagHitRate * 100).toFixed(0)}%
      </div>
      <div class="tag-actions">
        <button class="tag-action" onclick="window.__AREO_DEVTOOLS__.invalidateTag('${escapeHtml(tag)}')" title="Invalidate tag">
          🗑️
        </button>
      </div>
    </div>
  `;
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
 * Format TTL to human-readable string.
 */
function formatTTL(ms: number): string {
  if (ms < 0) return 'Expired';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(0)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Get CSS class for TTL.
 */
function getTTLClass(ttl: number): string {
  if (ttl < 0) return 'expired';
  if (ttl < 60000) return 'expiring-soon';
  return 'healthy';
}

/**
 * Get CSS class for hit rate.
 */
function getHitRateClass(rate: number): string {
  if (rate >= 0.8) return 'excellent';
  if (rate >= 0.5) return 'good';
  if (rate >= 0.2) return 'fair';
  return 'poor';
}

/**
 * Truncate long cache keys.
 */
function truncateKey(key: string, maxLength = 50): string {
  if (key.length <= maxLength) return key;
  return key.slice(0, maxLength - 3) + '...';
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * CSS styles for the Cache tab.
 */
export const CACHE_TAB_STYLES = `
  .cache-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 1.5rem;
    border-radius: 12px;
  }

  .cache-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #334155;
  }

  .cache-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .cache-stats {
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

  .hit-rate.excellent { color: #10b981; }
  .hit-rate.good { color: #3b82f6; }
  .hit-rate.fair { color: #f59e0b; }
  .hit-rate.poor { color: #ef4444; }

  .cache-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .cache-tab {
    padding: 0.5rem 1rem;
    background: #1e293b;
    border: none;
    border-radius: 6px;
    color: #94a3b8;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cache-tab:hover {
    color: #f8fafc;
  }

  .cache-tab.active {
    background: #3b82f6;
    color: white;
  }

  .cache-table,
  .tags-table {
    background: #1e293b;
    border-radius: 8px;
    overflow: hidden;
  }

  .cache-table-header,
  .tags-table-header {
    display: grid;
    grid-template-columns: 2fr 1fr 80px 80px 60px 70px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: #0f172a;
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tags-table-header {
    grid-template-columns: 1fr 80px 80px 80px 80px 50px;
  }

  .cache-entry-row,
  .tag-row {
    display: grid;
    grid-template-columns: 2fr 1fr 80px 80px 60px 70px;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #0f172a;
    align-items: center;
    font-size: 0.875rem;
  }

  .tag-row {
    grid-template-columns: 1fr 80px 80px 80px 80px 50px;
  }

  .cache-entry-row:hover,
  .tag-row:hover {
    background: #334155;
  }

  .entry-key {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .tag {
    padding: 0.125rem 0.375rem;
    background: #334155;
    border-radius: 4px;
    font-size: 0.625rem;
    color: #94a3b8;
  }

  .tag-badge {
    padding: 0.25rem 0.5rem;
    background: #3b82f6;
    border-radius: 4px;
    font-size: 0.75rem;
    color: white;
  }

  .entry-ttl.expired { color: #ef4444; }
  .entry-ttl.expiring-soon { color: #f59e0b; }
  .entry-ttl.healthy { color: #10b981; }

  .entry-actions,
  .tag-actions {
    display: flex;
    gap: 0.25rem;
  }

  .entry-action,
  .tag-action {
    padding: 0.25rem;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .entry-action:hover,
  .tag-action:hover {
    background: #334155;
  }

  .no-entries {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    color: #64748b;
  }

  .no-entries-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .cache-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
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

  .action-btn.danger {
    background: #ef4444;
  }

  .action-btn.danger:hover {
    background: #dc2626;
  }
`;

/**
 * React component placeholder.
 */
export function CacheTab({ cache }: { cache: CacheVisualization }) {
  return null;
}
