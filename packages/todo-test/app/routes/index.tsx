import { todosApi } from '~/lib/api';

export async function loader() {
  const [todos, stats] = await Promise.all([
    todosApi.list(),
    todosApi.stats(),
  ]);
  return { todos, stats };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const intent = formData.get('_intent') as string;

  if (intent === 'create') {
    const title = (formData.get('title') as string || '').trim();
    if (!title) {
      return { error: 'Title is required' };
    }
    try {
      await todosApi.create(title);
    } catch (err: any) {
      return { error: err.message };
    }
    return new Response(null, { status: 303, headers: { Location: '/' } });
  }

  if (intent === 'toggle') {
    const id = Number(formData.get('id'));
    if (!id) return { error: 'Invalid todo ID' };
    try {
      await todosApi.toggle(id);
    } catch (err: any) {
      return { error: err.message };
    }
    return new Response(null, { status: 303, headers: { Location: '/' } });
  }

  if (intent === 'delete') {
    const id = Number(formData.get('id'));
    if (!id) return { error: 'Invalid todo ID' };
    try {
      await todosApi.delete(id);
    } catch (err: any) {
      return { error: err.message };
    }
    return new Response(null, { status: 303, headers: { Location: '/' } });
  }

  return { error: 'Unknown action' };
}

interface Todo {
  id: number;
  title: string;
  completed: number;
  created_at: string;
}

interface PageProps {
  loaderData: {
    todos: Todo[];
    stats: { total: number; done: number; pending: number };
  };
  actionData?: { error?: string };
}

export default function TodoPage({ loaderData, actionData }: PageProps) {
  const { todos, stats } = loaderData;

  return (
    <>
      <h1>Todo App</h1>
      <p className="subtitle">
        Powered by <strong>createServerBlock</strong> with rate limiting &amp; caching
        <span className="badge">@ereo/rpc</span>
      </p>

      {/* Stats */}
      <div className="stats">
        <div className="stat">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat">
          <div className="stat-value" style={{ color: '#22c55e' }}>{stats.done}</div>
          <div className="stat-label">Done</div>
        </div>
      </div>

      {/* Error */}
      {actionData?.error && (
        <p className="error">{actionData.error}</p>
      )}

      {/* Add Form */}
      <form method="POST" className="add-form">
        <input type="hidden" name="_intent" value="create" />
        <input
          type="text"
          name="title"
          placeholder="What needs to be done?"
          autoComplete="off"
          maxLength={200}
          required
        />
        <button type="submit" className="btn btn-primary">Add</button>
      </form>

      {/* Todo List */}
      {todos.length > 0 ? (
        <div className="todo-list">
          {todos.map((todo) => (
            <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
              <form method="POST" style={{ display: 'contents' }}>
                <input type="hidden" name="_intent" value="toggle" />
                <input type="hidden" name="id" value={todo.id} />
                <button type="submit" className={`toggle-btn ${todo.completed ? 'checked' : ''}`}>
                  {todo.completed ? '\u2713' : ''}
                </button>
              </form>

              <span className="todo-title">{todo.title}</span>

              <span className="todo-date">
                {new Date(todo.created_at + 'Z').toLocaleDateString()}
              </span>

              <form method="POST" style={{ display: 'contents' }}>
                <input type="hidden" name="_intent" value="delete" />
                <input type="hidden" name="id" value={todo.id} />
                <button type="submit" className="btn btn-danger">Delete</button>
              </form>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>No todos yet</p>
          <p>Add your first todo above to get started!</p>
        </div>
      )}
    </>
  );
}
