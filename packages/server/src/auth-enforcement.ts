/**
 * @ereo/server - Auth Config Enforcement
 *
 * Runtime enforcement of route-level AuthConfig.
 * Evaluates static checks (required, roles) and custom check functions
 * before loaders/actions execute.
 */

import type { AuthConfig, AuthCheckResult, AppContext } from '@ereo/core';

/**
 * Resolve an auth denial using the static AuthConfig fallbacks.
 * Checks redirect → unauthorized → default 403.
 */
export function resolveAuthDenial(auth: AuthConfig, request: Request): Response {
  if (auth.redirect) {
    const pathname = new URL(request.url).pathname;
    const url = auth.redirect.replace('{pathname}', encodeURIComponent(pathname));
    return new Response(null, {
      status: 303,
      headers: { Location: url },
    });
  }
  if (auth.unauthorized) {
    return new Response(JSON.stringify(auth.unauthorized.body), {
      status: auth.unauthorized.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response('Forbidden', { status: 403 });
}

/**
 * Resolve a rich AuthCheckResult denial into a Response.
 */
export function resolveCheckResult(result: AuthCheckResult & { allowed: false }): Response {
  if ('response' in result) return result.response;
  if ('redirect' in result) {
    return new Response(null, {
      status: 303,
      headers: { Location: result.redirect },
    });
  }
  return new Response(
    result.body !== undefined ? JSON.stringify(result.body) : 'Forbidden',
    {
      status: (result as any).status ?? 403,
      headers: result.body !== undefined ? { 'Content-Type': 'application/json' } : {},
    },
  );
}

/**
 * Enforce route-level auth config before running loaders/actions.
 * Returns a Response if access is denied, or null if access is allowed.
 */
export async function enforceAuthConfig(
  authConfig: AuthConfig,
  request: Request,
  context: AppContext,
  params: Record<string, string | string[] | undefined>,
): Promise<Response | null> {
  const authCtx = context.get<{ isAuthenticated: () => boolean; hasAnyRole: (roles: string[]) => boolean }>('auth');

  // Static: required authentication
  if (authConfig.required && !authCtx?.isAuthenticated()) {
    return resolveAuthDenial(authConfig, request);
  }

  // Static: required roles
  if (authConfig.roles?.length) {
    if (!authCtx?.isAuthenticated() || !authCtx.hasAnyRole(authConfig.roles)) {
      return resolveAuthDenial(authConfig, request);
    }
  }

  // Custom check function
  if (authConfig.check) {
    const result = await authConfig.check({ request, context, params });

    if (result === false) {
      return resolveAuthDenial(authConfig, request);
    }
    if (result !== true && typeof result === 'object' && 'allowed' in result && !result.allowed) {
      return resolveCheckResult(result as AuthCheckResult & { allowed: false });
    }
  }

  return null;
}
