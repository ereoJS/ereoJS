/**
 * @ereo/client - Form Component with Progressive Enhancement
 *
 * Form handling that works without JavaScript (progressive enhancement)
 * and enhances with client-side submission when JS is available.
 */

import { createElement, useCallback, useRef, useState, useEffect, useContext, createContext } from 'react';
import type { FormHTMLAttributes, ReactNode, FormEvent, RefObject } from 'react';
import { router, submitAction } from './navigation';
import type { NavigationState } from './navigation';

// ============================================================================
// Types
// ============================================================================

/**
 * Result from a form action submission.
 */
export interface ActionResult<T = unknown> {
  data?: T;
  error?: Error;
  status: number;
  ok: boolean;
}

/**
 * Submission state for tracking form submissions.
 */
export type SubmissionState = 'idle' | 'submitting' | 'loading' | 'error';

/**
 * Form props extending standard HTML form attributes.
 */
export interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'method' | 'action' | 'encType'> {
  /** HTTP method - defaults to POST */
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Action URL - defaults to current route */
  action?: string;
  /** Called when submission starts */
  onSubmitStart?: () => void;
  /** Called when submission completes */
  onSubmitEnd?: (result: ActionResult) => void;
  /** Replace history instead of push */
  replace?: boolean;
  /** Prevent scroll reset after navigation */
  preventScrollReset?: boolean;
  /** Encoding type */
  encType?: 'application/x-www-form-urlencoded' | 'multipart/form-data';
  /** Fetch options for the request */
  fetcherKey?: string;
  /** Form children */
  children?: ReactNode;
}

/**
 * Submit options for programmatic submission.
 */
export interface SubmitOptions {
  /** HTTP method - defaults to POST */
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Action URL - defaults to current route */
  action?: string;
  /** Replace history instead of push */
  replace?: boolean;
  /** Prevent scroll reset after navigation */
  preventScrollReset?: boolean;
  /** Encoding type */
  encType?: 'application/x-www-form-urlencoded' | 'multipart/form-data';
  /** Fetch options for the request */
  fetcherKey?: string;
}

/**
 * Fetcher state for non-navigation submissions.
 */
export interface FetcherState<T = unknown> {
  state: SubmissionState;
  data?: T;
  error?: Error;
  formData?: FormData;
  formMethod?: string;
  formAction?: string;
}

/**
 * Fetcher hook return type.
 */
export interface Fetcher<T = unknown> extends FetcherState<T> {
  /** Form component for the fetcher */
  Form: (props: Omit<FormProps, 'fetcherKey'>) => ReturnType<typeof createElement>;
  /** Submit function for programmatic submission */
  submit: (
    target: HTMLFormElement | FormData | URLSearchParams | Record<string, string>,
    options?: SubmitOptions
  ) => Promise<void>;
  /** Load data from an action */
  load: (href: string) => Promise<void>;
  /** Reset fetcher state */
  reset: () => void;
}

// ============================================================================
// Form Context
// ============================================================================

export interface FormContextValue {
  /** Current action data from the last submission */
  actionData: unknown;
  /** Current submission state */
  state: SubmissionState;
  /** Update action data */
  setActionData: (data: unknown) => void;
  /** Update submission state */
  setState: (state: SubmissionState) => void;
}

const FormContext = createContext<FormContextValue | null>(null);

/**
 * Form context provider for managing form state.
 */
export function FormProvider({
  children,
  initialActionData,
}: {
  children: ReactNode;
  initialActionData?: unknown;
}) {
  const [actionData, setActionData] = useState<unknown>(initialActionData);
  const [state, setState] = useState<SubmissionState>('idle');

  return createElement(
    FormContext.Provider,
    { value: { actionData, state, setActionData, setState } },
    children
  );
}

/**
 * Hook to access form context.
 */
export function useFormContext(): FormContextValue | null {
  return useContext(FormContext);
}

// ============================================================================
// Form Component
// ============================================================================

/**
 * Form component with progressive enhancement.
 * Works without JavaScript as a standard HTML form.
 * With JavaScript, intercepts submission and uses fetch.
 */
export function Form({
  method = 'post',
  action,
  onSubmitStart,
  onSubmitEnd,
  replace = false,
  preventScrollReset = false,
  encType = 'application/x-www-form-urlencoded',
  fetcherKey,
  children,
  onSubmit,
  ...props
}: FormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const formContext = useFormContext();

  // Get the action URL, defaulting to current path
  // In SSR context, use empty string which means "submit to current URL" in HTML
  // On the client, use the current pathname
  const resolvedAction = action ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  // Handle form submission with JavaScript
  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      // Call custom onSubmit if provided
      if (onSubmit) {
        onSubmit(event);
        if (event.defaultPrevented) {
          return;
        }
      }

      // Only enhance if JavaScript is available
      if (typeof window === 'undefined') {
        return;
      }

      // Prevent default form submission
      event.preventDefault();

      // Get form data
      const form = event.currentTarget;
      const formData = new FormData(form);

      // Update submission state
      if (formContext) {
        formContext.setState('submitting');
      }

      // Call onSubmitStart callback
      if (onSubmitStart) {
        onSubmitStart();
      }

      try {
        // Convert FormData based on encType
        let body: FormData | URLSearchParams;
        if (encType === 'application/x-www-form-urlencoded') {
          body = new URLSearchParams();
          formData.forEach((value, key) => {
            if (typeof value === 'string') {
              (body as URLSearchParams).append(key, value);
            }
          });
        } else {
          body = formData;
        }

        // Handle GET method differently
        if (method.toLowerCase() === 'get') {
          const url = new URL(resolvedAction, window.location.origin);
          const params = new URLSearchParams();
          formData.forEach((value, key) => {
            if (typeof value === 'string') {
              params.append(key, value);
            }
          });
          url.search = params.toString();

          // Navigate to the URL
          await router.navigate(url.pathname + url.search, { replace });

          const result: ActionResult = {
            status: 200,
            ok: true,
          };

          if (formContext) {
            formContext.setState('idle');
          }

          if (onSubmitEnd) {
            onSubmitEnd(result);
          }
          return;
        }

        // Submit the action
        const response = await fetch(resolvedAction, {
          method: method.toUpperCase(),
          body,
          headers: {
            Accept: 'application/json',
            ...(encType === 'application/x-www-form-urlencoded' && {
              'Content-Type': 'application/x-www-form-urlencoded',
            }),
          },
        });

        const result: ActionResult = {
          status: response.status,
          ok: response.ok,
        };

        // Parse response
        try {
          const data = await response.json();
          result.data = data;

          // Update action data in context
          if (formContext) {
            formContext.setActionData(data);
          }
        } catch {
          // Response may not be JSON
        }

        // Handle navigation if needed
        if (response.ok && !fetcherKey) {
          // Check for redirect
          const redirectUrl = response.headers.get('X-Redirect-Url');
          if (redirectUrl) {
            await router.navigate(redirectUrl, { replace });
          } else if (!preventScrollReset && typeof window !== 'undefined') {
            window.scrollTo(0, 0);
          }
        }

        if (formContext) {
          formContext.setState('idle');
        }

        if (onSubmitEnd) {
          onSubmitEnd(result);
        }
      } catch (error) {
        const result: ActionResult = {
          error: error instanceof Error ? error : new Error(String(error)),
          status: 0,
          ok: false,
        };

        if (formContext) {
          formContext.setState('error');
        }

        if (onSubmitEnd) {
          onSubmitEnd(result);
        }
      }
    },
    [method, resolvedAction, onSubmitStart, onSubmitEnd, replace, preventScrollReset, encType, fetcherKey, formContext, onSubmit]
  );

  // Map method to standard form method for progressive enhancement
  // Browsers only support GET and POST natively
  const formMethod = method.toLowerCase() === 'get' ? 'get' : 'post';

  return createElement(
    'form',
    {
      ref: formRef,
      method: formMethod,
      action: resolvedAction,
      encType,
      onSubmit: handleSubmit,
      // Add hidden input for non-standard methods
      ...props,
    },
    // For non-standard HTTP methods, add a hidden input
    method !== 'get' && method !== 'post'
      ? createElement('input', {
          type: 'hidden',
          name: '_method',
          value: method.toUpperCase(),
        })
      : null,
    children
  );
}

// ============================================================================
// useSubmit Hook
// ============================================================================

/**
 * Hook for programmatic form submission.
 * Returns a submit function that can be called with form data.
 */
export function useSubmit(): (
  target: HTMLFormElement | FormData | URLSearchParams | Record<string, string>,
  options?: SubmitOptions
) => Promise<ActionResult> {
  const formContext = useFormContext();

  const submit = useCallback(
    async (
      target: HTMLFormElement | FormData | URLSearchParams | Record<string, string>,
      options: SubmitOptions = {}
    ): Promise<ActionResult> => {
      const {
        method = 'post',
        action,
        replace = false,
        preventScrollReset = false,
        encType = 'application/x-www-form-urlencoded',
        fetcherKey,
      } = options;

      if (typeof window === 'undefined') {
        return { status: 0, ok: false, error: new Error('Not in browser environment') };
      }

      // Resolve action URL
      const resolvedAction = action || window.location.pathname;

      // Convert target to FormData
      let formData: FormData;
      if (target instanceof HTMLFormElement) {
        formData = new FormData(target);
      } else if (target instanceof FormData) {
        formData = target;
      } else if (target instanceof URLSearchParams) {
        formData = new FormData();
        target.forEach((value, key) => {
          formData.append(key, value);
        });
      } else {
        formData = new FormData();
        for (const [key, value] of Object.entries(target)) {
          formData.append(key, value);
        }
      }

      // Update submission state
      if (formContext) {
        formContext.setState('submitting');
      }

      try {
        // Handle GET method
        if (method.toLowerCase() === 'get') {
          const url = new URL(resolvedAction, window.location.origin);
          const params = new URLSearchParams();
          formData.forEach((value, key) => {
            if (typeof value === 'string') {
              params.append(key, value);
            }
          });
          url.search = params.toString();

          await router.navigate(url.pathname + url.search, { replace });

          if (formContext) {
            formContext.setState('idle');
          }

          return { status: 200, ok: true };
        }

        // Convert FormData based on encType
        let body: FormData | URLSearchParams;
        if (encType === 'application/x-www-form-urlencoded') {
          body = new URLSearchParams();
          formData.forEach((value, key) => {
            if (typeof value === 'string') {
              (body as URLSearchParams).append(key, value);
            }
          });
        } else {
          body = formData;
        }

        // Submit the action
        const response = await fetch(resolvedAction, {
          method: method.toUpperCase(),
          body,
          headers: {
            Accept: 'application/json',
            ...(encType === 'application/x-www-form-urlencoded' && {
              'Content-Type': 'application/x-www-form-urlencoded',
            }),
          },
        });

        const result: ActionResult = {
          status: response.status,
          ok: response.ok,
        };

        try {
          const data = await response.json();
          result.data = data;

          if (formContext) {
            formContext.setActionData(data);
          }
        } catch {
          // Response may not be JSON
        }

        // Handle navigation
        if (response.ok && !fetcherKey) {
          const redirectUrl = response.headers.get('X-Redirect-Url');
          if (redirectUrl) {
            await router.navigate(redirectUrl, { replace });
          } else if (!preventScrollReset) {
            window.scrollTo(0, 0);
          }
        }

        if (formContext) {
          formContext.setState('idle');
        }

        return result;
      } catch (error) {
        const result: ActionResult = {
          error: error instanceof Error ? error : new Error(String(error)),
          status: 0,
          ok: false,
        };

        if (formContext) {
          formContext.setState('error');
        }

        return result;
      }
    },
    [formContext]
  );

  return submit;
}

// ============================================================================
// useFetcher Hook
// ============================================================================

/**
 * Hook for non-navigation form submissions.
 * Useful for inline updates that don't require page navigation.
 */
export function useFetcher<T = unknown>(key?: string): Fetcher<T> {
  const [state, setStateInternal] = useState<SubmissionState>('idle');
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [formData, setFormData] = useState<FormData | undefined>(undefined);
  const [formMethod, setFormMethod] = useState<string | undefined>(undefined);
  const [formAction, setFormAction] = useState<string | undefined>(undefined);

  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback((newState: SubmissionState) => {
    if (mountedRef.current) {
      setStateInternal(newState);
    }
  }, []);

  const reset = useCallback(() => {
    if (mountedRef.current) {
      setStateInternal('idle');
      setData(undefined);
      setError(undefined);
      setFormData(undefined);
      setFormMethod(undefined);
      setFormAction(undefined);
    }
  }, []);

  const submit = useCallback(
    async (
      target: HTMLFormElement | FormData | URLSearchParams | Record<string, string>,
      options: SubmitOptions = {}
    ): Promise<void> => {
      const {
        method = 'post',
        action,
        encType = 'application/x-www-form-urlencoded',
      } = options;

      if (typeof window === 'undefined') {
        return;
      }

      const resolvedAction = action || window.location.pathname;

      // Convert target to FormData
      let newFormData: FormData;
      if (target instanceof HTMLFormElement) {
        newFormData = new FormData(target);
      } else if (target instanceof FormData) {
        newFormData = target;
      } else if (target instanceof URLSearchParams) {
        newFormData = new FormData();
        target.forEach((value, key) => {
          newFormData.append(key, value);
        });
      } else {
        newFormData = new FormData();
        for (const [key, value] of Object.entries(target)) {
          newFormData.append(key, value);
        }
      }

      setFormData(newFormData);
      setFormMethod(method.toUpperCase());
      setFormAction(resolvedAction);
      safeSetState('submitting');

      try {
        // Handle GET method
        if (method.toLowerCase() === 'get') {
          const url = new URL(resolvedAction, window.location.origin);
          const params = new URLSearchParams();
          newFormData.forEach((value, key) => {
            if (typeof value === 'string') {
              params.append(key, value);
            }
          });
          url.search = params.toString();

          const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });

          if (mountedRef.current) {
            try {
              const responseData = await response.json();
              setData(responseData as T);
            } catch {
              // Response may not be JSON
            }
            safeSetState('idle');
          }
          return;
        }

        // Convert FormData based on encType
        let body: FormData | URLSearchParams;
        if (encType === 'application/x-www-form-urlencoded') {
          body = new URLSearchParams();
          newFormData.forEach((value, key) => {
            if (typeof value === 'string') {
              (body as URLSearchParams).append(key, value);
            }
          });
        } else {
          body = newFormData;
        }

        const response = await fetch(resolvedAction, {
          method: method.toUpperCase(),
          body,
          headers: {
            Accept: 'application/json',
            ...(encType === 'application/x-www-form-urlencoded' && {
              'Content-Type': 'application/x-www-form-urlencoded',
            }),
          },
        });

        if (mountedRef.current) {
          try {
            const responseData = await response.json();
            setData(responseData as T);
          } catch {
            // Response may not be JSON
          }
          safeSetState('idle');
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          safeSetState('error');
        }
      }
    },
    [safeSetState]
  );

  const load = useCallback(
    async (href: string): Promise<void> => {
      if (typeof window === 'undefined') {
        return;
      }

      setFormAction(href);
      setFormMethod('GET');
      safeSetState('loading');

      try {
        const response = await fetch(href, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });

        if (mountedRef.current) {
          try {
            const responseData = await response.json();
            setData(responseData as T);
          } catch {
            // Response may not be JSON
          }
          safeSetState('idle');
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          safeSetState('error');
        }
      }
    },
    [safeSetState]
  );

  // Create fetcher Form component
  const FetcherForm = useCallback(
    (formProps: Omit<FormProps, 'fetcherKey'>) => {
      return Form({
        ...formProps,
        fetcherKey: key || 'fetcher',
        onSubmitStart: () => {
          safeSetState('submitting');
          if (formProps.onSubmitStart) {
            formProps.onSubmitStart();
          }
        },
        onSubmitEnd: (result) => {
          if (mountedRef.current) {
            if (result.ok) {
              setData(result.data as T);
              safeSetState('idle');
            } else {
              setError(result.error);
              safeSetState('error');
            }
          }
          if (formProps.onSubmitEnd) {
            formProps.onSubmitEnd(result);
          }
        },
      });
    },
    [key, safeSetState]
  );

  return {
    state,
    data,
    error,
    formData,
    formMethod,
    formAction,
    Form: FetcherForm,
    submit,
    load,
    reset,
  };
}

// ============================================================================
// useActionData Hook
// ============================================================================

/**
 * Hook to access the action data from the last form submission.
 */
export function useActionData<T = unknown>(): T | undefined {
  const context = useFormContext();
  return context?.actionData as T | undefined;
}

// ============================================================================
// useNavigation Hook (Form-aware)
// ============================================================================

/**
 * Navigation state extended with form submission info.
 */
export interface FormNavigationState extends NavigationState {
  /** Current navigation/submission state */
  state: SubmissionState;
  /** Form data being submitted */
  formData?: FormData;
  /** Form method being used */
  formMethod?: string;
  /** Form action URL */
  formAction?: string;
}

/**
 * Hook to get the current navigation state including form submission state.
 */
export function useNavigation(): FormNavigationState {
  const [navigationState, setNavigationState] = useState<NavigationState>(() => {
    if (typeof window === 'undefined') {
      return { pathname: '/', search: '', hash: '' };
    }
    return router.getState();
  });

  const formContext = useFormContext();

  useEffect(() => {
    return router.subscribe((event) => {
      setNavigationState(event.to);
    });
  }, []);

  return {
    ...navigationState,
    state: formContext?.state || 'idle',
  };
}

// ============================================================================
// Form Utility Functions
// ============================================================================

/**
 * Serialize form data to URL-encoded string.
 */
export function serializeFormData(formData: FormData): string {
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      params.append(key, value);
    }
  });
  return params.toString();
}

/**
 * Parse URL-encoded string to FormData.
 */
export function parseFormData(data: string): FormData {
  const formData = new FormData();
  const params = new URLSearchParams(data);
  params.forEach((value, key) => {
    formData.append(key, value);
  });
  return formData;
}

/**
 * Convert FormData to a plain object.
 */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      if (key in result) {
        const existing = result[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[key] = [existing, value];
        }
      } else {
        result[key] = value;
      }
    }
  });
  return result;
}

/**
 * Convert a plain object to FormData.
 */
export function objectToFormData(obj: Record<string, string | string[] | number | boolean>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      value.forEach((v) => formData.append(key, String(v)));
    } else {
      formData.append(key, String(value));
    }
  }
  return formData;
}
