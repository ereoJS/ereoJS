// ─── Core ────────────────────────────────────────────────────────────────────
export { FormStore, createFormStore } from './store';
export { createValuesProxy } from './proxy';
export { getPath, setPath, deepClone, deepEqual, parsePath, flattenToPaths } from './utils';

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useForm, useField, useFieldArray, useFormStatus } from './hooks';

// ─── Context ─────────────────────────────────────────────────────────────────
export { FormProvider, useFormContext } from './context';

// ─── Components ──────────────────────────────────────────────────────────────
export { Field, TextareaField, SelectField, FieldArray } from './components';

// ─── Validation ──────────────────────────────────────────────────────────────
export {
  required,
  email,
  url,
  date,
  phone,
  minLength,
  maxLength,
  min,
  max,
  pattern,
  number,
  integer,
  positive,
  custom,
  async,
  matches,
  oneOf,
  notOneOf,
  fileSize,
  fileType,
  compose,
  when,
  v,
} from './validators';
export { ValidationEngine } from './validation-engine';

// ─── Schema ──────────────────────────────────────────────────────────────────
export {
  zodAdapter,
  valibotAdapter,
  createSchemaValidator,
  ereoSchema,
  isEreoSchema,
  formDataToObject,
} from './schema';

// ─── Server / Actions ────────────────────────────────────────────────────────
export {
  createFormAction,
  ActionForm,
  useFormAction,
  parseActionResult,
} from './action';

// ─── Wizard ──────────────────────────────────────────────────────────────────
export {
  createWizard,
  useWizard,
  WizardProvider,
  useWizardContext,
  WizardStep,
  WizardProgress,
  WizardNavigation,
} from './wizard';
export type { WizardHelpers } from './wizard';

// ─── Composition ─────────────────────────────────────────────────────────────
export { mergeFormConfigs, composeSchemas } from './composition';

// ─── Accessibility ───────────────────────────────────────────────────────────
export {
  generateA11yId,
  getFieldA11y,
  getErrorA11y,
  getLabelA11y,
  getDescriptionA11y,
  getFieldsetA11y,
  getFieldWrapperA11y,
  getFormA11y,
  getErrorSummaryA11y,
  focusFirstError,
  focusField,
  trapFocus,
  announce,
  announceErrors,
  announceSubmitStatus,
  prefersReducedMotion,
  isScreenReaderActive,
  cleanupLiveRegion,
} from './a11y';

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
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
  FieldComponentProps,
  TextareaFieldProps,
  SelectFieldProps,
  FieldArrayComponentProps,
} from './types';
