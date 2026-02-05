'use client';

import { useForm, useField, useFormStatus } from '@ereo/forms';
import { required, email, minLength, maxLength, matches, compose, custom, v } from '@ereo/forms';

interface RegisterFormValues {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: string;
  terms: boolean;
}

export default function RegisterFormPage() {
  const form = useForm<RegisterFormValues>({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      age: '',
      terms: false,
    },
    onSubmit: async (values) => {
      await new Promise((r) => setTimeout(r, 1000));
      console.log('[REGISTER] Submitted:', values);
    },
  });

  const usernameField = useField(form, 'username', {
    validate: compose(
      required('Username is required'),
      minLength(3, 'Username must be at least 3 characters'),
      maxLength(20, 'Username must be at most 20 characters'),
      v.pattern(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores')
    ),
  });

  const emailField = useField(form, 'email', {
    validate: compose(required('Email is required'), email('Invalid email address')),
  });

  const passwordField = useField(form, 'password', {
    validate: compose(
      required('Password is required'),
      minLength(8, 'Password must be at least 8 characters'),
      custom<string>((val) => {
        if (val && !/[A-Z]/.test(val)) return 'Must contain an uppercase letter';
        if (val && !/[0-9]/.test(val)) return 'Must contain a number';
        return undefined;
      })
    ),
  });

  const confirmField = useField(form, 'confirmPassword', {
    validate: compose(
      required('Please confirm your password'),
      matches('password', 'Passwords do not match')
    ),
  });

  const ageField = useField(form, 'age', {
    validate: compose(
      required('Age is required'),
      v.number('Must be a number'),
      v.min(13, 'Must be at least 13 years old'),
      v.max(120, 'Invalid age')
    ),
  });

  const termsField = useField(form, 'terms', {
    validate: custom<boolean>((val) => val ? undefined : 'You must accept the terms'),
  });

  const { isSubmitting, submitState } = useFormStatus(form);

  const renderField = (
    field: ReturnType<typeof useField>,
    label: string,
    id: string,
    type = 'text',
    placeholder = ''
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1">{label}</label>
      <input
        {...field.inputProps}
        type={type}
        id={id}
        className={`input ${field.errors.length > 0 && field.touched ? 'border-red-500' : ''}`}
        placeholder={placeholder}
        data-testid={`${id}-input`}
      />
      {field.errors.length > 0 && field.touched && (
        <p className="mt-1 text-sm text-red-600" data-testid={`${id}-error`}>{field.errors[0]}</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-bold mb-2">Registration Form</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tests: compose, matches (cross-field), custom, pattern, min/max, number
        </p>

        {submitState === 'success' && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200" data-testid="success-message">
            Registration successful!
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}
          className="space-y-4"
        >
          {renderField(usernameField, 'Username', 'username', 'text', 'Choose a username')}
          {renderField(emailField, 'Email', 'email', 'email', 'you@example.com')}
          {renderField(passwordField, 'Password', 'password', 'password', 'Min 8 chars, 1 uppercase, 1 number')}
          {renderField(confirmField, 'Confirm Password', 'confirmPassword', 'password', 'Re-enter your password')}
          {renderField(ageField, 'Age', 'age', 'text', 'Your age')}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="terms"
              checked={termsField.value as boolean}
              onChange={(e) => termsField.setValue(e.target.checked as any)}
              data-testid="terms-checkbox"
            />
            <label htmlFor="terms" className="text-sm">
              I accept the terms and conditions
            </label>
          </div>
          {termsField.errors.length > 0 && termsField.touched && (
            <p className="text-sm text-red-600" data-testid="terms-error">{termsField.errors[0]}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full disabled:opacity-50"
            data-testid="submit-btn"
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1" data-testid="debug-panel">
          <p><strong>Debug:</strong></p>
          <p>submitState: <span data-testid="debug-submit-state">{submitState}</span></p>
          <p>values: <span data-testid="debug-values">{JSON.stringify(form.getValues())}</span></p>
        </div>
      </div>
    </div>
  );
}
