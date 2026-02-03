/**
 * @ereo/cli - Deploy Command
 *
 * One-command deployment to various platforms.
 */

import { join } from 'node:path';
import { type FrameworkConfig } from '@ereo/core';

/**
 * Supported deployment targets.
 */
export type DeployTarget = 'vercel' | 'cloudflare' | 'fly' | 'netlify' | 'docker';

/**
 * Deploy command options.
 */
export interface DeployOptions {
  /** Target platform */
  target?: DeployTarget;
  /** Build before deploying */
  build?: boolean;
  /** Production mode */
  production?: boolean;
  /** Dry run (don't actually deploy) */
  dryRun?: boolean;
  /** Environment variables */
  env?: Record<string, string>;
  /** Project name (for new deployments) */
  name?: string;
}

/**
 * Deploy result.
 */
export interface DeployResult {
  success: boolean;
  url?: string;
  deploymentId?: string;
  logs?: string[];
  error?: string;
}

/**
 * Run the deploy command.
 */
export async function deploy(options: DeployOptions = {}): Promise<DeployResult> {
  const root = process.cwd();
  const target = options.target || await detectTarget(root);

  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mEreo\x1b[0m Deploy\n');
  console.log(`  Target: \x1b[33m${target}\x1b[0m\n`);

  // Load config
  let config: FrameworkConfig = {};
  const configPath = join(root, 'ereo.config.ts');

  try {
    if (await Bun.file(configPath).exists()) {
      const configModule = await import(configPath);
      config = configModule.default || configModule;
    }
  } catch (error) {
    console.warn('Could not load config:', error);
  }

  // Build if needed
  if (options.build !== false) {
    console.log('  \x1b[2mBuilding for production...\x1b[0m');
    const { build } = await import('./build');
    await build({ production: true });
    console.log('  \x1b[32m✓\x1b[0m Build complete\n');
  }

  // Dry run check
  if (options.dryRun) {
    console.log('  \x1b[33m⚠\x1b[0m Dry run - skipping actual deployment\n');
    return generateDeployPreview(target, root, config);
  }

  // Deploy based on target
  try {
    switch (target) {
      case 'vercel':
        return await deployToVercel(root, options);
      case 'cloudflare':
        return await deployToCloudflare(root, options);
      case 'fly':
        return await deployToFly(root, options);
      case 'netlify':
        return await deployToNetlify(root, options);
      case 'docker':
        return await deployToDocker(root, options);
      default:
        return {
          success: false,
          error: `Unknown deployment target: ${target}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Detect deployment target from project files.
 */
async function detectTarget(root: string): Promise<DeployTarget> {
  // Check for existing config files
  if (await Bun.file(join(root, 'vercel.json')).exists()) {
    return 'vercel';
  }
  if (await Bun.file(join(root, 'wrangler.toml')).exists()) {
    return 'cloudflare';
  }
  if (await Bun.file(join(root, 'fly.toml')).exists()) {
    return 'fly';
  }
  if (await Bun.file(join(root, 'netlify.toml')).exists()) {
    return 'netlify';
  }
  if (await Bun.file(join(root, 'Dockerfile')).exists()) {
    return 'docker';
  }

  // Default to Vercel
  return 'vercel';
}

/**
 * Generate deployment preview (dry run).
 */
function generateDeployPreview(
  target: DeployTarget,
  root: string,
  config: FrameworkConfig
): DeployResult {
  const logs: string[] = [];

  logs.push(`Would deploy to ${target}`);
  logs.push(`Project root: ${root}`);
  logs.push(`Build target: ${config.build?.target || 'bun'}`);
  logs.push(`Output directory: ${config.build?.outDir || 'dist'}`);

  console.log('  Preview:');
  for (const log of logs) {
    console.log(`    ${log}`);
  }
  console.log('');

  return {
    success: true,
    logs,
  };
}

/**
 * Deploy to Vercel.
 */
async function deployToVercel(root: string, options: DeployOptions): Promise<DeployResult> {
  console.log('  Deploying to Vercel...\n');

  // Check for Vercel CLI
  const hasVercelCLI = await checkCommand('vercel');
  if (!hasVercelCLI) {
    console.log('  \x1b[33m⚠\x1b[0m Vercel CLI not found. Installing...\n');
    await runCommand('bun', ['add', '-g', 'vercel']);
  }

  // Generate vercel.json if needed
  const vercelConfigPath = join(root, 'vercel.json');
  if (!(await Bun.file(vercelConfigPath).exists())) {
    const vercelConfig = {
      buildCommand: 'bun run build',
      outputDirectory: 'dist',
      framework: null,
      functions: {
        'api/**/*.ts': {
          runtime: '@vercel/bun@0.1.0',
        },
      },
    };
    await Bun.write(vercelConfigPath, JSON.stringify(vercelConfig, null, 2));
    console.log('  \x1b[32m✓\x1b[0m Generated vercel.json\n');
  }

  // Deploy
  const args = ['deploy'];
  if (options.production) {
    args.push('--prod');
  }
  if (options.name) {
    args.push('--name', options.name);
  }

  const result = await runCommandWithOutput('vercel', args, root);

  if (result.success) {
    // Extract URL from output
    const urlMatch = result.output.match(/https:\/\/[^\s]+\.vercel\.app/);
    const url = urlMatch ? urlMatch[0] : undefined;

    console.log(`\n  \x1b[32m✓\x1b[0m Deployed successfully!`);
    if (url) {
      console.log(`  \x1b[36m➜\x1b[0m ${url}\n`);
    }

    return {
      success: true,
      url,
      logs: [result.output],
    };
  }

  return {
    success: false,
    error: result.error || 'Deployment failed',
    logs: [result.output],
  };
}

/**
 * Deploy to Cloudflare Pages/Workers.
 */
async function deployToCloudflare(root: string, options: DeployOptions): Promise<DeployResult> {
  console.log('  Deploying to Cloudflare...\n');

  // Check for Wrangler CLI
  const hasWrangler = await checkCommand('wrangler');
  if (!hasWrangler) {
    console.log('  \x1b[33m⚠\x1b[0m Wrangler CLI not found. Installing...\n');
    await runCommand('bun', ['add', '-g', 'wrangler']);
  }

  // Generate wrangler.toml if needed
  const wranglerConfigPath = join(root, 'wrangler.toml');
  if (!(await Bun.file(wranglerConfigPath).exists())) {
    const projectName = options.name || 'ereo-app';
    const wranglerConfig = `name = "${projectName}"
main = "dist/server/index.js"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist/client"

[build]
command = "bun run build"
`;
    await Bun.write(wranglerConfigPath, wranglerConfig);
    console.log('  \x1b[32m✓\x1b[0m Generated wrangler.toml\n');
  }

  // Deploy
  const result = await runCommandWithOutput('wrangler', ['deploy'], root);

  if (result.success) {
    const urlMatch = result.output.match(/https:\/\/[^\s]+\.workers\.dev/);
    const url = urlMatch ? urlMatch[0] : undefined;

    console.log(`\n  \x1b[32m✓\x1b[0m Deployed successfully!`);
    if (url) {
      console.log(`  \x1b[36m➜\x1b[0m ${url}\n`);
    }

    return {
      success: true,
      url,
      logs: [result.output],
    };
  }

  return {
    success: false,
    error: result.error || 'Deployment failed',
    logs: [result.output],
  };
}

/**
 * Deploy to Fly.io.
 */
async function deployToFly(root: string, options: DeployOptions): Promise<DeployResult> {
  console.log('  Deploying to Fly.io...\n');

  // Check for Fly CLI
  const hasFly = await checkCommand('flyctl');
  if (!hasFly) {
    console.log('  \x1b[33m⚠\x1b[0m Fly CLI not found.');
    console.log('  Install from: https://fly.io/docs/hands-on/install-flyctl/\n');
    return {
      success: false,
      error: 'Fly CLI not installed',
    };
  }

  // Generate fly.toml if needed
  const flyConfigPath = join(root, 'fly.toml');
  if (!(await Bun.file(flyConfigPath).exists())) {
    const projectName = options.name || 'ereo-app';
    const flyConfig = `app = "${projectName}"
primary_region = "iad"

[build]
  builder = "oven/bun"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
`;
    await Bun.write(flyConfigPath, flyConfig);
    console.log('  \x1b[32m✓\x1b[0m Generated fly.toml\n');
  }

  // Deploy
  const result = await runCommandWithOutput('flyctl', ['deploy'], root);

  if (result.success) {
    const urlMatch = result.output.match(/https:\/\/[^\s]+\.fly\.dev/);
    const url = urlMatch ? urlMatch[0] : undefined;

    console.log(`\n  \x1b[32m✓\x1b[0m Deployed successfully!`);
    if (url) {
      console.log(`  \x1b[36m➜\x1b[0m ${url}\n`);
    }

    return {
      success: true,
      url,
      logs: [result.output],
    };
  }

  return {
    success: false,
    error: result.error || 'Deployment failed',
    logs: [result.output],
  };
}

/**
 * Deploy to Netlify.
 */
async function deployToNetlify(root: string, options: DeployOptions): Promise<DeployResult> {
  console.log('  Deploying to Netlify...\n');

  // Check for Netlify CLI
  const hasNetlify = await checkCommand('netlify');
  if (!hasNetlify) {
    console.log('  \x1b[33m⚠\x1b[0m Netlify CLI not found. Installing...\n');
    await runCommand('bun', ['add', '-g', 'netlify-cli']);
  }

  // Generate netlify.toml if needed
  const netlifyConfigPath = join(root, 'netlify.toml');
  if (!(await Bun.file(netlifyConfigPath).exists())) {
    const netlifyConfig = `[build]
  command = "bun run build"
  publish = "dist/client"
  functions = "dist/server"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`;
    await Bun.write(netlifyConfigPath, netlifyConfig);
    console.log('  \x1b[32m✓\x1b[0m Generated netlify.toml\n');
  }

  // Deploy
  const args = ['deploy', '--dir=dist/client'];
  if (options.production) {
    args.push('--prod');
  }

  const result = await runCommandWithOutput('netlify', args, root);

  if (result.success) {
    const urlMatch = result.output.match(/https:\/\/[^\s]+\.netlify\.app/);
    const url = urlMatch ? urlMatch[0] : undefined;

    console.log(`\n  \x1b[32m✓\x1b[0m Deployed successfully!`);
    if (url) {
      console.log(`  \x1b[36m➜\x1b[0m ${url}\n`);
    }

    return {
      success: true,
      url,
      logs: [result.output],
    };
  }

  return {
    success: false,
    error: result.error || 'Deployment failed',
    logs: [result.output],
  };
}

/**
 * Build and export Docker image.
 */
async function deployToDocker(root: string, options: DeployOptions): Promise<DeployResult> {
  console.log('  Building Docker image...\n');

  // Check for Docker
  const hasDocker = await checkCommand('docker');
  if (!hasDocker) {
    return {
      success: false,
      error: 'Docker not installed',
    };
  }

  // Generate Dockerfile if needed
  const dockerfilePath = join(root, 'Dockerfile');
  if (!(await Bun.file(dockerfilePath).exists())) {
    const dockerfile = `# Build stage
FROM oven/bun:1 as builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]
`;
    await Bun.write(dockerfilePath, dockerfile);
    console.log('  \x1b[32m✓\x1b[0m Generated Dockerfile\n');
  }

  // Build image
  const imageName = options.name || 'ereo-app';
  const tag = options.production ? 'latest' : 'dev';

  const result = await runCommandWithOutput(
    'docker',
    ['build', '-t', `${imageName}:${tag}`, '.'],
    root
  );

  if (result.success) {
    console.log(`\n  \x1b[32m✓\x1b[0m Docker image built: ${imageName}:${tag}`);
    console.log(`  Run with: docker run -p 3000:3000 ${imageName}:${tag}\n`);

    return {
      success: true,
      deploymentId: `${imageName}:${tag}`,
      logs: [result.output],
    };
  }

  return {
    success: false,
    error: result.error || 'Docker build failed',
    logs: [result.output],
  };
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if a command exists.
 */
async function checkCommand(command: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['which', command], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Run a command.
 */
async function runCommand(command: string, args: string[]): Promise<boolean> {
  const proc = Bun.spawn([command, ...args], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await proc.exited;
  return proc.exitCode === 0;
}

/**
 * Run a command and capture output.
 */
async function runCommandWithOutput(
  command: string,
  args: string[],
  cwd?: string
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const proc = Bun.spawn([command, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    return {
      success: proc.exitCode === 0,
      output: stdout,
      error: stderr || undefined,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Print deploy help.
 */
export function printDeployHelp(): void {
  console.log(`
  Usage: ereo deploy [target] [options]

  Targets:
    vercel       Deploy to Vercel (default)
    cloudflare   Deploy to Cloudflare Pages/Workers
    fly          Deploy to Fly.io
    netlify      Deploy to Netlify
    docker       Build Docker image

  Options:
    --prod       Deploy to production
    --dry-run    Preview deployment without actually deploying
    --name       Project name for new deployments
    --no-build   Skip build step

  Examples:
    ereo deploy                    Deploy to auto-detected platform
    ereo deploy vercel --prod      Deploy to Vercel production
    ereo deploy cloudflare         Deploy to Cloudflare
    ereo deploy docker --name app  Build Docker image named 'app'
  `);
}
