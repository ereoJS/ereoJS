import { Signal, signal, batch } from '@ereo/state';
import type {
  ValidatorFunction,
  ValidateOn,
  ValidationResult,
  CrossFieldValidationContext,
  ValidationSchema,
} from './types';
import type { FormStore } from './store';
import { isStandardSchema, standardSchemaAdapter } from './schema';

interface FieldValidation {
  validators: ValidatorFunction[];
  validateOn?: ValidateOn;
  derivedTrigger: ValidateOn;
}

export class ValidationEngine<T extends Record<string, any>> {
  private _store: FormStore<T>;
  private _fieldValidations = new Map<string, FieldValidation>();
  private _abortControllers = new Map<string, AbortController>();
  private _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private _validatingFields = new Set<string>();
  private _validatingSignals = new Map<string, Signal<boolean>>();
  private _fieldGenerations = new Map<string, number>();
  private _validateAllController: AbortController | null = null;
  private _dependents = new Map<string, Set<string>>();  // source → fields that depend on source
  private _validatingDependents = new Set<string>(); // guard against circular deps

  constructor(store: FormStore<T>) {
    this._store = store;

    // Register validators from config
    const { validators } = store.config;
    if (validators) {
      for (const [path, rules] of Object.entries(validators)) {
        if (rules) {
          const arr = Array.isArray(rules) ? rules : [rules];
          this.registerFieldValidators(
            path,
            arr as ValidatorFunction[],
            store.config.validateOn
          );
        }
      }
    }

    // Register config-level dependencies
    const { dependencies } = store.config;
    if (dependencies) {
      for (const [dependent, sources] of Object.entries(dependencies)) {
        if (sources) {
          const sourceArr = Array.isArray(sources) ? sources : [sources];
          for (const source of sourceArr) {
            this._registerDependency(dependent, source as string);
          }
        }
      }
    }
  }

  registerFieldValidators(
    path: string,
    validators: ValidatorFunction[],
    explicitTrigger?: ValidateOn,
    dependsOn?: string | string[]
  ): void {
    const derivedTrigger = explicitTrigger ?? this._deriveValidateOn(validators);
    this._fieldValidations.set(path, {
      validators,
      validateOn: explicitTrigger,
      derivedTrigger,
    });

    // Auto-detect dependencies from validator metadata
    for (const v of validators) {
      if (v._dependsOnField) {
        this._registerDependency(path, v._dependsOnField);
      }
    }

    // Explicit dependsOn
    if (dependsOn) {
      const deps = Array.isArray(dependsOn) ? dependsOn : [dependsOn];
      for (const dep of deps) {
        this._registerDependency(path, dep);
      }
    }
  }

  // ─── Derive-don't-configure ─────────────────────────────────────────

  private _deriveValidateOn(validators: ValidatorFunction[]): ValidateOn {
    const hasAsync = validators.some((v) => v._isAsync);
    if (hasAsync) return 'change'; // Async → validate on change with debounce
    const allRequired = validators.every((v) => v._isRequired);
    if (allRequired) return 'blur'; // Required only → don't nag while typing
    return 'blur'; // Default → blur
  }

  // ─── Field Event Handlers ──────────────────────────────────────────

  onFieldChange(path: string): void {
    const validation = this._fieldValidations.get(path);
    if (validation) {
      const trigger = validation.validateOn ?? validation.derivedTrigger;
      if (trigger === 'change') {
        // Check for debounce on async validators
        const debounceMs = this._getDebounceMs(validation.validators);
        if (debounceMs > 0) {
          this._debounceValidation(path, debounceMs);
        } else {
          this._runFieldValidation(path);
        }
      }
    }

    // Trigger re-validation for dependent fields
    this._triggerDependents(path);
  }

  onFieldBlur(path: string): void {
    const validation = this._fieldValidations.get(path);
    if (!validation) return;

    const trigger = validation.validateOn ?? validation.derivedTrigger;
    if (trigger === 'submit') return;

    // Cancel pending debounce and validate immediately
    const timer = this._debounceTimers.get(path);
    if (timer) {
      clearTimeout(timer);
      this._debounceTimers.delete(path);
    }

    this._runFieldValidation(path);
  }

  isFieldValidating(path: string): boolean {
    return this._validatingFields.has(path);
  }

  getFieldValidatingSignal(path: string): Signal<boolean> {
    let sig = this._validatingSignals.get(path);
    if (!sig) {
      sig = signal(false);
      this._validatingSignals.set(path, sig);
    }
    return sig;
  }

  private _setFieldValidating(path: string, validating: boolean): void {
    if (validating) {
      this._validatingFields.add(path);
    } else {
      this._validatingFields.delete(path);
    }
    const sig = this._validatingSignals.get(path);
    if (sig) sig.set(validating);
  }

  // ─── Validation Execution ──────────────────────────────────────────

  async validateField(path: string): Promise<string[]> {
    const validation = this._fieldValidations.get(path);
    if (!validation) return [];

    // Cancel any in-flight validation for this field
    this._cancelFieldValidation(path);

    const controller = new AbortController();
    this._abortControllers.set(path, controller);

    // Increment per-field generation to detect stale results
    const generation = (this._fieldGenerations.get(path) ?? 0) + 1;
    this._fieldGenerations.set(path, generation);

    this._setFieldValidating(path, true);

    const syncErrors: string[] = [];
    const asyncErrors: string[] = [];
    const value = this._store.getValue(path);
    const context = this._createContext(controller.signal);

    try {
      // Partition validators into sync and async
      const syncValidators = validation.validators.filter(v => !v._isAsync);
      const asyncValidators = validation.validators.filter(v => v._isAsync);

      // Run sync validators first
      for (const validator of syncValidators) {
        if (controller.signal.aborted) break;
        const result = await validator(value, context);
        if (result) syncErrors.push(result);
      }

      // Only run async validators if all sync validators passed
      if (syncErrors.length === 0 && !controller.signal.aborted) {
        for (const validator of asyncValidators) {
          if (controller.signal.aborted) break;
          const result = await validator(value, context);
          if (result) asyncErrors.push(result);
        }
      }
    } finally {
      // Only clean up if WE are still the active validation for this path
      if (this._abortControllers.get(path) === controller) {
        this._setFieldValidating(path, false);
        this._abortControllers.delete(path);
      }
    }

    const allErrors = [...syncErrors, ...asyncErrors];

    // Only write results if not aborted AND this is still the latest generation
    if (!controller.signal.aborted && this._fieldGenerations.get(path) === generation) {
      // Clear previous sync/async errors, then set new ones with source tagging
      this._store.clearErrorsBySource(path, 'sync');
      this._store.clearErrorsBySource(path, 'async');
      if (syncErrors.length > 0) {
        this._store.setErrorsWithSource(path, syncErrors, 'sync');
      }
      if (asyncErrors.length > 0) {
        this._store.setErrorsWithSource(path, asyncErrors, 'async');
      }
      // If no errors from either, ensure flat errors are cleared
      if (allErrors.length === 0) {
        this._store.clearErrorsBySource(path, 'sync');
        this._store.clearErrorsBySource(path, 'async');
      }
      return allErrors;
    }

    // Return empty for aborted/superseded validations — caller should discard
    return [];
  }

  async validateFields(paths: string[]): Promise<ValidationResult> {
    const allErrors: Record<string, string[]> = {};
    let hasErrors = false;

    await Promise.all(
      paths.map(async (path) => {
        const errors = await this.validateField(path);
        if (errors.length > 0) {
          allErrors[path] = errors;
          hasErrors = true;
        }
      })
    );

    return { success: !hasErrors, errors: hasErrors ? allErrors : undefined };
  }

  async validateAll(): Promise<ValidationResult> {
    // Abort any previous validateAll in progress
    if (this._validateAllController) {
      this._validateAllController.abort();
    }

    const controller = new AbortController();
    this._validateAllController = controller;

    const allErrors: Record<string, string[]> = {};
    let hasErrors = false;
    let schemaResult: ValidationResult | null = null;

    // Schema validation first
    const schema = this._store.config.schema;
    if (schema) {
      schemaResult = await this._validateSchema(schema as ValidationSchema);
      if (controller.signal.aborted) return { success: false, errors: { '': ['Validation cancelled'] } };
      if (!schemaResult.success && schemaResult.errors) {
        for (const [path, errors] of Object.entries(schemaResult.errors)) {
          allErrors[path] = errors;
          hasErrors = true;
        }
      }
    }

    // Per-field validation — run validators directly without writing to store individually.
    // We collect all errors and write once at the end to avoid flicker.
    // Track sync vs async errors separately per field for correct source attribution.
    const fieldPaths = Array.from(this._fieldValidations.keys());
    const fieldSyncErrors: Record<string, string[]> = {};
    const fieldAsyncErrors: Record<string, string[]> = {};

    await Promise.all(
      fieldPaths.map(async (path) => {
        if (controller.signal.aborted) return;

        const validation = this._fieldValidations.get(path);
        if (!validation) return;

        const value = this._store.getValue(path);
        const context = this._createContext(controller.signal);

        // Partition validators into sync and async
        const syncValidators = validation.validators.filter(v => !v._isAsync);
        const asyncValidators = validation.validators.filter(v => v._isAsync);

        const syncErrors: string[] = [];
        const asyncErrors: string[] = [];

        // Run sync validators first
        for (const validator of syncValidators) {
          if (controller.signal.aborted) break;
          const result = await validator(value, context);
          if (result) syncErrors.push(result);
        }

        // Only run async validators if all sync validators passed
        if (syncErrors.length === 0 && !controller.signal.aborted) {
          for (const validator of asyncValidators) {
            if (controller.signal.aborted) break;
            const result = await validator(value, context);
            if (result) asyncErrors.push(result);
          }
        }

        if (!controller.signal.aborted) {
          const allFieldErrors = [...syncErrors, ...asyncErrors];
          if (allFieldErrors.length > 0) {
            if (allErrors[path]) {
              allErrors[path] = [...allErrors[path], ...allFieldErrors];
            } else {
              allErrors[path] = allFieldErrors;
            }
            hasErrors = true;
          }
          if (syncErrors.length > 0) {
            fieldSyncErrors[path] = syncErrors;
          }
          if (asyncErrors.length > 0) {
            fieldAsyncErrors[path] = asyncErrors;
          }
        }
      })
    );

    if (controller.signal.aborted) return { success: true };

    // Clear the controller reference if we're still the active one
    if (this._validateAllController === controller) {
      this._validateAllController = null;
    }

    // Batch all error writes to consolidate signal notifications into one pass.
    // Without this, each setErrorsWithSource/clearErrors call would fire O(N) notifications.
    batch(() => {
      // Clear all existing field errors first, then write new errors.
      // This ensures schema-only errors are cleared when the schema passes.
      this._store.clearErrors();

      // Write schema errors with 'schema' source
      if (schema) {
        const schemaErrors = schemaResult?.errors ?? {};
        for (const [path, errors] of Object.entries(schemaErrors)) {
          this._store.setErrorsWithSource(path, errors, 'schema');
        }
      }

      // Write field validator errors with correct source attribution
      const schemaErrors = schemaResult?.errors ?? {};
      for (const path of fieldPaths) {
        const syncErrs = fieldSyncErrors[path];
        const asyncErrs = fieldAsyncErrors[path];
        if (!syncErrs && !asyncErrs) continue;

        if (schemaErrors[path]) {
          // Filter out errors already covered by schema
          const schemaSet = new Set(schemaErrors[path]);
          if (syncErrs) {
            const unique = syncErrs.filter(e => !schemaSet.has(e));
            if (unique.length > 0) {
              this._store.setErrorsWithSource(path, unique, 'sync');
            }
          }
          if (asyncErrs) {
            const unique = asyncErrs.filter(e => !schemaSet.has(e));
            if (unique.length > 0) {
              this._store.setErrorsWithSource(path, unique, 'async');
            }
          }
        } else {
          if (syncErrs && syncErrs.length > 0) {
            this._store.setErrorsWithSource(path, syncErrs, 'sync');
          }
          if (asyncErrs && asyncErrs.length > 0) {
            this._store.setErrorsWithSource(path, asyncErrs, 'async');
          }
        }
      }
    });

    return { success: !hasErrors, errors: hasErrors ? allErrors : undefined };
  }

  // ─── Schema Validation ─────────────────────────────────────────────

  private async _validateSchema(
    schema: ValidationSchema | { readonly '~standard': any }
  ): Promise<ValidationResult> {
    // Auto-detect Standard Schema
    let resolvedSchema: ValidationSchema;
    if (isStandardSchema(schema)) {
      resolvedSchema = standardSchemaAdapter(schema);
    } else {
      resolvedSchema = schema as ValidationSchema;
    }

    const values = this._store._getCurrentValues();
    if (resolvedSchema.safeParse) {
      const result = resolvedSchema.safeParse(values);
      if (result.success) {
        return { success: true };
      }
      const errors: Record<string, string[]> = {};
      if (result.error?.issues) {
        for (const issue of result.error.issues) {
          const path = issue.path.join('.');
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
      }
      return { success: false, errors };
    }

    try {
      resolvedSchema.parse(values);
      return { success: true };
    } catch (e: any) {
      if (e?.issues) {
        const errors: Record<string, string[]> = {};
        for (const issue of e.issues) {
          const path = issue.path?.join('.') ?? '';
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
        return { success: false, errors };
      }
      return {
        success: false,
        errors: { '': [e?.message ?? 'Validation failed'] },
      };
    }
  }

  getRegisteredPaths(): IterableIterator<string> {
    return this._fieldValidations.keys();
  }

  // ─── Dependency Management ──────────────────────────────────────────

  private _registerDependency(dependentField: string, sourceField: string): void {
    let set = this._dependents.get(sourceField);
    if (!set) {
      set = new Set();
      this._dependents.set(sourceField, set);
    }
    set.add(dependentField);
  }

  private _triggerDependents(sourcePath: string): void {
    const dependents = this._dependents.get(sourcePath);
    if (!dependents) return;

    for (const dep of dependents) {
      // Guard against circular deps
      if (this._validatingDependents.has(dep)) continue;

      // Only re-validate if the dependent field has validators registered
      const validation = this._fieldValidations.get(dep);
      if (!validation) continue;

      // Only re-validate if the field has been touched (avoid premature errors)
      if (!this._store.getTouched(dep)) continue;

      this._validatingDependents.add(dep);
      this._runFieldValidation(dep);
      // Clear guard after microtask to allow future validations
      Promise.resolve().then(() => {
        this._validatingDependents.delete(dep);
      });
    }
  }

  getDependents(sourcePath: string): Set<string> | undefined {
    return this._dependents.get(sourcePath);
  }

  // ─── Cleanup ───────────────────────────────────────────────────────

  unregisterField(path: string): void {
    this._cancelFieldValidation(path);
    this._fieldValidations.delete(path);
    this._validatingSignals.delete(path);
    this._fieldGenerations.delete(path);
    // Remove from dependency maps
    this._dependents.delete(path);
    for (const [, set] of this._dependents) {
      set.delete(path);
    }
  }

  abortAll(): void {
    // Abort all in-flight field validations
    for (const controller of this._abortControllers.values()) {
      controller.abort();
    }
    this._abortControllers.clear();
    // Cancel all debounce timers
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();
    // Abort any validateAll in progress
    if (this._validateAllController) {
      this._validateAllController.abort();
      this._validateAllController = null;
    }
    // Clear validating state
    for (const path of this._validatingFields) {
      const sig = this._validatingSignals.get(path);
      if (sig) sig.set(false);
    }
    this._validatingFields.clear();
    this._validatingDependents.clear();
  }

  dispose(): void {
    this.abortAll();
    // Clear registration maps (abortAll preserves these for re-use)
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();
    for (const controller of this._abortControllers.values()) {
      controller.abort();
    }
    this._abortControllers.clear();
    this._fieldValidations.clear();
    this._validatingFields.clear();
    this._validatingSignals.clear();
    this._fieldGenerations.clear();
    this._dependents.clear();
    this._validatingDependents.clear();
    if (this._validateAllController) {
      this._validateAllController.abort();
      this._validateAllController = null;
    }
  }

  // ─── Internal Helpers ──────────────────────────────────────────────

  private _createContext(contextSignal?: AbortSignal): CrossFieldValidationContext<T> {
    return {
      getValue: <P extends string>(path: P) => this._store.getValue(path),
      getValues: () => this._store._getCurrentValues(),
      signal: contextSignal,
    };
  }

  private _getDebounceMs(validators: ValidatorFunction[]): number {
    for (const v of validators) {
      if (v._debounce) return v._debounce;
      if (v._isAsync) return 300; // Default debounce for async
    }
    return 0;
  }

  private _debounceValidation(path: string, ms: number): void {
    const existing = this._debounceTimers.get(path);
    if (existing) clearTimeout(existing);

    this._debounceTimers.set(
      path,
      setTimeout(() => {
        this._debounceTimers.delete(path);
        this._runFieldValidation(path);
      }, ms)
    );
  }

  private _runFieldValidation(path: string): void {
    this.validateField(path).catch(() => {
      // Swallow unhandled rejections from fire-and-forget validation
    });
  }

  private _cancelFieldValidation(path: string): void {
    const controller = this._abortControllers.get(path);
    if (controller) {
      controller.abort();
      this._abortControllers.delete(path);
    }
    this._setFieldValidating(path, false);
    const timer = this._debounceTimers.get(path);
    if (timer) {
      clearTimeout(timer);
      this._debounceTimers.delete(path);
    }
  }
}
