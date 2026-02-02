/**
 * @oreo/cli - Build Command
 *
 * Build the project for production.
 */

import { join } from 'node:path';
import { build as bundlerBuild, printBuildReport, type BuildOptions } from '@oreo/bundler';
import type { FrameworkConfig } from '@oreo/core';

/**
 * Build command options.
 */
export interface BuildCommandOptions {
  outDir?: string;
  minify?: boolean;
  sourcemap?: boolean;
}

/**
 * Run the build command.
 */
export async function build(options: BuildCommandOptions = {}): Promise<void> {
  const root = process.cwd();

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mOreo\x1b[0m Production Build\n');

  // Load config if exists
  let config: FrameworkConfig = {};
  const configPath = join(root, 'oreo.config.ts');

  try {
    if (await Bun.file(configPath).exists()) {
      const configModule = await import(configPath);
      config = configModule.default || configModule;
    }
  } catch (error) {
    console.warn('Could not load config:', error);
  }

  // Merge options
  const buildOptions: BuildOptions = {
    root,
    outDir: options.outDir || config.build?.outDir || '.oreo',
    minify: options.minify ?? config.build?.minify ?? true,
    sourcemap: options.sourcemap ?? config.build?.sourcemap ?? true,
    target: config.build?.target || 'bun',
  };

  console.log(`  Target: ${buildOptions.target}`);
  console.log(`  Output: ${buildOptions.outDir}`);
  console.log('');

  // Run build
  const result = await bundlerBuild(buildOptions);

  if (result.success) {
    printBuildReport(result);
    console.log('\n  \x1b[32m✓\x1b[0m Build completed successfully\n');
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
