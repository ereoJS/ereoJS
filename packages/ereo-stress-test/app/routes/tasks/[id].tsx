import { getAuth, requireAuth } from '@ereo/auth';
import { getTaskById, updateTask, deleteTask } from '~/lib/db';

export const config = { ...requireAuth({ redirect: '/login' }) };

export async function loader({ params, context }: { params: { id: string }; context: any }) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  const user = auth.getUser()!;
  const userId = Number(user.id);

  const task = getTaskById(Number(params.id), userId);

  if (!task) {
    throw new Response('Task not found', { status: 404 });
  }

  return { task };
}

export async function action({ request, params, context }: { request: Request; params: { id: string }; context: any }) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 303, headers: { Location: '/login' } });
  }
  const user = auth.getUser()!;
  const userId = Number(user.id);
  const taskId = Number(params.id);

  const formData = await request.formData();
  const intent = formData.get('_intent') as string;

  // Handle delete
  if (intent === 'delete') {
    deleteTask(taskId, userId);
    return new Response(null, {
      status: 303,
      headers: { Location: '/tasks' },
    });
  }

  // Handle status quick-toggle
  if (intent === 'toggle-status') {
    const task = getTaskById(taskId, userId);
    if (!task) throw new Response('Task not found', { status: 404 });

    const nextStatus: Record<string, string> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
    };

    updateTask(taskId, userId, task.title, task.description, nextStatus[task.status] || 'todo', task.priority);
    return new Response(null, {
      status: 303,
      headers: { Location: `/tasks/${taskId}` },
    });
  }

  // Handle update
  const title = (formData.get('title') as string || '').trim();
  const description = (formData.get('description') as string || '').trim();
  const status = formData.get('status') as string || 'todo';
  const priority = formData.get('priority') as string || 'medium';

  const errors: Record<string, string> = {};
  if (!title || title.length < 1) errors.title = 'Title is required';
  if (title.length > 200) errors.title = 'Title must be under 200 characters';
  if (!['todo', 'in_progress', 'done'].includes(status)) errors.status = 'Invalid status';
  if (!['low', 'medium', 'high'].includes(priority)) errors.priority = 'Invalid priority';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  const updated = updateTask(taskId, userId, title, description, status, priority);

  if (!updated) {
    return { success: false, errors: { form: 'Task not found' } };
  }

  return new Response(null, {
    status: 303,
    headers: { Location: '/tasks' },
  });
}

interface TaskDetailProps {
  loaderData: {
    task: {
      id: number;
      title: string;
      description: string;
      status: 'todo' | 'in_progress' | 'done';
      priority: 'low' | 'medium' | 'high';
      created_at: string;
      updated_at: string;
    };
  };
  actionData?: {
    success: boolean;
    message?: string;
    errors?: Record<string, string>;
  };
}

export default function TaskDetailPage({ loaderData, actionData }: TaskDetailProps) {
  const { task } = loaderData;

  const statusLabels: Record<string, string> = {
    todo: 'To Do',
    in_progress: 'In Progress',
    done: 'Done',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <a href="/tasks" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
            &larr; Back to tasks
          </a>
          <h1 className="text-3xl font-bold mt-2">Edit Task</h1>
        </div>

        {/* Quick status toggle */}
        <form method="POST">
          <input type="hidden" name="_intent" value="toggle-status" />
          <button type="submit" className="btn btn-secondary btn-sm">
            Move to {statusLabels[task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo']}
          </button>
        </form>
      </div>

      {actionData?.errors?.form && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-300">{actionData.errors.form}</p>
        </div>
      )}

      <div className="card">
        <form method="POST" className="space-y-5">
          <div>
            <label htmlFor="title" className="label">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              required
              maxLength={200}
              className="input"
              defaultValue={task.title}
            />
            {actionData?.errors?.title && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className="input"
              defaultValue={task.description}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="label">Status</label>
              <select id="status" name="status" className="input" defaultValue={task.status}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="label">Priority</label>
              <select id="priority" name="priority" className="input" defaultValue={task.priority}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500">
            Created {new Date(task.created_at).toLocaleString()}
            {task.updated_at !== task.created_at && (
              <> &bull; Updated {new Date(task.updated_at).toLocaleString()}</>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="btn btn-primary"
            >
              Save Changes
            </button>
            <a href="/tasks" className="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>

      {/* Delete section - pure form, no client JS needed */}
      <div className="mt-6 card border-red-200 dark:border-red-800">
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Permanently delete this task. This action cannot be undone.
        </p>
        <form method="POST">
          <input type="hidden" name="_intent" value="delete" />
          <button type="submit" className="btn btn-danger btn-sm">
            Delete Task
          </button>
        </form>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">Task Not Found</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        This task doesn't exist or you don't have access to it.
      </p>
      <a href="/tasks" className="btn btn-primary">
        Back to Tasks
      </a>
    </div>
  );
}