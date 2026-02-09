# Common Errors

A catalog of error messages you may encounter when developing with EreoJS, along with their causes and solutions.

## Cannot find module '@ereo/...'

**Error message:**

```
error: Cannot find module '@ereo/client'
```

**Cause:** Dependencies are not installed or are out of sync. This typically happens after cloning a repo, switching branches, or updating `package.json`.

**Fix:**

```bash
bun install
```

If that does not resolve it, remove the lockfile and `node_modules`, then reinstall:

```bash
rm -rf node_modules bun.lock
bun install
```

If you are in a monorepo, make sure the package is listed in your app's `package.json` with `workspace:*`:

```json
{
  "dependencies": {
    "@ereo/client": "workspace:*",
    "@ereo/data": "workspace:*"
  }
}
```

## Port already in use

**Error message:**

```
error: Failed to start server — port 3000 is already in use
```

**Cause:** Another process is already listening on the default port (3000). This is often a previous dev server that was not shut down cleanly.

**Fix:**

Option 1 --- Change the port in `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: { port: 3001 },
})
```

Option 2 --- Use the `PORT` environment variable:

```bash
PORT=3001 bun dev
```

Option 3 --- Kill the process occupying the port:

```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## loader is not a function

**Error message:**

```
TypeError: loader is not a function
```

**Cause:** The route file does not export a `loader` as a named export, or the export is not a function. This can happen if you use `export default` instead of a named export, or if the file exports an object instead of a function.

**Fix:**

Ensure your route file uses a named export:

```tsx
// Correct
export const loader = createLoader(async ({ params }) => {
  return { data: 'value' }
})

// Also correct — plain function export
export async function loader({ params }) {
  return { data: 'value' }
}

// Wrong — default export
export default async function ({ params }) {
  return { data: 'value' }
}
```

## Hydration mismatch

**Error message:**

```
Warning: Text content did not match. Server: "..." Client: "..."
```

**Cause:** The HTML rendered on the server differs from what React expects on the client. Common causes include:

- Using `Date.now()`, `Math.random()`, or other non-deterministic values during render
- Accessing `window` or `document` in a component that runs on both server and client
- Rendering different content based on client-only state (like `localStorage`)
- A non-island component that relies on browser APIs

**Fix:**

For components that need browser APIs, mark them as islands so they only hydrate on the client:

```tsx
// components/CurrentTime.island.tsx
'use client'

import { useState, useEffect } from 'react'

export default function CurrentTime() {
  const [time, setTime] = useState('')

  useEffect(() => {
    setTime(new Date().toLocaleTimeString())
  }, [])

  return <span>{time}</span>
}
```

For non-deterministic data, move it into a loader so the same value is used on both server and client:

```tsx
export const loader = createLoader(async () => {
  return { timestamp: Date.now() }
})
```

## Failed to parse route

**Error message:**

```
error: Failed to parse route file: routes/my route.tsx
```

**Cause:** The route file name contains invalid characters (spaces, special characters) or does not follow EreoJS file naming conventions.

**Fix:**

Follow the route file naming conventions:

| Pattern | Example | Purpose |
|---------|---------|---------|
| `index.tsx` | `routes/index.tsx` | Index route |
| `[param].tsx` | `routes/posts/[id].tsx` | Dynamic segment |
| `[[param]].tsx` | `routes/posts/[[page]].tsx` | Optional segment |
| `[...slug].tsx` | `routes/docs/[...slug].tsx` | Catch-all |
| `_layout.tsx` | `routes/_layout.tsx` | Layout wrapper |
| `_error.tsx` | `routes/_error.tsx` | Error boundary |
| `(group)/` | `routes/(marketing)/` | Route group |

File names must use lowercase letters, hyphens, and the special bracket syntax. Avoid spaces and uppercase letters. See the [Route Conventions](/reference/route-conventions) reference for the complete list.

## CSRF token mismatch

**Error message:**

```
403 Forbidden: CSRF token mismatch
```

**Cause:** The CSRF protection middleware rejected the request because the token is missing or does not match. This happens when:

- The form does not include the CSRF token field
- The token has expired (session timeout)
- A third-party client is submitting forms without the proper token

**Fix:**

When using `<Form>` from `@ereo/client`, the CSRF token is included automatically. For standard HTML forms, read the token from the cookie and include it manually:

```tsx
export default function MyForm() {
  return (
    <form method="post">
      <input name="title" />
      <button type="submit">Submit</button>
    </form>
  )
}
```

Prefer `<Form>` from `@ereo/client` over native `<form>` elements --- it handles CSRF tokens, progressive enhancement, and client-side navigation automatically.

If CSRF is causing issues during development, verify the middleware is configured:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'

export default defineConfig({
  server: {
    csrf: {
      enabled: true,
      cookieName: '_csrf',
    },
  },
})
```

See the [Security guide](/architecture/security) for more on CSRF protection.

## Module has no default export

**Error message:**

```
error: Route "routes/about.tsx" has no default export
```

**Cause:** Page routes must export a default React component. API-only routes (those exporting only `GET`, `POST`, etc.) do not need a default export, but page routes do.

**Fix:**

Add a default export to your route file:

```tsx
export default function About() {
  return <h1>About Us</h1>
}
```

## Build failed: external dependency not found

**Error message:**

```
error: Could not resolve "some-package"
```

**Cause:** A package used in your code is not installed, or it needs to be marked as external in the build config.

**Fix:**

Install the missing package:

```bash
bun add some-package
```

If the package should not be bundled (e.g., a Node.js built-in or server-only dependency), mark it as external:

```ts
// ereo.config.ts
export default defineConfig({
  build: {
    external: ['some-package'],
  },
})
```

## Still stuck?

If your error is not listed here, try these steps:

1. Search the [GitHub Issues](https://github.com/ereoJS/ereoJS/issues)
2. Check the [Debugging guide](/troubleshooting/debugging) for tools to investigate further
3. Ask in the [Discord community](https://discord.gg/ereo)
