# Code Architecture

An overview of the EreoJS monorepo structure, package relationships, and build conventions.

## Monorepo Overview

EreoJS is a monorepo with 25 packages managed by Bun workspaces. Each package is published to npm under the `@ereo` scope. The repository uses:

- **Package manager:** Bun (`workspace:*` for internal dependencies)
- **Module format:** ESM only (`"type": "module"` in every package)
- **Language:** TypeScript throughout
- **Current version:** 0.1.24

## Core Dependency Graph

Packages build on each other in a layered architecture. Lower layers have no knowledge of higher layers:

```
@ereo/state          (no deps — standalone signal library)
    |
@ereo/core           (app foundation, plugins, environment, caching)
    |
@ereo/router         (file-based routing, middleware, validation)
    |
@ereo/data           (loaders, actions, caching, revalidation)
    |
@ereo/client         (React hooks, Link, Form, navigation, islands)
    |
@ereo/server         (Bun HTTP server, streaming SSR, middleware runner)
    |
@ereo/cli            (dev, build, start commands)
```

Additional packages extend the core:

```
@ereo/forms          (depends on @ereo/state, @ereo/client)
@ereo/bundler        (depends on @ereo/core)
@ereo/plugin-auth    (depends on @ereo/core, @ereo/server)
@ereo/plugin-images  (depends on @ereo/core, @ereo/server)
@ereo/plugin-tailwind (depends on @ereo/core, @ereo/bundler)
```

## Package Conventions

Every package follows the same structure:

```
packages/example/
  src/
    index.ts           # Public API exports
    ...                # Implementation files
    __tests__/         # Test files
  dist/
    index.js           # Built JavaScript (ESM)
    index.d.ts         # TypeScript declarations
  package.json
  tsconfig.json
```

### package.json

```json
{
  "name": "@ereo/example",
  "version": "0.1.24",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "bun build ./src/index.ts --outdir ./dist --target browser --external ...",
    "build:types": "tsc --emitDeclarationOnly",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  }
}
```

### tsconfig.json

Each package extends the root `tsconfig.json` and configures path aliases to reference sibling package type declarations:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "paths": {
      "@ereo/core": ["../core/dist/index.d.ts"],
      "@ereo/state": ["../state/dist/index.d.ts"]
    }
  },
  "include": ["src"]
}
```

## Build Order

Packages must be built in dependency order. The build script handles this automatically, but if building manually:

1. `@ereo/state` (no dependencies)
2. `@ereo/core`
3. `@ereo/router`
4. `@ereo/data`
5. `@ereo/client`
6. `@ereo/server`
7. `@ereo/forms`, `@ereo/bundler` (parallel, depend only on earlier packages)
8. `@ereo/cli`, plugins (depend on multiple earlier packages)

## Key Design Patterns

### Signal-Based State

`@ereo/state` provides the `Signal<T>` primitive used throughout the framework:

```ts
const count = signal(0)
count.get()            // 0
count.set(5)
count.subscribe(v => console.log(v))
```

React integration via `useSyncExternalStore`:

```ts
const value = useSignal(mySignal) // Re-renders when signal changes
```

### Request/Response Model

The server layer uses standard Web API `Request` and `Response` objects. Middleware, loaders, and actions all operate on these standard types, avoiding framework-specific abstractions.

### Plugin Architecture

Plugins hook into the application lifecycle via `ereo.config.ts`:

```ts
export default defineConfig({
  plugins: [
    tailwindPlugin(),
    authPlugin({ provider: 'github' }),
  ],
})
```

Plugins can add middleware, modify the build pipeline, register virtual modules, and extend the development server. See the [Plugin Development guide](/contributing/plugin-development) for the full API.

### Islands Architecture

Components marked with `.island.tsx` extension or `'use client'` directive are hydrated on the client. Everything else renders as static HTML on the server. This minimizes client-side JavaScript while allowing interactivity where needed.

## Where to Find Things

| What | Where |
|------|-------|
| Route resolution logic | `packages/router/src/` |
| Loader/action execution | `packages/data/src/` |
| React hooks (`useLoaderData`, etc.) | `packages/client/src/hooks/` |
| Island hydration | `packages/client/src/islands/` |
| HTTP server | `packages/server/src/` |
| CLI commands | `packages/cli/src/commands/` |
| Form validation engine | `packages/forms/src/` |
| Signal implementation | `packages/state/src/` |
| Cache system | `packages/core/src/cache/` |
