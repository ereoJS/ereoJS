import { useRef, useCallback, useMemo, useEffect, useSyncExternalStore } from 'react';
import { useSignal } from '@ereo/state';
import { FormStore } from './store';
import type {
  FormConfig,
  FormStoreInterface,
  FieldHandle,
  FieldOptions,
  ArrayFieldHelpers,
  ArrayFieldItem,
  FormSubmitState,
} from './types';
import { getPath, deepClone } from './utils';

// ─── useForm ─────────────────────────────────────────────────────────────────

export function useForm<T extends Record<string, any>>(
  config: FormConfig<T>
): FormStore<T> {
  const storeRef = useRef<FormStore<T> | null>(null);

  if (!storeRef.current) {
    storeRef.current = new FormStore(config);
  }

  useEffect(() => {
    return () => {
      storeRef.current?.dispose();
    };
  }, []);

  return storeRef.current;
}

// ─── useField ────────────────────────────────────────────────────────────────

export function useField<T extends Record<string, any>, V = unknown>(
  form: FormStoreInterface<T>,
  name: string,
  opts?: FieldOptions<V>
): FieldHandle<V> {
  // Register field options, and re-register if options change
  const optsRef = useRef(opts);
  const registered = useRef(false);
  if (!registered.current || optsRef.current !== opts) {
    optsRef.current = opts;
    if (opts) {
      form.register(name, opts);
    }
    registered.current = true;
  }

  // Unregister on unmount
  useEffect(() => {
    return () => {
      form.unregister(name);
    };
  }, [form, name]);

  // Subscribe to per-field signal for value
  const valueSig = form.getSignal(name);
  const value = useSignal(valueSig) as V;

  // Subscribe to per-field error signal
  const errorsSig = form.getErrors(name);
  const errors = useSignal(errorsSig);

  // Subscribe to form-level state for touched/dirty
  const touched = useSyncExternalStore(
    useCallback(
      (cb: () => void) => form.subscribe(cb),
      [form]
    ),
    () => form.getTouched(name),
    () => form.getTouched(name)
  );

  const dirty = useSyncExternalStore(
    useCallback(
      (cb: () => void) => form.subscribe(cb),
      [form]
    ),
    () => form.getDirty(name),
    () => form.getDirty(name)
  );

  const validatingSig = form.getFieldValidating(name);
  const validating = useSignal(validatingSig);

  const setValue = useCallback(
    (v: V) => form.setValue(name, v),
    [form, name]
  );

  const setError = useCallback(
    (errs: string[]) => form.setErrors(name, errs),
    [form, name]
  );

  const clearErrors = useCallback(
    () => form.clearErrors(name),
    [form, name]
  );

  const setTouched = useCallback(
    (t: boolean) => form.setTouched(name, t),
    [form, name]
  );

  const reset = useCallback(() => {
    const baseline = getPath((form as FormStore<T>).getBaseline(), name);
    form.setValue(name, baseline);
    form.clearErrors(name);
    form.setTouched(name, false);
  }, [form, name]);

  const onChange = useCallback(
    (e: any) => {
      let newValue: V;
      if (opts?.parse) {
        newValue = opts.parse(e);
      } else if (e && typeof e === 'object' && 'target' in e) {
        const target = e.target;
        newValue = (target.type === 'checkbox' ? target.checked : target.value) as V;
      } else {
        newValue = e as V;
      }
      if (opts?.transform) {
        newValue = opts.transform(newValue);
      }
      form.setValue(name, newValue);
    },
    [form, name, opts]
  );

  const onBlur = useCallback(() => {
    form.setTouched(name);
    form.triggerBlurValidation(name);
  }, [form, name]);

  const refCallback = useCallback(
    (el: HTMLElement | null) => {
      if ((form as FormStore<T>).setFieldRef) {
        (form as FormStore<T>).setFieldRef(name, el);
      }
    },
    [form, name]
  );

  const inputProps = useMemo(
    () => ({
      name,
      value,
      onChange,
      onBlur,
      ref: refCallback,
      ...(errors.length > 0
        ? {
            'aria-invalid': true as const,
            'aria-describedby': `${name}-error`,
          }
        : {}),
    }),
    [name, value, onChange, onBlur, refCallback, errors]
  );

  return {
    inputProps,
    value,
    errors,
    touched,
    dirty,
    validating,
    setValue,
    setError,
    clearErrors,
    setTouched,
    reset,
  };
}

// ─── useFieldArray ───────────────────────────────────────────────────────────

export function useFieldArray<T extends Record<string, any>, Item = unknown>(
  form: FormStoreInterface<T>,
  name: string
): ArrayFieldHelpers<Item> {
  const idCounter = useRef(0);
  // Parallel array of stable IDs — manipulated in sync with items
  const idsRef = useRef<string[]>([]);

  const arraySig = form.getSignal(name);
  const rawArray = useSignal(arraySig) as Item[] | undefined;
  const items = rawArray ?? [];

  // Sync IDs with current array length (handles external changes)
  if (idsRef.current.length < items.length) {
    for (let i = idsRef.current.length; i < items.length; i++) {
      idsRef.current.push(`${name}-${idCounter.current++}`);
    }
  } else if (idsRef.current.length > items.length) {
    idsRef.current.length = items.length;
  }

  const fields: ArrayFieldItem<Item>[] = useMemo(
    () =>
      items.map((value, index) => ({
        id: idsRef.current[index] ?? `${name}-fallback-${index}`,
        value,
        index,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, name]
  );

  const append = useCallback(
    (value: Item) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      idsRef.current = [...idsRef.current, `${name}-${idCounter.current++}`];
      form.setValue(name, [...current, value]);
    },
    [form, name]
  );

  const prepend = useCallback(
    (value: Item) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      idsRef.current = [`${name}-${idCounter.current++}`, ...idsRef.current];
      form.setValue(name, [value, ...current]);
    },
    [form, name]
  );

  const insert = useCallback(
    (index: number, value: Item) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      const next = [...current];
      next.splice(index, 0, value);
      const ids = [...idsRef.current];
      ids.splice(index, 0, `${name}-${idCounter.current++}`);
      idsRef.current = ids;
      form.setValue(name, next);
    },
    [form, name]
  );

  const remove = useCallback(
    (index: number) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      const next = [...current];
      next.splice(index, 1);
      const ids = [...idsRef.current];
      ids.splice(index, 1);
      idsRef.current = ids;
      form.setValue(name, next);
    },
    [form, name]
  );

  const swap = useCallback(
    (indexA: number, indexB: number) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      const next = [...current];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      const ids = [...idsRef.current];
      [ids[indexA], ids[indexB]] = [ids[indexB], ids[indexA]];
      idsRef.current = ids;
      form.setValue(name, next);
    },
    [form, name]
  );

  const move = useCallback(
    (from: number, to: number) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      const ids = [...idsRef.current];
      const [id] = ids.splice(from, 1);
      ids.splice(to, 0, id);
      idsRef.current = ids;
      form.setValue(name, next);
    },
    [form, name]
  );

  const replace = useCallback(
    (index: number, value: Item) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      const next = [...current];
      next[index] = value;
      // Keep same ID — same position, updated value
      form.setValue(name, next);
    },
    [form, name]
  );

  const replaceAll = useCallback(
    (values: Item[]) => {
      idsRef.current = values.map(() => `${name}-${idCounter.current++}`);
      form.setValue(name, values);
    },
    [form, name]
  );

  const clone = useCallback(
    (index: number) => {
      const current = (form.getValue(name) as Item[] | undefined) ?? [];
      const next = [...current];
      const cloned = deepClone(current[index]);
      next.splice(index + 1, 0, cloned);
      const ids = [...idsRef.current];
      ids.splice(index + 1, 0, `${name}-${idCounter.current++}`);
      idsRef.current = ids;
      form.setValue(name, next);
    },
    [form, name]
  );

  return {
    fields,
    append,
    prepend,
    insert,
    remove,
    swap,
    move,
    replace,
    replaceAll,
    clone,
  };
}

// ─── useFormStatus ───────────────────────────────────────────────────────────

export function useFormStatus(form: FormStoreInterface<any>): {
  isSubmitting: boolean;
  submitState: FormSubmitState;
  isValid: boolean;
  isDirty: boolean;
  submitCount: number;
} {
  const isSubmitting = useSignal(form.isSubmitting);
  const submitState = useSignal(form.submitState);
  const isValid = useSignal(form.isValid);
  const isDirty = useSignal(form.isDirty);
  const submitCount = useSignal(form.submitCount);

  return { isSubmitting, submitState, isValid, isDirty, submitCount };
}
