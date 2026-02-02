/**
 * @oreo/deploy-cloudflare - Cloudflare deployment adapter
 */

import type { FrameworkConfig } from '@oreo/core';

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
  const bindings = [];

  if (config.kvNamespaces) {
    for (const ns of config.kvNamespaces) {
      bindings.push(`[[kv_namespaces]]
binding = "${ns}"
id = "your-namespace-id"`);
    }
  }

  return `name = "oreo-app"
compatibility_date = "2024-01-01"
main = "dist/server.js"

${config.routes ? `routes = ${JSON.stringify(config.routes)}` : ''}

${bindings.join('\n\n')}
`;
}

export default cloudflare;
