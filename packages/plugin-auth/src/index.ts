/**
 * @ereo/auth - Authentication plugin for Ereo framework
 *
 * Provides complete authentication and authorization with:
 * - Multiple auth providers (credentials, OAuth)
 * - JWT-based session management
 * - Cookie-based session management
 * - Role-based access control (RBAC)
 * - Protected routes middleware
 */

// Main plugin and utilities
export {
  createAuthPlugin,
  requireAuth,
  optionalAuth,
  requireRoles,
  useAuth,
  getSession,
  getUser,
  withAuth,
  getOAuthUrl,
  handleOAuthCallback,
} from './auth';

// Type exports
export type {
  User,
  Session,
  JWTPayload,
  AuthProvider,
  SessionStrategy,
  SessionConfig,
  AuthConfig,
  AuthContext,
} from './auth';

// Provider exports
export {
  credentials,
  github,
  google,
  discord,
  oauth,
  mock,
  apiKey,
} from './providers/index';

// Provider type exports
export type {
  CredentialsConfig,
  OAuthConfig,
  GitHubConfig,
  GoogleConfig,
  DiscordConfig,
  GenericOAuthConfig,
  OAuthTokens,
  MockConfig,
  ApiKeyConfig,
} from './providers/index';
