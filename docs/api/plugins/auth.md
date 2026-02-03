# Auth Plugin

Authentication plugin for EreoJS applications.

## Installation

```bash
bun add @ereo/auth
```

## Setup

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import auth from '@ereo/auth'

export default defineConfig({
  plugins: [
    auth({
      secret: process.env.AUTH_SECRET!,
      session: {
        strategy: 'cookie',
        maxAge: 7 * 24 * 60 * 60  // 7 days
      }
    })
  ]
})
```

## Plugin Options

```ts
auth({
  // Required: Secret for signing tokens/cookies
  secret: string,

  // Session configuration
  session: {
    strategy: 'cookie' | 'jwt',
    maxAge: number,              // Session lifetime in seconds
    cookieName: string,          // Default: 'session'
    httpOnly: boolean,           // Default: true
    secure: boolean,             // Default: true in production
    sameSite: 'lax' | 'strict' | 'none'
  },

  // Authentication providers
  providers: AuthProvider[],

  // Callbacks
  callbacks: {
    signIn?: (user, account) => boolean | Promise<boolean>,
    session?: (session, user) => Session,
    jwt?: (token, user) => JWT
  },

  // Custom pages
  pages: {
    signIn: '/login',
    signOut: '/logout',
    error: '/auth/error',
    newUser: '/welcome'
  }
})
```

## Providers

### Credentials

```ts
import { CredentialsProvider } from '@ereo/auth/providers'

auth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const user = await db.users.findByEmail(credentials.email)
        if (!user) return null

        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null

        return { id: user.id, email: user.email, name: user.name }
      }
    })
  ]
})
```

### OAuth Providers

```ts
import { GitHubProvider, GoogleProvider } from '@ereo/auth/providers'

auth({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    })
  ]
})
```

## Using Auth in Routes

### Get Session

```ts
import { createLoader } from '@ereo/data'
import { getSession } from '@ereo/auth'

export const loader = createLoader(async ({ request, context }) => {
  const session = await getSession(request, context)

  if (!session) {
    return { user: null }
  }

  return { user: session.user }
})
```

### Protect Routes

```ts
import { requireAuth } from '@ereo/auth'

export const config = {
  middleware: [requireAuth()]
}

export const loader = createLoader(async ({ context }) => {
  const session = context.get('session')
  return { user: session.user }
})
```

### Custom Redirect

```ts
export const config = {
  middleware: [
    requireAuth({
      redirectTo: '/login',
      returnTo: true  // Adds ?redirect= param
    })
  ]
}
```

## Sign In/Out

### Sign In Action

```ts
import { createAction } from '@ereo/data'
import { signIn } from '@ereo/auth'

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()

  const result = await signIn('credentials', {
    email: formData.get('email'),
    password: formData.get('password'),
    redirect: false
  })

  if (result.error) {
    return { error: result.error }
  }

  return Response.redirect('/dashboard')
})
```

### Sign Out Action

```ts
import { createAction } from '@ereo/data'
import { signOut } from '@ereo/auth'

export const action = createAction(async ({ request }) => {
  await signOut(request)
  return Response.redirect('/')
})
```

## Client Hooks

```tsx
import { useSession, useAuth } from '@ereo/auth/client'

export default function Header() {
  const session = useSession()
  const { signIn, signOut } = useAuth()

  if (session.status === 'loading') {
    return <div>Loading...</div>
  }

  if (session.status === 'authenticated') {
    return (
      <div>
        <span>Welcome, {session.data.user.name}</span>
        <button onClick={() => signOut()}>Sign Out</button>
      </div>
    )
  }

  return <button onClick={() => signIn()}>Sign In</button>
}
```

## Database Adapter

For persisting sessions and accounts:

```ts
import { DrizzleAdapter } from '@ereo/auth/adapters/drizzle'
import { db } from './lib/db'

auth({
  adapter: DrizzleAdapter(db),
  // ...
})
```

## Callbacks

### Sign In Callback

```ts
auth({
  callbacks: {
    async signIn({ user, account, profile }) {
      // Return true to allow sign in
      // Return false to deny
      // Throw error for custom message

      if (account.provider === 'github') {
        // Verify organization membership
        const isMember = await checkOrgMembership(profile.login)
        return isMember
      }

      return true
    }
  }
})
```

### Session Callback

```ts
auth({
  callbacks: {
    async session({ session, user, token }) {
      // Add custom data to session
      session.user.role = user.role
      return session
    }
  }
})
```

## Security

The plugin automatically:
- Signs and encrypts session cookies
- Validates CSRF tokens
- Implements secure defaults
- Handles token rotation

## Related

- [Authentication Guide](/guides/authentication)
- [Middleware](/api/router/middleware)
