/**
 * @ereo/deploy-vercel - Vercel deployment adapter
 *
 * Configures EreoJS apps for deployment to Vercel (Edge or Node runtime).
 */

import type { FrameworkConfig } from '@ereo/core';

/** Vercel deployment configuration */
export interface VercelConfig {
  /** Use Vercel Edge runtime (default: false = Node.js) */
  edge?: boolean;
  /** Deployment regions */
  regions?: string[];
  /** Function timeout in seconds (max: 900 for Node, 30 for Edge) */
  timeout?: number;
  /** Memory allocation (128MB - 3008MB for Node, 1024MB-4096MB for Edge) */
  memory?: number;
  /** Environment variables to set */
  env?: Record<string, string>;
}

/** Generate Vercel configuration */
export function vercel(config: VercelConfig = {}): Partial<FrameworkConfig> {
  return {
    build: {
      target: config.edge ? 'edge' : 'node',
    },
    // Vercel-specific settings would be applied during build
  };
}

/** Generate vercel.json configuration file */
export function generateVercelJson(config: VercelConfig): string {
  const vercelJson: Record<string, unknown> = {
    version: 2,
    builds: [
      {
        src: 'dist/server.js',
        use: config.edge ? '@vercel/edge' : '@vercel/node',
        config: {
          includeFiles: ['dist/**'],
        },
      },
    ],
    routes: [
      {
        src: '/(.*)',
        dest: 'dist/server.js',
      },
    ],
  };

  // Function-level config (regions, runtime, memory, timeout)
  const fnConfig: Record<string, unknown> = {};
  if (config.edge) fnConfig.runtime = 'edge';
  if (config.regions) fnConfig.regions = config.regions;
  if (config.memory) fnConfig.memory = config.memory;
  if (config.timeout) fnConfig.maxDuration = config.timeout;

  if (Object.keys(fnConfig).length > 0) {
    vercelJson.functions = { 'dist/server.js': fnConfig };
  }

  return JSON.stringify(vercelJson, null, 2);
}

/** Generate build script for Vercel */
export function generateBuildScript(): string {
  return `#!/bin/bash
# Vercel build script for EreoJS framework

set -e

echo "Building for Vercel..."

# Install dependencies
bun install

# Build the application
bun run build

# Copy static assets to dist
mkdir -p dist/public
cp -r public/* dist/public/ 2>/dev/null || true

echo "Build complete!"
`;
}

export default vercel;
