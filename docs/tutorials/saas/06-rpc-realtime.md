# SaaS Tutorial: RPC & Real-time

In the previous chapter, task status changes updated the local UI instantly. But if another team member changes a task, you won't see it until you refresh. In this chapter, you'll add `@ereo/rpc` to build type-safe server procedures and WebSocket subscriptions that broadcast changes to all connected clients in real time.

## What We're Building

```
Browser A (Alice)                      Server                    Browser B (Bob)
┌──────────────┐                ┌──────────────────┐           ┌──────────────┐
│ TaskBoard    │──moveTask()───▶│ RPC mutation      │           │ TaskBoard    │
│              │                │  ├── update DB     │           │              │
│              │                │  ├── log activity   │           │              │
│              │                │  └── yield event ──────────────▶│ subscription │
│              │◀──subscription─│                    │           │  updates UI  │
└──────────────┘                └──────────────────┘           └──────────────┘
```

When Alice moves a task, the RPC mutation updates the database and yields an event. Bob's browser, connected via WebSocket, receives the event and updates the TaskBoard signal — no polling needed.

## Define Procedures

Start by defining the RPC procedures for task management:

```ts
// app/rpc/procedures.ts
import { procedure } from '@ereo/rpc'
import { createAuthMiddleware } from '@ereo/rpc/middleware'
import { getUser } from '@ereo/auth'
import { getTasksForProject, updateTask, createTask, deleteTask, getDashboardStats, getRecentActivity, logActivity } from '~/lib/queries'
import { db } from '~/lib/db'
import { teamMembers } from '~/lib/schema'
import { eq } from 'drizzle-orm'

// Event emitter for real-time broadcasts
type TaskEvent = {
  type: 'task_updated' | 'task_created' | 'task_deleted'
  taskId: string
  teamId: string
  data: Record<string, unknown>
}

const listeners = new Set<(event: TaskEvent) => void>()

export function emitTaskEvent(event: TaskEvent) {
  for (const listener of listeners) {
    listener(event)
  }
}

function subscribeToEvents(teamId: string): AsyncGenerator<TaskEvent> {
  const queue: TaskEvent[] = []
  let resolve: (() => void) | null = null

  const listener = (event: TaskEvent) => {
    if (event.teamId !== teamId) return
    queue.push(event)
    resolve?.()
  }

  listeners.add(listener)

  return {
    async next() {
      while (queue.length === 0) {
        await new Promise<void>((r) => { resolve = r })
        resolve = null
      }
      return { value: queue.shift()!, done: false }
    },
    async return() {
      listeners.delete(listener)
      return { value: undefined, done: true }
    },
    async throw(err: unknown) {
      listeners.delete(listener)
      return { value: undefined, done: true }
    },
    [Symbol.asyncIterator]() { return this },
  }
}

// Auth middleware: extract user from context
const authed = procedure.use(async ({ ctx, next }) => {
  const user = ctx.ctx?.user
  if (!user) {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Must be logged in' } }
  }
  const membership = db.select().from(teamMembers).where(eq(teamMembers.userId, user.id)).get()
  if (!membership) {
    return { ok: false, error: { code: 'FORBIDDEN', message: 'Not a team member' } }
  }
  return next({ ...ctx, user, teamId: membership.teamId })
})

// --- Queries ---

export const dashboardQuery = authed.query(async ({ user, teamId }) => {
  const stats = getDashboardStats(teamId)
  const allTasks = db
    .select({ id: (await import('~/lib/schema')).tasks.id, title: (await import('~/lib/schema')).tasks.title, status: (await import('~/lib/schema')).tasks.status, priority: (await import('~/lib/schema')).tasks.priority })
    .from((await import('~/lib/schema')).tasks)
    .innerJoin((await import('~/lib/schema')).projects, eq((await import('~/lib/schema')).projects.id, (await import('~/lib/schema')).tasks.projectId))
    .where(eq((await import('~/lib/schema')).projects.teamId, teamId))
    .all()
  const recentActivity = getRecentActivity(teamId, 20)
  return { stats, tasks: allTasks, recentActivity }
})

export const projectTasksQuery = authed.query(
  { parse: (data: unknown) => data as { projectId: string } },
  async ({ input, teamId }) => {
    return getTasksForProject(input.projectId)
  }
)

// --- Mutations ---

export const updateTaskMutation = authed.mutation(
  { parse: (data: unknown) => data as { taskId: string; updates: Record<string, unknown> } },
  async ({ input, user, teamId }) => {
    updateTask(input.taskId, input.updates as any)

    logActivity({
      teamId,
      userId: user.id,
      action: 'updated',
      targetType: 'task',
      targetId: input.taskId,
      metadata: input.updates,
    })

    emitTaskEvent({
      type: 'task_updated',
      taskId: input.taskId,
      teamId,
      data: input.updates,
    })

    return { success: true }
  }
)

export const createTaskMutation = authed.mutation(
  {
    parse: (data: unknown) => data as {
      projectId: string
      title: string
      description?: string
      status?: string
      priority?: string
      assigneeId?: string
    },
  },
  async ({ input, user, teamId }) => {
    const taskId = createTask({
      ...input,
      status: (input.status as any) || 'todo',
      priority: (input.priority as any) || 'medium',
      createdById: user.id,
    })

    logActivity({
      teamId,
      userId: user.id,
      action: 'created',
      targetType: 'task',
      targetId: taskId,
      metadata: { title: input.title },
    })

    emitTaskEvent({
      type: 'task_created',
      taskId,
      teamId,
      data: { ...input, id: taskId },
    })

    return { success: true, taskId }
  }
)

// --- Subscription ---

export const taskEvents = authed.subscription(async function* ({ teamId }) {
  yield* subscribeToEvents(teamId)
})
```

## Create the RPC Router

Wire the procedures into a router:

```ts
// app/rpc/router.ts
import { createRouter } from '@ereo/rpc'
import {
  dashboardQuery,
  projectTasksQuery,
  updateTaskMutation,
  createTaskMutation,
  taskEvents,
} from './procedures'

export const rpcRouter = createRouter({
  dashboard: dashboardQuery,
  projectTasks: projectTasksQuery,
  updateTask: updateTaskMutation,
  createTask: createTaskMutation,
  taskEvents,
})

export type AppRouter = typeof rpcRouter
```

## Register the RPC Plugin

Add the RPC endpoint to the app config:

```ts
// ereo.config.ts
import { defineConfig } from '@ereo/core'
import { dbPlugin } from './app/lib/db'
import { authPlugin } from './app/middleware/auth'
import { rpcPlugin } from '@ereo/rpc'
import { rpcRouter } from './app/rpc/router'

const rpc = rpcPlugin({
  router: rpcRouter,
  endpoint: '/api/rpc',
})

export default defineConfig({
  plugins: [dbPlugin, authPlugin, rpc],
})
```

## RPC API Route

Create the route that handles RPC requests and WebSocket upgrades:

```ts
// app/routes/api/rpc.ts
import { rpcRouter } from '~/rpc/router'

export async function handler(request: Request, context: any) {
  return rpcRouter.handler(request, context)
}
```

## Update TaskBoard to Use RPC

Replace the raw `fetch` calls with the type-safe RPC client. The subscription provides real-time updates:

```tsx
// app/components/TaskBoard.tsx
'use client'
import { useState, useEffect } from 'react'
import { useSignal, batch } from '@ereo/state'
import { createClient } from '@ereo/rpc/client'
import { dashboardData, tasksByStatus } from '~/lib/dashboard-state'
import type { DashboardData, TaskSummary } from '~/lib/dashboard-state'
import type { AppRouter } from '~/rpc/router'

const rpc = createClient<AppRouter>({
  httpEndpoint: '/api/rpc',
  wsEndpoint: `ws://${typeof window !== 'undefined' ? window.location.host : 'localhost:3000'}/api/rpc`,
})

interface TaskBoardProps {
  projectId: string
  initialData: DashboardData
}

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

export default function TaskBoard({ projectId, initialData }: TaskBoardProps) {
  if (!dashboardData.get()) {
    dashboardData.set(initialData)
  }

  const grouped = useSignal(tasksByStatus)
  const [connected, setConnected] = useState(false)

  // Subscribe to real-time task events
  useEffect(() => {
    const unsub = rpc.taskEvents.subscribe({
      onData: (event) => {
        setConnected(true)
        const current = dashboardData.get()
        if (!current) return

        if (event.type === 'task_updated') {
          batch(() => {
            const updatedTasks = current.tasks.map((t) =>
              t.id === event.taskId ? { ...t, ...event.data } : t
            )
            dashboardData.set({ ...current, tasks: updatedTasks })
          })
        }

        if (event.type === 'task_created') {
          const newTask = event.data as TaskSummary
          dashboardData.set({
            ...current,
            tasks: [...current.tasks, newTask],
            stats: {
              ...current.stats,
              tasks: {
                ...current.stats.tasks,
                [newTask.status]: current.stats.tasks[newTask.status] + 1,
                total: current.stats.tasks.total + 1,
              },
            },
          })
        }
      },
      onError: (err) => {
        console.error('Subscription error:', err)
        setConnected(false)
      },
    })

    return () => unsub()
  }, [])

  async function moveTask(taskId: string, newStatus: TaskSummary['status']) {
    // Optimistic update
    const current = dashboardData.get()
    if (!current) return

    batch(() => {
      const updatedTasks = current.tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )
      dashboardData.set({ ...current, tasks: updatedTasks })
    })

    // Persist via RPC mutation (type-safe!)
    await rpc.updateTask.mutate({
      taskId,
      updates: { status: newStatus },
    })
  }

  return (
    <div>
      {/* Connection indicator */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
        <span className="text-xs text-gray-500">
          {connected ? 'Live' : 'Connecting...'}
        </span>
      </div>

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
              {grouped[status].map((task) => (
                <TaskCard key={task.id} task={task} onMove={moveTask} />
              ))}
              {grouped[status].length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8 border border-dashed border-gray-200 rounded-lg">
                  No tasks
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task, onMove }: { task: TaskSummary; onMove: (id: string, status: TaskSummary['status']) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium mb-2 text-sm">{task.title}</h3>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
      </div>
      <div className="flex gap-1">
        {task.status !== 'todo' && (
          <button
            onClick={() => onMove(task.id, task.status === 'done' ? 'in_progress' : 'todo')}
            className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            {task.status === 'done' ? 'Reopen' : 'Move to To Do'}
          </button>
        )}
        {task.status !== 'done' && (
          <button
            onClick={() => onMove(task.id, task.status === 'todo' ? 'in_progress' : 'done')}
            className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            {task.status === 'todo' ? 'Start' : 'Complete'}
          </button>
        )}
      </div>
    </div>
  )
}
```

## Understanding the RPC Flow

Here's how a task move flows through the system:

```
1. User clicks "Complete" on a task
   │
2. moveTask() fires
   ├── Optimistic: dashboardData.set(updated) → UI updates instantly
   └── rpc.updateTask.mutate({ taskId, updates })
       │
3. Server receives RPC mutation
   ├── Updates database
   ├── Logs activity
   └── emitTaskEvent({ type: 'task_updated', ... })
       │
4. All connected clients receive the event via WebSocket
   └── subscription onData callback fires
       └── dashboardData.set(updated) → all islands re-render
```

The optimistic update means the user sees the change immediately. The server mutation persists it and broadcasts to other clients. If the mutation fails, you could roll back the optimistic update (error handling left as an exercise).

## Type Safety End-to-End

One of the key benefits of `@ereo/rpc` is full type inference from server to client:

```ts
// Server: define the procedure
export const updateTaskMutation = authed.mutation(
  { parse: (data: unknown) => data as { taskId: string; updates: Record<string, unknown> } },
  async ({ input }) => {
    // input is typed as { taskId: string; updates: Record<string, unknown> }
    return { success: true }
  }
)

// Client: fully typed
await rpc.updateTask.mutate({
  taskId: 'task_001',     // ✓ type-checked
  updates: { status: 'done' }, // ✓ type-checked
})
// Return type is inferred as { success: boolean }
```

Change the server procedure's input type and the client call will show a type error — no runtime surprises.

## Try It Out

1. Open `/dashboard` in two browser tabs (or windows)
2. In Tab A, move a task from "To Do" to "In Progress"
3. Watch Tab B — the task should move to "In Progress" there too, without a page refresh
4. The green "Live" indicator confirms the WebSocket connection is active
5. Create a new task — it should appear in both tabs

## What We've Done

- Defined type-safe RPC procedures (queries, mutations, subscriptions)
- Created a real-time event system with an in-memory event emitter
- Connected the TaskBoard island to RPC for mutations and live subscriptions
- Implemented optimistic updates with server-side persistence
- Added a WebSocket connection indicator
- Achieved end-to-end type safety from database to UI

## Next Step

The app is feature-complete. In the final chapter, we'll add observability with `@ereo/trace` and deploy to production.

[← Previous: Islands & State](/tutorials/saas/05-islands) | [Continue to Chapter 7: Observability & Deployment →](/tutorials/saas/07-deploy)
