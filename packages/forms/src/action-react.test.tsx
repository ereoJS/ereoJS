// @ts-nocheck
import { describe, expect, test, afterEach, mock } from 'bun:test';
import React, { createElement } from 'react';
import { render, screen, act, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FormStore } from './store';
import { ActionForm, useFormAction } from './action';
import { required } from './validators';

afterEach(cleanup);

// ─── Helpers ────────────────────────────────────────────────────────────────

interface TestForm {
  name: string;
  email: string;
}

const defaultValues: TestForm = { name: '', email: '' };

function createStore(overrides: any = {}) {
  return new FormStore<TestForm>({ defaultValues, ...overrides });
}

// ─── ActionForm ─────────────────────────────────────────────────────────────

describe('ActionForm', () => {
  test('renders as <form> with children', () => {
    const form = createStore();

    render(
      createElement(ActionForm, {
        form,
        action: '/api/submit',
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    expect(document.querySelector('form')).toBeDefined();
    expect(screen.getByText('Submit')).toBeDefined();
  });

  test('renders with id and className', () => {
    const form = createStore();

    render(
      createElement(ActionForm, {
        form,
        action: '/api/submit',
        id: 'my-form',
        className: 'form-class',
        children: createElement('span', null, 'inner'),
      } as any)
    );

    const formEl = document.querySelector('form') as HTMLFormElement;
    expect(formEl?.id).toBe('my-form');
    expect(formEl?.className).toBe('form-class');
  });

  test('sets method and action attributes for URL actions', () => {
    const form = createStore();

    render(
      createElement(ActionForm, {
        form,
        action: '/api/submit',
        method: 'put',
        children: createElement('span', null, 'inner'),
      } as any)
    );

    const formEl = document.querySelector('form') as HTMLFormElement;
    expect(formEl?.method).toBe('put');
    expect(formEl?.getAttribute('action')).toBe('/api/submit');
    expect(formEl?.noValidate).toBe(true);
  });

  test('does not set action attribute for function actions', () => {
    const form = createStore();

    render(
      createElement(ActionForm, {
        form,
        action: async () => ({ success: true }),
        children: createElement('span', null, 'inner'),
      } as any)
    );

    const formEl = document.querySelector('form') as HTMLFormElement;
    expect(formEl?.getAttribute('action')).toBeNull();
  });

  test('submits with function action successfully', async () => {
    const form = createStore();
    form.setValue('name' as any, 'Alice');

    let successData: any = null;
    const actionFn = async (values: TestForm) => ({
      success: true as const,
      data: { id: 1 },
    });

    render(
      createElement(ActionForm, {
        form,
        action: actionFn,
        onSuccess: (data: any) => { successData = data; },
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      // Wait for async action
      await new Promise(r => setTimeout(r, 50));
    });

    expect(successData).toEqual({ id: 1 });
    expect(form.submitState.get()).toBe('success');
  });

  test('submits with function action that returns errors', async () => {
    const form = createStore();
    form.setValue('name' as any, 'Alice');

    let errorResult: any = null;
    const actionFn = async () => ({
      success: false as const,
      errors: { name: ['Already taken'], '': ['Form error'] },
    });

    render(
      createElement(ActionForm, {
        form,
        action: actionFn,
        onError: (errors: any) => { errorResult = errors; },
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      await new Promise(r => setTimeout(r, 50));
    });

    expect(errorResult).toBeDefined();
    expect(errorResult.name).toEqual(['Already taken']);
    expect(form.submitState.get()).toBe('error');
  });

  test('prevents submit when client-side validation fails', async () => {
    const form = createStore({
      validators: { name: required() },
    });
    form.register('name' as any, { validate: required() });

    let actionCalled = false;
    const actionFn = async () => {
      actionCalled = true;
      return { success: true as const };
    };

    render(
      createElement(ActionForm, {
        form,
        action: actionFn,
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      await new Promise(r => setTimeout(r, 50));
    });

    expect(actionCalled).toBe(false);
  });

  test('handles action that throws error', async () => {
    const form = createStore();
    form.setValue('name' as any, 'Alice');

    let errorResult: any = null;
    const actionFn = async () => {
      throw new Error('Network failure');
    };

    render(
      createElement(ActionForm, {
        form,
        action: actionFn,
        onError: (errors: any) => { errorResult = errors; },
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      await new Promise(r => setTimeout(r, 50));
    });

    expect(errorResult).toBeDefined();
    expect(errorResult['']).toEqual(['Network failure']);
    expect(form.submitState.get()).toBe('error');
  });

  test('handles non-Error throw', async () => {
    const form = createStore();
    form.setValue('name' as any, 'Alice');

    let errorResult: any = null;
    const actionFn = async () => {
      throw 'string error';
    };

    render(
      createElement(ActionForm, {
        form,
        action: actionFn,
        onError: (errors: any) => { errorResult = errors; },
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      await new Promise(r => setTimeout(r, 50));
    });

    expect(errorResult['']).toEqual(['Submission failed']);
  });

  test('submits with URL action using fetch', async () => {
    const form = createStore();
    form.setValue('name' as any, 'Alice');

    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    let fetchOpts: any;

    globalThis.fetch = async (url: any, opts: any) => {
      fetchCalled = true;
      fetchOpts = opts;
      return new Response(JSON.stringify({ success: true, data: { id: 1 } }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let successData: any = null;

    render(
      createElement(ActionForm, {
        form,
        action: '/api/submit',
        onSuccess: (data: any) => { successData = data; },
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      await new Promise(r => setTimeout(r, 50));
    });

    globalThis.fetch = originalFetch;

    expect(fetchCalled).toBe(true);
    expect(fetchOpts.method).toBe('POST');
    expect(fetchOpts.headers['Content-Type']).toBe('application/json');
    expect(successData).toEqual({ id: 1 });
  });

  test('submits with multipart/form-data encoding', async () => {
    const form = createStore();
    form.setValue('name' as any, 'Alice');

    const originalFetch = globalThis.fetch;
    let fetchOpts: any;

    globalThis.fetch = async (url: any, opts: any) => {
      fetchOpts = opts;
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    render(
      createElement(ActionForm, {
        form,
        action: '/api/submit',
        encType: 'multipart/form-data',
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      await new Promise(r => setTimeout(r, 50));
    });

    globalThis.fetch = originalFetch;

    expect(fetchOpts.headers).toBeUndefined();
    expect(fetchOpts.body).toBeInstanceOf(FormData);
  });

  test('abort controller cancels in-flight request on unmount', async () => {
    const form = createStore();
    form.setValue('name' as any, 'Alice');

    let abortSignal: AbortSignal | null = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (url: any, opts: any) => {
      abortSignal = opts.signal;
      // Simulate slow request
      await new Promise(r => setTimeout(r, 5000));
      return new Response('{}');
    };

    const { unmount } = render(
      createElement(ActionForm, {
        form,
        action: '/api/submit',
        children: createElement('button', { type: 'submit' }, 'Submit'),
      } as any)
    );

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
      await new Promise(r => setTimeout(r, 10));
    });

    unmount();

    globalThis.fetch = originalFetch;

    expect(abortSignal?.aborted).toBe(true);
  });
});

// ─── useFormAction ──────────────────────────────────────────────────────────

describe('useFormAction', () => {
  test('returns submit, cancel, isSubmitting, result', () => {
    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: async () => ({ success: true }),
      });
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    expect(typeof hookResult.submit).toBe('function');
    expect(typeof hookResult.cancel).toBe('function');
    expect(hookResult.isSubmitting).toBe(false);
    expect(hookResult.result).toBeNull();
  });

  test('submit with function action', async () => {
    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: async (values) => ({
          success: true as const,
          data: { received: values.name },
        }),
      });
      return createElement('div', null,
        createElement('span', { 'data-testid': 'submitting' }, String(hookResult.isSubmitting))
      );
    }

    render(createElement(TestComp));

    let result: any;
    await act(async () => {
      result = await hookResult.submit({ name: 'Alice', email: 'a@b.com' });
    });

    expect(result.success).toBe(true);
    expect(result.data.received).toBe('Alice');
    expect(hookResult.isSubmitting).toBe(false);
    expect(hookResult.result?.success).toBe(true);
  });

  test('submit with URL action using fetch', async () => {
    const originalFetch = globalThis.fetch;
    let fetchOpts: any;

    globalThis.fetch = async (url: any, opts: any) => {
      fetchOpts = opts;
      return new Response(JSON.stringify({ success: true, data: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: '/api/submit',
        method: 'PUT',
      });
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    let result: any;
    await act(async () => {
      result = await hookResult.submit({ name: 'Alice', email: 'a@b.com' });
    });

    globalThis.fetch = originalFetch;

    expect(fetchOpts.method).toBe('PUT');
    expect(fetchOpts.headers['Content-Type']).toBe('application/json');
    expect(result.success).toBe(true);
  });

  test('submit with multipart/form-data', async () => {
    const originalFetch = globalThis.fetch;
    let fetchOpts: any;

    globalThis.fetch = async (url: any, opts: any) => {
      fetchOpts = opts;
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: '/api/upload',
        encType: 'multipart/form-data',
      });
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    await act(async () => {
      await hookResult.submit({ name: 'Alice', email: 'a@b.com' });
    });

    globalThis.fetch = originalFetch;

    expect(fetchOpts.body).toBeInstanceOf(FormData);
    expect(fetchOpts.headers).toBeUndefined();
  });

  test('cancel aborts in-flight request', async () => {
    let hookResult: any;
    let resolveAction: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: async () => {
          await new Promise(r => { resolveAction = r; });
          return { success: true as const };
        },
      });
      return createElement('span', { 'data-testid': 'sub' }, String(hookResult.isSubmitting));
    }

    render(createElement(TestComp));

    // Start submission
    act(() => {
      hookResult.submit({ name: 'Alice', email: '' });
    });

    // Cancel it
    await act(async () => {
      hookResult.cancel();
    });

    expect(hookResult.isSubmitting).toBe(false);
  });

  test('handles action throwing error', async () => {
    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: async () => {
          throw new Error('Network error');
        },
      });
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    let result: any;
    await act(async () => {
      result = await hookResult.submit({ name: 'Alice', email: '' });
    });

    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Network error']);
    expect(hookResult.result?.success).toBe(false);
  });

  test('handles non-Error throw', async () => {
    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: async () => {
          throw 42;
        },
      });
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    let result: any;
    await act(async () => {
      result = await hookResult.submit({ name: 'Alice', email: '' });
    });

    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Request failed']);
  });

  test('returns cancelled result when signal is aborted during error', async () => {
    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: async () => {
          // Simulate: cancel is called while the action is running, then it throws
          hookResult.cancel();
          throw new Error('Simulated failure after cancel');
        },
      });
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    let result: any;
    await act(async () => {
      result = await hookResult.submit({ name: 'Alice', email: '' });
    });

    expect(result.success).toBe(false);
    expect(result.errors?.['']).toEqual(['Request cancelled']);
  });

  test('defaults method to POST', async () => {
    const originalFetch = globalThis.fetch;
    let fetchOpts: any;

    globalThis.fetch = async (url: any, opts: any) => {
      fetchOpts = opts;
      return new Response(JSON.stringify({ success: true }));
    };

    let hookResult: any;

    function TestComp() {
      hookResult = useFormAction<TestForm>({
        action: '/api/submit',
      });
      return createElement('div', null, 'test');
    }

    render(createElement(TestComp));

    await act(async () => {
      await hookResult.submit({ name: 'Alice', email: '' });
    });

    globalThis.fetch = originalFetch;

    expect(fetchOpts.method).toBe('POST');
  });
});
