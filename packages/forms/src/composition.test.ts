import { describe, expect, test } from 'bun:test';
import { mergeFormConfigs, composeSchemas } from './composition';
import { required, minLength } from './validators';
import type { FormConfig } from './types';

describe('mergeFormConfigs', () => {
  test('merges default values', () => {
    const configA: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
    };
    const configB: FormConfig<{ email: string }> = {
      defaultValues: { email: '' },
    };

    const merged = mergeFormConfigs(configA, configB);
    expect(merged.defaultValues).toEqual({ name: '', email: '' });
  });

  test('merges validators from both configs', () => {
    const configA: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
      validators: { name: required() } as any,
    };
    const configB: FormConfig<{ email: string }> = {
      defaultValues: { email: '' },
      validators: { email: required() } as any,
    };

    const merged = mergeFormConfigs(configA, configB);
    expect(merged.validators).toBeDefined();
    expect((merged.validators as any).name).toBeDefined();
    expect((merged.validators as any).email).toBeDefined();
  });

  test('combines validators for same field', () => {
    const configA: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
      validators: { name: required() } as any,
    };
    const configB: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
      validators: { name: minLength(3) } as any,
    };

    const merged = mergeFormConfigs(configA, configB);
    const nameValidators = (merged.validators as any).name;
    expect(Array.isArray(nameValidators)).toBe(true);
    expect(nameValidators).toHaveLength(2);
  });

  test('configB onSubmit overrides configA', () => {
    const handlerA = async () => {};
    const handlerB = async () => {};

    const configA: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
      onSubmit: handlerA,
    };
    const configB: FormConfig<{ email: string }> = {
      defaultValues: { email: '' },
      onSubmit: handlerB,
    };

    const merged = mergeFormConfigs(configA, configB);
    expect(merged.onSubmit).toBe(handlerB);
  });

  test('falls back to configA onSubmit when configB has none', () => {
    const handler = async () => {};

    const configA: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
      onSubmit: handler,
    };
    const configB: FormConfig<{ email: string }> = {
      defaultValues: { email: '' },
    };

    const merged = mergeFormConfigs(configA, configB);
    expect(merged.onSubmit).toBe(handler);
  });

  test('deep merges nested default values', () => {
    const configA: FormConfig<{ user: { name: string; email: string } }> = {
      defaultValues: { user: { name: 'Alice', email: 'alice@test.com' } },
    };
    const configB: FormConfig<{ user: { name: string } }> = {
      defaultValues: { user: { name: 'Bob' } },
    };

    const merged = mergeFormConfigs(configA, configB);
    // B overrides name, but A's email is preserved
    expect((merged.defaultValues as any).user.name).toBe('Bob');
    expect((merged.defaultValues as any).user.email).toBe('alice@test.com');
  });

  test('arrays in default values are replaced, not deep merged', () => {
    const configA: FormConfig<{ tags: string[] }> = {
      defaultValues: { tags: ['a', 'b'] },
    };
    const configB: FormConfig<{ tags: string[] }> = {
      defaultValues: { tags: ['c'] },
    };

    const merged = mergeFormConfigs(configA, configB);
    expect(merged.defaultValues.tags).toEqual(['c']);
  });

  test('configB validateOn overrides configA', () => {
    const configA: FormConfig<{ name: string }> = {
      defaultValues: { name: '' },
      validateOn: 'blur',
    };
    const configB: FormConfig<{ email: string }> = {
      defaultValues: { email: '' },
      validateOn: 'change',
    };

    const merged = mergeFormConfigs(configA, configB);
    expect(merged.validateOn).toBe('change');
  });
});

describe('composeSchemas', () => {
  const schema1 = {
    parse: (data: unknown) => {
      const obj = data as any;
      if (!obj?.name) throw { issues: [{ path: ['name'], message: 'Required' }] };
      return obj;
    },
    safeParse: (data: unknown) => {
      const obj = data as any;
      if (!obj?.name) {
        return {
          success: false as const,
          error: { issues: [{ path: ['name'], message: 'Required' }] },
        };
      }
      return { success: true as const, data: obj };
    },
  };

  const schema2 = {
    parse: (data: unknown) => {
      const obj = data as any;
      if (!obj?.email) throw { issues: [{ path: ['email'], message: 'Required' }] };
      return obj;
    },
    safeParse: (data: unknown) => {
      const obj = data as any;
      if (!obj?.email) {
        return {
          success: false as const,
          error: { issues: [{ path: ['email'], message: 'Required' }] },
        };
      }
      return { success: true as const, data: obj };
    },
  };

  test('parse succeeds with valid data', () => {
    const composed = composeSchemas('user', schema1, 'contact', schema2);
    const result = composed.parse({
      user: { name: 'Alice' },
      contact: { email: 'a@b.com' },
    });
    expect(result.user).toEqual({ name: 'Alice' });
    expect(result.contact).toEqual({ email: 'a@b.com' });
  });

  test('safeParse fails with prefixed paths', () => {
    const composed = composeSchemas('user', schema1, 'contact', schema2);
    const result = composed.safeParse!({
      user: { name: '' },
      contact: { email: '' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i: any) => i.path.join('.'));
      expect(paths).toContain('user.name');
      expect(paths).toContain('contact.email');
    }
  });

  test('safeParse succeeds with valid data', () => {
    const composed = composeSchemas('user', schema1, 'contact', schema2);
    const result = composed.safeParse!({
      user: { name: 'Alice' },
      contact: { email: 'a@b.com' },
    });

    expect(result.success).toBe(true);
  });
});
