import type { FormConfig, ValidationSchema, ValidatorFunction } from './types';

// ─── Deep Merge ──────────────────────────────────────────────────────────────

function deepMergeObjects<
  A extends Record<string, any>,
  B extends Record<string, any>,
>(a: A, b: B): A & B {
  const result = { ...a } as any;
  for (const key of Object.keys(b)) {
    const aVal = (a as any)[key];
    const bVal = (b as any)[key];
    if (
      aVal !== null && bVal !== null &&
      aVal !== undefined && bVal !== undefined &&
      typeof aVal === 'object' && typeof bVal === 'object' &&
      !Array.isArray(aVal) && !Array.isArray(bVal)
    ) {
      result[key] = deepMergeObjects(aVal, bVal);
    } else {
      result[key] = bVal;
    }
  }
  return result;
}

// ─── mergeFormConfigs ────────────────────────────────────────────────────────

export function mergeFormConfigs<
  A extends Record<string, any>,
  B extends Record<string, any>,
>(configA: FormConfig<A>, configB: FormConfig<B>): FormConfig<A & B> {
  const mergedValidators: Record<string, ValidatorFunction<any> | ValidatorFunction<any>[]> = {};

  if (configA.validators) {
    for (const [key, val] of Object.entries(configA.validators) as [string, ValidatorFunction<any> | ValidatorFunction<any>[] | undefined][]) {
      if (val) mergedValidators[key] = val;
    }
  }
  if (configB.validators) {
    for (const [key, val] of Object.entries(configB.validators) as [string, ValidatorFunction<any> | ValidatorFunction<any>[] | undefined][]) {
      if (val) {
        const existing = mergedValidators[key];
        if (existing) {
          const existingArr = Array.isArray(existing) ? existing : [existing];
          const newArr = Array.isArray(val) ? val : [val];
          mergedValidators[key] = [...existingArr, ...newArr];
        } else {
          mergedValidators[key] = val;
        }
      }
    }
  }

  return {
    defaultValues: deepMergeObjects(configA.defaultValues, configB.defaultValues) as A & B,
    onSubmit: configB.onSubmit ?? configA.onSubmit,
    schema: configB.schema ?? configA.schema,
    validators: Object.keys(mergedValidators).length > 0
      ? mergedValidators as any
      : undefined,
    validateOn: configB.validateOn ?? configA.validateOn,
    validateOnMount: configB.validateOnMount ?? configA.validateOnMount,
    resetOnSubmit: configB.resetOnSubmit ?? configA.resetOnSubmit,
  } as FormConfig<A & B>;
}

// ─── composeSchemas ──────────────────────────────────────────────────────────

export function composeSchemas<A = unknown, B = unknown>(
  prefix1: string,
  schema1: ValidationSchema<unknown, A>,
  prefix2: string,
  schema2: ValidationSchema<unknown, B>
): ValidationSchema<unknown, Record<string, unknown>> {
  return {
    parse(data: unknown): Record<string, unknown> {
      const obj = (data ?? {}) as Record<string, unknown>;
      const result1 = schema1.parse(obj[prefix1]);
      const result2 = schema2.parse(obj[prefix2]);
      return { [prefix1]: result1, [prefix2]: result2 };
    },
    safeParse(data: unknown) {
      const allIssues: Array<{ path: (string | number)[]; message: string }> = [];
      let result: Record<string, unknown> = {};

      const obj = (data ?? {}) as Record<string, unknown>;

      if (schema1.safeParse) {
        const r1 = schema1.safeParse(obj[prefix1]);
        if (r1.success) {
          result[prefix1] = r1.data;
        } else {
          for (const issue of r1.error.issues) {
            allIssues.push({
              path: [prefix1, ...issue.path],
              message: issue.message,
            });
          }
        }
      } else {
        try {
          result[prefix1] = schema1.parse(obj[prefix1]);
        } catch (e: any) {
          if (e?.issues) {
            for (const issue of e.issues) {
              allIssues.push({
                path: [prefix1, ...(issue.path ?? [])],
                message: issue.message,
              });
            }
          } else {
            throw e;
          }
        }
      }

      if (schema2.safeParse) {
        const r2 = schema2.safeParse(obj[prefix2]);
        if (r2.success) {
          result[prefix2] = r2.data;
        } else {
          for (const issue of r2.error.issues) {
            allIssues.push({
              path: [prefix2, ...issue.path],
              message: issue.message,
            });
          }
        }
      } else {
        try {
          result[prefix2] = schema2.parse(obj[prefix2]);
        } catch (e: any) {
          if (e?.issues) {
            for (const issue of e.issues) {
              allIssues.push({
                path: [prefix2, ...(issue.path ?? [])],
                message: issue.message,
              });
            }
          } else {
            throw e;
          }
        }
      }

      if (allIssues.length > 0) {
        return { success: false as const, error: { issues: allIssues } };
      }

      return { success: true as const, data: result };
    },
  };
}
