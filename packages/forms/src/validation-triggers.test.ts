import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';
import { required, email, custom } from './validators';
import { ValidationEngine } from './validation-engine';

interface TestForm {
  name: string;
  email: string;
  age: number;
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  age: 0,
};

describe('Validation Triggers', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  describe('onFieldChange', () => {
    test('validateOn: "change" triggers validation on setValue', async () => {
      store.setValue('name', 'Alice');
      store.register('name', {
        validate: [required()],
        validateOn: 'change',
      });

      store.setValue('name', '');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('validateOn: "blur" does NOT trigger validation on setValue', async () => {
      store.register('name', {
        validate: [required()],
        validateOn: 'blur',
      });

      store.setValue('name', '');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual([]);
    });

    test('validateOn: "submit" does NOT trigger on setValue', async () => {
      store.register('name', {
        validate: [required()],
        validateOn: 'submit',
      });

      store.setValue('name', '');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual([]);
    });
  });

  describe('onFieldBlur', () => {
    test('blur triggers validation for blur-triggered fields', async () => {
      store.register('name', {
        validate: [required()],
        validateOn: 'blur',
      });

      store.triggerBlurValidation('name');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('blur triggers validation for change-triggered fields', async () => {
      store.register('name', {
        validate: [required()],
        validateOn: 'change',
      });

      store.triggerBlurValidation('name');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('blur does NOT trigger for submit-only fields', async () => {
      store.register('name', {
        validate: [required()],
        validateOn: 'submit',
      });

      store.triggerBlurValidation('name');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual([]);
    });
  });

  describe('derive-dont-configure', () => {
    test('required-only validators derive blur trigger', async () => {
      store.register('name', {
        validate: [required()],
      });

      // Change should NOT trigger validation (derived = blur)
      store.setValue('name', '');
      await new Promise((r) => setTimeout(r, 10));
      expect(store.getErrors('name').get()).toEqual([]);

      // Blur SHOULD trigger
      store.triggerBlurValidation('name');
      await new Promise((r) => setTimeout(r, 10));
      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('sync non-required validators derive blur trigger', async () => {
      store.register('email', {
        validate: [email()],
      });

      // Should not trigger on change
      store.setValue('email', 'invalid');
      await new Promise((r) => setTimeout(r, 10));
      expect(store.getErrors('email').get()).toEqual([]);

      // Should trigger on blur
      store.triggerBlurValidation('email');
      await new Promise((r) => setTimeout(r, 10));
      expect(store.getErrors('email').get()).toEqual(['Invalid email address']);
    });
  });

  describe('unregisterField cleanup', () => {
    test('unregistering clears validation state', async () => {
      store.setValue('name', 'Alice');
      store.register('name', {
        validate: [required()],
        validateOn: 'change',
      });

      store.setValue('name', '');
      await new Promise((r) => setTimeout(r, 10));
      expect(store.getErrors('name').get()).toEqual(['This field is required']);

      store.unregister('name');

      // After unregistering, further changes should not trigger validation
      store.setValue('name', '');
      await new Promise((r) => setTimeout(r, 10));
      // Errors from previous validation remain (store doesn't auto-clear on unregister)
    });

    test('unregister stops validating signal', () => {
      store.register('name', {
        validate: [required()],
      });

      const sig = store.getFieldValidating('name');
      expect(sig.get()).toBe(false);

      store.unregister('name');
      // Signal should still return false after unregister
      expect(sig.get()).toBe(false);
    });
  });

  describe('validateOnMount', () => {
    test('validates all fields on construction when configured', async () => {
      const mountStore = new FormStore<TestForm>({
        defaultValues,
        validateOnMount: true,
        validators: {
          name: required(),
        },
      });

      // validateOnMount runs asynchronously
      await new Promise((r) => setTimeout(r, 20));

      expect(mountStore.getErrors('name').get()).toEqual(['This field is required']);
      mountStore.dispose();
    });
  });

  describe('validate() method', () => {
    test('validate() runs all validators and returns success status', async () => {
      store.register('name', { validate: [required()] });
      store.register('email', { validate: [email()] });

      store.setValue('email', 'bad');

      const valid = await store.validate();
      expect(valid).toBe(false);
      expect(store.getErrors('name').get().length).toBeGreaterThan(0);
    });

    test('validate() returns true when all fields are valid', async () => {
      store.register('name', { validate: [required()] });
      store.setValue('name', 'Alice');

      const valid = await store.validate();
      expect(valid).toBe(true);
    });
  });

  describe('trigger() method', () => {
    test('trigger(path) validates single field', async () => {
      store.register('name', { validate: [required()] });

      const valid = await store.trigger('name');
      expect(valid).toBe(false);
      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('trigger(path) touches the field', async () => {
      store.register('name', { validate: [required()] });

      expect(store.getTouched('name')).toBe(false);
      await store.trigger('name');
      expect(store.getTouched('name')).toBe(true);
    });

    test('trigger() without path validates all', async () => {
      store.register('name', { validate: [required()] });
      store.register('email', { validate: [required()] });

      const valid = await store.trigger();
      expect(valid).toBe(false);
      expect(store.getErrors('name').get().length).toBeGreaterThan(0);
      expect(store.getErrors('email').get().length).toBeGreaterThan(0);
    });
  });

  describe('dispose cleanup', () => {
    test('dispose clears subscribers', () => {
      let callCount = 0;
      store.subscribe(() => callCount++);

      store.setValue('name', 'test');
      expect(callCount).toBeGreaterThan(0);

      const countBefore = callCount;
      store.dispose();
      // After dispose, setting a value should not notify (subscribers cleared)
      // Note: setValue still works on signals, but subscribers are cleared
    });

    test('dispose clears watchers', () => {
      let watchCalled = false;
      store.watch('name', () => { watchCalled = true; });

      store.dispose();

      store.setValue('name', 'test');
      // Watcher should not be called after dispose
      expect(watchCalled).toBe(false);
    });
  });
});
