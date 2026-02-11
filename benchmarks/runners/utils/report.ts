import { readdir, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { formatMs, formatBytes, type BenchmarkStats } from './stats';

const RESULTS_DIR = join(import.meta.dir, '../../results');
const REPORTS_DIR = join(import.meta.dir, '../../reports');

interface BuildResult {
  framework: string;
  coldBuildMs: BenchmarkStats;
  incrementalBuildMs: BenchmarkStats;
  bundleJS: number;
  bundleCSS: number;
  bundleTotal: number;
  fileCount: number;
}

interface ServerRouteResult {
  route: string;
  rps: BenchmarkStats;
  latencyP50: BenchmarkStats;
  latencyP95: BenchmarkStats;
  latencyP99: BenchmarkStats;
  throughput: BenchmarkStats;
}

interface ServerResult {
  framework: string;
  coldStartMs: BenchmarkStats;
  routes: ServerRouteResult[];
}

interface ClientRouteResult {
  route: string;
  ttfb: BenchmarkStats;
  fcp: BenchmarkStats;
  lcp: BenchmarkStats;
  tti: BenchmarkStats;
  tbt: BenchmarkStats;
  cls: BenchmarkStats;
  totalJS: number;
}

interface ClientResult {
  framework: string;
  routes: ClientRouteResult[];
}

interface StartupResult {
  framework: string;
  devColdStartMs: BenchmarkStats;
  hmrMs: BenchmarkStats;
}

function tableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`;
}

function tableSep(count: number): string {
  return `| ${Array(count).fill('---').join(' | ')} |`;
}

function statCell(stat: BenchmarkStats, formatter: (n: number) => string = formatMs): string {
  return `${formatter(stat.mean)} ±${formatter(stat.stddev)}`;
}

async function getEnvironmentInfo(): Promise<string> {
  const os = await import('os');
  const lines = [
    '## Environment',
    '',
    `- **OS**: ${os.type()} ${os.release()} (${os.arch()})`,
    `- **CPU**: ${os.cpus()[0]?.model ?? 'Unknown'} (${os.cpus().length} cores)`,
    `- **RAM**: ${(os.totalmem() / (1024 ** 3)).toFixed(1)} GB`,
    `- **Date**: ${new Date().toISOString().split('T')[0]}`,
  ];

  try {
    const bunProc = Bun.spawn({ cmd: ['bun', '--version'], stdout: 'pipe' });
    const bunVersion = (await new Response(bunProc.stdout).text()).trim();
    lines.push(`- **Bun**: ${bunVersion}`);
  } catch {}

  try {
    const nodeProc = Bun.spawn({ cmd: ['node', '--version'], stdout: 'pipe' });
    const nodeVersion = (await new Response(nodeProc.stdout).text()).trim();
    lines.push(`- **Node.js**: ${nodeVersion}`);
  } catch {}

  return lines.join('\n');
}

async function loadResults(prefix: string): Promise<any[]> {
  try {
    const files = await readdir(RESULTS_DIR);
    const matching = files.filter((f) => f.startsWith(prefix) && f.endsWith('.json'));
    const results: any[] = [];
    for (const file of matching) {
      const content = await readFile(join(RESULTS_DIR, file), 'utf-8');
      results.push(JSON.parse(content));
    }
    return results;
  } catch {
    return [];
  }
}

export async function generateReport(): Promise<string> {
  const sections: string[] = [
    '# Benchmark Report: Ereo vs Next.js vs Remix vs Astro',
    '',
    await getEnvironmentInfo(),
    '',
    '> All benchmarks run 5 iterations. Values shown as mean ± stddev.',
    '',
  ];

  // Build results
  const buildResults = await loadResults('build-');
  if (buildResults.length > 0) {
    const latest = buildResults[buildResults.length - 1];
    sections.push('## Build Performance', '');
    const headers = ['Framework', 'Cold Build', 'Incremental Build', 'JS Size', 'CSS Size', 'Total Size', 'Files'];
    sections.push(tableRow(headers));
    sections.push(tableSep(headers.length));

    for (const fw of latest.frameworks ?? []) {
      sections.push(tableRow([
        `**${fw.framework}**`,
        statCell(fw.coldBuildMs),
        statCell(fw.incrementalBuildMs),
        formatBytes(fw.bundleJS),
        formatBytes(fw.bundleCSS),
        formatBytes(fw.bundleTotal),
        String(fw.fileCount),
      ]));
    }
    sections.push('');
  }

  // Server results
  const serverResults = await loadResults('server-');
  if (serverResults.length > 0) {
    const latest = serverResults[serverResults.length - 1];
    sections.push('## Server Performance (SSR)', '');

    for (const route of ['/', '/ssr', '/products/42']) {
      sections.push(`### Route: \`${route}\``, '');
      const headers = ['Framework', 'RPS', 'Latency p50', 'Latency p95', 'Latency p99'];
      sections.push(tableRow(headers));
      sections.push(tableSep(headers.length));

      for (const fw of latest.frameworks ?? []) {
        const routeData = fw.routes?.find((r: any) => r.route === route);
        if (routeData) {
          sections.push(tableRow([
            `**${fw.framework}**`,
            `${Math.round(routeData.rps.mean).toLocaleString()} ±${Math.round(routeData.rps.stddev)}`,
            statCell(routeData.latencyP50),
            statCell(routeData.latencyP95),
            statCell(routeData.latencyP99),
          ]));
        }
      }
      sections.push('');
    }

    // Cold start
    sections.push('### Cold Start', '');
    const csHeaders = ['Framework', 'Cold Start'];
    sections.push(tableRow(csHeaders));
    sections.push(tableSep(csHeaders.length));
    for (const fw of latest.frameworks ?? []) {
      sections.push(tableRow([
        `**${fw.framework}**`,
        statCell(fw.coldStartMs),
      ]));
    }
    sections.push('');
  }

  // Client results
  const clientResults = await loadResults('client-');
  if (clientResults.length > 0) {
    const latest = clientResults[clientResults.length - 1];
    sections.push('## Client Performance (Lighthouse)', '');

    for (const route of ['/', '/ssr', '/products', '/dashboard']) {
      sections.push(`### Route: \`${route}\``, '');
      const headers = ['Framework', 'TTFB', 'FCP', 'LCP', 'TBT', 'CLS', 'JS Size'];
      sections.push(tableRow(headers));
      sections.push(tableSep(headers.length));

      for (const fw of latest.frameworks ?? []) {
        const routeData = fw.routes?.find((r: any) => r.route === route);
        if (routeData) {
          sections.push(tableRow([
            `**${fw.framework}**`,
            statCell(routeData.ttfb),
            statCell(routeData.fcp),
            statCell(routeData.lcp),
            statCell(routeData.tbt),
            `${routeData.cls.mean.toFixed(3)} ±${routeData.cls.stddev.toFixed(3)}`,
            formatBytes(routeData.totalJS),
          ]));
        }
      }
      sections.push('');
    }
  }

  // Startup results
  const startupResults = await loadResults('startup-');
  if (startupResults.length > 0) {
    const latest = startupResults[startupResults.length - 1];
    sections.push('## Developer Experience', '');
    const headers = ['Framework', 'Dev Cold Start', 'HMR'];
    sections.push(tableRow(headers));
    sections.push(tableSep(headers.length));

    for (const fw of latest.frameworks ?? []) {
      sections.push(tableRow([
        `**${fw.framework}**`,
        statCell(fw.devColdStartMs),
        statCell(fw.hmrMs),
      ]));
    }
    sections.push('');
  }

  sections.push('---', '');
  sections.push('*Generated by @ereo/benchmarks*');

  return sections.join('\n');
}

export async function writeReport(content: string): Promise<string> {
  await mkdir(REPORTS_DIR, { recursive: true });
  const filename = `summary.md`;
  const filepath = join(REPORTS_DIR, filename);
  await Bun.write(filepath, content);
  return filepath;
}
