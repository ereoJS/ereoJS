import {
  createElement,
  createContext,
  useContext,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import type { ReactNode, ReactElement } from 'react';
import { signal, Signal, batch } from '@ereo/state';
import { useSignal } from '@ereo/state';
import { FormStore } from './store';
import { useForm } from './hooks';
import type {
  WizardConfig,
  WizardStepConfig,
  WizardState,
  FormStoreInterface,
  SubmitHandler,
} from './types';

// ─── WizardHelpers Interface ─────────────────────────────────────────────────

export interface WizardHelpers<T extends Record<string, any>> {
  form: FormStore<T>;
  currentStep: Signal<number>;
  completedSteps: Signal<Set<string>>;
  state: WizardState;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (stepIdOrIndex: string | number) => void;
  submit: () => Promise<void>;
  reset: () => void;
  dispose: () => void;
  getStepConfig: (index: number) => WizardStepConfig<T> | undefined;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
}

// ─── createWizard ────────────────────────────────────────────────────────────

export function createWizard<T extends Record<string, any>>(
  config: WizardConfig<T>
): WizardHelpers<T> {
  const form = new FormStore<T>(config.form);
  const currentStep = signal(0);
  const completedSteps = signal(new Set<string>());
  const { steps, persist, persistKey = 'ereo-wizard' } = config;

  // Restore persisted state
  if (persist && typeof window !== 'undefined') {
    try {
      const storage = persist === 'localStorage' ? localStorage : sessionStorage;
      const saved = storage.getItem(persistKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.values) {
          form.resetTo(parsed.values);
        }
        if (typeof parsed.step === 'number') {
          currentStep.set(parsed.step);
        }
        if (parsed.completed) {
          completedSteps.set(new Set(parsed.completed));
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Auto-persist on changes (debounced)
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  function persistState(): void {
    if (!persist || typeof window === 'undefined') return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        const storage = persist === 'localStorage' ? localStorage : sessionStorage;
        storage.setItem(
          persistKey,
          JSON.stringify({
            values: form._getCurrentValues(),
            step: currentStep.get(),
            completed: Array.from(completedSteps.get()),
          })
        );
      } catch {
        // Ignore storage errors
      }
    }, 300);
  }

  const unsubForm = form.subscribe(persistState);
  const unsubStep = currentStep.subscribe(persistState);
  const unsubCompleted = completedSteps.subscribe(persistState);

  function getState(): WizardState {
    const step = currentStep.get();
    const stepConfig = steps[step];
    return {
      currentStep: step,
      currentStepId: stepConfig?.id ?? '',
      completedSteps: completedSteps.get(),
      totalSteps: steps.length,
      isFirst: step === 0,
      isLast: step === steps.length - 1,
      progress: steps.length > 1 ? step / (steps.length - 1) : 1,
    };
  }

  async function validateCurrentStep(): Promise<boolean> {
    const step = currentStep.get();
    const stepConfig = steps[step];
    if (!stepConfig) return true;

    // Touch all step fields so errors become visible
    if (stepConfig.fields) {
      for (const field of stepConfig.fields) {
        form.setTouched(field, true);
      }
    }

    // Run step-level validate function
    if (stepConfig.validate) {
      const valid = await stepConfig.validate();
      if (!valid) return false;
    }

    // Validate step fields
    if (stepConfig.fields && stepConfig.fields.length > 0) {
      const result = await (form as any)._validationEngine.validateFields(stepConfig.fields);
      return result.success;
    }

    return true;
  }

  async function next(): Promise<boolean> {
    const valid = await validateCurrentStep();
    if (!valid) return false;

    const step = currentStep.get();
    const stepConfig = steps[step];

    batch(() => {
      const completed = new Set(completedSteps.get());
      if (stepConfig) completed.add(stepConfig.id);
      completedSteps.set(completed);

      if (step < steps.length - 1) {
        currentStep.set(step + 1);
      }
    });

    return true;
  }

  function prev(): void {
    const step = currentStep.get();
    if (step > 0) {
      currentStep.set(step - 1);
    }
  }

  function goTo(stepIdOrIndex: string | number): void {
    if (typeof stepIdOrIndex === 'number') {
      if (stepIdOrIndex >= 0 && stepIdOrIndex < steps.length) {
        currentStep.set(stepIdOrIndex);
      }
    } else {
      const idx = steps.findIndex((s) => s.id === stepIdOrIndex);
      if (idx !== -1) {
        currentStep.set(idx);
      }
    }
  }

  async function submit(): Promise<void> {
    const valid = await validateCurrentStep();
    if (!valid) return;

    // Mark last step as completed
    const step = currentStep.get();
    const stepConfig = steps[step];
    if (stepConfig) {
      const completed = new Set(completedSteps.get());
      completed.add(stepConfig.id);
      completedSteps.set(completed);
    }

    if (config.onComplete) {
      await form.submitWith(config.onComplete);
    } else {
      await form.handleSubmit();
    }

    // Clear persisted state on successful submit
    if (persist && typeof window !== 'undefined') {
      try {
        const storage = persist === 'localStorage' ? localStorage : sessionStorage;
        storage.removeItem(persistKey);
      } catch {
        // Ignore
      }
    }
  }

  function reset(): void {
    // Clear pending persist timer
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    batch(() => {
      form.reset();
      currentStep.set(0);
      completedSteps.set(new Set());
    });

    if (persist && typeof window !== 'undefined') {
      try {
        const storage = persist === 'localStorage' ? localStorage : sessionStorage;
        storage.removeItem(persistKey);
      } catch {
        // Ignore
      }
    }
  }

  function dispose(): void {
    unsubForm();
    unsubStep();
    unsubCompleted();
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    form.dispose();
  }

  return {
    form,
    currentStep,
    completedSteps,
    get state() {
      return getState();
    },
    next,
    prev,
    goTo,
    submit,
    reset,
    dispose,
    getStepConfig: (index: number) => steps[index],
    canGoNext: () => currentStep.get() < steps.length - 1,
    canGoPrev: () => currentStep.get() > 0,
  };
}

// ─── useWizard ───────────────────────────────────────────────────────────────

export function useWizard<T extends Record<string, any>>(
  config: WizardConfig<T>
): WizardHelpers<T> & { currentStepState: WizardState } {
  const wizardRef = useRef<WizardHelpers<T> | null>(null);

  if (!wizardRef.current) {
    wizardRef.current = createWizard(config);
  }

  useEffect(() => {
    return () => {
      wizardRef.current?.dispose();
    };
  }, []);

  const wizard = wizardRef.current;
  const step = useSignal(wizard.currentStep);
  const completed = useSignal(wizard.completedSteps);

  const currentStepState: WizardState = useMemo(
    () => ({
      currentStep: step,
      currentStepId: config.steps[step]?.id ?? '',
      completedSteps: completed,
      totalSteps: config.steps.length,
      isFirst: step === 0,
      isLast: step === config.steps.length - 1,
      progress: config.steps.length > 1 ? step / (config.steps.length - 1) : 1,
    }),
    [step, completed, config.steps]
  );

  return { ...wizard, currentStepState };
}

// ─── Wizard Context ──────────────────────────────────────────────────────────

const WizardContext = createContext<WizardHelpers<any> | null>(null);

export interface WizardProviderProps<T extends Record<string, any>> {
  wizard: WizardHelpers<T>;
  children: ReactNode;
}

export function WizardProvider<T extends Record<string, any>>({
  wizard,
  children,
}: WizardProviderProps<T>): ReactElement {
  return createElement(WizardContext.Provider, { value: wizard }, children);
}

export function useWizardContext<
  T extends Record<string, any> = Record<string, any>,
>(): WizardHelpers<T> | null {
  return useContext(WizardContext) as WizardHelpers<T> | null;
}

// ─── WizardStep Component ────────────────────────────────────────────────────

export interface WizardStepProps {
  id: string;
  wizard?: WizardHelpers<any>;
  keepMounted?: boolean;
  children: ReactNode;
}

export function WizardStep({
  id,
  wizard: wizardProp,
  keepMounted = false,
  children,
}: WizardStepProps): ReactElement | null {
  const contextWizard = useWizardContext();
  const wizard = wizardProp ?? contextWizard;
  if (!wizard) throw new Error('WizardStep requires a wizard prop or WizardProvider');

  const currentStep = useSignal(wizard.currentStep);

  // Find if this step is active
  const config = wizard.getStepConfig(currentStep);
  const isActive = config?.id === id;

  if (!isActive && !keepMounted) return null;

  return createElement(
    'div',
    {
      'data-wizard-step': id,
      'data-active': isActive,
      style: isActive ? undefined : { display: 'none' },
      role: 'tabpanel',
      'aria-hidden': !isActive,
    },
    children
  );
}

// ─── WizardProgress Component ────────────────────────────────────────────────

export interface WizardProgressProps {
  wizard?: WizardHelpers<any>;
  renderStep?: (step: WizardStepConfig<any>, index: number, state: { isActive: boolean; isCompleted: boolean }) => ReactNode;
}

export function WizardProgress({
  wizard: wizardProp,
  renderStep,
}: WizardProgressProps): ReactElement | null {
  const contextWizard = useWizardContext();
  const wizard = wizardProp ?? contextWizard;
  if (!wizard) throw new Error('WizardProgress requires a wizard prop or WizardProvider');

  const currentStep = useSignal(wizard.currentStep);
  const completed = useSignal(wizard.completedSteps);
  const state = wizard.state;

  const steps: ReactNode[] = [];
  for (let i = 0; i < state.totalSteps; i++) {
    const stepConfig = wizard.getStepConfig(i);
    if (!stepConfig) continue;

    const isActive = i === currentStep;
    const isCompleted = completed.has(stepConfig.id);

    if (renderStep) {
      steps.push(renderStep(stepConfig, i, { isActive, isCompleted }));
    } else {
      steps.push(
        createElement(
          'div',
          {
            key: stepConfig.id,
            'data-step': stepConfig.id,
            'data-active': isActive,
            'data-completed': isCompleted,
            role: 'tab',
            'aria-selected': isActive,
            style: {
              fontWeight: isActive ? 'bold' : 'normal',
              opacity: isCompleted || isActive ? 1 : 0.5,
            },
          },
          stepConfig.id
        )
      );
    }
  }

  return createElement(
    'div',
    {
      role: 'tablist',
      'aria-label': 'Form steps',
      'data-wizard-progress': true,
    },
    ...steps
  );
}

// ─── WizardNavigation Component ──────────────────────────────────────────────

export interface WizardNavigationProps {
  wizard?: WizardHelpers<any>;
  backLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
}

export function WizardNavigation({
  wizard: wizardProp,
  backLabel = 'Back',
  nextLabel = 'Next',
  submitLabel = 'Submit',
}: WizardNavigationProps): ReactElement | null {
  const contextWizard = useWizardContext();
  const wizard = wizardProp ?? contextWizard;
  if (!wizard) throw new Error('WizardNavigation requires a wizard prop or WizardProvider');

  const currentStep = useSignal(wizard.currentStep);
  const state = wizard.state;

  const handleBack = useCallback(() => wizard.prev(), [wizard]);
  const handleNext = useCallback(() => wizard.next(), [wizard]);
  const handleSubmit = useCallback(() => wizard.submit(), [wizard]);

  return createElement(
    'div',
    { 'data-wizard-navigation': true },
    !state.isFirst
      ? createElement(
          'button',
          { type: 'button', onClick: handleBack },
          backLabel
        )
      : null,
    state.isLast
      ? createElement(
          'button',
          { type: 'button', onClick: handleSubmit },
          submitLabel
        )
      : createElement(
          'button',
          { type: 'button', onClick: handleNext },
          nextLabel
        )
  );
}
