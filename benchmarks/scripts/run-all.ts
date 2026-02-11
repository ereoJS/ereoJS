import { runBuildBenchmark } from '../runners/build';
import { runServerBenchmark } from '../runners/server';
import { runClientBenchmark } from '../runners/client';
import { runStartupBenchmark } from '../runners/startup';
import { generateReport, writeReport } from '../runners/utils/report';

function parseArgs(args: string[]): { categories: string[]; frameworks?: string[] } {
  const categories: string[] = [];
  let frameworks: string[] | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--build') categories.push('build');
    else if (arg === '--server') categories.push('server');
    else if (arg === '--client') categories.push('client');
    else if (arg === '--startup') categories.push('startup');
    else if (arg === '--frameworks' && args[i + 1]) {
      frameworks = args[++i].split(',').map((f) => f.trim().toLowerCase());
    }
  }

  // Default: run all categories
  if (categories.length === 0) {
    categories.push('build', 'server', 'client', 'startup');
  }

  return { categories, frameworks };
}

async function main() {
  const args = process.argv.slice(2);
  const { categories, frameworks } = parseArgs(args);

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Ereo Benchmark Suite                       ║');
  console.log('║  Ereo vs Next.js vs Remix vs Astro          ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`Categories: ${categories.join(', ')}`);
  if (frameworks) {
    console.log(`Frameworks: ${frameworks.join(', ')}`);
  }
  console.log('');

  const startTime = performance.now();

  if (categories.includes('build')) {
    await runBuildBenchmark(frameworks);
  }

  if (categories.includes('server')) {
    await runServerBenchmark(frameworks);
  }

  if (categories.includes('client')) {
    await runClientBenchmark(frameworks);
  }

  if (categories.includes('startup')) {
    await runStartupBenchmark(frameworks);
  }

  // Generate report
  console.log('\n=== Generating Report ===\n');
  const report = await generateReport();
  const reportPath = await writeReport(report);
  console.log(`Report written to: ${reportPath}`);

  const totalTime = performance.now() - startTime;
  const minutes = Math.floor(totalTime / 60000);
  const seconds = Math.round((totalTime % 60000) / 1000);
  console.log(`\nTotal time: ${minutes}m ${seconds}s`);
}

main().catch((err) => {
  console.error('Benchmark suite failed:', err);
  process.exit(1);
});
