/**
 * @ereo/cli - Build Command
 *
 * Build the project for production.
 */

import { join } from 'node:path';
import type { BuildOptions } from '@ereo/bundler';
import type { FrameworkConfig } from '@ereo/core';
import { loadConfig } from '../config';

/**
 * Build command options.
 */
export interface BuildCommandOptions {
  outDir?: string;
  minify?: boolean;
  sourcemap?: boolean;
  production?: boolean;
}

/**
 * Run the build command.
 */
export async function build(options: BuildCommandOptions = {}): Promise<void> {
  const root = process.cwd();

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mEreo\x1b[0m Production Build\n');

  // Load config if exists
  const { config } = await loadConfig(root);

  // Map config target to bundler target
  const configTarget = config.build?.target || 'bun';
  const bundlerTarget = (['bun', 'node', 'browser'].includes(configTarget) ? configTarget : 'bun') as 'bun' | 'node' | 'browser';

  // Merge options
  const buildOptions: BuildOptions = {
    root,
    outDir: options.outDir || config.build?.outDir || '.ereo',
    minify: options.minify ?? config.build?.minify ?? true,
    sourcemap: options.sourcemap ?? config.build?.sourcemap ?? true,
    target: bundlerTarget,
  };

  console.log(`  Target: ${buildOptions.target}`);
  console.log(`  Output: ${buildOptions.outDir}`);
  console.log('');

  // Lazy-load bundler (not needed by start command)
  const { build: bundlerBuild, printBuildReport } = await import('@ereo/bundler');

  // Run build
  const result = await bundlerBuild(buildOptions);

  if (result.success) {
    printBuildReport(result);
    console.log('\n  \x1b[32m✓\x1b[0m Build completed successfully\n');
    process.exit(0);
  } else {
    console.error('\n  \x1b[31m✗\x1b[0m Build failed\n');
    if (result.errors) {
      for (const error of result.errors) {
        console.error(`  ${error}`);
      }
    }
    process.exit(1);
  }
}
