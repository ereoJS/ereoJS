# Your First App

Let's build a simple task list application to learn EreoJS's core features: routing, data loading, and form handling.

## Setup

Create a new project:

```bash
bunx create-ereo tasks-app
cd tasks-app
```

## Step 1: Create the Home Page

Replace `app/routes/index.tsx`:

```tsx
// app/routes/index.tsx
import { Link } from '@ereo/client'

export default function Home() {
  return (
    <div>
      <h1>Task Manager</h1>
      <p>A simple task list built with EreoJS.</p>
      <Link href="/tasks">View Tasks</Link>
    </div>
  )
}
```

## Step 2: Add a Layout

Create a layout that wraps all pages:

```tsx
// app/routes/_layout.tsx
import type { RouteComponentProps } from '@ereo/core'
import { Link } from '@ereo/client'

export default function RootLayout({ children }: RouteComponentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Task Manager</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <nav>
          <Link href="/">Home</Link>
          <Link href="/tasks">Tasks</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
```

## Step 3: Create a Tasks List Page

```tsx
// app/routes/tasks/index.tsx
import type { LoaderArgs } from '@ereo/core'
import { Link } from '@ereo/client'

// Simulated database
const tasks = [
  { id: '1', title: 'Learn EreoJS', completed: false },
  { id: '2', title: 'Build an app', completed: false },
  { id: '3', title: 'Deploy to production', completed: false },
]

export async function loader({ request }: LoaderArgs) {
  // In a real app, fetch from database
  return { tasks }
}

export default function TasksPage({ loaderData }: { loaderData: { tasks: typeof tasks } }) {
  const { tasks } = loaderData

  return (
    <div>
      <h1>Tasks</h1>
      <Link href="/tasks/new">Add Task</Link>

      <ul>
        {tasks.map(task => (
          <li key={task.id}>
            <Link href={`/tasks/${task.id}`}>
              {task.completed ? '✓ ' : '○ '}
              {task.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

## Step 4: Create a Task Detail Page

```tsx
// app/routes/tasks/[id].tsx
import type { LoaderArgs, ActionArgs } from '@ereo/core'
import { redirect } from '@ereo/data'
import { Form, Link } from '@ereo/client'

// Same simulated database
const tasks = [
  { id: '1', title: 'Learn EreoJS', completed: false },
  { id: '2', title: 'Build an app', completed: false },
  { id: '3', title: 'Deploy to production', completed: false },
]

export async function loader({ params }: LoaderArgs<{ id: string }>) {
  const task = tasks.find(t => t.id === params.id)

  if (!task) {
    throw new Response('Task not found', { status: 404 })
  }

  return { task }
}

export async function action({ request, params }: ActionArgs<{ id: string }>) {
  const formData = await request.formData()
  const intent = formData.get('intent')

  const taskIndex = tasks.findIndex(t => t.id === params.id)

  if (intent === 'toggle') {
    tasks[taskIndex].completed = !tasks[taskIndex].completed
  } else if (intent === 'delete') {
    tasks.splice(taskIndex, 1)
    return redirect('/tasks')
  }

  return { success: true }
}

export default function TaskPage({ loaderData }: { loaderData: { task: typeof tasks[0] } }) {
  const { task } = loaderData

  return (
    <div>
      <Link href="/tasks">← Back to Tasks</Link>

      <h1>{task.title}</h1>
      <p>Status: {task.completed ? 'Completed' : 'Pending'}</p>

      <Form method="post">
        <input type="hidden" name="intent" value="toggle" />
        <button type="submit">
          {task.completed ? 'Mark Incomplete' : 'Mark Complete'}
        </button>
      </Form>

      <Form method="post">
        <input type="hidden" name="intent" value="delete" />
        <button type="submit">Delete Task</button>
      </Form>
    </div>
  )
}
```

## Step 5: Create a New Task Page

```tsx
// app/routes/tasks/new.tsx
import type { ActionArgs } from '@ereo/core'
import { redirect } from '@ereo/data'
import { Form, Link, useActionData } from '@ereo/client'

const tasks = [
  { id: '1', title: 'Learn EreoJS', completed: false },
  { id: '2', title: 'Build an app', completed: false },
  { id: '3', title: 'Deploy to production', completed: false },
]

export async function action({ request }: ActionArgs) {
  const formData = await request.formData()
  const title = formData.get('title')

  if (!title || typeof title !== 'string' || title.trim() === '') {
    return { error: 'Title is required' }
  }

  const newTask = {
    id: String(tasks.length + 1),
    title: title.trim(),
    completed: false,
  }

  tasks.push(newTask)

  return redirect(`/tasks/${newTask.id}`)
}

export default function NewTaskPage() {
  const actionData = useActionData<{ error?: string }>()

  return (
    <div>
      <Link href="/tasks">← Back to Tasks</Link>

      <h1>New Task</h1>

      <Form method="post">
        <div>
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            required
          />
          {actionData?.error && (
            <p style={{ color: 'red' }}>{actionData.error}</p>
          )}
        </div>

        <button type="submit">Create Task</button>
      </Form>
    </div>
  )
}
```

## Step 6: Add Some Styles

```css
/* public/styles.css */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  line-height: 1.6;
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

nav {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

nav a {
  color: #646cff;
  text-decoration: none;
}

nav a:hover {
  text-decoration: underline;
}

h1 {
  margin-bottom: 1rem;
}

ul {
  list-style: none;
  margin: 1rem 0;
}

li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

li a {
  color: inherit;
  text-decoration: none;
}

li a:hover {
  color: #646cff;
}

form {
  margin: 1rem 0;
}

label {
  display: block;
  margin-bottom: 0.5rem;
}

input[type="text"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  background: #646cff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
}

button:hover {
  background: #535bf2;
}
```

## Step 7: Run the App

```bash
bun dev
```

Visit `http://localhost:3000` and try:
- Navigate between pages
- Create a new task
- Toggle task completion
- Delete a task

## Key Concepts Demonstrated

### File-Based Routing

Routes are defined by the file structure in `app/routes/`:

| File | URL |
|------|-----|
| `app/routes/index.tsx` | `/` |
| `app/routes/tasks/index.tsx` | `/tasks` |
| `app/routes/tasks/[id].tsx` | `/tasks/:id` |
| `app/routes/tasks/new.tsx` | `/tasks/new` |

### Data Loading

The `loader` function runs on the server before rendering:

```tsx
import type { LoaderArgs } from '@ereo/core'

export async function loader({ params }: LoaderArgs<{ id: string }>) {
  const data = await fetchData(params.id)
  return { data }
}
```

Data is available via the `loaderData` prop or `useLoaderData()` hook.

> **Alternative approaches:** This tutorial uses plain function exports for simplicity. As your app grows, you can use `createLoader` from `@ereo/data` for built-in caching and error handling, or the `defineRoute` builder for full type safety. See [Data Loading](/concepts/data-loading) for all options.

### Form Actions

The `action` function handles form submissions:

```tsx
import type { ActionArgs } from '@ereo/core'

export async function action({ request }: ActionArgs) {
  const formData = await request.formData()
  // Process the form
  return { success: true }
}
```

> **Alternative approaches:** You can also use `createAction` from `@ereo/data` for built-in validation and auto-parsed FormData, or `typedAction` for typed JSON bodies. See [Data Loading](/concepts/data-loading) for all options.

### Progressive Enhancement

Forms work without JavaScript! The `<Form>` component enhances the experience when JS is available, but the basic functionality works with standard form submissions.

### Links and Navigation

The `<Link>` component provides client-side navigation with prefetching:

```tsx
<Link href="/tasks">Tasks</Link>
<Link href="/tasks/123" prefetch="intent">Task 123</Link>
```

## Next Steps

- [Learn about routing in depth](/concepts/routing)
- [Understand data loading patterns](/concepts/data-loading)
- [Add interactivity with islands](/concepts/islands)
- [Build a complete blog app](/tutorials/blog/01-setup)
