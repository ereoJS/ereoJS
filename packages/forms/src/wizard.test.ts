import { describe, expect, test, beforeEach } from 'bun:test';
import { createWizard } from './wizard';
import { required } from './validators';
import type { WizardHelpers } from './wizard';

interface WizardForm {
  name: string;
  email: string;
  bio: string;
}

const defaultValues: WizardForm = {
  name: '',
  email: '',
  bio: '',
};

describe('createWizard', () => {
  let wizard: WizardHelpers<WizardForm>;

  beforeEach(() => {
    wizard = createWizard<WizardForm>({
      steps: [
        { id: 'personal', fields: ['name' as any] },
        { id: 'contact', fields: ['email' as any] },
        { id: 'about', fields: ['bio' as any] },
      ],
      form: {
        defaultValues,
        validators: {
          name: required(),
          email: required(),
        } as any,
      },
    });
  });

  describe('initial state', () => {
    test('starts at step 0', () => {
      expect(wizard.currentStep.get()).toBe(0);
    });

    test('state reflects initial position', () => {
      const state = wizard.state;
      expect(state.currentStep).toBe(0);
      expect(state.currentStepId).toBe('personal');
      expect(state.isFirst).toBe(true);
      expect(state.isLast).toBe(false);
      expect(state.totalSteps).toBe(3);
      expect(state.progress).toBe(0);
    });

    test('no completed steps initially', () => {
      expect(wizard.completedSteps.get().size).toBe(0);
    });
  });

  describe('next()', () => {
    test('blocks when fields are invalid', async () => {
      // name is required but empty
      const result = await wizard.next();
      expect(result).toBe(false);
      expect(wizard.currentStep.get()).toBe(0);
    });

    test('advances when fields are valid', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      const result = await wizard.next();
      expect(result).toBe(true);
      expect(wizard.currentStep.get()).toBe(1);
    });

    test('marks step as completed on advance', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      await wizard.next();
      expect(wizard.completedSteps.get().has('personal')).toBe(true);
    });

    test('does not advance past last step', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      wizard.form.setValue('email' as any, 'alice@test.com');

      await wizard.next(); // 0 → 1
      await wizard.next(); // 1 → 2
      await wizard.next(); // 2 → 2 (stays)

      expect(wizard.currentStep.get()).toBe(2);
    });
  });

  describe('prev()', () => {
    test('goes back without validation', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      await wizard.next();
      expect(wizard.currentStep.get()).toBe(1);

      wizard.prev();
      expect(wizard.currentStep.get()).toBe(0);
    });

    test('does not go below step 0', () => {
      wizard.prev();
      expect(wizard.currentStep.get()).toBe(0);
    });
  });

  describe('goTo()', () => {
    test('jumps to step by index', () => {
      wizard.goTo(2);
      expect(wizard.currentStep.get()).toBe(2);
    });

    test('jumps to step by id', () => {
      wizard.goTo('about');
      expect(wizard.currentStep.get()).toBe(2);
    });

    test('does nothing for invalid index', () => {
      wizard.goTo(10);
      expect(wizard.currentStep.get()).toBe(0);
    });

    test('does nothing for invalid id', () => {
      wizard.goTo('nonexistent');
      expect(wizard.currentStep.get()).toBe(0);
    });
  });

  describe('completedSteps tracking', () => {
    test('tracks multiple completed steps', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      wizard.form.setValue('email' as any, 'alice@test.com');

      await wizard.next(); // complete personal
      await wizard.next(); // complete contact

      const completed = wizard.completedSteps.get();
      expect(completed.has('personal')).toBe(true);
      expect(completed.has('contact')).toBe(true);
      expect(completed.has('about')).toBe(false);
    });
  });

  describe('reset()', () => {
    test('resets step to 0', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      await wizard.next();
      expect(wizard.currentStep.get()).toBe(1);

      wizard.reset();
      expect(wizard.currentStep.get()).toBe(0);
    });

    test('clears completed steps', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      await wizard.next();

      wizard.reset();
      expect(wizard.completedSteps.get().size).toBe(0);
    });

    test('resets form values', async () => {
      wizard.form.setValue('name' as any, 'Alice');
      wizard.reset();
      expect(wizard.form.getValue('name' as any)).toBe('');
    });
  });

  describe('state signals', () => {
    test('progress updates correctly', async () => {
      expect(wizard.state.progress).toBe(0);

      wizard.form.setValue('name' as any, 'Alice');
      await wizard.next();
      expect(wizard.state.progress).toBe(0.5);

      wizard.form.setValue('email' as any, 'alice@test.com');
      await wizard.next();
      expect(wizard.state.progress).toBe(1);
    });

    test('isFirst and isLast update', async () => {
      expect(wizard.state.isFirst).toBe(true);
      expect(wizard.state.isLast).toBe(false);

      wizard.form.setValue('name' as any, 'Alice');
      await wizard.next();
      expect(wizard.state.isFirst).toBe(false);
      expect(wizard.state.isLast).toBe(false);

      wizard.form.setValue('email' as any, 'alice@test.com');
      await wizard.next();
      expect(wizard.state.isFirst).toBe(false);
      expect(wizard.state.isLast).toBe(true);
    });
  });

  describe('canGoNext / canGoPrev', () => {
    test('canGoPrev is false at first step', () => {
      expect(wizard.canGoPrev()).toBe(false);
    });

    test('canGoNext is false at last step', async () => {
      wizard.goTo(2);
      expect(wizard.canGoNext()).toBe(false);
    });

    test('canGoNext is true at non-last step', () => {
      expect(wizard.canGoNext()).toBe(true);
    });
  });

  describe('getStepConfig', () => {
    test('returns step config by index', () => {
      const config = wizard.getStepConfig(0);
      expect(config?.id).toBe('personal');
      expect(config?.fields).toEqual(['name']);
    });

    test('returns undefined for invalid index', () => {
      expect(wizard.getStepConfig(10)).toBeUndefined();
    });
  });

  describe('dispose', () => {
    test('does not throw', () => {
      expect(() => wizard.dispose()).not.toThrow();
    });
  });

  describe('custom step validate', () => {
    test('step validate function blocks next', async () => {
      const w = createWizard<{ value: string }>({
        steps: [
          {
            id: 'step1',
            validate: () => false,
          },
        ],
        form: { defaultValues: { value: '' } },
      });

      const result = await w.next();
      expect(result).toBe(false);
      w.dispose();
    });

    test('step validate function allows next', async () => {
      const w = createWizard<{ value: string }>({
        steps: [
          { id: 'step1', validate: () => true },
          { id: 'step2' },
        ],
        form: { defaultValues: { value: '' } },
      });

      const result = await w.next();
      expect(result).toBe(true);
      expect(w.currentStep.get()).toBe(1);
      w.dispose();
    });
  });
});
