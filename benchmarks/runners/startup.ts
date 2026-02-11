import { spawn } from 'bun';
import { writeFile, mkdir, appendFile } from 'fs/promises';
import { join } from 'path';
import { killPortProcess } from './utils/process';
import { computeStats, formatMs } from './utils/stats';

const BENCHMARKS_DIR = join(import.meta.dir, '..');
const APPS_DIR = join(BENCHMARKS_DIR, 'apps');
const RESULTS_DIR = join(BENCHMARKS_DIR, 'results');

interface FrameworkConfig {
  name: string;
  dir: string;
  devCmd: string[];
  port: number;
  modifyFile: string;
  env?: Record<string, string>;
}

const FRAMEWORKS: FrameworkConfig[] = [
  {
    name: 'Ereo',
    dir: join(APPS_DIR, 'ereo-bench'),
    devCmd: ['bun', 'run', 'dev'],
    port: 4000,
    modifyFile: 'app/routes/ssr.tsx',
  },
  {
    name: 'Next.js',
    dir: join(APPS_DIR, 'nextjs-bench'),
    devCmd: ['npx', 'next', 'dev', '-p', '4001'],
    port: 4001,
    modifyFile: 'app/ssr/page.tsx',
  },
  {
    name: 'Remix',
    dir: join(APPS_DIR, 'remix-bench'),
    devCmd: ['npx', 'remix', 'vite:dev', '--port', '4002'],
    port: 4002,
    modifyFile: 'app/routes/ssr.tsx',
  },
  {
    name: 'Astro',
    dir: join(APPS_DIR, 'astro-bench'),
    devCmd: ['npx', 'astro', 'dev', '--port', '4003'],
    port: 4003,
    modifyFile: 'src/pages/ssr.astro',
  },
];

async function waitForPort(port: number, timeoutMs: number = 60000): Promise<number> {
  const start = performance.now();
  const deadline = start + timeoutMs;

  while (performance.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok || res.status < 500) {
        return performance.now() - start;
      }
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Port ${port} not ready after ${timeoutMs}ms`);
}

async function measureHMR(fw: FrameworkConfig): Promise<number> {
  const filePath = join(fw.dir, fw.modifyFile);

  // Read current content
  const original = await Bun.file(filePath).text();

  // Start timing
  const start = performance.now();

  // Modify file (add a comment)
  const modified = original + `\n// HMR test ${Date.now()}\n`;
  await Bun.write(filePath, modified);

  // Wait for the dev server to pick up the change (poll the page)
  // We look for a change in response or a successful response after modification
  let hmrTime = 0;
  const deadline = start + 30000;

  // Give the dev server time to process
  await new Promise((r) => setTimeout(r, 100));

  // Poll until we get a fresh response
  while (performance.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${fw.port}/ssr`, {
        signal: AbortSignal.timeout(2000),
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        hmrTime = performance.now() - start;
        break;
      }
    } catch {
      // still reloading
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  // Restore original file
  await Bun.write(filePath, original);

  // Wait a bit for the restore to be processed
  await new Promise((r) => setTimeout(r, 500));

  return hmrTime;
}

export async function runStartupBenchmark(frameworks?: string[]): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const activeFrameworks = FRAMEWORKS.filter(
    (fw) => !frameworks || frameworks.includes(fw.name.toLowerCase().replace('.', ''))
  );

  console.log('\n=== Developer Experience Benchmark ===\n');

  const iterations = 5;
  const results: any[] = [];

  for (const fw of activeFrameworks) {
    console.log(`\nBenchmarking: ${fw.name}`);

    const coldStartTimes: number[] = [];
    const hmrTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      console.log(`\n  Iteration ${i + 1}/${iterations}`);

      // Kill any existing process
      await killPortProcess(fw.port);
      await new Promise((r) => setTimeout(r, 500));

      // Spawn dev server
      const proc = spawn({
        cmd: fw.devCmd,
        cwd: fw.dir,
        env: { ...process.env, ...fw.env, NODE_ENV: 'development' },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      try {
        // Measure cold start
        const coldStartMs = await waitForPort(fw.port, 60000);
        coldStartTimes.push(coldStartMs);
        console.log(`    Dev cold start: ${formatMs(coldStartMs)}`);

        // Wait for server to be fully stable
        await new Promise((r) => setTimeout(r, 2000));

        // Measure HMR
        console.log(`    Testing HMR...`);
        const hmrMs = await measureHMR(fw);
        if (hmrMs > 0) {
          hmrTimes.push(hmrMs);
          console.log(`    HMR: ${formatMs(hmrMs)}`);
        } else {
          console.log(`    HMR: timeout`);
        }
      } catch (err) {
        console.error(`    Error: ${err}`);
      } finally {
        proc.kill();
        await killPortProcess(fw.port);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const fwResult = {
      framework: fw.name,
      devColdStartMs: computeStats(coldStartTimes),
      hmrMs: computeStats(hmrTimes),
    };

    results.push(fwResult);

    console.log(`\n  ${fw.name} Summary:`);
    if (coldStartTimes.length > 0) {
      console.log(`    Dev cold start: ${formatMs(fwResult.devColdStartMs.mean)} (±${formatMs(fwResult.devColdStartMs.stddev)})`);
    }
    if (hmrTimes.length > 0) {
      console.log(`    HMR: ${formatMs(fwResult.hmrMs.mean)} (±${formatMs(fwResult.hmrMs.stddev)})`);
    }
  }

  const outputFile = join(RESULTS_DIR, `startup-${Date.now()}.json`);
  await writeFile(outputFile, JSON.stringify({ frameworks: results, timestamp: Date.now() }, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

if (import.meta.main) {
  const frameworks = process.argv.slice(2);
  await runStartupBenchmark(frameworks.length > 0 ? frameworks : undefined);
}
