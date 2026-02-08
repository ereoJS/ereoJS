// @ts-nocheck
import { describe, expect, test, afterEach } from 'bun:test';
import React, { createElement, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { FormStore } from './store';
import { FormProvider, useFormContext } from './context';
import { Field, TextareaField, SelectField, FieldArray } from './components';
import { required } from './validators';

afterEach(cleanup);

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

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TestForm {
  name: string;
  email: string;
  password: string;
  phone: string;
  website: string;
  datetime: string;
  birthdate: string;
  startTime: string;
  age: number;
  search: string;
  bio: string;
  role: string;
  items: string[];
}

const defaultValues: TestForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  website: '',
  datetime: '',
  birthdate: '',
  startTime: '',
  age: 0,
  search: '',
  bio: '',
  role: '',
  items: [],
};

function createStore(overrides: any = {}) {
  return new FormStore<TestForm>({ defaultValues, ...overrides });
}

// ─── FormProvider / useFormContext ───────────────────────────────────────────

describe('FormProvider and useFormContext', () => {
  test('provides form via context', () => {
    const form = createStore();
    let contextForm: any = null;

    function Consumer() {
      contextForm = useFormContext();
      return createElement('span', null, 'ok');
    }

    render(
      createElement(FormProvider, { form } as any,
        createElement(Consumer)
      )
    );

    expect(contextForm).toBe(form);
  });

  test('returns null when no provider', () => {
    let contextForm: any = 'not-null';

    function Consumer() {
      contextForm = useFormContext();
      return createElement('span', null, 'ok');
    }

    render(createElement(Consumer));
    expect(contextForm).toBeNull();
  });
});

// ─── Field Component ────────────────────────────────────────────────────────

describe('Field', () => {
  test('renders with form prop', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name', label: 'Name' } as any)
    );

    expect(screen.getByText('Name')).toBeDefined();
  });

  test('renders with context form', () => {
    const form = createStore();

    render(
      createElement(FormProvider, { form } as any,
        createElement(Field, { name: 'name', label: 'Name' } as any)
      )
    );

    expect(screen.getByText('Name')).toBeDefined();
  });

  test('throws without form prop or context', () => {
    let caughtError: Error | null = null;
    render(
      createElement(ErrorBoundary, {
        onError: (e: Error) => { caughtError = e; },
      },
        createElement(Field, { name: 'name' } as any)
      )
    );
    expect(caughtError?.message).toBe('Field requires a form prop or FormProvider');
  });

  test('infers email input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'email' } as any)
    );

    const input = document.querySelector('input[name="email"]') as HTMLInputElement;
    expect(input?.type).toBe('email');
  });

  test('infers password input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'password' } as any)
    );

    const input = document.querySelector('input[name="password"]') as HTMLInputElement;
    expect(input?.type).toBe('password');
  });

  test('infers phone/tel input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'phone' } as any)
    );

    const input = document.querySelector('input[name="phone"]') as HTMLInputElement;
    expect(input?.type).toBe('tel');
  });

  test('infers url input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'website' } as any)
    );

    const input = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(input?.type).toBe('url');
  });

  test('infers datetime-local input type (before date/time)', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'datetime' } as any)
    );

    const input = document.querySelector('input[name="datetime"]') as HTMLInputElement;
    expect(input?.type).toBe('datetime-local');
  });

  test('infers date input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'birthdate' } as any)
    );

    const input = document.querySelector('input[name="birthdate"]') as HTMLInputElement;
    expect(input?.type).toBe('date');
  });

  test('infers time input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'startTime' } as any)
    );

    const input = document.querySelector('input[name="startTime"]') as HTMLInputElement;
    expect(input?.type).toBe('time');
  });

  test('infers number input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'age' } as any)
    );

    const input = document.querySelector('input[name="age"]') as HTMLInputElement;
    expect(input?.type).toBe('number');
  });

  test('infers search input type', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'search' } as any)
    );

    const input = document.querySelector('input[name="search"]') as HTMLInputElement;
    expect(input?.type).toBe('search');
  });

  test('uses explicit type override', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name', type: 'tel' } as any)
    );

    const input = document.querySelector('input[name="name"]') as HTMLInputElement;
    expect(input?.type).toBe('tel');
  });

  test('defaults to text for unknown names', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name' } as any)
    );

    const input = document.querySelector('input[name="name"]') as HTMLInputElement;
    expect(input?.type).toBe('text');
  });

  test('infers required from field validators', () => {
    const form = createStore({
      validators: { name: required() },
    });

    // Register the field to make options visible
    form.register('name' as any, { validate: required() });

    render(
      createElement(Field, { form, name: 'name', label: 'Name' } as any)
    );

    // Required asterisk should be rendered
    expect(screen.getByText('*')).toBeDefined();
  });

  test('explicit required=true shows asterisk', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name', label: 'Name', required: true } as any)
    );

    expect(screen.getByText('*')).toBeDefined();
  });

  test('explicit required=false hides asterisk', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name', label: 'Name', required: false } as any)
    );

    expect(screen.queryByText('*')).toBeNull();
  });

  test('renders errors when touched', async () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name', label: 'Name' } as any)
    );

    await act(() => {
      form.setErrors('name' as any, ['This field is required']);
      form.setTouched('name' as any, true);
    });

    expect(screen.getByText('This field is required')).toBeDefined();
  });

  test('does not render errors when not touched', async () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name', label: 'Name' } as any)
    );

    await act(() => {
      form.setErrors('name' as any, ['This field is required']);
    });

    expect(screen.queryByText('This field is required')).toBeNull();
  });

  test('supports render prop children', () => {
    const form = createStore();
    let fieldHandle: any = null;

    render(
      createElement(Field, {
        form,
        name: 'name',
        children: (field: any) => {
          fieldHandle = field;
          return createElement('div', { 'data-testid': 'custom' }, 'custom render');
        },
      } as any)
    );

    expect(screen.getByTestId('custom')).toBeDefined();
    expect(fieldHandle).toBeDefined();
    expect(fieldHandle.inputProps).toBeDefined();
  });

  test('applies disabled, placeholder, className props', () => {
    const form = createStore();

    render(
      createElement(Field, {
        form,
        name: 'name',
        disabled: true,
        placeholder: 'Enter name',
        className: 'custom-class',
      } as any)
    );

    const input = document.querySelector('input[name="name"]') as HTMLInputElement;
    expect(input?.disabled).toBe(true);
    expect(input?.placeholder).toBe('Enter name');
    expect(input?.className).toBe('custom-class');
  });

  test('renders label with a11y attributes', () => {
    const form = createStore();

    render(
      createElement(Field, { form, name: 'name', label: 'Name' } as any)
    );

    const label = document.querySelector('label');
    expect(label).toBeDefined();
    expect(label?.getAttribute('for')).toBe('name');
  });

  test('infers type from nested path (uses last segment)', () => {
    const store = new FormStore<{ user: { email: string } }>({
      defaultValues: { user: { email: '' } },
    });

    render(
      createElement(Field, { form: store, name: 'user.email' } as any)
    );

    const input = document.querySelector('input[name="user.email"]') as HTMLInputElement;
    expect(input?.type).toBe('email');
  });
});

// ─── TextareaField ──────────────────────────────────────────────────────────

describe('TextareaField', () => {
  test('renders textarea element', () => {
    const form = createStore();

    render(
      createElement(TextareaField, {
        form,
        name: 'bio',
        label: 'Biography',
      } as any)
    );

    expect(screen.getByText('Biography')).toBeDefined();
    expect(document.querySelector('textarea[name="bio"]')).toBeDefined();
  });

  test('throws without form prop or context', () => {
    let caughtError: Error | null = null;
    render(
      createElement(ErrorBoundary, {
        onError: (e: Error) => { caughtError = e; },
      },
        createElement(TextareaField, { name: 'bio' } as any)
      )
    );
    expect(caughtError?.message).toBe('TextareaField requires a form prop or FormProvider');
  });

  test('applies rows, cols, maxLength props', () => {
    const form = createStore();

    render(
      createElement(TextareaField, {
        form,
        name: 'bio',
        rows: 5,
        cols: 40,
        maxLength: 500,
      } as any)
    );

    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    expect(Number(textarea?.rows)).toBe(5);
    expect(Number(textarea?.cols)).toBe(40);
    expect(Number(textarea?.maxLength)).toBe(500);
  });

  test('renders errors when touched', async () => {
    const form = createStore();

    render(
      createElement(TextareaField, { form, name: 'bio', label: 'Bio' } as any)
    );

    await act(() => {
      form.setErrors('bio' as any, ['Too short']);
      form.setTouched('bio' as any, true);
    });

    expect(screen.getByText('Too short')).toBeDefined();
  });

  test('supports render prop children', () => {
    const form = createStore();

    render(
      createElement(TextareaField, {
        form,
        name: 'bio',
        children: (field: any) =>
          createElement('div', { 'data-testid': 'custom-ta' }, 'custom'),
      } as any)
    );

    expect(screen.getByTestId('custom-ta')).toBeDefined();
  });

  test('uses context form', () => {
    const form = createStore();

    render(
      createElement(FormProvider, { form } as any,
        createElement(TextareaField, { name: 'bio', label: 'Bio' } as any)
      )
    );

    expect(document.querySelector('textarea')).toBeDefined();
  });
});

// ─── SelectField ────────────────────────────────────────────────────────────

describe('SelectField', () => {
  const options = [
    { value: '', label: 'Choose...' },
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
  ];

  test('renders select with options', () => {
    const form = createStore();

    render(
      createElement(SelectField, {
        form,
        name: 'role',
        label: 'Role',
        options,
      } as any)
    );

    expect(screen.getByText('Role')).toBeDefined();
    expect(screen.getByText('Choose...')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('User')).toBeDefined();
  });

  test('throws without form prop or context', () => {
    let caughtError: Error | null = null;
    render(
      createElement(ErrorBoundary, {
        onError: (e: Error) => { caughtError = e; },
      },
        createElement(SelectField, { name: 'role', options } as any)
      )
    );
    expect(caughtError?.message).toBe('SelectField requires a form prop or FormProvider');
  });

  test('renders errors when touched', async () => {
    const form = createStore();

    render(
      createElement(SelectField, {
        form,
        name: 'role',
        label: 'Role',
        options,
      } as any)
    );

    await act(() => {
      form.setErrors('role' as any, ['Required']);
      form.setTouched('role' as any, true);
    });

    expect(screen.getByText('Required')).toBeDefined();
  });

  test('supports render prop children', () => {
    const form = createStore();

    render(
      createElement(SelectField, {
        form,
        name: 'role',
        options,
        children: (field: any) =>
          createElement('div', { 'data-testid': 'custom-select' }, 'custom'),
      } as any)
    );

    expect(screen.getByTestId('custom-select')).toBeDefined();
  });

  test('supports multiple prop', () => {
    const form = createStore();

    render(
      createElement(SelectField, {
        form,
        name: 'role',
        options,
        multiple: true,
      } as any)
    );

    const select = document.querySelector('select') as HTMLSelectElement;
    expect(select?.multiple).toBe(true);
  });

  test('supports disabled options', () => {
    const form = createStore();
    const opts = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ];

    render(
      createElement(SelectField, { form, name: 'role', options: opts } as any)
    );

    const optionEls = document.querySelectorAll('option');
    expect(optionEls[1]?.disabled).toBe(true);
  });

  test('uses context form', () => {
    const form = createStore();

    render(
      createElement(FormProvider, { form } as any,
        createElement(SelectField, { name: 'role', options, label: 'Role' } as any)
      )
    );

    expect(document.querySelector('select')).toBeDefined();
  });
});

// ─── FieldArray Component ───────────────────────────────────────────────────

describe('FieldArray component', () => {
  test('passes array helpers to render prop', async () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: ['a', 'b'] },
    });
    let helpers: any = null;

    render(
      createElement(FieldArray, {
        form: store,
        name: 'items',
        children: (h: any) => {
          helpers = h;
          return createElement('div', null,
            h.fields.map((f: any) =>
              createElement('span', { key: f.id }, f.value)
            )
          );
        },
      } as any)
    );

    expect(helpers).toBeDefined();
    expect(helpers.fields.length).toBe(2);
    expect(typeof helpers.append).toBe('function');
    expect(typeof helpers.remove).toBe('function');
  });

  test('throws without form', () => {
    let caughtError: Error | null = null;
    render(
      createElement(ErrorBoundary, {
        onError: (e: Error) => { caughtError = e; },
      },
        createElement(FieldArray, {
          name: 'items',
          children: () => createElement('div'),
        } as any)
      )
    );
    expect(caughtError?.message).toBe('FieldArray requires a form prop or FormProvider');
  });

  test('uses context form', () => {
    const store = new FormStore<{ items: string[] }>({
      defaultValues: { items: [] },
    });
    let helpers: any = null;

    render(
      createElement(FormProvider, { form: store } as any,
        createElement(FieldArray, {
          name: 'items',
          children: (h: any) => {
            helpers = h;
            return createElement('div', null, 'ok');
          },
        } as any)
      )
    );

    expect(helpers).toBeDefined();
  });
});
