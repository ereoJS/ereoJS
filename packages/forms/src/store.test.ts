import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore, createFormStore } from './store';

interface TestForm {
  name: string;
  email: string;
  age: number;
  address: {
    city: string;
    zip: string;
  };
  tags: string[];
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  age: 0,
  address: {
    city: '',
    zip: '',
  },
  tags: [],
};

describe('FormStore', () => {
  let store: FormStore<TestForm>;

  beforeEach(() => {
    store = new FormStore<TestForm>({ defaultValues });
  });

  describe('creation', () => {
    test('creates store with default values', () => {
      expect(store.getValue('name')).toBe('');
      expect(store.getValue('email')).toBe('');
      expect(store.getValue('age')).toBe(0);
    });

    test('createFormStore factory works', () => {
      const s = createFormStore({ defaultValues });
      expect(s).toBeInstanceOf(FormStore);
      expect(s.getValue('name')).toBe('');
    });
  });

  describe('getValue / setValue', () => {
    test('sets and gets top-level values', () => {
      store.setValue('name', 'Alice');
      expect(store.getValue('name')).toBe('Alice');
    });

    test('sets and gets nested values', () => {
      store.setValue('address.city', 'NYC');
      expect(store.getValue('address.city')).toBe('NYC');
    });

    test('sets and gets array values', () => {
      store.setValue('tags', ['a', 'b']);
      expect(store.getValue('tags')).toEqual(['a', 'b']);
    });

    test('does not trigger if value is the same', () => {
      store.setValue('name', '');
      expect(store.getDirty('name')).toBe(false);
    });
  });

  describe('setValues', () => {
    test('sets multiple values at once', () => {
      store.setValues({ name: 'Bob', email: 'bob@test.com' });
      expect(store.getValue('name')).toBe('Bob');
      expect(store.getValue('email')).toBe('bob@test.com');
    });
  });

  describe('signals', () => {
    test('getSignal returns a signal for the path', () => {
      const sig = store.getSignal('name');
      expect(sig.get()).toBe('');

      store.setValue('name', 'Charlie');
      expect(sig.get()).toBe('Charlie');
    });

    test('lazy signal creation for unknown paths', () => {
      const sig = store.getSignal('nonexistent.path');
      expect(sig.get()).toBeUndefined();
    });
  });

  describe('dirty tracking', () => {
    test('field is clean initially', () => {
      expect(store.getDirty('name')).toBe(false);
      expect(store.isDirty.get()).toBe(false);
    });

    test('field becomes dirty when changed', () => {
      store.setValue('name', 'Alice');
      expect(store.getDirty('name')).toBe(true);
      expect(store.isDirty.get()).toBe(true);
    });

    test('field becomes clean when set back to baseline', () => {
      store.setValue('name', 'Alice');
      expect(store.getDirty('name')).toBe(true);

      store.setValue('name', '');
      expect(store.getDirty('name')).toBe(false);
      expect(store.isDirty.get()).toBe(false);
    });
  });

  describe('touched tracking', () => {
    test('field is not touched initially', () => {
      expect(store.getTouched('name')).toBe(false);
    });

    test('field becomes touched', () => {
      store.setTouched('name');
      expect(store.getTouched('name')).toBe(true);
    });

    test('field can be untouched', () => {
      store.setTouched('name');
      store.setTouched('name', false);
      expect(store.getTouched('name')).toBe(false);
    });
  });

  describe('error management', () => {
    test('no errors initially', () => {
      expect(store.getErrors('name').get()).toEqual([]);
    });

    test('sets field errors', () => {
      store.setErrors('name', ['Required']);
      expect(store.getErrors('name').get()).toEqual(['Required']);
      expect(store.isValid.get()).toBe(false);
    });

    test('clears field errors', () => {
      store.setErrors('name', ['Required']);
      store.clearErrors('name');
      expect(store.getErrors('name').get()).toEqual([]);
      expect(store.isValid.get()).toBe(true);
    });

    test('clears all errors', () => {
      store.setErrors('name', ['Required']);
      store.setErrors('email', ['Invalid']);
      store.clearErrors();
      expect(store.getErrors('name').get()).toEqual([]);
      expect(store.getErrors('email').get()).toEqual([]);
      expect(store.isValid.get()).toBe(true);
    });

    test('form-level errors', () => {
      store.setFormErrors(['Server error']);
      expect(store.getFormErrors().get()).toEqual(['Server error']);
      expect(store.isValid.get()).toBe(false);

      store.clearErrors();
      expect(store.getFormErrors().get()).toEqual([]);
      expect(store.isValid.get()).toBe(true);
    });
  });

  describe('register', () => {
    test('returns input props', () => {
      const reg = store.register('name');
      expect(reg.inputProps.name).toBe('name');
      expect(reg.inputProps.value).toBe('');
      expect(typeof reg.inputProps.onChange).toBe('function');
      expect(typeof reg.inputProps.onBlur).toBe('function');
    });

    test('returns state', () => {
      const reg = store.register('name');
      expect(reg.state.value).toBe('');
      expect(reg.state.errors).toEqual([]);
      expect(reg.state.touched).toBe(false);
      expect(reg.state.dirty).toBe(false);
    });

    test('setValue updates field', () => {
      const reg = store.register<string>('name');
      reg.setValue('Dave');
      expect(store.getValue('name')).toBe('Dave');
    });

    test('setError sets errors', () => {
      const reg = store.register('name');
      reg.setError(['Required']);
      expect(store.getErrors('name').get()).toEqual(['Required']);
    });

    test('clearErrors clears field errors', () => {
      const reg = store.register('name');
      reg.setError(['Required']);
      reg.clearErrors();
      expect(store.getErrors('name').get()).toEqual([]);
    });

    test('setTouched marks field', () => {
      const reg = store.register('name');
      reg.setTouched(true);
      expect(store.getTouched('name')).toBe(true);
    });

    test('reset restores baseline value', () => {
      const reg = store.register<string>('name');
      reg.setValue('Modified');
      reg.setError(['Error']);
      reg.setTouched(true);
      reg.reset();
      expect(store.getValue('name')).toBe('');
      expect(store.getErrors('name').get()).toEqual([]);
      expect(store.getTouched('name')).toBe(false);
    });

    test('onChange with event-like object', () => {
      const reg = store.register('name');
      reg.inputProps.onChange({ target: { value: 'FromEvent', type: 'text' } });
      expect(store.getValue('name')).toBe('FromEvent');
    });

    test('onChange with checkbox event', () => {
      const reg = store.register('agree');
      reg.inputProps.onChange({ target: { checked: true, type: 'checkbox' } });
      expect(store.getValue('agree')).toBe(true);
    });

    test('onChange with raw value', () => {
      const reg = store.register<number>('age');
      reg.inputProps.onChange(25);
      expect(store.getValue('age')).toBe(25);
    });

    test('onBlur marks field as touched', () => {
      const reg = store.register('name');
      reg.inputProps.onBlur({});
      expect(store.getTouched('name')).toBe(true);
    });

    test('ARIA attributes set when errors present', () => {
      store.setErrors('name', ['Required']);
      const reg = store.register('name');
      expect(reg.inputProps['aria-invalid']).toBe(true);
      expect(reg.inputProps['aria-describedby']).toBe('name-error');
    });
  });

  describe('reset', () => {
    test('resets to default values', () => {
      store.setValue('name', 'Alice');
      store.setTouched('name');
      store.setErrors('name', ['Error']);
      store.reset();

      expect(store.getValue('name')).toBe('');
      expect(store.getTouched('name')).toBe(false);
      expect(store.getDirty('name')).toBe(false);
      expect(store.getErrors('name').get()).toEqual([]);
      expect(store.isDirty.get()).toBe(false);
      expect(store.submitState.get()).toBe('idle');
    });
  });

  describe('resetTo', () => {
    test('resets to new values', () => {
      store.setValue('name', 'Alice');
      store.resetTo({ ...defaultValues, name: 'Bob' });

      expect(store.getValue('name')).toBe('Bob');
      expect(store.getTouched('name')).toBe(false);
      expect(store.getDirty('name')).toBe(false);
    });
  });

  describe('setBaseline', () => {
    test('recalculates dirty from new baseline', () => {
      store.setValue('name', 'Alice');
      expect(store.getDirty('name')).toBe(true);

      store.setBaseline({ ...defaultValues, name: 'Alice' });
      expect(store.getDirty('name')).toBe(false);
      expect(store.isDirty.get()).toBe(false);
    });
  });

  describe('getChanges', () => {
    test('returns only dirty fields', () => {
      store.setValue('name', 'Alice');
      store.setValue('email', 'alice@test.com');
      const changes = store.getChanges();
      expect(changes).toHaveProperty('name', 'Alice');
      expect(changes).toHaveProperty('email', 'alice@test.com');
    });

    test('returns empty when no changes', () => {
      const changes = store.getChanges();
      expect(Object.keys(changes)).toHaveLength(0);
    });
  });

  describe('watch', () => {
    test('watches a field for changes', () => {
      const values: unknown[] = [];
      store.watch('name', (v) => values.push(v));

      store.setValue('name', 'Alice');
      store.setValue('name', 'Bob');

      expect(values).toEqual(['Alice', 'Bob']);
    });

    test('unsubscribes from watch', () => {
      const values: unknown[] = [];
      const unsub = store.watch('name', (v) => values.push(v));

      store.setValue('name', 'Alice');
      unsub();
      store.setValue('name', 'Bob');

      expect(values).toEqual(['Alice']);
    });
  });

  describe('watchFields', () => {
    test('watches multiple fields', () => {
      const events: string[] = [];
      store.watchFields(['name', 'email'], (v, path) => events.push(path));

      store.setValue('name', 'Alice');
      store.setValue('email', 'alice@test.com');
      store.setValue('age', 30);

      expect(events).toEqual(['name', 'email']);
    });
  });

  describe('subscribe', () => {
    test('notifies on any change', () => {
      let count = 0;
      store.subscribe(() => count++);

      store.setValue('name', 'Alice');
      expect(count).toBeGreaterThan(0);
    });

    test('unsubscribes', () => {
      let count = 0;
      const unsub = store.subscribe(() => count++);

      store.setValue('name', 'Alice');
      const countAfterFirst = count;
      unsub();
      store.setValue('name', 'Bob');
      expect(count).toBe(countAfterFirst);
    });
  });

  describe('serialization', () => {
    test('toJSON returns current values', () => {
      store.setValue('name', 'Alice');
      const json = store.toJSON();
      expect(json.name).toBe('Alice');
    });

    test('toFormData returns FormData', () => {
      store.setValue('name', 'Alice');
      store.setValue('email', 'alice@test.com');
      const fd = store.toFormData();
      expect(fd.get('name')).toBe('Alice');
      expect(fd.get('email')).toBe('alice@test.com');
    });
  });

  describe('handleSubmit', () => {
    test('calls onSubmit handler', async () => {
      let submitted: TestForm | null = null;
      const s = new FormStore<TestForm>({
        defaultValues,
        onSubmit: async (values) => {
          submitted = values;
        },
      });
      s.setValue('name', 'Alice');

      await s.handleSubmit();

      expect(submitted).not.toBeNull();
      expect(submitted!.name).toBe('Alice');
      expect(s.submitState.get()).toBe('success');
      expect(s.submitCount.get()).toBe(1);
    });

    test('does nothing without onSubmit', async () => {
      await store.handleSubmit();
      expect(store.submitState.get()).toBe('idle');
    });

    test('sets error state on rejection', async () => {
      const s = new FormStore<TestForm>({
        defaultValues,
        onSubmit: async () => {
          throw new Error('Server error');
        },
      });

      await expect(s.handleSubmit()).rejects.toThrow('Server error');
      expect(s.submitState.get()).toBe('error');
    });

    test('prevents default on event', async () => {
      let prevented = false;
      const event = { preventDefault: () => { prevented = true; } } as any;

      const s = new FormStore<TestForm>({
        defaultValues,
        onSubmit: async () => {},
      });
      await s.handleSubmit(event);
      expect(prevented).toBe(true);
    });

    test('resets after submit when resetOnSubmit is true', async () => {
      const s = new FormStore<TestForm>({
        defaultValues,
        onSubmit: async () => {},
        resetOnSubmit: true,
      });
      s.setValue('name', 'Alice');
      await s.handleSubmit();
      expect(s.getValue('name')).toBe('');
    });
  });

  describe('submitWith', () => {
    test('submits with alternate handler', async () => {
      let submitted: TestForm | null = null;
      store.setValue('name', 'Alice');

      await store.submitWith(async (values) => {
        submitted = values;
      });

      expect(submitted).not.toBeNull();
      expect(submitted!.name).toBe('Alice');
    });
  });

  describe('getBaseline', () => {
    test('returns a clone, not the internal reference', () => {
      const baseline1 = store.getBaseline();
      const baseline2 = store.getBaseline();
      expect(baseline1).toEqual(baseline2);
      expect(baseline1).not.toBe(baseline2);
    });

    test('mutating returned baseline does not affect dirty tracking', () => {
      const baseline = store.getBaseline();
      baseline.name = 'mutated';
      // Internal baseline should be unaffected
      store.setValue('name', '');
      expect(store.getDirty('name')).toBe(false);
    });
  });

  describe('resetTo cleans orphan error signals', () => {
    test('removes error signals for fields not in new shape', () => {
      store.setErrors('email', ['Invalid']);
      store.setErrors('name', ['Required']);
      expect(store.isValid.get()).toBe(false);

      // Reset to a shape without email
      store.resetTo({ name: 'Bob', age: 0, address: { city: '', zip: '' }, tags: [] } as any);

      // Errors should be cleared, form should be valid
      expect(store.isValid.get()).toBe(true);
    });
  });

  describe('FormData SSR guard', () => {
    test('toFormData works in browser environment', () => {
      store.setValue('name', 'Alice');
      const fd = store.toFormData();
      expect(fd.get('name')).toBe('Alice');
    });
  });

  describe('proxy values', () => {
    test('proxy reads values', () => {
      store.setValue('name', 'Alice');
      expect(store.values.name).toBe('Alice');
    });

    test('proxy writes values', () => {
      store.values.name = 'Bob';
      expect(store.getValue('name')).toBe('Bob');
    });

    test('proxy reads nested values', () => {
      store.setValue('address.city', 'NYC');
      expect(store.values.address.city).toBe('NYC');
    });
  });
});
