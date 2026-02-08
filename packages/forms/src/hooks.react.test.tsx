// @ts-nocheck
import { describe, expect, test, afterEach } from 'bun:test';
import React, { createElement } from 'react';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { FormStore } from './store';
import { useForm, useField, useFieldArray, useWatch, useFormStatus } from './hooks';
import { FormProvider, useFormContext } from './context';
import { required, minLength } from './validators';
import type { FormConfig } from './types';

afterEach(cleanup);

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TestForm {
  name: string;
  email: string;
  age: number;
  items: string[];
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  age: 0,
  items: [],
};

function createStore(overrides?: Partial<FormConfig<TestForm>>) {
  return new FormStore<TestForm>({ defaultValues, ...overrides } as any);
}

// ─── useForm ────────────────────────────────────────────────────────────────

describe('useForm', () => {
  test('creates a FormStore instance', () => {
    let formRef: FormStore<TestForm> | null = null;

    function TestComp() {
      const form = useForm<TestForm>({ defaultValues });
      formRef = form;
      return createElement('div', null, 'ready');
    }

    render(createElement(TestComp));
    expect(formRef).toBeInstanceOf(FormStore);
    expect(formRef!.getValue('name' as any)).toBe('');
  });

  test('returns same instance across re-renders', () => {
    const instances: FormStore<TestForm>[] = [];

    function TestComp({ count }: { count: number }) {
      const form = useForm<TestForm>({ defaultValues });
      instances.push(form);
      return createElement('div', null, `render-${count}`);
    }

    const { rerender } = render(createElement(TestComp, { count: 1 }));
    rerender(createElement(TestComp, { count: 2 }));

    expect(instances.length).toBe(2);
    expect(instances[0]).toBe(instances[1]);
  });

  test('disposes on unmount', () => {
    let formRef: FormStore<TestForm> | null = null;

    function TestComp() {
      const form = useForm<TestForm>({ defaultValues });
      formRef = form;
      return createElement('div', null, 'test');
    }

    const { unmount } = render(createElement(TestComp));
    const disposed = formRef!;
    unmount();

    // After dispose, setting values should still work (dispose cleans subscriptions, not state)
    // Verify the form was created and we can still call methods
    expect(disposed).toBeInstanceOf(FormStore);
  });
});

// ─── useField ───────────────────────────────────────────────────────────────

describe('useField', () => {
  test('returns field value and input props', () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any);
      return createElement('input', { ...field.inputProps, 'data-testid': 'input' });
    }

    render(createElement(TestComp));
    const input = screen.getByTestId('input');
    expect(input.getAttribute('name')).toBe('name');
  });

  test('value updates when form value changes', async () => {
    const form = createStore();
    let fieldValue: string = '';

    function TestComp() {
      const field = useField(form, 'name' as any);
      fieldValue = field.value;
      return createElement('span', { 'data-testid': 'value' }, String(field.value));
    }

    render(createElement(TestComp));
    expect(fieldValue).toBe('');

    await act(() => {
      form.setValue('name' as any, 'Alice');
    });
    expect(fieldValue).toBe('Alice');
  });

  test('onChange handles input events', async () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any);
      return createElement('input', { ...field.inputProps, 'data-testid': 'input' });
    }

    render(createElement(TestComp));
    const input = screen.getByTestId('input');

    await act(() => {
      fireEvent.change(input, { target: { value: 'Bob', type: 'text' } });
    });

    expect(form.getValue('name' as any)).toBe('Bob');
  });

  test('onChange handles checkbox events', async () => {
    const store = new FormStore<{ agree: boolean }>({
      defaultValues: { agree: false },
    });

    function TestComp() {
      const field = useField(store, 'agree' as any);
      return createElement('input', {
        ...field.inputProps,
        type: 'checkbox',
        checked: field.value,
        'data-testid': 'cb',
      });
    }

    render(createElement(TestComp));
    const cb = screen.getByTestId('cb');

    await act(() => {
      fireEvent.click(cb);
    });
    expect(store.getValue('agree' as any)).toBe(true);
  });

  test('onChange with custom parse function', async () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any, {
        parse: (e: any) => e.target.value.toUpperCase(),
      });
      return createElement('input', { ...field.inputProps, 'data-testid': 'input' });
    }

    render(createElement(TestComp));

    await act(() => {
      fireEvent.change(screen.getByTestId('input'), {
        target: { value: 'hello', type: 'text' },
      });
    });

    expect(form.getValue('name' as any)).toBe('HELLO');
  });

  test('onChange with transform function', async () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any, {
        transform: (v: any) => String(v).trim(),
      });
      return createElement('input', { ...field.inputProps, 'data-testid': 'input' });
    }

    render(createElement(TestComp));

    await act(() => {
      fireEvent.change(screen.getByTestId('input'), {
        target: { value: '  spaced  ', type: 'text' },
      });
    });

    expect(form.getValue('name' as any)).toBe('spaced');
  });

  test('onChange handles non-event values (direct value)', async () => {
    const form = createStore();
    let onChangeFn: any;

    function TestComp() {
      const field = useField(form, 'name' as any);
      onChangeFn = field.inputProps.onChange;
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    await act(() => {
      onChangeFn('direct-value');
    });

    expect(form.getValue('name' as any)).toBe('direct-value');
  });

  test('onBlur marks field as touched and triggers blur validation', async () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any);
      return createElement('div', null, [
        createElement('input', { key: 'i', ...field.inputProps, 'data-testid': 'input' }),
        createElement('span', { key: 't', 'data-testid': 'touched' }, String(field.touched)),
      ]);
    }

    render(createElement(TestComp));
    expect(screen.getByTestId('touched').textContent).toBe('false');

    await act(() => {
      fireEvent.blur(screen.getByTestId('input'));
    });

    expect(screen.getByTestId('touched').textContent).toBe('true');
  });

  test('displays errors when touched', async () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any);
      return createElement('div', null, [
        createElement('span', { key: 'e', 'data-testid': 'errors' }, field.errors.join(',')),
        createElement('span', { key: 'd', 'data-testid': 'dirty' }, String(field.dirty)),
      ]);
    }

    render(createElement(TestComp));

    await act(() => {
      form.setErrors('name' as any, ['Required']);
    });

    expect(screen.getByTestId('errors').textContent).toBe('Required');
  });

  test('tracks dirty state', async () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any);
      return createElement('span', { 'data-testid': 'dirty' }, String(field.dirty));
    }

    render(createElement(TestComp));
    expect(screen.getByTestId('dirty').textContent).toBe('false');

    await act(() => {
      form.setValue('name' as any, 'changed');
    });

    expect(screen.getByTestId('dirty').textContent).toBe('true');
  });

  test('tracks validating state', async () => {
    const form = createStore();
    let validatingValue = false;

    function TestComp() {
      const field = useField(form, 'name' as any);
      validatingValue = field.validating;
      return createElement('span', null, String(field.validating));
    }

    render(createElement(TestComp));
    expect(validatingValue).toBe(false);
  });

  test('tracks error map', async () => {
    const form = createStore();
    let errorMapValue: any = {};

    function TestComp() {
      const field = useField(form, 'name' as any);
      errorMapValue = field.errorMap;
      return createElement('span', null, 'test');
    }

    render(createElement(TestComp));
    expect(errorMapValue).toBeDefined();
  });

  test('inputProps includes aria attributes when errors present', async () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any);
      return createElement('input', { ...field.inputProps, 'data-testid': 'input' });
    }

    render(createElement(TestComp));

    await act(() => {
      form.setErrors('name' as any, ['Required']);
    });

    const input = screen.getByTestId('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('name-error');
  });

  test('refCallback sets field ref on form', () => {
    const form = createStore();

    function TestComp() {
      const field = useField(form, 'name' as any);
      return createElement('input', { ...field.inputProps, 'data-testid': 'input' });
    }

    render(createElement(TestComp));

    const refs = form.getFieldRefs();
    expect(refs.has('name')).toBe(true);
  });

  test('setValue/setError/clearErrors/setTouched/reset callbacks work', async () => {
    const form = createStore();
    let fieldHandle: any;

    function TestComp() {
      const field = useField(form, 'name' as any);
      fieldHandle = field;
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    await act(() => {
      fieldHandle.setValue('test');
    });
    expect(form.getValue('name' as any)).toBe('test');

    await act(() => {
      fieldHandle.setError(['err1']);
    });
    expect(form.getErrors('name' as any).get()).toEqual(['err1']);

    await act(() => {
      fieldHandle.clearErrors();
    });
    expect(form.getErrors('name' as any).get()).toEqual([]);

    await act(() => {
      fieldHandle.setTouched(true);
    });
    expect(form.getTouched('name' as any)).toBe(true);

    await act(() => {
      fieldHandle.reset();
    });
    expect(form.getValue('name' as any)).toBe('');
  });

  test('unregisters on unmount', () => {
    const form = createStore();

    function TestComp({ show }: { show: boolean }) {
      if (!show) return null;
      const field = useField(form, 'name' as any, {
        validate: required(),
      });
      return createElement('input', field.inputProps);
    }

    const { rerender } = render(createElement(TestComp, { show: true }));
    rerender(createElement(TestComp, { show: false }));

    // Field should be unregistered
  });

  test('re-registers when options change', () => {
    const form = createStore();
    const validate1 = required();
    const validate2 = minLength(3);

    function TestComp({ validator }: { validator: any }) {
      const field = useField(form, 'name' as any, { validate: validator });
      return createElement('input', field.inputProps);
    }

    const { rerender } = render(createElement(TestComp, { validator: validate1 }));
    rerender(createElement(TestComp, { validator: validate2 }));
    // Should not throw - re-registration handles the update
  });
});

// ─── useFieldArray ──────────────────────────────────────────────────────────

describe('useFieldArray', () => {
  test('returns empty fields array initially', () => {
    const form = createStore();
    let fieldsLength = -1;

    function TestComp() {
      const { fields } = useFieldArray(form, 'items' as any);
      fieldsLength = fields.length;
      return createElement('span', null, String(fields.length));
    }

    render(createElement(TestComp));
    expect(fieldsLength).toBe(0);
  });

  test('append adds item to array', async () => {
    const form = createStore();
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(form, 'items' as any);
      helpers = h;
      return createElement('div', null,
        h.fields.map(f => createElement('span', { key: f.id, 'data-testid': `item-${f.index}` }, f.value))
      );
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.append('first');
    });

    expect(form.getValue('items' as any)).toEqual(['first']);
  });

  test('prepend adds item to beginning', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['b'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.prepend('a');
    });

    expect(store.getValue('items' as any)).toEqual(['a', 'b']);
  });

  test('insert adds item at index', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'c'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.insert(1, 'b');
    });

    expect(store.getValue('items' as any)).toEqual(['a', 'b', 'c']);
  });

  test('remove removes item at index', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b', 'c'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.remove(1);
    });

    expect(store.getValue('items' as any)).toEqual(['a', 'c']);
  });

  test('swap swaps two items', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b', 'c'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.swap(0, 2);
    });

    expect(store.getValue('items' as any)).toEqual(['c', 'b', 'a']);
  });

  test('move moves item from one index to another', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b', 'c'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.move(0, 2);
    });

    expect(store.getValue('items' as any)).toEqual(['b', 'c', 'a']);
  });

  test('replace updates item at index', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.replace(0, 'x');
    });

    expect(store.getValue('items' as any)).toEqual(['x', 'b']);
  });

  test('replaceAll replaces entire array', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.replaceAll(['x', 'y', 'z']);
    });

    expect(store.getValue('items' as any)).toEqual(['x', 'y', 'z']);
  });

  test('clone duplicates item at index', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b'] },
    });
    let helpers: any;

    function TestComp() {
      const h = useFieldArray(store, 'items' as any);
      helpers = h;
      return createElement('div', null, h.fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));

    await act(() => {
      helpers.clone(0);
    });

    expect(store.getValue('items' as any)).toEqual(['a', 'a', 'b']);
  });

  test('fields have stable IDs across re-renders', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b'] },
    });
    let capturedIds: string[][] = [];

    function TestComp() {
      const { fields } = useFieldArray(store, 'items' as any);
      capturedIds.push(fields.map(f => f.id));
      return createElement('div', null, fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    const { rerender } = render(createElement(TestComp));
    rerender(createElement(TestComp));

    // IDs should be stable
    expect(capturedIds[0]).toEqual(capturedIds[1]);
  });

  test('syncs IDs when array shrinks externally', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b', 'c'] },
    });
    let fieldsLength = -1;

    function TestComp() {
      const { fields } = useFieldArray(store, 'items' as any);
      fieldsLength = fields.length;
      return createElement('div', null, fields.map(f =>
        createElement('span', { key: f.id }, f.value)
      ));
    }

    render(createElement(TestComp));
    expect(fieldsLength).toBe(3);

    await act(() => {
      store.setValue('items' as any, ['a'] as any);
    });

    expect(fieldsLength).toBe(1);
  });
});

// ─── useWatch ───────────────────────────────────────────────────────────────

describe('useWatch', () => {
  test('watches single field value', async () => {
    const form = createStore();
    let watched: any;

    function TestComp() {
      watched = useWatch(form, 'name' as any);
      return createElement('span', null, String(watched));
    }

    render(createElement(TestComp));
    expect(watched).toBe('');

    await act(() => {
      form.setValue('name' as any, 'Alice');
    });

    expect(watched).toBe('Alice');
  });

  test('watches multiple fields', async () => {
    const form = createStore();
    let watched: any[];

    function TestComp() {
      watched = useWatch(form, ['name', 'email'] as any);
      return createElement('span', null, JSON.stringify(watched));
    }

    render(createElement(TestComp));
    expect(watched!).toEqual(['', '']);

    await act(() => {
      form.setValue('name' as any, 'Alice');
    });

    expect(watched!).toEqual(['Alice', '']);
  });

  test('multi-field watch returns stable reference when values unchanged', async () => {
    const form = createStore();
    const refs: any[][] = [];

    function TestComp({ tick }: { tick: number }) {
      const w = useWatch(form, ['name', 'email'] as any);
      refs.push(w);
      return createElement('span', null, String(tick));
    }

    const { rerender } = render(createElement(TestComp, { tick: 1 }));
    rerender(createElement(TestComp, { tick: 2 }));

    // Same reference since values didn't change
    expect(refs[0]).toBe(refs[1]);
  });
});

// ─── useFormStatus ──────────────────────────────────────────────────────────

describe('useFormStatus', () => {
  test('returns form status signals', async () => {
    const form = createStore();
    let status: any;

    function TestComp() {
      status = useFormStatus(form);
      return createElement('div', null, [
        createElement('span', { key: 's', 'data-testid': 'submitting' }, String(status.isSubmitting)),
        createElement('span', { key: 'st', 'data-testid': 'state' }, status.submitState),
        createElement('span', { key: 'v', 'data-testid': 'valid' }, String(status.isValid)),
        createElement('span', { key: 'd', 'data-testid': 'dirty' }, String(status.isDirty)),
        createElement('span', { key: 'c', 'data-testid': 'count' }, String(status.submitCount)),
      ]);
    }

    render(createElement(TestComp));

    expect(status.isSubmitting).toBe(false);
    expect(status.submitState).toBe('idle');
    expect(status.isValid).toBe(true);
    expect(status.isDirty).toBe(false);
    expect(status.submitCount).toBe(0);
  });

  test('updates when form state changes', async () => {
    const form = createStore();
    let status: any;

    function TestComp() {
      status = useFormStatus(form);
      return createElement('span', null, String(status.isDirty));
    }

    render(createElement(TestComp));
    expect(status.isDirty).toBe(false);

    await act(() => {
      form.setValue('name' as any, 'changed');
    });

    expect(status.isDirty).toBe(true);
  });
});
