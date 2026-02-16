import { getAuth, requireAuth } from '@ereo/auth';
import { createTask } from '~/lib/db';

export const config = { ...requireAuth({ redirect: '/login' }) };

export async function action({ request, context }: { request: Request; context: any }) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 303, headers: { Location: '/login' } });
  }
  const user = auth.getUser()!;
  const userId = Number(user.id);

  const formData = await request.formData();
  const title = (formData.get('title') as string || '').trim();
  const description = (formData.get('description') as string || '').trim();
  const priority = formData.get('priority') as string || 'medium';

  // Validate
  const errors: Record<string, string> = {};
  if (!title || title.length < 1) errors.title = 'Title is required';
  if (title.length > 200) errors.title = 'Title must be under 200 characters';
  if (!['low', 'medium', 'high'].includes(priority)) errors.priority = 'Invalid priority';

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  createTask(userId, title, description, 'todo', priority);

  return new Response(null, {
    status: 303,
    headers: { Location: '/tasks' },
  });
}

interface NewTaskPageProps {
  actionData?: {
    success: boolean;
    errors?: Record<string, string>;
  };
}

export default function NewTaskPage({ actionData }: NewTaskPageProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <a href="/tasks" className="text-sm text-gray-500 hover:text-primary-600 transition-colors">
          &larr; Back to tasks
        </a>
        <h1 className="text-3xl font-bold mt-2">New Task</h1>
      </div>

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
              placeholder="What needs to be done?"
              autoFocus
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
              placeholder="Add more details about this task..."
            />
          </div>

          <div>
            <label htmlFor="priority" className="label">Priority</label>
            <select id="priority" name="priority" className="input" defaultValue="medium">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            {actionData?.errors?.priority && (
              <p className="mt-1 text-sm text-red-600">{actionData.errors.priority}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="btn btn-primary"
            >
              Create Task
            </button>
            <a href="/tasks" className="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
}