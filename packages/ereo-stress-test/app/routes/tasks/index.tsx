import { getAuth, requireAuth } from '@ereo/auth';
import { getTasksByUser, getTaskStats } from '~/lib/db';
import { TaskCard } from '~/components/TaskCard';

export const config = { ...requireAuth({ redirect: '/login' }) };

export async function loader({ request, context }: { request: Request; context: any }) {
  const auth = getAuth(context);
  if (!auth.isAuthenticated()) {
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  }
  const user = auth.getUser()!;
  const userId = Number(user.id);

  // Read filter from URL search params
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';

  const tasks = getTasksByUser(userId, status);
  const stats = getTaskStats(userId);

  return { tasks, stats, currentFilter: status };
}

interface TasksPageProps {
  loaderData: {
    tasks: Array<{
      id: number;
      title: string;
      description: string;
      status: 'todo' | 'in_progress' | 'done';
      priority: 'low' | 'medium' | 'high';
      created_at: string;
      updated_at: string;
    }>;
    stats: { todo: number; in_progress: number; done: number; total: number };
    currentFilter: string;
  };
}

export default function TasksPage({ loaderData }: TasksPageProps) {
  const { tasks, stats, currentFilter } = loaderData;

  const filters = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'todo', label: 'To Do', count: stats.todo },
    { value: 'in_progress', label: 'In Progress', count: stats.in_progress },
    { value: 'done', label: 'Done', count: stats.done },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {stats.total === 0
              ? 'No tasks yet. Create your first one!'
              : `${stats.total} task${stats.total === 1 ? '' : 's'} total, ${stats.done} completed`}
          </p>
        </div>
        <a href="/tasks/new" className="btn btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </a>
      </div>

      {/* Stats Cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
            <div className="text-3xl font-bold mt-1">{stats.total}</div>
          </div>
          <div className="card py-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">To Do</div>
            <div className="text-3xl font-bold mt-1 text-gray-600 dark:text-gray-300">{stats.todo}</div>
          </div>
          <div className="card py-4">
            <div className="text-sm text-blue-500">In Progress</div>
            <div className="text-3xl font-bold mt-1 text-blue-600 dark:text-blue-400">{stats.in_progress}</div>
          </div>
          <div className="card py-4">
            <div className="text-sm text-green-500">Done</div>
            <div className="text-3xl font-bold mt-1 text-green-600 dark:text-green-400">{stats.done}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {stats.total > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {filters.map((filter) => (
            <a
              key={filter.value}
              href={`/tasks${filter.value === 'all' ? '' : `?status=${filter.value}`}`}
              className={`btn btn-sm whitespace-nowrap ${
                currentFilter === filter.value
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
            >
              {filter.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                currentFilter === filter.value
                  ? 'bg-white/20'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                {filter.count}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Task List */}
      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      ) : stats.total > 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No tasks match the current filter.</p>
          <a href="/tasks" className="btn btn-secondary btn-sm">Clear filter</a>
        </div>
      ) : (
        <div className="card text-center py-16">
          <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h2 className="text-xl font-semibold mb-2">No tasks yet</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Create your first task to get started.</p>
          <a href="/tasks/new" className="btn btn-primary">
            Create your first task
          </a>
        </div>
      )}
    </div>
  );
}