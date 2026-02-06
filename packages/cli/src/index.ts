#!/usr/bin/env bun
/**
 * @ereo/cli
 *
 * Command-line interface for the EreoJS framework.
 */

import { dev, type DevOptions } from './commands/dev';
import { build, type BuildCommandOptions } from './commands/build';
import { start, type StartOptions } from './commands/start';
import { create, type CreateOptions } from './commands/create';
import { deploy, printDeployHelp, type DeployOptions, type DeployTarget, type DeployResult } from './commands/deploy';
import {
  dbMigrate,
  dbGenerate,
  dbStudio,
  dbPush,
  dbSeed,
  printDbHelp,
  type DbMigrateOptions,
  type DbGenerateOptions,
  type DbStudioOptions,
  type DbPushOptions,
  type DbSeedOptions,
} from './commands/db';
import { join, dirname } from 'node:path';

/**
 * CLI version — read from package.json so it stays in sync after releases.
 */
const pkgJsonPath = join(dirname(import.meta.dir), 'package.json');
const VERSION = (await Bun.file(pkgJsonPath).json()).version as string;

/**
 * Print help message.
 */
function printHelp(): void {
  console.log(`
  \x1b[36m⬡\x1b[0m \x1b[1mEreo\x1b[0m - React Fullstack Framework

  \x1b[1mUsage:\x1b[0m
    ereo <command> [options]

  \x1b[1mCommands:\x1b[0m
    dev         Start development server
    build       Build for production
    start       Start production server
    create      Create new project
    deploy      Deploy to production
    db:*        Database commands (db:migrate, db:generate, db:studio, db:push, db:seed)

  \x1b[1mDev Options:\x1b[0m
    --port, -p  Port number (default: 3000)
    --host, -h  Host name (default: localhost)
    --open, -o  Open browser

  \x1b[1mBuild Options:\x1b[0m
    --outDir    Output directory (default: .ereo)
    --minify    Enable minification (default: true)
    --sourcemap Generate sourcemaps (default: true)

  \x1b[1mStart Options:\x1b[0m
    --port, -p  Port number (default: 3000)
    --host, -h  Host name (default: 0.0.0.0)

  \x1b[1mCreate Options:\x1b[0m
    --template, -t  Template (minimal, default, tailwind)
    --typescript    Use TypeScript (default: true)

  \x1b[1mDeploy Options:\x1b[0m
    --prod      Deploy to production
    --dry-run   Preview deployment
    --name      Project name

  \x1b[1mDatabase Commands:\x1b[0m
    ereo db:migrate           Run pending migrations
    ereo db:generate --name   Generate migration from schema
    ereo db:studio            Open Drizzle Studio
    ereo db:push              Push schema (dev only)
    ereo db:seed              Run database seeders

  \x1b[1mExamples:\x1b[0m
    ereo dev --port 8080
    ereo build --minify
    ereo start --port 3001
    ereo create my-app --template tailwind
    ereo deploy vercel --prod
    ereo db:generate --name add_users

  Version: ${VERSION}
`);
}

/**
 * Parse command line arguments.
 */
function parseArgs(args: string[]): {
  command: string;
  options: Record<string, string | boolean>;
  positional: string[];
} {
  const options: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (!command && !arg.startsWith('-')) {
      command = arg;
      continue;
    }

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        options[key] = value;
      } else if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options[key] = args[++i];
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options[key] = args[++i];
      } else {
        options[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, options, positional };
}

/**
 * Main CLI entry point.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log(VERSION);
    return;
  }

  const { command, options, positional } = parseArgs(args);

  try {
    switch (command) {
      case 'dev': {
        const devOptions: DevOptions = {
          port: options.port ? parseInt(options.port as string, 10) : undefined,
          host: (options.host || options.h) as string | undefined,
          open: !!(options.open || options.o),
        };
        await dev(devOptions);
        break;
      }

      case 'build': {
        const buildOptions: BuildCommandOptions = {
          outDir: options.outDir as string | undefined,
          minify: options.minify === 'false' ? false : true,
          sourcemap: options.sourcemap === 'false' ? false : true,
        };
        await build(buildOptions);
        break;
      }

      case 'start': {
        const startOptions: StartOptions = {
          port: options.port ? parseInt(options.port as string, 10) : undefined,
          host: (options.host || options.h) as string | undefined,
        };
        await start(startOptions);
        break;
      }

      case 'create': {
        const projectName = positional[0];
        if (!projectName) {
          console.error('\n  \x1b[31m✗\x1b[0m Please provide a project name\n');
          console.log('  Usage: ereo create <project-name> [options]\n');
          process.exit(1);
        }

        const createOptions: CreateOptions = {
          template: (options.template || options.t) as CreateOptions['template'],
          typescript: options.typescript !== 'false',
          version: VERSION,
        };
        await create(projectName, createOptions);
        break;
      }

      case 'deploy': {
        if (options.help || options.h) {
          printDeployHelp();
          break;
        }

        const target = positional[0] as DeployTarget | undefined;
        const deployOptions: DeployOptions = {
          target,
          production: !!(options.prod || options.production),
          dryRun: !!(options['dry-run'] || options.dryRun),
          name: options.name as string | undefined,
          build: options['no-build'] ? false : true,
        };

        const result = await deploy(deployOptions);
        if (!result.success) {
          console.error(`\n  \x1b[31m✗\x1b[0m ${result.error}\n`);
          process.exit(1);
        }
        break;
      }

      // Database commands
      case 'db:migrate': {
        const migrateOptions: DbMigrateOptions = {
          config: options.config as string | undefined,
          verbose: !!(options.verbose || options.v),
        };
        await dbMigrate(migrateOptions);
        break;
      }

      case 'db:generate': {
        const generateOptions: DbGenerateOptions = {
          name: (options.name || positional[0]) as string,
          config: options.config as string | undefined,
          out: options.out as string | undefined,
        };
        await dbGenerate(generateOptions);
        break;
      }

      case 'db:studio': {
        const studioOptions: DbStudioOptions = {
          port: options.port ? parseInt(options.port as string, 10) : undefined,
          config: options.config as string | undefined,
          open: options.open !== false,
        };
        await dbStudio(studioOptions);
        break;
      }

      case 'db:push': {
        const pushOptions: DbPushOptions = {
          config: options.config as string | undefined,
          force: !!(options.force || options.f),
          verbose: !!(options.verbose || options.v),
        };
        await dbPush(pushOptions);
        break;
      }

      case 'db:seed': {
        const seedOptions: DbSeedOptions = {
          file: options.file as string | undefined,
          reset: !!(options.reset || options.r),
        };
        await dbSeed(seedOptions);
        break;
      }

      case 'db':
      case 'db:help': {
        printDbHelp();
        break;
      }

      default:
        // Check if it's a db: command we don't recognize
        if (command.startsWith('db:')) {
          console.error(`\n  \x1b[31m✗\x1b[0m Unknown database command: ${command}\n`);
          printDbHelp();
          process.exit(1);
        }
        console.error(`\n  \x1b[31m✗\x1b[0m Unknown command: ${command}\n`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('\n  \x1b[31m✗\x1b[0m Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Export commands for programmatic use
export { dev, build, start, create, deploy };
export { dbMigrate, dbGenerate, dbStudio, dbPush, dbSeed };
export type { DevOptions, BuildCommandOptions, StartOptions, CreateOptions, DeployOptions, DeployTarget, DeployResult };
export type { DbMigrateOptions, DbGenerateOptions, DbStudioOptions, DbPushOptions, DbSeedOptions };

// Run CLI
main().catch(console.error);
