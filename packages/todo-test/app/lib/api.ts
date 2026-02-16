/**
 * Todo API — powered by createServerBlock
 *
 * Demonstrates declarative rate limiting, caching, and grouped
 * server functions with per-function overrides.
 */
import { createServerBlock } from '@ereo/rpc';
import {
  getAllTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  getTodoStats,
} from './db';

export const todosApi = createServerBlock(
  {
    // Shared config: rate limit all operations to 60 req/min
    rateLimit: { max: 60, window: '1m' },
  },
  {
    /** List all todos — cached for 5s */
    list: {
      handler: async () => getAllTodos(),
      cache: { maxAge: 5 },
    },

    /** Get stats — cached for 5s */
    stats: {
      handler: async () => getTodoStats(),
      cache: { maxAge: 5 },
    },

    /** Create a new todo */
    create: async (title: string) => {
      if (!title || !title.trim()) {
        throw new Error('Title is required');
      }
      if (title.length > 200) {
        throw new Error('Title must be under 200 characters');
      }
      return addTodo(title.trim());
    },

    /** Toggle a todo's completed status */
    toggle: async (id: number) => {
      const todo = toggleTodo(id);
      if (!todo) throw new Error('Todo not found');
      return todo;
    },

    /** Delete a todo — stricter rate limit (10 req/min) */
    delete: {
      handler: async (id: number) => {
        const ok = deleteTodo(id);
        if (!ok) throw new Error('Todo not found');
        return { deleted: true };
      },
      rateLimit: { max: 10, window: '1m' },
    },
  }
);
