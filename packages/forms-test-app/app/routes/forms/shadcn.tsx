'use client';

import { useForm, useField, useFormStatus } from '@ereo/forms';
import { required, email, minLength, compose, custom, v } from '@ereo/forms';
import { useState } from 'react';

interface ProfileFormValues {
  name: string;
  email: string;
  bio: string;
  role: string;
  experience: string;
  newsletter: boolean;
  darkMode: boolean;
  notifications: string;
}

/* ── shadcn-style component wrappers ─────────────────────────────────────── */

function ShadcnInput({
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="text-sm font-medium">{label}</label>
      <input
        {...props}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}
          bg-white dark:bg-gray-800`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ShadcnTextarea({
  label,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={props.id} className="text-sm font-medium">{label}</label>
      <textarea
        {...props}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}
          bg-white dark:bg-gray-800`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ShadcnSelect({
  label,
  error,
  options,
  value,
  onValueChange,
  placeholder,
}: {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600'}
          bg-white dark:bg-gray-800`}
        data-testid="role-select"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ShadcnCheckbox({
  label,
  checked,
  onCheckedChange,
  error,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <div
          onClick={() => onCheckedChange(!checked)}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors cursor-pointer
            ${checked
              ? 'bg-primary-600 border-primary-600'
              : 'border-gray-300 dark:border-gray-600'
            }`}
          role="checkbox"
          aria-checked={checked}
          data-testid="newsletter-checkbox"
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <span className="text-sm">{label}</span>
      </label>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function ShadcnSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
        data-testid="darkmode-switch"
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </label>
  );
}

function ShadcnRadioGroup({
  label,
  options,
  value,
  onValueChange,
  error,
}: {
  label: string;
  options: { value: string; label: string; description?: string }[];
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="space-y-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex items-start gap-3 cursor-pointer"
            data-testid={`radio-${opt.value}`}
          >
            <div
              onClick={() => onValueChange(opt.value)}
              className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors
                ${value === opt.value
                  ? 'border-primary-600'
                  : 'border-gray-300 dark:border-gray-600'
                }`}
              role="radio"
              aria-checked={value === opt.value}
            >
              {value === opt.value && (
                <div className="w-2 h-2 rounded-full bg-primary-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              {opt.description && (
                <p className="text-xs text-gray-500">{opt.description}</p>
              )}
            </div>
          </label>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ── Main Form ───────────────────────────────────────────────────────────── */

export default function ShadcnFormPage() {
  const form = useForm<ProfileFormValues>({
    defaultValues: {
      name: '',
      email: '',
      bio: '',
      role: '',
      experience: '',
      newsletter: false,
      darkMode: false,
      notifications: 'all',
    },
    onSubmit: async (values) => {
      await new Promise((r) => setTimeout(r, 1000));
      console.log('[SHADCN] Submitted:', values);
    },
  });

  const nameField = useField(form, 'name', {
    validate: compose(required('Name is required'), minLength(2, 'Too short')),
  });
  const emailField = useField(form, 'email', {
    validate: compose(required('Email is required'), email('Invalid email')),
  });
  const bioField = useField(form, 'bio', {
    validate: v.maxLength(500, 'Bio must be under 500 characters'),
  });
  const roleField = useField(form, 'role', {
    validate: required('Please select a role'),
    parse: (val: string) => val,
  });
  const experienceField = useField(form, 'experience', {
    validate: required('Please select experience level'),
    parse: (val: string) => val,
  });
  const newsletterField = useField(form, 'newsletter', {
    parse: (checked: boolean) => checked,
  });
  const darkModeField = useField(form, 'darkMode', {
    parse: (checked: boolean) => checked,
  });
  const notifField = useField(form, 'notifications', {
    parse: (val: string) => val,
  });

  const { isSubmitting, submitState, isDirty } = useFormStatus(form);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2">shadcn/ui Style Form</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tests: Custom Input, Textarea, Select, Checkbox, Switch, RadioGroup with @ereo/forms
        </p>

        {submitState === 'success' && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200" data-testid="success-message">
            Profile saved!
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}
          className="space-y-5"
        >
          {/* Input */}
          <ShadcnInput
            label="Full Name"
            id="name"
            {...nameField.inputProps}
            placeholder="John Doe"
            error={nameField.errors.length > 0 && nameField.touched ? nameField.errors[0] : undefined}
            data-testid="name-input"
          />

          {/* Input (email) */}
          <ShadcnInput
            label="Email"
            id="email"
            type="email"
            {...emailField.inputProps}
            placeholder="john@example.com"
            error={emailField.errors.length > 0 && emailField.touched ? emailField.errors[0] : undefined}
            data-testid="email-input"
          />

          {/* Textarea */}
          <ShadcnTextarea
            label="Bio"
            id="bio"
            rows={3}
            {...(bioField.inputProps as any)}
            placeholder="Tell us about yourself..."
            error={bioField.errors.length > 0 && bioField.touched ? bioField.errors[0] : undefined}
            data-testid="bio-textarea"
          />

          {/* Select */}
          <ShadcnSelect
            label="Role"
            placeholder="Select a role..."
            value={roleField.value as string}
            onValueChange={(val) => roleField.setValue(val as any)}
            options={[
              { value: 'developer', label: 'Developer' },
              { value: 'designer', label: 'Designer' },
              { value: 'manager', label: 'Manager' },
              { value: 'other', label: 'Other' },
            ]}
            error={roleField.errors.length > 0 && roleField.touched ? roleField.errors[0] : undefined}
          />

          {/* RadioGroup */}
          <ShadcnRadioGroup
            label="Experience Level"
            value={experienceField.value as string}
            onValueChange={(val) => experienceField.setValue(val as any)}
            options={[
              { value: 'junior', label: 'Junior', description: '0-2 years' },
              { value: 'mid', label: 'Mid-level', description: '2-5 years' },
              { value: 'senior', label: 'Senior', description: '5+ years' },
            ]}
            error={experienceField.errors.length > 0 && experienceField.touched ? experienceField.errors[0] : undefined}
          />

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Checkbox */}
          <ShadcnCheckbox
            label="Subscribe to newsletter"
            checked={newsletterField.value as boolean}
            onCheckedChange={(checked) => newsletterField.setValue(checked as any)}
          />

          {/* Switch */}
          <ShadcnSwitch
            label="Dark Mode"
            checked={darkModeField.value as boolean}
            onCheckedChange={(checked) => darkModeField.setValue(checked as any)}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full disabled:opacity-50"
            data-testid="submit-btn"
          >
            {isSubmitting ? 'Saving Profile...' : 'Save Profile'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1" data-testid="debug-panel">
          <p><strong>Debug:</strong></p>
          <p>isDirty: <span data-testid="debug-dirty">{String(isDirty)}</span></p>
          <p>submitState: <span data-testid="debug-submit-state">{submitState}</span></p>
          <p>Values: <span data-testid="debug-values">{JSON.stringify(form.getValues())}</span></p>
        </div>
      </div>
    </div>
  );
}
