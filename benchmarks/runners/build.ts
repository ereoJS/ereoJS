import { spawn } from 'bun';
import { readdir, stat, writeFile, mkdir, appendFile } from 'fs/promises';
import { join } from 'path';
import { computeStats, formatMs, formatBytes } from './utils/stats';

const BENCHMARKS_DIR = join(import.meta.dir, '..');
const APPS_DIR = join(BENCHMARKS_DIR, 'apps');
const RESULTS_DIR = join(BENCHMARKS_DIR, 'results');

interface FrameworkConfig {
  name: string;
  dir: string;
  buildCmd: string[];
  cleanCmd: string[];
  outputDir: string;
  modifyFile: string;
}

const FRAMEWORKS: FrameworkConfig[] = [
  {
    name: 'Ereo',
    dir: join(APPS_DIR, 'ereo-bench'),
    buildCmd: ['bun', 'run', 'build'],
    cleanCmd: ['rm', '-rf', 'dist', '.ereo'],
    outputDir: '.ereo',
    modifyFile: 'app/routes/ssr.tsx',
  },
  {
    name: 'Next.js',
    dir: join(APPS_DIR, 'nextjs-bench'),
    buildCmd: ['npx', 'next', 'build'],
    cleanCmd: ['rm', '-rf', '.next', 'out'],
    outputDir: '.next',
    modifyFile: 'app/ssr/page.tsx',
  },
  {
    name: 'Remix',
    dir: join(APPS_DIR, 'remix-bench'),
    buildCmd: ['npx', 'remix', 'vite:build'],
    cleanCmd: ['rm', '-rf', 'build', '.cache'],
    outputDir: 'build',
    modifyFile: 'app/routes/ssr.tsx',
  },
  {
    name: 'Astro',
    dir: join(APPS_DIR, 'astro-bench'),
    buildCmd: ['npx', 'astro', 'build'],
    cleanCmd: ['rm', '-rf', 'dist', '.astro'],
    outputDir: 'dist',
    modifyFile: 'src/pages/ssr.astro',
  },
];

async function getDirSize(dir: string): Promise<{ js: number; css: number; total: number; fileCount: number }> {
  let js = 0, css = 0, total = 0, fileCount = 0;

  async function walk(d: string) {
    try {
      const entries = await readdir(d, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(d, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const s = await stat(fullPath);
          total += s.size;
          fileCount++;
          if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) js += s.size;
          if (entry.name.endsWith('.css')) css += s.size;
        }
      }
    } catch {
      // directory might not exist
    }
  }

  await walk(dir);
  return { js, css, total, fileCount };
}

async function runBuild(fw: FrameworkConfig): Promise<{ timeMs: number; success: boolean }> {
  const start = performance.now();
  const proc = spawn({
    cmd: fw.buildCmd,
    cwd: fw.dir,
    env: { ...process.env, NODE_ENV: 'production' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const exitCode = await proc.exited;
  const timeMs = performance.now() - start;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error(`  Build failed for ${fw.name}: ${stderr.slice(0, 500)}`);
  }

  return { timeMs, success: exitCode === 0 };
}

async function cleanBuild(fw: FrameworkConfig): Promise<void> {
  const proc = spawn({
    cmd: fw.cleanCmd,
    cwd: fw.dir,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  await proc.exited;
}

async function addCommentToFile(fw: FrameworkConfig): Promise<void> {
  const filePath = join(fw.dir, fw.modifyFile);
  const comment = `\n// Benchmark modification ${Date.now()}\n`;
  await appendFile(filePath, comment);
}

async function removeComment(fw: FrameworkConfig): Promise<void> {
  const filePath = join(fw.dir, fw.modifyFile);
  const content = await Bun.file(filePath).text();
  const cleaned = content.replace(/\n\/\/ Benchmark modification \d+\n/g, '');
  await Bun.write(filePath, cleaned);
}

export async function runBuildBenchmark(frameworks?: string[]): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });

  const activeFrameworks = FRAMEWORKS.filter(
    (fw) => !frameworks || frameworks.includes(fw.name.toLowerCase().replace('.', ''))
  );

  console.log('\n=== Build Performance Benchmark ===\n');

  const iterations = 5;
  const results: any[] = [];

  for (const fw of activeFrameworks) {
    console.log(`\nBenchmarking: ${fw.name}`);
    console.log(`  Directory: ${fw.dir}`);

    const coldTimes: number[] = [];
    const incrementalTimes: number[] = [];
    let bundleInfo = { js: 0, css: 0, total: 0, fileCount: 0 };

    for (let i = 0; i < iterations; i++) {
      // Cold build
      console.log(`  Iteration ${i + 1}/${iterations} - Cold build...`);
      await cleanBuild(fw);
      const cold = await runBuild(fw);
      if (cold.success) {
        coldTimes.push(cold.timeMs);
        console.log(`    Cold: ${formatMs(cold.timeMs)}`);
      } else {
        console.log(`    Cold: FAILED`);
        break;
      }

      // Measure bundle size on first successful build
      if (i === 0) {
        bundleInfo = await getDirSize(join(fw.dir, fw.outputDir));
        console.log(`    Bundle: JS=${formatBytes(bundleInfo.js)} CSS=${formatBytes(bundleInfo.css)} Total=${formatBytes(bundleInfo.total)} (${bundleInfo.fileCount} files)`);
      }

      // Incremental build
      console.log(`  Iteration ${i + 1}/${iterations} - Incremental build...`);
      await addCommentToFile(fw);
      const incr = await runBuild(fw);
      if (incr.success) {
        incrementalTimes.push(incr.timeMs);
        console.log(`    Incremental: ${formatMs(incr.timeMs)}`);
      }
      await removeComment(fw);
    }

    if (coldTimes.length > 0) {
      results.push({
        framework: fw.name,
        coldBuildMs: computeStats(coldTimes),
        incrementalBuildMs: computeStats(incrementalTimes),
        bundleJS: bundleInfo.js,
        bundleCSS: bundleInfo.css,
        bundleTotal: bundleInfo.total,
        fileCount: bundleInfo.fileCount,
      });

      console.log(`\n  ${fw.name} Summary:`);
      console.log(`    Cold build: ${formatMs(computeStats(coldTimes).mean)} (±${formatMs(computeStats(coldTimes).stddev)})`);
      if (incrementalTimes.length > 0) {
        console.log(`    Incremental: ${formatMs(computeStats(incrementalTimes).mean)} (±${formatMs(computeStats(incrementalTimes).stddev)})`);
      }
    }
  }

  const outputFile = join(RESULTS_DIR, `build-${Date.now()}.json`);
  await writeFile(outputFile, JSON.stringify({ frameworks: results, timestamp: Date.now() }, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

// Run directly
if (import.meta.main) {
  const frameworks = process.argv.slice(2);
  await runBuildBenchmark(frameworks.length > 0 ? frameworks : undefined);
}
