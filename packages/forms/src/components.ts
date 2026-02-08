import { createElement, useMemo } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { useField, useFieldArray } from './hooks';
import { useFormContext } from './context';
import { getErrorA11y, getLabelA11y } from './a11y';
import type {
  FormStoreInterface,
  FormPath,
  FieldComponentProps,
  TextareaFieldProps,
  SelectFieldProps,
  FieldArrayComponentProps,
  FieldHandle,
} from './types';

// ─── Type Inference from Name ────────────────────────────────────────────────

function inferInputType(name: string, explicitType?: string): string {
  if (explicitType) return explicitType;
  // Use only the last path segment for inference (e.g., 'user.email' → 'email')
  const lastSegment = name.split('.').pop()!.toLowerCase();
  if (lastSegment.includes('email')) return 'email';
  if (lastSegment.includes('password')) return 'password';
  if (lastSegment.includes('phone') || lastSegment.includes('tel')) return 'tel';
  if (lastSegment.includes('url') || lastSegment.includes('website')) return 'url';
  // Check 'datetime' before 'date' and 'time' to avoid false matches
  if (lastSegment.includes('datetime')) return 'datetime-local';
  if (lastSegment.includes('date')) return 'date';
  if (lastSegment.includes('time')) return 'time';
  if (lastSegment.includes('number') || lastSegment.includes('age') || lastSegment.includes('quantity'))
    return 'number';
  if (lastSegment.includes('search')) return 'search';
  return 'text';
}

function inferRequired(form: FormStoreInterface<any>, name: string, explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit;
  // Check if field has required validator
  const opts = (form as any).getFieldOptions?.(name);
  if (!opts?.validate) return false;
  const validators = Array.isArray(opts.validate) ? opts.validate : [opts.validate];
  return validators.some((v: any) => v._isRequired);
}

// ─── Field Component ─────────────────────────────────────────────────────────

export function Field<
  T extends Record<string, any>,
  K extends FormPath<T> = FormPath<T>,
>(props: FieldComponentProps<T, K>): ReactElement | null {
  const contextForm = useFormContext<T>();
  const form = props.form ?? contextForm;
  if (!form) throw new Error('Field requires a form prop or FormProvider');

  const field = useField<T>(form, props.name);
  const inputType = inferInputType(props.name, props.type);
  const isRequired = inferRequired(form, props.name, props.required);

  // Render prop
  if (props.children) {
    return props.children(field as FieldHandle<any>) as ReactElement;
  }

  // Default HTML rendering
  const children: ReactNode[] = [];

  if (props.label) {
    children.push(
      createElement(
        'label',
        { key: 'label', ...getLabelA11y(props.name) },
        props.label,
        isRequired ? createElement('span', { key: 'req', 'aria-hidden': true }, ' *') : null
      )
    );
  }

  children.push(
    createElement('input', {
      key: 'input',
      ...field.inputProps,
      type: inputType,
      id: props.name,
      required: isRequired,
      disabled: props.disabled,
      placeholder: props.placeholder,
      className: props.className,
      'aria-required': isRequired || undefined,
    })
  );

  if (field.errors.length > 0 && field.touched) {
    children.push(
      createElement(
        'div',
        { key: 'error', ...getErrorA11y(props.name) },
        field.errors[0]
      )
    );
  }

  return createElement('div', { 'data-field': props.name }, ...children);
}

// ─── TextareaField ───────────────────────────────────────────────────────────

export function TextareaField<
  T extends Record<string, any>,
  K extends FormPath<T> = FormPath<T>,
>(props: TextareaFieldProps<T, K>): ReactElement | null {
  const contextForm = useFormContext<T>();
  const form = props.form ?? contextForm;
  if (!form) throw new Error('TextareaField requires a form prop or FormProvider');

  const field = useField<T>(form, props.name);
  const isRequired = inferRequired(form, props.name, props.required);

  if (props.children) {
    return props.children(field as FieldHandle<any>) as ReactElement;
  }

  const children: ReactNode[] = [];

  if (props.label) {
    children.push(
      createElement('label', { key: 'label', ...getLabelA11y(props.name) }, props.label)
    );
  }

  children.push(
    createElement('textarea', {
      key: 'textarea',
      ...field.inputProps,
      id: props.name,
      rows: props.rows,
      cols: props.cols,
      maxLength: props.maxLength,
      required: isRequired,
      disabled: props.disabled,
      placeholder: props.placeholder,
      className: props.className,
      'aria-required': isRequired || undefined,
    })
  );

  if (field.errors.length > 0 && field.touched) {
    children.push(
      createElement('div', { key: 'error', ...getErrorA11y(props.name) }, field.errors[0])
    );
  }

  return createElement('div', { 'data-field': props.name }, ...children);
}

// ─── SelectField ─────────────────────────────────────────────────────────────

export function SelectField<
  T extends Record<string, any>,
  K extends FormPath<T> = FormPath<T>,
>(props: SelectFieldProps<T, K>): ReactElement | null {
  const contextForm = useFormContext<T>();
  const form = props.form ?? contextForm;
  if (!form) throw new Error('SelectField requires a form prop or FormProvider');

  const field = useField<T>(form, props.name);
  const isRequired = inferRequired(form, props.name, props.required);

  if (props.children) {
    return props.children(field as FieldHandle<any>) as ReactElement;
  }

  const children: ReactNode[] = [];

  if (props.label) {
    children.push(
      createElement('label', { key: 'label', ...getLabelA11y(props.name) }, props.label)
    );
  }

  const options = props.options.map((opt, i) =>
    createElement(
      'option',
      { key: opt.value ?? i, value: opt.value, disabled: opt.disabled },
      opt.label
    )
  );

  children.push(
    createElement(
      'select',
      {
        key: 'select',
        ...field.inputProps,
        id: props.name,
        multiple: props.multiple,
        required: isRequired,
        disabled: props.disabled,
        className: props.className,
        'aria-required': isRequired || undefined,
      },
      ...options
    )
  );

  if (field.errors.length > 0 && field.touched) {
    children.push(
      createElement('div', { key: 'error', ...getErrorA11y(props.name) }, field.errors[0])
    );
  }

  return createElement('div', { 'data-field': props.name }, ...children);
}

// ─── FieldArray Component ────────────────────────────────────────────────────

export function FieldArrayComponent<
  T extends Record<string, any>,
  K extends FormPath<T> = FormPath<T>,
>(props: FieldArrayComponentProps<T, K>): ReactElement | null {
  const contextForm = useFormContext<T>();
  const form = props.form ?? contextForm;
  if (!form) throw new Error('FieldArray requires a form prop or FormProvider');

  const helpers = useFieldArray<T>(form, props.name);

  return props.children(helpers) as ReactElement;
}

// Re-export as FieldArray for convenience
export { FieldArrayComponent as FieldArray };
