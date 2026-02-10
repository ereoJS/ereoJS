# SaaS Tutorial: Setup

In this first chapter, you'll scaffold the TaskFlow project, install dependencies, define the database schema, and set up the application shell with a layout and landing page.

## Create the Project

```bash
bunx create-ereo@latest taskflow --template tailwind
cd taskflow
```

Install the additional packages we'll need throughout the tutorial:

```bash
bun add @ereo/forms @ereo/auth @ereo/db @ereo/db-drizzle @ereo/rpc @ereo/trace @ereo/state drizzle-orm
bun add -d drizzle-kit
```

## Project Structure

Here's what we'll build across all chapters. Create the directories now:

```bash
mkdir -p app/lib app/components app/rpc app/middleware
```

The final structure will look like this:

```
taskflow/
├── app/
│   ├── routes/
│   │   ├── _layout.tsx          # Root layout
│   │   ├── index.tsx            # Landing page
│   │   ├── login.tsx            # Login page
│   │   ├── register.tsx         # Registration page
│   │   ├── dashboard/
│   │   │   ├── _layout.tsx      # Dashboard layout (protected)
│   │   │   ├── index.tsx        # Dashboard home
│   │   │   ├── projects/
│   │   │   │   ├── index.tsx    # Project list
│   │   │   │   ├── new.tsx      # Create project
│   │   │   │   └── [id].tsx     # Project detail + tasks
│   │   │   └── settings.tsx     # Team settings
│   │   └── api/
│   │       └── rpc.ts           # RPC endpoint
│   ├── lib/
│   │   ├── db.ts                # Database connection
│   │   ├── schema.ts            # Drizzle schema
│   │   └── queries.ts           # Reusable queries
│   ├── components/
│   │   ├── TaskBoard.tsx        # Drag-and-drop task board
│   │   ├── DashboardStats.tsx   # Live statistics
│   │   └── ActivityFeed.tsx     # Real-time activity
│   ├── rpc/
│   │   ├── router.ts            # RPC router definition
│   │   └── procedures.ts        # Procedure definitions
│   └── middleware/
│       └── auth.ts              # Auth middleware
├── drizzle/                     # Migration files
├── drizzle.config.ts            # Drizzle Kit config
├── ereo.config.ts               # App config
└── package.json
```

## Define the Database Schema

This is the data model for TaskFlow. We'll use Drizzle ORM with SQLite — simple to set up, no external database server needed.

Create the schema file:

```ts
// app/lib/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const teamMembers = sqliteTable('team_members', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull().default('#3b82f6'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', { enum: ['todo', 'in_progress', 'done'] }).notNull().default('todo'),
  priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }).notNull().default('medium'),
  assigneeId: text('assignee_id').references(() => users.id),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  createdById: text('created_by_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const activity = sqliteTable('activity', {
  id: text('id').primaryKey(),
  teamId: text('team_id').notNull().references(() => teams.id),
  userId: text('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})
```

## Database Connection

Set up the database connection using `@ereo/db-drizzle`:

```ts
// app/lib/db.ts
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/'
import { createDrizzleAdapter, createDatabasePlugin } from '@ereo/db-drizzle'
import * as schema from './schema'

const sqlite = new Database('taskflow.db')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

export const dbAdapter = createDrizzleAdapter({
  driver: '',
  client: db,
})

export const dbPlugin = createDatabasePlugin(dbAdapter)
```

## Drizzle Kit Config

Set up migrations:

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './app/lib/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'taskflow.db',
  },
})
```

Generate and run the initial migration:

```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

## App Configuration

Wire everything together in the Ereo config:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { dbPlugin } from './app/lib/db'

export default defineConfig({
  plugins: [dbPlugin],
})
```

We'll add more plugins (auth, RPC, tailwind, trace) in later chapters.

## Root Layout

Create the application shell:

```tsx
// app/routes/_layout.tsx
import type { RouteComponentProps } from '@ereo/core'

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>TaskFlow</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  )
}
```

## Landing Page

Create a simple landing page:

```tsx
// app/routes/index.tsx
import { Link } from '@ereo/client'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-5xl font-bold tracking-tight mb-4">TaskFlow</h1>
      <p className="text-xl text-gray-600 mb-8 text-center max-w-md">
        Project management for teams that ship.
      </p>
      <div className="flex gap-4">
        <Link
          href="/register"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 bg-white text-gray-700 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </div>
  )
}
```

## Seed Data

Add a seed script to populate the database with sample data for development:

```ts
// app/lib/seed.ts
import { db } from './db'
import { users, teams, teamMembers, projects, tasks } from './schema'

const USER_ID = 'user_demo_001'
const TEAM_ID = 'team_demo_001'
const PROJECT_ID = 'proj_demo_001'

export async function seed() {
  // Check if already seeded
  const existing = db.select().from(users).where(({ id }, { eq }) => eq(id, USER_ID)).get()
  if (existing) return

  db.insert(users).values({
    id: USER_ID,
    email: 'demo@taskflow.dev',
    name: 'Demo User',
    passwordHash: await Bun.password.hash('password123'),
  }).run()

  db.insert(teams).values({
    id: TEAM_ID,
    name: 'Acme Corp',
    slug: 'acme',
  }).run()

  db.insert(teamMembers).values({
    id: 'tm_001',
    teamId: TEAM_ID,
    userId: USER_ID,
    role: 'owner',
  }).run()

  db.insert(projects).values({
    id: PROJECT_ID,
    teamId: TEAM_ID,
    name: 'Website Redesign',
    description: 'Redesign the marketing website with the new brand.',
    color: '#3b82f6',
  }).run()

  const sampleTasks = [
    { id: 'task_001', title: 'Design homepage mockup', status: 'done' as const, priority: 'high' as const },
    { id: 'task_002', title: 'Implement navigation', status: 'in_progress' as const, priority: 'high' as const },
    { id: 'task_003', title: 'Write copy for about page', status: 'in_progress' as const, priority: 'medium' as const },
    { id: 'task_004', title: 'Set up analytics', status: 'todo' as const, priority: 'low' as const },
    { id: 'task_005', title: 'Mobile responsive pass', status: 'todo' as const, priority: 'medium' as const },
    { id: 'task_006', title: 'Performance audit', status: 'todo' as const, priority: 'high' as const },
  ]

  for (const task of sampleTasks) {
    db.insert(tasks).values({
      ...task,
      projectId: PROJECT_ID,
      createdById: USER_ID,
    }).run()
  }

  console.log('Seeded database with demo data.')
}
```

Add a script to `package.json`:

```json
{
  "scripts": {
    "seed": "bun run app/lib/seed.ts"
  }
}
```

Run it:

```bash
bun run seed
```

## Verify Everything Works

Start the dev server:

```bash
bun run dev
```

Visit `http://localhost:3000`. You should see the TaskFlow landing page with "Get Started" and "Sign In" buttons. The links won't work yet — we'll build those pages next.

## What We've Done

- Scaffolded a new Ereo project with Tailwind CSS
- Defined a relational database schema with 6 tables (users, teams, team_members, projects, tasks, activity)
- Connected Drizzle ORM with SQLite via `@ereo/db-drizzle`
- Created the root layout and landing page
- Seeded the database with demo data

## Next Step

In the next chapter, we'll add user authentication — registration, login, sessions, and role-based access control.

[Continue to Chapter 2: Authentication →](/tutorials/saas/02-authentication)
