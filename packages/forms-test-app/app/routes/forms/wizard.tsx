'use client';

import { useWizard, useField, WizardProvider, WizardStep, WizardProgress, WizardNavigation } from '@ereo/forms';
import { required, email, minLength, compose, v } from '@ereo/forms';
import { useSignal } from '@ereo/state';

interface OnboardingValues {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  role: string;
  plan: string;
}

function PersonalStep({ form }: { form: any }) {
  const firstName = useField(form, 'firstName', {
    validate: required('First name is required'),
  });
  const lastName = useField(form, 'lastName', {
    validate: required('Last name is required'),
  });
  const emailField = useField(form, 'email', {
    validate: compose(required('Email is required'), email('Invalid email')),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Personal Information</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">First Name</label>
          <input
            {...firstName.inputProps}
            type="text"
            className={`input ${firstName.errors.length > 0 && firstName.touched ? 'border-red-500' : ''}`}
            data-testid="firstName-input"
          />
          {firstName.errors.length > 0 && firstName.touched && (
            <p className="mt-1 text-xs text-red-600">{firstName.errors[0]}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Name</label>
          <input
            {...lastName.inputProps}
            type="text"
            className={`input ${lastName.errors.length > 0 && lastName.touched ? 'border-red-500' : ''}`}
            data-testid="lastName-input"
          />
          {lastName.errors.length > 0 && lastName.touched && (
            <p className="mt-1 text-xs text-red-600">{lastName.errors[0]}</p>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          {...emailField.inputProps}
          type="email"
          className={`input ${emailField.errors.length > 0 && emailField.touched ? 'border-red-500' : ''}`}
          data-testid="email-input"
        />
        {emailField.errors.length > 0 && emailField.touched && (
          <p className="mt-1 text-xs text-red-600">{emailField.errors[0]}</p>
        )}
      </div>
    </div>
  );
}

function CompanyStep({ form }: { form: any }) {
  const company = useField(form, 'company', {
    validate: required('Company name is required'),
  });
  const role = useField(form, 'role', {
    validate: required('Please select a role'),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Company Details</h2>
      <div>
        <label className="block text-sm font-medium mb-1">Company</label>
        <input
          {...company.inputProps}
          type="text"
          className={`input ${company.errors.length > 0 && company.touched ? 'border-red-500' : ''}`}
          data-testid="company-input"
        />
        {company.errors.length > 0 && company.touched && (
          <p className="mt-1 text-xs text-red-600">{company.errors[0]}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Role</label>
        <select
          value={role.value as string}
          onChange={(e) => role.setValue(e.target.value as any)}
          onBlur={() => role.setTouched(true)}
          className={`input ${role.errors.length > 0 && role.touched ? 'border-red-500' : ''}`}
          data-testid="role-select"
        >
          <option value="">Select a role...</option>
          <option value="developer">Developer</option>
          <option value="designer">Designer</option>
          <option value="manager">Manager</option>
          <option value="other">Other</option>
        </select>
        {role.errors.length > 0 && role.touched && (
          <p className="mt-1 text-xs text-red-600">{role.errors[0]}</p>
        )}
      </div>
    </div>
  );
}

function PlanStep({ form }: { form: any }) {
  const plan = useField(form, 'plan', {
    validate: required('Please select a plan'),
  });

  const plans = [
    { value: 'free', label: 'Free', desc: 'Basic features, 1 project' },
    { value: 'pro', label: 'Pro', desc: 'All features, unlimited projects' },
    { value: 'enterprise', label: 'Enterprise', desc: 'Custom solutions, dedicated support' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Choose Your Plan</h2>
      <div className="grid gap-3">
        {plans.map((p) => (
          <label
            key={p.value}
            className={`card cursor-pointer border-2 transition-colors ${
              plan.value === p.value
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700'
            }`}
            data-testid={`plan-${p.value}`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="plan"
                value={p.value}
                checked={plan.value === p.value}
                onChange={(e) => plan.setValue(e.target.value as any)}
                className="text-primary-600"
              />
              <div>
                <p className="font-medium">{p.label}</p>
                <p className="text-sm text-gray-500">{p.desc}</p>
              </div>
            </div>
          </label>
        ))}
      </div>
      {plan.errors.length > 0 && plan.touched && (
        <p className="text-sm text-red-600">{plan.errors[0]}</p>
      )}
    </div>
  );
}

export default function WizardFormPage() {
  const wizard = useWizard<OnboardingValues>({
    steps: [
      { id: 'personal', fields: ['firstName', 'lastName', 'email'] },
      { id: 'company', fields: ['company', 'role'] },
      { id: 'plan', fields: ['plan'] },
    ],
    form: {
      defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        company: '',
        role: '',
        plan: '',
      },
    },
    onComplete: async (values) => {
      await new Promise((r) => setTimeout(r, 1000));
      console.log('[WIZARD] Completed:', values);
    },
  });

  const step = useSignal(wizard.currentStep);
  const completed = useSignal(wizard.completedSteps);
  const { currentStepState } = wizard;
  const isSubmitting = useSignal(wizard.form.isSubmitting);
  const submitState = useSignal(wizard.form.submitState);

  const stepLabels = ['Personal', 'Company', 'Plan'];

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold mb-2">Multi-step Wizard</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tests: useWizard, WizardStep, step validation, progress tracking
        </p>

        {submitState === 'success' && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200" data-testid="success-message">
            Onboarding complete! Check console for values.
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {stepLabels.map((label, i) => {
              const stepConfig = wizard.getStepConfig(i);
              const isActive = i === step;
              const isDone = stepConfig ? completed.has(stepConfig.id) : false;
              return (
                <div
                  key={label}
                  className={`text-sm font-medium ${
                    isActive ? 'text-primary-600' : isDone ? 'text-green-600' : 'text-gray-400'
                  }`}
                  data-testid={`step-label-${i}`}
                >
                  {isDone ? '✓ ' : ''}{label}
                </div>
              );
            })}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all"
              style={{ width: `${currentStepState.progress * 100}%` }}
              data-testid="progress-bar"
            />
          </div>
        </div>

        {/* Steps */}
        <div className="card mb-4">
          {step === 0 && <PersonalStep form={wizard.form} />}
          {step === 1 && <CompanyStep form={wizard.form} />}
          {step === 2 && <PlanStep form={wizard.form} />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => wizard.prev()}
            disabled={currentStepState.isFirst}
            className="btn btn-secondary disabled:opacity-30"
            data-testid="prev-btn"
          >
            Back
          </button>

          {currentStepState.isLast ? (
            <button
              type="button"
              onClick={() => wizard.submit()}
              disabled={isSubmitting}
              className="btn btn-primary disabled:opacity-50"
              data-testid="finish-btn"
            >
              {isSubmitting ? 'Completing...' : 'Complete Setup'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => wizard.next()}
              className="btn btn-primary"
              data-testid="next-btn"
            >
              Next
            </button>
          )}
        </div>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1" data-testid="debug-panel">
          <p><strong>Debug:</strong></p>
          <p>Step: <span data-testid="debug-step">{step + 1}/{currentStepState.totalSteps}</span></p>
          <p>Step ID: <span data-testid="debug-step-id">{currentStepState.currentStepId}</span></p>
          <p>Completed: <span data-testid="debug-completed">{[...completed].join(', ') || 'none'}</span></p>
          <p>Values: <span data-testid="debug-values">{JSON.stringify(wizard.form.getValues())}</span></p>
        </div>
      </div>
    </div>
  );
}
