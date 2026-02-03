# Authentication

This guide covers common authentication patterns in EreoJS.

## Session-Based Authentication

### Setting Up Sessions

Create a session utility at `src/lib/session.ts`:

```ts
import { createCookie } from '@ereo/core'

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production'

export const sessionCookie = createCookie('session', {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 1 week
  secrets: [SESSION_SECRET]
})

export interface SessionData {
  userId: string
}

export async function getSession(request: Request): Promise<SessionData | null> {
  const cookie = request.headers.get('Cookie')
  return sessionCookie.parse(cookie)
}

export async function createSession(data: SessionData): Promise<string> {
  return sessionCookie.serialize(data)
}

export async function destroySession(): Promise<string> {
  return sessionCookie.serialize(null, { maxAge: 0 })
}
```

### Login Route

```tsx
// routes/login.tsx
import { createAction, redirect } from '@ereo/data'
import { Form, useActionData } from '@ereo/client'
import { createSession, getSession } from '../lib/session'
import { verifyPassword, getUserByEmail } from '../lib/users'

export const loader = createLoader(async ({ request }) => {
  const session = await getSession(request)
  if (session) {
    return redirect('/dashboard')
  }
  return {}
})

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const user = await getUserByEmail(email)

  if (!user || !await verifyPassword(password, user.passwordHash)) {
    return { error: 'Invalid email or password' }
  }

  const sessionCookie = await createSession({ userId: user.id })

  return redirect('/dashboard', {
    headers: {
      'Set-Cookie': sessionCookie
    }
  })
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

### Auth Middleware

```ts
// middleware/auth.ts
import { registerMiddleware } from '@ereo/router'
import { getSession } from '../lib/session'
import { getUser } from '../lib/users'

registerMiddleware('auth', async (request, next, context) => {
  const session = await getSession(request)

  if (!session) {
    return Response.redirect('/login')
  }

  const user = await getUser(session.userId)

  if (!user) {
    return Response.redirect('/login')
  }

  context.set('user', user)
  return next()
})

registerMiddleware('guest', async (request, next) => {
  const session = await getSession(request)

  if (session) {
    return Response.redirect('/dashboard')
  }

  return next()
})
```

### Protected Routes

```tsx
// routes/dashboard/_layout.tsx
export const config = {
  middleware: ['auth']
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

### Logout

```tsx
// routes/logout.tsx
import { createAction, redirect } from '@ereo/data'
import { destroySession } from '../lib/session'

export const action = createAction(async () => {
  const cookie = await destroySession()

  return redirect('/login', {
    headers: {
      'Set-Cookie': cookie
    }
  })
})

// Use in a component
<Form method="post" action="/logout">
  <button type="submit">Logout</button>
</Form>
```

## JWT Authentication

### JWT Utilities

```ts
// lib/jwt.ts
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function createToken(payload: { userId: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string }
  } catch {
    return null
  }
}
```

### JWT Middleware

```ts
registerMiddleware('jwt', async (request, next, context) => {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return Response.json({ error: 'Invalid token' }, { status: 401 })
  }

  const user = await getUser(payload.userId)
  context.set('user', user)

  return next()
})
```

## OAuth (Social Login)

### OAuth Flow

```ts
// routes/auth/github.ts
export function GET() {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.APP_URL}/auth/github/callback`,
    scope: 'user:email'
  })

  return Response.redirect(
    `https://github.com/login/oauth/authorize?${params}`
  )
}
```

```ts
// routes/auth/github/callback.ts
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (!code) {
    return Response.redirect('/login?error=oauth_failed')
  }

  // Exchange code for token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    })
  })

  const { access_token } = await tokenResponse.json()

  // Get user info
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  })

  const githubUser = await userResponse.json()

  // Find or create user
  let user = await getUserByGithubId(githubUser.id)

  if (!user) {
    user = await createUser({
      email: githubUser.email,
      name: githubUser.name,
      githubId: githubUser.id
    })
  }

  // Create session
  const sessionCookie = await createSession({ userId: user.id })

  return Response.redirect('/dashboard', {
    headers: {
      'Set-Cookie': sessionCookie
    }
  })
}
```

## Accessing User in Components

```tsx
// Using loader data
export const loader = createLoader(async ({ context }) => {
  const user = context.get('user')
  return { user }
})

export default function Profile({ loaderData }) {
  const { user } = loaderData

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <p>Email: {user.email}</p>
    </div>
  )
}
```

## Role-Based Access

```ts
// middleware/roles.ts
registerMiddleware('admin', async (request, next, context) => {
  const user = context.get('user')

  if (!user?.isAdmin) {
    return new Response('Forbidden', { status: 403 })
  }

  return next()
})

// Usage in routes
export const config = {
  middleware: ['auth', 'admin']
}
```

## Best Practices

1. **Always hash passwords** - Use bcrypt or Argon2
2. **Use HTTPS** - Especially for auth endpoints
3. **Set secure cookie flags** - httpOnly, secure, sameSite
4. **Implement CSRF protection** - For session-based auth
5. **Rate limit login attempts** - Prevent brute force
6. **Use short-lived tokens** - With refresh token rotation
7. **Validate on every request** - Don't trust client data
