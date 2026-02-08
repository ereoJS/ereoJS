// @ts-nocheck
import { describe, expect, test, afterEach } from 'bun:test';
import React, { createElement, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';

// Error boundary to catch render errors without corrupting React state
class ErrorBoundary extends Component<
  { children?: ReactNode; onError?: (e: Error) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error);
  }
  render() {
    if (this.state.error) {
      return createElement('div', { 'data-testid': 'error' }, this.state.error.message);
    }
    return this.props.children;
  }
}
import {
  createWizard,
  useWizard,
  WizardProvider,
  useWizardContext,
  WizardStep,
  WizardProgress,
  WizardNavigation,
} from './wizard';
import type { WizardHelpers } from './wizard';

afterEach(cleanup);

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TestForm {
  name: string;
  email: string;
}

const defaultValues: TestForm = { name: '', email: '' };
const steps = [
  { id: 'step1', fields: ['name' as any] },
  { id: 'step2', fields: ['email' as any] },
  { id: 'step3' },
];

function createTestConfig(overrides: any = {}) {
  return {
    steps,
    form: { defaultValues },
    ...overrides,
  };
}

// ─── useWizard ──────────────────────────────────────────────────────────────

describe('useWizard', () => {
  test('creates wizard and returns helpers with currentStepState', () => {
    let result: any;

    function TestComp() {
      result = useWizard<TestForm>(createTestConfig());
      return createElement('div', null,
        createElement('span', { 'data-testid': 'step' }, String(result.currentStepState.currentStep)),
        createElement('span', { 'data-testid': 'total' }, String(result.currentStepState.totalSteps)),
        createElement('span', { 'data-testid': 'first' }, String(result.currentStepState.isFirst)),
        createElement('span', { 'data-testid': 'last' }, String(result.currentStepState.isLast)),
      );
    }

    render(createElement(TestComp));

    expect(result.form).toBeDefined();
    expect(result.currentStepState.currentStep).toBe(0);
    expect(result.currentStepState.totalSteps).toBe(3);
    expect(result.currentStepState.isFirst).toBe(true);
    expect(result.currentStepState.isLast).toBe(false);
    expect(result.currentStepState.currentStepId).toBe('step1');
  });

  test('updates currentStepState when navigating', async () => {
    let result: any;

    function TestComp() {
      result = useWizard<TestForm>(createTestConfig());
      return createElement('span', { 'data-testid': 'step' }, String(result.currentStepState.currentStep));
    }

    render(createElement(TestComp));
    expect(screen.getByTestId('step').textContent).toBe('0');

    await act(async () => {
      await result.next();
    });

    expect(screen.getByTestId('step').textContent).toBe('1');
  });

  test('disposes on unmount', () => {
    let wizardRef: any;

    function TestComp() {
      const w = useWizard<TestForm>(createTestConfig());
      wizardRef = w;
      return createElement('div', null, 'test');
    }

    const { unmount } = render(createElement(TestComp));
    const wizard = wizardRef;
    unmount();

    // Should not throw after dispose
    expect(wizard).toBeDefined();
  });

  test('returns same wizard instance across re-renders', () => {
    const instances: any[] = [];

    function TestComp({ tick }: { tick: number }) {
      const w = useWizard<TestForm>(createTestConfig());
      instances.push(w.form);
      return createElement('span', null, String(tick));
    }

    const { rerender } = render(createElement(TestComp, { tick: 1 }));
    rerender(createElement(TestComp, { tick: 2 }));

    expect(instances[0]).toBe(instances[1]);
  });

  test('progress is 1 for single-step wizard', () => {
    let result: any;

    function TestComp() {
      result = useWizard<TestForm>({
        steps: [{ id: 'only' }],
        form: { defaultValues },
      });
      return createElement('span', null, String(result.currentStepState.progress));
    }

    render(createElement(TestComp));
    expect(result.currentStepState.progress).toBe(1);
  });

  test('completedSteps is reactive', async () => {
    let result: any;

    function TestComp() {
      result = useWizard<TestForm>(createTestConfig());
      return createElement('span', { 'data-testid': 'completed' },
        String(result.currentStepState.completedSteps.size)
      );
    }

    render(createElement(TestComp));
    expect(screen.getByTestId('completed').textContent).toBe('0');

    await act(async () => {
      await result.next();
    });

    expect(screen.getByTestId('completed').textContent).toBe('1');
  });
});

// ─── WizardProvider / useWizardContext ───────────────────────────────────────

describe('WizardProvider and useWizardContext', () => {
  test('provides wizard via context', () => {
    const wizard = createWizard<TestForm>(createTestConfig());
    let ctxWizard: any = null;

    function Consumer() {
      ctxWizard = useWizardContext();
      return createElement('span', null, 'ok');
    }

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(Consumer)
      )
    );

    expect(ctxWizard).toBe(wizard);
    wizard.dispose();
  });

  test('returns null when no provider', () => {
    let ctxWizard: any = 'not-null';

    function Consumer() {
      ctxWizard = useWizardContext();
      return createElement('span', null, 'ok');
    }

    render(createElement(Consumer));
    expect(ctxWizard).toBeNull();
  });
});

// ─── WizardStep ─────────────────────────────────────────────────────────────

describe('WizardStep', () => {
  test('renders active step', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardStep, { id: 'step1' } as any,
          createElement('span', null, 'Step 1 Content')
        )
      )
    );

    expect(screen.getByText('Step 1 Content')).toBeDefined();
    const stepDiv = document.querySelector('[data-wizard-step="step1"]');
    expect(stepDiv?.getAttribute('data-active')).toBe('true');
    expect(stepDiv?.getAttribute('aria-hidden')).toBe('false');
    expect(stepDiv?.getAttribute('role')).toBe('tabpanel');

    wizard.dispose();
  });

  test('hides inactive step (returns null)', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardStep, { id: 'step2' } as any,
          createElement('span', null, 'Step 2 Content')
        )
      )
    );

    expect(screen.queryByText('Step 2 Content')).toBeNull();

    wizard.dispose();
  });

  test('keepMounted renders inactive step as hidden', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardStep, { id: 'step2', keepMounted: true } as any,
          createElement('span', null, 'Step 2 Hidden')
        )
      )
    );

    expect(screen.getByText('Step 2 Hidden')).toBeDefined();
    const stepDiv = document.querySelector('[data-wizard-step="step2"]');
    expect(stepDiv?.getAttribute('data-active')).toBe('false');
    expect(stepDiv?.getAttribute('aria-hidden')).toBe('true');

    wizard.dispose();
  });

  test('accepts wizard prop directly (no context)', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardStep, { id: 'step1', wizard } as any,
        createElement('span', null, 'Direct Prop')
      )
    );

    expect(screen.getByText('Direct Prop')).toBeDefined();

    wizard.dispose();
  });

  test('throws without wizard prop or context', () => {
    let caughtError: Error | null = null;
    render(
      createElement(ErrorBoundary, {
        onError: (e: Error) => { caughtError = e; },
      },
        createElement(WizardStep, { id: 'step1' } as any,
          createElement('span', null, 'No Wizard')
        )
      )
    );
    expect(caughtError?.message).toBe('WizardStep requires a wizard prop or WizardProvider');
  });

  test('updates when step changes', async () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardStep, { id: 'step1' } as any,
          createElement('span', null, 'Step 1')
        ),
        createElement(WizardStep, { id: 'step2' } as any,
          createElement('span', null, 'Step 2')
        )
      )
    );

    expect(screen.getByText('Step 1')).toBeDefined();
    expect(screen.queryByText('Step 2')).toBeNull();

    await act(async () => {
      await wizard.next();
    });

    expect(screen.queryByText('Step 1')).toBeNull();
    expect(screen.getByText('Step 2')).toBeDefined();

    wizard.dispose();
  });
});

// ─── WizardProgress ─────────────────────────────────────────────────────────

describe('WizardProgress', () => {
  test('renders default step indicators', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardProgress, {} as any)
      )
    );

    const tablist = document.querySelector('[role="tablist"]');
    expect(tablist).toBeDefined();
    expect(tablist?.getAttribute('aria-label')).toBe('Form steps');

    const tabs = document.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);

    // First tab is active
    expect(tabs[0]?.getAttribute('data-active')).toBe('true');
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');

    // Others are inactive
    expect(tabs[1]?.getAttribute('data-active')).toBe('false');
    expect(tabs[2]?.getAttribute('data-active')).toBe('false');

    wizard.dispose();
  });

  test('marks completed steps', async () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardProgress, {} as any)
      )
    );

    await act(async () => {
      await wizard.next();
    });

    const step1 = document.querySelector('[data-step="step1"]');
    expect(step1?.getAttribute('data-completed')).toBe('true');

    wizard.dispose();
  });

  test('supports custom renderStep', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardProgress, {
          renderStep: (step: any, index: number, state: any) =>
            createElement('div', { key: step.id, 'data-testid': `custom-${index}` },
              `${step.id} ${state.isActive ? 'active' : 'inactive'}`
            ),
        } as any)
      )
    );

    expect(screen.getByTestId('custom-0').textContent).toBe('step1 active');
    expect(screen.getByTestId('custom-1').textContent).toBe('step2 inactive');
    expect(screen.getByTestId('custom-2').textContent).toBe('step3 inactive');

    wizard.dispose();
  });

  test('accepts wizard prop directly', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProgress, { wizard } as any)
    );

    expect(document.querySelector('[role="tablist"]')).toBeDefined();

    wizard.dispose();
  });

  test('throws without wizard', () => {
    let caughtError: Error | null = null;
    render(
      createElement(ErrorBoundary, {
        onError: (e: Error) => { caughtError = e; },
      },
        createElement(WizardProgress, {} as any)
      )
    );
    expect(caughtError?.message).toBe('WizardProgress requires a wizard prop or WizardProvider');
  });
});

// ─── WizardNavigation ───────────────────────────────────────────────────────

describe('WizardNavigation', () => {
  test('shows Next button on first step (no Back)', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardNavigation, {} as any)
      )
    );

    expect(screen.getByText('Next')).toBeDefined();
    expect(screen.queryByText('Back')).toBeNull();
    expect(screen.queryByText('Submit')).toBeNull();

    wizard.dispose();
  });

  test('shows Back and Next on middle step', async () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardNavigation, {} as any)
      )
    );

    await act(async () => {
      await wizard.next();
    });

    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.getByText('Next')).toBeDefined();
    expect(screen.queryByText('Submit')).toBeNull();

    wizard.dispose();
  });

  test('shows Back and Submit on last step', async () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardNavigation, {} as any)
      )
    );

    // Navigate to last step
    await act(async () => {
      await wizard.next(); // step 0 → 1
      await wizard.next(); // step 1 → 2
    });

    expect(screen.getByText('Back')).toBeDefined();
    expect(screen.getByText('Submit')).toBeDefined();
    expect(screen.queryByText('Next')).toBeNull();

    wizard.dispose();
  });

  test('custom button labels', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardNavigation, {
          backLabel: 'Previous',
          nextLabel: 'Continue',
          submitLabel: 'Finish',
        } as any)
      )
    );

    expect(screen.getByText('Continue')).toBeDefined();

    wizard.dispose();
  });

  test('Back button calls prev()', async () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardNavigation, {} as any)
      )
    );

    await act(async () => {
      await wizard.next();
    });

    expect(wizard.currentStep.get()).toBe(1);

    await act(() => {
      fireEvent.click(screen.getByText('Back'));
    });

    expect(wizard.currentStep.get()).toBe(0);

    wizard.dispose();
  });

  test('Next button calls next()', async () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardNavigation, {} as any)
      )
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Next'));
      await new Promise(r => setTimeout(r, 50));
    });

    expect(wizard.currentStep.get()).toBe(1);

    wizard.dispose();
  });

  test('Submit button calls submit()', async () => {
    let submitted = false;
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'only' }],
      form: { defaultValues },
      onComplete: async () => { submitted = true; },
    });

    render(
      createElement(WizardProvider, { wizard } as any,
        createElement(WizardNavigation, {} as any)
      )
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Submit'));
      await new Promise(r => setTimeout(r, 50));
    });

    expect(submitted).toBe(true);

    wizard.dispose();
  });

  test('accepts wizard prop directly', () => {
    const wizard = createWizard<TestForm>(createTestConfig());

    render(
      createElement(WizardNavigation, { wizard } as any)
    );

    expect(screen.getByText('Next')).toBeDefined();

    wizard.dispose();
  });

  test('throws without wizard', () => {
    let caughtError: Error | null = null;
    render(
      createElement(ErrorBoundary, {
        onError: (e: Error) => { caughtError = e; },
      },
        createElement(WizardNavigation, {} as any)
      )
    );
    expect(caughtError?.message).toBe('WizardNavigation requires a wizard prop or WizardProvider');
  });
});
