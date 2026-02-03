/**
 * @ereo/client - Error Boundary Context and Recovery System
 *
 * Provides error boundaries, context, and recovery utilities for the Ereo framework.
 */

import React, {
  Component,
  useContext,
  type ReactNode,
  type ErrorInfo,
  type ComponentType,
} from 'react';
import type { RouteParams, ErrorConfig } from '@ereo/core';
import { ErrorContext, type ErrorContextValue } from './hooks';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ErrorBoundary component.
 */
export interface ErrorBoundaryProps {
  /** Fallback UI when error occurs */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Children to render */
  children: ReactNode;
}

/**
 * State for the ErrorBoundary component.
 */
interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Route error response structure.
 */
export interface RouteErrorResponse {
  status: number;
  statusText: string;
  data: unknown;
  internal?: boolean;
}

/**
 * Props for RouteErrorBoundary component.
 */
export interface RouteErrorBoundaryProps {
  /** Route identifier */
  routeId: string;
  /** Error configuration from route */
  errorConfig?: ErrorConfig;
  /** Children to render */
  children: ReactNode;
  /** Fallback component from route module */
  fallbackComponent?: ComponentType<{ error: Error; params: RouteParams }>;
  /** Route params */
  params?: RouteParams;
}

/**
 * Return type for useErrorBoundary hook.
 */
export interface UseErrorBoundaryReturn {
  error: Error | undefined;
  reset: () => void;
  showBoundary: (error: Error) => void;
}

// Re-export ErrorContext and ErrorContextValue from hooks for convenience
export { ErrorContext, type ErrorContextValue };

// ============================================================================
// ErrorBoundary Component
// ============================================================================

/**
 * Error boundary component that catches JavaScript errors in child components.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught.
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  /**
   * Log error information and call onError callback.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Reset the error state.
   */
  reset = (): void => {
    this.setState({
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { error } = this.state;
    const { fallback, children } = this.props;

    if (error) {
      // Render fallback UI
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }

      if (fallback !== undefined) {
        return fallback;
      }

      // Default fallback
      return React.createElement(
        'div',
        {
          style: {
            padding: '20px',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
          },
        },
        React.createElement('h2', null, 'Something went wrong'),
        React.createElement('p', null, error.message),
        React.createElement(
          'button',
          {
            onClick: this.reset,
            style: {
              padding: '8px 16px',
              backgroundColor: '#721c24',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            },
          },
          'Try again'
        )
      );
    }

    return children;
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access error boundary functionality.
 * Provides error state, reset function, and ability to programmatically trigger errors.
 *
 * @returns Object with error state and control functions
 * @throws Error if used outside EreoProvider or ErrorProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { error, reset, showBoundary } = useErrorBoundary();
 *
 *   const handleAsyncError = async () => {
 *     try {
 *       await fetchData();
 *     } catch (e) {
 *       showBoundary(e as Error);
 *     }
 *   };
 *
 *   return <button onClick={handleAsyncError}>Fetch</button>;
 * }
 * ```
 */
export function useErrorBoundary(): UseErrorBoundaryReturn {
  const context = useContext(ErrorContext);

  if (!context) {
    throw new Error(
      'useErrorBoundary must be used within an EreoProvider or ErrorProvider. ' +
        'Make sure your component is wrapped with the appropriate provider.'
    );
  }

  return {
    error: context.error,
    reset: context.clearError,
    showBoundary: (error: Error) => context.setError(error),
  };
}

/**
 * Hook to get the current route error.
 * This is a simple implementation that accesses the error from context.
 *
 * @returns The current error or undefined
 *
 * @example
 * ```tsx
 * function ErrorPage() {
 *   const error = useRouteError();
 *
 *   if (isRouteErrorResponse(error)) {
 *     return <div>HTTP Error: {error.status}</div>;
 *   }
 *
 *   return <div>Unknown error occurred</div>;
 * }
 * ```
 */
export function useRouteError(): unknown {
  const context = useContext(ErrorContext);
  return context?.error;
}

// ============================================================================
// Route Error Boundary
// ============================================================================

/**
 * Error boundary specifically for route-level error handling.
 * Integrates with route configuration and supports error recovery strategies.
 */
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  ErrorBoundaryState & { retryCount: number }
> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    const { errorConfig, routeId } = this.props;

    // Report error if handler is configured
    if (errorConfig?.reportError) {
      errorConfig.reportError(error, {
        route: routeId,
        phase: 'render',
      });
    }

    // Handle different error strategies
    if (errorConfig?.onError === 'silent') {
      // Silent mode - just log to console
      console.error(`[Route ${routeId}] Error:`, error);
    } else if (errorConfig?.onError === 'redirect') {
      // Redirect mode - would need navigation integration
      console.error(`[Route ${routeId}] Error (redirect mode):`, error);
    } else if (errorConfig?.onError === 'toast') {
      // Toast mode - would need toast integration
      console.error(`[Route ${routeId}] Error (toast mode):`, error);
    }
  }

  /**
   * Reset the error state and optionally retry.
   */
  reset = (): void => {
    const { errorConfig } = this.props;
    const { retryCount } = this.state;

    // Check if we should auto-retry
    if (errorConfig?.retry && retryCount < errorConfig.retry.count) {
      // Delay before retry
      setTimeout(() => {
        this.setState((prevState) => ({
          error: null,
          errorInfo: null,
          retryCount: prevState.retryCount + 1,
        }));
      }, errorConfig.retry.delay);
    } else {
      this.setState({
        error: null,
        errorInfo: null,
        retryCount: 0,
      });
    }
  };

  render(): ReactNode {
    const { error } = this.state;
    const { children, fallbackComponent: FallbackComponent, errorConfig, params = {} } = this.props;

    if (error) {
      // Check max captures
      if (errorConfig?.maxCaptures !== undefined && this.state.retryCount >= errorConfig.maxCaptures) {
        // Return minimal error UI after max captures exceeded
        return React.createElement(
          'div',
          { style: { padding: '20px', color: '#721c24' } },
          'Error limit exceeded. Please refresh the page.'
        );
      }

      // Use route-specific fallback component if provided
      if (FallbackComponent) {
        return React.createElement(FallbackComponent, { error, params });
      }

      // Use error config fallback if provided
      if (errorConfig?.fallback) {
        return React.createElement(errorConfig.fallback, {});
      }

      // Default route error UI
      return React.createElement(
        'div',
        {
          style: {
            padding: '20px',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
          },
        },
        React.createElement('h2', null, 'Route Error'),
        React.createElement('p', null, error.message),
        React.createElement(
          'button',
          {
            onClick: this.reset,
            style: {
              padding: '8px 16px',
              backgroundColor: '#721c24',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            },
          },
          'Retry'
        )
      );
    }

    return children;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if an error is a RouteErrorResponse.
 *
 * @param error - The error to check
 * @returns True if the error is a RouteErrorResponse
 *
 * @example
 * ```tsx
 * const error = useRouteError();
 *
 * if (isRouteErrorResponse(error)) {
 *   console.log(error.status); // e.g., 404
 *   console.log(error.statusText); // e.g., "Not Found"
 * }
 * ```
 */
export function isRouteErrorResponse(error: unknown): error is RouteErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'statusText' in error &&
    'data' in error &&
    typeof (error as RouteErrorResponse).status === 'number' &&
    typeof (error as RouteErrorResponse).statusText === 'string'
  );
}

/**
 * Create a RouteErrorResponse.
 *
 * @param status - HTTP status code
 * @param statusText - HTTP status text
 * @param data - Additional error data
 * @returns A RouteErrorResponse object
 *
 * @example
 * ```tsx
 * throw createRouteErrorResponse(404, 'Not Found', { message: 'Page not found' });
 * ```
 */
export function createRouteErrorResponse(
  status: number,
  statusText: string,
  data: unknown = null
): RouteErrorResponse {
  return {
    status,
    statusText,
    data,
    internal: false,
  };
}

/**
 * Wrap a component with an error boundary.
 *
 * @param WrappedComponent - The component to wrap
 * @param errorBoundaryProps - Props to pass to the error boundary
 * @returns A new component wrapped with an error boundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   fallback: <div>Something went wrong</div>,
 *   onError: (error) => console.error(error),
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): ComponentType<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary = (props: P): React.ReactElement => {
    const boundaryProps: ErrorBoundaryProps = {
      ...(errorBoundaryProps || {}),
      children: React.createElement(WrappedComponent, props),
    };
    return React.createElement(ErrorBoundary, boundaryProps);
  };

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

/**
 * Create a custom error for route responses.
 *
 * @example
 * ```tsx
 * // In a loader function
 * export async function loader({ params }: LoaderArgs) {
 *   const post = await getPost(params.id);
 *   if (!post) {
 *     throw new RouteError(404, 'Not Found', { message: 'Post not found' });
 *   }
 *   return { post };
 * }
 * ```
 */
export class RouteError extends Error {
  status: number;
  statusText: string;
  data: unknown;

  constructor(status: number, statusText: string, data?: unknown) {
    super(`${status} ${statusText}`);
    this.name = 'RouteError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }

  /**
   * Convert to RouteErrorResponse.
   */
  toResponse(): RouteErrorResponse {
    return {
      status: this.status,
      statusText: this.statusText,
      data: this.data,
    };
  }
}
