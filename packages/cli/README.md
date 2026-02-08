# @ereo/cli

Command-line interface for the EreoJS framework. Provides commands for development, building, and deployment of EreoJS applications.

## Installation

```bash
bun add -g @ereo/cli
```

Or run directly with:

```bash
bunx @ereo/cli <command>
```

## Quick Start

```bash
# Start development server
ereo dev

# Build for production
ereo build

# Start production server
ereo start

# Create a new project
ereo create my-app

# Deploy to production
ereo deploy vercel --prod

# Database commands
ereo db:generate --name add_users
ereo db:migrate
ereo db:studio
```

## Commands

### `ereo dev`

Start the development server with hot module replacement.

```bash
ereo dev --port 8080 --open
```

Options:
- `--port, -p` - Port number (default: 3000)
- `--host, -h` - Host name (default: localhost)
- `--open, -o` - Open browser automatically

### `ereo build`

Build the application for production.

```bash
ereo build --minify --sourcemap
```

Options:
- `--outDir` - Output directory (default: .ereo)
- `--minify` - Enable minification (default: true)
- `--sourcemap` - Generate sourcemaps (default: true)

### `ereo create`

Scaffold a new EreoJS project.

```bash
ereo create my-app --template tailwind
```

Options:
- `--template, -t` - Template (minimal, default, tailwind)
- `--typescript` - Use TypeScript (default: true)

### `ereo deploy`

Deploy to production platforms.

```bash
ereo deploy vercel --prod
ereo deploy cloudflare --dry-run
```

Options:
- `--prod` - Deploy to production
- `--dry-run` - Preview deployment without executing
- `--name` - Project name for new deployments
- `--no-build` - Skip build step

### `ereo start`

Start the production server (requires prior build).

```bash
ereo start --port 3001
```

Options:
- `--port, -p` - Port number (default: 3000)
- `--host, -h` - Host name (default: 0.0.0.0)

### Database Commands

Commands for database management using Drizzle Kit.

```bash
# Generate migration from schema changes
ereo db:generate --name add_users_table

# Run pending migrations
ereo db:migrate

# Open Drizzle Studio GUI
ereo db:studio

# Push schema directly (dev only)
ereo db:push

# Run database seeders
ereo db:seed
```

#### db:migrate Options
- `--config` - Path to drizzle config file
- `--verbose, -v` - Enable verbose output

#### db:generate Options
- `--name` - Migration name (required)
- `--config` - Path to drizzle config file
- `--out` - Output directory for migrations

#### db:studio Options
- `--port` - Port for Drizzle Studio
- `--config` - Path to drizzle config file

#### db:push Options
- `--config` - Path to drizzle config file
- `--force, -f` - Skip confirmation prompts
- `--verbose, -v` - Enable verbose output

#### db:seed Options
- `--file` - Path to seed file
- `--reset, -r` - Reset database before seeding

## Key Features

- Hot module replacement for fast development
- Production-optimized builds with Bun
- Multiple deployment target support
- Project scaffolding with templates
- TypeScript support out of the box

## Documentation

For full documentation, visit [https://ereojs.github.io/ereoJS/api/cli/](https://ereojs.github.io/ereoJS/api/cli/)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/ereoJS/ereoJS).

## License

MIT
