/**
 * @ereo/dev-inspector - Data Pipeline Tab
 *
 * FLAGSHIP FEATURE: Visual representation of data loading with
 * waterfall detection and optimization suggestions.
 */

import type { DataPipelineVisualization, LoaderTiming } from './types';

/**
 * Generate HTML for the Data Pipeline visualization.
 * This is the flagship feature of Oreo DevTools.
 */
export function generateDataPipelineHTML(data: DataPipelineVisualization): string {
  const { route, totalTime, loaders, efficiency, waterfalls, timestamp } = data;

  // Generate timeline bars
  const timelineHTML = loaders
    .sort((a, b) => a.start - b.start)
    .map((loader) => generateLoaderBar(loader, totalTime))
    .join('\n');

  // Generate waterfall warnings
  const waterfallHTML = waterfalls
    .map((w) => `
      <div class="waterfall-warning ${w.necessary ? 'necessary' : 'unnecessary'}">
        <span class="icon">${w.necessary ? '⚠️' : '💡'}</span>
        <span class="message">${w.suggestion || `'${w.loader}' waited for ${w.waitedFor.join(', ')}`}</span>
      </div>
    `)
    .join('\n');

  return `
    <div class="pipeline-container">
      <div class="pipeline-header">
        <h3>Data Pipeline</h3>
        <div class="route-info">
          <span class="route-path">${escapeHtml(route)}</span>
          <span class="total-time">${totalTime.toFixed(1)}ms</span>
        </div>
      </div>

      <div class="efficiency-meter">
        <div class="efficiency-label">
          Parallel Efficiency:
          <span class="${getEfficiencyClass(efficiency)}">${(efficiency * 100).toFixed(0)}%</span>
        </div>
        <div class="efficiency-bar">
          <div class="efficiency-fill" style="width: ${efficiency * 100}%"></div>
        </div>
        <div class="efficiency-hint">
          ${getEfficiencyHint(efficiency)}
        </div>
      </div>

      <div class="timeline-container">
        <div class="timeline-header">
          <span class="timeline-label">Loader</span>
          <span class="timeline-bar-header">
            <span>0ms</span>
            <span>${(totalTime / 2).toFixed(0)}ms</span>
            <span>${totalTime.toFixed(0)}ms</span>
          </span>
          <span class="timeline-duration">Duration</span>
        </div>
        <div class="timeline-body">
          ${timelineHTML}
        </div>
      </div>

      ${waterfalls.length > 0 ? `
        <div class="waterfall-section">
          <h4>Optimization Opportunities</h4>
          ${waterfallHTML}
        </div>
      ` : `
        <div class="all-good">
          ✅ No waterfall issues detected
        </div>
      `}

      <div class="pipeline-footer">
        <span class="timestamp">Recorded at ${new Date(timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  `;
}

/**
 * Generate HTML for a single loader bar.
 */
function generateLoaderBar(loader: LoaderTiming, totalTime: number): string {
  const startPercent = (loader.start / totalTime) * 100;
  const widthPercent = (loader.duration / totalTime) * 100;

  const sourceIcon = getSourceIcon(loader.source);
  const cacheClass = loader.cacheHit ? 'cache-hit' : '';
  const waitingClass = loader.waitingFor.length > 0 ? 'had-wait' : '';

  return `
    <div class="loader-row ${cacheClass} ${waitingClass}">
      <span class="loader-name" title="${escapeHtml(loader.key)}">
        ${escapeHtml(loader.key)}
      </span>
      <div class="loader-bar-container">
        ${loader.waitingFor.length > 0 ? `
          <div class="wait-indicator" style="left: 0; width: ${startPercent}%">
            <span class="wait-arrow">→</span>
          </div>
        ` : ''}
        <div class="loader-bar ${getBarClass(loader)}"
             style="left: ${startPercent}%; width: ${Math.max(widthPercent, 0.5)}%"
             title="${loader.key}: ${loader.duration.toFixed(1)}ms${loader.cacheHit ? ' (CACHE HIT)' : ''}">
        </div>
      </div>
      <span class="loader-stats">
        <span class="duration">${loader.duration.toFixed(1)}ms</span>
        <span class="source-icon" title="${loader.source}">${sourceIcon}</span>
        ${loader.cacheHit ? '<span class="cache-badge">CACHE</span>' : ''}
      </span>
    </div>
  `;
}

/**
 * Get CSS class for efficiency score.
 */
function getEfficiencyClass(efficiency: number): string {
  if (efficiency >= 0.8) return 'excellent';
  if (efficiency >= 0.5) return 'good';
  if (efficiency >= 0.3) return 'fair';
  return 'poor';
}

/**
 * Get hint text for efficiency score.
 */
function getEfficiencyHint(efficiency: number): string {
  if (efficiency >= 0.8) return 'Excellent! Your loaders are well parallelized.';
  if (efficiency >= 0.5) return 'Good parallelization. Some room for improvement.';
  if (efficiency >= 0.3) return 'Fair. Consider reducing dependencies between loaders.';
  return 'Poor. Significant waterfall detected. Check dependencies.';
}

/**
 * Get icon for data source type.
 */
function getSourceIcon(source: string): string {
  switch (source) {
    case 'db': return '🗄️';
    case 'api': return '🌐';
    case 'cache': return '⚡';
    case 'compute': return '⚙️';
    default: return '📦';
  }
}

/**
 * Get CSS class for loader bar.
 */
function getBarClass(loader: LoaderTiming): string {
  if (loader.cacheHit) return 'bar-cache';
  switch (loader.source) {
    case 'db': return 'bar-db';
    case 'api': return 'bar-api';
    default: return 'bar-default';
  }
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
 * CSS styles for the Data Pipeline tab.
 */
export const DATA_PIPELINE_STYLES = `
  .pipeline-container {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a;
    color: #e2e8f0;
    padding: 1.5rem;
    border-radius: 12px;
  }

  .pipeline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #334155;
  }

  .pipeline-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #f8fafc;
  }

  .route-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .route-path {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    color: #94a3b8;
    background: #1e293b;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
  }

  .total-time {
    font-size: 1.5rem;
    font-weight: 700;
    color: #3b82f6;
  }

  /* Efficiency Meter */
  .efficiency-meter {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #1e293b;
    border-radius: 8px;
  }

  .efficiency-label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .efficiency-label .excellent { color: #10b981; }
  .efficiency-label .good { color: #3b82f6; }
  .efficiency-label .fair { color: #f59e0b; }
  .efficiency-label .poor { color: #ef4444; }

  .efficiency-bar {
    height: 8px;
    background: #334155;
    border-radius: 4px;
    overflow: hidden;
  }

  .efficiency-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #3b82f6);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .efficiency-hint {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: #64748b;
  }

  /* Timeline */
  .timeline-container {
    margin-bottom: 1.5rem;
  }

  .timeline-header {
    display: grid;
    grid-template-columns: 150px 1fr 100px;
    gap: 1rem;
    padding: 0.5rem 0;
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .timeline-bar-header {
    display: flex;
    justify-content: space-between;
  }

  .loader-row {
    display: grid;
    grid-template-columns: 150px 1fr 100px;
    gap: 1rem;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #1e293b;
  }

  .loader-row:hover {
    background: #1e293b;
    margin: 0 -1rem;
    padding-left: 1rem;
    padding-right: 1rem;
    border-radius: 4px;
  }

  .loader-name {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loader-bar-container {
    position: relative;
    height: 24px;
    background: #1e293b;
    border-radius: 4px;
  }

  .wait-indicator {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 2px;
    background: repeating-linear-gradient(
      90deg,
      transparent,
      transparent 4px,
      #475569 4px,
      #475569 8px
    );
  }

  .wait-arrow {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    color: #64748b;
    font-size: 10px;
  }

  .loader-bar {
    position: absolute;
    top: 4px;
    height: 16px;
    border-radius: 4px;
    min-width: 2px;
    transition: all 0.2s ease;
  }

  .loader-bar:hover {
    filter: brightness(1.2);
  }

  .bar-default { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
  .bar-db { background: linear-gradient(90deg, #3b82f6, #2563eb); }
  .bar-api { background: linear-gradient(90deg, #f59e0b, #d97706); }
  .bar-cache { background: linear-gradient(90deg, #10b981, #059669); }

  .loader-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .duration {
    font-family: 'Monaco', 'Menlo', monospace;
    color: #94a3b8;
  }

  .source-icon {
    font-size: 0.875rem;
  }

  .cache-badge {
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    background: #059669;
    color: white;
    border-radius: 2px;
    font-weight: 600;
  }

  .cache-hit .loader-name {
    color: #10b981;
  }

  /* Waterfall Warnings */
  .waterfall-section {
    margin-bottom: 1rem;
  }

  .waterfall-section h4 {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: #f59e0b;
  }

  .waterfall-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #1e293b;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    border-left: 3px solid #f59e0b;
  }

  .waterfall-warning.unnecessary {
    border-left-color: #10b981;
  }

  .waterfall-warning .icon {
    font-size: 1rem;
  }

  .waterfall-warning .message {
    font-size: 0.875rem;
    line-height: 1.4;
    color: #cbd5e1;
  }

  .all-good {
    padding: 1rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 8px;
    text-align: center;
    color: #10b981;
    font-size: 0.875rem;
  }

  .pipeline-footer {
    text-align: right;
    font-size: 0.75rem;
    color: #475569;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #1e293b;
  }
`;

/**
 * React component for Data Pipeline visualization.
 * Used when rendering in React context.
 */
export function DataPipelineTab({ data }: { data: DataPipelineVisualization }) {
  // This is a placeholder for actual React component
  // In production, this would use proper React rendering
  return null;
}
