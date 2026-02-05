import { createContext, useContext, createElement } from 'react';
import type { ReactNode } from 'react';
import type { FormStoreInterface } from './types';

const FormContext = createContext<FormStoreInterface<any> | null>(null);

export interface FormProviderProps<T extends Record<string, any>> {
  form: FormStoreInterface<T>;
  children: ReactNode;
}

export function FormProvider<T extends Record<string, any>>({
  form,
  children,
}: FormProviderProps<T>) {
  return createElement(FormContext.Provider, { value: form }, children);
}

export function useFormContext<
  T extends Record<string, any> = Record<string, any>,
>(): FormStoreInterface<T> | null {
  return useContext(FormContext) as FormStoreInterface<T> | null;
}
