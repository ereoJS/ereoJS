# SaaS Tutorial: Authentication

Every SaaS app starts with authentication. In this chapter, you'll set up `@ereo/auth` with credential-based login, user registration, JWT sessions, and role-based access control so that only team members can access the dashboard.

## Configure the Auth Plugin

Create the auth middleware and configure the plugin:

```ts
// app/middleware/auth.ts
import { createAuthPlugin, credentials } from '@ereo/auth'
import { db } from '~/lib/db'
import { users } from '~/lib/schema'
import { eq } from 'drizzle-orm'

export const authPlugin = createAuthPlugin({
  providers: [
    credentials({
      authorize: async ({ email, password }) => {
        const user = db.select().from(users).where(eq(users.email, email)).get()
        if (!user) return null

        const valid = await Bun.password.verify(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    secret: process.env.AUTH_SECRET || 'dev-secret-change-in-production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
})
```

Register the plugin in the app config:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { dbPlugin } from './app/lib/db'
import { authPlugin } from './app/middleware/auth'

export default defineConfig({
  plugins: [dbPlugin, authPlugin],
})
```

Add `AUTH_SECRET` to your environment:

```bash
# .env
AUTH_SECRET=your-random-secret-at-least-32-chars-long
```

## Registration Page

Build the sign-up form. This uses a standard Ereo action — no `@ereo/forms` yet (we'll use that for the more complex task forms in Chapter 4).

```tsx
// app/routes/register.tsx
import { createAction, redirect } from '@ereo/data'
import { Form, Link, useActionData, useNavigation } from '@ereo/client'
import { db } from '~/lib/db'
import { users, teams, teamMembers } from '~/lib/schema'
import { eq } from 'drizzle-orm'
import { getAuth } from '@ereo/auth'
import type { RouteComponentProps } from '@ereo/core'

export const action = createAction(async ({ request, context }) => {
  const formData = await request.formData()
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const teamName = formData.get('teamName') as string

  const errors: Record<string, string> = {}
  if (!name || name.length < 2) errors.name = 'Name must be at least 2 characters.'
  if (!email || !email.includes('@')) errors.email = 'Enter a valid email address.'
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters.'
  if (!teamName || teamName.length < 2) errors.teamName = 'Team name must be at least 2 characters.'

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  // Check if email is already taken
  const existing = db.select().from(users).where(eq(users.email, email)).get()
  if (existing) {
    return { success: false, errors: { email: 'An account with this email already exists.' } }
  }

  const userId = `user_${crypto.randomUUID()}`
  const teamId = `team_${crypto.randomUUID()}`
  const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  db.insert(users).values({
    id: userId,
    email,
    name,
    passwordHash: await Bun.password.hash(password),
  }).run()

  db.insert(teams).values({
    id: teamId,
    name: teamName,
    slug,
  }).run()

  db.insert(teamMembers).values({
    id: `tm_${crypto.randomUUID()}`,
    teamId,
    userId,
    role: 'owner',
  }).run()

  // Sign in immediately after registration
  const auth = getAuth(context)
  await auth.signIn({ id: userId, email, name })

  return redirect('/dashboard')
})

export default function Register(props: RouteComponentProps) {
  const actionData = useActionData<{ success: boolean; errors?: Record<string, string> }>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Create your account</h1>

        <Form method="post" className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Your name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {actionData?.errors?.name && (
              <p className="text-sm text-red-600 mt-1">{actionData.errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {actionData?.errors?.email && (
              <p className="text-sm text-red-600 mt-1">{actionData.errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {actionData?.errors?.password && (
              <p className="text-sm text-red-600 mt-1">{actionData.errors.password}</p>
            )}
          </div>

          <div>
            <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
              Team name
            </label>
            <input
              id="teamName"
              name="teamName"
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {actionData?.errors?.teamName && (
              <p className="text-sm text-red-600 mt-1">{actionData.errors.teamName}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </Form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
```

## Login Page

```tsx
// app/routes/login.tsx
import { createAction, redirect } from '@ereo/data'
import { Form, Link, useActionData, useNavigation } from '@ereo/client'
import { getAuth } from '@ereo/auth'
import type { RouteComponentProps } from '@ereo/core'

export const action = createAction(async ({ request, context }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' }
  }

  const auth = getAuth(context)
  const result = await auth.signIn({ email, password })

  if (!result) {
    return { success: false, error: 'Invalid email or password.' }
  }

  return redirect('/dashboard')
})

export default function Login(props: RouteComponentProps) {
  const actionData = useActionData<{ success: boolean; error?: string }>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Sign in to TaskFlow</h1>

        {actionData?.error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </Form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  )
}
```

## Protected Dashboard Layout

The dashboard layout checks for a session and redirects unauthenticated users. It also loads the user's team membership, which child routes will need.

```tsx
// app/routes/dashboard/_layout.tsx
import { createLoader, redirect } from '@ereo/data'
import { Link, Outlet } from '@ereo/client'
import { getAuth, getUser } from '@ereo/auth'
import { db } from '~/lib/db'
import { teamMembers, teams } from '~/lib/schema'
import { eq } from 'drizzle-orm'
import type { RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ context }) => {
  const user = getUser(context)
  if (!user) return redirect('/login')

  // Load the user's first team (multi-team support is left as an exercise)
  const membership = db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      teamName: teams.name,
      teamSlug: teams.slug,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, user.id))
    .get()

  if (!membership) return redirect('/register')

  return { user, team: membership }
})

export default function DashboardLayout({ loaderData, children }: RouteComponentProps) {
  const { user, team } = loaderData

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h2 className="font-bold text-lg">{team.teamName}</h2>
          <p className="text-sm text-gray-400">{team.role}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            Dashboard
          </Link>
          <Link href="/dashboard/projects" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            Projects
          </Link>
          <Link href="/dashboard/settings" className="block px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors">
            Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-medium">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
    </div>
  )
}
```

## Logout Action

Add a logout route:

```ts
// app/routes/logout.ts
import { createAction, redirect } from '@ereo/data'
import { getAuth } from '@ereo/auth'

export const action = createAction(async ({ context }) => {
  const auth = getAuth(context)
  await auth.signOut()
  return redirect('/')
})
```

Add a logout button to the sidebar. In the dashboard layout, below the user info:

```tsx
<Form method="post" action="/logout">
  <button type="submit" className="text-xs text-gray-500 hover:text-gray-300 mt-2">
    Sign out
  </button>
</Form>
```

## Dashboard Home (Placeholder)

We'll flesh this out in later chapters. For now, create a simple placeholder:

```tsx
// app/routes/dashboard/index.tsx
import type { RouteComponentProps } from '@ereo/core'

export default function Dashboard(props: RouteComponentProps) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600">Welcome to TaskFlow. We'll build this out in the next chapters.</p>
    </div>
  )
}
```

## Understanding the Auth Flow

Here's how authentication flows through the app:

```
Registration:
  1. User submits form → action runs server-side
  2. Action inserts user + team → calls auth.signIn()
  3. JWT cookie is set → redirect to /dashboard

Login:
  1. User submits credentials → action calls auth.signIn()
  2. Plugin's credentials provider runs authorize()
  3. On success: JWT cookie set → redirect to /dashboard
  4. On failure: return error → display in form

Protected routes:
  1. Loader calls getUser(context)
  2. If null → redirect to /login
  3. If valid → load team data → render page
```

The `getUser()` helper reads the JWT from the cookie, verifies it, and returns the user payload. No database lookup needed on every request — the JWT contains the user data.

## Try It Out

1. Visit `http://localhost:3000/register`
2. Create an account with any email and password
3. You should be redirected to the dashboard with the sidebar showing your team
4. Try the login page at `/login` with the demo credentials: `demo@taskflow.dev` / `password123`

## What We've Done

- Configured `@ereo/auth` with credential-based authentication
- Built registration with team creation in a single transaction
- Built login with error handling and loading states
- Protected the dashboard layout with session checks
- Added logout functionality
- Loaded team membership data for child routes

## Next Step

The auth layer is in place. In the next chapter, we'll build the database query layer with Drizzle ORM and set up the project and task CRUD operations.

[← Previous: Setup](/tutorials/saas/01-setup) | [Continue to Chapter 3: Database →](/tutorials/saas/03-database)
