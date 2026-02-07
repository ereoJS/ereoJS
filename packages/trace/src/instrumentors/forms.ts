/**
 * @ereo/trace - Forms Instrumentor (Layer 4)
 *
 * Client-side span for form submission + validation.
 * Records: field count, validation error count, time-to-validate, error sources.
 */

import type { Span } from '../types';

/**
 * Trace a form submission.
 */
export function traceFormSubmit<T>(
  parentSpan: Span,
  formName: string,
  submitFn: () => T | Promise<T>,
  attrs?: { fieldCount?: number },
): T | Promise<T> {
  const span = parentSpan.child(`form:${formName}`, 'forms');
  span.setAttribute('form.name', formName);
  if (attrs?.fieldCount) span.setAttribute('form.field_count', attrs.fieldCount);

  try {
    const result = submitFn();
    if (result instanceof Promise) {
      return result
        .then((v) => {
          span.end();
          return v;
        })
        .catch((err) => {
          span.error(err);
          span.end();
          throw err;
        });
    }
    span.end();
    return result;
  } catch (err) {
    span.error(err);
    span.end();
    throw err;
  }
}

/**
 * Record form validation result.
 */
export function recordFormValidation(
  parentSpan: Span,
  formName: string,
  attrs: {
    errorCount: number;
    validationMs: number;
    errorSources?: string[];
  },
): void {
  parentSpan.event('form.validation', {
    form: formName,
    error_count: attrs.errorCount,
    duration_ms: attrs.validationMs,
    ...(attrs.errorSources ? { sources: attrs.errorSources.join(', ') } : {}),
  });
}
