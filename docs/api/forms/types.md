# Types

All exported TypeScript types and interfaces from `@ereo/forms`.

## Import

```ts
import type {
  DeepPartial,
  PathsOf,
  PathValue,
  FormPath,
  ValidateOn,
  ValidatorFunction,
  ValidationRule,
  ValidationResult,
  ValidationSchema,
  CrossFieldValidationContext,
  ErrorSource,
  FieldState,
  FieldInputProps,
  FieldRegistration,
  FieldHandle,
  FieldOptions,
  ArrayFieldItem,
  ArrayFieldHelpers,
  FormSubmitState,
  SubmitContext,
  SubmitHandler,
  FormConfig,
  FormState,
  FormStoreInterface,
  WatchCallback,
  ActionResult,
  FormActionConfig,
  WizardStepConfig,
  WizardConfig,
  WizardState,
  WizardHelpers,
  FieldComponentProps,
  TextareaFieldProps,
  SelectFieldProps,
  FieldArrayComponentProps,
} from '@ereo/forms'
```

## Utility Types

### DeepPartial

```ts
type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T
```

Recursively makes all properties optional. Used by `setValues` and `getChanges`.

## Path Types

### PathsOf

```ts
type PathsOf<T, D extends number = 5> = /* recursive mapped type */
```

Generates a union of all valid dot-path strings for a type, up to depth 5. Handles objects, arrays, and nested combinations.

```ts
type User = { name: string; address: { city: string } }
type Paths = PathsOf<User>
// 'name' | 'address' | 'address.city'
```

### PathValue

```ts
type PathValue<T, P extends string> = /* recursive conditional type */
```

Resolves the type at a given dot-path.

```ts
type User = { address: { city: string } }
type City = PathValue<User, 'address.city'>  // string
```

### FormPath

```ts
type FormPath<T> = PathsOf<T> & string
```

Alias for `PathsOf<T>` constrained to `string`.

## Validation Types

### ValidateOn

```ts
type ValidateOn = 'change' | 'blur' | 'submit'
```

### ValidatorFunction

```ts
interface ValidatorFunction<T = unknown> {
  (value: T, context?: CrossFieldValidationContext<any>):
    | string
    | undefined
    | Promise<string | undefined>;

  _isAsync?: boolean;
  _isRequired?: boolean;
  _crossField?: boolean;
  _debounce?: number;
  _dependsOnField?: string;
}
```

A validator function returns a string error message or `undefined` for success. Metadata properties drive the validation engine's timing. The `_dependsOnField` property is set by `matches()` and used for automatic dependency detection.

### ValidationRule

```ts
interface ValidationRule<T = unknown> {
  validate: ValidatorFunction<T>;
  message?: string;
  validateOn?: ValidateOn;
}
```

### ValidationResult

```ts
interface ValidationResult {
  success: boolean;
  errors?: Record<string, string[]>;
}
```

### ValidationSchema

```ts
interface ValidationSchema<TInput = unknown, TOutput = unknown> {
  parse(data: TInput): TOutput;
  safeParse?(data: TInput):
    | { success: true; data: TOutput }
    | { success: false; error: { issues: Array<{ path: (string | number)[]; message: string }> } };
}
```

The interface that schema adapters (Zod, Valibot, ereoSchema) implement.

### CrossFieldValidationContext

```ts
interface CrossFieldValidationContext<T> {
  getValue: <P extends string>(path: P) => unknown;
  getValues: () => T;
  signal?: AbortSignal;
}
```

Passed as the second argument to `ValidatorFunction` when cross-field access is needed.

## Field Types

### FieldState

```ts
interface FieldState<V = unknown> {
  value: V;
  errors: string[];
  touched: boolean;
  dirty: boolean;
  validating: boolean;
}
```

### FieldInputProps

```ts
interface FieldInputProps<V = unknown> {
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
```

Spread this onto any `<input>`, `<select>`, or `<textarea>`.

### FieldRegistration

```ts
interface FieldRegistration<V = unknown> {
  inputProps: FieldInputProps<V>;
  state: FieldState<V>;
  setValue: (value: V) => void;
  setError: (errors: string[]) => void;
  clearErrors: () => void;
  setTouched: (touched: boolean) => void;
  reset: () => void;
}
```

Returned by `FormStore.register()`.

### FieldHandle

```ts
interface FieldHandle<V = unknown> {
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
```

Returned by `useField()`. The `errorMap` groups errors by source (`sync`, `async`, `schema`, `server`, `manual`).

### FieldOptions

```ts
interface FieldOptions<V = unknown> {
  validate?: ValidatorFunction<V> | ValidatorFunction<V>[];
  validateOn?: ValidateOn;
  defaultValue?: V;
  transform?: (value: unknown) => V;
  parse?: (event: any) => V;
  dependsOn?: string | string[];
}
```

## Array Field Types

### ArrayFieldItem

```ts
interface ArrayFieldItem<T> {
  id: string;
  value: T;
  index: number;
}
```

### ArrayFieldHelpers

```ts
interface ArrayFieldHelpers<T> {
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
```

## Form Types

### FormSubmitState

```ts
type FormSubmitState = 'idle' | 'submitting' | 'success' | 'error'
```

### SubmitContext

```ts
interface SubmitContext<T = unknown> {
  values: T;
  formData: FormData;
  signal: AbortSignal;
}
```

Passed as the second argument to `SubmitHandler`. Includes a `FormData` version of the values and an `AbortSignal` that aborts if a new submission starts.

### SubmitHandler

```ts
type SubmitHandler<T = unknown> = (
  values: T,
  context: SubmitContext<T>
) => void | Promise<void>
```

### FormConfig

```ts
interface FormConfig<T extends Record<string, any> = Record<string, any>> {
  defaultValues: T;
  onSubmit?: SubmitHandler<T>;
  schema?: ValidationSchema<unknown, T>;
  validators?: Partial<Record<FormPath<T>, ValidatorFunction<any> | ValidatorFunction<any>[]>>;
  validateOn?: ValidateOn;
  validateOnMount?: boolean;
  resetOnSubmit?: boolean;
  focusOnError?: boolean;
  dependencies?: Record<string, string | string[]>;
}
```

### FormState

```ts
interface FormState<T = unknown> {
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
```

### WatchCallback

```ts
type WatchCallback<V = unknown> = (value: V, path: string) => void
```

### ErrorSource

```ts
type ErrorSource = 'sync' | 'async' | 'schema' | 'server' | 'manual'
```

Tags the origin of validation errors. Used by `setErrorsWithSource`, `clearErrorsBySource`, and `getErrorMap`.

### FormStoreInterface

```ts
interface FormStoreInterface<T extends Record<string, any>> {
  values: T;
  config: FormConfig<T>;

  getValue<P extends string>(path: P): unknown;
  setValue<P extends string>(path: P, value: unknown): void;
  setValues(partial: DeepPartial<T>): void;
  getValues(): T;
  getSignal(path: string): Signal<unknown>;

  getErrors(path: string): Signal<string[]>;
  setErrors(path: string, errors: string[]): void;
  clearErrors(path?: string): void;
  getFormErrors(): Signal<string[]>;
  setFormErrors(errors: string[]): void;
  setErrorsWithSource(path: string, errors: string[], source: ErrorSource): void;
  clearErrorsBySource(path: string, source: ErrorSource): void;
  getErrorMap(path: string): Signal<Record<ErrorSource, string[]>>;

  getTouched(path: string): boolean;
  setTouched(path: string, touched?: boolean): void;
  getDirty(path: string): boolean;
  triggerBlurValidation(path: string): void;
  getFieldValidating(path: string): Signal<boolean>;

  isValid: Signal<boolean>;
  isDirty: Signal<boolean>;
  isSubmitting: Signal<boolean>;
  submitState: Signal<FormSubmitState>;
  submitCount: Signal<number>;

  register<V = unknown>(path: string, options?: FieldOptions<V>): FieldRegistration<V>;
  unregister(path: string): void;
  handleSubmit(e?: Event): Promise<void>;
  submitWith(handler: SubmitHandler<T>, submitId?: string): Promise<void>;
  validate(): Promise<boolean>;
  trigger(path?: string): Promise<boolean>;
  resetField(path: string): void;
  reset(): void;
  resetTo(values: T): void;
  setBaseline(values: T): void;
  getChanges(): DeepPartial<T>;

  watch(path: string, callback: WatchCallback): () => void;
  watchFields(paths: string[], callback: WatchCallback): () => void;
  subscribe(callback: () => void): () => void;

  toJSON(): T;
  toFormData(): FormData;
  dispose(): void;
}
```

## Action Types

### ActionResult

```ts
interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
}
```

When `errors` is present, keys are dot-notation field paths. An empty string key (`''`) represents form-level errors.

### FormActionConfig

```ts
interface FormActionConfig<T, TResult = unknown> {
  schema?: ValidationSchema<unknown, T>;
  onSubmit: (values: T) => Promise<ActionResult<TResult>>;
  onSuccess?: (result: TResult) => void;
  onError?: (errors: Record<string, string[]>) => void;
}
```

## Wizard Types

### WizardStepConfig

```ts
interface WizardStepConfig {
  id: string;
  fields?: string[];
  validate?: () => Promise<boolean> | boolean;
}
```

### WizardConfig

```ts
interface WizardConfig<T extends Record<string, any>> {
  steps: WizardStepConfig[];
  form: FormConfig<T>;
  persist?: 'localStorage' | 'sessionStorage' | false;
  persistKey?: string;
  onComplete?: SubmitHandler<T>;
}
```

### WizardState

```ts
interface WizardState {
  currentStep: number;
  currentStepId: string;
  completedSteps: Set<string>;
  totalSteps: number;
  isFirst: boolean;
  isLast: boolean;
  progress: number;
}
```

### WizardHelpers

```ts
interface WizardHelpers<T extends Record<string, any>> {
  form: FormStore<T>;
  currentStep: Signal<number>;
  completedSteps: Signal<Set<string>>;
  state: WizardState;
  next: () => Promise<boolean>;
  prev: () => void;
  goTo: (stepIdOrIndex: string | number) => void;
  submit: () => Promise<void>;
  reset: () => void;
  dispose: () => void;
  getStepConfig: (index: number) => WizardStepConfig | undefined;
  canGoNext: () => boolean;
  canGoPrev: () => boolean;
}
```

## Component Props

### FieldComponentProps

```ts
interface FieldComponentProps<T extends Record<string, any>, K extends string = string> {
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
```

### TextareaFieldProps

```ts
interface TextareaFieldProps<T, K extends string = string>
  extends FieldComponentProps<T, K> {
  rows?: number;
  cols?: number;
  maxLength?: number;
}
```

### SelectFieldProps

```ts
interface SelectFieldProps<T, K extends string = string>
  extends FieldComponentProps<T, K> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  multiple?: boolean;
}
```

### FieldArrayComponentProps

```ts
interface FieldArrayComponentProps<T extends Record<string, any>, K extends string = string> {
  form?: FormStoreInterface<T>;
  name: K;
  children: (helpers: ArrayFieldHelpers<any>) => ReactNode;
}
```

## Related

- [FormStore](/api/forms/form-store) -- implements `FormStoreInterface`
- [Validation](/api/forms/validation) -- `ValidatorFunction` implementations
- [useField](/api/forms/use-field) -- returns `FieldHandle`
- [useFieldArray](/api/forms/use-field-array) -- returns `ArrayFieldHelpers`
- [Wizard](/api/forms/wizard) -- `WizardConfig` and `WizardState` usage
