import { createElement, useCallback, useRef, useEffect, useState } from 'react';
import { batch } from '@ereo/state';
import type { ReactNode, FormEvent, ReactElement } from 'react';
import type {
  ActionResult,
  FormStoreInterface,
  ValidationSchema,
  FormSubmitState,
} from './types';
import { formDataToObject } from './schema';
import { focusFirstError, announceErrors, announceSubmitStatus } from './a11y';
import { flattenToPaths } from './utils';

// ─── createFormAction ────────────────────────────────────────────────────────

export interface CreateFormActionOptions<T, TResult = unknown> {
  schema?: ValidationSchema<unknown, T>;
  handler: (values: T) => Promise<TResult>;
  onError?: (error: unknown) => ActionResult<TResult>;
}

export function createFormAction<T, TResult = unknown>(
  opts: CreateFormActionOptions<T, TResult>
): (request: Request) => Promise<ActionResult<TResult>> {
  return async (request: Request): Promise<ActionResult<TResult>> => {
    try {
      const contentType = request.headers.get('Content-Type') || '';
      let raw: unknown;

      if (contentType.includes('application/json')) {
        raw = await request.json();
      } else if (
        contentType.includes('multipart/form-data') ||
        contentType.includes('application/x-www-form-urlencoded')
      ) {
        const formData = await request.formData();
        raw = formDataToObject(formData);
      } else {
        try {
          const text = await request.text();
          raw = JSON.parse(text);
        } catch {
          return { success: false, errors: { '': ['Invalid request body'] } };
        }
      }

      // Schema validation
      let values: T;
      if (opts.schema) {
        if (opts.schema.safeParse) {
          const result = opts.schema.safeParse(raw);
          if (!result.success) {
            const errors: Record<string, string[]> = {};
            for (const issue of result.error.issues) {
              const path = issue.path.join('.');
              if (!errors[path]) errors[path] = [];
              errors[path].push(issue.message);
            }
            return { success: false, errors };
          }
          values = result.data;
        } else {
          try {
            values = opts.schema.parse(raw);
          } catch (e: any) {
            if (e?.issues) {
              const errors: Record<string, string[]> = {};
              for (const issue of e.issues) {
                const path = issue.path?.join('.') ?? '';
                if (!errors[path]) errors[path] = [];
                errors[path].push(issue.message);
              }
              return { success: false, errors };
            }
            return { success: false, errors: { '': [e?.message ?? 'Validation failed'] } };
          }
        }
      } else {
        values = raw as T;
      }

      const data = await opts.handler(values);
      return { success: true, data };
    } catch (error) {
      if (opts.onError) {
        return opts.onError(error);
      }
      return {
        success: false,
        errors: { '': [error instanceof Error ? error.message : 'Server error'] },
      };
    }
  };
}

// ─── ActionForm Component ────────────────────────────────────────────────────

export interface ActionFormProps<T extends Record<string, any>> {
  form: FormStoreInterface<T>;
  action: string | ((values: T) => Promise<ActionResult>);
  method?: 'post' | 'put' | 'patch' | 'delete';
  onSuccess?: (result: any) => void;
  onError?: (errors: Record<string, string[]>) => void;
  children: ReactNode;
  className?: string;
  id?: string;
  encType?: 'application/json' | 'multipart/form-data';
}

export function ActionForm<T extends Record<string, any>>(
  props: ActionFormProps<T>
): ReactElement {
  const {
    form,
    action,
    method = 'post',
    onSuccess,
    onError,
    children,
    className,
    id,
    encType = 'application/json',
  } = props;

  const abortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Abort any in-flight submission
      abortRef.current?.abort();

      const generation = ++generationRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      // Client-side validation only (don't trigger form's onSubmit handler)
      const valid = await form.validate();

      if (generation !== generationRef.current) return;

      if (!valid) {
        focusFirstError(form);
        announceErrors({}, { prefix: 'Please fix the following errors:' });
        return;
      }

      const values = form.getValues();

      batch(() => {
        form.isSubmitting.set(true);
        form.submitState.set('submitting');
      });
      announceSubmitStatus('submitting');

      try {
        let result: ActionResult;

        if (typeof action === 'function') {
          result = await action(values);
        } else {
          const isMultipart = encType === 'multipart/form-data';
          const response = await fetch(action, {
            method: method.toUpperCase(),
            headers: isMultipart
              ? undefined
              : { 'Content-Type': 'application/json' },
            body: isMultipart
              ? form.toFormData()
              : JSON.stringify(values),
            signal: controller.signal,
          });
          result = await response.json();
        }

        // Check if superseded
        if (generation !== generationRef.current) return;

        if (result.success) {
          batch(() => {
            form.isSubmitting.set(false);
            form.submitState.set('success');
            form.submitCount.update((c: number) => c + 1);
          });
          announceSubmitStatus('success');
          onSuccess?.(result.data);
        } else {
          batch(() => {
            form.isSubmitting.set(false);
            form.submitState.set('error');
          });
          announceSubmitStatus('error');

          // Auto-map server errors to fields
          if (result.errors) {
            for (const [path, errors] of Object.entries(result.errors)) {
              if (path) {
                form.setErrors(path, errors);
              } else {
                form.setFormErrors(errors);
              }
            }
            focusFirstError(form);
            announceErrors(result.errors);
            onError?.(result.errors);
          }
        }
      } catch (error) {
        if (generation !== generationRef.current || controller.signal.aborted) return;
        batch(() => {
          form.isSubmitting.set(false);
          form.submitState.set('error');
        });
        announceSubmitStatus('error');
        const errorMsg = error instanceof Error ? error.message : 'Submission failed';
        form.setFormErrors([errorMsg]);
        onError?.({ '': [errorMsg] });
      }
    },
    [form, action, method, encType, onSuccess, onError]
  );

  // Render as native <form> for progressive enhancement
  return createElement(
    'form',
    {
      id,
      className,
      method,
      action: typeof action === 'string' ? action : undefined,
      onSubmit: handleSubmit,
      noValidate: true, // We handle validation ourselves
    },
    children
  );
}

// ─── useFormAction ───────────────────────────────────────────────────────────

export interface UseFormActionOptions<T, TResult = unknown> {
  action: string | ((values: T) => Promise<ActionResult<TResult>>);
  method?: string;
  encType?: 'application/json' | 'multipart/form-data';
}

export function useFormAction<T, TResult = unknown>(
  opts: UseFormActionOptions<T, TResult>
): {
  submit: (values: T) => Promise<ActionResult<TResult>>;
  cancel: () => void;
  isSubmitting: boolean;
  result: ActionResult<TResult> | null;
} {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult<TResult> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsSubmitting(false);
  }, []);

  const submit = useCallback(
    async (values: T): Promise<ActionResult<TResult>> => {
      cancel();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSubmitting(true);

      try {
        let actionResult: ActionResult<TResult>;

        if (typeof opts.action === 'function') {
          actionResult = await opts.action(values);
        } else {
          const isMultipart = opts.encType === 'multipart/form-data';
          const response = await fetch(opts.action, {
            method: (opts.method ?? 'POST').toUpperCase(),
            headers: isMultipart
              ? undefined
              : { 'Content-Type': 'application/json' },
            body: isMultipart
              ? objectToFormData(values)
              : JSON.stringify(values),
            signal: controller.signal,
          });
          actionResult = await response.json();
        }

        if (!controller.signal.aborted) {
          setResult(actionResult);
          setIsSubmitting(false);
        }

        return actionResult;
      } catch (error) {
        if (!controller.signal.aborted) {
          const errorResult: ActionResult<TResult> = {
            success: false,
            errors: {
              '': [error instanceof Error ? error.message : 'Request failed'],
            },
          };
          setResult(errorResult);
          setIsSubmitting(false);
          return errorResult;
        }
        return { success: false, errors: { '': ['Request cancelled'] } };
      }
    },
    [opts.action, opts.method, opts.encType, cancel]
  );

  return { submit, cancel, isSubmitting, result };
}

// ─── parseActionResult ───────────────────────────────────────────────────────

export function parseActionResult<T>(response: unknown): ActionResult<T> {
  if (response === null || response === undefined) {
    return { success: false, errors: { '': ['Empty response'] } };
  }

  if (typeof response === 'object') {
    const obj = response as Record<string, unknown>;

    // Standard ActionResult shape
    if ('success' in obj) {
      return obj as unknown as ActionResult<T>;
    }

    // { error: ... } shape (check before { data })
    if ('error' in obj) {
      const error = obj.error;
      return {
        success: false,
        errors: {
          '': [typeof error === 'string' ? error : 'Unknown error'],
        },
      };
    }

    // { errors: ... } shape (check before { data })
    if ('errors' in obj) {
      return {
        success: false,
        errors: obj.errors as Record<string, string[]>,
      };
    }

    // { data: ... } shape
    if ('data' in obj) {
      return { success: true, data: obj.data as T };
    }
  }

  return { success: true, data: response as T };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function objectToFormData(values: unknown): FormData {
  const fd = new FormData();
  if (values === null || typeof values !== 'object') return fd;
  const flat = flattenToPaths(values);
  for (const [path, value] of flat) {
    if (value instanceof File) {
      fd.append(path, value);
    } else if (typeof value !== 'object' || value === null) {
      fd.append(path, String(value ?? ''));
    }
  }
  return fd;
}
