# Authentication

This guide covers authentication patterns in EreoJS using the `@ereo/plugin-auth` package.

## Installation

```bash
bun add @ereo/plugin-auth
```

## Basic Setup

### Configure the Auth Plugin

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { createAuthPlugin, credentials } from '@ereo/plugin-auth'

export default defineConfig({
  plugins: [
    createAuthPlugin({
      session: {
        secret: process.env.SESSION_SECRET!, // Required: at least 32 characters
        maxAge: 60 * 60 * 24 * 7, // 7 days
        strategy: 'jwt', // 'jwt' | 'cookie' | 'hybrid'
      },
      providers: [
        credentials({
          authorize: async (creds) => {
            // Verify credentials against your database
            const user = await db.users.findByEmail(creds.email)
            if (!user) return null

            const valid = await verifyPassword(creds.password, user.passwordHash)
            if (!valid) return null

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              roles: user.roles,
            }
          },
        }),
      ],
    }),
  ],
})
```

### Session Configuration Options

```ts
session: {
  // Session strategy
  strategy: 'jwt',  // 'jwt' | 'cookie' | 'hybrid'

  // Session duration in seconds (default: 7 days)
  maxAge: 60 * 60 * 24 * 7,

  // Secret for signing JWT/cookies (required)
  secret: process.env.SESSION_SECRET!,

  // Refresh session if older than this (seconds)
  updateAge: 60 * 60 * 24 * 3,  // 3 days
}
```

### Cookie Configuration

```ts
cookie: {
  name: 'ereo.session',  // Cookie name
  secure: true,          // HTTPS only
  httpOnly: true,        // No JS access
  sameSite: 'lax',       // 'strict' | 'lax' | 'none'
  domain: 'example.com', // Cookie domain
  path: '/',             // Cookie path
}
```

## Login Route

```tsx
// routes/login.tsx
import { createLoader, createAction, redirect } from '@ereo/data'
import { Form, useActionData } from '@ereo/client'
import { useAuth, getSession } from '@ereo/plugin-auth'

export const loader = createLoader(async ({ context }) => {
  const session = getSession(context)
  if (session) {
    return redirect('/dashboard')
  }
  return {}
})

export const action = createAction(async ({ request, context }) => {
  const auth = useAuth(context)
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await auth.signIn('credentials', { email, password })

    // Get the cookie header to set on redirect
    const cookieHeader = auth.getCookieHeader()

    return redirect('/dashboard', {
      headers: cookieHeader ? { 'Set-Cookie': cookieHeader } : {},
    })
  } catch (error) {
    return { error: 'Invalid email or password' }
  }
})

export default function Login() {
  const actionData = useActionData()

  return (
    <div className="max-w-md mx-auto">
      <h1>Login</h1>

      {actionData?.error && (
        <div className="error-banner">{actionData.error}</div>
      )}

      <Form method="post">
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" required />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" required />
        </div>

        <button type="submit" className="btn">Login</button>
      </Form>
    </div>
  )
}
```

## Logout

```tsx
// routes/logout.tsx
import { createAction, redirect } from '@ereo/data'
import { useAuth } from '@ereo/plugin-auth'

export const action = createAction(async ({ context }) => {
  const auth = useAuth(context)
  await auth.signOut()

  const cookieHeader = auth.getCookieHeader()

  return redirect('/login', {
    headers: cookieHeader ? { 'Set-Cookie': cookieHeader } : {},
  })
})

// Use in a component
<Form method="post" action="/logout">
  <button type="submit">Logout</button>
</Form>
```

## Protected Routes

### Using Route Config

```tsx
// routes/dashboard/_layout.tsx
import { requireAuth } from '@ereo/plugin-auth'

export const config = {
  ...requireAuth({ redirect: '/login' }),
}

export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard">
      <Sidebar />
      <main>{children}</main>
    </div>
  )
}
```

### Using Loader Protection

```tsx
// routes/dashboard/index.tsx
import { createLoader } from '@ereo/data'
import { useAuth, getUser } from '@ereo/plugin-auth'

export const loader = createLoader(async ({ context }) => {
  const auth = useAuth(context)

  if (!auth.isAuthenticated()) {
    throw new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    })
  }

  const user = auth.getUser()
  return { user }
})

export default function Dashboard({ loaderData }) {
  return (
    <div>
      <h1>Welcome, {loaderData.user.name}</h1>
    </div>
  )
}
```

## Role-Based Access Control

### Require Specific Roles

```tsx
// routes/admin/_layout.tsx
import { requireRoles } from '@ereo/plugin-auth'

export const config = {
  ...requireRoles(['admin'], { redirect: '/forbidden' }),
}
```

### Check Roles in Code

```tsx
export const loader = createLoader(async ({ context }) => {
  const auth = useAuth(context)

  if (!auth.hasRole('admin')) {
    throw new Response('Forbidden', { status: 403 })
  }

  // Or check any of multiple roles
  if (!auth.hasAnyRole(['admin', 'moderator'])) {
    throw new Response('Forbidden', { status: 403 })
  }

  // Or require all roles
  if (!auth.hasAllRoles(['admin', 'verified'])) {
    throw new Response('Forbidden', { status: 403 })
  }

  return { /* data */ }
})
```

## JWT Authentication for APIs

### Using Bearer Tokens

The auth plugin automatically extracts JWT from the `Authorization` header:

```ts
// Client-side API call
const token = await auth.getToken()

fetch('/api/data', {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
})
```

### Protected API Route

```ts
// routes/api/protected.ts
import { useAuth } from '@ereo/plugin-auth'

export async function loader({ context }) {
  const auth = useAuth(context)

  if (!auth.isAuthenticated()) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = auth.getUser()
  return Response.json({ user })
}
```

## Auth Context API

The `AuthContext` provides these methods:

```ts
interface AuthContext {
  // Current session (null if not authenticated)
  session: Session | null

  // Sign in with a provider
  signIn(provider: string, credentials: Record<string, unknown>): Promise<Session>

  // Sign out
  signOut(): Promise<void>

  // Check authentication status
  isAuthenticated(): boolean

  // Role checks
  hasRole(role: string): boolean
  hasAnyRole(roles: string[]): boolean
  hasAllRoles(roles: string[]): boolean

  // Get current user
  getUser(): User | null

  // Get JWT token
  getToken(): Promise<string | null>

  // Refresh the session
  refreshSession(): Promise<Session | null>

  // Get Set-Cookie header (for responses)
  getCookieHeader(): string | null
}
```

## Session Callbacks

Customize session behavior with callbacks:

```ts
createAuthPlugin({
  session: { secret: '...' },
  providers: [/* ... */],
  callbacks: {
    // Called when session is created
    onSessionCreated: async (session) => {
      // Add custom claims
      return {
        ...session,
        claims: { ...session.claims, customField: 'value' },
      }
    },

    // Validate session on each request
    onSessionValidate: async (session) => {
      // Return false to invalidate
      const user = await db.users.find(session.userId)
      return user && !user.banned
    },

    // Called when user signs in
    onSignIn: async (user) => {
      await db.users.updateLastLogin(user.id)
    },

    // Called when user signs out
    onSignOut: async (session) => {
      await db.sessions.revoke(session.sessionId)
    },

    // Customize JWT payload
    jwt: async ({ token, user, session }) => {
      return {
        ...token,
        customClaim: 'value',
      }
    },

    // Customize session from JWT
    session: async ({ token, session }) => {
      return {
        ...session,
        customField: token.customClaim,
      }
    },
  },
})
```

## Custom Credentials Provider

```ts
import { credentials } from '@ereo/plugin-auth'

const emailPasswordProvider = credentials({
  id: 'email-password',  // Custom provider ID
  name: 'Email & Password',

  authorize: async (creds) => {
    const { email, password } = creds

    // Validate input
    if (!email || !password) {
      return null
    }

    // Find user
    const user = await db.users.findByEmail(email)
    if (!user) {
      return null
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return null
    }

    // Return user data (becomes session)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      // Additional fields go to session.claims
      avatar: user.avatar,
    }
  },
})
```

## Mock Provider for Testing

```ts
import { mock } from '@ereo/plugin-auth'

// For development/testing
const mockProvider = mock({
  user: {
    id: 'test-user',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['admin'],
  },
  delay: 100, // Simulate network delay
})
```

## Helper Functions

```ts
import { useAuth, getSession, getUser, withAuth } from '@ereo/plugin-auth'

// Get auth context (throws if not configured)
const auth = useAuth(context)

// Get session (returns null if not authenticated)
const session = getSession(context)

// Get user (returns null if not authenticated)
const user = getUser(context)

// Wrap handler with auth check
export const loader = withAuth(
  async ({ request, context, auth, params }) => {
    // auth is guaranteed to be authenticated here
    return { user: auth.getUser() }
  },
  { roles: ['admin'] }  // Optional role requirement
)
```

## Best Practices

1. **Use strong secrets** - At least 32 random characters for `session.secret`
2. **Enable HTTPS** - Set `cookie.secure: true` in production
3. **Hash passwords** - Use bcrypt or Argon2
4. **Validate sessions** - Use `onSessionValidate` to check user status
5. **Short token lifetimes** - Balance security with user experience
6. **Implement rate limiting** - Prevent brute force attacks
7. **Log authentication events** - Use callbacks for audit trails
