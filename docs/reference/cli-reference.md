# CLI Reference

Complete reference for the EreoJS command-line interface.

## ereo dev

Start the development server with hot reloading.

```bash
ereo dev [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port`, `-p` | `3000` | Port to listen on |
| `--host`, `-H` | `localhost` | Host to bind to |
| `--open`, `-o` | `false` | Open the browser automatically |
| `--https` | `false` | Enable HTTPS with self-signed certificate |
| `--inspect` | `false` | Enable Bun debugger |

Examples:

```bash
# Start on port 4000
ereo dev --port 4000

# Bind to all interfaces (for Docker/LAN access)
ereo dev --host 0.0.0.0

# Open browser and use HTTPS
ereo dev --open --https

# Enable debugger
ereo dev --inspect
```

The dev server watches for file changes and automatically rebuilds. Route additions and removals are detected without restart. Some config changes require a manual restart.

## ereo build

Build the application for production.

```bash
ereo build [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--target`, `-t` | `bun` | Deployment target (`bun`, `node`, `cloudflare`, `vercel`) |
| `--minify` | `true` | Minify the output bundle |
| `--sourcemap` | `true` | Generate source maps |
| `--outDir` | `./dist` | Output directory |
| `--analyze` | `false` | Show bundle size analysis |

Examples:

```bash
# Standard production build
ereo build

# Build for Cloudflare Workers
ereo build --target cloudflare

# Build with bundle analysis
ereo build --analyze

# Build without source maps
ereo build --sourcemap false

# Custom output directory
ereo build --outDir ./build
```

The build command:
1. Bundles server and client code separately
2. Generates optimized static assets with content hashes
3. Pre-renders SSG routes
4. Generates TypeScript declarations (if types plugin is configured)

## ereo start

Start the production server.

```bash
ereo start [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port`, `-p` | `3000` | Port to listen on |
| `--host`, `-H` | `0.0.0.0` | Host to bind to |

Examples:

```bash
# Start with defaults
ereo start

# Start on a custom port
ereo start --port 8080
```

The start command runs the built application from the `dist/` directory. Run `ereo build` first.

The port can also be set via the `PORT` environment variable:

```bash
PORT=8080 ereo start
```

## ereo deploy

Deploy the application to a supported platform.

```bash
ereo deploy [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--target`, `-t` | (prompted) | Deployment platform (`fly`, `railway`, `vercel`, `cloudflare`) |
| `--prod` | `false` | Deploy to production (vs preview) |

Examples:

```bash
# Deploy to Fly.io
ereo deploy --target fly

# Production deploy to Vercel
ereo deploy --target vercel --prod
```

This command builds the application with the appropriate target adapter and triggers the platform-specific deploy. Platform credentials must be configured beforehand.

## ereo db

Database management commands.

```bash
ereo db <subcommand>
```

| Subcommand | Description |
|------------|-------------|
| `migrate` | Run pending database migrations |
| `migrate --create <name>` | Create a new migration file |
| `push` | Push schema changes directly (dev only) |
| `generate` | Generate TypeScript types from database schema |
| `seed` | Run the database seed script |
| `reset` | Drop all tables and re-run migrations |

Examples:

```bash
# Run migrations
ereo db migrate

# Create a new migration
ereo db migrate --create add-users-table

# Push schema without migration (development)
ereo db push

# Generate types from DB schema
ereo db generate

# Seed the database
ereo db seed

# Reset database (destructive)
ereo db reset
```

## ereo generate-types

Generate TypeScript types for routes, loaders, and actions.

```bash
ereo generate-types
```

This scans the `routes/` directory and generates type declarations for:
- Route parameters (e.g., `RouteParamsFor<'/posts/[id]'>`)
- Loader data types
- Action data types

Types are output to a `.ereo/types/` directory. This command runs automatically during `ereo dev` and `ereo build` when the types plugin is configured.

## Environment Variables

The CLI respects these environment variables:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (overrides `--port`) |
| `HOST` | Server host (overrides `--host`) |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) |
| `EREO_CONFIG` | Path to config file (default: `ereo.config.ts`) |

## Global Options

These options are available on all commands:

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Show help for the command |
| `--version`, `-v` | Show the EreoJS version |
| `--config`, `-c` | Path to config file |

```bash
ereo --version
ereo dev --help
ereo build --config ./custom.config.ts
```
