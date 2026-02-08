# Troubleshooting & FAQ

Having trouble with EreoJS? This page covers the most frequently encountered issues and their solutions. Start here before opening a GitHub issue -- chances are the answer is below.

## Common Problems

Detailed guides for recurring categories of issues:

- **[Common Errors](/troubleshooting/common-errors)** -- A catalog of error messages you may encounter, with explanations of what causes each one and step-by-step solutions.
- **[Debugging](/troubleshooting/debugging)** -- Techniques for diagnosing issues using the built-in dev-inspector, console debugging, source maps, and network analysis.
- **[Known Issues](/troubleshooting/known-issues)** -- Current v0.1.x known issues, their status, and available workarounds while fixes are in progress.

## Quick Fixes

### "Cannot find module '@ereo/...'"

This usually means dependencies are not installed or out of sync. Run:

```bash
bun install
```

If that does not resolve it, remove `node_modules` and the lockfile, then reinstall:

```bash
rm -rf node_modules bun.lock
bun install
```

### "Port 3000 already in use"

Another process is occupying the default port. Either change the port in your config:

```ts
// ereo.config.ts
export default defineConfig({
  server: { port: 3001 }
})
```

Or set the `PORT` environment variable for a one-off run:

```bash
PORT=3001 bun dev
```

To find and kill the process using port 3000:

```bash
lsof -i :3000
kill -9 <PID>
```

### Build Fails with TypeScript Errors

Run the type checker in isolation to see the full list of errors:

```bash
bun run typecheck
```

Common causes include missing type definitions for third-party packages (install `@types/...` packages), incorrect `tsconfig.json` paths, or using newer TypeScript syntax that your configured version does not support.

### Hot Reload Not Working

If changes to your files are not reflected in the browser during development, clear the internal cache and restart:

```bash
rm -rf .ereo && bun dev
```

This removes the `.ereo` cache directory that stores compiled assets and route manifests. A fresh `bun dev` rebuilds everything from scratch.

### "Cannot use import statement outside a module"

This error means your project is not configured for ES modules. Verify that your `package.json` includes:

```json
{
  "type": "module"
}
```

EreoJS requires ESM. If you are using a third-party library that only provides CommonJS exports, check whether a newer version with ESM support is available, or use a dynamic `import()` as a workaround.

### Hydration Mismatch

A hydration mismatch occurs when the HTML rendered on the server does not match what React produces on the client. Common causes:

- **Non-deterministic values in server components:** `Date.now()`, `Math.random()`, or `crypto.randomUUID()` produce different output on each render. Move these to client-side effects or pass them as stable props from a loader.
- **Browser-only APIs in shared components:** Accessing `window`, `document`, or `localStorage` during server rendering will either throw or produce different output. Guard these behind `typeof window !== 'undefined'` checks or move them into `useEffect`.
- **Conditional rendering based on client state:** If a component renders differently based on viewport size or media queries, use CSS-based solutions or defer the conditional rendering to a `useEffect` on the client.

### Styles Not Loading in Production

If your styles appear in development but are missing in production builds:

- **Tailwind CSS:** Verify that your `tailwind.config.ts` `content` array includes all paths where you use Tailwind classes (e.g., `'./app/**/*.{ts,tsx}'`).
- **CSS imports:** Ensure your CSS import paths are correct and relative to the file importing them. Absolute paths that work in development may resolve differently in the production build.
- **PostCSS:** Check that your `postcss.config.js` is present at the project root and includes the necessary plugins.

### "ECONNREFUSED" in Loader

This error means a loader is trying to reach an external service (database, API, microservice) that is not responding. Check:

- **Is the service running?** Start your database or API server before running `bun dev`.
- **Is the connection URL correct?** Verify `DATABASE_URL` or API base URLs in your `.env` file. A common mistake is using `localhost` when the service runs in a Docker container (use the container name or `host.docker.internal` instead).
- **Firewall or network issues?** Ensure the target port is open and accessible from your development machine.

## FAQ by Topic

- **[Routing FAQ](/troubleshooting/faq-routing)** -- Answers about dynamic routes, catch-all segments, route groups, middleware ordering, and layout nesting.
- **[Data Loading FAQ](/troubleshooting/faq-data)** -- Answers about loaders, actions, caching strategies, revalidation triggers, and streaming.
- **[Deployment FAQ](/troubleshooting/faq-deployment)** -- Answers about build issues, platform-specific configuration, environment variables, and production debugging.
- **[Forms FAQ](/troubleshooting/faq-forms)** -- Answers about validation timing, field arrays, server-side error handling, and progressive enhancement.

## Debugging Tips

When the quick fixes above do not resolve your issue, try these diagnostic techniques:

- **Enable debug logging:** Set `DEBUG=ereo:*` before running your dev server to see detailed internal logs for routing, caching, and rendering.
  ```bash
  DEBUG=ereo:* bun dev
  ```
- **Use the dev-inspector:** In development mode, press `Ctrl+Shift+I` (or `Cmd+Shift+I` on macOS) to open the EreoJS dev-inspector overlay, which shows route matching, loader timing, and cache status for the current page.
- **Check the Network tab:** Open your browser's DevTools Network tab to inspect loader requests, response headers (especially cache-related headers), and response payloads.
- **Inspect the `.ereo` directory:** The build cache in `.ereo/` contains the compiled route manifest and asset map. Reviewing these files can reveal misconfigurations in routing or asset paths.

## Still Stuck?

If none of the solutions above resolve your issue, reach out to the community:

- **[GitHub Issues](https://github.com/ereoJS/ereoJS/issues)** -- Search existing issues or file a new bug report. Please include the details listed in the "Report a Bug" section below.
- **[Discord Community](https://discord.gg/ereo)** -- Get help from other EreoJS developers in real time. The `#help` channel is the best place for troubleshooting questions.
- **[GitHub Discussions](https://github.com/ereoJS/ereoJS/discussions)** -- For longer-form questions, ideas, and discussions that do not fit the issue tracker.

## Report a Bug

When filing a bug report, include the following information to help maintainers diagnose the issue quickly:

- **EreoJS version:** Run `bun ereo --version` to get the exact version.
- **Bun version:** Run `bun --version`.
- **Operating system:** macOS, Linux, or Windows, with version.
- **Steps to reproduce:** A minimal sequence of steps that reliably triggers the issue.
- **Expected behavior:** What you expected to happen.
- **Actual behavior:** What actually happened, including any error messages or stack traces.
- **Minimal reproduction:** A link to a GitHub repository or a code snippet that demonstrates the issue. The smaller the reproduction, the faster the fix.
