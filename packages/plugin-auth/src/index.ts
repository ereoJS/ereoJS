/**
 * @oreo/auth - Main exports
 */

export {
  createAuthPlugin,
  requireAuth,
  optionalAuth,
  useAuth,
} from './auth';

export type {
  Session,
  AuthProvider,
  AuthConfig,
  AuthContext,
} from './auth';

// Re-export providers
export * from './providers/index';
