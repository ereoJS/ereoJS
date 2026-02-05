# `@ereo/forms` — Fresh Forms Library Implementation Plan

## Overview

Build the source code for `packages/forms/` from scratch. The existing `dist/` contains only compiled artifacts (no `src/`, no `package.json`). This is a ground-up redesign leveraging per-field signals and ES Proxies for a DX that surpasses React Hook Form, Formik, and TanStack Form.

**Core architectural departure:** Instead of one `Signal<T>` for all form values (the existing compiled approach), use a **per-field signal map** where each field path gets its own `Signal`. This eliminates re-render storms completely — changing `email` never causes components subscribed to `name` to re-render.

---

## Module Structure

```
packages/forms/
  package.json
  tsconfig.json
  src/
    index.ts                  # Single entry point, re-exports everything
    types.ts                  # PathsOf, PathValue, FormPath, all interfaces
    utils.ts                  # getPath, setPath, deepClone, deepEqual
    proxy.ts                  # ES Proxy for form.values.user.email access
    store.ts                  # FormStore class — per-field signal map
    validators.ts             # Built-in validators (zero-dependency)
    validation-engine.ts      # Orchestration: async, debounce, AbortSignal, derive-don't-configure
    schema.ts                 # zodAdapter, valibotAdapter, ereoSchema, formDataToObject
    hooks.ts                  # useForm, useField, useFieldArray, useFormStatus
    context.ts                # FormProvider, useFormContext
    components.ts             # Field, FieldArray, TextareaField, SelectField
    a11y.ts                   # ARIA generation, focus management, live announcements
    action.ts                 # createFormAction, ActionForm, useFormAction
    adapters.ts               # UI adapter registry and AdaptedField
    wizard.ts                 # createWizard, useWizard, WizardStep, WizardProgress
    composition.ts            # mergeFormConfigs, composeSchemas
```

---

## Implementation Phases (Build Order)

### Phase 1: Foundation

**1. `package.json`** — Package config
- Name: `@ereo/forms`
- Dependencies: `@ereo/state`
- Peer deps: `react` (^18.2.0)
- Optional peers: `@ereo/client`, `@ereo/data`, `zod`, `valibot`
- Entry: `src/index.ts`
- Build: match other packages in monorepo

**2. `types.ts`** — Type system
- `PathsOf<T, Depth>` — recursive path extraction with depth limit (prevents infinite recursion)
- `PathValue<T, P>` — value type at a dot-path
- `FormPath<T>` — branded string type
- `FormConfig<T>`, `FormState<T>`, `FormStore<T>` interface
- `FieldState<T>`, `FieldRegistration<T>`, `FieldInputProps<T>`
- `ValidationRule<T>`, `ValidatorFunction<T>`, `ValidationResult`
- `ValidateOn`, `FormSubmitState`, `SubmitHandler<T>`, `SubmitContext`
- `WatchCallback<V>`, `CrossFieldValidationContext<T>`
- `ArrayFieldItem<T>`, `ArrayFieldHelpers<T>`
- `DeepPartial<T>` utility type

**3. `utils.ts`** — Path utilities
- `getPath(obj, path)` — get value at dot-path
- `setPath(obj, path, value)` — immutably set value at dot-path
- `deepClone(obj)` — structured clone
- `deepEqual(a, b)` — structural equality for dirty tracking
- `parsePath(path)` — split "a.b.0.c" into segments
- Reuse patterns from `@ereo/data/src/action.ts:353-392` (parsePath already exists there)

**4. `proxy.ts`** — ES Proxy for value access
- `createValuesProxy<T>(store, basePath?)` — recursive Proxy handler
- GET trap: primitive → return signal value; object → return nested proxy
- SET trap: call `store.setValue(fullPath, value)`
- Symbol marker to prevent infinite proxy chains
- Array index access: `form.values.tags[0]`

**5. `store.ts`** — FormStore (the core)
- Per-field signal map: `Map<string, Signal<unknown>>`
- Lazy signal creation on first access
- `register(path, options)` → `FieldRegistration`
- `getValue(path)` / `setValue(path, value)` / `setValues(partial)`
- `getSignal(path)` — expose per-field signal for `useField`
- `getValues()` — reconstruct full object from signals on-demand
- Dirty tracking via `Set<string>` + `deepEqual` against baseline
- Touched tracking via `Set<string>`
- Error management: per-field errors signal (`Record<string, string[]>`)
- Form-level errors signal (`string[]`)
- Computed signals: `isValid`, `isDirty` (derived from errors/dirty)
- `handleSubmit(e?)` — validate + call onSubmit
- `submitWith(handler, submitId?)` — submit with alternate handler
- `reset()` / `resetTo(values)` / `setBaseline(values)` / `getChanges()`
- `watch(path, callback)` / `watchFields(paths, callback)`
- `subscribe(callback)` — form-level state changes
- `toJSON()` / `toFormData()` — serialization
- Uses `batch()` from `@ereo/state` to group updates

### Phase 2: Validation

**6. `validators.ts`** — Built-in validators
- `required(msg?)`, `email(msg?)`, `url(msg?)`, `date(msg?)`, `phone(msg?)`
- `minLength(n, msg?)`, `maxLength(n, msg?)`, `min(n, msg?)`, `max(n, msg?)`
- `pattern(regex, msg?)`, `number(msg?)`, `integer(msg?)`, `positive(msg?)`
- `custom(fn, msg?)`, `async(fn, opts?)` — with `{ debounce, message }`
- `matches(otherField, msg?)` — cross-field reference
- `oneOf(values, msg?)`, `notOneOf(values, msg?)`
- `fileSize(maxBytes, msg?)`, `fileType(types, msg?)`
- `compose(...rules)` — combine validators
- `when(condition, rule)` — conditional validation
- Export as both `validators` and `v` (short alias)

**7. `validation-engine.ts`** — Validation orchestration
- **Derive-don't-configure**: derive validation trigger from rule nature
  - Async rules → validate on change with debounce
  - Required rules → validate on blur (don't nag while typing)
  - Other rules → validate on blur
  - Explicit `validateOn` in config overrides derived behavior
- `ValidationEngine<T>` class:
  - Per-field AbortController map for cancelling in-flight async validation
  - Per-field debounce timer map
  - `onFieldChange(path)` — triggers validation per derived strategy
  - `onFieldBlur(path)` — triggers validation per derived strategy
  - `validateField(path)` → `Promise<string[]>`
  - `validateFields(paths)` → `Promise<ValidationResult>`
  - `validateAll()` → `Promise<ValidationResult>` (schema + field validators)
  - Cross-field validation: detect `_crossField` marker, inject `getValue`

**8. `schema.ts`** — Schema adapters
- `zodAdapter<T>(zodSchema)` → `ValidationSchema<unknown, T>`
- `valibotAdapter<T>(schema, parse, safeParse)` → `ValidationSchema<unknown, T>`
- `createSchemaValidator<T>(opts)` — plain function adapter
- `ereoSchema<T>(definition)` — zero-dep schema DSL using built-in validators
- `isEreoSchema(value)` — type guard
- `formDataToObject<T>(formData, opts?)` — reuse/align with `@ereo/data` implementation

### Phase 3: React Integration

**9. `hooks.ts`** — React hooks
- `useForm<T>(config)` → `FormStore<T>` (memoized via `useRef`)
- `useField<T, K>(form, name, opts?)` → field handle with reactive value/errors/touched/dirty
  - Uses `useSignal()` from `@ereo/state` for per-field signal subscription
  - Returns `inputProps` spread, `setValue`, `setError`, `clearErrors`, `setTouched`, `reset`
  - Auto-generates ARIA attributes inline
- `useFieldArray<T, K>(form, name)` → `ArrayFieldHelpers<Item>`
  - Stable IDs via `useRef(Map)` + auto-increment counter
  - `append`, `prepend`, `insert`, `remove`, `swap`, `move`, `replace`, `replaceAll`, `clone`
- `useFormStatus(form)` → reactive `{ isSubmitting, submitState, isValid, isDirty, submitCount }`

**10. `context.ts`** — React context
- `FormProvider<T>({ form, children })` — provide form store
- `useFormContext<T>()` → `FormStore<T> | null`

**11. `a11y.ts`** — Accessibility utilities
- `getFieldA11y(name, state)` → `{ aria-invalid, aria-describedby, aria-required, ... }`
- `getErrorA11y(name)` → `{ id, role, aria-live }`
- `getLabelA11y(name, opts?)` → `{ htmlFor, id }`
- `getDescriptionA11y(name)` → `{ id }`
- `getFieldsetA11y(name, legend)` → `{ role, aria-labelledby }`
- `getFieldWrapperA11y(name, state)` → wrapper attributes
- `getFormA11y(id, opts?)` → `{ aria-busy, ... }`
- `getErrorSummaryA11y(formId)` → `{ role, aria-labelledby }`
- `focusFirstError(form)` — focus first field with error + scrollIntoView
- `focusField(name)` — focus by name attribute
- `trapFocus(container)` → cleanup function
- `announce(message, priority?)` — create/reuse aria-live region
- `announceErrors(errors, opts?)` — announce error summary
- `announceSubmitStatus(status, opts?)` — announce form submission state
- `generateA11yId(prefix)` — unique ID generator
- `prefersReducedMotion()` / `isScreenReaderActive()`

**12. `components.ts`** — Field components
- `Field<T, K>({ form, name, type, label, ... })` — smart defaults:
  - Derive input type from field name (`email` → `type="email"`, `password` → `type="password"`)
  - Derive `required` from validators
  - Render prop: `children?: (field) => ReactNode`
  - Adapter support: `adapter?: string`
  - Auto ARIA attributes from `a11y.ts`
- `TextareaField<T, K>` — textarea with rows/cols/maxLength
- `SelectField<T, K>` — select with options array, multiple support
- `FieldArray<T, K>` — render-prop component wrapping `useFieldArray`

### Phase 4: Server Integration

**13. `action.ts`** — Server form actions
- `createFormAction<T, TResult>(opts)` — server action handler
  - Parse request body (JSON + FormData)
  - Schema validation with error mapping
  - Returns `ActionResult<TResult>` matching `@ereo/data` `ActionResult` shape
  - Reuse `parseRequestBody` from `@ereo/data/src/action.ts:240`
- `ActionForm<T>({ form, action, method, onSuccess, onError, ... })` — enhanced form
  - Client-side validation before submit
  - Submits as JSON (not FormData) for type fidelity
  - Auto-maps server errors to form field errors
  - `focusFirstError` + `announceErrors` on failure
  - Progressive enhancement: renders as native `<form>` for no-JS
- `useFormAction<T, TResult>(opts)` — manual submission hook
  - Returns `{ submit, cancel, isSubmitting, result }`
  - AbortController for cancellation
- `parseActionResult<T>(response)` — parse various response shapes

### Phase 5: Advanced Features

**14. `adapters.ts`** — UI adapter protocol
- `UIAdapter` interface: `{ name, components: UIAdapterComponents, classNames? }`
- `UIAdapterComponents`: TextInput, NumberInput, Checkbox, Select, Textarea, RadioGroup, DatePicker, FileInput
- `registerAdapter(adapter)` / `getAdapter(name)` / `setDefaultAdapter(name)`
- `getDefaultAdapter()` / `listAdapters()` / `unregisterAdapter(name)`
- `createAdapter(name, components, classNames?)` — factory
- `useAdapter(name?)` — hook (reads from default if no name)
- `AdaptedField({ inputProps, state, adapter?, type?, label?, ... })` — render via adapter
- `htmlAdapter` — built-in basic HTML adapter

**15. `wizard.ts`** — Multi-step forms
- `createWizard<T>(config)` → `WizardHelpers<T>`
  - Creates internal FormStore
  - `currentStep` signal, `completedSteps` signal
  - `next()` → validates current step fields, advances
  - `prev()` / `goTo(stepId)` / `submit()` / `reset()`
  - `persist` option: save/restore from localStorage/sessionStorage (debounced)
- `useWizard<T>(config)` → `WizardHelpers<T>` + reactive `currentStepState`
- `WizardProvider<T>` / `useWizardContext<T>`
- `WizardStep({ id, wizard?, children, keepMounted? })` — show/hide by active step
- `WizardProgress({ wizard?, renderStep? })` — step indicator
- `WizardNavigation({ wizard?, backLabel?, nextLabel?, submitLabel? })` — nav buttons

**16. `composition.ts`** — Form composition
- `mergeFormConfigs<A, B>(configA, configB)` → `FormConfig<A & B>`
- `composeSchemas(prefix1, schema1, prefix2, schema2)` → combined schema

### Phase 6: Entry Point

**17. `index.ts`** — Re-export everything
- Group exports logically: core, fields, validation, schema, server, wizard, adapters, a11y, types

---

## Key Design Decisions

| Decision | Approach | Rationale |
|----------|----------|-----------|
| State architecture | Per-field signal map | Eliminates re-render storms; changing one field never re-renders others |
| Value access | ES Proxy (`form.values.user.email`) | Natural JS property access vs string-based `getValue('user.email')` |
| Validation timing | Derive from rule type (override with `validateOn`) | Smart defaults reduce config; async → debounced change, required → blur |
| Dirty tracking | `deepEqual` against baseline | Structural comparison catches "changed-back-to-original" as clean |
| Server errors | Auto-map `ActionResult.errors` to field errors | Zero manual wiring between server validation failures and UI |
| Signal creation | Lazy (on first access) | Forms with 100+ fields don't create unused signals |
| Submission payload | JSON by default (FormData for progressive enhancement) | Type fidelity; nested objects and arrays serialize cleanly |

---

## Existing Code to Reuse

| What | Where | How |
|------|-------|-----|
| Signal, signal(), computed(), batch() | `packages/state/src/signals.ts` | Direct import — core reactivity |
| useSignal() via useSyncExternalStore | `packages/state/src/react.ts` | Direct import — bridge signals to React |
| ActionResult, ValidationResult types | `packages/data/src/action.ts:61-73` | Match shape for server compatibility |
| parseRequestBody() | `packages/data/src/action.ts:240-269` | Reuse or call directly for body parsing |
| formDataToObject() + coerceValue() | `packages/data/src/action.ts:283-468` | Reuse pattern; keep forms package self-contained |
| parsePath() | `packages/data/src/action.ts:353-392` | Reuse pattern in forms `utils.ts` |
| Form, useSubmit, useFetcher | `packages/client/src/form.ts` | Optional integration — ActionForm wraps or parallels |

---

## Files to Create

```
packages/forms/package.json          (new)
packages/forms/tsconfig.json         (new)
packages/forms/src/index.ts          (new)
packages/forms/src/types.ts          (new)
packages/forms/src/utils.ts          (new)
packages/forms/src/proxy.ts          (new)
packages/forms/src/store.ts          (new)
packages/forms/src/validators.ts     (new)
packages/forms/src/validation-engine.ts (new)
packages/forms/src/schema.ts         (new)
packages/forms/src/hooks.ts          (new)
packages/forms/src/context.ts        (new)
packages/forms/src/components.ts     (new)
packages/forms/src/a11y.ts           (new)
packages/forms/src/action.ts         (new)
packages/forms/src/adapters.ts       (new)
packages/forms/src/wizard.ts         (new)
packages/forms/src/composition.ts    (new)
```

Existing dist/ files remain untouched (we'll overwrite with new build output later).

---

## Verification

1. **Type-check**: `cd packages/forms && bunx tsc --noEmit` — all types resolve
2. **Unit tests**: `cd packages/forms && bun test` — all modules pass
3. **Build**: `cd packages/forms && bun build src/index.ts --outdir dist` — produces clean bundle
4. **Integration smoke test**: Create a test route in an example app that:
   - Uses `useForm` with `zodAdapter` + schema
   - Renders `<Field>` components with validation
   - Submits to a `createFormAction` server action
   - Verifies server error auto-mapping to fields
   - Tests array field add/remove
5. **SSR compatibility**: Verify no `window`/`document` references in store/validation (only in a11y focus helpers, guarded by `typeof window` checks)
6. **Bundle size**: Tree-shaking test — import only `useForm` + `validators`, verify wizard/adapters are excluded
