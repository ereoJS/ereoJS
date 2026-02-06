# Why Bun?

EreoJS is built on [Bun](https://bun.sh) --- a fast JavaScript runtime, bundler, test runner, and package manager in one tool. This page explains why Bun was chosen, the performance characteristics it brings, and the trade-offs to be aware of.

## Native TypeScript

Bun executes TypeScript files directly without a separate compilation step. No `tsc --watch`, no `ts-node`, no build step during development:

```bash
# Just works --- no compilation needed
bun run server.ts
```

This eliminates an entire category of tooling complexity. EreoJS route files, middleware, config, and plugins are all TypeScript, and Bun runs them natively.

## Fast Bundler

Bun's built-in bundler replaces webpack, esbuild, or Rollup for production builds. EreoJS uses it for both server and client bundles:

```bash
bun build ./src/index.ts --outdir ./dist --target browser
```

The bundler supports:
- Tree shaking
- Code splitting
- Source maps
- CSS bundling
- JSX/TSX transformation
- `define` for compile-time constants

## Built-In Test Runner

Bun includes a test runner compatible with Jest-like APIs. EreoJS uses it for the entire test suite:

```ts
import { test, expect, describe } from 'bun:test'

test('loader returns posts', async () => {
  const result = await loader({ params: {} })
  expect(result.posts).toHaveLength(3)
})
```

No separate test framework installation or configuration is needed.

## Fast HTTP Server

Bun's HTTP server is built on low-level system APIs and handles requests with minimal overhead. EreoJS uses `Bun.serve()` for the production server:

```ts
Bun.serve({
  port: 3000,
  fetch(request) {
    return new Response('Hello')
  },
})
```

The server uses standard Web API `Request` and `Response` objects, keeping EreoJS aligned with web standards.

## npm Compatibility

Bun is compatible with the npm ecosystem. Most packages from npm work without modification:

```bash
bun add react react-dom zod
```

Bun reads `package.json`, resolves `node_modules`, and supports CommonJS and ESM modules. If a package works with Node.js, it almost certainly works with Bun.

## Performance Comparison

Approximate benchmarks comparing common development tasks (measured on Apple M1, 16GB RAM):

| Task | Bun | Node.js + Tools | Speedup |
|------|-----|-----------------|---------|
| Install dependencies | ~2s | ~8s (npm) | ~4x |
| Start dev server | ~150ms | ~800ms | ~5x |
| Production build | ~1.2s | ~4.5s (webpack) | ~3.5x |
| Run 400 tests | ~0.8s | ~3.2s (Jest) | ~4x |
| Cold start (server) | ~50ms | ~200ms | ~4x |

These numbers vary by project size, hardware, and configuration. The key takeaway: Bun is consistently faster across all common operations, which adds up to a noticeably better development experience.

## Single Toolchain

With Node.js, a typical project uses 4-6 separate tools:

- **Runtime:** Node.js
- **Package manager:** npm, yarn, or pnpm
- **Bundler:** webpack, esbuild, Vite, or Rollup
- **TypeScript compiler:** tsc or ts-node
- **Test runner:** Jest, Vitest, or Mocha
- **Dev server:** Custom or framework-specific

With Bun, one tool handles all of these. EreoJS leverages this to simplify the developer experience --- fewer config files, fewer version conflicts, faster feedback loops.

## Trade-Offs

### Newer Ecosystem

Bun is newer than Node.js. While most npm packages work, some that rely on Node.js-specific internals (native addons, certain `fs` edge cases) may have compatibility issues. The Bun team actively tracks and fixes these.

### Windows Support

Bun runs natively on macOS and Linux. On Windows, it requires WSL (Windows Subsystem for Linux). Native Windows support is improving but not yet complete.

If your team develops on Windows, ensure WSL 2 is installed and configured. See the [Known Issues](/troubleshooting/known-issues) page for WSL-specific workarounds.

### Node.js API Coverage

Bun implements most of the Node.js API surface, but not all of it. Modules like `fs`, `path`, `http`, `crypto`, and `stream` are well-supported. Niche APIs may have gaps. Check the [Bun documentation](https://bun.sh/docs/runtime/nodejs-apis) for the latest compatibility status.

## When Bun Might Not Be Right

- If your deployment target requires Node.js (some serverless platforms)
- If you depend on Node.js native addons that Bun does not support
- If your team cannot use WSL on Windows

For these cases, consider using the Node.js adapter (`ereo build --target node`) which produces a Node.js-compatible server bundle.

## Further Reading

- [Bun Documentation](https://bun.sh/docs)
- [Bun vs Node.js API Compatibility](https://bun.sh/docs/runtime/nodejs-apis)
- [EreoJS Performance Guide](/architecture/performance)
