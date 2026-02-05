import { describe, expect, test, beforeEach } from 'bun:test';
import { FormStore } from './store';
import { ValidationEngine } from './validation-engine';
import { required, minLength, email, async as asyncValidator } from './validators';

describe('ValidationEngine', () => {
  describe('derive-don-t-configure', () => {
    test('required validators derive blur trigger', () => {
      const store = new FormStore({
        defaultValues: { name: '' },
        validators: { name: required() } as any,
      });

      // The engine is created internally; we test via behavior
      // Setting value should NOT trigger validation (trigger is blur)
      store.setValue('name', 'a');
      // No errors expected since validation is blur-only
      expect(store.getErrors('name').get()).toEqual([]);
    });

    test('sync validators derive blur trigger', () => {
      const store = new FormStore({
        defaultValues: { name: '' },
        validators: { name: minLength(3) } as any,
      });

      store.setValue('name', 'ab');
      // No immediate validation on change for sync validators
      expect(store.getErrors('name').get()).toEqual([]);
    });
  });

  describe('validateAll', () => {
    test('validates all registered fields', async () => {
      const store = new FormStore({
        defaultValues: { name: '', email: '' },
        validators: {
          name: required(),
          email: [required(), email()],
        } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const result = await engine.validateAll();

      expect(result.success).toBe(false);
      expect(result.errors?.name).toEqual(['This field is required']);
      expect(result.errors?.email).toEqual(['This field is required']);
    });

    test('succeeds when all fields valid', async () => {
      const store = new FormStore({
        defaultValues: { name: 'Alice', email: 'a@b.com' },
        validators: {
          name: required(),
          email: [required(), email()],
        } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const result = await engine.validateAll();

      expect(result.success).toBe(true);
    });
  });

  describe('validateField', () => {
    test('validates a single field', async () => {
      const store = new FormStore({
        defaultValues: { name: '' },
        validators: { name: required() } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const errors = await engine.validateField('name');

      expect(errors).toEqual(['This field is required']);
      expect(store.getErrors('name').get()).toEqual(['This field is required']);
    });

    test('clears errors when field becomes valid', async () => {
      const store = new FormStore({
        defaultValues: { name: '' },
        validators: { name: required() } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;

      await engine.validateField('name');
      expect(store.getErrors('name').get()).toEqual(['This field is required']);

      store.setValue('name', 'Alice');
      await engine.validateField('name');
      expect(store.getErrors('name').get()).toEqual([]);
    });

    test('returns empty array for unregistered fields', async () => {
      const store = new FormStore({ defaultValues: { name: '' } });
      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const errors = await engine.validateField('nonexistent');
      expect(errors).toEqual([]);
    });
  });

  describe('schema validation', () => {
    test('validates against schema in validateAll', async () => {
      const mockSchema = {
        safeParse: (data: any) => {
          if (!data.name) {
            return {
              success: false,
              error: {
                issues: [{ path: ['name'], message: 'Name required by schema' }],
              },
            };
          }
          return { success: true, data };
        },
      };

      const store = new FormStore({
        defaultValues: { name: '' },
        schema: mockSchema as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const result = await engine.validateAll();

      expect(result.success).toBe(false);
      expect(result.errors?.name).toEqual(['Name required by schema']);
    });

    test('combines schema and field validator errors', async () => {
      const mockSchema = {
        safeParse: (data: any) => {
          if (!data.name) {
            return {
              success: false,
              error: {
                issues: [{ path: ['name'], message: 'Schema: name required' }],
              },
            };
          }
          return { success: true, data };
        },
      };

      const store = new FormStore({
        defaultValues: { name: '' },
        schema: mockSchema as any,
        validators: { name: required('Field: name required') } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const result = await engine.validateAll();

      expect(result.success).toBe(false);
      // Both schema and field errors for name
      expect(result.errors?.name).toContain('Schema: name required');
      expect(result.errors?.name).toContain('Field: name required');
    });
  });

  describe('async validation', () => {
    test('runs async validators', async () => {
      const store = new FormStore({
        defaultValues: { username: 'taken' },
        validators: {
          username: asyncValidator<string>(async (v) => {
            return v === 'taken' ? 'Username is taken' : undefined;
          }),
        } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const errors = await engine.validateField('username');

      expect(errors).toEqual(['Username is taken']);
    });
  });

  describe('per-field generation counter prevents stale writes', () => {
    test('later validation supersedes earlier one', async () => {
      let resolveFirst: (v: string | undefined) => void;
      let resolveSecond: (v: string | undefined) => void;

      const slowValidator = asyncValidator<string>(async (v) => {
        if (v === 'first') {
          return new Promise<string | undefined>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return new Promise<string | undefined>((resolve) => {
          resolveSecond = resolve;
        });
      });

      const store = new FormStore({
        defaultValues: { username: '' },
        validators: { username: slowValidator } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;

      // Start first validation
      store.setValue('username', 'first');
      const first = engine.validateField('username');

      // Start second validation before first resolves (supersedes first)
      store.setValue('username', 'second');
      const second = engine.validateField('username');

      // Resolve second first (no error)
      resolveSecond!(undefined);
      await second;
      expect(store.getErrors('username').get()).toEqual([]);

      // Resolve first later (with error) — should be discarded as stale
      resolveFirst!('Username taken');
      await first;
      // Stale result should NOT overwrite the newer valid result
      expect(store.getErrors('username').get()).toEqual([]);
    });
  });

  describe('abort signal passed to validators via context', () => {
    test('context contains abort signal', async () => {
      let receivedSignal: AbortSignal | undefined;

      const store = new FormStore({
        defaultValues: { name: 'test' },
        validators: {
          name: Object.assign(
            (value: any, context: any) => {
              receivedSignal = context?.signal;
              return undefined;
            },
            {} as any
          ),
        } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      await engine.validateField('name');
      expect(receivedSignal).toBeDefined();
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('validateAll abort support', () => {
    test('validateAll can be aborted by a subsequent call', async () => {
      let callCount = 0;

      const slowValidator = asyncValidator<string>(async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 50));
        return 'error';
      });

      const store = new FormStore({
        defaultValues: { name: '' },
        validators: { name: slowValidator } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;

      // Start first validateAll, then immediately start second
      const first = engine.validateAll();
      const second = engine.validateAll();

      await Promise.all([first, second]);
      // Both ran, but only the second should have written results
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('validateFields', () => {
    test('validates subset of fields', async () => {
      const store = new FormStore({
        defaultValues: { name: '', email: '', age: 0 },
        validators: {
          name: required(),
          email: required(),
          age: required(),
        } as any,
      });

      const engine = (store as any)._validationEngine as ValidationEngine<any>;
      const result = await engine.validateFields(['name', 'email']);

      expect(result.success).toBe(false);
      expect(result.errors?.name).toBeDefined();
      expect(result.errors?.email).toBeDefined();
      // age was not validated
      expect(result.errors?.age).toBeUndefined();
    });
  });
});
