import { describe, expect, test } from 'bun:test';
import { FormStore } from './store';
import type { FormStoreInterface, FormPath, PathValue } from './types';

/**
 * Type-safety tests: these test that the TypeScript types work correctly.
 * The @ts-expect-error directives verify that invalid paths cause compile errors.
 * The positive tests verify that valid paths compile without error.
 */

interface TestForm {
  user: {
    email: string;
    name: string;
    age: number;
  };
  tags: string[];
  items: { title: string; done: boolean }[];
  active: boolean;
}

const defaultValues: TestForm = {
  user: { email: '', name: '', age: 0 },
  tags: ['a'],
  items: [{ title: 'test', done: false }],
  active: true,
};

describe('Type Safety', () => {
  test('valid paths compile without error', () => {
    const form: FormStoreInterface<TestForm> = new FormStore<TestForm>({ defaultValues });

    // Top-level paths
    form.getValue('active');
    form.getValue('user');
    form.getValue('tags');

    // Nested paths
    form.getValue('user.email');
    form.getValue('user.name');
    form.getValue('user.age');

    // Array paths
    form.getValue('tags.0' as FormPath<TestForm>);
    form.getValue('items.0' as FormPath<TestForm>);
    form.getValue('items.0.title' as FormPath<TestForm>);

    expect(true).toBe(true); // test passed compilation
  });

  test('setValue with correct value types', () => {
    const form = new FormStore<TestForm>({ defaultValues });

    form.setValue('active', true);
    form.setValue('user.email', 'test@test.com');
    form.setValue('user.age', 25);
    form.setValue('tags', ['a', 'b']);

    expect(form.getValue('active')).toBe(true);
    expect(form.getValue('user.email')).toBe('test@test.com');
    expect(form.getValue('user.age')).toBe(25);
  });

  test('getSignal returns correctly typed signal', () => {
    const form = new FormStore<TestForm>({ defaultValues });

    const emailSig = form.getSignal('user.email');
    const activeSig = form.getSignal('active');

    expect(typeof emailSig.get()).toBe('string');
    expect(typeof activeSig.get()).toBe('boolean');
  });

  test('watch with typed callback', () => {
    const form = new FormStore<TestForm>({ defaultValues });
    const values: string[] = [];

    form.watch('user.email', (v) => {
      values.push(v);
    });

    form.setValue('user.email', 'hello@test.com');
    expect(values).toEqual(['hello@test.com']);
  });

  test('register returns typed registration', () => {
    const form = new FormStore<TestForm>({ defaultValues });

    const reg = form.register('user.email');
    expect(typeof reg.inputProps.value).toBe('string');
    expect(reg.state.value).toBe('');
  });

  test('template literal paths with ${number} for arrays', () => {
    const form = new FormStore<TestForm>({ defaultValues });

    const i = 0;
    // Template literal paths should work
    form.setValue(`tags.${i}` as FormPath<TestForm>, 'updated');
    expect(form.getValue(`tags.${i}` as FormPath<TestForm>)).toBe('updated');
  });

  // ── Compile-time error tests ──────────────────────────────────────────

  test('invalid paths cause type errors (verified by @ts-expect-error)', () => {
    const form = new FormStore<TestForm>({ defaultValues });

    // @ts-expect-error — typo in path should error
    form.getValue('usr.emial');

    // @ts-expect-error — non-existent field
    form.getValue('user.phone');

    // @ts-expect-error — wrong value type
    form.setValue('user.email', 123);

    // @ts-expect-error — wrong value type for boolean field
    form.setValue('active', 'yes');

    // @ts-expect-error — non-existent nested path
    form.getErrors('user.nonexistent');

    // @ts-expect-error — completely wrong path
    form.setTouched('foo.bar.baz');

    expect(true).toBe(true); // test passed compilation checks
  });
});
