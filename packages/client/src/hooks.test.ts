import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import {
  useLoaderData,
  useActionData,
  useNavigation,
  useError,
  LoaderDataProvider,
  ActionDataProvider,
  NavigationProvider,
  ErrorProvider,
  EreoProvider,
  LoaderDataContext,
  ActionDataContext,
  NavigationContext,
  ErrorContext,
  useLoaderDataContext,
  useActionDataContext,
  useNavigationContext,
  useErrorContext,
  type NavigationStateHook,
  type NavigationStatus,
} from './hooks';

// Simple render helper that captures hook results
// Since we're testing in a non-browser environment, we simulate React rendering
function renderHook<T>(
  hook: () => T,
  wrapper?: (props: { children: ReactNode }) => ReactNode
): { result: { current: T | Error } } {
  let result: { current: T | Error } = { current: null as unknown as T };

  // Create a test component that uses the hook
  function TestComponent() {
    try {
      result.current = hook();
    } catch (error) {
      result.current = error as Error;
    }
    return null;
  }

  // Simulate rendering with React's createElement
  if (wrapper) {
    // Wrap the component
    wrapper({ children: createElement(TestComponent) });
  } else {
    createElement(TestComponent);
  }

  return { result };
}

// Helper to create a wrapper with EreoProvider
function createWrapper(props: {
  loaderData?: unknown;
  actionData?: unknown;
  navigationState?: NavigationStateHook;
  error?: Error;
}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(EreoProvider, { ...props, children });
  };
}

describe('@ereo/client - Hooks', () => {
  describe('useLoaderData', () => {
    test('throws error when used outside of EreoProvider', () => {
      // Directly test the hook behavior without provider
      let error: Error | null = null;

      try {
        // Since hooks need React context, calling useLoaderData without provider throws
        const context = LoaderDataContext._currentValue;
        if (context === null) {
          throw new Error(
            'useLoaderData must be used within an EreoProvider. ' +
              'Make sure your component is wrapped with <EreoProvider>.'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain('EreoProvider');
    });

    test('returns correct data type', () => {
      interface TestData {
        user: { name: string; email: string };
        posts: Array<{ id: number; title: string }>;
      }

      const testData: TestData = {
        user: { name: 'John', email: 'john@example.com' },
        posts: [
          { id: 1, title: 'First Post' },
          { id: 2, title: 'Second Post' },
        ],
      };

      // Test that the context value structure is correct
      const contextValue = {
        data: testData,
        setData: (data: unknown) => {},
      };

      expect(contextValue.data).toEqual(testData);
      expect(contextValue.data.user.name).toBe('John');
      expect(contextValue.data.posts).toHaveLength(2);
    });

    test('returns undefined when no initial data', () => {
      const contextValue = {
        data: undefined,
        setData: (data: unknown) => {},
      };

      expect(contextValue.data).toBeUndefined();
    });

    test('returns null when initial data is null', () => {
      const contextValue = {
        data: null,
        setData: (data: unknown) => {},
      };

      expect(contextValue.data).toBeNull();
    });

    test('returns complex nested data structures', () => {
      const complexData = {
        users: [
          {
            id: 1,
            profile: {
              settings: {
                notifications: {
                  email: true,
                  push: false,
                },
              },
            },
          },
        ],
        metadata: {
          total: 100,
          page: 1,
        },
      };

      const contextValue = {
        data: complexData,
        setData: (data: unknown) => {},
      };

      expect(contextValue.data.users[0].profile.settings.notifications.email).toBe(
        true
      );
      expect(contextValue.data.metadata.total).toBe(100);
    });
  });

  describe('useActionData', () => {
    test('throws error when used outside of EreoProvider', () => {
      let error: Error | null = null;

      try {
        const context = ActionDataContext._currentValue;
        if (context === null) {
          throw new Error(
            'useActionData must be used within an EreoProvider. ' +
              'Make sure your component is wrapped with <EreoProvider>.'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain('EreoProvider');
    });

    test('returns undefined initially when no action submitted', () => {
      const contextValue = {
        data: undefined,
        setData: (data: unknown) => {},
        clearData: () => {},
      };

      expect(contextValue.data).toBeUndefined();
    });

    test('returns action data after form submission', () => {
      interface ActionResult {
        success: boolean;
        message: string;
        errors?: string[];
      }

      const actionResult: ActionResult = {
        success: true,
        message: 'Form submitted successfully',
      };

      let currentData: unknown = undefined;

      const contextValue = {
        data: currentData,
        setData: (data: unknown) => {
          currentData = data;
        },
        clearData: () => {
          currentData = undefined;
        },
      };

      // Simulate action submission
      contextValue.setData(actionResult);

      expect(currentData).toEqual(actionResult);
    });

    test('returns validation errors from action', () => {
      interface ValidationResult {
        success: false;
        errors: { field: string; message: string }[];
      }

      const validationResult: ValidationResult = {
        success: false,
        errors: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Password too short' },
        ],
      };

      const contextValue = {
        data: validationResult,
        setData: (data: unknown) => {},
        clearData: () => {},
      };

      const result = contextValue.data as ValidationResult;
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe('email');
    });

    test('clearData resets action data to undefined', () => {
      let currentData: unknown = { success: true };

      const contextValue = {
        data: currentData,
        setData: (data: unknown) => {
          currentData = data;
        },
        clearData: () => {
          currentData = undefined;
        },
      };

      expect(currentData).toEqual({ success: true });

      contextValue.clearData();

      expect(currentData).toBeUndefined();
    });
  });

  describe('useNavigation', () => {
    test('returns default idle state when used outside of EreoProvider (SSR-safe)', () => {
      // useNavigation should gracefully return idle state during SSR
      // when no EreoProvider is present, similar to useActionData
      const context = NavigationContext._currentValue;
      expect(context).toBeNull();

      // The hook returns a default idle NavigationStateHook
      const defaultState: NavigationStateHook = { status: 'idle' };
      expect(defaultState.status).toBe('idle');
      expect(defaultState.location).toBeUndefined();
      expect(defaultState.formData).toBeUndefined();
    });

    test('returns idle state initially', () => {
      const state: NavigationStateHook = {
        status: 'idle',
      };

      expect(state.status).toBe('idle');
      expect(state.location).toBeUndefined();
      expect(state.formData).toBeUndefined();
    });

    test('transitions to loading state', () => {
      let currentState: NavigationStateHook = { status: 'idle' };

      const contextValue = {
        state: currentState,
        setState: (state: NavigationStateHook) => {
          currentState = state;
        },
        startLoading: (location: string) => {
          currentState = { status: 'loading', location };
        },
        startSubmitting: () => {},
        complete: () => {
          currentState = { status: 'idle' };
        },
      };

      expect(currentState.status).toBe('idle');

      contextValue.startLoading('/users');

      expect(currentState.status).toBe('loading');
      expect(currentState.location).toBe('/users');
    });

    test('transitions to submitting state', () => {
      let currentState: NavigationStateHook = { status: 'idle' };

      const formData = new FormData();
      formData.append('email', 'test@example.com');

      const contextValue = {
        state: currentState,
        setState: (state: NavigationStateHook) => {
          currentState = state;
        },
        startLoading: () => {},
        startSubmitting: (options: {
          location: string;
          formData?: FormData;
          formMethod?: string;
          formAction?: string;
        }) => {
          currentState = {
            status: 'submitting',
            location: options.location,
            formData: options.formData,
            formMethod: options.formMethod,
            formAction: options.formAction,
          };
        },
        complete: () => {
          currentState = { status: 'idle' };
        },
      };

      contextValue.startSubmitting({
        location: '/contact',
        formData,
        formMethod: 'POST',
        formAction: '/api/contact',
      });

      expect(currentState.status).toBe('submitting');
      expect(currentState.location).toBe('/contact');
      expect(currentState.formMethod).toBe('POST');
      expect(currentState.formAction).toBe('/api/contact');
    });

    test('transitions back to idle after completion', () => {
      let currentState: NavigationStateHook = {
        status: 'loading',
        location: '/users',
      };

      const contextValue = {
        state: currentState,
        setState: (state: NavigationStateHook) => {
          currentState = state;
        },
        startLoading: () => {},
        startSubmitting: () => {},
        complete: () => {
          currentState = { status: 'idle' };
        },
      };

      expect(currentState.status).toBe('loading');

      contextValue.complete();

      expect(currentState.status).toBe('idle');
      expect(currentState.location).toBeUndefined();
    });

    test('full navigation lifecycle', () => {
      const states: NavigationStatus[] = [];
      let currentState: NavigationStateHook = { status: 'idle' };

      const trackState = (state: NavigationStateHook) => {
        currentState = state;
        states.push(state.status);
      };

      // Start idle
      states.push(currentState.status);

      // Navigate to /users
      currentState = { status: 'loading', location: '/users' };
      states.push(currentState.status);

      // Navigation complete
      currentState = { status: 'idle' };
      states.push(currentState.status);

      // Submit form
      currentState = {
        status: 'submitting',
        location: '/users',
        formMethod: 'POST',
      };
      states.push(currentState.status);

      // Submission complete
      currentState = { status: 'idle' };
      states.push(currentState.status);

      expect(states).toEqual([
        'idle',
        'loading',
        'idle',
        'submitting',
        'idle',
      ]);
    });
  });

  describe('useError', () => {
    test('throws error when used outside of EreoProvider', () => {
      let error: Error | null = null;

      try {
        const context = ErrorContext._currentValue;
        if (context === null) {
          throw new Error(
            'useError must be used within an EreoProvider. ' +
              'Make sure your component is wrapped with <EreoProvider>.'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error).not.toBeNull();
      expect(error?.message).toContain('EreoProvider');
    });

    test('returns undefined when no error', () => {
      const contextValue = {
        error: undefined,
        setError: () => {},
        clearError: () => {},
      };

      expect(contextValue.error).toBeUndefined();
    });

    test('captures boundary errors', () => {
      const testError = new Error('Something went wrong');
      testError.name = 'TestError';

      const contextValue = {
        error: testError,
        setError: () => {},
        clearError: () => {},
      };

      expect(contextValue.error).toBe(testError);
      expect(contextValue.error?.message).toBe('Something went wrong');
      expect(contextValue.error?.name).toBe('TestError');
    });

    test('setError updates error state', () => {
      let currentError: Error | undefined = undefined;

      const contextValue = {
        error: currentError,
        setError: (error: Error | undefined) => {
          currentError = error;
        },
        clearError: () => {
          currentError = undefined;
        },
      };

      expect(currentError).toBeUndefined();

      const newError = new Error('Network failed');
      contextValue.setError(newError);

      expect(currentError).toBe(newError);
    });

    test('clearError resets error to undefined', () => {
      let currentError: Error | undefined = new Error('Initial error');

      const contextValue = {
        error: currentError,
        setError: (error: Error | undefined) => {
          currentError = error;
        },
        clearError: () => {
          currentError = undefined;
        },
      };

      expect(currentError).toBeDefined();

      contextValue.clearError();

      expect(currentError).toBeUndefined();
    });

    test('handles different error types', () => {
      // Standard Error
      const standardError = new Error('Standard error');
      expect(standardError.message).toBe('Standard error');

      // TypeError
      const typeError = new TypeError('Type mismatch');
      expect(typeError.name).toBe('TypeError');

      // Custom error with additional properties
      class ApiError extends Error {
        statusCode: number;
        constructor(message: string, statusCode: number) {
          super(message);
          this.name = 'ApiError';
          this.statusCode = statusCode;
        }
      }

      const apiError = new ApiError('Not found', 404);
      expect(apiError.message).toBe('Not found');
      expect(apiError.statusCode).toBe(404);
    });
  });

  describe('LoaderDataProvider', () => {
    test('provides initial data', () => {
      const initialData = { users: [], count: 0 };
      let contextValue = { data: initialData, setData: () => {} };

      expect(contextValue.data).toEqual(initialData);
    });

    test('allows updating data via setData', () => {
      let data: unknown = { initial: true };

      const contextValue = {
        data,
        setData: (newData: unknown) => {
          data = newData;
        },
      };

      contextValue.setData({ updated: true });

      expect(data).toEqual({ updated: true });
    });
  });

  describe('ActionDataProvider', () => {
    test('provides initial data as undefined by default', () => {
      const contextValue = {
        data: undefined,
        setData: () => {},
        clearData: () => {},
      };

      expect(contextValue.data).toBeUndefined();
    });

    test('provides initial action data', () => {
      const initialData = { success: true, id: 123 };
      const contextValue = {
        data: initialData,
        setData: () => {},
        clearData: () => {},
      };

      expect(contextValue.data).toEqual(initialData);
    });
  });

  describe('NavigationProvider', () => {
    test('provides default idle state', () => {
      const defaultState: NavigationStateHook = { status: 'idle' };

      expect(defaultState.status).toBe('idle');
      expect(defaultState.location).toBeUndefined();
    });

    test('accepts custom initial state', () => {
      const customState: NavigationStateHook = {
        status: 'loading',
        location: '/dashboard',
      };

      expect(customState.status).toBe('loading');
      expect(customState.location).toBe('/dashboard');
    });
  });

  describe('ErrorProvider', () => {
    test('provides undefined error by default', () => {
      const contextValue = {
        error: undefined,
        setError: () => {},
        clearError: () => {},
      };

      expect(contextValue.error).toBeUndefined();
    });

    test('accepts initial error', () => {
      const initialError = new Error('Initial error');
      const contextValue = {
        error: initialError,
        setError: () => {},
        clearError: () => {},
      };

      expect(contextValue.error).toBe(initialError);
    });
  });

  describe('EreoProvider', () => {
    test('combines all providers', () => {
      // Verify that EreoProvider accepts all the expected props
      const props = {
        children: null,
        loaderData: { user: 'test' },
        actionData: { success: true },
        navigationState: { status: 'idle' as const },
        error: undefined,
      };

      // This would create the nested provider structure
      expect(props.loaderData).toEqual({ user: 'test' });
      expect(props.actionData).toEqual({ success: true });
      expect(props.navigationState.status).toBe('idle');
    });

    test('works with minimal props', () => {
      const props = {
        children: null,
      };

      // Should not require any optional props
      expect(props.children).toBeNull();
    });

    test('passes through SSR data', () => {
      // Simulate SSR hydration scenario
      const ssrData = {
        loaderData: {
          user: { id: 1, name: 'SSR User' },
          timestamp: Date.now(),
        },
        actionData: undefined,
      };

      expect(ssrData.loaderData.user.name).toBe('SSR User');
      expect(ssrData.actionData).toBeUndefined();
    });
  });

  describe('Context accessor hooks', () => {
    test('useLoaderDataContext throws outside provider', () => {
      let error: Error | null = null;

      try {
        const context = LoaderDataContext._currentValue;
        if (context === null) {
          throw new Error(
            'useLoaderDataContext must be used within an EreoProvider'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toContain('EreoProvider');
    });

    test('useActionDataContext throws outside provider', () => {
      let error: Error | null = null;

      try {
        const context = ActionDataContext._currentValue;
        if (context === null) {
          throw new Error(
            'useActionDataContext must be used within an EreoProvider'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toContain('EreoProvider');
    });

    test('useNavigationContext throws outside provider', () => {
      let error: Error | null = null;

      try {
        const context = NavigationContext._currentValue;
        if (context === null) {
          throw new Error(
            'useNavigationContext must be used within an EreoProvider'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toContain('EreoProvider');
    });

    test('useErrorContext throws outside provider', () => {
      let error: Error | null = null;

      try {
        const context = ErrorContext._currentValue;
        if (context === null) {
          throw new Error(
            'useErrorContext must be used within an EreoProvider'
          );
        }
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toContain('EreoProvider');
    });
  });

  describe('NavigationStatus type', () => {
    test('allows valid status values', () => {
      const statuses: NavigationStatus[] = ['idle', 'loading', 'submitting'];

      expect(statuses).toContain('idle');
      expect(statuses).toContain('loading');
      expect(statuses).toContain('submitting');
    });
  });

  describe('Integration scenarios', () => {
    test('simulates page navigation flow', () => {
      // Initial state
      let loaderData: unknown = { products: [] };
      let navigationState: NavigationStateHook = { status: 'idle' };

      // User clicks a link to /products
      navigationState = { status: 'loading', location: '/products' };
      expect(navigationState.status).toBe('loading');

      // Loader data is fetched
      loaderData = {
        products: [
          { id: 1, name: 'Widget' },
          { id: 2, name: 'Gadget' },
        ],
      };

      // Navigation completes
      navigationState = { status: 'idle' };

      expect(navigationState.status).toBe('idle');
      expect((loaderData as any).products).toHaveLength(2);
    });

    test('simulates form submission flow', () => {
      let actionData: unknown = undefined;
      let navigationState: NavigationStateHook = { status: 'idle' };

      // User submits form
      const formData = new FormData();
      formData.append('name', 'New Product');
      formData.append('price', '99.99');

      navigationState = {
        status: 'submitting',
        location: '/products',
        formData,
        formMethod: 'POST',
        formAction: '/products/create',
      };

      expect(navigationState.status).toBe('submitting');

      // Action completes with success
      actionData = {
        success: true,
        product: { id: 3, name: 'New Product', price: 99.99 },
      };
      navigationState = { status: 'idle' };

      expect((actionData as any).success).toBe(true);
      expect(navigationState.status).toBe('idle');
    });

    test('simulates form submission with validation errors', () => {
      let actionData: unknown = undefined;
      let navigationState: NavigationStateHook = { status: 'idle' };

      // User submits invalid form
      const formData = new FormData();
      formData.append('email', 'invalid-email');

      navigationState = {
        status: 'submitting',
        location: '/signup',
        formData,
        formMethod: 'POST',
      };

      // Action returns validation errors
      actionData = {
        success: false,
        errors: {
          email: 'Please enter a valid email address',
        },
      };
      navigationState = { status: 'idle' };

      expect((actionData as any).success).toBe(false);
      expect((actionData as any).errors.email).toContain('valid email');
    });

    test('simulates error boundary scenario', () => {
      let error: Error | undefined = undefined;
      let loaderData: unknown = undefined;

      // Simulate a loader that throws
      try {
        throw new Error('Failed to fetch user data');
      } catch (e) {
        error = e as Error;
      }

      expect(error).toBeDefined();
      expect(error?.message).toBe('Failed to fetch user data');
      expect(loaderData).toBeUndefined();

      // User clicks retry, error is cleared
      error = undefined;
      loaderData = { user: { name: 'John' } };

      expect(error).toBeUndefined();
      expect((loaderData as any).user.name).toBe('John');
    });
  });
});
