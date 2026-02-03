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

### `ereo start`

Start the production server.

```bash
ereo start --port 3001
```

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

## Key Features

- Hot module replacement for fast development
- Production-optimized builds with Bun
- Multiple deployment target support
- Project scaffolding with templates
- TypeScript support out of the box

## Documentation

For full documentation, visit [https://ereo.dev/docs/cli](https://ereo.dev/docs/cli)

## Part of EreoJS

This package is part of the [EreoJS monorepo](https://github.com/anthropics/ereo-js).

## License

MIT
