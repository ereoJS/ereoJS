/**
 * @ereo/trace - CLI Reporter
 *
 * Subscribes to TraceStreamEvent and prints formatted terminal output
 * for completed requests.
 *
 * Output format:
 *   POST /api/users/123  200  45.2ms
 *   |-- routing          1.2ms   matched /api/users/[id]
 *   |-- auth             3.1ms   requireAuth -> ok
 *   |-- data             38.4ms
 *   |   |-- user         12.1ms  db
 *   |   |-- posts        18.3ms  db (parallel)
 *   |   `-- comments     8.0ms   cache hit
 *   `-- render           2.5ms   streaming
 */

import type { Tracer, TraceData, SpanData, SpanId, SpanLayer } from './types';

// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';
const GRAY = '\x1b[90m';
const WHITE = '\x1b[37m';

/** CLI reporter configuration */
export interface CLIReporterOptions {
  /** Show verbose output with attributes (default: false) */
  verbose?: boolean;
  /** Filter to specific layers (default: all) */
  layers?: SpanLayer[];
  /** Minimum duration to show a span in ms (default: 0) */
  minDuration?: number;
  /** Use colors in output (default: true) */
  colors?: boolean;
}

/** Color a duration based on thresholds */
function durationColor(ms: number): string {
  if (ms < 50) return GREEN;
  if (ms < 200) return YELLOW;
  return RED;
}

/** Format duration in ms */
function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}us`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Status code color */
function statusColor(code: number): string {
  if (code < 300) return GREEN;
  if (code < 400) return CYAN;
  if (code < 500) return YELLOW;
  return RED;
}

/** Layer label color */
function layerColor(layer: SpanLayer): string {
  switch (layer) {
    case 'request': return WHITE;
    case 'routing': return CYAN;
    case 'data': return BLUE;
    case 'database': return MAGENTA;
    case 'auth': return YELLOW;
    case 'rpc': return CYAN;
    case 'forms': return GREEN;
    case 'islands': return MAGENTA;
    case 'build': return BLUE;
    case 'errors': return RED;
    case 'signals': return GREEN;
    case 'custom': return GRAY;
  }
}

/** Extract a summary from span attributes */
function spanSummary(span: SpanData): string {
  const parts: string[] = [];

  // Route matching
  if (span.attributes['route.pattern']) {
    parts.push(`matched ${span.attributes['route.pattern']}`);
  }

  // Data source
  if (span.attributes['cache.hit'] === true) {
    parts.push('cache hit');
  } else if (span.attributes['db.system']) {
    parts.push(`${span.attributes['db.system']}`);
  }

  // Auth result
  if (span.attributes['auth.result']) {
    parts.push(`${span.attributes['auth.provider'] || 'auth'} -> ${span.attributes['auth.result']}`);
  }

  // RPC procedure
  if (span.attributes['rpc.procedure']) {
    parts.push(`${span.attributes['rpc.type'] || 'query'}`);
  }

  // Error
  if (span.status === 'error' && span.attributes['error.message']) {
    parts.push(`${span.attributes['error.message']}`);
  }

  // DB query
  if (span.attributes['db.statement']) {
    const stmt = String(span.attributes['db.statement']);
    parts.push(stmt.length > 50 ? stmt.slice(0, 50) + '...' : stmt);
  }

  return parts.join('  ');
}

/**
 * Print a completed trace to the terminal.
 */
function printTrace(trace: TraceData, options: Required<CLIReporterOptions>): void {
  const { verbose, layers, minDuration, colors } = options;
  const c = (color: string, text: string) => (colors ? `${color}${text}${RESET}` : text);

  const rootSpan = trace.spans.get(trace.rootSpanId);
  if (!rootSpan) return;

  const method = String(trace.metadata.method || 'GET');
  const pathname = String(trace.metadata.pathname || '/');
  const statusCode = Number(trace.metadata.statusCode || rootSpan.attributes['http.status_code'] || 200);
  const duration = trace.duration;

  // Header line
  const methodStr = c(BOLD, method.padEnd(7));
  const pathStr = pathname;
  const statusStr = c(statusColor(statusCode), String(statusCode));
  const durationStr = c(durationColor(duration), formatDuration(duration));

  console.log(`  ${methodStr}${pathStr}  ${statusStr}  ${durationStr}`);

  // Build child tree from root span
  const children = getChildSpans(trace, rootSpan.id);
  printChildren(trace, children, '  ', options);

  // Empty line after each trace
  console.log();
}

/** Get direct child spans of a span, sorted by startTime */
function getChildSpans(trace: TraceData, parentId: SpanId): SpanData[] {
  const children: SpanData[] = [];
  for (const span of trace.spans.values()) {
    if (span.parentId === parentId && span.id !== parentId) {
      children.push(span);
    }
  }
  return children.sort((a, b) => a.startTime - b.startTime);
}

/** Recursively print child spans as a tree */
function printChildren(
  trace: TraceData,
  children: SpanData[],
  prefix: string,
  options: Required<CLIReporterOptions>,
): void {
  const { layers, minDuration, colors } = options;
  const c = (color: string, text: string) => (colors ? `${color}${text}${RESET}` : text);

  const filtered = children.filter((span) => {
    if (layers.length > 0 && !layers.includes(span.layer)) return false;
    if (span.duration < minDuration) return false;
    return true;
  });

  for (let i = 0; i < filtered.length; i++) {
    const span = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '`-- ' : '|-- ';
    const childPrefix = isLast ? '    ' : '|   ';

    const name = c(layerColor(span.layer), span.name.padEnd(16));
    const dur = c(durationColor(span.duration), formatDuration(span.duration).padStart(8));
    const summary = c(DIM, spanSummary(span));

    console.log(`${prefix}${c(GRAY, connector)}${name}${dur}   ${summary}`);

    // Recurse into grandchildren
    const grandchildren = getChildSpans(trace, span.id);
    if (grandchildren.length > 0) {
      printChildren(trace, grandchildren, prefix + childPrefix, options);
    }
  }
}

/**
 * Create a CLI reporter that subscribes to the tracer and prints traces.
 *
 * @param tracer - Tracer to subscribe to
 * @param options - Display options
 * @returns Unsubscribe function
 */
export function createCLIReporter(tracer: Tracer, options: CLIReporterOptions = {}): () => void {
  const resolved: Required<CLIReporterOptions> = {
    verbose: options.verbose ?? false,
    layers: options.layers ?? [],
    minDuration: options.minDuration ?? 0,
    colors: options.colors ?? true,
  };

  return tracer.subscribe((event) => {
    if (event.type === 'trace:end') {
      // Update trace metadata with final status code from root span
      const rootSpan = event.trace.spans.get(event.trace.rootSpanId);
      if (rootSpan && rootSpan.attributes['http.status_code']) {
        event.trace.metadata.statusCode = Number(rootSpan.attributes['http.status_code']);
      }

      printTrace(event.trace, resolved);
    }
  });
}
