# SaaS Tutorial: Database

With auth in place, we need a clean data access layer. In this chapter, you'll build a query module on top of Drizzle ORM that the rest of the app — loaders, actions, and RPC procedures — will use. You'll also build the project list and project detail routes.

## Query Module

Create a module that encapsulates all database queries. This keeps SQL out of route files and makes queries reusable across loaders, actions, and RPC procedures.

```ts
// app/lib/queries.ts
import { db } from './db'
import { projects, tasks, teamMembers, users, activity } from './schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'

// --- Projects ---

export function getProjectsForTeam(teamId: string) {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      color: projects.color,
      createdAt: projects.createdAt,
      taskCount: count(tasks.id),
    })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .where(eq(projects.teamId, teamId))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt))
    .all()
}

export function getProject(projectId: string, teamId: string) {
  return db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.teamId, teamId)))
    .get()
}

export function createProject(data: { teamId: string; name: string; description?: string; color?: string }) {
  const id = `proj_${crypto.randomUUID()}`
  db.insert(projects).values({ id, ...data }).run()
  return id
}

// --- Tasks ---

export function getTasksForProject(projectId: string) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      assigneeName: users.name,
      assigneeId: tasks.assigneeId,
    })
    .from(tasks)
    .leftJoin(users, eq(users.id, tasks.assigneeId))
    .where(eq(tasks.projectId, projectId))
    .orderBy(desc(tasks.createdAt))
    .all()
}

export function getTask(taskId: string) {
  return db.select().from(tasks).where(eq(tasks.id, taskId)).get()
}

export function createTask(data: {
  projectId: string
  title: string
  description?: string
  status?: 'todo' | 'in_progress' | 'done'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assigneeId?: string
  dueDate?: Date
  createdById: string
}) {
  const id = `task_${crypto.randomUUID()}`
  db.insert(tasks).values({ id, ...data }).run()
  return id
}

export function updateTask(taskId: string, data: Partial<{
  title: string
  description: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigneeId: string | null
  dueDate: Date | null
}>) {
  db.update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, taskId))
    .run()
}

export function deleteTask(taskId: string) {
  db.delete(tasks).where(eq(tasks.id, taskId)).run()
}

// --- Team Members ---

export function getTeamMembers(teamId: string) {
  return db
    .select({
      id: teamMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: teamMembers.role,
      avatarUrl: users.avatarUrl,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(eq(teamMembers.teamId, teamId))
    .all()
}

// --- Dashboard Stats ---

export function getDashboardStats(teamId: string) {
  const projectCount = db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.teamId, teamId))
    .get()

  const taskStats = db
    .select({
      status: tasks.status,
      count: count(),
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(eq(projects.teamId, teamId))
    .groupBy(tasks.status)
    .all()

  const memberCount = db
    .select({ value: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
    .get()

  const statusMap = Object.fromEntries(taskStats.map((s) => [s.status, s.count]))

  return {
    projects: projectCount?.value ?? 0,
    members: memberCount?.value ?? 0,
    tasks: {
      todo: statusMap.todo ?? 0,
      in_progress: statusMap.in_progress ?? 0,
      done: statusMap.done ?? 0,
      total: taskStats.reduce((sum, s) => sum + s.count, 0),
    },
  }
}

// --- Activity Log ---

export function logActivity(data: {
  teamId: string
  userId: string
  action: string
  targetType: string
  targetId: string
  metadata?: Record<string, unknown>
}) {
  const id = `act_${crypto.randomUUID()}`
  db.insert(activity).values({ id, ...data }).run()
  return id
}

export function getRecentActivity(teamId: string, limit = 20) {
  return db
    .select({
      id: activity.id,
      action: activity.action,
      targetType: activity.targetType,
      targetId: activity.targetId,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
      userName: users.name,
    })
    .from(activity)
    .innerJoin(users, eq(users.id, activity.userId))
    .where(eq(activity.teamId, teamId))
    .orderBy(desc(activity.createdAt))
    .limit(limit)
    .all()
}
```

## Project List Route

Now use these queries in a route with a loader:

```tsx
// app/routes/dashboard/projects/index.tsx
import { createLoader } from '@ereo/data'
import { Link, useLoaderData } from '@ereo/client'
import { getProjectsForTeam } from '~/lib/queries'
import { getUser } from '@ereo/auth'
import { db } from '~/lib/db'
import { teamMembers } from '~/lib/schema'
import { eq } from 'drizzle-orm'
import type { RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ context }) => {
  const user = getUser(context)
  const membership = db.select().from(teamMembers).where(eq(teamMembers.userId, user!.id)).get()
  const projects = getProjectsForTeam(membership!.teamId)
  return { projects }
})

export default function ProjectList({ loaderData }: RouteComponentProps) {
  const { projects } = loaderData

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          href="/dashboard/projects/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No projects yet. Create your first one.</p>
          <Link href="/dashboard/projects/new" className="text-blue-600 hover:underline">
            Create a project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="block bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <h3 className="font-semibold">{project.name}</h3>
              </div>
              {project.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">{project.description}</p>
              )}
              <p className="text-xs text-gray-400">{project.taskCount} tasks</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Create Project Route

A simple form for creating new projects:

```tsx
// app/routes/dashboard/projects/new.tsx
import { createAction, redirect } from '@ereo/data'
import { Form, Link, useActionData, useNavigation } from '@ereo/client'
import { createProject, logActivity } from '~/lib/queries'
import { getUser } from '@ereo/auth'
import { db } from '~/lib/db'
import { teamMembers } from '~/lib/schema'
import { eq } from 'drizzle-orm'
import type { RouteComponentProps } from '@ereo/core'

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

export const action = createAction(async ({ request, context }) => {
  const formData = await request.formData()
  const name = formData.get('name') as string
  const description = formData.get('description') as string
  const color = formData.get('color') as string || '#3b82f6'

  if (!name || name.length < 2) {
    return { success: false, errors: { name: 'Project name must be at least 2 characters.' } }
  }

  const user = getUser(context)!
  const membership = db.select().from(teamMembers).where(eq(teamMembers.userId, user.id)).get()!

  const projectId = createProject({
    teamId: membership.teamId,
    name,
    description: description || undefined,
    color,
  })

  logActivity({
    teamId: membership.teamId,
    userId: user.id,
    action: 'created',
    targetType: 'project',
    targetId: projectId,
    metadata: { name },
  })

  return redirect(`/dashboard/projects/${projectId}`)
})

export default function NewProject(props: RouteComponentProps) {
  const actionData = useActionData<{ success: boolean; errors?: Record<string, string> }>()
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-6">New Project</h1>

      <Form method="post" className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Project name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g. Website Redesign"
          />
          {actionData?.errors?.name && (
            <p className="text-sm text-red-600 mt-1">{actionData.errors.name}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
          <div className="flex gap-2">
            {COLORS.map((color) => (
              <label key={color} className="cursor-pointer">
                <input type="radio" name="color" value={color} defaultChecked={color === '#3b82f6'} className="sr-only peer" />
                <div
                  className="w-8 h-8 rounded-full border-2 border-transparent peer-checked:border-gray-900 peer-checked:ring-2 peer-checked:ring-offset-2 peer-checked:ring-gray-900"
                  style={{ backgroundColor: color }}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
          <Link href="/dashboard/projects" className="px-4 py-2 text-gray-600 text-sm hover:text-gray-900">
            Cancel
          </Link>
        </div>
      </Form>
    </div>
  )
}
```

## Project Detail Route

This route loads a project and its tasks. The task list is displayed grouped by status (todo, in progress, done):

```tsx
// app/routes/dashboard/projects/[id].tsx
import { createLoader } from '@ereo/data'
import { Link, useLoaderData } from '@ereo/client'
import { getProject, getTasksForProject, getTeamMembers } from '~/lib/queries'
import { getUser } from '@ereo/auth'
import { db } from '~/lib/db'
import { teamMembers } from '~/lib/schema'
import { eq } from 'drizzle-orm'
import type { RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ params, context }) => {
  const user = getUser(context)!
  const membership = db.select().from(teamMembers).where(eq(teamMembers.userId, user.id)).get()!

  const project = getProject(params.id, membership.teamId)
  if (!project) throw new Response('Project not found', { status: 404 })

  const tasks = getTasksForProject(project.id)
  const members = getTeamMembers(membership.teamId)

  return { project, tasks, members, teamId: membership.teamId }
})

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

export default function ProjectDetail({ loaderData }: RouteComponentProps) {
  const { project, tasks, members } = loaderData

  const grouped = {
    todo: tasks.filter((t: any) => t.status === 'todo'),
    in_progress: tasks.filter((t: any) => t.status === 'in_progress'),
    done: tasks.filter((t: any) => t.status === 'done'),
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: project.color }} />
          <h1 className="text-2xl font-bold">{project.name}</h1>
        </div>
        <Link
          href={`/dashboard/projects/${project.id}/tasks/new`}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Add Task
        </Link>
      </div>

      {project.description && (
        <p className="text-gray-600 mb-6">{project.description}</p>
      )}

      {/* Task columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(['todo', 'in_progress', 'done'] as const).map((status) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-sm text-gray-500 uppercase tracking-wide">
                {STATUS_LABELS[status]}
              </h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {grouped[status].length}
              </span>
            </div>
            <div className="space-y-3">
              {grouped[status].map((task: any) => (
                <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="font-medium mb-2">{task.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                    {task.assigneeName && (
                      <span className="text-xs text-gray-500">{task.assigneeName}</span>
                    )}
                    {task.dueDate && (
                      <span className="text-xs text-gray-400">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {grouped[status].length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No tasks</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Understanding the Data Flow

The query module acts as a clean boundary between routes and the database:

```
Route Loader                     Query Module                    Drizzle ORM
┌──────────┐                    ┌──────────────┐               ┌──────────┐
│ loader() │───getProject()────▶│ queries.ts   │───select()───▶│ SQLite   │
│          │───getTasksFor      │              │───join()       │          │
│          │   Project()────────▶│              │───where()      │          │
│          │◀──returns data──────│              │◀──returns      │          │
└──────────┘                    └──────────────┘               └──────────┘
```

This separation means:
- **Routes** handle request/response logic and call query functions
- **Queries** handle SQL composition and return typed results
- **RPC procedures** (Chapter 6) will reuse the same query functions

## Try It Out

1. Navigate to `/dashboard/projects` — you should see the seeded "Website Redesign" project
2. Click "New Project" and create a project
3. Click into a project to see its tasks grouped by status
4. The "Add Task" link won't work yet — we'll build that form next

## What We've Done

- Built a reusable query module with typed database operations
- Created project list, create, and detail routes with loaders and actions
- Displayed tasks grouped by status in a Kanban-style layout
- Added activity logging for audit trails
- Established a pattern for clean data access that loaders, actions, and RPC procedures can all share

## Next Step

The database layer is solid. In the next chapter, we'll build the task creation and editing forms using `@ereo/forms` — with client-side validation, field arrays, and submit handling.

[← Previous: Authentication](/tutorials/saas/02-authentication) | [Continue to Chapter 4: Forms →](/tutorials/saas/04-forms)
