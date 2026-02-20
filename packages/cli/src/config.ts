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
        const config = 'default' in configModule ? configModule.default : configModule;
        return { config, configPath };
      }
    } catch (error: any) {
      // Only swallow file-not-found; re-throw syntax/import errors so devs
      // see the real problem instead of silently running with empty config.
      if (error?.code === 'ENOENT' || error?.code === 'MODULE_NOT_FOUND') {
        continue;
      }
      throw new Error(`Failed to load config (${configPath}): ${error?.message || error}`);
    }
  }

  return { config: {}, configPath: null };
}
