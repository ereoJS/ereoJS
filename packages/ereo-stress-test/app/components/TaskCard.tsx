interface TaskCardProps {
  task: {
    id: number;
    title: string;
    description: string;
    status: 'todo' | 'in_progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    created_at: string;
    updated_at: string;
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  todo: { label: 'To Do', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  done: { label: 'Done', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
};

const priorityConfig: Record<string, { label: string; color: string; icon: string }> = {
  high: { label: 'High', color: 'text-red-600 dark:text-red-400', icon: '!!!' },
  medium: { label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', icon: '!!' },
  low: { label: 'Low', color: 'text-gray-400 dark:text-gray-500', icon: '!' },
};

export function TaskCard({ task }: TaskCardProps) {
  const status = statusConfig[task.status] || statusConfig.todo;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;

  return (
    <a
      href={`/tasks/${task.id}`}
      className="card hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 transition-all group block"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`badge ${status.color}`}>{status.label}</span>
            <span className={`text-xs font-mono font-bold ${priority.color}`}>
              {priority.icon}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
            {task.title}
          </h3>
          {task.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
        <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
        <span>Created {new Date(task.created_at).toLocaleDateString()}</span>
        {task.updated_at !== task.created_at && (
          <span>Updated {new Date(task.updated_at).toLocaleDateString()}</span>
        )}
      </div>
    </a>
  );
}