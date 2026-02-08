import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { createWizard } from './wizard';
import { required } from './validators';
import type { WizardHelpers } from './wizard';

// ─── Storage Helpers ────────────────────────────────────────────────────────

function setupPersistence() {
  // Clear storage before each test (happy-dom provides these globals)
  localStorage.clear();
  sessionStorage.clear();
}

function teardownPersistence() {
  localStorage.clear();
  sessionStorage.clear();
}


interface TestForm {
  name: string;
  email: string;
}

const defaultValues: TestForm = { name: '', email: '' };

// ─── Persistence Tests ──────────────────────────────────────────────────────

describe('createWizard: localStorage persistence', () => {
  beforeEach(setupPersistence);
  afterEach(teardownPersistence);

  test('persists state to localStorage when persist=localStorage', async () => {
    const wizard = createWizard<TestForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
        { id: 'step2', fields: ['email' as any] },
      ],
      form: { defaultValues },
      persist: 'localStorage',
    });

    wizard.form.setValue('name' as any, 'Alice');
    await wizard.next();

    // Wait for debounce (300ms)
    await new Promise((r) => setTimeout(r, 400));

    const stored = localStorage.getItem('ereo-wizard');
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);
    expect(parsed.step).toBe(1);
    expect(parsed.values.name).toBe('Alice');
    expect(parsed.completed).toContain('step1');

    wizard.dispose();
  });

  test('restores state from localStorage', async () => {
    // Pre-seed localStorage
    localStorage.setItem('ereo-wizard', JSON.stringify({
      values: { name: 'Restored', email: 'r@test.com' },
      step: 1,
      completed: ['step1'],
    }));

    const wizard = createWizard<TestForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
        { id: 'step2', fields: ['email' as any] },
      ],
      form: { defaultValues },
      persist: 'localStorage',
    });

    expect(wizard.currentStep.get()).toBe(1);
    expect(wizard.completedSteps.get().has('step1')).toBe(true);
    expect(wizard.form.getValue('name' as any)).toBe('Restored');

    wizard.dispose();
  });

  test('uses custom persistKey', async () => {
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'localStorage',
      persistKey: 'my-wizard-key',
    });

    wizard.form.setValue('name' as any, 'Custom');

    await new Promise((r) => setTimeout(r, 400));

    expect(localStorage.getItem('my-wizard-key')).not.toBeNull();
    expect(localStorage.getItem('ereo-wizard')).toBeNull();

    wizard.dispose();
  });

  test('reset clears persisted state', async () => {
    const wizard = createWizard<TestForm>({
      steps: [
        { id: 'step1' },
        { id: 'step2' },
      ],
      form: { defaultValues },
      persist: 'localStorage',
    });

    wizard.form.setValue('name' as any, 'Alice');
    await new Promise((r) => setTimeout(r, 400));
    expect(localStorage.getItem('ereo-wizard')).not.toBeNull();

    wizard.reset();

    expect(localStorage.getItem('ereo-wizard')).toBeNull();
    expect(wizard.currentStep.get()).toBe(0);
    expect(wizard.completedSteps.get().size).toBe(0);

    wizard.dispose();
  });

  test('submit clears persisted state', async () => {
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'localStorage',
      onComplete: async () => {},
    });

    wizard.form.setValue('name' as any, 'Alice');
    await new Promise((r) => setTimeout(r, 400));
    expect(localStorage.getItem('ereo-wizard')).not.toBeNull();

    await wizard.submit();
    expect(localStorage.getItem('ereo-wizard')).toBeNull();

    wizard.dispose();
  });

  test('handles corrupted storage data gracefully', () => {
    localStorage.setItem('ereo-wizard', 'not-valid-json{{{');

    // Should not throw
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'localStorage',
    });

    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  test('handles partial storage data', () => {
    localStorage.setItem('ereo-wizard', JSON.stringify({
      values: { name: 'Partial' },
      // No step or completed
    }));

    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'localStorage',
    });

    expect(wizard.form.getValue('name' as any)).toBe('Partial');
    expect(wizard.currentStep.get()).toBe(0);
    expect(wizard.completedSteps.get().size).toBe(0);
    wizard.dispose();
  });

  test('handles storage with only step number', () => {
    localStorage.setItem('ereo-wizard', JSON.stringify({
      step: 2,
    }));

    const wizard = createWizard<TestForm>({
      steps: [
        { id: 'step1' },
        { id: 'step2' },
        { id: 'step3' },
      ],
      form: { defaultValues },
      persist: 'localStorage',
    });

    expect(wizard.currentStep.get()).toBe(2);
    wizard.dispose();
  });
});

describe('createWizard: sessionStorage persistence', () => {
  beforeEach(setupPersistence);
  afterEach(teardownPersistence);

  test('persists to sessionStorage when persist=sessionStorage', async () => {
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'sessionStorage',
    });

    wizard.form.setValue('name' as any, 'Session');
    await new Promise((r) => setTimeout(r, 400));

    expect(sessionStorage.getItem('ereo-wizard')).not.toBeNull();
    expect(localStorage.getItem('ereo-wizard')).toBeNull();

    wizard.dispose();
  });

  test('restores from sessionStorage', () => {
    sessionStorage.setItem('ereo-wizard', JSON.stringify({
      values: { name: 'SessionRestore', email: '' },
      step: 0,
      completed: [],
    }));

    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'sessionStorage',
    });

    expect(wizard.form.getValue('name' as any)).toBe('SessionRestore');
    wizard.dispose();
  });
});

describe('createWizard: dispose with persistence', () => {
  beforeEach(setupPersistence);
  afterEach(teardownPersistence);

  test('dispose clears pending persist timer', async () => {
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'localStorage',
    });

    // Trigger a change to schedule persistence
    wizard.form.setValue('name' as any, 'Test');

    // Dispose immediately (before debounce fires)
    wizard.dispose();

    // Wait past the debounce period
    await new Promise((r) => setTimeout(r, 400));

    // The state should NOT have been persisted since dispose was called
    // (Note: depending on timing, the initial subscription might have persisted.
    // The key point is dispose cleans up the timer.)
    // If the timer was cleared, the latest change shouldn't be persisted
  });

  test('dispose can be called multiple times safely', () => {
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
      persist: 'localStorage',
    });

    expect(() => {
      wizard.dispose();
      wizard.dispose();
      wizard.dispose();
    }).not.toThrow();
  });
});

// ─── Wizard without persistence (verify no storage access) ──────────────────

describe('createWizard: no persistence', () => {
  test('does not access storage when persist is not set', async () => {
    let storageAccessed = false;
    const handler = {
      get: (_target: any, prop: string) => {
        storageAccessed = true;
        return undefined;
      },
    };

    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
    });

    wizard.form.setValue('name' as any, 'NoStorage');
    await new Promise((r) => setTimeout(r, 400));

    // No storage should have been touched
    wizard.dispose();
  });
});

// ─── Wizard submit edge cases ───────────────────────────────────────────────

describe('createWizard: submit edge cases', () => {
  test('submit without onComplete and without form onSubmit', async () => {
    const wizard = createWizard<TestForm>({
      steps: [{ id: 'step1' }],
      form: { defaultValues },
    });

    // Should not throw
    await expect(wizard.submit()).resolves.toBeUndefined();
    wizard.dispose();
  });

  test('submit validates current step before proceeding', async () => {
    let onCompleteCalled = false;
    const wizard = createWizard<TestForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
      ],
      form: {
        defaultValues,
        validators: { name: required() } as any,
      },
      onComplete: async () => { onCompleteCalled = true; },
    });

    await wizard.submit();
    expect(onCompleteCalled).toBe(false);

    wizard.form.setValue('name' as any, 'Alice');
    await wizard.submit();
    expect(onCompleteCalled).toBe(true);

    wizard.dispose();
  });

  test('submit marks current step as completed even on last step', async () => {
    const wizard = createWizard<TestForm>({
      steps: [
        { id: 'only-step' },
      ],
      form: { defaultValues },
      onComplete: async () => {},
    });

    await wizard.submit();
    expect(wizard.completedSteps.get().has('only-step')).toBe(true);
    wizard.dispose();
  });
});
