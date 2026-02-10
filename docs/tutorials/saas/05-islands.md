# SaaS Tutorial: Islands & State

The dashboard currently renders server-side and is completely static. In this chapter, you'll build interactive islands that use `@ereo/state` signals to create a live-updating dashboard — statistics cards that animate, an activity feed, and a task board where status changes happen instantly without full page reloads.

## Understanding Islands in TaskFlow

Islands are self-contained interactive components that hydrate on the client while the rest of the page stays as server-rendered HTML. This gives us the best of both worlds:

- **Fast initial load**: The full page HTML is server-rendered
- **Selective interactivity**: Only the widgets that need JavaScript get hydrated
- **Shared state**: Signals let islands communicate without prop-drilling

Here's what we'll build:

```
┌──────────────────────────────────────────────┐
│  Dashboard (server-rendered)                  │
│  ┌─────────────┐ ┌─────────────┐             │
│  │ StatsCards   │ │ StatsCards  │  ← Island   │
│  │ (island)    │ │ (island)    │              │
│  └─────────────┘ └─────────────┘             │
│  ┌──────────────────┐ ┌──────────────────┐   │
│  │  TaskBoard        │ │  ActivityFeed    │   │
│  │  (island)         │ │  (island)        │   │
│  │  ← drag status    │ │  ← live updates  │   │
│  └──────────────────┘ └──────────────────┘   │
└──────────────────────────────────────────────┘
```

## Shared State with Signals

Create a shared state module that all dashboard islands can import. This is where signals shine — multiple islands can subscribe to the same signal and stay in sync.

```ts
// app/lib/dashboard-state.ts
import { signal, computed } from '@ereo/state'

export interface TaskSummary {
  id: string
  title: string
  status: 'todo' | 'in_progress' | 'done'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigneeName?: string
}

export interface DashboardData {
  stats: {
    projects: number
    members: number
    tasks: { todo: number; in_progress: number; done: number; total: number }
  }
  tasks: TaskSummary[]
  recentActivity: Array<{
    id: string
    action: string
    targetType: string
    userName: string
    createdAt: string
  }>
}

// Signals that islands share
export const dashboardData = signal<DashboardData | null>(null)

// Derived computations
export const tasksByStatus = computed(
  (data) => {
    if (!data) return { todo: [], in_progress: [], done: [] }
    return {
      todo: data.tasks.filter((t) => t.status === 'todo'),
      in_progress: data.tasks.filter((t) => t.status === 'in_progress'),
      done: data.tasks.filter((t) => t.status === 'done'),
    }
  },
  [dashboardData]
)

export const completionRate = computed(
  (data) => {
    if (!data || data.stats.tasks.total === 0) return 0
    return Math.round((data.stats.tasks.done / data.stats.tasks.total) * 100)
  },
  [dashboardData]
)
```

## Dashboard Stats Island

Build the statistics cards. They read from the shared signal and animate when values change:

```tsx
// app/components/DashboardStats.tsx
'use client'
import { useSignal } from '@ereo/state'
import { dashboardData, completionRate } from '~/lib/dashboard-state'
import type { DashboardData } from '~/lib/dashboard-state'

interface DashboardStatsProps {
  initialData: DashboardData
}

export default function DashboardStats({ initialData }: DashboardStatsProps) {
  // Initialize the shared signal if this is the first island to render
  if (!dashboardData.get()) {
    dashboardData.set(initialData)
  }

  const data = useSignal(dashboardData)
  const completion = useSignal(completionRate)

  if (!data) return null
  const { stats } = data

  const cards = [
    { label: 'Projects', value: stats.projects, color: 'bg-blue-500' },
    { label: 'Total Tasks', value: stats.tasks.total, color: 'bg-purple-500' },
    { label: 'In Progress', value: stats.tasks.in_progress, color: 'bg-yellow-500' },
    { label: 'Completed', value: `${completion}%`, color: 'bg-green-500' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-8 rounded-full ${card.color}`} />
            <div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-sm text-gray-500">{card.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

## Activity Feed Island

The activity feed subscribes to the same signal and renders recent events. In the next chapter, we'll make this update in real time via RPC subscriptions:

```tsx
// app/components/ActivityFeed.tsx
'use client'
import { useSignal } from '@ereo/state'
import { dashboardData } from '~/lib/dashboard-state'
import type { DashboardData } from '~/lib/dashboard-state'

interface ActivityFeedProps {
  initialData: DashboardData
}

const ACTION_VERBS: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  completed: 'completed',
  assigned: 'assigned',
}

export default function ActivityFeed({ initialData }: ActivityFeedProps) {
  if (!dashboardData.get()) {
    dashboardData.set(initialData)
  }

  const data = useSignal(dashboardData)
  if (!data) return null

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold">Recent Activity</h3>
      </div>
      <div className="divide-y divide-gray-100">
        {data.recentActivity.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-400">No activity yet.</p>
        ) : (
          data.recentActivity.slice(0, 10).map((event) => (
            <div key={event.id} className="px-5 py-3 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                {event.userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{event.userName}</span>{' '}
                  {ACTION_VERBS[event.action] || event.action}{' '}
                  a {event.targetType}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatRelativeTime(event.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}
```

## Task Board Island

The task board renders tasks in columns and allows changing status via buttons. When a status changes, the signal updates and all islands re-render:

```tsx
// app/components/TaskBoard.tsx
'use client'
import { useSignal, batch } from '@ereo/state'
import { dashboardData, tasksByStatus } from '~/lib/dashboard-state'
import type { DashboardData, TaskSummary } from '~/lib/dashboard-state'

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

  async function moveTask(taskId: string, newStatus: TaskSummary['status']) {
    // Optimistic update: change the signal immediately
    const current = dashboardData.get()
    if (!current) return

    batch(() => {
      const updatedTasks = current.tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      )

      const statusDelta = { todo: 0, in_progress: 0, done: 0 }
      const oldTask = current.tasks.find((t) => t.id === taskId)
      if (oldTask) {
        statusDelta[oldTask.status] = -1
        statusDelta[newStatus] = 1
      }

      dashboardData.set({
        ...current,
        tasks: updatedTasks,
        stats: {
          ...current.stats,
          tasks: {
            ...current.stats.tasks,
            todo: current.stats.tasks.todo + statusDelta.todo,
            in_progress: current.stats.tasks.in_progress + statusDelta.in_progress,
            done: current.stats.tasks.done + statusDelta.done,
          },
        },
      })
    })

    // Persist to server
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  return (
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
  )
}

function TaskCard({ task, onMove }: { task: TaskSummary; onMove: (id: string, status: TaskSummary['status']) => void }) {
  const nextStatuses: Record<string, TaskSummary['status'][]> = {
    todo: ['in_progress'],
    in_progress: ['todo', 'done'],
    done: ['in_progress'],
  }

  const statusArrow: Record<string, string> = {
    todo: 'Start',
    in_progress: 'Complete',
    done: 'Reopen',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-medium mb-2 text-sm">{task.title}</h3>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
        {task.assigneeName && (
          <span className="text-xs text-gray-500">{task.assigneeName}</span>
        )}
      </div>
      <div className="flex gap-1">
        {nextStatuses[task.status]?.map((next) => (
          <button
            key={next}
            onClick={() => onMove(task.id, next)}
            className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
          >
            {next === 'done' ? 'Complete' : next === 'in_progress' ? 'Start' : 'Move to To Do'}
          </button>
        ))}
      </div>
    </div>
  )
}
```

## Dashboard Route

Wire the islands into the dashboard page:

```tsx
// app/routes/dashboard/index.tsx
import { createLoader } from '@ereo/data'
import { Link } from '@ereo/client'
import { getDashboardStats, getTasksForProject, getRecentActivity, getProjectsForTeam } from '~/lib/queries'
import { getUser } from '@ereo/auth'
import { db } from '~/lib/db'
import { teamMembers, tasks } from '~/lib/schema'
import { eq } from 'drizzle-orm'
import type { RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ context }) => {
  const user = getUser(context)!
  const membership = db.select().from(teamMembers).where(eq(teamMembers.userId, user.id)).get()!
  const teamId = membership.teamId

  const stats = getDashboardStats(teamId)
  const projects = getProjectsForTeam(teamId)
  const recentActivity = getRecentActivity(teamId, 10)

  // Load tasks from the first project for the board (or all tasks)
  const allTasks = db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
    })
    .from(tasks)
    .innerJoin(
      (await import('~/lib/schema')).projects,
      eq((await import('~/lib/schema')).projects.id, tasks.projectId)
    )
    .where(eq((await import('~/lib/schema')).projects.teamId, teamId))
    .all()

  const dashboardData = {
    stats,
    tasks: allTasks,
    recentActivity: recentActivity.map((a) => ({
      ...a,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    })),
  }

  return { dashboardData, projects }
})

export default function Dashboard({ loaderData }: RouteComponentProps) {
  const { dashboardData, projects } = loaderData
  const propsJson = JSON.stringify({ initialData: dashboardData })

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Stats cards island */}
      <div data-island="DashboardStats" data-hydrate="load" data-props={propsJson}>
        {/* SSR fallback */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-5">
            <p className="text-2xl font-bold">{dashboardData.stats.projects}</p>
            <p className="text-sm text-gray-500">Projects</p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-2xl font-bold">{dashboardData.stats.tasks.total}</p>
            <p className="text-sm text-gray-500">Total Tasks</p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-2xl font-bold">{dashboardData.stats.tasks.in_progress}</p>
            <p className="text-sm text-gray-500">In Progress</p>
          </div>
          <div className="bg-white rounded-lg border p-5">
            <p className="text-2xl font-bold">
              {dashboardData.stats.tasks.total > 0
                ? Math.round((dashboardData.stats.tasks.done / dashboardData.stats.tasks.total) * 100)
                : 0}%
            </p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
        </div>
      </div>

      {/* Task board + Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-semibold mb-4">Task Board</h2>
          <div
            data-island="TaskBoard"
            data-hydrate="load"
            data-props={JSON.stringify({ projectId: 'all', initialData: dashboardData })}
          >
            <p className="text-gray-500">Loading task board...</p>
          </div>
        </div>
        <div>
          <div
            data-island="ActivityFeed"
            data-hydrate="load"
            data-props={propsJson}
          >
            <p className="text-gray-500">Loading activity...</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

## How Signals Connect the Islands

The key insight is that all three islands share the same `dashboardData` signal:

```
dashboardData (signal)
  │
  ├── DashboardStats reads stats → re-renders cards
  ├── TaskBoard reads tasks → re-renders columns
  └── ActivityFeed reads activity → re-renders feed

When TaskBoard calls moveTask():
  1. dashboardData.set(newData)  ← batch update
  2. DashboardStats re-renders   ← completion % changes
  3. TaskBoard re-renders         ← task moves column
  4. ActivityFeed stays same      ← no activity change yet
```

Because `computed` signals derive from `dashboardData`, updating the parent signal cascades to all consumers. The `batch()` call ensures all signal updates happen atomically, preventing intermediate renders.

## Try It Out

1. Navigate to `/dashboard`
2. The stats cards should show your project and task counts
3. Click "Start" on a to-do task — it moves to "In Progress" instantly
4. The stats card updates: "In Progress" count increases
5. Click "Complete" — the task moves to "Done" and the completion percentage updates

## What We've Done

- Created a shared state module with `@ereo/state` signals
- Built three interactive islands: DashboardStats, TaskBoard, ActivityFeed
- Used `computed` signals for derived data (completion rate, tasks by status)
- Implemented optimistic updates with `batch()` for instant UI feedback
- Server-rendered the dashboard with SSR fallbacks inside island markers
- All islands share state — changing a task status in TaskBoard updates DashboardStats automatically

## Next Step

The dashboard is interactive, but changes only appear for the current user. In the next chapter, we'll add RPC procedures and WebSocket subscriptions so that task changes broadcast to all connected team members in real time.

[← Previous: Forms](/tutorials/saas/04-forms) | [Continue to Chapter 6: RPC & Real-time →](/tutorials/saas/06-rpc-realtime)
