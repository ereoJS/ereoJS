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
 * Access action results in components.
 *
 * @returns The action data (undefined if no action has been submitted)
 * @throws Error if used outside of EreoProvider
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

  if (context === null) {
    throw new Error(
      'useActionData must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
  }

  return context.data as T | undefined;
}

/**
 * Get current navigation state.
 *
 * @returns The current navigation state
 * @throws Error if used outside of EreoProvider
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
export function useNavigation(): NavigationStateHook {
  const context = useContext(NavigationContext);

  if (context === null) {
    throw new Error(
      'useNavigation must be used within an EreoProvider. ' +
        'Make sure your component is wrapped with <EreoProvider>.'
    );
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
}

/**
 * Combined provider that wraps the application with all Ereo contexts.
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
}: EreoProviderProps): ReactNode {
  return createElement(
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
