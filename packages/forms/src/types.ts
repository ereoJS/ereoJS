import type { Signal } from '@ereo/state';
import type { ReactNode } from 'react';

// ─── Utility Types ───────────────────────────────────────────────────────────

export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

// ─── Path Types ──────────────────────────────────────────────────────────────

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export type PathsOf<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends readonly (infer U)[]
    ? `${number}` | `${number}.${PathsOf<U, Prev[D]>}`
    : T extends object
      ? {
          [K in keyof T & string]: T[K] extends object
            ? K | `${K}.${PathsOf<T[K], Prev[D]>}`
            : K;
        }[keyof T & string]
      : never;

export type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? PathValue<T[K], Rest>
    : K extends `${number}`
      ? T extends readonly (infer U)[]
        ? PathValue<U, Rest>
        : never
      : never
  : P extends keyof T
    ? T[P]
    : P extends `${number}`
      ? T extends readonly (infer U)[]
        ? U
        : never
      : never;

export type FormPath<T> = PathsOf<T> & string;

// ─── Validation Types ────────────────────────────────────────────────────────

export type ValidateOn = 'change' | 'blur' | 'submit';

export interface ValidatorFunction<T = unknown> {
  (value: T, context?: CrossFieldValidationContext<any>): string | undefined | Promise<string | undefined>;
  _isAsync?: boolean;
  _isRequired?: boolean;
  _crossField?: boolean;
  _debounce?: number;
  _dependsOnField?: string;
}

export interface ValidationRule<T = unknown> {
  validate: ValidatorFunction<T>;
  message?: string;
  validateOn?: ValidateOn;
}

export interface ValidationResult {
  success: boolean;
  errors?: Record<string, string[]>;
}

export interface ValidationSchema<TInput = unknown, TOutput = unknown> {
  parse(data: TInput): TOutput;
  safeParse?(data: TInput): { success: true; data: TOutput } | { success: false; error: { issues: Array<{ path: (string | number)[]; message: string }> } };
}

export interface CrossFieldValidationContext<T> {
  getValue: <P extends string>(path: P) => unknown;
  getValues: () => T;
  signal?: AbortSignal;
}

// ─── Error Source Types ──────────────────────────────────────────────────

export type ErrorSource = 'sync' | 'async' | 'schema' | 'server' | 'manual';

export interface FormError {
  message: string;
  source: ErrorSource;
}

// ─── Field Types ─────────────────────────────────────────────────────────────

export interface FieldState<V = unknown> {
  value: V;
  errors: string[];
  touched: boolean;
  dirty: boolean;
  validating: boolean;
}

export interface FieldInputProps<V = unknown> {
  name: string;
  value: V;
  onChange: (e: any) => void;
  onBlur: (e: any) => void;
  onFocus?: (e: any) => void;
  ref?: (el: HTMLElement | null) => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
}

export interface FieldRegistration<V = unknown> {
  inputProps: FieldInputProps<V>;
  state: FieldState<V>;
  setValue: (value: V) => void;
  setError: (errors: string[]) => void;
  clearErrors: () => void;
  setTouched: (touched: boolean) => void;
  reset: () => void;
}

export interface FieldHandle<V = unknown> {
  inputProps: FieldInputProps<V>;
  value: V;
  errors: string[];
  touched: boolean;
  dirty: boolean;
  validating: boolean;
  errorMap: Record<ErrorSource, string[]>;
  setValue: (value: V) => void;
  setError: (errors: string[]) => void;
  clearErrors: () => void;
  setTouched: (touched: boolean) => void;
  reset: () => void;
}

export interface FieldOptions<V = unknown> {
  validate?: ValidatorFunction<V> | ValidatorFunction<V>[];
  validateOn?: ValidateOn;
  defaultValue?: V;
  transform?: (value: unknown) => V;
  parse?: (event: any) => V;
  dependsOn?: string | string[];
}

// ─── Array Field Types ───────────────────────────────────────────────────────

export interface ArrayFieldItem<T> {
  id: string;
  value: T;
  index: number;
}

export interface ArrayFieldHelpers<T> {
  fields: ArrayFieldItem<T>[];
  append: (value: T) => void;
  prepend: (value: T) => void;
  insert: (index: number, value: T) => void;
  remove: (index: number) => void;
  swap: (indexA: number, indexB: number) => void;
  move: (from: number, to: number) => void;
  replace: (index: number, value: T) => void;
  replaceAll: (values: T[]) => void;
  clone: (index: number) => void;
}

// ─── Form Types ──────────────────────────────────────────────────────────────

export type FormSubmitState = 'idle' | 'submitting' | 'success' | 'error';

export interface SubmitContext<T = unknown> {
  values: T;
  formData: FormData;
  signal: AbortSignal;
}

export type SubmitHandler<T = unknown> = (
  values: T,
  context: SubmitContext<T>
) => void | Promise<void>;

export interface FormConfig<T extends Record<string, any> = Record<string, any>> {
  defaultValues: T;
  onSubmit?: SubmitHandler<T>;
  schema?: ValidationSchema<unknown, T> | { readonly '~standard': any };
  validators?: Partial<Record<FormPath<T>, ValidatorFunction<any> | ValidatorFunction<any>[]>>;
  validateOn?: ValidateOn;
  validateOnMount?: boolean;
  resetOnSubmit?: boolean;
  focusOnError?: boolean;
  dependencies?: Partial<Record<FormPath<T>, FormPath<T> | FormPath<T>[]>>;
}

export interface FormState<T = unknown> {
  values: T;
  errors: Record<string, string[]>;
  formErrors: string[];
  touched: Set<string>;
  dirty: Set<string>;
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  submitState: FormSubmitState;
  submitCount: number;
}

export type WatchCallback<V = unknown> = (value: V, path: string) => void;

// ─── FormStore Interface ─────────────────────────────────────────────────────

export interface FormStoreInterface<T extends Record<string, any> = Record<string, any>> {
  values: T;
  config: FormConfig<T>;

  getValue<P extends FormPath<T>>(path: P): PathValue<T, P>;
  setValue<P extends FormPath<T>>(path: P, value: PathValue<T, P>): void;
  setValues(partial: DeepPartial<T>): void;
  getValues(): T;
  getSignal<P extends FormPath<T>>(path: P): Signal<PathValue<T, P>>;

  getErrors<P extends FormPath<T>>(path: P): Signal<string[]>;
  setErrors<P extends FormPath<T>>(path: P, errors: string[]): void;
  clearErrors<P extends FormPath<T>>(path?: P): void;
  getFormErrors(): Signal<string[]>;
  setFormErrors(errors: string[]): void;
  getErrorMap<P extends FormPath<T>>(path: P): Signal<Record<ErrorSource, string[]>>;
  setErrorsWithSource<P extends FormPath<T>>(path: P, errors: string[], source: ErrorSource): void;
  clearErrorsBySource<P extends FormPath<T>>(path: P, source: ErrorSource): void;

  getTouched<P extends FormPath<T>>(path: P): boolean;
  setTouched<P extends FormPath<T>>(path: P, touched?: boolean): void;
  getDirty<P extends FormPath<T>>(path: P): boolean;
  triggerBlurValidation<P extends FormPath<T>>(path: P): void;
  getFieldValidating<P extends FormPath<T>>(path: P): Signal<boolean>;

  isValid: Signal<boolean>;
  isDirty: Signal<boolean>;
  isSubmitting: Signal<boolean>;
  submitState: Signal<FormSubmitState>;
  submitCount: Signal<number>;

  register<P extends FormPath<T>>(path: P, options?: FieldOptions<PathValue<T, P>>): FieldRegistration<PathValue<T, P>>;
  unregister<P extends FormPath<T>>(path: P): void;
  handleSubmit(e?: Event): Promise<void>;
  submitWith(handler: SubmitHandler<T>, submitId?: string): Promise<void>;
  validate(): Promise<boolean>;
  resetField<P extends FormPath<T>>(path: P): void;
  trigger<P extends FormPath<T>>(path?: P): Promise<boolean>;
  reset(): void;
  resetTo(values: T): void;
  setBaseline(values: T): void;
  getChanges(): DeepPartial<T>;

  watch<P extends FormPath<T>>(path: P, callback: WatchCallback<PathValue<T, P>>): () => void;
  watchFields<P extends FormPath<T>>(paths: P[], callback: WatchCallback): () => void;
  subscribe(callback: () => void): () => void;

  toJSON(): T;
  toFormData(): FormData;
  dispose(): void;
}

// ─── Action Types ────────────────────────────────────────────────────────────

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface FormActionConfig<T, TResult = unknown> {
  schema?: ValidationSchema<unknown, T>;
  onSubmit: (values: T) => Promise<ActionResult<TResult>>;
  onSuccess?: (result: TResult) => void;
  onError?: (errors: Record<string, string[]>) => void;
}

// ─── Wizard Types ────────────────────────────────────────────────────────────

export interface WizardStepConfig<T extends Record<string, any> = Record<string, any>> {
  id: string;
  fields?: FormPath<T>[];
  validate?: () => Promise<boolean> | boolean;
}

export interface WizardConfig<T extends Record<string, any> = Record<string, any>> {
  steps: WizardStepConfig<T>[];
  form: FormConfig<T>;
  persist?: 'localStorage' | 'sessionStorage' | false;
  persistKey?: string;
  onComplete?: SubmitHandler<T>;
}

export interface WizardState {
  currentStep: number;
  currentStepId: string;
  completedSteps: Set<string>;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  progress: number;
}

// ─── Component Props ─────────────────────────────────────────────────────────

export interface FieldComponentProps<T extends Record<string, any>, K extends FormPath<T> = FormPath<T>> {
  form?: FormStoreInterface<T>;
  name: K;
  type?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  children?: (field: FieldHandle<PathValue<T, K>>) => ReactNode;
}

export interface TextareaFieldProps<T extends Record<string, any>, K extends FormPath<T> = FormPath<T>> extends FieldComponentProps<T, K> {
  rows?: number;
  cols?: number;
  maxLength?: number;
}

export interface SelectFieldProps<T extends Record<string, any>, K extends FormPath<T> = FormPath<T>> extends FieldComponentProps<T, K> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  multiple?: boolean;
}

export interface FieldArrayComponentProps<T extends Record<string, any>, K extends FormPath<T> = FormPath<T>> {
  form?: FormStoreInterface<T>;
  name: K;
  children: (helpers: ArrayFieldHelpers<PathValue<T, K> extends (infer U)[] ? U : unknown>) => ReactNode;
}
