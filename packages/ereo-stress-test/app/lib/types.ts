/**
 * Shared types for the application.
 */

export type { User, Task, TaskStats } from '~/lib/db';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string>;
}