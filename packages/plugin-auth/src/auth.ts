/**
 * @ereo/auth - Authentication plugin for EreoJS framework
 *
 * Provides authentication and authorization with multiple providers,
 * JWT-based sessions, and role-based access control.
 */

import type { Plugin, RouteConfig, AppContext, MiddlewareHandler, NextFunction } from '@ereo/core';

// ============================================================================
// Type Definitions
// ============================================================================

/** User data returned from auth providers */
export interface User {
  /** User ID */
  id: string;
  /** User email */
  email?: string;
  /** User name */
  name?: string;
  /** User roles for RBAC */
  roles?: string[];
  /** Custom user data */
  [key: string]: unknown;
}

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
  /** Session ID for in-memory tracking */
  sessionId?: string;
  /** Issued at timestamp */
  issuedAt?: Date;
  /** Provider used for authentication */
  provider?: string;
}

/** JWT payload structure */
export interface JWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** Issued at (Unix timestamp) */
  iat: number;
  /** Expiration (Unix timestamp) */
  exp: number;
  /** Session ID */
  sid?: string;
  /** Custom claims */
  [key: string]: unknown;
}

/** Authentication provider configuration */
export interface AuthProvider {
  /** Provider ID */
  id: string;
  /** Provider name */
  name: string;
  /** Provider type */
  type: 'credentials' | 'oauth';
  /** Authorize/authenticate user */
  authorize(credentials: Record<string, unknown>): Promise<User | null>;
  /** Get OAuth authorization URL (for OAuth providers) */
  getAuthorizationUrl?(state: string, redirectUri: string): string;
  /** Handle OAuth callback (for OAuth providers) */
  handleCallback?(params: { code: string; state: string; redirectUri: string }): Promise<User | null>;
}

/** Session strategy type */
export type SessionStrategy = 'jwt' | 'cookie' | 'hybrid';

/** Session configuration */
export interface SessionConfig {
  /** Session strategy: 'jwt', 'cookie', or 'hybrid' */
  strategy?: SessionStrategy;
  /** Session max age in seconds (default: 7 days) */
  maxAge?: number;
  /** Secret for signing JWT/cookies */
  secret: string;
  /** Session update age - refresh session if older than this (seconds) */
  updateAge?: number;
}

/** Auth plugin configuration */
export interface AuthConfig {
  /** Session secret for signing cookies/JWT (deprecated, use session.secret) */
  secret?: string;
  /** Session duration in seconds (deprecated, use session.maxAge) */
  sessionDuration?: number;
  /** Authentication providers */
  providers?: AuthProvider[];
  /** Session configuration */
  session?: SessionConfig;
  /** Callbacks for customization */
  callbacks?: {
    /** Called when session is created */
    onSessionCreated?: (session: Session) => Promise<Session> | Session;
    /** Called to validate session */
    onSessionValidate?: (session: Session) => Promise<boolean> | boolean;
    /** Called when user signs in */
    onSignIn?: (user: User) => Promise<void> | void;
    /** Called when user signs out */
    onSignOut?: (session: Session) => Promise<void> | void;
    /** Called to generate JWT payload from session */
    jwt?: (params: { token: JWTPayload; user?: User; session?: Session }) => Promise<JWTPayload> | JWTPayload;
    /** Called to generate session from JWT payload */
    session?: (params: { token: JWTPayload; session: Session }) => Promise<Session> | Session;
  };
  /** Cookie configuration */
  cookie?: {
    name?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    domain?: string;
    path?: string;
    httpOnly?: boolean;
  };
  /** Debug mode */
  debug?: boolean;
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
  /** Check if user has all of the roles */
  hasAllRoles: (roles: string[]) => boolean;
  /** Get the current user */
  getUser: () => User | null;
  /** Get session token (JWT) */
  getToken: () => Promise<string | null>;
  /** Refresh the session */
  refreshSession: () => Promise<Session | null>;
  /** Get Set-Cookie header value for response */
  getCookieHeader: () => string | null;
}

// ============================================================================
// JWT Utilities using Web Crypto API
// ============================================================================

/** Generate a cryptographic key from secret */
async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);

  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Base64url encode */
function base64UrlEncode(data: Uint8Array): string {
  // Convert Uint8Array to string manually for better compatibility
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Base64url decode */
function base64UrlDecode(str: string): Uint8Array {
  // Add padding
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Sign a JWT token */
async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  const encoder = new TextEncoder();

  // Create header
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerBase64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadBase64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));

  // Create signature
  const signingInput = `${headerBase64}.${payloadBase64}`;
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signingInput)
  );
  const signatureBase64 = base64UrlEncode(new Uint8Array(signature));

  return `${signingInput}.${signatureBase64}`;
}

/** Verify and decode a JWT token */
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerBase64, payloadBase64, signatureBase64] = parts;
    const encoder = new TextEncoder();

    // Verify signature
    const signingInput = `${headerBase64}.${payloadBase64}`;
    const signature = base64UrlDecode(signatureBase64);
    const key = await getSigningKey(secret);

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature.buffer as ArrayBuffer,
      encoder.encode(signingInput)
    );

    if (!isValid) {
      return null;
    }

    // Decode payload
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadBase64));
    const payload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ============================================================================
// In-Memory Session Store
// ============================================================================

interface StoredSession {
  session: Session;
  createdAt: number;
  lastAccessed: number;
}

class SessionStore {
  private sessions: Map<string, StoredSession> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private maxAge: number) {
    // Cleanup expired sessions every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
  }

  /** Generate a unique session ID */
  generateId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
  }

  /** Store a session */
  set(sessionId: string, session: Session): void {
    this.sessions.set(sessionId, {
      session,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });
  }

  /** Get a session */
  get(sessionId: string): Session | null {
    const stored = this.sessions.get(sessionId);
    if (!stored) {
      return null;
    }

    // Check if expired
    if (Date.now() - stored.createdAt > this.maxAge * 1000) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last accessed
    stored.lastAccessed = Date.now();
    return stored.session;
  }

  /** Delete a session */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /** Update a session */
  update(sessionId: string, session: Session): boolean {
    const stored = this.sessions.get(sessionId);
    if (!stored) {
      return false;
    }
    stored.session = session;
    stored.lastAccessed = Date.now();
    return true;
  }

  /** Cleanup expired sessions */
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.sessions.entries());
    for (const [id, stored] of entries) {
      if (now - stored.createdAt > this.maxAge * 1000) {
        this.sessions.delete(id);
      }
    }
  }

  /** Destroy the store */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }

  /** Get all active session count */
  get size(): number {
    return this.sessions.size;
  }
}

// ============================================================================
// Cookie Utilities
// ============================================================================

/**
 * Parse a specific cookie from cookie string.
 */
function parseCookie(cookieString: string, name: string): string | null {
  const cookies = cookieString.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name && value) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Build a Set-Cookie header value.
 */
function buildCookieHeader(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    expires?: Date;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    domain?: string;
    path?: string;
  }
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  parts.push(`Path=${options.path || '/'}`);

  return parts.join('; ');
}

/**
 * Build a cookie header that clears the cookie.
 */
function buildClearCookieHeader(
  name: string,
  options: { domain?: string; path?: string }
): string {
  return buildCookieHeader(name, '', {
    maxAge: 0,
    expires: new Date(0),
    ...options,
  });
}

// ============================================================================
// Main Plugin
// ============================================================================

/** Create the auth plugin */
export function createAuthPlugin(config: AuthConfig): Plugin {
  // Normalize configuration (support both old and new config formats)
  const secretValue = config.session?.secret || config.secret;
  if (!secretValue) {
    throw new Error('[auth] Session secret is required');
  }
  const secret: string = secretValue;

  const sessionMaxAge = config.session?.maxAge ?? config.sessionDuration ?? 7 * 24 * 60 * 60; // 7 days
  const sessionStrategy: SessionStrategy = config.session?.strategy ?? 'jwt';
  const sessionUpdateAge = config.session?.updateAge ?? sessionMaxAge / 2;

  const cookieName = config.cookie?.name || 'ereo.session';
  const cookieOptions = {
    secure: config.cookie?.secure ?? process.env.NODE_ENV === 'production',
    httpOnly: config.cookie?.httpOnly ?? true,
    sameSite: config.cookie?.sameSite ?? 'lax' as const,
    domain: config.cookie?.domain,
    path: config.cookie?.path ?? '/',
  };

  // Create session store for in-memory sessions (used in hybrid mode)
  const sessionStore = new SessionStore(sessionMaxAge);

  // Debug logging
  const debug = config.debug ?? false;
  const log = (...args: unknown[]) => {
    if (debug) {
      console.log('[auth]', ...args);
    }
  };

  /**
   * Create a session from a user
   */
  async function createSession(user: User, providerId: string): Promise<Session> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + sessionMaxAge * 1000);
    const sessionId = sessionStore.generateId();

    let session: Session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles ?? [],
      claims: {},
      expiresAt,
      sessionId,
      issuedAt: now,
      provider: providerId,
    };

    // Copy any additional user data to claims
    for (const [key, value] of Object.entries(user)) {
      if (!['id', 'email', 'name', 'roles'].includes(key)) {
        session.claims![key] = value;
      }
    }

    // Apply session callback
    if (config.callbacks?.onSessionCreated) {
      session = await config.callbacks.onSessionCreated(session);
    }

    // Store in memory for hybrid/cookie strategy
    if (sessionStrategy !== 'jwt') {
      sessionStore.set(sessionId, session);
    }

    return session;
  }

  /**
   * Create a JWT token from a session
   */
  async function createToken(session: Session): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    let payload: JWTPayload = {
      sub: session.userId,
      iat: Math.floor((session.issuedAt?.getTime() ?? Date.now()) / 1000),
      exp: Math.floor((session.expiresAt?.getTime() ?? Date.now() + sessionMaxAge * 1000) / 1000),
      sid: session.sessionId,
      email: session.email,
      name: session.name,
      roles: session.roles,
      provider: session.provider,
      ...session.claims,
    };

    // Apply JWT callback
    if (config.callbacks?.jwt) {
      payload = await config.callbacks.jwt({ token: payload, session });
    }

    return signJWT(payload, secret);
  }

  /**
   * Extract session from JWT token
   */
  async function sessionFromToken(token: string): Promise<Session | null> {
    const payload = await verifyJWT(token, secret);
    if (!payload) {
      return null;
    }

    // For hybrid strategy, check if session exists in store
    if (sessionStrategy === 'hybrid' && payload.sid) {
      const storedSession = sessionStore.get(payload.sid);
      if (!storedSession) {
        log('Session not found in store:', payload.sid);
        return null;
      }
      return storedSession;
    }

    // Build session from JWT payload
    const { sub, iat, exp, sid, email, name, roles, provider, ...claims } = payload;

    let session: Session = {
      userId: sub,
      email: email as string | undefined,
      name: name as string | undefined,
      roles: roles as string[] | undefined,
      claims: claims as Record<string, unknown>,
      expiresAt: new Date(exp * 1000),
      sessionId: sid as string | undefined,
      issuedAt: new Date(iat * 1000),
      provider: provider as string | undefined,
    };

    // Apply session callback
    if (config.callbacks?.session) {
      session = await config.callbacks.session({ token: payload, session });
    }

    return session;
  }

  /**
   * Extract session from request (cookie or Authorization header).
   */
  async function extractSession(request: Request): Promise<Session | null> {
    // Try Authorization header first (takes precedence)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const session = await sessionFromToken(token);
      if (session) {
        log('Session extracted from Authorization header');
        return session;
      }
    }

    // Try cookie
    const cookie = request.headers.get('cookie');
    if (cookie) {
      const sessionCookie = parseCookie(cookie, cookieName);
      if (sessionCookie) {
        // For cookie strategy, the cookie contains a session ID
        if (sessionStrategy === 'cookie') {
          const session = sessionStore.get(sessionCookie);
          if (session) {
            log('Session extracted from cookie (session store)');
            return session;
          }
        } else {
          // For jwt/hybrid, the cookie contains a JWT
          const session = await sessionFromToken(sessionCookie);
          if (session) {
            // Validate session
            if (config.callbacks?.onSessionValidate) {
              const isValid = await config.callbacks.onSessionValidate(session);
              if (!isValid) {
                log('Session validation failed');
                return null;
              }
            }

            // Check expiration
            if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
              log('Session expired');
              return null;
            }

            log('Session extracted from cookie (JWT)');
            return session;
          }
        }
      }
    }

    return null;
  }

  return {
    name: '@ereo/auth',

    async setup(context) {
      // Initialize auth providers
      log(`Initialized with ${config.providers?.length || 0} providers`);
      console.log(`[auth] Initialized with ${config.providers?.length || 0} providers`);

      if (config.providers) {
        for (const provider of config.providers) {
          log(`Provider registered: ${provider.id} (${provider.type})`);
        }
      }
    },

    configureServer(server) {
      // Add auth middleware to all requests
      const authMiddleware: MiddlewareHandler = async (request, ctx, next) => {
        // Extract session from cookie/JWT
        const session = await extractSession(request);

        // Track pending cookie header
        let pendingCookieHeader: string | null = null;

        // Add auth context
        const authContext: AuthContext = {
          session,

          signIn: async (providerId, credentials) => {
            const provider = config.providers?.find((p) => p.id === providerId);
            if (!provider) {
              throw new Error(`Auth provider not found: ${providerId}`);
            }

            const user = await provider.authorize(credentials);
            if (!user) {
              throw new Error('Authentication failed');
            }

            // Call onSignIn callback
            if (config.callbacks?.onSignIn) {
              await config.callbacks.onSignIn(user);
            }

            const newSession = await createSession(user, providerId);

            // Update context
            authContext.session = newSession;

            // Generate token and set cookie
            const token = await createToken(newSession);
            pendingCookieHeader = buildCookieHeader(cookieName,
              sessionStrategy === 'cookie' ? newSession.sessionId! : token,
              {
                ...cookieOptions,
                maxAge: sessionMaxAge,
              }
            );

            return newSession;
          },

          signOut: async () => {
            if (authContext.session) {
              // Call onSignOut callback
              if (config.callbacks?.onSignOut) {
                await config.callbacks.onSignOut(authContext.session);
              }

              // Remove from session store
              if (authContext.session.sessionId) {
                sessionStore.delete(authContext.session.sessionId);
              }

              // Set cookie to clear
              pendingCookieHeader = buildClearCookieHeader(cookieName, {
                domain: cookieOptions.domain,
                path: cookieOptions.path,
              });
            }
            authContext.session = null;
          },

          isAuthenticated: () => authContext.session !== null,

          hasRole: (role) => authContext.session?.roles?.includes(role) ?? false,

          hasAnyRole: (roles) =>
            roles.some((role) => authContext.session?.roles?.includes(role)),

          hasAllRoles: (roles) =>
            roles.every((role) => authContext.session?.roles?.includes(role)),

          getUser: () => {
            if (!authContext.session) return null;
            return {
              id: authContext.session.userId,
              email: authContext.session.email,
              name: authContext.session.name,
              roles: authContext.session.roles,
              ...authContext.session.claims,
            };
          },

          getToken: async () => {
            if (!authContext.session) return null;
            return createToken(authContext.session);
          },

          refreshSession: async () => {
            if (!authContext.session) return null;

            // Check if session needs refresh
            const issuedAt = authContext.session.issuedAt?.getTime() ?? 0;
            const now = Date.now();

            if (now - issuedAt > sessionUpdateAge * 1000) {
              // Refresh the session
              const newExpiresAt = new Date(now + sessionMaxAge * 1000);
              const newIssuedAt = new Date(now);

              authContext.session = {
                ...authContext.session,
                expiresAt: newExpiresAt,
                issuedAt: newIssuedAt,
              };

              // Update store
              if (authContext.session.sessionId) {
                sessionStore.update(authContext.session.sessionId, authContext.session);
              }

              // Update cookie
              const token = await createToken(authContext.session);
              pendingCookieHeader = buildCookieHeader(cookieName,
                sessionStrategy === 'cookie' ? authContext.session.sessionId! : token,
                {
                  ...cookieOptions,
                  maxAge: sessionMaxAge,
                }
              );

              log('Session refreshed');
            }

            return authContext.session;
          },

          getCookieHeader: () => pendingCookieHeader,
        };

        // Add auth to context
        ctx.set('auth', authContext);

        // Call next middleware
        const response = await next();

        // Add Set-Cookie header if needed
        if (pendingCookieHeader) {
          const headers = new Headers(response.headers);
          headers.append('Set-Cookie', pendingCookieHeader);
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        }

        return response;
      };

      server.middlewares.push(authMiddleware);
    },
  };
}

// ============================================================================
// Route Protection Utilities
// ============================================================================

/**
 * Create auth middleware for route protection.
 */
export function requireAuth(options?: {
  redirect?: string;
  roles?: string[];
  permissions?: string[];
  unauthorizedResponse?: {
    status: number;
    body: unknown;
  };
}): Partial<RouteConfig> {
  return {
    auth: {
      required: true,
      roles: options?.roles,
      permissions: options?.permissions,
      redirect: options?.redirect,
      unauthorized: options?.unauthorizedResponse,
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
 * Create role-based auth middleware.
 */
export function requireRoles(roles: string[], options?: {
  redirect?: string;
  requireAll?: boolean;
}): Partial<RouteConfig> {
  return {
    auth: {
      required: true,
      roles,
      redirect: options?.redirect,
      check: async ({ context }) => {
        const auth = context.get('auth') as AuthContext | undefined;
        if (!auth?.isAuthenticated()) {
          return false;
        }
        if (options?.requireAll) {
          return auth.hasAllRoles(roles);
        }
        return auth.hasAnyRole(roles);
      },
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to use auth in loaders/actions.
 */
export function useAuth(context: AppContext): AuthContext {
  const auth = context.get('auth') as AuthContext | undefined;
  if (!auth) {
    throw new Error('Auth context not found. Make sure createAuthPlugin is registered.');
  }
  return auth;
}

/**
 * Get the current session from context (or null if not authenticated).
 */
export function getSession(context: AppContext): Session | null {
  const auth = context.get('auth') as AuthContext | undefined;
  return auth?.session ?? null;
}

/**
 * Get the current user from context (or null if not authenticated).
 */
export function getUser(context: AppContext): User | null {
  const auth = context.get('auth') as AuthContext | undefined;
  return auth?.getUser() ?? null;
}

/**
 * Create a protected route handler that requires authentication.
 */
export function withAuth<T>(
  handler: (args: { request: Request; context: AppContext; auth: AuthContext; params: Record<string, string> }) => T | Promise<T>,
  options?: { roles?: string[] }
): (args: { request: Request; context: AppContext; params: Record<string, string> }) => Promise<T> {
  return async (args) => {
    const auth = useAuth(args.context);

    if (!auth.isAuthenticated()) {
      throw new Response('Unauthorized', { status: 401 });
    }

    if (options?.roles && !auth.hasAnyRole(options.roles)) {
      throw new Response('Forbidden', { status: 403 });
    }

    return handler({ ...args, auth });
  };
}

// ============================================================================
// OAuth Helper Functions
// ============================================================================

/**
 * Get OAuth authorization URL for a provider.
 */
export function getOAuthUrl(
  context: AppContext,
  providerId: string,
  redirectUri: string
): string {
  const config = context.get('authConfig') as AuthConfig | undefined;
  const provider = config?.providers?.find(p => p.id === providerId);

  if (!provider || provider.type !== 'oauth' || !provider.getAuthorizationUrl) {
    throw new Error(`OAuth provider not found or not configured: ${providerId}`);
  }

  // Generate state for CSRF protection
  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));

  return provider.getAuthorizationUrl(state, redirectUri);
}

/**
 * Handle OAuth callback.
 */
export async function handleOAuthCallback(
  context: AppContext,
  providerId: string,
  params: { code: string; state: string; redirectUri: string }
): Promise<Session> {
  const auth = useAuth(context);
  const config = context.get('authConfig') as AuthConfig | undefined;
  const provider = config?.providers?.find(p => p.id === providerId);

  if (!provider || provider.type !== 'oauth' || !provider.handleCallback) {
    throw new Error(`OAuth provider not found or not configured: ${providerId}`);
  }

  const user = await provider.handleCallback(params);
  if (!user) {
    throw new Error('OAuth authentication failed');
  }

  // Create session through auth context
  return auth.signIn(providerId, { user });
}
