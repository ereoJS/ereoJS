# Known Issues

Current known issues in EreoJS v0.2.x and their workarounds.

## Hot Reload Occasionally Misses Island Changes

**Status:** Under investigation

When editing `.island.tsx` files, the hot reload system may occasionally fail to detect the change and update the browser. This happens most often when editing the island's exported props interface or renaming the component.

**Workaround:** Restart the dev server:

```bash
# Stop the dev server (Ctrl+C), then restart
bun dev
```

Making a small edit to the route file that imports the island will also trigger a full reload.

## Windows WSL Path Issues

**Status:** Known limitation

On Windows with WSL, file paths that contain backslashes or mixed separators can cause route resolution failures. This manifests as routes not being found or incorrect path matching.

**Workaround:** Always use forward slashes in your configuration and imports. Set your editor to use LF line endings for all project files:

```ts
// ereo.config.ts --- use forward slashes
export default defineConfig({
  routes: {
    dir: './src/routes', // Forward slashes only
  },
})
```

Add a `.editorconfig` to your project root:

```ini
[*]
end_of_line = lf
```

If you encounter persistent path issues in WSL, ensure your project is located within the WSL filesystem (`/home/...`) rather than the Windows filesystem (`/mnt/c/...`), as cross-filesystem access is slower and more error-prone.

## Large Bundle Warning for Forms Package

**Status:** Expected behavior

The `@ereo/forms` package produces a bundle of approximately 97KB (uncompressed). Build tools may emit a warning about the chunk size.

**Workaround:** This is expected due to the validation engine, field array logic, and wizard system. The package is tree-shakeable, so unused features are excluded from your final bundle. If you only need simple forms, use the `<Form>` component from `@ereo/client` instead, which has a much smaller footprint.

To suppress the warning in your build config:

```ts
// ereo.config.ts
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 150, // kB
  },
})
```

## Streaming SSR and Suspense Boundary Ordering

**Status:** Edge case

When multiple `<Suspense>` boundaries resolve in rapid succession during streaming SSR, the client may briefly display content out of order. This is a rare timing issue with how chunks are flushed.

**Workaround:** Wrap related deferred data in a single `<Suspense>` boundary rather than using separate boundaries for data that resolves at roughly the same time.

## Type Generation on First Run

**Status:** Known limitation

The `createTypesPlugin()` generates route types during build and dev. On the very first run of a new project, TypeScript may report errors for route types that have not been generated yet.

**Workaround:** Run `bun dev` once to trigger type generation, then restart your editor's TypeScript server (in VS Code: `Cmd+Shift+P` then "TypeScript: Restart TS Server").

## Reporting Issues

If you encounter an issue not listed here:

1. Search [existing issues](https://github.com/ereoJS/ereoJS/issues) to see if it has been reported
2. If not, [open a new issue](https://github.com/ereoJS/ereoJS/issues/new) with a minimal reproduction
3. Include your EreoJS version, Bun version, and operating system
