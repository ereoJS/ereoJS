import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import React, { createElement, type ReactNode } from 'react';

// Import the module functions and classes
import {
  ErrorBoundary,
  RouteErrorBoundary,
  useErrorBoundary,
  useRouteError,
  isRouteErrorResponse,
  createRouteErrorResponse,
  withErrorBoundary,
  RouteError,
  type RouteErrorResponse,
  type ErrorBoundaryProps,
} from './error-boundary';
import { ErrorContext, type ErrorContextValue } from './hooks';

describe('@ereo/client - Error Boundary', () => {
  describe('ErrorBoundary Component', () => {
    test('ErrorBoundary class exists and is a React component', () => {
      expect(ErrorBoundary).toBeDefined();
      expect(typeof ErrorBoundary).toBe('function');
      // It should be a class component with prototype methods
      expect(ErrorBoundary.prototype).toBeDefined();
      expect(ErrorBoundary.prototype.render).toBeDefined();
      expect(ErrorBoundary.prototype.componentDidCatch).toBeDefined();
    });

    test('ErrorBoundary has getDerivedStateFromError static method', () => {
      expect(ErrorBoundary.getDerivedStateFromError).toBeDefined();
      expect(typeof ErrorBoundary.getDerivedStateFromError).toBe('function');
    });

    test('getDerivedStateFromError returns error state', () => {
      const error = new Error('Test error');
      const result = ErrorBoundary.getDerivedStateFromError(error);

      expect(result).toEqual({ error });
    });

    test('ErrorBoundary can be instantiated', () => {
      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Test'),
      };

      const instance = new ErrorBoundary(props);

      expect(instance).toBeDefined();
      expect(instance.state).toEqual({
        error: null,
        errorInfo: null,
      });
    });

    test('ErrorBoundary reset method clears error state', () => {
      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Test'),
      };

      const instance = new ErrorBoundary(props);

      // Simulate error state
      instance.state = {
        error: new Error('Test'),
        errorInfo: { componentStack: 'test stack' } as React.ErrorInfo,
      };

      // Call reset
      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;
      instance.reset();

      expect(mockSetState).toHaveBeenCalledWith({
        error: null,
        errorInfo: null,
      });
    });

    test('ErrorBoundary render returns children when no error', () => {
      const childElement = createElement('div', null, 'Child content');
      const props: ErrorBoundaryProps = {
        children: childElement,
      };

      const instance = new ErrorBoundary(props);
      const result = instance.render();

      expect(result).toBe(childElement);
    });

    test('ErrorBoundary render returns fallback when error exists and fallback is ReactNode', () => {
      const fallbackElement = createElement('div', null, 'Fallback');
      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Child'),
        fallback: fallbackElement,
      };

      const instance = new ErrorBoundary(props);
      instance.state = {
        error: new Error('Test error'),
        errorInfo: null,
      };

      const result = instance.render();

      expect(result).toBe(fallbackElement);
    });

    test('ErrorBoundary render calls fallback function when error exists', () => {
      const fallbackFn = mock((error: Error, reset: () => void) => {
        return createElement('div', null, `Error: ${error.message}`);
      });

      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Child'),
        fallback: fallbackFn,
      };

      const instance = new ErrorBoundary(props);
      const testError = new Error('Test error');
      instance.state = {
        error: testError,
        errorInfo: null,
      };

      instance.render();

      expect(fallbackFn).toHaveBeenCalledWith(testError, instance.reset);
    });

    test('ErrorBoundary componentDidCatch calls onError callback', () => {
      const onError = mock((error: Error, errorInfo: React.ErrorInfo) => {});
      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Child'),
        onError,
      };

      const instance = new ErrorBoundary(props);
      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;

      const testError = new Error('Test error');
      const testErrorInfo = { componentStack: 'test stack' } as React.ErrorInfo;

      instance.componentDidCatch(testError, testErrorInfo);

      expect(onError).toHaveBeenCalledWith(testError, testErrorInfo);
    });

    test('ErrorBoundary componentDidCatch sets errorInfo state', () => {
      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Child'),
      };

      const instance = new ErrorBoundary(props);
      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;

      const testErrorInfo = { componentStack: 'test stack' } as React.ErrorInfo;

      instance.componentDidCatch(new Error('Test'), testErrorInfo);

      expect(mockSetState).toHaveBeenCalledWith({ errorInfo: testErrorInfo });
    });

    test('ErrorBoundary renders default fallback when no fallback provided', () => {
      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Child'),
      };

      const instance = new ErrorBoundary(props);
      instance.state = {
        error: new Error('Test error message'),
        errorInfo: null,
      };

      const result = instance.render() as any;

      // Should return a div element
      expect(result.type).toBe('div');
      // Should have children (h2, p, button)
      expect(result.props.children).toBeDefined();
    });
  });

  describe('RouteErrorBoundary Component', () => {
    test('RouteErrorBoundary class exists', () => {
      expect(RouteErrorBoundary).toBeDefined();
      expect(typeof RouteErrorBoundary).toBe('function');
    });

    test('RouteErrorBoundary can be instantiated', () => {
      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
      };

      const instance = new RouteErrorBoundary(props);

      expect(instance).toBeDefined();
      expect(instance.state).toEqual({
        error: null,
        errorInfo: null,
        retryCount: 0,
      });
    });

    test('RouteErrorBoundary getDerivedStateFromError returns error state', () => {
      const error = new Error('Route error');
      const result = RouteErrorBoundary.getDerivedStateFromError(error);

      expect(result).toEqual({ error });
    });

    test('RouteErrorBoundary reset clears error state', () => {
      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
      };

      const instance = new RouteErrorBoundary(props);
      instance.state = {
        error: new Error('Test'),
        errorInfo: null,
        retryCount: 2,
      };

      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;

      instance.reset();

      expect(mockSetState).toHaveBeenCalledWith({
        error: null,
        errorInfo: null,
        retryCount: 0,
      });
    });

    test('RouteErrorBoundary componentDidCatch reports error', () => {
      const reportError = mock((error: Error, context: { route: string; phase: string }) => {});

      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
        errorConfig: { reportError },
      };

      const instance = new RouteErrorBoundary(props);
      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;

      const testError = new Error('Test error');
      const testErrorInfo = { componentStack: 'test stack' } as React.ErrorInfo;

      instance.componentDidCatch(testError, testErrorInfo);

      expect(reportError).toHaveBeenCalledWith(testError, {
        route: 'test-route',
        phase: 'render',
      });
    });

    test('RouteErrorBoundary renders fallback component when provided', () => {
      const FallbackComponent = ({ error, params }: { error: Error; params: any }) =>
        createElement('div', null, `Error: ${error.message}`);

      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
        fallbackComponent: FallbackComponent,
        params: { id: '123' },
      };

      const instance = new RouteErrorBoundary(props);
      const testError = new Error('Test error');
      instance.state = {
        error: testError,
        errorInfo: null,
        retryCount: 0,
      };

      const result = instance.render() as any;

      expect(result.type).toBe(FallbackComponent);
      expect(result.props.error).toBe(testError);
      expect(result.props.params).toEqual({ id: '123' });
    });

    test('RouteErrorBoundary shows max captures message', () => {
      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
        errorConfig: { maxCaptures: 2 },
      };

      const instance = new RouteErrorBoundary(props);
      instance.state = {
        error: new Error('Test error'),
        errorInfo: null,
        retryCount: 3, // Exceeds maxCaptures
      };

      const result = instance.render() as any;

      expect(result.type).toBe('div');
      expect(result.props.children).toBe('Error limit exceeded. Please refresh the page.');
    });
  });

  describe('useErrorBoundary Hook', () => {
    test('useErrorBoundary is a function', () => {
      expect(typeof useErrorBoundary).toBe('function');
    });

    test('useErrorBoundary function definition has correct shape', () => {
      // We can test the hook's function exists
      // Actual hook behavior needs to be tested within a React component
      expect(useErrorBoundary.length).toBe(0); // No required arguments
    });
  });

  describe('useRouteError Hook', () => {
    test('useRouteError is a function', () => {
      expect(typeof useRouteError).toBe('function');
    });

    test('useRouteError function definition has correct shape', () => {
      expect(useRouteError.length).toBe(0); // No required arguments
    });
  });

  describe('isRouteErrorResponse', () => {
    test('returns true for valid RouteErrorResponse', () => {
      const response: RouteErrorResponse = {
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Page not found' },
      };

      expect(isRouteErrorResponse(response)).toBe(true);
    });

    test('returns true for RouteErrorResponse with internal flag', () => {
      const response: RouteErrorResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        data: null,
        internal: true,
      };

      expect(isRouteErrorResponse(response)).toBe(true);
    });

    test('returns false for null', () => {
      expect(isRouteErrorResponse(null)).toBe(false);
    });

    test('returns false for undefined', () => {
      expect(isRouteErrorResponse(undefined)).toBe(false);
    });

    test('returns false for regular Error', () => {
      const error = new Error('Test error');
      expect(isRouteErrorResponse(error)).toBe(false);
    });

    test('returns false for object missing status', () => {
      const obj = {
        statusText: 'Not Found',
        data: null,
      };
      expect(isRouteErrorResponse(obj)).toBe(false);
    });

    test('returns false for object missing statusText', () => {
      const obj = {
        status: 404,
        data: null,
      };
      expect(isRouteErrorResponse(obj)).toBe(false);
    });

    test('returns false for object missing data', () => {
      const obj = {
        status: 404,
        statusText: 'Not Found',
      };
      expect(isRouteErrorResponse(obj)).toBe(false);
    });

    test('returns false for object with non-number status', () => {
      const obj = {
        status: '404',
        statusText: 'Not Found',
        data: null,
      };
      expect(isRouteErrorResponse(obj)).toBe(false);
    });

    test('returns false for object with non-string statusText', () => {
      const obj = {
        status: 404,
        statusText: 404,
        data: null,
      };
      expect(isRouteErrorResponse(obj)).toBe(false);
    });

    test('returns false for primitive values', () => {
      expect(isRouteErrorResponse('error')).toBe(false);
      expect(isRouteErrorResponse(123)).toBe(false);
      expect(isRouteErrorResponse(true)).toBe(false);
    });
  });

  describe('createRouteErrorResponse', () => {
    test('creates RouteErrorResponse with all parameters', () => {
      const response = createRouteErrorResponse(404, 'Not Found', { message: 'Page not found' });

      expect(response).toEqual({
        status: 404,
        statusText: 'Not Found',
        data: { message: 'Page not found' },
        internal: false,
      });
    });

    test('creates RouteErrorResponse with default data', () => {
      const response = createRouteErrorResponse(500, 'Internal Server Error');

      expect(response).toEqual({
        status: 500,
        statusText: 'Internal Server Error',
        data: null,
        internal: false,
      });
    });

    test('creates RouteErrorResponse that passes type guard', () => {
      const response = createRouteErrorResponse(403, 'Forbidden');

      expect(isRouteErrorResponse(response)).toBe(true);
    });
  });

  describe('withErrorBoundary HOC', () => {
    test('wraps component with ErrorBoundary', () => {
      const TestComponent = () => createElement('div', null, 'Test');
      TestComponent.displayName = 'TestComponent';

      const WrappedComponent = withErrorBoundary(TestComponent);

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)');
    });

    test('uses component name when displayName is not set', () => {
      function NamedComponent() {
        return createElement('div', null, 'Test');
      }

      const WrappedComponent = withErrorBoundary(NamedComponent);

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(NamedComponent)');
    });

    test('uses Component when name is not available', () => {
      const AnonymousComponent = () => createElement('div', null, 'Test');
      // Remove the name
      Object.defineProperty(AnonymousComponent, 'name', { value: '' });

      const WrappedComponent = withErrorBoundary(AnonymousComponent);

      expect(WrappedComponent.displayName).toBe('withErrorBoundary(Component)');
    });

    test('passes errorBoundaryProps to ErrorBoundary', () => {
      const TestComponent = () => createElement('div', null, 'Test');
      const onError = mock(() => {});
      const fallback = createElement('div', null, 'Fallback');

      const WrappedComponent = withErrorBoundary(TestComponent, {
        fallback,
        onError,
      });

      // The wrapped component should be callable and return a React element
      const result = WrappedComponent({}) as any;

      expect(result.type).toBe(ErrorBoundary);
      expect(result.props.fallback).toBe(fallback);
      expect(result.props.onError).toBe(onError);
    });

    test('passes props to wrapped component', () => {
      const TestComponent = (props: { name: string }) => createElement('div', null, props.name);

      const WrappedComponent = withErrorBoundary(TestComponent);
      const result = WrappedComponent({ name: 'Test Name' }) as any;

      // The ErrorBoundary should have children that is the TestComponent with props
      expect(result.props.children.type).toBe(TestComponent);
      expect(result.props.children.props.name).toBe('Test Name');
    });
  });

  describe('RouteError Class', () => {
    test('creates RouteError with all parameters', () => {
      const error = new RouteError(404, 'Not Found', { resource: 'post' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RouteError);
      expect(error.status).toBe(404);
      expect(error.statusText).toBe('Not Found');
      expect(error.data).toEqual({ resource: 'post' });
      expect(error.message).toBe('404 Not Found');
      expect(error.name).toBe('RouteError');
    });

    test('creates RouteError with undefined data', () => {
      const error = new RouteError(500, 'Internal Server Error');

      expect(error.status).toBe(500);
      expect(error.statusText).toBe('Internal Server Error');
      expect(error.data).toBeUndefined();
    });

    test('RouteError toResponse returns RouteErrorResponse', () => {
      const error = new RouteError(403, 'Forbidden', { reason: 'No access' });
      const response = error.toResponse();

      expect(response).toEqual({
        status: 403,
        statusText: 'Forbidden',
        data: { reason: 'No access' },
      });
    });

    test('RouteError toResponse result passes type guard', () => {
      const error = new RouteError(401, 'Unauthorized');
      const response = error.toResponse();

      expect(isRouteErrorResponse(response)).toBe(true);
    });

    test('RouteError can be thrown and caught', () => {
      const throwError = () => {
        throw new RouteError(404, 'Not Found');
      };

      expect(throwError).toThrow(RouteError);
      expect(throwError).toThrow('404 Not Found');
    });

    test('RouteError inherits from Error prototype chain', () => {
      const error = new RouteError(500, 'Server Error');

      expect(error instanceof Error).toBe(true);
      expect(error.stack).toBeDefined();
    });
  });

  describe('Integration scenarios', () => {
    test('ErrorBoundary with function fallback receives reset function', () => {
      let receivedReset: (() => void) | null = null;

      const fallbackFn = (error: Error, reset: () => void) => {
        receivedReset = reset;
        return createElement('div', null, 'Error');
      };

      const props: ErrorBoundaryProps = {
        children: createElement('div', null, 'Child'),
        fallback: fallbackFn,
      };

      const instance = new ErrorBoundary(props);
      instance.state = {
        error: new Error('Test'),
        errorInfo: null,
      };

      instance.render();

      // The reset function should be the instance method
      expect(receivedReset).toBe(instance.reset);
    });

    test('RouteErrorBoundary handles silent error mode', () => {
      const originalConsoleError = console.error;
      const errorLogs: any[] = [];
      console.error = (...args: any[]) => errorLogs.push(args);

      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
        errorConfig: { onError: 'silent' as const },
      };

      const instance = new RouteErrorBoundary(props);
      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;

      const testError = new Error('Silent error');
      instance.componentDidCatch(testError, { componentStack: '' } as React.ErrorInfo);

      expect(errorLogs.some((log) => log[0].includes('[Route test-route] Error:'))).toBe(true);

      console.error = originalConsoleError;
    });

    test('RouteErrorBoundary handles toast error mode', () => {
      const originalConsoleError = console.error;
      const errorLogs: any[] = [];
      console.error = (...args: any[]) => errorLogs.push(args);

      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
        errorConfig: { onError: 'toast' as const },
      };

      const instance = new RouteErrorBoundary(props);
      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;

      instance.componentDidCatch(new Error('Toast error'), { componentStack: '' } as React.ErrorInfo);

      expect(errorLogs.some((log) => log[0].includes('toast mode'))).toBe(true);

      console.error = originalConsoleError;
    });

    test('RouteErrorBoundary handles redirect error mode', () => {
      const originalConsoleError = console.error;
      const errorLogs: any[] = [];
      console.error = (...args: any[]) => errorLogs.push(args);

      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
        errorConfig: { onError: 'redirect' as const },
      };

      const instance = new RouteErrorBoundary(props);
      const mockSetState = mock(() => {});
      instance.setState = mockSetState as any;

      instance.componentDidCatch(new Error('Redirect error'), { componentStack: '' } as React.ErrorInfo);

      expect(errorLogs.some((log) => log[0].includes('redirect mode'))).toBe(true);

      console.error = originalConsoleError;
    });

    test('RouteErrorBoundary renders default UI when no fallback', () => {
      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
      };

      const instance = new RouteErrorBoundary(props);
      instance.state = {
        error: new Error('Test error'),
        errorInfo: null,
        retryCount: 0,
      };

      const result = instance.render() as any;

      expect(result.type).toBe('div');
      // Should contain the error UI with Route Error heading
      expect(result.props.children).toBeDefined();
    });

    test('RouteErrorBoundary uses errorConfig.fallback when provided', () => {
      const FallbackComponent = () => createElement('div', null, 'Config Fallback');

      const props = {
        routeId: 'test-route',
        children: createElement('div', null, 'Test'),
        errorConfig: { fallback: FallbackComponent },
      };

      const instance = new RouteErrorBoundary(props);
      instance.state = {
        error: new Error('Test error'),
        errorInfo: null,
        retryCount: 0,
      };

      const result = instance.render() as any;

      expect(result.type).toBe(FallbackComponent);
    });

    test('RouteErrorBoundary renders children when no error', () => {
      const childElement = createElement('div', null, 'Child content');
      const props = {
        routeId: 'test-route',
        children: childElement,
      };

      const instance = new RouteErrorBoundary(props);
      const result = instance.render();

      expect(result).toBe(childElement);
    });
  });

  describe('ErrorContext', () => {
    test('ErrorContext exists and is importable', () => {
      expect(ErrorContext).toBeDefined();
    });

    test('ErrorContext is a React context', () => {
      // React contexts have Provider and Consumer properties
      expect(ErrorContext.Provider).toBeDefined();
      expect(ErrorContext.Consumer).toBeDefined();
    });
  });
});
