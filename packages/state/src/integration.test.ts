/**
 * @ereo/state - Integration Tests
 *
 * Tests that verify the state primitives work correctly in patterns used by
 * consuming packages (forms, wizard, etc.). These tests simulate real-world
 * usage without importing the consuming packages directly.
 */

import { describe, expect, test } from 'bun:test';
import { Signal, signal, computed, batch, Store, createStore } from './signals';

// ===========================================================================
// Form-like per-field signal architecture
// ===========================================================================

describe('form-like per-field signal pattern', () => {
  /**
   * Simulates FormStore's per-field signal map pattern.
   * Each field gets a lazy signal, errors get their own signals,
   * and status signals track form state.
   */
  function createFormSignals<T extends Record<string, any>>(defaults: T) {
    const fields = new Map<string, Signal<unknown>>();
    const errors = new Map<string, Signal<string[]>>();
    const isSubmitting = signal(false);
    const isDirty = signal(false);
    const isValid = signal(true);

    // Initialize signals from defaults
    for (const [key, value] of Object.entries(defaults)) {
      fields.set(key, signal(value));
      errors.set(key, signal<string[]>([]));
    }

    return {
      fields,
      errors,
      isSubmitting,
      isDirty,
      isValid,
      getField: (key: string) => {
        let sig = fields.get(key);
        if (!sig) {
          sig = signal(undefined);
          fields.set(key, sig);
        }
        return sig;
      },
      getErrors: (key: string) => {
        let sig = errors.get(key);
        if (!sig) {
          sig = signal<string[]>([]);
          errors.set(key, sig);
        }
        return sig;
      },
    };
  }

  test('lazy signal creation for unknown fields', () => {
    const form = createFormSignals({ name: '' });

    // Access a field that wasn't in defaults
    const emailSig = form.getField('email');
    expect(emailSig.get()).toBe(undefined);

    emailSig.set('test@example.com');
    expect(emailSig.get()).toBe('test@example.com');
  });

  test('setValue with batch groups notifications', () => {
    const form = createFormSignals({ name: '', email: '' });
    let notifyCount = 0;

    form.getField('name').subscribe(() => notifyCount++);
    form.getField('email').subscribe(() => notifyCount++);

    // Simulate FormStore.setValues with batch
    batch(() => {
      form.getField('name').set('Alice');
      form.getField('email').set('alice@test.com');
    });

    // Each field notified once (2 total), not incrementally during batch
    expect(notifyCount).toBe(2);
    expect(form.getField('name').get()).toBe('Alice');
    expect(form.getField('email').get()).toBe('alice@test.com');
  });

  test('error signal independence from value signal', () => {
    const form = createFormSignals({ name: '' });

    const valueChanges: unknown[] = [];
    const errorChanges: string[][] = [];

    form.getField('name').subscribe((v) => valueChanges.push(v));
    form.getErrors('name').subscribe((e) => errorChanges.push(e));

    // Set value
    form.getField('name').set('test');
    expect(valueChanges).toEqual(['test']);
    expect(errorChanges).toEqual([]);

    // Set errors
    form.getErrors('name').set(['Required']);
    expect(valueChanges).toEqual(['test']);
    expect(errorChanges).toEqual([['Required']]);

    // Clear errors
    form.getErrors('name').set([]);
    expect(errorChanges).toEqual([['Required'], []]);
  });

  test('submit lifecycle with batch', () => {
    const form = createFormSignals({ name: 'Alice' });
    const stateLog: string[] = [];

    form.isSubmitting.subscribe((v) => stateLog.push(`submitting:${v}`));

    // Start submit
    batch(() => {
      form.isSubmitting.set(true);
    });
    expect(stateLog).toEqual(['submitting:true']);

    // End submit
    batch(() => {
      form.isSubmitting.set(false);
    });
    expect(stateLog).toEqual(['submitting:true', 'submitting:false']);
  });

  test('dirty tracking via signal comparison', () => {
    const form = createFormSignals({ count: 0 });
    const baseline = 0;

    form.getField('count').subscribe((v) => {
      form.isDirty.set(v !== baseline);
    });

    form.getField('count').set(5);
    expect(form.isDirty.get()).toBe(true);

    form.getField('count').set(0);
    expect(form.isDirty.get()).toBe(false);
  });

  test('multiple field validation with batch', () => {
    const form = createFormSignals({ name: '', email: '' });
    let validNotifyCount = 0;
    form.isValid.subscribe(() => validNotifyCount++);

    // Simulate validateAll: clear all errors then set new ones
    batch(() => {
      form.getErrors('name').set([]);
      form.getErrors('email').set([]);
      // Then set actual errors
      form.getErrors('name').set(['Required']);
      form.getErrors('email').set(['Invalid email']);
      form.isValid.set(false);
    });

    expect(form.isValid.get()).toBe(false);
    expect(validNotifyCount).toBe(1); // batched into one notification
  });
});

// ===========================================================================
// Wizard-like signal pattern
// ===========================================================================

describe('wizard-like signal pattern', () => {
  test('step signal with completed steps tracking', () => {
    const currentStep = signal(0);
    const completedSteps = signal(new Set<string>());
    const log: string[] = [];

    currentStep.subscribe((v) => log.push(`step:${v}`));
    completedSteps.subscribe(() => log.push('completed-changed'));

    // Advance to next step
    batch(() => {
      const completed = new Set(completedSteps.get());
      completed.add('step-0');
      completedSteps.set(completed);
      currentStep.set(1);
    });

    // Both fire after batch
    expect(log).toEqual(['completed-changed', 'step:1']);
    expect(currentStep.get()).toBe(1);
    expect(completedSteps.get().has('step-0')).toBe(true);
  });

  test('wizard reset with batch', () => {
    const currentStep = signal(3);
    const completedSteps = signal(new Set(['step-0', 'step-1', 'step-2']));

    batch(() => {
      currentStep.set(0);
      completedSteps.set(new Set());
    });

    expect(currentStep.get()).toBe(0);
    expect(completedSteps.get().size).toBe(0);
  });

  test('wizard subscription cleanup (dispose pattern)', () => {
    const currentStep = signal(0);
    const completedSteps = signal(new Set<string>());

    const log: string[] = [];
    const unsub1 = currentStep.subscribe(() => log.push('step'));
    const unsub2 = completedSteps.subscribe(() => log.push('completed'));

    currentStep.set(1);
    expect(log).toEqual(['step']);

    // Cleanup (simulate wizard dispose)
    unsub1();
    unsub2();

    currentStep.set(2);
    completedSteps.set(new Set(['a']));
    // No new entries — subscriptions cleaned up
    expect(log).toEqual(['step']);
  });
});

// ===========================================================================
// Validation engine signal pattern
// ===========================================================================

describe('validation engine signal pattern', () => {
  test('per-field validating signal lifecycle', () => {
    const validating = new Map<string, Signal<boolean>>();

    function getValidating(field: string): Signal<boolean> {
      let sig = validating.get(field);
      if (!sig) {
        sig = signal(false);
        validating.set(field, sig);
      }
      return sig;
    }

    const nameValidating = getValidating('name');
    expect(nameValidating.get()).toBe(false);

    // Start validation
    nameValidating.set(true);
    expect(nameValidating.get()).toBe(true);

    // End validation
    nameValidating.set(false);
    expect(nameValidating.get()).toBe(false);

    // Same signal returned on second access
    expect(getValidating('name')).toBe(nameValidating);
  });

  test('validation with abort/generation pattern', () => {
    let generation = 0;
    const errors = signal<string[]>([]);
    const validating = signal(false);
    const log: string[] = [];

    errors.subscribe((e) => log.push(`errors:${e.join(',')}`));
    validating.subscribe((v) => log.push(`validating:${v}`));

    // First validation starts
    const gen1 = ++generation;
    validating.set(true);

    // Simulate async — second validation starts before first finishes
    const gen2 = ++generation;
    validating.set(true); // already true, no notification (Object.is check)

    // First validation completes but is stale
    if (gen1 === generation) {
      // This won't execute since gen1 !== gen2
      errors.set(['error from gen1']);
    }

    // Second validation completes
    if (gen2 === generation) {
      errors.set(['Required']);
      validating.set(false);
    }

    expect(errors.get()).toEqual(['Required']);
    expect(validating.get()).toBe(false);
    expect(log).toEqual(['validating:true', 'errors:Required', 'validating:false']);
  });
});

// ===========================================================================
// useSyncExternalStore contract with forms patterns
// ===========================================================================

describe('useSyncExternalStore contract with form patterns', () => {
  test('field signal subscribe/getSnapshot contract', () => {
    const fieldSig = signal('');

    // Simulate useSyncExternalStore subscribe
    let externalNotified = false;
    const unsub = fieldSig.subscribe(() => {
      externalNotified = true;
    });

    // Simulate useSyncExternalStore getSnapshot
    expect(fieldSig.get()).toBe('');

    // Value change should notify
    fieldSig.set('hello');
    expect(externalNotified).toBe(true);
    expect(fieldSig.get()).toBe('hello');

    unsub();
  });

  test('error signal subscribe/getSnapshot contract', () => {
    const errSig = signal<string[]>([]);

    let notifiedCount = 0;
    const unsub = errSig.subscribe(() => notifiedCount++);

    // Each distinct array reference triggers notification
    errSig.set(['Required']);
    expect(notifiedCount).toBe(1);
    expect(errSig.get()).toEqual(['Required']);

    // Same content, different reference
    errSig.set(['Required']);
    expect(notifiedCount).toBe(2); // new array reference

    // Clear errors
    errSig.set([]);
    expect(notifiedCount).toBe(3);
    expect(errSig.get()).toEqual([]);

    unsub();
  });

  test('status signals subscribe consistency', () => {
    const isSubmitting = signal(false);
    const isDirty = signal(false);
    const isValid = signal(true);

    const state: { submitting: boolean; dirty: boolean; valid: boolean }[] = [];

    // Simulate multiple useSignal calls subscribing independently
    const u1 = isSubmitting.subscribe(() => {
      state.push({
        submitting: isSubmitting.get(),
        dirty: isDirty.get(),
        valid: isValid.get(),
      });
    });
    const u2 = isDirty.subscribe(() => {
      state.push({
        submitting: isSubmitting.get(),
        dirty: isDirty.get(),
        valid: isValid.get(),
      });
    });

    batch(() => {
      isSubmitting.set(true);
      isDirty.set(true);
    });

    // After batch, both subscribers fire with consistent final state
    for (const s of state) {
      expect(s.submitting).toBe(true);
      expect(s.dirty).toBe(true);
    }

    u1();
    u2();
  });
});

// ===========================================================================
// Signal disposal chain (forms dispose lifecycle)
// ===========================================================================

describe('forms dispose lifecycle', () => {
  test('disposing form signals stops all subscriber notifications', () => {
    const fields = new Map<string, Signal<unknown>>();
    const errors = new Map<string, Signal<string[]>>();
    const status = {
      isSubmitting: signal(false),
      isDirty: signal(false),
      isValid: signal(true),
    };

    fields.set('name', signal('Alice'));
    errors.set('name', signal<string[]>([]));

    let notified = false;
    const unsubs = [
      fields.get('name')!.subscribe(() => { notified = true; }),
      errors.get('name')!.subscribe(() => { notified = true; }),
      status.isSubmitting.subscribe(() => { notified = true; }),
    ];

    // Dispose: unsubscribe all
    unsubs.forEach((u) => u());

    // No notifications after dispose
    notified = false;
    fields.get('name')!.set('Bob');
    errors.get('name')!.set(['Error']);
    status.isSubmitting.set(true);
    expect(notified).toBe(false);
  });

  test('computed signals disposed when form disposes', () => {
    const a = signal<number>(1);
    const b = signal<number>(2);
    const sum = computed<number>(() => a.get() + b.get(), [a as Signal<unknown>, b as Signal<unknown>]);

    expect(sum.get()).toBe(3);

    // Dispose
    sum.dispose();

    // Changes to deps don't propagate
    a.set(10);
    b.set(20);
    expect(sum.get()).toBe(3);

    // Deps are still usable
    expect(a.get()).toBe(10);
    expect(b.get()).toBe(20);
  });

  test('map chains disposed correctly in wizard pattern', () => {
    const currentStep = signal(0);
    const stepName = currentStep.map((s) => `Step ${s + 1}`);
    const isLast = currentStep.map((s) => s === 2);

    expect(stepName.get()).toBe('Step 1');
    expect(isLast.get()).toBe(false);

    currentStep.set(2);
    expect(stepName.get()).toBe('Step 3');
    expect(isLast.get()).toBe(true);

    // Dispose the source
    currentStep.dispose();

    currentStep.set(0);
    // Mapped signals frozen (source subscribers cleared)
    expect(stepName.get()).toBe('Step 3');
    expect(isLast.get()).toBe(true);
  });
});

// ===========================================================================
// Batch + computed interaction (the diamond problem in forms)
// ===========================================================================

describe('batch + computed in form context', () => {
  test('isValid computed updates correctly when multiple errors change in batch', () => {
    const nameErrors = signal<string[]>([]);
    const emailErrors = signal<string[]>([]);

    // isValid as a computed that checks all error signals
    const isValid = computed<boolean>(
      () => nameErrors.get().length === 0 && emailErrors.get().length === 0,
      [nameErrors as Signal<unknown>, emailErrors as Signal<unknown>]
    );

    expect(isValid.get()).toBe(true);

    // Set errors in batch
    batch(() => {
      nameErrors.set(['Required']);
      emailErrors.set(['Invalid']);
    });

    expect(isValid.get()).toBe(false);

    // Clear errors in batch
    batch(() => {
      nameErrors.set([]);
      emailErrors.set([]);
    });

    expect(isValid.get()).toBe(true);
  });

  test('form dirty tracking with computed', () => {
    const name = signal('');
    const email = signal('');
    const baselines = { name: '', email: '' };

    const isDirty = computed<boolean>(
      () => name.get() !== baselines.name || email.get() !== baselines.email,
      [name as Signal<unknown>, email as Signal<unknown>]
    );

    expect(isDirty.get()).toBe(false);

    name.set('Alice');
    expect(isDirty.get()).toBe(true);

    name.set('');
    expect(isDirty.get()).toBe(false);

    batch(() => {
      name.set('Bob');
      email.set('bob@test.com');
    });
    expect(isDirty.get()).toBe(true);
  });

  test('nested batch in setValue pattern', () => {
    const field = signal('');
    const isDirty = signal(false);
    let notifyCount = 0;

    field.subscribe(() => notifyCount++);
    isDirty.subscribe(() => notifyCount++);

    // Simulate nested batch (setValue calls batch, caller also calls batch)
    batch(() => {
      batch(() => {
        field.set('value');
        isDirty.set(true);
      });
      // Still inside outer batch — no notifications yet
      expect(notifyCount).toBe(0);
    });

    // After outermost batch completes
    expect(notifyCount).toBe(2);
  });
});

// ===========================================================================
// Store used as global app state (alongside form signals)
// ===========================================================================

describe('Store as global app state', () => {
  test('store coexists with standalone signals', () => {
    const appStore = createStore({ theme: 'light', locale: 'en' });
    const formField = signal('');

    const themeChanges: string[] = [];
    const fieldChanges: string[] = [];

    appStore.get('theme').subscribe((v) => themeChanges.push(v));
    formField.subscribe((v) => fieldChanges.push(v));

    appStore.set('theme', 'dark');
    formField.set('hello');

    expect(themeChanges).toEqual(['dark']);
    expect(fieldChanges).toEqual(['hello']);
  });

  test('store batch with standalone signals in same batch', () => {
    const store = createStore({ count: 0 });
    const independent = signal('');
    let totalNotify = 0;

    store.get('count').subscribe(() => totalNotify++);
    independent.subscribe(() => totalNotify++);

    batch(() => {
      store.set('count', 1);
      independent.set('changed');
    });

    expect(totalNotify).toBe(2);
  });
});

// ===========================================================================
// Error recovery patterns
// ===========================================================================

describe('error recovery patterns', () => {
  test('subscriber error in form-like signal does not break form state', () => {
    const field = signal('');
    const isDirty = signal(false);
    const origError = console.error;
    const errors: unknown[] = [];
    console.error = (...args: unknown[]) => errors.push(args[1]);

    // First subscriber throws
    field.subscribe(() => { throw new Error('render crash'); });

    // Other field operations still work
    const dirtyValues: boolean[] = [];
    isDirty.subscribe((v) => dirtyValues.push(v));

    field.set('test');
    isDirty.set(true);

    expect(isDirty.get()).toBe(true);
    expect(dirtyValues).toEqual([true]);
    expect(errors.length).toBe(1); // field subscriber error was caught

    console.error = origError;
  });

  test('batch error recovery: notifications still fire', () => {
    const a = signal(0);
    const b = signal(0);
    const bValues: number[] = [];

    b.subscribe((v) => bValues.push(v));

    expect(() => {
      batch(() => {
        a.set(1);
        b.set(2);
        throw new Error('submit failed');
      });
    }).toThrow('submit failed');

    // Both signals were updated before the throw
    expect(a.get()).toBe(1);
    expect(b.get()).toBe(2);
    // Notifications still fired
    expect(bValues).toEqual([2]);
  });

  test('signal works normally after subscriber error', () => {
    const s = signal(0);
    const origError = console.error;
    console.error = () => {};

    s.subscribe(() => { throw new Error('crash'); });

    s.set(1); // error caught by _fireSubscribers
    s.set(2); // signal still works
    expect(s.get()).toBe(2);

    console.error = origError;
  });
});
