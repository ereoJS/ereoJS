'use client';

import { useForm, useField, useFieldArray, useFormStatus } from '@ereo/forms';
import { required, compose, v } from '@ereo/forms';

interface TodoItem {
  text: string;
  priority: string;
}

interface DynamicFormValues {
  title: string;
  items: TodoItem[];
}

function TodoItemRow({
  form,
  index,
  onRemove,
}: {
  form: any;
  index: number;
  onRemove: () => void;
}) {
  const textField = useField(form, `items.${index}.text`, {
    validate: required('Task text is required'),
  });

  const priorityField = useField(form, `items.${index}.priority`);

  return (
    <div className="flex gap-2 items-start" data-testid={`item-${index}`}>
      <span className="mt-2 text-gray-400 text-sm w-6">{index + 1}.</span>
      <div className="flex-1">
        <input
          {...textField.inputProps}
          type="text"
          className={`input ${textField.errors.length > 0 && textField.touched ? 'border-red-500' : ''}`}
          placeholder={`Task ${index + 1}`}
          data-testid={`item-${index}-text`}
        />
        {textField.errors.length > 0 && textField.touched && (
          <p className="mt-0.5 text-xs text-red-600">{textField.errors[0]}</p>
        )}
      </div>
      <select
        value={priorityField.value as string}
        onChange={(e) => priorityField.setValue(e.target.value as any)}
        className="input w-28"
        data-testid={`item-${index}-priority`}
      >
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="btn btn-secondary px-3 py-2 text-red-600"
        data-testid={`item-${index}-remove`}
      >
        X
      </button>
    </div>
  );
}

export default function DynamicFormPage() {
  const form = useForm<DynamicFormValues>({
    defaultValues: {
      title: '',
      items: [
        { text: '', priority: 'medium' },
      ],
    },
    onSubmit: async (values) => {
      await new Promise((r) => setTimeout(r, 500));
      console.log('[DYNAMIC] Submitted:', values);
    },
  });

  const titleField = useField(form, 'title', {
    validate: required('List title is required'),
  });

  const { fields, append, prepend, remove, swap, move } = useFieldArray<DynamicFormValues, TodoItem>(
    form,
    'items'
  );

  const { isSubmitting, submitState } = useFormStatus(form);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Dynamic Field Array</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Tests: useFieldArray (append, prepend, remove, swap, move)
        </p>

        {submitState === 'success' && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200" data-testid="success-message">
            Todo list saved!
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">List Title</label>
            <input
              {...titleField.inputProps}
              type="text"
              id="title"
              className={`input ${titleField.errors.length > 0 && titleField.touched ? 'border-red-500' : ''}`}
              placeholder="My Todo List"
              data-testid="title-input"
            />
            {titleField.errors.length > 0 && titleField.touched && (
              <p className="mt-1 text-sm text-red-600">{titleField.errors[0]}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Tasks ({fields.length})</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => prepend({ text: '', priority: 'medium' })}
                  className="btn btn-secondary text-xs px-2 py-1"
                  data-testid="prepend-btn"
                >
                  + Prepend
                </button>
                <button
                  type="button"
                  onClick={() => append({ text: '', priority: 'medium' })}
                  className="btn btn-secondary text-xs px-2 py-1"
                  data-testid="append-btn"
                >
                  + Append
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {fields.map((item, i) => (
                <TodoItemRow
                  key={item.id}
                  form={form}
                  index={item.index}
                  onRemove={() => remove(i)}
                />
              ))}
            </div>

            {fields.length === 0 && (
              <p className="text-center text-gray-400 py-4" data-testid="empty-message">
                No tasks. Click "Append" to add one.
              </p>
            )}

            {fields.length >= 2 && (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => swap(0, fields.length - 1)}
                  className="btn btn-secondary text-xs px-2 py-1"
                  data-testid="swap-btn"
                >
                  Swap First/Last
                </button>
                {fields.length >= 3 && (
                  <button
                    type="button"
                    onClick={() => move(0, fields.length - 1)}
                    className="btn btn-secondary text-xs px-2 py-1"
                    data-testid="move-btn"
                  >
                    Move First to Last
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full disabled:opacity-50"
            data-testid="submit-btn"
          >
            {isSubmitting ? 'Saving...' : 'Save List'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1" data-testid="debug-panel">
          <p><strong>Debug:</strong></p>
          <p>Field count: <span data-testid="debug-count">{fields.length}</span></p>
          <p>Field IDs: <span data-testid="debug-ids">{fields.map(f => f.id).join(', ')}</span></p>
          <p>Values: <span data-testid="debug-values">{JSON.stringify(form.getValues())}</span></p>
        </div>
      </div>
    </div>
  );
}
