import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { createWizard } from './wizard';
import { required, minLength, async as asyncValidator } from './validators';
import type { WizardHelpers } from './wizard';

// ─── Test Interfaces ──────────────────────────────────────────────────────────

interface WizardForm {
  name: string;
  email: string;
  bio: string;
  password: string;
}

const defaultValues: WizardForm = {
  name: '',
  email: '',
  bio: '',
  password: '',
};

const tick = () => new Promise((r) => setTimeout(r, 10));

// ─── Wizard submit() ──────────────────────────────────────────────────────────

describe('createWizard: submit()', () => {
  test('calls onComplete handler with form values', async () => {
    let submittedValues: WizardForm | null = null;

    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
        { id: 'step2', fields: ['email' as any] },
      ],
      form: { defaultValues },
      onComplete: async (values) => {
        submittedValues = values as WizardForm;
      },
    });

    wizard.form.setValue('name' as any, 'Alice');
    await wizard.next();
    wizard.form.setValue('email' as any, 'alice@test.com');
    await wizard.submit();

    expect(submittedValues).not.toBeNull();
    expect(submittedValues!.name).toBe('Alice');
    expect(submittedValues!.email).toBe('alice@test.com');
    wizard.dispose();
  });

  test('marks last step as completed on submit', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1' },
        { id: 'step2' },
      ],
      form: { defaultValues },
      onComplete: async () => {},
    });

    wizard.goTo(1); // Jump to last step
    await wizard.submit();

    expect(wizard.completedSteps.get().has('step2')).toBe(true);
    wizard.dispose();
  });

  test('submit does not proceed when validation fails', async () => {
    let submitCalled = false;

    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
      ],
      form: {
        defaultValues,
        validators: { name: required() } as any,
      },
      onComplete: async () => {
        submitCalled = true;
      },
    });

    // name is empty but required
    await wizard.submit();
    expect(submitCalled).toBe(false);
    wizard.dispose();
  });

  test('submit uses step validate function', async () => {
    let submitCalled = false;

    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1', validate: () => false },
      ],
      form: { defaultValues },
      onComplete: async () => {
        submitCalled = true;
      },
    });

    await wizard.submit();
    expect(submitCalled).toBe(false);
    wizard.dispose();
  });

  test('submit falls back to form handleSubmit when no onComplete', async () => {
    let formSubmitCalled = false;

    const wizard = createWizard<WizardForm>({
      steps: [{ id: 'step1' }],
      form: {
        defaultValues,
        onSubmit: async () => {
          formSubmitCalled = true;
        },
      },
    });

    await wizard.submit();
    expect(formSubmitCalled).toBe(true);
    wizard.dispose();
  });
});

// ─── Wizard with async step validation ────────────────────────────────────────

describe('createWizard: async step validation', () => {
  test('handles async step validate function returning false', async () => {
    const wizard = createWizard<{ value: string }>({
      steps: [
        {
          id: 'step1',
          validate: async () => {
            await tick();
            return false;
          },
        },
        { id: 'step2' },
      ],
      form: { defaultValues: { value: '' } },
    });

    const result = await wizard.next();
    expect(result).toBe(false);
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  test('handles async step validate function returning true', async () => {
    const wizard = createWizard<{ value: string }>({
      steps: [
        {
          id: 'step1',
          validate: async () => {
            await tick();
            return true;
          },
        },
        { id: 'step2' },
      ],
      form: { defaultValues: { value: '' } },
    });

    const result = await wizard.next();
    expect(result).toBe(true);
    expect(wizard.currentStep.get()).toBe(1);
    wizard.dispose();
  });
});

// ─── Single step wizard ───────────────────────────────────────────────────────

describe('createWizard: single step wizard', () => {
  test('progress is 1 with single step', () => {
    const wizard = createWizard<{ value: string }>({
      steps: [{ id: 'only' }],
      form: { defaultValues: { value: '' } },
    });

    expect(wizard.state.progress).toBe(1);
    expect(wizard.state.isFirst).toBe(true);
    expect(wizard.state.isLast).toBe(true);
    wizard.dispose();
  });

  test('canGoNext is false with single step', () => {
    const wizard = createWizard<{ value: string }>({
      steps: [{ id: 'only' }],
      form: { defaultValues: { value: '' } },
    });

    expect(wizard.canGoNext()).toBe(false);
    expect(wizard.canGoPrev()).toBe(false);
    wizard.dispose();
  });

  test('next does not change step on single step wizard', async () => {
    const wizard = createWizard<{ value: string }>({
      steps: [{ id: 'only' }],
      form: { defaultValues: { value: '' } },
    });

    await wizard.next();
    expect(wizard.currentStep.get()).toBe(0);
    // But the step should still be marked completed
    expect(wizard.completedSteps.get().has('only')).toBe(true);
    wizard.dispose();
  });
});

// ─── Wizard goTo edge cases ───────────────────────────────────────────────────

describe('createWizard: goTo edge cases', () => {
  let wizard: WizardHelpers<WizardForm>;

  beforeEach(() => {
    wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1' },
        { id: 'step2' },
        { id: 'step3' },
      ],
      form: { defaultValues },
    });
  });

  test('goTo with negative index does nothing', () => {
    wizard.goTo(-1);
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  test('goTo with exact boundary (0) works', () => {
    wizard.goTo(2);
    wizard.goTo(0);
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  test('goTo with index equal to steps.length does nothing', () => {
    wizard.goTo(3); // steps.length is 3, valid indices are 0-2
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  test('goTo with string id after goTo to different step', () => {
    wizard.goTo('step3');
    expect(wizard.currentStep.get()).toBe(2);
    wizard.goTo('step1');
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });
});

// ─── Wizard step data accumulation ────────────────────────────────────────────

describe('createWizard: step data accumulation', () => {
  test('form values persist across step navigation', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
        { id: 'step2', fields: ['email' as any] },
        { id: 'step3', fields: ['bio' as any] },
      ],
      form: { defaultValues },
    });

    // Fill step 1
    wizard.form.setValue('name' as any, 'Alice');
    await wizard.next();

    // Fill step 2
    wizard.form.setValue('email' as any, 'alice@test.com');
    await wizard.next();

    // Fill step 3
    wizard.form.setValue('bio' as any, 'Hello world');

    // All values should be accumulated
    const values = wizard.form.getValues();
    expect(values.name).toBe('Alice');
    expect(values.email).toBe('alice@test.com');
    expect(values.bio).toBe('Hello world');
    wizard.dispose();
  });

  test('going back preserves previously entered data', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
        { id: 'step2', fields: ['email' as any] },
      ],
      form: { defaultValues },
    });

    wizard.form.setValue('name' as any, 'Alice');
    await wizard.next();

    wizard.form.setValue('email' as any, 'alice@test.com');
    wizard.prev();

    // Back at step 1, but email should still be set
    expect(wizard.form.getValue('name' as any)).toBe('Alice');
    expect(wizard.form.getValue('email' as any)).toBe('alice@test.com');
    wizard.dispose();
  });
});

// ─── Wizard reset clears form data ───────────────────────────────────────────

describe('createWizard: reset clears everything', () => {
  test('reset clears form values, step, and completed', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1', fields: ['name' as any] },
        { id: 'step2', fields: ['email' as any] },
      ],
      form: { defaultValues },
    });

    wizard.form.setValue('name' as any, 'Alice');
    await wizard.next();
    wizard.form.setValue('email' as any, 'alice@test.com');

    expect(wizard.currentStep.get()).toBe(1);
    expect(wizard.completedSteps.get().size).toBe(1);

    wizard.reset();

    expect(wizard.currentStep.get()).toBe(0);
    expect(wizard.completedSteps.get().size).toBe(0);
    expect(wizard.form.getValue('name' as any)).toBe('');
    expect(wizard.form.getValue('email' as any)).toBe('');
    wizard.dispose();
  });

  test('reset restores state properties', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1' },
        { id: 'step2' },
      ],
      form: { defaultValues },
    });

    await wizard.next();
    wizard.reset();

    const state = wizard.state;
    expect(state.isFirst).toBe(true);
    expect(state.isLast).toBe(false);
    expect(state.progress).toBe(0);
    expect(state.currentStepId).toBe('step1');
    wizard.dispose();
  });
});

// ─── Wizard dispose cleanup ──────────────────────────────────────────────────

describe('createWizard: dispose', () => {
  test('dispose can be called multiple times without error', () => {
    const wizard = createWizard<{ value: string }>({
      steps: [{ id: 'step1' }],
      form: { defaultValues: { value: '' } },
    });

    expect(() => {
      wizard.dispose();
      wizard.dispose();
    }).not.toThrow();
  });

  test('wizard still readable after dispose', () => {
    const wizard = createWizard<{ value: string }>({
      steps: [{ id: 'step1' }],
      form: { defaultValues: { value: '' } },
    });

    wizard.dispose();

    // Reading state should not throw
    expect(wizard.currentStep.get()).toBe(0);
    expect(wizard.state.currentStep).toBe(0);
  });
});

// ─── Wizard with both fields and validate ──────────────────────────────────

describe('createWizard: step with both fields and validate', () => {
  test('step validate blocks even when fields are valid', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        {
          id: 'step1',
          fields: ['name' as any],
          validate: () => false,
        },
        { id: 'step2' },
      ],
      form: {
        defaultValues: { ...defaultValues, name: 'Alice' },
      },
    });

    const result = await wizard.next();
    expect(result).toBe(false);
    expect(wizard.currentStep.get()).toBe(0);
    wizard.dispose();
  });

  test('fields fail even when validate passes', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        {
          id: 'step1',
          fields: ['name' as any],
          validate: () => true,
        },
        { id: 'step2' },
      ],
      form: {
        defaultValues,
        validators: { name: required() } as any,
      },
    });

    // validate passes but name is empty and required
    const result = await wizard.next();
    expect(result).toBe(false);
    wizard.dispose();
  });
});

// ─── Wizard touches step fields ──────────────────────────────────────────────

describe('createWizard: step validation touches fields', () => {
  test('next() touches all step fields', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'step1', fields: ['name' as any, 'email' as any] },
        { id: 'step2' },
      ],
      form: {
        defaultValues,
        validators: {
          name: required(),
          email: required(),
        } as any,
      },
    });

    expect(wizard.form.getTouched('name' as any)).toBe(false);
    expect(wizard.form.getTouched('email' as any)).toBe(false);

    await wizard.next(); // Will fail validation but should touch fields

    expect(wizard.form.getTouched('name' as any)).toBe(true);
    expect(wizard.form.getTouched('email' as any)).toBe(true);
    wizard.dispose();
  });
});

// ─── Wizard step with no fields ──────────────────────────────────────────────

describe('createWizard: step with no fields', () => {
  test('advances freely when step has no fields', async () => {
    const wizard = createWizard<{ value: string }>({
      steps: [
        { id: 'info' },
        { id: 'details' },
      ],
      form: { defaultValues: { value: '' } },
    });

    const result = await wizard.next();
    expect(result).toBe(true);
    expect(wizard.currentStep.get()).toBe(1);
    wizard.dispose();
  });
});

// ─── Wizard currentStepId ────────────────────────────────────────────────────

describe('createWizard: currentStepId tracking', () => {
  test('currentStepId updates as steps change', async () => {
    const wizard = createWizard<WizardForm>({
      steps: [
        { id: 'personal' },
        { id: 'contact' },
        { id: 'review' },
      ],
      form: { defaultValues },
    });

    expect(wizard.state.currentStepId).toBe('personal');

    await wizard.next();
    expect(wizard.state.currentStepId).toBe('contact');

    await wizard.next();
    expect(wizard.state.currentStepId).toBe('review');

    wizard.prev();
    expect(wizard.state.currentStepId).toBe('contact');
    wizard.dispose();
  });
});

// ─── Wizard: getStepConfig for all indices ───────────────────────────────────

describe('createWizard: getStepConfig edge cases', () => {
  test('returns undefined for negative index', () => {
    const wizard = createWizard<{ value: string }>({
      steps: [{ id: 'step1' }],
      form: { defaultValues: { value: '' } },
    });

    expect(wizard.getStepConfig(-1)).toBeUndefined();
    wizard.dispose();
  });

  test('returns config for valid index', () => {
    const wizard = createWizard<{ value: string }>({
      steps: [
        { id: 'a', fields: [] },
        { id: 'b', fields: [] },
      ],
      form: { defaultValues: { value: '' } },
    });

    expect(wizard.getStepConfig(0)?.id).toBe('a');
    expect(wizard.getStepConfig(1)?.id).toBe('b');
    wizard.dispose();
  });
});

// ─── Wizard many steps ──────────────────────────────────────────────────────

describe('createWizard: many steps', () => {
  test('handles 5+ steps correctly', async () => {
    const wizard = createWizard<{ value: string }>({
      steps: [
        { id: 's1' },
        { id: 's2' },
        { id: 's3' },
        { id: 's4' },
        { id: 's5' },
      ],
      form: { defaultValues: { value: '' } },
    });

    // Navigate through all
    for (let i = 0; i < 4; i++) {
      await wizard.next();
    }
    expect(wizard.currentStep.get()).toBe(4);
    expect(wizard.state.isLast).toBe(true);

    // Progress at 4/4 = 1
    expect(wizard.state.progress).toBe(1);

    // All but last should be completed
    expect(wizard.completedSteps.get().size).toBe(4);
    expect(wizard.completedSteps.get().has('s1')).toBe(true);
    expect(wizard.completedSteps.get().has('s2')).toBe(true);
    expect(wizard.completedSteps.get().has('s3')).toBe(true);
    expect(wizard.completedSteps.get().has('s4')).toBe(true);

    // Navigate all the way back
    for (let i = 0; i < 4; i++) {
      wizard.prev();
    }
    expect(wizard.currentStep.get()).toBe(0);
    expect(wizard.state.isFirst).toBe(true);
    wizard.dispose();
  });
});
