/**
 * @ereo/client - Client Data Loading
 *
 * Runtime for executing clientLoader and clientAction functions.
 * These run in the browser and can optionally call the server loader/action.
 */

import type {
  ClientLoaderArgs,
  ClientLoaderFunction,
  ClientActionArgs,
  ClientActionFunction,
  RouteParams,
} from '@ereo/core';
import { fetchLoaderData, submitAction } from './navigation';

/**
 * Execute a route's clientLoader, providing a serverLoader callback that
 * fetches data from the server loader endpoint.
 *
 * @param clientLoader - The client loader function from the route module
 * @param pathname - The current route pathname (for server fetch fallback)
 * @param params - The matched route params
 * @param request - The current request (constructed from window.location)
 * @returns The loader data
 */
export async function executeClientLoader<T = unknown>(
  clientLoader: ClientLoaderFunction<T>,
  pathname: string,
  params: RouteParams,
  request?: Request,
): Promise<T> {
  const req = request ?? new Request(
    typeof window !== 'undefined'
      ? window.location.href
      : `http://localhost${pathname}`
  );

  const serverLoader = async <S = unknown>(): Promise<S> => {
    return fetchLoaderData<S>(pathname, params);
  };

  const args: ClientLoaderArgs = {
    params,
    request: req,
    serverLoader,
  };

  return clientLoader(args) as Promise<T>;
}

/**
 * Execute a route's clientAction, providing a serverAction callback that
 * submits to the server action endpoint.
 *
 * @param clientAction - The client action function from the route module
 * @param pathname - The current route pathname
 * @param params - The matched route params
 * @param request - The request with form data
 * @returns The action result
 */
export async function executeClientAction<T = unknown>(
  clientAction: ClientActionFunction<T>,
  pathname: string,
  params: RouteParams,
  request: Request,
): Promise<T> {
  const serverAction = async <S = unknown>(): Promise<S> => {
    const formData = await request.clone().formData().catch(() => undefined);
    return submitAction<S>(pathname, formData ?? new FormData());
  };

  const args: ClientActionArgs = {
    params,
    request,
    serverAction,
  };

  return clientAction(args) as Promise<T>;
}

/**
 * Determine whether the clientLoader should run during hydration.
 * By default, clientLoader only runs on client-side navigations, not on initial SSR hydration.
 * Set `clientLoader.hydrate = true` to also run during hydration.
 */
export function shouldHydrateClientLoader(
  clientLoader: ClientLoaderFunction | undefined,
): boolean {
  if (!clientLoader) return false;
  return clientLoader.hydrate === true;
}
