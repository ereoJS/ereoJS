export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const squaredDiffs = arr.map((x) => (x - m) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

export function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

export function ci95(arr: number[]): { lower: number; upper: number; margin: number } {
  const m = mean(arr);
  const s = stddev(arr);
  const margin = 1.96 * (s / Math.sqrt(arr.length));
  return { lower: m - margin, upper: m + margin, margin };
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

export interface BenchmarkStats {
  mean: number;
  median: number;
  stddev: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  ci95: { lower: number; upper: number; margin: number };
  samples: number;
}

export function computeStats(arr: number[]): BenchmarkStats {
  const sorted = [...arr].sort((a, b) => a - b);
  return {
    mean: mean(arr),
    median: median(arr),
    stddev: stddev(arr),
    p50: percentile(arr, 50),
    p95: percentile(arr, 95),
    p99: percentile(arr, 99),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    ci95: ci95(arr),
    samples: arr.length,
  };
}
