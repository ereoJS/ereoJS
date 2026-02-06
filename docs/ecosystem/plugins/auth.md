# Auth Plugin

Add authentication and session management to your EreoJS application with `@ereo/plugin-auth`.

## Installation

```bash
bun add @ereo/plugin-auth
```

## Setup

### 1. Add the Plugin

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { authPlugin } from '@ereo/plugin-auth'

export default defineConfig({
  plugins: [
    authPlugin({
      session: {
        secret: process.env.SESSION_SECRET,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      },
    }),
  ],
})
```

### 2. Configure Session Storage

By default, sessions are stored in cookies. For server-side storage:

```ts
authPlugin({
  session: {
    secret: process.env.SESSION_SECRET,
    store: 'memory',     // 'cookie' | 'memory' | 'redis'
  },
})
```

For Redis-backed sessions:

```ts
authPlugin({
  session: {
    secret: process.env.SESSION_SECRET,
    store: 'redis',
    redis: {
      url: process.env.REDIS_URL,
    },
  },
})
```

## Login and Logout Routes

Create login and logout actions:

```tsx
// routes/login.tsx
import { createAction, redirect } from '@ereo/data'

export const action = createAction(async ({ request, context }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const user = await verifyCredentials(email, password)
  if (!user) {
    return { error: 'Invalid credentials' }
  }

  const session = context.getSession()
  session.set('userId', user.id)
  await session.save()

  return redirect('/dashboard')
})

export default function Login({ actionData }) {
  return (
    <form method="post">
      {actionData?.error && <p className="error">{actionData.error}</p>}
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">Sign In</button>
    </form>
  )
}
```

```tsx
// routes/logout.tsx
import { createAction, redirect } from '@ereo/data'

export const action = createAction(async ({ context }) => {
  const session = context.getSession()
  await session.destroy()
  return redirect('/')
})
```

## Protecting Routes with Middleware

Create middleware that checks for an authenticated session:

```ts
// routes/dashboard/_middleware.ts
import type { MiddlewareHandler } from '@ereo/core'

export const middleware: MiddlewareHandler = async (request, context, next) => {
  const session = context.getSession()
  const userId = session.get('userId')

  if (!userId) {
    return Response.redirect('/login')
  }

  // Load user and make it available to loaders
  const user = await db.users.find(userId)
  context.set('user', user)

  return next()
}
```

Access the authenticated user in loaders:

```tsx
// routes/dashboard/index.tsx
export const loader = createLoader(async ({ context }) => {
  const user = context.get('user')
  return { user }
})

export default function Dashboard({ loaderData }) {
  return <h1>Welcome, {loaderData.user.name}</h1>
}
```

## OAuth Providers

The auth plugin supports OAuth providers for social login:

```ts
authPlugin({
  session: { secret: process.env.SESSION_SECRET },
  providers: [
    {
      name: 'github',
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl: '/auth/github/callback',
    },
  ],
})
```

The plugin registers callback routes automatically. Link to the OAuth flow from your login page:

```tsx
<a href="/auth/github">Sign in with GitHub</a>
```

## Session API

The session object is available via `context.getSession()` in loaders, actions, and middleware:

```ts
const session = context.getSession()

session.get('key')               // Read a value
session.set('key', 'value')      // Set a value
session.delete('key')            // Remove a value
session.has('key')               // Check existence
await session.save()             // Persist changes
await session.destroy()          // End the session
await session.regenerate()       // New session ID (prevents fixation)
```

## API Reference

See the [@ereo/plugin-auth API reference](/api/plugins/auth) for the full plugin options and session API.
