# Dashboard Tutorial: Authentication

Implement user authentication with login and registration.

## Login Page

Create `app/routes/login.tsx`:

```tsx
import { createLoader, createAction } from '@ereo/data'
import { useActionData } from '@ereo/client'
import { Form, Link } from '@ereo/client'
import { verifyCredentials, createSession } from '~/lib/auth'

export const loader = createLoader(async ({ request, context }) => {
  // Redirect if already logged in
  const user = context.get('user')
  if (user) {
    return Response.redirect('/dashboard')
  }

  const url = new URL(request.url)
  return { redirect: url.searchParams.get('redirect') || '/dashboard' }
})

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirect = formData.get('redirect') as string || '/dashboard'

  // Validation
  const errors: Record<string, string> = {}
  if (!email) errors.email = 'Email is required'
  if (!password) errors.password = 'Password is required'

  if (Object.keys(errors).length) {
    return { errors }
  }

  // Verify credentials
  const user = await verifyCredentials(email, password)
  if (!user) {
    return { errors: { form: 'Invalid email or password' } }
  }

  // Create session
  const sessionId = createSession(user.id)

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirect,
      'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    }
  })
})

export default function LoginPage({ loaderData }: { loaderData: any }) {
  const actionData = useActionData()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>

        {actionData?.errors?.form && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">
            {actionData.errors.form}
          </div>
        )}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="redirect" value={loaderData.redirect} />

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.email && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="password"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.password && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </button>
        </Form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
```

## Registration Page

Create `app/routes/register.tsx`:

```tsx
import { createLoader, createAction } from '@ereo/data'
import { useActionData } from '@ereo/client'
import { Form, Link } from '@ereo/client'
import { createUser, createSession } from '~/lib/auth'
import { db } from '~/lib/db'

export const loader = createLoader(async ({ context }) => {
  const user = context.get('user')
  if (user) {
    return Response.redirect('/dashboard')
  }
  return {}
})

export const action = createAction(async ({ request }) => {
  const formData = await request.formData()
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  // Validation
  const errors: Record<string, string> = {}
  if (!name || name.length < 2) errors.name = 'Name must be at least 2 characters'
  if (!email || !email.includes('@')) errors.email = 'Valid email is required'
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters'
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match'

  // Check if email exists
  const existing = db.query('SELECT id FROM users WHERE email = ?').get(email)
  if (existing) errors.email = 'Email already registered'

  if (Object.keys(errors).length) {
    return { errors }
  }

  // Create user
  const user = await createUser(email, password, name)
  const sessionId = createSession(user.id)

  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/dashboard',
      'Set-Cookie': `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    }
  })
})

export default function RegisterPage() {
  const actionData = useActionData()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>

        <Form method="post" className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              name="name"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.name && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              name="email"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.email && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              name="password"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.password && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            {actionData?.errors?.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Account
          </button>
        </Form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
```

## Logout Action

Create `app/routes/logout.tsx`:

```tsx
import { createAction } from '@ereo/data'
import { deleteSession } from '~/lib/auth'

export const action = createAction(async ({ request }) => {
  const cookies = request.headers.get('cookie') || ''
  const sessionId = cookies.match(/session=([^;]+)/)?.[1]

  if (sessionId) {
    deleteSession(sessionId)
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0'
    }
  })
})

// No UI - this is an action-only route
export default function Logout() {
  return null
}
```

## Protected Dashboard Layout

Create `app/routes/dashboard/_layout.tsx`:

```tsx
import { createLoader } from '@ereo/data'
import { Outlet, Link, Form } from '@ereo/client'

// Note: Authentication is enforced by app/routes/dashboard/_middleware.ts
// which we created in Chapter 1. It runs before this layout's loader.

export const loader = createLoader(async ({ context }) => {
  const user = context.get('user')
  return { user }
})

export default function DashboardLayout({ loaderData }: { loaderData: any }) {
  const { user } = loaderData

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white">
        <div className="p-4">
          <h2 className="text-xl font-bold">Dashboard</h2>
        </div>

        <nav className="mt-4">
          <Link
            href="/dashboard"
            className="block px-4 py-2 hover:bg-gray-800"
          >
            Overview
          </Link>
          <Link
            href="/dashboard/analytics"
            className="block px-4 py-2 hover:bg-gray-800"
          >
            Analytics
          </Link>
          <Link
            href="/dashboard/settings"
            className="block px-4 py-2 hover:bg-gray-800"
          >
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>

          <Form method="post" action="/logout">
            <button
              type="submit"
              className="text-gray-600 hover:text-gray-900"
            >
              Sign Out
            </button>
          </Form>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
```

## Testing Authentication

Start the dev server and test:

```bash
bun dev
```

1. Visit `/register` and create an account
2. You'll be redirected to `/dashboard`
3. Refresh the page - you stay logged in
4. Click "Sign Out" - redirected to homepage
5. Visit `/dashboard` without logging in - redirected to login

## Next Steps

In the next chapter, we'll build interactive dashboard widgets using islands.

[Continue to Chapter 3: Interactive Islands →](./03-islands.md)
