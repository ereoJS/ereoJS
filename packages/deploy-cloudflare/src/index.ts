/**
 * @ereo/deploy-cloudflare - Cloudflare deployment adapter
 */

import type { FrameworkConfig } from '@ereo/core';

/** Cloudflare deployment configuration */
export interface CloudflareConfig {
  /** Deployment target: 'pages' or 'workers' */
  target?: 'pages' | 'workers';
  /** Account ID */
  accountId?: string;
  /** Custom domains */
  routes?: string[];
  /** KV namespace bindings */
  kvNamespaces?: string[];
  /** Durable Object bindings */
  durableObjects?: string[];
}

/** Generate Cloudflare configuration */
export function cloudflare(config: CloudflareConfig = {}): Partial<FrameworkConfig> {
  return {
    build: {
      target: 'cloudflare',
    },
  };
}

/** Generate wrangler.toml configuration */
export function generateWranglerToml(config: CloudflareConfig): string {
  const lines = [
    'name = "ereo-app"',
    'compatibility_date = "2024-01-01"',
    'main = "dist/server.js"',
  ];

  if (config.routes) {
    for (const route of config.routes) {
      lines.push('');
      lines.push('[[routes]]');
      lines.push(`pattern = "${route}"`);
    }
  }

  if (config.kvNamespaces) {
    for (const ns of config.kvNamespaces) {
      lines.push('');
      lines.push('[[kv_namespaces]]');
      lines.push(`binding = "${ns}"`);
      lines.push('id = "your-namespace-id"');
    }
  }

  return lines.join('\n') + '\n';
}

export default cloudflare;
