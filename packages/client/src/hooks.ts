/**
 * @ereo/client - React Hooks
 *
 * Client-side React hooks for accessing loader data, action results,
 * navigation state, and error boundaries.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type Context,
  createElement,
} from 'react';

import type { RouteParams } from '@ereo/core';
import { MatchesContext, MatchesProvider, type RouteMatchData } from './matches';

// ============================================================================
// Types
// ============================================================================

/**
 * Navigation status for useNavigation hook.
 */
export type NavigationStatus = 'idle' | 'loading' | 'submitting';

/**
 * Navigation state returned by useNavigation.
 */
export interface NavigationStateHook {
  /** Current navigation status */
  status: NavigationStatus;
  /** The location being navigated to (if loading/submitting) */
  location?: string;
  /** The form data being submitted (if submitting) */
  formData?: FormData;
  /** The form method being used (if submitting) */
  formMethod?: string;
  /** The form action being used (if submitting) */
  formAction?: string;
}

/**
 * Context value for loader data.
 */
export interface LoaderDataContextValue {
  data: unknown;
  setData: (data: unknown) => void;
}

/**
 * Context value for action data.
 */
export interface ActionDataContextValue {
  data: unknown;
  setData: (data: unknown) => void;
  clearData: () => void;
}

/**
 * Context value for navigation state.
 */
export interface NavigationContextValue {
  state: NavigationStateHook;
  setState: (state: NavigationStateHook) => void;
  startLoading: (location: string) => void;
  startSubmitting: (options: {
    location: string;
    formData?: FormData;
    formMethod?: string;
    formAction?: string;
  }) => void;
  complete: () => void;
}

/**
 * Context value for error boundary.
 */
export interface ErrorContextValue {
  error: Error | undefined;
  setError: (error: Error | undefined) => void;
  clearError: () => void;
}

/**
 * Location object returned by useLocation.
 */
export interface LocationState {
  /** Current pathname (e.g., '/users/123') */
  pathname: string;
  /** Query string including '?' (e.g., '?page=1&sort=name') */
  search: string;
  /** Hash including '#' (e.g., '#section-2') */
  hash: string;
  /** History state object */
  state: unknown;
  /** Unique key for this location entry (useful for scroll restoration) */
  key: string;
}

/**
 * Context value for route params.
 */
export interface ParamsContextValue {
  params: RouteParams;
  setParams: (params: RouteParams) => void;
}

/**
 * Context value for location.
 */
export interface LocationContextValue {
  location: LocationState;
  setLocation: (location: LocationState) => void;
}

// ============================================================================
// Contexts
// ============================================================================

/**
 * Context for loader data - populated during hydration/navigation.
 */
export const LoaderDataContext: Context<LoaderDataContextValue | null> =
  createContext<LoaderDataContextValue | null>(null);

/**
 * Context for action results - populated after form submissions.
 */
export const ActionDataContext: Context<ActionDataContextValue | null> =
  createContext<ActionDataContextValue | null>(null);

/**
 * Context for navigation state - tracks navigation state.
 */
export const NavigationContext: Context<NavigationContextValue | null> =
  createContext<NavigationContextValue | null>(null);

/**
 * Context for error boundary - captures errors from boundaries.
 */
export const ErrorContext: Context<ErrorContextValue | null> =
  createContext<ErrorContextValue | null>(null);

/**
 * Context for route params - populated during route matching.
 */
export const ParamsContext: Context<ParamsContextValue | null> =
  createContext<ParamsContextValue | null>(null);

/**
 * Context for current location - populated from window.location or SSR.
 */
export const LocationContext: Context<LocationContextValue | null> =
  createContext<LocationContextValue | null>(null);

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access loader data in components.
 *
 * @returns The loader data for the current route
 * @throws Error if used outside of EreoProvider
 *
 * @example
 * ```tsx
 * function UserProfile() {
 *   const { user, posts } = useLoaderData<{ user: User; posts: Post[] }>();
 *   return <div>{user.name}</div>;
 * }
 * ```
 */
export function useLoaderData<T>(): T {
  const context = useContext(LoaderDataContext);

  if (context === null) {
    throw new Error(
      'useLoaderData must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
  }

  return context.data as T;
}

/**
 * Access loader data from a specific route by its ID.
 * Useful for accessing parent layout data or sibling route data.
 *
 * @returns The loader data for the specified route, or undefined if not found
 *
 * @example
 * ```tsx
 * function ChildComponent() {
 *   const rootData = useRouteLoaderData<{ user: User }>('root-layout');
 *   return <div>Hello {rootData?.user.name}</div>;
 * }
 * ```
 */
export function useRouteLoaderData<T>(routeId: string): T | undefined {
  const context = useContext(MatchesContext);
  if (context === null) {
    return undefined;
  }

  const match = context.matches.find((m) => m.id === routeId);
  return match?.data as T | undefined;
}

/**
 * Access action results in components.
 *
 * @returns The action data (undefined if no action has been submitted or during SSR without context)
 *
 * @example
 * ```tsx
 * function ContactForm() {
 *   const actionData = useActionData<{ success: boolean; errors?: string[] }>();
 *
 *   if (actionData?.success) {
 *     return <div>Message sent!</div>;
 *   }
 *
 *   return (
 *     <form method="post">
 *       {actionData?.errors?.map(e => <p>{e}</p>)}
 *       <input name="email" />
 *       <button>Submit</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useActionData<T>(): T | undefined {
  const context = useContext(ActionDataContext);

  // During SSR or when EreoProvider is not present, return undefined gracefully
  // This allows the hook to be used in components that are server-rendered
  if (context === null) {
    return undefined;
  }

  return context.data as T | undefined;
}

/**
 * Get current navigation state.
 *
 * During SSR or when used outside of EreoProvider, returns a default idle state.
 * This allows the hook to be safely used in server-rendered route components.
 *
 * @returns The current navigation state
 *
 * @example
 * ```tsx
 * function NavigationIndicator() {
 *   const navigation = useNavigation();
 *
 *   if (navigation.status === 'loading') {
 *     return <Spinner />;
 *   }
 *
 *   if (navigation.status === 'submitting') {
 *     return <div>Submitting form...</div>;
 *   }
 *
 *   return null;
 * }
 * ```
 */
const ssrNavigationState: NavigationStateHook = {
  status: 'idle' as NavigationStatus,
};

export function useNavigation(): NavigationStateHook {
  const context = useContext(NavigationContext);

  // During SSR or when EreoProvider is not present, return default idle state.
  // This allows the hook to be used in components that are server-rendered.
  if (context === null) {
    return ssrNavigationState;
  }

  return context.state;
}

/**
 * Access error from error boundary context.
 *
 * @returns The current error (undefined if no error)
 * @throws Error if used outside of EreoProvider
 *
 * @example
 * ```tsx
 * function ErrorDisplay() {
 *   const error = useError();
 *
 *   if (!error) return null;
 *
 *   return (
 *     <div className="error">
 *       <h1>Something went wrong</h1>
 *       <p>{error.message}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useError(): Error | undefined {
  const context = useContext(ErrorContext);

  if (context === null) {
    throw new Error(
      'useError must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
  }

  return context.error;
}

/**
 * Access the current route params.
 *
 * @returns The params object for the current matched route
 * @throws Error if used outside of EreoProvider
 *
 * @example
 * ```tsx
 * // In a route file at /users/[id].tsx
 * function UserProfile() {
 *   const { id } = useParams<{ id: string }>();
 *   return <div>User ID: {id}</div>;
 * }
 * ```
 */
export function useParams<T extends RouteParams = RouteParams>(): T {
  const context = useContext(ParamsContext);

  if (context === null) {
    throw new Error(
      'useParams must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
  }

  return context.params as T;
}

/**
 * Access and modify the current URL search parameters.
 *
 * Returns a tuple of [searchParams, setSearchParams] similar to useState.
 * setSearchParams updates the URL without a full page reload.
 *
 * @returns [URLSearchParams, setter function]
 *
 * @example
 * ```tsx
 * function ProductList() {
 *   const [searchParams, setSearchParams] = useSearchParams();
 *   const page = searchParams.get('page') || '1';
 *   const sort = searchParams.get('sort') || 'name';
 *
 *   return (
 *     <div>
 *       <button onClick={() => setSearchParams({ page: '2', sort })}>
 *         Next Page
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSearchParams(): [
  URLSearchParams,
  (
    nextParams:
      | URLSearchParams
      | Record<string, string>
      | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>),
    options?: { replace?: boolean }
  ) => void,
] {
  const locationCtx = useContext(LocationContext);

  if (locationCtx === null) {
    throw new Error(
      'useSearchParams must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
  }

  const searchParams = useMemo(
    () => new URLSearchParams(locationCtx.location.search),
    [locationCtx.location.search]
  );

  const setSearchParams = useCallback(
    (
      nextParams:
        | URLSearchParams
        | Record<string, string>
        | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>),
      options?: { replace?: boolean }
    ) => {
      let resolved: URLSearchParams;
      if (typeof nextParams === 'function') {
        const result = nextParams(searchParams);
        resolved =
          result instanceof URLSearchParams
            ? result
            : new URLSearchParams(result);
      } else if (nextParams instanceof URLSearchParams) {
        resolved = nextParams;
      } else {
        resolved = new URLSearchParams(nextParams);
      }

      const newSearch = resolved.toString();
      const newLocation: LocationState = {
        ...locationCtx.location,
        search: newSearch ? `?${newSearch}` : '',
        key: Math.random().toString(36).slice(2, 10),
      };

      locationCtx.setLocation(newLocation);

      // Update the browser URL if in browser environment
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.search = newLocation.search;
        if (options?.replace) {
          window.history.replaceState(locationCtx.location.state, '', url.toString());
        } else {
          window.history.pushState(locationCtx.location.state, '', url.toString());
        }
      }
    },
    [searchParams, locationCtx]
  );

  return [searchParams, setSearchParams];
}

/**
 * Access the current location.
 *
 * @returns The current location object with pathname, search, hash, state, and key
 * @throws Error if used outside of EreoProvider
 *
 * @example
 * ```tsx
 * function Breadcrumbs() {
 *   const location = useLocation();
 *   const segments = location.pathname.split('/').filter(Boolean);
 *
 *   return (
 *     <nav>
 *       {segments.map((seg, i) => (
 *         <span key={i}> / {seg}</span>
 *       ))}
 *     </nav>
 *   );
 * }
 * ```
 */
export function useLocation(): LocationState {
  const context = useContext(LocationContext);

  if (context === null) {
    throw new Error(
      'useLocation must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
  }

  return context.location;
}

// ============================================================================
// Provider Components
// ============================================================================

/**
 * Props for LoaderDataProvider.
 */
export interface LoaderDataProviderProps {
  children: ReactNode;
  initialData?: unknown;
}

/**
 * Provider for loader data context.
 */
export function LoaderDataProvider({
  children,
  initialData,
}: LoaderDataProviderProps): ReactNode {
  const [data, setData] = useState<unknown>(initialData);

  const value = useMemo<LoaderDataContextValue>(
    () => ({ data, setData }),
    [data]
  );

  return createElement(LoaderDataContext.Provider, { value }, children);
}

/**
 * Props for ActionDataProvider.
 */
export interface ActionDataProviderProps {
  children: ReactNode;
  initialData?: unknown;
}

/**
 * Provider for action data context.
 */
export function ActionDataProvider({
  children,
  initialData,
}: ActionDataProviderProps): ReactNode {
  const [data, setData] = useState<unknown>(initialData);

  const clearData = useCallback(() => {
    setData(undefined);
  }, []);

  const value = useMemo<ActionDataContextValue>(
    () => ({ data, setData, clearData }),
    [data, clearData]
  );

  return createElement(ActionDataContext.Provider, { value }, children);
}

/**
 * Props for NavigationProvider.
 */
export interface NavigationProviderProps {
  children: ReactNode;
  initialState?: NavigationStateHook;
}

const defaultNavigationState: NavigationStateHook = {
  status: 'idle',
};

/**
 * Provider for navigation state context.
 */
export function NavigationProvider({
  children,
  initialState = defaultNavigationState,
}: NavigationProviderProps): ReactNode {
  const [state, setState] = useState<NavigationStateHook>(initialState);

  const startLoading = useCallback((location: string) => {
    setState({
      status: 'loading',
      location,
    });
  }, []);

  const startSubmitting = useCallback(
    (options: {
      location: string;
      formData?: FormData;
      formMethod?: string;
      formAction?: string;
    }) => {
      setState({
        status: 'submitting',
        location: options.location,
        formData: options.formData,
        formMethod: options.formMethod,
        formAction: options.formAction,
      });
    },
    []
  );

  const complete = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      state,
      setState,
      startLoading,
      startSubmitting,
      complete,
    }),
    [state, startLoading, startSubmitting, complete]
  );

  return createElement(NavigationContext.Provider, { value }, children);
}

/**
 * Props for ErrorProvider.
 */
export interface ErrorProviderProps {
  children: ReactNode;
  initialError?: Error;
}

/**
 * Provider for error context.
 */
export function ErrorProvider({
  children,
  initialError,
}: ErrorProviderProps): ReactNode {
  const [error, setError] = useState<Error | undefined>(initialError);

  const clearError = useCallback(() => {
    setError(undefined);
  }, []);

  const value = useMemo<ErrorContextValue>(
    () => ({ error, setError, clearError }),
    [error, clearError]
  );

  return createElement(ErrorContext.Provider, { value }, children);
}

/**
 * Props for ParamsProvider.
 */
export interface ParamsProviderProps {
  children: ReactNode;
  initialParams?: RouteParams;
}

/**
 * Provider for route params context.
 */
export function ParamsProvider({
  children,
  initialParams = {},
}: ParamsProviderProps): ReactNode {
  const [params, setParams] = useState<RouteParams>(initialParams);

  const value = useMemo<ParamsContextValue>(
    () => ({ params, setParams }),
    [params]
  );

  return createElement(ParamsContext.Provider, { value }, children);
}

/**
 * Props for LocationProvider.
 */
export interface LocationProviderProps {
  children: ReactNode;
  initialLocation?: LocationState;
}

const defaultLocation: LocationState = {
  pathname: '/',
  search: '',
  hash: '',
  state: null,
  key: 'default',
};

/**
 * Provider for location context.
 */
export function LocationProvider({
  children,
  initialLocation = defaultLocation,
}: LocationProviderProps): ReactNode {
  const [location, setLocation] = useState<LocationState>(initialLocation);

  const value = useMemo<LocationContextValue>(
    () => ({ location, setLocation }),
    [location]
  );

  return createElement(LocationContext.Provider, { value }, children);
}

/**
 * Props for EreoProvider - the combined provider that wraps your app.
 */
export interface EreoProviderProps {
  children: ReactNode;
  /** Initial loader data (typically from SSR) */
  loaderData?: unknown;
  /** Initial action data (typically from SSR after form submission) */
  actionData?: unknown;
  /** Initial navigation state */
  navigationState?: NavigationStateHook;
  /** Initial error (if rendering an error boundary) */
  error?: Error;
  /** Initial route params (from route matching) */
  params?: RouteParams;
  /** Initial location (from request URL or window.location) */
  location?: LocationState;
  /** Initial matched routes (from route matching) */
  matches?: RouteMatchData[];
}

/**
 * Combined provider that wraps the application with all EreoJS contexts.
 *
 * @example
 * ```tsx
 * // In your entry point
 * import { EreoProvider } from '@ereo/client';
 *
 * function App() {
 *   return (
 *     <EreoProvider loaderData={window.__EREO_DATA__}>
 *       <Router />
 *     </EreoProvider>
 *   );
 * }
 * ```
 */
export function EreoProvider({
  children,
  loaderData,
  actionData,
  navigationState,
  error,
  params,
  location,
  matches,
}: EreoProviderProps): ReactNode {
  return createElement(
    MatchesProvider,
    { initialMatches: matches, children: createElement(
      LocationProvider,
      { initialLocation: location, children: createElement(
        ParamsProvider,
        { initialParams: params, children: createElement(
          ErrorProvider,
          { initialError: error, children: createElement(
            NavigationProvider,
            { initialState: navigationState, children: createElement(
              ActionDataProvider,
              { initialData: actionData, children: createElement(
                LoaderDataProvider,
                { initialData: loaderData, children }
              )}
            )}
          )}
        )}
      )}
    )}
  );
}

// ============================================================================
// Context Accessors (for internal use)
// ============================================================================

/**
 * Get the raw loader data context (for internal use).
 */
export function useLoaderDataContext(): LoaderDataContextValue {
  const context = useContext(LoaderDataContext);

  if (context === null) {
    throw new Error('useLoaderDataContext must be used within an EreoProvider');
  }

  return context;
}

/**
 * Get the raw action data context (for internal use).
 */
export function useActionDataContext(): ActionDataContextValue {
  const context = useContext(ActionDataContext);

  if (context === null) {
    throw new Error('useActionDataContext must be used within an EreoProvider');
  }

  return context;
}

/**
 * Get the raw navigation context (for internal use).
 */
export function useNavigationContext(): NavigationContextValue {
  const context = useContext(NavigationContext);

  if (context === null) {
    throw new Error('useNavigationContext must be used within an EreoProvider');
  }

  return context;
}

/**
 * Get the raw error context (for internal use).
 */
export function useErrorContext(): ErrorContextValue {
  const context = useContext(ErrorContext);

  if (context === null) {
    throw new Error('useErrorContext must be used within an EreoProvider');
  }

  return context;
}
