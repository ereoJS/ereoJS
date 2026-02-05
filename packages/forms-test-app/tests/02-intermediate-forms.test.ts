/**
 * Intermediate Form Scenarios — testing more complex patterns
 *
 * Tests cover:
 * 1. Dynamic field arrays (useFieldArray operations)
 * 2. Deeply nested object forms
 * 3. Conditional validation with when()
 * 4. Async validation
 * 5. setValues batch updates
 * 6. resetTo with new shape
 * 7. setBaseline (e.g., after loading server data)
 */
import { describe, expect, test, beforeEach, mock } from 'bun:test';
import { FormStore } from '@ereo/forms';
import {
  required,
  email,
  minLength,
  min,
  max,
  compose,
  when,
  custom,
  v,
} from '@ereo/forms';
import { getPath, setPath, deepClone, deepEqual, flattenToPaths } from '@ereo/forms';

// ─── Scenario 1: Field Array Operations (non-React) ─────────────────────────

describe('Scenario 1: Field Arrays (store-level)', () => {
  interface InvoiceForm {
    client: string;
    items: Array<{ description: string; amount: number }>;
  }

  const defaults: InvoiceForm = {
    client: '',
    items: [],
  };

  let form: FormStore<InvoiceForm>;

  beforeEach(() => {
    form = new FormStore<InvoiceForm>({ defaultValues: defaults });
  });

  test('starts with empty array', () => {
    expect(form.getValue('items')).toEqual([]);
  });

  test('can append items to array via setValue', () => {
    const current = (form.getValue('items') as any[]) ?? [];
    form.setValue('items', [...current, { description: 'Item 1', amount: 100 }]);

    const items = form.getValue('items') as any[];
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Item 1');
  });

  test('can read array items by index after setting whole array', () => {
    form.setValue('items', [
      { description: 'First', amount: 10 },
      { description: 'Second', amount: 20 },
    ]);

    // Whole array is stored as a single signal; access individual items
    const items = form.getValue('items') as any[];
    expect(items[0].description).toBe('First');
    expect(items[0].amount).toBe(10);
    expect(items[1].description).toBe('Second');
    expect(items[1].amount).toBe(20);
  });

  test('array operations: prepend', () => {
    form.setValue('items', [{ description: 'B', amount: 2 }]);
    const current = form.getValue('items') as any[];
    form.setValue('items', [{ description: 'A', amount: 1 }, ...current]);

    const items = form.getValue('items') as any[];
    expect(items).toHaveLength(2);
    expect(items[0].description).toBe('A');
    expect(items[1].description).toBe('B');
  });

  test('array operations: remove by index', () => {
    form.setValue('items', [
      { description: 'A', amount: 1 },
      { description: 'B', amount: 2 },
      { description: 'C', amount: 3 },
    ]);

    const current = form.getValue('items') as any[];
    const next = [...current];
    next.splice(1, 1); // remove index 1
    form.setValue('items', next);

    const items = form.getValue('items') as any[];
    expect(items).toHaveLength(2);
    expect(items[0].description).toBe('A');
    expect(items[1].description).toBe('C');
  });

  test('array operations: swap', () => {
    form.setValue('items', [
      { description: 'A', amount: 1 },
      { description: 'B', amount: 2 },
    ]);

    const current = form.getValue('items') as any[];
    const next = [...current];
    [next[0], next[1]] = [next[1], next[0]];
    form.setValue('items', next);

    const items = form.getValue('items') as any[];
    expect(items[0].description).toBe('B');
    expect(items[1].description).toBe('A');
  });

  test('array operations: insert at index', () => {
    form.setValue('items', [
      { description: 'A', amount: 1 },
      { description: 'C', amount: 3 },
    ]);

    const current = form.getValue('items') as any[];
    const next = [...current];
    next.splice(1, 0, { description: 'B', amount: 2 });
    form.setValue('items', next);

    const items = form.getValue('items') as any[];
    expect(items).toHaveLength(3);
    expect(items[1].description).toBe('B');
  });

  test('dirty tracking works for arrays', () => {
    expect(form.getDirty('items')).toBe(false);

    form.setValue('items', [{ description: 'New', amount: 50 }]);
    expect(form.getDirty('items')).toBe(true);
    expect(form.isDirty.get()).toBe(true);
  });
});

// ─── Scenario 2: Deeply Nested Objects ───────────────────────────────────────

describe('Scenario 2: Deeply Nested Objects', () => {
  interface CompanyForm {
    company: {
      name: string;
      address: {
        street: string;
        city: string;
        state: string;
        zip: string;
        country: string;
      };
      contact: {
        primary: {
          name: string;
          email: string;
          phone: string;
        };
        billing: {
          name: string;
          email: string;
        };
      };
    };
    notes: string;
  }

  const defaults: CompanyForm = {
    company: {
      name: '',
      address: {
        street: '',
        city: '',
        state: '',
        zip: '',
        country: 'US',
      },
      contact: {
        primary: { name: '', email: '', phone: '' },
        billing: { name: '', email: '' },
      },
    },
    notes: '',
  };

  let form: FormStore<CompanyForm>;

  beforeEach(() => {
    form = new FormStore<CompanyForm>({ defaultValues: defaults });
  });

  test('reads deeply nested defaults', () => {
    expect(form.getValue('company.address.country')).toBe('US');
    expect(form.getValue('company.contact.primary.name')).toBe('');
  });

  test('sets deeply nested values', () => {
    form.setValue('company.contact.primary.email', 'ceo@corp.com');
    expect(form.getValue('company.contact.primary.email')).toBe('ceo@corp.com');
  });

  test('setValues updates multiple nested paths', () => {
    form.setValues({
      company: {
        name: 'Acme Inc',
        address: { city: 'Springfield', state: 'IL' },
      },
    } as any);

    expect(form.getValue('company.name')).toBe('Acme Inc');
    expect(form.getValue('company.address.city')).toBe('Springfield');
    expect(form.getValue('company.address.state')).toBe('IL');
    // Unchanged values should remain
    expect(form.getValue('company.address.country')).toBe('US');
  });

  test('parent signals update when child changes', () => {
    const addressSig = form.getSignal('company.address');

    form.setValue('company.address.city', 'NYC');

    const address = addressSig.get() as any;
    expect(address.city).toBe('NYC');
    expect(address.country).toBe('US'); // unchanged
  });

  test('getValues reconstructs full nested object', () => {
    form.setValue('company.name', 'Test Corp');
    form.setValue('company.address.city', 'LA');
    form.setValue('company.contact.billing.email', 'billing@test.com');

    const values = form.getValues();
    expect(values.company.name).toBe('Test Corp');
    expect(values.company.address.city).toBe('LA');
    expect(values.company.address.country).toBe('US');
    expect(values.company.contact.billing.email).toBe('billing@test.com');
  });

  test('dirty tracking on nested paths', () => {
    form.setValue('company.address.zip', '10001');
    expect(form.getDirty('company.address.zip')).toBe(true);
    expect(form.getDirty('company.name')).toBe(false);
  });

  test('validation on nested fields', async () => {
    form.register('company.name', { validate: required('Company name required') });
    form.register('company.contact.primary.email', {
      validate: compose(required('Contact email required'), email()),
    });

    const isValid = await form.validate();
    expect(isValid).toBe(false);

    expect(form.getErrors('company.name').get()).toContain('Company name required');
    expect(form.getErrors('company.contact.primary.email').get()).toContain('Contact email required');
  });
});

// ─── Scenario 3: Conditional Validation ──────────────────────────────────────

describe('Scenario 3: Conditional Validation with when()', () => {
  interface ShippingForm {
    sameAsBilling: boolean;
    shippingAddress: string;
    shippingCity: string;
    billingAddress: string;
  }

  const defaults: ShippingForm = {
    sameAsBilling: true,
    shippingAddress: '',
    shippingCity: '',
    billingAddress: '123 Main St',
  };

  test('when() skips validation when condition is false', () => {
    const validator = when(
      (_value, context) => !context?.getValue('sameAsBilling'),
      required('Shipping address required')
    );

    const form = new FormStore<ShippingForm>({ defaultValues: defaults });
    const context = {
      getValue: (path: string) => form.getValue(path),
      getValues: () => form.getValues(),
    };

    // sameAsBilling is true, so validation should be skipped
    expect(validator('', context)).toBeUndefined();
  });

  test('when() applies validation when condition is true', () => {
    const validator = when(
      (_value, context) => !context?.getValue('sameAsBilling'),
      required('Shipping address required')
    );

    const form = new FormStore<ShippingForm>({ defaultValues: defaults });
    form.setValue('sameAsBilling', false);

    const context = {
      getValue: (path: string) => form.getValue(path),
      getValues: () => form.getValues(),
    };

    expect(validator('', context)).toBe('Shipping address required');
    expect(validator('456 Oak Ave', context)).toBeUndefined();
  });
});

// ─── Scenario 4: Custom Validators ───────────────────────────────────────────

describe('Scenario 4: Custom Validators', () => {
  test('custom sync validator', () => {
    const noSpaces = custom<string>(
      (value) => (value && value.includes(' ') ? 'No spaces allowed' : undefined)
    );

    expect(noSpaces('hello')).toBeUndefined();
    expect(noSpaces('hello world')).toBe('No spaces allowed');
  });

  test('custom validator in compose chain', () => {
    const strongPassword = compose(
      required(),
      minLength(8),
      custom<string>((value) => {
        if (value && !/[A-Z]/.test(value)) return 'Must contain uppercase';
        if (value && !/[0-9]/.test(value)) return 'Must contain a number';
        return undefined;
      })
    );

    expect(strongPassword('')).toBe('This field is required');
    expect(strongPassword('short')).toBe('Must be at least 8 characters');
    expect(strongPassword('longpassword')).toBe('Must contain uppercase');
    expect(strongPassword('Longpassword')).toBe('Must contain a number');
    expect(strongPassword('Longpass1')).toBeUndefined();
  });

  test('oneOf validator restricts to allowed values', () => {
    const colorValidator = v.oneOf(['red', 'green', 'blue'], 'Invalid color');
    expect(colorValidator('red')).toBeUndefined();
    expect(colorValidator('purple')).toBe('Invalid color');
    expect(colorValidator('')).toBeUndefined(); // empty skipped
  });

  test('notOneOf validator excludes values', () => {
    const bannedWords = v.notOneOf(['admin', 'root', 'test']);
    expect(bannedWords('alice')).toBeUndefined();
    expect(bannedWords('admin')).toBe('Must not be one of: admin, root, test');
  });

  test('number and integer validators', () => {
    expect(v.number()('abc')).toBe('Must be a number');
    expect(v.number()('42')).toBeUndefined();
    expect(v.integer()(3.14)).toBe('Must be an integer');
    expect(v.integer()(42)).toBeUndefined();
  });

  test('min and max validators', () => {
    expect(v.min(18)('16' as any)).toBe('Must be at least 18');
    expect(v.min(18)(20)).toBeUndefined();
    expect(v.max(100)(150)).toBe('Must be at most 100');
    expect(v.max(100)(50)).toBeUndefined();
  });

  test('pattern validator', () => {
    const alphanumeric = v.pattern(/^[a-zA-Z0-9]+$/, 'Only alphanumeric characters');
    expect(alphanumeric('hello123')).toBeUndefined();
    expect(alphanumeric('hello world!')).toBe('Only alphanumeric characters');
  });
});

// ─── Scenario 5: Async Validation ────────────────────────────────────────────

describe('Scenario 5: Async Validation', () => {
  interface UsernameForm {
    username: string;
  }

  test('async validator is flagged correctly', () => {
    const checkUsername = v.async<string>(async (value) => {
      if (value === 'taken') return 'Username already taken';
      return undefined;
    });

    expect(checkUsername._isAsync).toBe(true);
  });

  test('async validator with debounce has debounce flag', () => {
    const checkEmail = v.async<string>(
      async (value) => {
        if (value === 'taken@test.com') return 'Email in use';
        return undefined;
      },
      { debounce: 300 }
    );

    expect(checkEmail._isAsync).toBe(true);
    expect(checkEmail._debounce).toBe(300);
  });

  test('async validator runs and returns error', async () => {
    const checkUsername = v.async<string>(async (value) => {
      // Simulate API call
      await new Promise((r) => setTimeout(r, 10));
      if (value === 'taken') return 'Username already taken';
      return undefined;
    });

    const result = await checkUsername('taken');
    expect(result).toBe('Username already taken');

    const result2 = await checkUsername('available');
    expect(result2).toBeUndefined();
  });

  test('compose with async preserves async flag', () => {
    const composed = compose(
      required(),
      v.async<string>(async (value) => {
        if (value === 'taken') return 'Already taken';
        return undefined;
      })
    );

    expect(composed._isAsync).toBe(true);
  });
});

// ─── Scenario 6: setValues Batch Updates ─────────────────────────────────────

describe('Scenario 6: Batch Updates with setValues', () => {
  interface ProfileForm {
    firstName: string;
    lastName: string;
    email: string;
    bio: string;
    age: number;
  }

  test('setValues updates multiple fields in one call', () => {
    const form = new FormStore<ProfileForm>({
      defaultValues: {
        firstName: '',
        lastName: '',
        email: '',
        bio: '',
        age: 0,
      },
    });

    let notifyCount = 0;
    form.subscribe(() => notifyCount++);

    form.setValues({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@test.com',
    });

    expect(form.getValue('firstName')).toBe('Jane');
    expect(form.getValue('lastName')).toBe('Doe');
    expect(form.getValue('email')).toBe('jane@test.com');
    // Unchanged
    expect(form.getValue('bio')).toBe('');
    expect(form.getValue('age')).toBe(0);
  });
});

// ─── Scenario 7: resetTo and setBaseline ─────────────────────────────────────

describe('Scenario 7: resetTo and setBaseline', () => {
  interface EditForm {
    title: string;
    content: string;
    published: boolean;
  }

  test('resetTo replaces all values and clears state', () => {
    const form = new FormStore<EditForm>({
      defaultValues: { title: '', content: '', published: false },
    });

    form.setValue('title', 'Draft');
    form.setTouched('title');
    form.setErrors('title', ['Too short']);

    form.resetTo({ title: 'Server Title', content: 'Server Content', published: true });

    expect(form.getValue('title')).toBe('Server Title');
    expect(form.getValue('content')).toBe('Server Content');
    expect(form.getValue('published')).toBe(true);
    expect(form.getTouched('title')).toBe(false);
    expect(form.getErrors('title').get()).toEqual([]);
    expect(form.isDirty.get()).toBe(false);
  });

  test('setBaseline updates dirty calculation without changing values', () => {
    const form = new FormStore<EditForm>({
      defaultValues: { title: '', content: '', published: false },
    });

    // Simulate: user loaded data from server, then started editing
    form.setValue('title', 'Server Title');
    form.setValue('content', 'Server Content');

    // Currently dirty because it differs from original defaults
    expect(form.isDirty.get()).toBe(true);

    // Set baseline to current server values
    form.setBaseline({ title: 'Server Title', content: 'Server Content', published: false });

    // Now form should not be dirty since values match baseline
    expect(form.isDirty.get()).toBe(false);
    expect(form.getDirty('title')).toBe(false);
    expect(form.getDirty('content')).toBe(false);

    // Make a new edit — should become dirty again
    form.setValue('title', 'User Edit');
    expect(form.isDirty.get()).toBe(true);
    expect(form.getDirty('title')).toBe(true);
  });

  test('reset after setBaseline goes back to original defaults (not baseline)', () => {
    const form = new FormStore<EditForm>({
      defaultValues: { title: '', content: '', published: false },
    });

    form.setValue('title', 'Edited');
    form.setBaseline({ title: 'Edited', content: '', published: false });
    expect(form.isDirty.get()).toBe(false);

    // reset() goes back to defaultValues
    form.reset();
    expect(form.getValue('title')).toBe('');
  });
});

// ─── Scenario 8: Utility Functions ───────────────────────────────────────────

describe('Scenario 8: Utility Functions', () => {
  test('getPath reads nested values', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getPath(obj, 'a.b.c')).toBe(42);
    expect(getPath(obj, 'a.b')).toEqual({ c: 42 });
    expect(getPath(obj, 'x.y.z')).toBeUndefined();
  });

  test('setPath returns new object with value set', () => {
    const obj = { a: { b: 1 } };
    const result = setPath(obj, 'a.b', 2);

    expect(result.a.b).toBe(2);
    expect(obj.a.b).toBe(1); // original unchanged (immutable)
    expect(result).not.toBe(obj);
  });

  test('setPath creates intermediate objects', () => {
    const obj = {};
    const result = setPath(obj, 'a.b.c', 'deep');
    expect(result).toEqual({ a: { b: { c: 'deep' } } });
  });

  test('deepClone creates independent copy', () => {
    const obj = { a: { b: [1, 2, 3] } };
    const clone = deepClone(obj);

    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    expect(clone.a).not.toBe(obj.a);
    expect(clone.a.b).not.toBe(obj.a.b);
  });

  test('deepEqual compares objects', () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  test('flattenToPaths flattens nested objects', () => {
    const obj = { a: 1, b: { c: 2, d: 3 } };
    const paths = flattenToPaths(obj);

    // Should contain leaf paths
    const pathMap = new Map([...paths]);
    expect(pathMap.get('a')).toBe(1);
    expect(pathMap.get('b.c')).toBe(2);
    expect(pathMap.get('b.d')).toBe(3);
  });

  test('setPath loop pattern with let (immutable gotcha)', () => {
    const items = [
      { path: 'a', value: 1 },
      { path: 'b', value: 2 },
      { path: 'c', value: 3 },
    ];

    let result: Record<string, any> = {};
    for (const item of items) {
      result = setPath(result, item.path, item.value);
    }

    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });
});
