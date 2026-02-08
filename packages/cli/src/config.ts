/**
 * @ereo/cli - Config Resolution
 *
 * Shared config file resolution for all CLI commands.
 * Supports ereo.config.{ts,js,mts,mjs} with proper fallback.
 */

import { join } from 'node:path';
import type { FrameworkConfig } from '@ereo/core';

/**
 * Supported config file extensions in priority order.
 */
const CONFIG_EXTENSIONS = ['.ts', '.js', '.mts', '.mjs'] as const;

/**
 * Resolve and load the ereo config file from the project root.
 *
 * Tries ereo.config.{ts,js,mts,mjs} in order.
 * Returns the loaded config and the resolved path (if found).
 */
export async function loadConfig(root: string): Promise<{
  config: FrameworkConfig;
  configPath: string | null;
}> {
  for (const ext of CONFIG_EXTENSIONS) {
    const configPath = join(root, `ereo.config${ext}`);
    try {
      if (await Bun.file(configPath).exists()) {
        const configModule = await import(configPath);
        const config = configModule.default || configModule;
        return { config, configPath };
      }
    } catch (error) {
      console.warn(`Could not load config (${configPath}):`, error);
      return { config: {}, configPath: null };
    }
  }

  return { config: {}, configPath: null };
}
