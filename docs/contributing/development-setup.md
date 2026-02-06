# Development Setup

How to set up the EreoJS monorepo for local development.

## Prerequisites

- [Bun](https://bun.sh) v1.0 or later
- [Git](https://git-scm.com)
- macOS, Linux, or Windows (via WSL)

## Clone and Install

```bash
git clone https://github.com/ereo-framework/ereo.git
cd ereo
bun install
```

The `bun install` command installs dependencies for all 25 packages in the monorepo using Bun's workspace resolution. Internal packages reference each other with `workspace:*`.

## Workspace Structure

```
ereo/
  packages/
    core/              # @ereo/core — app foundation, plugins, environment
    router/            # @ereo/router — file-based routing, middleware
    client/            # @ereo/client — React hooks, Link, Form, navigation
    data/              # @ereo/data — loaders, actions, caching
    server/            # @ereo/server — Bun HTTP server, streaming
    state/             # @ereo/state — signals and stores
    forms/             # @ereo/forms — form library with validation
    cli/               # @ereo/cli — dev, build, start commands
    bundler/           # @ereo/bundler — Bun bundler integration
    plugin-auth/       # @ereo/plugin-auth — authentication plugin
    plugin-images/     # @ereo/plugin-images — image optimization
    plugin-tailwind/   # @ereo/plugin-tailwind — Tailwind CSS integration
    ...                # Additional packages
  docs/                # VitePress documentation site
  examples/            # Example applications
  scripts/             # Build and release scripts
```

## Building Packages

Build all packages:

```bash
bun run build
```

Build a single package:

```bash
cd packages/core
bun run build
```

Each package builds with:
1. `bun build ./src/index.ts --outdir ./dist --target browser` for the JavaScript bundle
2. `tsc --emitDeclarationOnly` for TypeScript declaration files

The output is ESM only. Entry point: `./dist/index.js`, types: `./dist/index.d.ts`.

## Running Tests

Run the full test suite:

```bash
bun test
```

Run tests for a specific package:

```bash
bun test packages/forms
bun test packages/data
```

Run a single test file:

```bash
bun test packages/forms/src/__tests__/validation.test.ts
```

Watch mode:

```bash
bun test --watch packages/forms
```

## Running the Docs

The docs site uses VitePress:

```bash
bun run docs:dev
```

This starts a local server at `http://localhost:5173`. Edits to markdown files hot-reload in the browser.

## Useful Scripts

| Script | Description |
|--------|-------------|
| `bun run build` | Build all packages |
| `bun run build:types` | Generate TypeScript declarations only |
| `bun test` | Run all tests |
| `bun run typecheck` | Run TypeScript type checking |
| `bun run lint` | Run ESLint across all packages |
| `bun run docs:dev` | Start docs dev server |
| `bun run docs:build` | Build docs for production |

## Development Workflow

1. Create a feature branch from `main`:

```bash
git checkout -b feat/my-feature
```

2. Make changes in the relevant package(s) under `packages/`

3. Run tests to verify nothing breaks:

```bash
bun test
```

4. Run the type checker:

```bash
bun run typecheck
```

5. If you changed a package's public API, update the docs

6. Submit a pull request with a clear description

## Linking for Local Testing

To test your changes in a separate project, use `bun link`:

```bash
# In the package directory
cd packages/core
bun link

# In your test project
bun link @ereo/core
```

This creates a symlink so your test project uses the local version of the package.
