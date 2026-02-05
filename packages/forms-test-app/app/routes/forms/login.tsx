'use client';

import { useForm, useField, useFormStatus } from '@ereo/forms';
import { required, email, minLength, compose } from '@ereo/forms';

interface LoginFormValues {
  email: string;
  password: string;
  rememberMe: boolean;
}

export default function LoginFormPage() {
  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    onSubmit: async (values) => {
      await new Promise((r) => setTimeout(r, 1000));
      console.log('[LOGIN] Submitted:', values);
    },
  });

  const emailField = useField(form, 'email', {
    validate: compose(required('Email is required'), email('Please enter a valid email')),
  });

  const passwordField = useField(form, 'password', {
    validate: compose(required('Password is required'), minLength(6, 'Password must be at least 6 characters')),
  });

  const rememberField = useField(form, 'rememberMe');

  const { isSubmitting, submitState, isDirty, isValid } = useFormStatus(form);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-2">Login Form</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tests: useForm, useField, useFormStatus, required, email, minLength, compose
        </p>

        {submitState === 'success' && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200" data-testid="success-message">
            Login successful! Check console for submitted values.
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            form.handleSubmit();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input
              {...emailField.inputProps}
              type="email"
              id="email"
              className={`input ${emailField.errors.length > 0 && emailField.touched ? 'border-red-500' : ''}`}
              placeholder="you@example.com"
              data-testid="email-input"
            />
            {emailField.errors.length > 0 && emailField.touched && (
              <p className="mt-1 text-sm text-red-600" data-testid="email-error">{emailField.errors[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <input
              {...passwordField.inputProps}
              type="password"
              id="password"
              className={`input ${passwordField.errors.length > 0 && passwordField.touched ? 'border-red-500' : ''}`}
              placeholder="Enter password"
              data-testid="password-input"
            />
            {passwordField.errors.length > 0 && passwordField.touched && (
              <p className="mt-1 text-sm text-red-600" data-testid="password-error">{passwordField.errors[0]}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberField.value as boolean}
              onChange={(e) => rememberField.setValue(e.target.checked as any)}
              className="rounded"
              data-testid="remember-checkbox"
            />
            <label htmlFor="rememberMe" className="text-sm">Remember me</label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full disabled:opacity-50"
            data-testid="submit-btn"
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1" data-testid="debug-panel">
          <p><strong>Debug:</strong></p>
          <p>isDirty: <span data-testid="debug-dirty">{String(isDirty)}</span></p>
          <p>isValid: <span data-testid="debug-valid">{String(isValid)}</span></p>
          <p>submitState: <span data-testid="debug-submit-state">{submitState}</span></p>
          <p>email touched: <span data-testid="debug-email-touched">{String(emailField.touched)}</span></p>
          <p>password touched: <span data-testid="debug-password-touched">{String(passwordField.touched)}</span></p>
          <p>values: <span data-testid="debug-values">{JSON.stringify(form.getValues())}</span></p>
        </div>
      </div>
    </div>
  );
}
