import { Signal, signal, batch } from '@ereo/state';
import type {
  FormConfig,
  FormStoreInterface,
  FormSubmitState,
  FormPath,
  PathValue,
  FieldOptions,
  FieldRegistration,
  FieldInputProps,
  SubmitHandler,
  WatchCallback,
  DeepPartial,
  ValidatorFunction,
  ErrorSource,
} from './types';
import { getPath, setPath, deepClone, deepEqual, flattenToPaths } from './utils';
import { createValuesProxy } from './proxy';
import { ValidationEngine } from './validation-engine';
import { focusFirstError } from './a11y';

export class FormStore<T extends Record<string, any> = Record<string, any>>
  implements FormStoreInterface<T>
{
  readonly config: FormConfig<T>;

  // Per-field signal map — lazy creation on first access
  private _signals = new Map<string, Signal<unknown>>();
  private _errorSignals = new Map<string, Signal<string[]>>();
  private _errorMapSignals = new Map<string, Signal<Record<ErrorSource, string[]>>>();
  private _formErrors: Signal<string[]>;
  private _baseline: T;
  private _touchedSet = new Set<string>();
  private _dirtySet = new Set<string>();
  private _fieldRefs = new Map<string, HTMLElement | null>();
  private _fieldOptions = new Map<string, FieldOptions<any>>();
  private _subscribers = new Set<() => void>();
  private _watchers = new Map<string, Set<WatchCallback>>();
  private _submitAbort: AbortController | null = null;
  private _submitGeneration = 0;
  private _validationEngine: ValidationEngine<T>;

  // Reactive status signals
  readonly isValid: Signal<boolean>;
  readonly isDirty: Signal<boolean>;
  readonly isSubmitting: Signal<boolean>;
  readonly submitState: Signal<FormSubmitState>;
  readonly submitCount: Signal<number>;

  // Proxy for natural property access
  readonly values: T;

  constructor(config: FormConfig<T>) {
    this.config = config;
    this._baseline = deepClone(config.defaultValues);

    // Initialize field signals from default values
    const paths = flattenToPaths(config.defaultValues);
    for (const [path, value] of paths) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        this._signals.set(path, signal(value));
      }
    }
    // Also store object/array signals for parent paths
    for (const [path, value] of paths) {
      if (!this._signals.has(path)) {
        this._signals.set(path, signal(value));
      }
    }

    this._formErrors = signal<string[]>([]);

    // Status signals
    this.isSubmitting = signal(false);
    this.submitState = signal<FormSubmitState>('idle');
    this.submitCount = signal(0);
    this.isDirty = signal(false);
    this.isValid = signal(true);

    // Create proxy for values access
    this.values = createValuesProxy(this);

    // Create validation engine
    this._validationEngine = new ValidationEngine(this);

    // Validate on mount if configured
    if (config.validateOnMount) {
      // Run asynchronously so constructor completes first
      Promise.resolve().then(() => {
        this._validationEngine.validateAll().catch(() => {
          // Swallow errors from mount validation
        });
      });
    }
  }

  // ─── Signal Access ───────────────────────────────────────────────────────

  getSignal<P extends FormPath<T>>(path: P): Signal<PathValue<T, P>>;
  getSignal(path: string): Signal<unknown>;
  getSignal(path: string): Signal<any> {
    let sig = this._signals.get(path);
    if (!sig) {
      let value = getPath(this._baseline, path);
      // If baseline doesn't have this path, derive from closest parent signal
      if (value === undefined) {
        const parts = path.split('.');
        for (let i = parts.length - 1; i >= 1; i--) {
          const parentPath = parts.slice(0, i).join('.');
          const parentSig = this._signals.get(parentPath);
          if (parentSig) {
            const parentVal = parentSig.get();
            if (parentVal != null && typeof parentVal === 'object') {
              const rest = parts.slice(i);
              let current: any = parentVal;
              for (const part of rest) {
                if (current == null || typeof current !== 'object') { current = undefined; break; }
                current = (current as any)[part];
              }
              if (current !== undefined) value = current;
            }
            break;
          }
        }
      }
      sig = signal(value);
      this._signals.set(path, sig);
    }
    return sig;
  }

  getErrors<P extends FormPath<T>>(path: P): Signal<string[]>;
  getErrors(path: string): Signal<string[]>;
  getErrors(path: string): Signal<string[]> {
    let sig = this._errorSignals.get(path);
    if (!sig) {
      sig = signal<string[]>([]);
      this._errorSignals.set(path, sig);
    }
    return sig;
  }

  getFormErrors(): Signal<string[]> {
    return this._formErrors;
  }

  // ─── Value Access ──────────────────────────────────────────────────────

  getValue<P extends FormPath<T>>(path: P): PathValue<T, P>;
  getValue(path: string): unknown;
  getValue(path: string): unknown {
    return this.getSignal(path).get();
  }

  setValue<P extends FormPath<T>>(path: P, value: PathValue<T, P>): void;
  setValue(path: string, value: unknown): void;
  setValue(path: string, value: unknown): void {
    batch(() => {
      const sig = this.getSignal(path);
      const oldValue = sig.get();
      if (oldValue === value) return;

      sig.set(value);

      // Propagate array/object values down to existing child signals
      if (value !== null && typeof value === 'object') {
        this._syncChildSignals(path, value);
      }

      // Update parent object signals and notify their watchers
      this._updateParentSignals(path, value);

      // Dirty tracking
      const baselineValue = getPath(this._baseline, path);
      if (deepEqual(value, baselineValue)) {
        this._dirtySet.delete(path);
      } else {
        this._dirtySet.add(path);
      }
      this.isDirty.set(this._dirtySet.size > 0);

      // Trigger validation based on engine strategy
      this._validationEngine.onFieldChange(path);

      // Notify watchers for this path
      this._notifyWatchers(path, value);
      this._notifySubscribers();
    });
  }

  setValues(partial: DeepPartial<T>): void {
    batch(() => {
      const paths = flattenToPaths(partial);
      for (const [path, value] of paths) {
        if (typeof value !== 'object' || value === null) {
          this.setValue(path, value);
        }
      }
    });
  }

  getValues(): T {
    return this._getCurrentValues();
  }

  private _syncChildSignals(path: string, value: any): void {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const childPath = `${path}.${i}`;
        const childSig = this._signals.get(childPath);
        if (childSig) {
          childSig.set(value[i]);
        }
        // Recurse into nested objects/arrays
        if (value[i] !== null && typeof value[i] === 'object') {
          this._syncChildSignals(childPath, value[i]);
        }
      }
      // Clean up signals for indices beyond the new array length
      const prefix = path + '.';
      for (const key of [...this._signals.keys()]) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const dotIdx = rest.indexOf('.');
          const segment = dotIdx === -1 ? rest : rest.slice(0, dotIdx);
          const idx = parseInt(segment, 10);
          if (!isNaN(idx) && idx >= value.length) {
            this._signals.delete(key);
          }
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key of Object.keys(value)) {
        const childPath = `${path}.${key}`;
        const childSig = this._signals.get(childPath);
        if (childSig) {
          childSig.set(value[key]);
        }
        if (value[key] !== null && typeof value[key] === 'object') {
          this._syncChildSignals(childPath, value[key]);
        }
      }
    }
  }

  private _updateParentSignals(path: string, _childValue: unknown): void {
    const parts = path.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join('.');
      const parentSig = this._signals.get(parentPath);
      if (parentSig) {
        const newValue = this._reconstructValue(parentPath);
        parentSig.set(newValue);
        // Notify watchers on parent paths
        this._notifyWatchers(parentPath, newValue);
      }
    }
  }

  private _reconstructValue(path: string): unknown {
    // Use signals for child values, falling back to baseline for shape
    const baselineVal = getPath(this._baseline, path);
    // Also get the current signal value for this path as a secondary fallback
    const currentSigVal = this._signals.get(path)?.get();

    // For non-objects, just return the signal value
    if (baselineVal === null || typeof baselineVal !== 'object') {
      return this.getSignal(path).get();
    }

    // Collect all known child paths from signals
    const prefix = path + '.';

    // Determine the shape source: use current signal value if it's an array/object,
    // otherwise fall back to baseline
    const shapeSource = (currentSigVal !== null && typeof currentSigVal === 'object') ? currentSigVal : baselineVal;

    if (Array.isArray(shapeSource) || Array.isArray(baselineVal)) {
      const sourceArray = Array.isArray(shapeSource) ? shapeSource : baselineVal;
      // Determine array length from signals (may have grown beyond baseline)
      let maxLen = (sourceArray as any[]).length;
      for (const key of this._signals.keys()) {
        if (key.startsWith(prefix)) {
          const rest = key.slice(prefix.length);
          const dotIdx = rest.indexOf('.');
          const segment = dotIdx === -1 ? rest : rest.slice(0, dotIdx);
          const idx = parseInt(segment, 10);
          if (!isNaN(idx) && idx >= maxLen) {
            maxLen = idx + 1;
          }
        }
      }
      const result: unknown[] = [];
      for (let i = 0; i < maxLen; i++) {
        const childPath = `${path}.${i}`;
        const childSig = this._signals.get(childPath);
        if (childSig) {
          result[i] = childSig.get();
        } else {
          // Try current signal value first, then baseline
          const fromCurrent = Array.isArray(currentSigVal) ? currentSigVal[i] : undefined;
          result[i] = fromCurrent ?? (baselineVal as any[])?.[i] ?? undefined;
        }
      }
      return result;
    }

    // Object: merge baseline keys with any new signal keys
    const result: Record<string, unknown> = {};
    const keys = new Set(Object.keys(baselineVal));
    for (const key of this._signals.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const dotIdx = rest.indexOf('.');
        const segment = dotIdx === -1 ? rest : rest.slice(0, dotIdx);
        keys.add(segment);
      }
    }
    for (const key of keys) {
      const childPath = `${path}.${key}`;
      const childSig = this._signals.get(childPath);
      result[key] = childSig ? childSig.get() : (baselineVal as any)[key];
    }
    return result;
  }

  // ─── Error Management ────────────────────────────────────────────────

  setErrors<P extends FormPath<T>>(path: P, errors: string[]): void;
  setErrors(path: string, errors: string[]): void;
  setErrors(path: string, errors: string[]): void {
    batch(() => {
      this.getErrors(path).set(errors);
      // Also update error map with 'manual' source (unless caller is engine which uses setErrorsWithSource)
      const mapSig = this._errorMapSignals.get(path);
      if (mapSig) {
        const current = mapSig.get();
        mapSig.set({ ...current, manual: errors });
      }
      this._updateIsValid();
      this._notifySubscribers();
    });
  }

  clearErrors<P extends FormPath<T>>(path?: P): void;
  clearErrors(path?: string): void;
  clearErrors(path?: string): void {
    batch(() => {
      if (path) {
        const sig = this._errorSignals.get(path);
        if (sig) sig.set([]);
        const mapSig = this._errorMapSignals.get(path);
        if (mapSig) mapSig.set(this._emptyErrorMap());
      } else {
        for (const sig of this._errorSignals.values()) {
          sig.set([]);
        }
        for (const sig of this._errorMapSignals.values()) {
          sig.set(this._emptyErrorMap());
        }
        this._formErrors.set([]);
      }
      this._updateIsValid();
      this._notifySubscribers();
    });
  }

  setFormErrors(errors: string[]): void {
    batch(() => {
      this._formErrors.set(errors);
      this._updateIsValid();
      this._notifySubscribers();
    });
  }

  // ─── Error Map (Error Source Tracking) ──────────────────────────────

  private _emptyErrorMap(): Record<ErrorSource, string[]> {
    return { sync: [], async: [], schema: [], server: [], manual: [] };
  }

  getErrorMap<P extends FormPath<T>>(path: P): Signal<Record<ErrorSource, string[]>>;
  getErrorMap(path: string): Signal<Record<ErrorSource, string[]>>;
  getErrorMap(path: string): Signal<Record<ErrorSource, string[]>> {
    let sig = this._errorMapSignals.get(path);
    if (!sig) {
      sig = signal<Record<ErrorSource, string[]>>(this._emptyErrorMap());
      this._errorMapSignals.set(path, sig);
    }
    return sig;
  }

  setErrorsWithSource<P extends FormPath<T>>(path: P, errors: string[], source: ErrorSource): void;
  setErrorsWithSource(path: string, errors: string[], source: ErrorSource): void;
  setErrorsWithSource(path: string, errors: string[], source: ErrorSource): void {
    batch(() => {
      const mapSig = this.getErrorMap(path);
      const current = mapSig.get();
      const updated = { ...current, [source]: errors };
      mapSig.set(updated);
      // Rebuild flat error signal from all sources
      this._rebuildFlatErrors(path, updated);
    });
  }

  clearErrorsBySource<P extends FormPath<T>>(path: P, source: ErrorSource): void;
  clearErrorsBySource(path: string, source: ErrorSource): void;
  clearErrorsBySource(path: string, source: ErrorSource): void {
    batch(() => {
      const mapSig = this._errorMapSignals.get(path);
      if (!mapSig) return;
      const current = mapSig.get();
      if (current[source].length === 0) return;
      const updated = { ...current, [source]: [] };
      mapSig.set(updated);
      this._rebuildFlatErrors(path, updated);
    });
  }

  private _rebuildFlatErrors(path: string, errorMap: Record<ErrorSource, string[]>): void {
    const flat: string[] = [];
    for (const source of ['sync', 'async', 'schema', 'server', 'manual'] as ErrorSource[]) {
      flat.push(...errorMap[source]);
    }
    this.getErrors(path).set(flat);
    this._updateIsValid();
    this._notifySubscribers();
  }

  private _updateIsValid(): void {
    let valid = this._formErrors.get().length === 0;
    if (valid) {
      for (const sig of this._errorSignals.values()) {
        if (sig.get().length > 0) {
          valid = false;
          break;
        }
      }
    }
    this.isValid.set(valid);
  }

  // ─── Touched / Dirty ────────────────────────────────────────────────

  getTouched<P extends FormPath<T>>(path: P): boolean;
  getTouched(path: string): boolean;
  getTouched(path: string): boolean {
    return this._touchedSet.has(path);
  }

  setTouched<P extends FormPath<T>>(path: P, touched?: boolean): void;
  setTouched(path: string, touched?: boolean): void;
  setTouched(path: string, touched = true): void {
    if (touched) {
      this._touchedSet.add(path);
    } else {
      this._touchedSet.delete(path);
    }
    this._notifySubscribers();
  }

  triggerBlurValidation<P extends FormPath<T>>(path: P): void;
  triggerBlurValidation(path: string): void;
  triggerBlurValidation(path: string): void {
    this._validationEngine.onFieldBlur(path);
  }

  getDirty<P extends FormPath<T>>(path: P): boolean;
  getDirty(path: string): boolean;
  getDirty(path: string): boolean {
    return this._dirtySet.has(path);
  }

  // ─── Field Registration ──────────────────────────────────────────────

  register<P extends FormPath<T>>(path: P, options?: FieldOptions<PathValue<T, P>>): FieldRegistration<PathValue<T, P>>;
  register(path: string, options?: FieldOptions<any>): FieldRegistration<any>;
  register(path: string, options?: FieldOptions<any>): FieldRegistration<any> {
    if (options) {
      this._fieldOptions.set(path, options);
      if (options.validate) {
        this._validationEngine.registerFieldValidators(
          path,
          (Array.isArray(options.validate) ? options.validate : [options.validate]) as ValidatorFunction<unknown>[],
          options.validateOn,
          options.dependsOn
        );
      }
    }

    const value = this.getValue(path);
    const errorsSig = this.getErrors(path);

    const inputProps: FieldInputProps<any> = {
      name: path,
      value,
      onChange: (e: any) => {
        let newValue: any;
        if (options?.parse) {
          newValue = options.parse(e);
        } else if (e && typeof e === 'object' && 'target' in e) {
          const target = e.target;
          newValue = target.type === 'checkbox' ? target.checked : target.value;
        } else {
          newValue = e;
        }
        if (options?.transform) {
          newValue = options.transform(newValue);
        }
        this.setValue(path, newValue);
      },
      onBlur: () => {
        this.setTouched(path);
        this._validationEngine.onFieldBlur(path);
      },
      ref: (el: HTMLElement | null) => {
        this._fieldRefs.set(path, el);
      },
    };

    // ARIA attributes
    const errors = errorsSig.get();
    if (errors.length > 0) {
      inputProps['aria-invalid'] = true;
      inputProps['aria-describedby'] = `${path}-error`;
    }

    return {
      inputProps,
      state: {
        value,
        errors: errorsSig.get(),
        touched: this.getTouched(path),
        dirty: this.getDirty(path),
        validating: this.getFieldValidating(path).get(),
      },
      setValue: (v: any) => this.setValue(path, v),
      setError: (errs: string[]) => this.setErrors(path, errs),
      clearErrors: () => this.clearErrors(path),
      setTouched: (t: boolean) => this.setTouched(path, t),
      reset: () => {
        const baseline = getPath(this._baseline, path);
        this.setValue(path, baseline);
        this.clearErrors(path);
        this.setTouched(path, false);
      },
    };
  }

  unregister<P extends FormPath<T>>(path: P): void;
  unregister(path: string): void;
  unregister(path: string): void {
    this._fieldOptions.delete(path);
    this._fieldRefs.delete(path);
    this._validationEngine.unregisterField(path);
  }

  // ─── Submit ──────────────────────────────────────────────────────────

  async handleSubmit(e?: Event): Promise<void> {
    if (e) e.preventDefault?.();
    if (!this.config.onSubmit) {
      // Still validate even without onSubmit (for ActionForm usage)
      const result = await this._validationEngine.validateAll();
      if (!result.success && this.config.focusOnError !== false) {
        focusFirstError(this);
      }
      return;
    }
    await this.submitWith(this.config.onSubmit);
  }

  async submitWith(handler: SubmitHandler<T>, _submitId?: string): Promise<void> {
    // Abort any in-flight submit
    if (this.isSubmitting.get()) {
      this._submitAbort?.abort();
    }

    const generation = ++this._submitGeneration;
    const abortController = new AbortController();
    this._submitAbort = abortController;

    batch(() => {
      this.isSubmitting.set(true);
      this.submitState.set('submitting');
      // Touch all registered fields on submit attempt so errors become visible
      for (const path of this._fieldOptions.keys()) {
        this._touchedSet.add(path);
      }
      this._notifySubscribers();
    });

    try {
      // Validate all fields
      const validationResult = await this._validationEngine.validateAll();

      // Check if this submit was superseded
      if (generation !== this._submitGeneration) return;

      if (!validationResult.success) {
        batch(() => {
          if (validationResult.errors) {
            for (const [path, errors] of Object.entries(validationResult.errors)) {
              this.setErrors(path, errors);
            }
          }
          this.isSubmitting.set(false);
          this.submitState.set('error');
        });
        if (this.config.focusOnError !== false) {
          focusFirstError(this);
        }
        return;
      }

      const values = this._getCurrentValues();
      const formData = this._buildFormData(values);

      await handler(values, {
        values,
        formData,
        signal: abortController.signal,
      });

      // Check if this submit was superseded
      if (generation !== this._submitGeneration) return;

      batch(() => {
        this.isSubmitting.set(false);
        this.submitState.set('success');
        this.submitCount.update((c) => c + 1);
      });

      if (this.config.resetOnSubmit) {
        this.reset();
      }
    } catch (error) {
      if (generation === this._submitGeneration && !abortController.signal.aborted) {
        batch(() => {
          this.isSubmitting.set(false);
          this.submitState.set('error');
        });
      }
      throw error;
    }
  }

  // ─── Validation-only (for ActionForm) ─────────────────────────────────

  async validate(): Promise<boolean> {
    const result = await this._validationEngine.validateAll();
    return result.success;
  }

  // ─── Single-field reset ──────────────────────────────────────────────

  resetField<P extends FormPath<T>>(path: P): void;
  resetField(path: string): void;
  resetField(path: string): void {
    batch(() => {
      const baseline = getPath(this._baseline, path);
      this.setValue(path, baseline);
      this.clearErrors(path);
      this.setTouched(path, false);
      this._dirtySet.delete(path);
      this.isDirty.set(this._dirtySet.size > 0);
    });
  }

  // ─── Manual validation trigger ─────────────────────────────────────

  async trigger<P extends FormPath<T>>(path?: P): Promise<boolean>;
  async trigger(path?: string): Promise<boolean>;
  async trigger(path?: string): Promise<boolean> {
    if (path) {
      this.setTouched(path, true);
      const errors = await this._validationEngine.validateField(path);
      return errors.length === 0;
    }
    // Validate all — touch all registered and validated fields
    for (const p of this._fieldOptions.keys()) {
      this._touchedSet.add(p);
    }
    // Also touch fields with config-level validators
    for (const p of this._validationEngine.getRegisteredPaths()) {
      this._touchedSet.add(p);
    }
    this._notifySubscribers();
    const result = await this._validationEngine.validateAll();
    return result.success;
  }

  // ─── Reset ───────────────────────────────────────────────────────────

  reset(): void {
    this.resetTo(deepClone(this.config.defaultValues));
  }

  resetTo(values: T): void {
    batch(() => {
      this._baseline = deepClone(values);

      // Remove orphan signals not present in new shape
      const newPaths = flattenToPaths(values);
      const newPathSet = new Set(newPaths.keys());
      for (const path of this._signals.keys()) {
        if (!newPathSet.has(path)) {
          this._signals.delete(path);
        }
      }

      // Remove orphan error signals not present in new shape
      for (const path of this._errorSignals.keys()) {
        if (!newPathSet.has(path)) {
          this._errorSignals.delete(path);
        }
      }

      // Update existing and create new signals
      for (const [path, value] of newPaths) {
        const sig = this._signals.get(path);
        if (sig) {
          sig.set(value);
        } else {
          this._signals.set(path, signal(value));
        }
      }
      this._touchedSet.clear();
      this._dirtySet.clear();
      this.isDirty.set(false);
      this.clearErrors();
      this.submitState.set('idle');
      this._notifySubscribers();
    });
  }

  setBaseline(values: T): void {
    batch(() => {
      this._baseline = deepClone(values);
      // Recalculate dirty for all fields
      for (const path of this._signals.keys()) {
        const current = this.getValue(path);
        const base = getPath(this._baseline, path);
        if (deepEqual(current, base)) {
          this._dirtySet.delete(path);
        } else {
          this._dirtySet.add(path);
        }
      }
      this.isDirty.set(this._dirtySet.size > 0);
      this._notifySubscribers();
    });
  }

  getChanges(): DeepPartial<T> {
    let changes: Record<string, any> = {};
    for (const path of this._dirtySet) {
      const value = this.getValue(path);
      changes = setPath(changes, path, value);
    }
    return changes as DeepPartial<T>;
  }

  // ─── Watch ───────────────────────────────────────────────────────────

  watch<P extends FormPath<T>>(path: P, callback: WatchCallback<PathValue<T, P>>): () => void;
  watch(path: string, callback: WatchCallback): () => void;
  watch(path: string, callback: WatchCallback<any>): () => void {
    if (!this._watchers.has(path)) {
      this._watchers.set(path, new Set());
    }
    this._watchers.get(path)!.add(callback);

    return () => {
      const set = this._watchers.get(path);
      if (set) {
        set.delete(callback);
        if (set.size === 0) this._watchers.delete(path);
      }
    };
  }

  watchFields<P extends FormPath<T>>(paths: P[], callback: WatchCallback): () => void;
  watchFields(paths: string[], callback: WatchCallback): () => void;
  watchFields(paths: string[], callback: WatchCallback): () => void {
    const unsubs = paths.map((p) => this.watch(p as any, callback));
    return () => unsubs.forEach((fn) => fn());
  }

  subscribe(callback: () => void): () => void {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  // ─── Serialization ───────────────────────────────────────────────────

  toJSON(): T {
    return this._getCurrentValues();
  }

  toFormData(): FormData {
    return this._buildFormData(this._getCurrentValues());
  }

  // ─── Field Ref Access ────────────────────────────────────────────────

  getFieldRef(path: string): HTMLElement | null {
    return this._fieldRefs.get(path) ?? null;
  }

  setFieldRef(path: string, el: HTMLElement | null): void {
    this._fieldRefs.set(path, el);
  }

  getFieldOptions(path: string): FieldOptions<any> | undefined {
    return this._fieldOptions.get(path);
  }

  getBaseline(): T {
    return deepClone(this._baseline);
  }

  getFieldValidating<P extends FormPath<T>>(path: P): Signal<boolean>;
  getFieldValidating(path: string): Signal<boolean>;
  getFieldValidating(path: string): Signal<boolean> {
    return this._validationEngine.getFieldValidatingSignal(path);
  }

  dispose(): void {
    this._validationEngine.dispose();
    this._subscribers.clear();
    this._watchers.clear();
    this._fieldRefs.clear();
    this._fieldOptions.clear();
    // Note: _signals is NOT cleared — external code may hold signal references
    // that should remain functional after dispose (signals are independent primitives)
    this._errorSignals.clear();
    this._errorMapSignals.clear();
    this._touchedSet.clear();
    this._dirtySet.clear();
    if (this._submitAbort) {
      this._submitAbort.abort();
      this._submitAbort = null;
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────

  _getCurrentValues(): T {
    // Reconstruct from signals + baseline shape
    const result = deepClone(this._baseline);
    for (const [path, sig] of this._signals) {
      const value = sig.get();
      const parts = path.split('.');
      // Only set leaf values to avoid overwriting reconstructed objects
      const baseValue = getPath(this._baseline, path);
      if (baseValue === null || typeof baseValue !== 'object' || Array.isArray(baseValue)) {
        let current: any = result;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const idx = parseInt(part, 10);
          if (!isNaN(idx)) {
            if (!current[idx]) current[idx] = {};
            current = current[idx];
          } else {
            if (!current[part]) current[part] = {};
            current = current[part];
          }
        }
        if (current != null) {
          const lastPart = parts[parts.length - 1];
          const lastIdx = parseInt(lastPart, 10);
          if (!isNaN(lastIdx)) {
            current[lastIdx] = value;
          } else {
            current[lastPart] = value;
          }
        }
      }
    }
    return result;
  }

  private _buildFormData(values: T): FormData {
    if (typeof FormData === 'undefined') {
      throw new Error('FormData is not available in this environment. toFormData() cannot be used during SSR.');
    }
    const fd = new FormData();
    const flat = flattenToPaths(values);
    for (const [path, value] of flat) {
      if (value instanceof File) {
        fd.append(path, value);
      } else if (typeof value !== 'object' || value === null) {
        fd.append(path, String(value ?? ''));
      }
    }
    return fd;
  }

  private _notifyWatchers(path: string, value: unknown): void {
    const set = this._watchers.get(path);
    if (set) {
      for (const cb of [...set]) {
        try {
          cb(value, path);
        } catch (e) {
          console.error('FormStore watcher error:', e);
        }
      }
    }
  }

  private _notifySubscribers(): void {
    for (const cb of [...this._subscribers]) {
      try {
        cb();
      } catch (e) {
        console.error('FormStore subscriber error:', e);
      }
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createFormStore<T extends Record<string, any>>(
  config: FormConfig<T>
): FormStore<T> {
  return new FormStore(config);
}
