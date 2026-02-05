/**
 * @ereo/cli - Database Commands
 *
 * CLI commands for database management using Drizzle Kit.
 * These commands delegate to drizzle-kit under the hood.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, join } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface DbMigrateOptions {
  /** Path to drizzle config file */
  config?: string;
  /** Run in verbose mode */
  verbose?: boolean;
}

export interface DbGenerateOptions {
  /** Migration name */
  name: string;
  /** Path to drizzle config file */
  config?: string;
  /** Custom output directory for migrations */
  out?: string;
}

export interface DbStudioOptions {
  /** Port for Drizzle Studio */
  port?: number;
  /** Path to drizzle config file */
  config?: string;
  /** Open browser automatically */
  open?: boolean;
}

export interface DbPushOptions {
  /** Path to drizzle config file */
  config?: string;
  /** Force push without confirmation */
  force?: boolean;
  /** Run in verbose mode */
  verbose?: boolean;
}

export interface DbSeedOptions {
  /** Path to seed file */
  file?: string;
  /** Reset database before seeding */
  reset?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Find the drizzle config file.
 */
function findDrizzleConfig(customPath?: string): string {
  const cwd = process.cwd();

  if (customPath) {
    const absolutePath = resolve(cwd, customPath);
    if (existsSync(absolutePath)) {
      return absolutePath;
    }
    throw new Error(`Config file not found: ${customPath}`);
  }

  // Look for common config file names
  const configNames = [
    'drizzle.config.ts',
    'drizzle.config.js',
    'drizzle.config.mjs',
    'drizzle.config.json',
  ];

  for (const name of configNames) {
    const configPath = join(cwd, name);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  throw new Error(
    'Drizzle config not found. Create a drizzle.config.ts file or specify --config path.'
  );
}

/**
 * Run a drizzle-kit command.
 */
async function runDrizzleKit(
  command: string,
  args: string[] = []
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    console.log(`\n  \x1b[36m▶\x1b[0m Running: drizzle-kit ${command} ${args.join(' ')}\n`);

    // Try using bunx first, fall back to npx
    const runner = existsSync(join(process.cwd(), 'bun.lockb')) ? 'bunx' : 'npx';

    const proc = spawn(runner, ['drizzle-kit', command, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `drizzle-kit ${command} failed with exit code ${code}` });
      }
    });

    proc.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Run pending database migrations.
 *
 * Usage: ereo db:migrate [options]
 */
export async function dbMigrate(options: DbMigrateOptions = {}): Promise<void> {
  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mRunning database migrations...\x1b[0m');

  try {
    const configPath = findDrizzleConfig(options.config);
    const args = ['--config', configPath];

    if (options.verbose) {
      args.push('--verbose');
    }

    const result = await runDrizzleKit('migrate', args);

    if (result.success) {
      console.log('\n  \x1b[32m✓\x1b[0m Migrations completed successfully\n');
    } else {
      console.error(`\n  \x1b[31m✗\x1b[0m ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n  \x1b[31m✗\x1b[0m ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}

/**
 * Generate a new migration from schema changes.
 *
 * Usage: ereo db:generate --name <migration-name> [options]
 */
export async function dbGenerate(options: DbGenerateOptions): Promise<void> {
  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mGenerating migration...\x1b[0m');

  if (!options.name) {
    console.error('\n  \x1b[31m✗\x1b[0m Migration name is required (--name <name>)\n');
    process.exit(1);
  }

  try {
    const configPath = findDrizzleConfig(options.config);
    const args = ['--config', configPath, '--name', options.name];

    if (options.out) {
      args.push('--out', options.out);
    }

    const result = await runDrizzleKit('generate', args);

    if (result.success) {
      console.log(`\n  \x1b[32m✓\x1b[0m Migration "${options.name}" generated successfully\n`);
    } else {
      console.error(`\n  \x1b[31m✗\x1b[0m ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n  \x1b[31m✗\x1b[0m ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}

/**
 * Open Drizzle Studio GUI.
 *
 * Usage: ereo db:studio [options]
 */
export async function dbStudio(options: DbStudioOptions = {}): Promise<void> {
  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mStarting Drizzle Studio...\x1b[0m');

  try {
    const configPath = findDrizzleConfig(options.config);
    const args = ['--config', configPath];

    if (options.port) {
      args.push('--port', options.port.toString());
    }

    // Note: drizzle-kit studio doesn't have a --no-open flag,
    // but we can control browser behavior through env vars if needed

    const result = await runDrizzleKit('studio', args);

    if (!result.success) {
      console.error(`\n  \x1b[31m✗\x1b[0m ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n  \x1b[31m✗\x1b[0m ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}

/**
 * Push schema directly to database (dev only).
 *
 * Usage: ereo db:push [options]
 */
export async function dbPush(options: DbPushOptions = {}): Promise<void> {
  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mPushing schema to database...\x1b[0m');
  console.log('  \x1b[33m⚠\x1b[0m  This should only be used in development\n');

  try {
    const configPath = findDrizzleConfig(options.config);
    const args = ['--config', configPath];

    if (options.force) {
      args.push('--force');
    }

    if (options.verbose) {
      args.push('--verbose');
    }

    const result = await runDrizzleKit('push', args);

    if (result.success) {
      console.log('\n  \x1b[32m✓\x1b[0m Schema pushed successfully\n');
    } else {
      console.error(`\n  \x1b[31m✗\x1b[0m ${result.error}\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n  \x1b[31m✗\x1b[0m ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}

/**
 * Run database seeders.
 *
 * Usage: ereo db:seed [options]
 */
export async function dbSeed(options: DbSeedOptions = {}): Promise<void> {
  console.log('\n  \x1b[36m⬡\x1b[0m \x1b[1mRunning database seeders...\x1b[0m');

  const cwd = process.cwd();

  // Find seed file
  const seedFile = options.file ?? findSeedFile(cwd);

  if (!seedFile) {
    console.error('\n  \x1b[31m✗\x1b[0m No seed file found.');
    console.log('  Create a seed file at one of these locations:');
    console.log('    - db/seed.ts');
    console.log('    - src/db/seed.ts');
    console.log('    - seeds/index.ts');
    console.log('  Or specify a custom path with --file\n');
    process.exit(1);
  }

  console.log(`  Using seed file: ${seedFile}\n`);

  try {
    // Run the seed file with bun or tsx
    const runner = existsSync(join(cwd, 'bun.lockb')) ? 'bun' : 'npx';
    const runArgs = runner === 'bun' ? ['run', seedFile] : ['tsx', seedFile];

    return new Promise((resolve) => {
      const proc = spawn(runner, runArgs, {
        cwd,
        stdio: 'inherit',
        env: {
          ...process.env,
          DB_SEED_RESET: options.reset ? '1' : '',
        },
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('\n  \x1b[32m✓\x1b[0m Seeding completed successfully\n');
          resolve();
        } else {
          console.error(`\n  \x1b[31m✗\x1b[0m Seeding failed with exit code ${code}\n`);
          process.exit(1);
        }
      });

      proc.on('error', (error) => {
        console.error(`\n  \x1b[31m✗\x1b[0m ${error.message}\n`);
        process.exit(1);
      });
    });
  } catch (error) {
    console.error(`\n  \x1b[31m✗\x1b[0m ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
}

/**
 * Find a seed file in common locations.
 */
function findSeedFile(cwd: string): string | null {
  const locations = [
    'db/seed.ts',
    'db/seed.js',
    'src/db/seed.ts',
    'src/db/seed.js',
    'seeds/index.ts',
    'seeds/index.js',
    'drizzle/seed.ts',
    'drizzle/seed.js',
  ];

  for (const loc of locations) {
    const fullPath = join(cwd, loc);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

// ============================================================================
// Help Text
// ============================================================================

/**
 * Print help for database commands.
 */
export function printDbHelp(): void {
  console.log(`
  \x1b[36m⬡\x1b[0m \x1b[1mEreo Database Commands\x1b[0m

  \x1b[1mUsage:\x1b[0m
    ereo db:<command> [options]

  \x1b[1mCommands:\x1b[0m
    db:migrate              Run pending database migrations
    db:generate --name <n>  Generate migration from schema changes
    db:studio               Open Drizzle Studio GUI
    db:push                 Push schema directly (dev only)
    db:seed                 Run database seeders

  \x1b[1mMigrate Options:\x1b[0m
    --config <path>   Path to drizzle config file
    --verbose         Enable verbose output

  \x1b[1mGenerate Options:\x1b[0m
    --name <name>     Migration name (required)
    --config <path>   Path to drizzle config file
    --out <dir>       Output directory for migrations

  \x1b[1mStudio Options:\x1b[0m
    --port <port>     Port for Drizzle Studio
    --config <path>   Path to drizzle config file

  \x1b[1mPush Options:\x1b[0m
    --config <path>   Path to drizzle config file
    --force           Skip confirmation prompts
    --verbose         Enable verbose output

  \x1b[1mSeed Options:\x1b[0m
    --file <path>     Path to seed file
    --reset           Reset database before seeding

  \x1b[1mExamples:\x1b[0m
    ereo db:generate --name add_users_table
    ereo db:migrate
    ereo db:studio --port 4000
    ereo db:push --force
    ereo db:seed --reset
`);
}
