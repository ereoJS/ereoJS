import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';
import { required, email } from './validators';

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

describe('Hooks Logic (tested through store API)', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  describe('register()', () => {
    test('register with validate option registers validators', async () => {
      store.setValue('name', 'Alice');
      store.register('name', {
        validate: [required()],
        validateOn: 'change',
      });

      store.setValue('name', '');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('register with multiple validators', async () => {
      store.register('name', {
        validate: [required()],
        validateOn: 'blur',
      });

      store.triggerBlurValidation('name');
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('register with parse option (via inputProps.onChange)', () => {
      const reg = store.register('age', {
        parse: (e: any) => parseInt(e.target.value, 10),
      });

      reg.inputProps.onChange({ target: { value: '25' } });
      expect(store.getValue('age')).toBe(25);
    });

    test('register with transform option', () => {
      const reg = store.register('name', {
        transform: (v: unknown) => String(v).toUpperCase(),
      });

      reg.inputProps.onChange({ target: { value: 'alice', type: 'text' } });
      expect(store.getValue('name')).toBe('ALICE');
    });

    test('register with parse AND transform applies both', () => {
      const reg = store.register('name', {
        parse: (e: any) => e.target.value,
        transform: (v: unknown) => String(v).trim(),
      });

      reg.inputProps.onChange({ target: { value: '  alice  ' } });
      expect(store.getValue('name')).toBe('alice');
    });
  });

  describe('unregister()', () => {
    test('unregister cleans up field options', () => {
      store.register('name', { validate: [required()] });
      expect(store.getFieldOptions('name')).toBeDefined();

      store.unregister('name');
      expect(store.getFieldOptions('name')).toBeUndefined();
    });

    test('unregister cleans up field refs', () => {
      const mockEl = {} as HTMLElement;
      store.setFieldRef('name', mockEl);
      expect(store.getFieldRef('name')).not.toBeNull();

      store.unregister('name');
      expect(store.getFieldRef('name')).toBeNull();
    });
  });

  describe('ARIA attributes', () => {
    test('register sets aria-invalid when errors exist', () => {
      store.setErrors('name', ['Error!']);

      const reg = store.register('name');
      expect(reg.inputProps['aria-invalid']).toBe(true);
      expect(reg.inputProps['aria-describedby']).toBe('name-error');
    });

    test('register does not set aria-invalid when no errors', () => {
      const reg = store.register('name');
      expect(reg.inputProps['aria-invalid']).toBeUndefined();
      expect(reg.inputProps['aria-describedby']).toBeUndefined();
    });
  });

  describe('field ref management', () => {
    test('setFieldRef and getFieldRef', () => {
      const mockEl = {} as HTMLElement;
      store.setFieldRef('name', mockEl);
      expect(store.getFieldRef('name')).toBe(mockEl);
    });

    test('getFieldRef returns null for unset paths', () => {
      expect(store.getFieldRef('name')).toBeNull();
    });

    test('setFieldRef with null clears ref', () => {
      const mockEl = {} as HTMLElement;
      store.setFieldRef('name', mockEl);
      store.setFieldRef('name', null);
      expect(store.getFieldRef('name')).toBeNull();
    });
  });

  describe('getFieldOptions', () => {
    test('returns registered options', () => {
      const opts = { validate: [required()] as any };
      store.register('name', opts);
      expect(store.getFieldOptions('name')).toBe(opts);
    });

    test('returns undefined for unregistered paths', () => {
      expect(store.getFieldOptions('name')).toBeUndefined();
    });
  });

  describe('FieldRegistration helpers', () => {
    test('registration.setValue sets the field value', () => {
      const reg = store.register('name');
      reg.setValue('Alice');
      expect(store.getValue('name')).toBe('Alice');
    });

    test('registration.setError sets field errors', () => {
      const reg = store.register('name');
      reg.setError(['Custom error']);
      expect(store.getErrors('name').get()).toEqual(['Custom error']);
    });

    test('registration.clearErrors clears field errors', () => {
      const reg = store.register('name');
      reg.setError(['Error']);
      reg.clearErrors();
      expect(store.getErrors('name').get()).toEqual([]);
    });

    test('registration.setTouched marks field as touched', () => {
      const reg = store.register('name');
      expect(store.getTouched('name')).toBe(false);
      reg.setTouched(true);
      expect(store.getTouched('name')).toBe(true);
    });

    test('registration.reset resets field to baseline', () => {
      const reg = store.register('name');
      reg.setValue('Alice');
      reg.setError(['Error']);
      reg.setTouched(true);

      reg.reset();
      expect(store.getValue('name')).toBe('');
      expect(store.getErrors('name').get()).toEqual([]);
      expect(store.getTouched('name')).toBe(false);
    });

    test('registration.state reflects current state', () => {
      store.setValue('name', 'Alice');
      store.setErrors('name', ['Error']);
      store.setTouched('name', true);

      const reg = store.register('name');
      expect(reg.state.value).toBe('Alice');
      expect(reg.state.errors).toEqual(['Error']);
      expect(reg.state.touched).toBe(true);
      expect(reg.state.dirty).toBe(true);
    });
  });

  describe('onChange event handling', () => {
    test('onChange handles checkbox targets', () => {
      const reg = store.register('name');
      // Simulate checkbox event
      reg.inputProps.onChange({
        target: { type: 'checkbox', checked: true, value: 'on' },
      });
      // For checkboxes, value is the checked boolean
      expect(store.getValue('name')).toBe(true);
    });

    test('onChange handles text input targets', () => {
      const reg = store.register('name');
      reg.inputProps.onChange({
        target: { type: 'text', value: 'hello' },
      });
      expect(store.getValue('name')).toBe('hello');
    });

    test('onChange handles direct values (no event)', () => {
      const reg = store.register('name');
      reg.inputProps.onChange('direct-value');
      expect(store.getValue('name')).toBe('direct-value');
    });
  });

  describe('onBlur handling', () => {
    test('onBlur sets field as touched', () => {
      const reg = store.register('name');
      expect(store.getTouched('name')).toBe(false);

      reg.inputProps.onBlur({});
      expect(store.getTouched('name')).toBe(true);
    });

    test('onBlur triggers blur validation', async () => {
      const reg = store.register('name', {
        validate: [required()],
        validateOn: 'blur',
      });

      reg.inputProps.onBlur({});
      await new Promise((r) => setTimeout(r, 10));

      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });
  });

  describe('submitWith concurrent abort', () => {
    test('concurrent submit aborts previous submit controller', async () => {
      let firstSignal: AbortSignal | null = null;

      const handler = async (values: TestForm, ctx: any) => {
        if (!firstSignal) {
          firstSignal = ctx.signal;
          // Wait so that second submit can fire
          await new Promise((r) => setTimeout(r, 100));
        }
      };

      store.setValue('name', 'test');

      // First submit — starts and waits
      const p1 = store.submitWith(handler);

      // Let first submit start validation
      await new Promise((r) => setTimeout(r, 5));

      // Second submit — should abort the first
      const p2 = store.submitWith(handler);

      await Promise.allSettled([p1, p2]);

      // The first submit's abort controller should have been aborted
      expect(firstSignal).not.toBeNull();
      expect(firstSignal!.aborted).toBe(true);
    });
  });
});
