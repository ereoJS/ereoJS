import { Signal, signal } from '@ereo/state';
import type {
  ValidatorFunction,
  ValidateOn,
  ValidationResult,
  CrossFieldValidationContext,
  ValidationSchema,
} from './types';
import type { FormStore } from './store';

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
  }

  registerFieldValidators(
    path: string,
    validators: ValidatorFunction[],
    explicitTrigger?: ValidateOn
  ): void {
    const derivedTrigger = explicitTrigger ?? this._deriveValidateOn(validators);
    this._fieldValidations.set(path, {
      validators,
      validateOn: explicitTrigger,
      derivedTrigger,
    });
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
    if (!validation) return;

    const trigger = validation.validateOn ?? validation.derivedTrigger;
    if (trigger !== 'change') return;

    // Check for debounce on async validators
    const debounceMs = this._getDebounceMs(validation.validators);
    if (debounceMs > 0) {
      this._debounceValidation(path, debounceMs);
    } else {
      this._runFieldValidation(path);
    }
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

    const errors: string[] = [];
    const value = this._store.getValue(path);
    const context = this._createContext(controller.signal);

    try {
      for (const validator of validation.validators) {
        if (controller.signal.aborted) break;

        const result = await validator(value, context);
        if (result) {
          errors.push(result);
        }
      }
    } finally {
      // Only clean up if WE are still the active validation for this path
      if (this._abortControllers.get(path) === controller) {
        this._setFieldValidating(path, false);
        this._abortControllers.delete(path);
      }
    }

    // Only write results if not aborted AND this is still the latest generation
    if (!controller.signal.aborted && this._fieldGenerations.get(path) === generation) {
      this._store.setErrors(path, errors);
      return errors;
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

    // Schema validation first
    const schema = this._store.config.schema;
    if (schema) {
      const schemaResult = await this._validateSchema(schema);
      if (controller.signal.aborted) return { success: true };
      if (!schemaResult.success && schemaResult.errors) {
        for (const [path, errors] of Object.entries(schemaResult.errors)) {
          allErrors[path] = errors;
          hasErrors = true;
        }
      }
    }

    // Per-field validation — run validators directly without writing to store individually.
    // We collect all errors and write once at the end to avoid flicker.
    const fieldPaths = Array.from(this._fieldValidations.keys());
    await Promise.all(
      fieldPaths.map(async (path) => {
        if (controller.signal.aborted) return;

        const validation = this._fieldValidations.get(path);
        if (!validation) return;

        const value = this._store.getValue(path);
        const context = this._createContext(controller.signal);
        const errors: string[] = [];

        for (const validator of validation.validators) {
          if (controller.signal.aborted) break;
          const result = await validator(value, context);
          if (result) errors.push(result);
        }

        if (errors.length > 0 && !controller.signal.aborted) {
          if (allErrors[path]) {
            allErrors[path] = [...allErrors[path], ...errors];
          } else {
            allErrors[path] = errors;
          }
          hasErrors = true;
        }
      })
    );

    if (controller.signal.aborted) return { success: true };

    // Clear the controller reference if we're still the active one
    if (this._validateAllController === controller) {
      this._validateAllController = null;
    }

    // Clear all existing field errors first, then write new errors.
    // This ensures schema-only errors are cleared when the schema passes.
    this._store.clearErrors();

    // Write all errors to store in one pass
    for (const [path, errors] of Object.entries(allErrors)) {
      this._store.setErrors(path, errors);
    }

    return { success: !hasErrors, errors: hasErrors ? allErrors : undefined };
  }

  // ─── Schema Validation ─────────────────────────────────────────────

  private async _validateSchema(
    schema: ValidationSchema
  ): Promise<ValidationResult> {
    const values = this._store._getCurrentValues();

    if (schema.safeParse) {
      const result = schema.safeParse(values);
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
      schema.parse(values);
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

  // ─── Cleanup ───────────────────────────────────────────────────────

  unregisterField(path: string): void {
    this._cancelFieldValidation(path);
    this._fieldValidations.delete(path);
    this._validatingSignals.delete(path);
    this._fieldGenerations.delete(path);
  }

  dispose(): void {
    for (const timer of this._debounceTimers.values()) {
      clearTimeout(timer);
    }
    this._debounceTimers.clear();
    for (const controller of this._abortControllers.values()) {
      controller.abort();
    }
    this._abortControllers.clear();
    this._validatingFields.clear();
    this._validatingSignals.clear();
    this._fieldGenerations.clear();
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
