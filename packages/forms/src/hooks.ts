import { useRef, useCallback, useMemo, useEffect, useSyncExternalStore } from 'react';
import { useSignal } from '@ereo/state';
import { FormStore } from './store';
import type {
  FormConfig,
  FormStoreInterface,
  FormPath,
  PathValue,
  FieldHandle,
  FieldOptions,
  ArrayFieldHelpers,
  ArrayFieldItem,
  FormSubmitState,
  ErrorSource,
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

export function useField<T extends Record<string, any>, P extends FormPath<T> = FormPath<T>>(
  form: FormStoreInterface<T>,
  name: P,
  opts?: FieldOptions<PathValue<T, P>>
): FieldHandle<PathValue<T, P>>;
export function useField<T extends Record<string, any>>(
  form: FormStoreInterface<T>,
  name: string,
  opts?: FieldOptions<any>
): FieldHandle<any>;
export function useField<T extends Record<string, any>>(
  form: FormStoreInterface<T>,
  name: string,
  opts?: FieldOptions<any>
): FieldHandle<any> {
  // Internal: cast form to bypass FormPath constraint in implementation overload
  const f = form as FormStoreInterface<any>;

  // Register field options, and re-register if options change
  const optsRef = useRef(opts);
  const registered = useRef(false);
  if (!registered.current || optsRef.current !== opts) {
    optsRef.current = opts;
    if (opts) {
      f.register(name, opts);
    }
    registered.current = true;
  }

  // Unregister on unmount
  useEffect(() => {
    return () => {
      f.unregister(name);
    };
  }, [f, name]);

  // Subscribe to per-field signal for value
  const valueSig = f.getSignal(name);
  const value = useSignal(valueSig);

  // Subscribe to per-field error signal
  const errorsSig = f.getErrors(name);
  const errors = useSignal(errorsSig);

  // Subscribe to form-level state for touched/dirty
  const touched = useSyncExternalStore(
    useCallback(
      (cb: () => void) => f.subscribe(cb),
      [f]
    ),
    () => f.getTouched(name),
    () => f.getTouched(name)
  );

  const dirty = useSyncExternalStore(
    useCallback(
      (cb: () => void) => f.subscribe(cb),
      [f]
    ),
    () => f.getDirty(name),
    () => f.getDirty(name)
  );

  const validatingSig = f.getFieldValidating(name);
  const validating = useSignal(validatingSig);

  // Subscribe to error map signal
  const errorMapSig = f.getErrorMap(name);
  const errorMap = useSignal(errorMapSig);

  const setValue = useCallback(
    (v: any) => f.setValue(name, v),
    [f, name]
  );

  const setError = useCallback(
    (errs: string[]) => f.setErrors(name, errs),
    [f, name]
  );

  const clearErrors = useCallback(
    () => f.clearErrors(name),
    [f, name]
  );

  const setTouched = useCallback(
    (t: boolean) => f.setTouched(name, t),
    [f, name]
  );

  const reset = useCallback(() => {
    const baseline = getPath((form as unknown as FormStore<T>).getBaseline(), name);
    f.setValue(name, baseline);
    f.clearErrors(name);
    f.setTouched(name, false);
  }, [f, form, name]);

  const onChange = useCallback(
    (e: any) => {
      let newValue: any;
      if (opts?.parse) {
        newValue = opts.parse(e);
      } else if (e && typeof e === 'object' && 'target' in e) {
        const target = e.target;
        newValue = target.type === 'checkbox' ? target.checked : target.value;
      } else {
        newValue = e;
      }
      if (opts?.transform) {
        newValue = opts.transform(newValue);
      }
      f.setValue(name, newValue);
    },
    [f, name, opts]
  );

  const onBlur = useCallback(() => {
    f.setTouched(name);
    f.triggerBlurValidation(name);
  }, [f, name]);

  const refCallback = useCallback(
    (el: HTMLElement | null) => {
      if ((form as any).setFieldRef) {
        (form as any).setFieldRef(name, el);
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
    errorMap,
    setValue,
    setError,
    clearErrors,
    setTouched,
    reset,
  };
}

// ─── useFieldArray ───────────────────────────────────────────────────────────

export function useFieldArray<T extends Record<string, any>, P extends FormPath<T> = FormPath<T>>(
  form: FormStoreInterface<T>,
  name: P
): ArrayFieldHelpers<PathValue<T, P> extends (infer U)[] ? U : unknown>;
export function useFieldArray<T extends Record<string, any>>(
  form: FormStoreInterface<T>,
  name: string
): ArrayFieldHelpers<any>;
export function useFieldArray<T extends Record<string, any>>(
  form: FormStoreInterface<T>,
  name: string
): ArrayFieldHelpers<any> {
  const idCounter = useRef(0);
  // Parallel array of stable IDs — manipulated in sync with items
  const idsRef = useRef<string[]>([]);

  const arraySig = form.getSignal(name as any);
  const rawArray = useSignal(arraySig) as any[] | undefined;
  const items = rawArray ?? [];

  // Sync IDs with current array length (handles external changes)
  if (idsRef.current.length < items.length) {
    for (let i = idsRef.current.length; i < items.length; i++) {
      idsRef.current.push(`${name}-${idCounter.current++}`);
    }
  } else if (idsRef.current.length > items.length) {
    idsRef.current.length = items.length;
  }

  const fields: ArrayFieldItem<any>[] = useMemo(
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
    (value: any) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      idsRef.current = [...idsRef.current, `${name}-${idCounter.current++}`];
      (form as any).setValue(name, [...current, value]);
    },
    [form, name]
  );

  const prepend = useCallback(
    (value: any) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      idsRef.current = [`${name}-${idCounter.current++}`, ...idsRef.current];
      (form as any).setValue(name, [value, ...current]);
    },
    [form, name]
  );

  const insert = useCallback(
    (index: number, value: any) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      const next = [...current];
      next.splice(index, 0, value);
      const ids = [...idsRef.current];
      ids.splice(index, 0, `${name}-${idCounter.current++}`);
      idsRef.current = ids;
      (form as any).setValue(name, next);
    },
    [form, name]
  );

  const remove = useCallback(
    (index: number) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      const next = [...current];
      next.splice(index, 1);
      const ids = [...idsRef.current];
      ids.splice(index, 1);
      idsRef.current = ids;
      (form as any).setValue(name, next);
    },
    [form, name]
  );

  const swap = useCallback(
    (indexA: number, indexB: number) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      const next = [...current];
      [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
      const ids = [...idsRef.current];
      [ids[indexA], ids[indexB]] = [ids[indexB], ids[indexA]];
      idsRef.current = ids;
      (form as any).setValue(name, next);
    },
    [form, name]
  );

  const move = useCallback(
    (from: number, to: number) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      const ids = [...idsRef.current];
      const [id] = ids.splice(from, 1);
      ids.splice(to, 0, id);
      idsRef.current = ids;
      (form as any).setValue(name, next);
    },
    [form, name]
  );

  const replace = useCallback(
    (index: number, value: any) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      const next = [...current];
      next[index] = value;
      // Keep same ID — same position, updated value
      (form as any).setValue(name, next);
    },
    [form, name]
  );

  const replaceAll = useCallback(
    (values: any[]) => {
      idsRef.current = values.map(() => `${name}-${idCounter.current++}`);
      (form as any).setValue(name, values);
    },
    [form, name]
  );

  const clone = useCallback(
    (index: number) => {
      const current = (form.getValue(name as any) as any[] | undefined) ?? [];
      const next = [...current];
      const cloned = deepClone(current[index]);
      next.splice(index + 1, 0, cloned);
      const ids = [...idsRef.current];
      ids.splice(index + 1, 0, `${name}-${idCounter.current++}`);
      idsRef.current = ids;
      (form as any).setValue(name, next);
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

// ─── useWatch ────────────────────────────────────────────────────────────────

export function useWatch<T extends Record<string, any>, P extends FormPath<T>>(
  form: FormStoreInterface<T>,
  path: P
): PathValue<T, P>;
export function useWatch<T extends Record<string, any>, P extends FormPath<T>>(
  form: FormStoreInterface<T>,
  paths: P[]
): unknown[];
export function useWatch<T extends Record<string, any>>(
  form: FormStoreInterface<T>,
  pathOrPaths: string | string[]
): any {
  const f = form as FormStoreInterface<any>;

  if (typeof pathOrPaths === 'string') {
    const sig = f.getSignal(pathOrPaths as any);
    return useSignal(sig);
  }

  // Multi-field: subscribe to all signals, return tuple with stable reference
  const prevRef = useRef<any[]>([]);

  const subscribe = useCallback(
    (cb: () => void) => {
      const unsubs = pathOrPaths.map(p => f.getSignal(p as any).subscribe(cb));
      return () => unsubs.forEach(u => u());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f, ...pathOrPaths]
  );

  const getSnapshot = useCallback(
    () => {
      const next = pathOrPaths.map(p => f.getValue(p as any));
      // Return prev ref if values haven't changed (shallow equal)
      if (
        next.length === prevRef.current.length &&
        next.every((v, i) => v === prevRef.current[i])
      ) {
        return prevRef.current;
      }
      prevRef.current = next;
      return next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f, ...pathOrPaths]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
