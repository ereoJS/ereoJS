/**
 * @areo/auth - Authentication plugin for Areo framework
 *
 * Provides authentication and authorization with multiple providers.
 */

import type { Plugin, RouteConfig, AppContext } from '@areo/core';

/** User session data */
export interface Session {
  /** User ID */
  userId: string;
  /** User email */
  email?: string;
  /** User name */
  name?: string;
  /** User roles */
  roles?: string[];
  /** Custom claims */
  claims?: Record<string, unknown>;
  /** Session expiration */
  expiresAt?: Date;
}

/** Authentication provider configuration */
export interface AuthProvider {
  /** Provider ID */
  id: string;
  /** Provider name */
  name: string;
  /** Authorize/authenticate user */
  authorize(credentials: Record<string, unknown>): Promise<Session | null>;
}

/** Auth plugin configuration */
export interface AuthConfig {
  /** Session secret for signing cookies/JWT */
  secret: string;
  /** Session duration in seconds (default: 7 days) */
  sessionDuration?: number;
  /** Authentication providers */
  providers?: AuthProvider[];
  /** Callbacks for customization */
  callbacks?: {
    /** Called when session is created */
    onSessionCreated?: (session: Session) => Promise<Session> | Session;
    /** Called to validate session */
    onSessionValidate?: (session: Session) => Promise<boolean> | boolean;
    /** Called when user signs out */
    onSignOut?: (session: Session) => Promise<void> | void;
  };
  /** Cookie configuration */
  cookie?: {
    name?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    domain?: string;
    path?: string;
  };
}

/** Auth context added to request context */
export interface AuthContext {
  /** Current session (if authenticated) */
  session: Session | null;
  /** Sign in with credentials */
  signIn: (provider: string, credentials: Record<string, unknown>) => Promise<Session>;
  /** Sign out current user */
  signOut: () => Promise<void>;
  /** Check if user is authenticated */
  isAuthenticated: () => boolean;
  /** Check if user has role */
  hasRole: (role: string) => boolean;
  /** Check if user has any of the roles */
  hasAnyRole: (roles: string[]) => boolean;
}

/** Create the auth plugin */
export function createAuthPlugin(config: AuthConfig): Plugin {
  const sessionDuration = config.sessionDuration || 7 * 24 * 60 * 60; // 7 days
  const cookieName = config.cookie?.name || 'areo.session';

  return {
    name: '@areo/auth',

    async setup(context) {
      // Initialize auth providers
      console.log(`[auth] Initialized with ${config.providers?.length || 0} providers`);
    },

    configureServer(server) {
      // Add auth middleware to all requests
      server.middlewares.push(async (request, ctx, next) => {
        // Extract session from cookie/JWT
        const session = await extractSession(request, config);

        // Add auth context
        const authContext: AuthContext = {
          session,
          signIn: async (providerId, credentials) => {
            const provider = config.providers?.find((p) => p.id === providerId);
            if (!provider) {
              throw new Error(`Auth provider not found: ${providerId}`);
            }

            const session = await provider.authorize(credentials);
            if (!session) {
              throw new Error('Authentication failed');
            }

            // Apply session callback
            const finalSession = config.callbacks?.onSessionCreated
              ? await config.callbacks.onSessionCreated(session)
              : session;

            // Store session in context
            authContext.session = finalSession;

            return finalSession;
          },
          signOut: async () => {
            if (authContext.session && config.callbacks?.onSignOut) {
              await config.callbacks.onSignOut(authContext.session);
            }
            authContext.session = null;
          },
          isAuthenticated: () => authContext.session !== null,
          hasRole: (role) => authContext.session?.roles?.includes(role) ?? false,
          hasAnyRole: (roles) =>
            roles.some((role) => authContext.session?.roles?.includes(role)),
        };

        // Add auth to context
        ctx.set('auth', authContext);

        return next();
      });
    },
  };
}

/**
 * Extract session from request (cookie or Authorization header).
 */
async function extractSession(
  request: Request,
  config: AuthConfig
): Promise<Session | null> {
  // Try cookie first
  const cookie = request.headers.get('cookie');
  if (cookie) {
    const sessionCookie = parseCookie(cookie, config.cookie?.name || 'areo.session');
    if (sessionCookie) {
      try {
        const session = JSON.parse(atob(sessionCookie)) as Session;

        // Validate session
        if (config.callbacks?.onSessionValidate) {
          const isValid = await config.callbacks.onSessionValidate(session);
          if (!isValid) return null;
        }

        // Check expiration
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          return null;
        }

        return session;
      } catch {
        return null;
      }
    }
  }

  // Try Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      // Simple JWT verification (in production, use proper JWT library)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload as Session;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Parse a specific cookie from cookie string.
 */
function parseCookie(cookieString: string, name: string): string | null {
  const cookies = cookieString.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Create auth middleware for route protection.
 */
export function requireAuth(options?: {
  redirect?: string;
  roles?: string[];
}): Partial<RouteConfig> {
  return {
    auth: {
      required: true,
      roles: options?.roles,
      redirect: options?.redirect,
      check: async ({ context }) => {
        const auth = context.get('auth') as AuthContext | undefined;
        if (!auth?.isAuthenticated()) {
          return false;
        }
        if (options?.roles && !auth.hasAnyRole(options.roles)) {
          return false;
        }
        return true;
      },
    },
  };
}

/**
 * Create optional auth middleware (allows anonymous but adds auth context).
 */
export function optionalAuth(): Partial<RouteConfig> {
  return {
    auth: {
      required: false,
    },
  };
}

/**
 * Helper to use auth in loaders/actions.
 */
export function useAuth(context: AppContext): AuthContext {
  return context.get('auth') as AuthContext;
}
