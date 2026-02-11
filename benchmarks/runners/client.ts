import { spawn } from 'bun';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { spawnServer, waitForReady, killServer, killPortProcess } from './utils/process';
import { computeStats, formatMs, formatBytes } from './utils/stats';

const BENCHMARKS_DIR = join(import.meta.dir, '..');
const APPS_DIR = join(BENCHMARKS_DIR, 'apps');
const RESULTS_DIR = join(BENCHMARKS_DIR, 'results');

interface FrameworkConfig {
  name: string;
  dir: string;
  buildCmd: string[];
  startCmd: string[];
  port: number;
  env?: Record<string, string>;
}

const FRAMEWORKS: FrameworkConfig[] = [
  {
    name: 'Ereo',
    dir: join(APPS_DIR, 'ereo-bench'),
    buildCmd: ['bun', 'run', 'build'],
    startCmd: ['bun', 'run', 'start'],
    port: 4000,
  },
  {
    name: 'Next.js',
    dir: join(APPS_DIR, 'nextjs-bench'),
    buildCmd: ['npx', 'next', 'build'],
    startCmd: ['npx', 'next', 'start', '-p', '4001'],
    port: 4001,
  },
  {
    name: 'Remix',
    dir: join(APPS_DIR, 'remix-bench'),
    buildCmd: ['npx', 'remix', 'vite:build'],
    startCmd: ['npx', 'remix-serve', './build/server/index.js'],
    port: 4002,
    env: { PORT: '4002' },
  },
  {
    name: 'Astro',
    dir: join(APPS_DIR, 'astro-bench'),
    buildCmd: ['npx', 'astro', 'build'],
    startCmd: ['node', './dist/server/entry.mjs'],
    port: 4003,
    env: { PORT: '4003', HOST: '0.0.0.0' },
  },
];

const TEST_ROUTES = ['/', '/ssr', '/products', '/dashboard'];

interface LighthouseResult {
  ttfb: number;
  fcp: number;
  lcp: number;
  tti: number;
  tbt: number;
  cls: number;
  totalJS: number;
  totalRequests: number;
}

async function runLighthouse(url: string): Promise<LighthouseResult | null> {
  try {
    // Use Lighthouse CLI with JSON output
    const proc = spawn({
      cmd: [
        'npx', 'lighthouse',
        url,
        '--output=json',
        '--quiet',
        '--chrome-flags=--headless --no-sandbox --disable-gpu',
        '--only-categories=performance',
        '--preset=desktop',
      ],
      stdout: 'pipe',
      stderr: 'pipe',
      cwd: BENCHMARKS_DIR,
      env: { ...process.env },
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    const data = JSON.parse(output);
    const audits = data.audits ?? {};

    return {
      ttfb: audits['server-response-time']?.numericValue ?? 0,
      fcp: audits['first-contentful-paint']?.numericValue ?? 0,
      lcp: audits['largest-contentful-paint']?.numericValue ?? 0,
      tti: audits['interactive']?.numericValue ?? 0,
      tbt: audits['total-blocking-time']?.numericValue ?? 0,
      cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
      totalJS: audits['total-byte-weight']?.numericValue ?? 0,
      totalRequests: audits['network-requests']?.details?.items?.length ?? 0,
    };
  } catch (err) {
    console.error(`  Lighthouse error: ${err}`);
    return null;
  }
}

export async function runClientBenchmark(frameworks?: string[]): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const activeFrameworks = FRAMEWORKS.filter(
    (fw) => !frameworks || frameworks.includes(fw.name.toLowerCase().replace('.', ''))
  );

  console.log('\n=== Client Performance Benchmark (Lighthouse) ===\n');

  const iterations = 5;
  const results: any[] = [];

  for (const fw of activeFrameworks) {
    console.log(`\nBenchmarking: ${fw.name}`);

    // Ensure port is free
    await killPortProcess(fw.port);

    // Build
    console.log(`  Building...`);
    const buildProc = spawn({
      cmd: fw.buildCmd,
      cwd: fw.dir,
      env: { ...process.env, NODE_ENV: 'production' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if ((await buildProc.exited) !== 0) {
      console.error(`  Build failed for ${fw.name}`);
      continue;
    }

    // Start server
    await killPortProcess(fw.port);
    const server = await spawnServer({
      command: fw.startCmd,
      cwd: fw.dir,
      port: fw.port,
      framework: fw.name,
      env: fw.env,
    });

    try {
      await waitForReady(fw.port, 60000);
      console.log(`  Server ready on port ${fw.port}`);

      const routeResults: Record<string, {
        ttfb: number[]; fcp: number[]; lcp: number[]; tti: number[];
        tbt: number[]; cls: number[]; totalJS: number[];
      }> = {};

      for (const route of TEST_ROUTES) {
        routeResults[route] = { ttfb: [], fcp: [], lcp: [], tti: [], tbt: [], cls: [], totalJS: [] };
      }

      for (const route of TEST_ROUTES) {
        const url = `http://localhost:${fw.port}${route}`;
        console.log(`\n  Testing ${route}...`);

        for (let i = 0; i < iterations; i++) {
          console.log(`    Iteration ${i + 1}/${iterations}...`);
          const result = await runLighthouse(url);
          if (result) {
            routeResults[route].ttfb.push(result.ttfb);
            routeResults[route].fcp.push(result.fcp);
            routeResults[route].lcp.push(result.lcp);
            routeResults[route].tti.push(result.tti);
            routeResults[route].tbt.push(result.tbt);
            routeResults[route].cls.push(result.cls);
            routeResults[route].totalJS.push(result.totalJS);

            console.log(`      TTFB: ${formatMs(result.ttfb)} | FCP: ${formatMs(result.fcp)} | LCP: ${formatMs(result.lcp)} | TBT: ${formatMs(result.tbt)}`);
          } else {
            console.log(`      FAILED`);
          }
        }
      }

      results.push({
        framework: fw.name,
        routes: TEST_ROUTES.map((route) => ({
          route,
          ttfb: computeStats(routeResults[route].ttfb),
          fcp: computeStats(routeResults[route].fcp),
          lcp: computeStats(routeResults[route].lcp),
          tti: computeStats(routeResults[route].tti),
          tbt: computeStats(routeResults[route].tbt),
          cls: computeStats(routeResults[route].cls),
          totalJS: routeResults[route].totalJS.length > 0
            ? Math.round(routeResults[route].totalJS.reduce((a, b) => a + b, 0) / routeResults[route].totalJS.length)
            : 0,
        })),
      });
    } finally {
      await killServer(server);
      await killPortProcess(fw.port);
    }
  }

  const outputFile = join(RESULTS_DIR, `client-${Date.now()}.json`);
  await writeFile(outputFile, JSON.stringify({ frameworks: results, timestamp: Date.now() }, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

if (import.meta.main) {
  const frameworks = process.argv.slice(2);
  await runClientBenchmark(frameworks.length > 0 ? frameworks : undefined);
}
