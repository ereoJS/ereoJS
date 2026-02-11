import { spawn, type Subprocess } from 'bun';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { spawnServer, waitForReady, killServer, killPortProcess, type ServerProcess } from './utils/process';
import { computeStats, formatMs } from './utils/stats';

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

const TEST_ROUTES = ['/', '/ssr', '/products/42'];

async function detectLoadTester(): Promise<'bombardier' | 'autocannon'> {
  try {
    const proc = spawn({ cmd: ['which', 'bombardier'], stdout: 'pipe', stderr: 'pipe' });
    await proc.exited;
    if (proc.exitCode === 0) return 'bombardier';
  } catch {}
  return 'autocannon';
}

interface LoadTestResult {
  rps: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  throughput: number;
}

async function runBombardier(url: string, connections: number, duration: number): Promise<LoadTestResult> {
  const proc = spawn({
    cmd: [
      'bombardier',
      '-c', String(connections),
      '-d', `${duration}s`,
      '--print', 'r',
      '--format', 'json',
      url,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const data = JSON.parse(output);
    return {
      rps: data.result?.rps?.mean ?? 0,
      latencyP50: (data.result?.latency?.percentiles?.['50'] ?? 0) / 1_000_000, // ns to ms
      latencyP95: (data.result?.latency?.percentiles?.['95'] ?? 0) / 1_000_000,
      latencyP99: (data.result?.latency?.percentiles?.['99'] ?? 0) / 1_000_000,
      throughput: data.result?.bytesRead ?? 0,
    };
  } catch {
    console.error('  Failed to parse bombardier output');
    return { rps: 0, latencyP50: 0, latencyP95: 0, latencyP99: 0, throughput: 0 };
  }
}

async function runAutocannon(url: string, connections: number, duration: number): Promise<LoadTestResult> {
  const proc = spawn({
    cmd: [
      'npx', 'autocannon',
      '-c', String(connections),
      '-d', String(duration),
      '-j',
      url,
    ],
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: BENCHMARKS_DIR,
  });

  const output = await new Response(proc.stdout).text();
  await proc.exited;

  try {
    const data = JSON.parse(output);
    return {
      rps: data.requests?.average ?? 0,
      latencyP50: data.latency?.p50 ?? 0,
      latencyP95: data.latency?.p95 ?? 0,
      latencyP99: data.latency?.p99 ?? 0,
      throughput: data.throughput?.total ?? 0,
    };
  } catch {
    console.error('  Failed to parse autocannon output');
    return { rps: 0, latencyP50: 0, latencyP95: 0, latencyP99: 0, throughput: 0 };
  }
}

async function loadTest(url: string, connections: number, duration: number, tester: 'bombardier' | 'autocannon'): Promise<LoadTestResult> {
  if (tester === 'bombardier') {
    return runBombardier(url, connections, duration);
  }
  return runAutocannon(url, connections, duration);
}

export async function runServerBenchmark(frameworks?: string[]): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const activeFrameworks = FRAMEWORKS.filter(
    (fw) => !frameworks || frameworks.includes(fw.name.toLowerCase().replace('.', ''))
  );

  const tester = await detectLoadTester();
  console.log(`\n=== Server Performance Benchmark ===`);
  console.log(`Load tester: ${tester}\n`);

  const iterations = 5;
  const results: any[] = [];

  for (const fw of activeFrameworks) {
    console.log(`\nBenchmarking: ${fw.name}`);

    // Ensure port is free
    await killPortProcess(fw.port);

    // Build first
    console.log(`  Building...`);
    const buildProc = spawn({
      cmd: fw.buildCmd,
      cwd: fw.dir,
      env: { ...process.env, NODE_ENV: 'production' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const buildExit = await buildProc.exited;
    if (buildExit !== 0) {
      const stderr = await new Response(buildProc.stderr).text();
      console.error(`  Build failed: ${stderr.slice(0, 300)}`);
      continue;
    }

    const coldStartTimes: number[] = [];
    const routeResults: Record<string, { rps: number[]; p50: number[]; p95: number[]; p99: number[]; throughput: number[] }> = {};

    for (const route of TEST_ROUTES) {
      routeResults[route] = { rps: [], p50: [], p95: [], p99: [], throughput: [] };
    }

    for (let i = 0; i < iterations; i++) {
      console.log(`\n  Iteration ${i + 1}/${iterations}`);

      // Kill any leftover process
      await killPortProcess(fw.port);
      await new Promise((r) => setTimeout(r, 500));

      // Start server and measure cold start
      const server = await spawnServer({
        command: fw.startCmd,
        cwd: fw.dir,
        port: fw.port,
        framework: fw.name,
        env: fw.env,
      });

      try {
        const coldStartMs = await waitForReady(fw.port, 60000);
        coldStartTimes.push(coldStartMs);
        console.log(`    Cold start: ${formatMs(coldStartMs)}`);

        // Warm up
        console.log(`    Warming up...`);
        await loadTest(`http://localhost:${fw.port}/`, 10, 3, tester);

        // Test each route
        for (const route of TEST_ROUTES) {
          const url = `http://localhost:${fw.port}${route}`;
          console.log(`    Testing ${route}...`);
          const result = await loadTest(url, 50, 30, tester);

          routeResults[route].rps.push(result.rps);
          routeResults[route].p50.push(result.latencyP50);
          routeResults[route].p95.push(result.latencyP95);
          routeResults[route].p99.push(result.latencyP99);
          routeResults[route].throughput.push(result.throughput);

          console.log(`      RPS: ${Math.round(result.rps)} | p50: ${formatMs(result.latencyP50)} | p95: ${formatMs(result.latencyP95)} | p99: ${formatMs(result.latencyP99)}`);
        }
      } finally {
        await killServer(server);
        await killPortProcess(fw.port);
      }
    }

    const fwResult: any = {
      framework: fw.name,
      coldStartMs: computeStats(coldStartTimes),
      routes: TEST_ROUTES.map((route) => ({
        route,
        rps: computeStats(routeResults[route].rps),
        latencyP50: computeStats(routeResults[route].p50),
        latencyP95: computeStats(routeResults[route].p95),
        latencyP99: computeStats(routeResults[route].p99),
        throughput: computeStats(routeResults[route].throughput),
      })),
    };

    results.push(fwResult);

    console.log(`\n  ${fw.name} Summary:`);
    console.log(`    Cold start: ${formatMs(computeStats(coldStartTimes).mean)} (±${formatMs(computeStats(coldStartTimes).stddev)})`);
    for (const route of TEST_ROUTES) {
      const rpsStats = computeStats(routeResults[route].rps);
      console.log(`    ${route}: ${Math.round(rpsStats.mean)} RPS (±${Math.round(rpsStats.stddev)})`);
    }
  }

  const outputFile = join(RESULTS_DIR, `server-${Date.now()}.json`);
  await writeFile(outputFile, JSON.stringify({ frameworks: results, timestamp: Date.now(), loadTester: tester }, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

if (import.meta.main) {
  const frameworks = process.argv.slice(2);
  await runServerBenchmark(frameworks.length > 0 ? frameworks : undefined);
}
