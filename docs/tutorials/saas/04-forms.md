# SaaS Tutorial: Forms

Creating and editing tasks is the core interaction in TaskFlow. In this chapter, you'll use `@ereo/forms` to build a rich task form with client-side validation, assignee selection, due dates, and subtask management with `useFieldArray`. You'll also wire up server actions to persist the data.

## Understanding the Two Form Approaches

Ereo has two ways to handle forms:

| Approach | When to Use |
|----------|-------------|
| `<Form>` from `@ereo/client` | Simple forms (login, search, settings). Server action handles everything. |
| `useForm` from `@ereo/forms` | Complex forms (validation, arrays, dependent fields, multi-step). Client-side control. |

We used `@ereo/client`'s `Form` for login and registration. Now we'll use `@ereo/forms` for task management because we need per-field validation, a dynamic subtask list, and responsive error feedback without round-trips.

## Task Creation Form

Create the task creation route. This is an island — the form needs client-side interactivity for validation and field arrays.

First, build the form island:

```tsx
// app/components/TaskForm.tsx
'use client'
import { useForm, useField, useFieldArray, useFormStatus } from '@ereo/forms'
import { required, minLength, maxLength, oneOf } from '@ereo/forms'

interface TaskFormProps {
  projectId: string
  members: Array<{ userId: string; name: string }>
  onSuccess?: () => void
}

const STATUSES = ['todo', 'in_progress', 'done'] as const
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export default function TaskForm({ projectId, members, onSuccess }: TaskFormProps) {
  const form = useForm({
    defaultValues: {
      title: '',
      description: '',
      status: 'todo' as string,
      priority: 'medium' as string,
      assigneeId: '' as string,
      dueDate: '' as string,
      subtasks: [] as Array<{ title: string }>,
    },
    validators: {
      title: [required('Title is required'), minLength(3, 'Title must be at least 3 characters'), maxLength(100)],
      status: [oneOf([...STATUSES], 'Pick a valid status')],
      priority: [oneOf([...PRIORITIES], 'Pick a valid priority')],
    },
    onSubmit: async (values) => {
      const response = await fetch(`/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, projectId }),
      })
      const result = await response.json()
      if (!result.success) {
        return { success: false, errors: result.errors }
      }
      onSuccess?.()
      return { success: true }
    },
  })

  const title = useField(form, 'title')
  const description = useField(form, 'description')
  const status = useField(form, 'status')
  const priority = useField(form, 'priority')
  const assigneeId = useField(form, 'assigneeId')
  const dueDate = useField(form, 'dueDate')
  const subtasks = useFieldArray(form, 'subtasks')
  const { isSubmitting } = useFormStatus(form)

  return (
    <form onSubmit={form.handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="title"
          type="text"
          {...title.inputProps}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="What needs to be done?"
        />
        {title.error && <p className="text-sm text-red-600 mt-1">{title.error}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          {...description.inputProps}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Add details..."
        />
      </div>

      {/* Status + Priority row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            {...status.inputProps}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <select
            id="priority"
            {...priority.inputProps}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* Assignee + Due Date row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="assigneeId" className="block text-sm font-medium text-gray-700 mb-1">
            Assignee
          </label>
          <select
            id="assigneeId"
            {...assigneeId.inputProps}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
            Due date
          </label>
          <input
            id="dueDate"
            type="date"
            {...dueDate.inputProps}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Subtasks (field array) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">Subtasks</label>
          <button
            type="button"
            onClick={() => subtasks.append({ title: '' })}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Add subtask
          </button>
        </div>
        {subtasks.fields.length === 0 && (
          <p className="text-sm text-gray-400">No subtasks yet.</p>
        )}
        <div className="space-y-2">
          {subtasks.fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <SubtaskInput form={form} index={index} />
              <button
                type="button"
                onClick={() => subtasks.remove(index)}
                className="px-2 text-gray-400 hover:text-red-500"
                aria-label="Remove subtask"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </form>
  )
}

function SubtaskInput({ form, index }: { form: any; index: number }) {
  const field = useField(form, `subtasks.${index}.title`)
  return (
    <input
      type="text"
      {...field.inputProps}
      placeholder={`Subtask ${index + 1}`}
      className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  )
}
```

## Task API Route

Create the API endpoint that the form submits to:

```ts
// app/routes/api/tasks.ts
import { createAction, json } from '@ereo/data'
import { createTask, logActivity } from '~/lib/queries'
import { getUser } from '@ereo/auth'
import { db } from '~/lib/db'
import { teamMembers } from '~/lib/schema'
import { eq } from 'drizzle-orm'

export const action = createAction(async ({ request, context }) => {
  if (request.method !== 'POST') {
    return json({ success: false, errors: { _form: ['Method not allowed'] } }, { status: 405 })
  }

  const user = getUser(context)
  if (!user) return json({ success: false, errors: { _form: ['Unauthorized'] } }, { status: 401 })

  const body = await request.json()
  const { projectId, title, description, status, priority, assigneeId, dueDate, subtasks } = body

  // Server-side validation
  const errors: Record<string, string[]> = {}
  if (!title || title.length < 3) errors.title = ['Title must be at least 3 characters.']
  if (!projectId) errors.projectId = ['Project is required.']

  if (Object.keys(errors).length > 0) {
    return json({ success: false, errors })
  }

  const membership = db.select().from(teamMembers).where(eq(teamMembers.userId, user.id)).get()!

  const taskId = createTask({
    projectId,
    title,
    description: description || undefined,
    status: status || 'todo',
    priority: priority || 'medium',
    assigneeId: assigneeId || undefined,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    createdById: user.id,
  })

  logActivity({
    teamId: membership.teamId,
    userId: user.id,
    action: 'created',
    targetType: 'task',
    targetId: taskId,
    metadata: { title, projectId },
  })

  return json({ success: true, taskId })
})
```

## New Task Route

Wire the island into a route:

```tsx
// app/routes/dashboard/projects/[id]/tasks/new.tsx
import { createLoader } from '@ereo/data'
import { Link } from '@ereo/client'
import { getProject, getTeamMembers } from '~/lib/queries'
import { getUser } from '@ereo/auth'
import { db } from '~/lib/db'
import { teamMembers } from '~/lib/schema'
import { eq } from 'drizzle-orm'
import type { RouteComponentProps } from '@ereo/core'

export const loader = createLoader(async ({ params, context }) => {
  const user = getUser(context)!
  const membership = db.select().from(teamMembers).where(eq(teamMembers.userId, user.id)).get()!
  const project = getProject(params.id, membership.teamId)
  if (!project) throw new Response('Not found', { status: 404 })

  const members = getTeamMembers(membership.teamId)
  return { project, members }
})

export default function NewTask({ loaderData }: RouteComponentProps) {
  const { project, members } = loaderData

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={`/dashboard/projects/${project.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to {project.name}
        </Link>
        <h1 className="text-2xl font-bold mt-2">New Task</h1>
      </div>

      <div
        data-island="TaskForm"
        data-hydrate="load"
        data-props={JSON.stringify({ projectId: project.id, members })}
      >
        {/* SSR fallback — a basic form without client-side validation */}
        <p className="text-gray-500">Loading form...</p>
      </div>
    </div>
  )
}
```

## Task Edit Form

Reuse the same form island for editing. The pattern is: load existing data in the route loader, pass it as `defaultValues` to the form.

```tsx
// app/components/TaskEditForm.tsx
'use client'
import { useForm, useField, useFormStatus } from '@ereo/forms'
import { required, minLength, maxLength, oneOf } from '@ereo/forms'

interface TaskEditFormProps {
  taskId: string
  projectId: string
  members: Array<{ userId: string; name: string }>
  defaultValues: {
    title: string
    description: string
    status: string
    priority: string
    assigneeId: string
    dueDate: string
  }
}

export default function TaskEditForm({ taskId, projectId, members, defaultValues }: TaskEditFormProps) {
  const form = useForm({
    defaultValues,
    validators: {
      title: [required('Title is required'), minLength(3), maxLength(100)],
      status: [oneOf(['todo', 'in_progress', 'done'])],
      priority: [oneOf(['low', 'medium', 'high', 'urgent'])],
    },
    onSubmit: async (values) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const result = await response.json()
      if (!result.success) return { success: false, errors: result.errors }
      return { success: true }
    },
  })

  const title = useField(form, 'title')
  const description = useField(form, 'description')
  const status = useField(form, 'status')
  const priority = useField(form, 'priority')
  const assigneeId = useField(form, 'assigneeId')
  const dueDate = useField(form, 'dueDate')
  const { isSubmitting } = useFormStatus(form)

  return (
    <form onSubmit={form.handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          id="title"
          type="text"
          {...title.inputProps}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {title.error && <p className="text-sm text-red-600 mt-1">{title.error}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          id="description"
          {...description.inputProps}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select id="status" {...status.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <select id="priority" {...priority.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="assigneeId" className="block text-sm font-medium text-gray-700 mb-1">Assignee</label>
          <select id="assigneeId" {...assigneeId.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">Due date</label>
          <input id="dueDate" type="date" {...dueDate.inputProps} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  )
}
```

## Understanding useForm vs useField

Here's how the form architecture works:

```
useForm(config)
  │
  ├── Creates FormStore (per-field signals)
  │     ├── title signal   → useField(form, 'title')    → { inputProps, error, touched }
  │     ├── status signal  → useField(form, 'status')   → { inputProps, error, touched }
  │     └── subtasks signal→ useFieldArray(form, 'subtasks') → { fields, append, remove }
  │
  ├── Validation engine
  │     ├── Sync validators run on blur/change
  │     ├── Async validators run after sync passes (with debounce)
  │     └── focusOnError: auto-focuses first invalid field on submit
  │
  └── handleSubmit
        ├── Runs all validators
        ├── If valid → calls onSubmit(values)
        └── If invalid → shows errors, focuses first error field
```

Key points:
- Each field has its own signal — changing one field doesn't re-render the entire form
- `useField()` returns `inputProps` that you spread onto native inputs (no wrapper components needed)
- `useFieldArray()` provides `append()`, `remove()`, `move()`, and `swap()` for dynamic lists
- Validation rules run automatically — `required()` triggers on blur, `async()` triggers on change with debounce

## Try It Out

1. Navigate to a project and click "Add Task"
2. Try submitting with an empty title — you should see the validation error without a server round-trip
3. Fill in the form and add a couple of subtasks using the "+ Add subtask" button
4. Remove a subtask with the &times; button
5. Submit — the task should be created and you'll see it in the project detail page

## What We've Done

- Built a rich task form with `useForm`, `useField`, and `useFieldArray`
- Added client-side validation with built-in validators (`required`, `minLength`, `maxLength`, `oneOf`)
- Created form islands that hydrate on the client for interactive validation
- Built both create and edit form variants that share the same patterns
- Set up a JSON API endpoint with server-side validation as a backstop

## Next Step

The forms work, but the task board is static — you have to reload the page to see changes. In the next chapter, we'll build interactive islands with `@ereo/state` signals for a live-updating dashboard.

[← Previous: Database](/tutorials/saas/03-database) | [Continue to Chapter 5: Islands & State →](/tutorials/saas/05-islands)
