# Dashboard Tutorial: Setup

Build an authenticated dashboard with interactive islands.

## What We're Building

A team dashboard with:
- User authentication (sessions)
- Protected routes
- Interactive widgets (islands)
- Real-time data updates

## Prerequisites

- Completed the [Getting Started](/getting-started/) guide
- Basic understanding of [Islands](/concepts/islands)
- Familiarity with [Authentication](/guides/authentication)

## Create the Project

```bash
bunx create-ereo@latest dashboard-app
cd dashboard-app
```

## Install Dependencies

```bash
bun add @ereo/auth bcrypt
bun add -d @types/bcrypt
```

## Project Structure

```
dashboard-app/
├── src/
│   ├── routes/
│   │   ├── index.tsx           # Landing page
│   │   ├── login.tsx           # Login page
│   │   ├── register.tsx        # Registration
│   │   └── dashboard/
│   │       ├── _layout.tsx     # Protected layout
│   │       ├── index.tsx       # Dashboard home
│   │       ├── analytics.tsx   # Analytics page
│   │       └── settings.tsx    # User settings
│   ├── islands/
│   │   ├── StatsWidget.tsx     # Interactive stats
│   │   ├── ActivityFeed.tsx    # Live activity
│   │   └── ChartWidget.tsx     # Data visualization
│   ├── middleware/
│   │   └── auth.ts             # Auth middleware
│   ├── lib/
│   │   ├── auth.ts             # Auth utilities
│   │   └── db.ts               # Database setup
│   └── components/
│       ├── Sidebar.tsx
│       └── Header.tsx
├── ereo.config.ts
└── package.json
```

## Database Setup

Create `src/lib/db.ts`:

```ts
import { Database } from 'bun:sqlite'

const db = new Database('dashboard.db')

// Initialize tables
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`)

export { db }
```

## Auth Utilities

Create `src/lib/auth.ts`:

```ts
import { db } from './db'
import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'

interface User {
  id: number
  email: string
  name: string
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  const hashedPassword = await bcrypt.hash(password, 10)

  const result = db.run(
    'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
    [email, hashedPassword, name]
  )

  return {
    id: result.lastInsertRowid as number,
    email,
    name
  }
}

export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = db.query<{ id: number; email: string; password: string; name: string }, [string]>(
    'SELECT * FROM users WHERE email = ?'
  ).get(email)

  if (!user) return null

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) return null

  return { id: user.id, email: user.email, name: user.name }
}

export function createSession(userId: number): string {
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  db.run(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    [sessionId, userId, expiresAt.toISOString()]
  )

  return sessionId
}

export function getSession(sessionId: string): User | null {
  const result = db.query<{ user_id: number; email: string; name: string; expires_at: string }, [string]>(`
    SELECT s.user_id, u.email, u.name, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(sessionId)

  if (!result) return null
  if (new Date(result.expires_at) < new Date()) {
    db.run('DELETE FROM sessions WHERE id = ?', [sessionId])
    return null
  }

  return { id: result.user_id, email: result.email, name: result.name }
}

export function deleteSession(sessionId: string): void {
  db.run('DELETE FROM sessions WHERE id = ?', [sessionId])
}
```

## Auth Middleware

Create `src/middleware/auth.ts`:

```ts
import type { MiddlewareHandler } from '@ereo/core'
import { getSession } from '../lib/auth'

export const authMiddleware: MiddlewareHandler = async (request, context, next) => {
  const cookies = request.headers.get('cookie') || ''
  const sessionId = cookies.match(/session=([^;]+)/)?.[1]

  if (sessionId) {
    const user = getSession(sessionId)
    if (user) {
      context.set('user', user)
    }
  }

  return next()
}

export const requireAuth: MiddlewareHandler = async (request, context, next) => {
  const user = context.get('user')

  if (!user) {
    return Response.redirect('/login?redirect=' + encodeURIComponent(request.url))
  }

  return next()
}
```

## Configuration

Update `ereo.config.ts`:

```ts
import { defineConfig } from '@ereo/core'
import { authMiddleware } from './src/middleware/auth'

export default defineConfig({
  middleware: [authMiddleware],
  build: {
    target: 'bun'
  }
})
```

## Next Steps

In the next chapter, we'll build the authentication pages:
- Login form with validation
- Registration with error handling
- Session management

[Continue to Chapter 2: Authentication →](./02-authentication.md)
