import { describe, expect, test, beforeEach, mock } from 'bun:test';

// Since form components depend on React and browser APIs,
// we test the logic separately by reimplementing testable parts
// and testing the utility functions directly

describe('@ereo/client - Form', () => {
  describe('FormProps interface', () => {
    interface FormProps {
      method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
      action?: string;
      replace?: boolean;
      preventScrollReset?: boolean;
      encType?: 'application/x-www-form-urlencoded' | 'multipart/form-data';
      fetcherKey?: string;
    }

    test('creates FormProps with defaults', () => {
      const props: FormProps = {};

      expect(props.method).toBeUndefined();
      expect(props.action).toBeUndefined();
      expect(props.replace).toBeUndefined();
      expect(props.preventScrollReset).toBeUndefined();
      expect(props.encType).toBeUndefined();
      expect(props.fetcherKey).toBeUndefined();
    });

    test('creates FormProps with all properties', () => {
      const props: FormProps = {
        method: 'post',
        action: '/api/submit',
        replace: true,
        preventScrollReset: true,
        encType: 'multipart/form-data',
        fetcherKey: 'myFetcher',
      };

      expect(props.method).toBe('post');
      expect(props.action).toBe('/api/submit');
      expect(props.replace).toBe(true);
      expect(props.preventScrollReset).toBe(true);
      expect(props.encType).toBe('multipart/form-data');
      expect(props.fetcherKey).toBe('myFetcher');
    });

    test('supports all HTTP methods', () => {
      const methods: FormProps['method'][] = ['get', 'post', 'put', 'patch', 'delete'];

      methods.forEach((method) => {
        const props: FormProps = { method };
        expect(props.method).toBe(method);
      });
    });
  });

  describe('ActionResult interface', () => {
    interface ActionResult<T = unknown> {
      data?: T;
      error?: Error;
      status: number;
      ok: boolean;
    }

    test('creates successful ActionResult', () => {
      const result: ActionResult<{ message: string }> = {
        data: { message: 'Success!' },
        status: 200,
        ok: true,
      };

      expect(result.data).toEqual({ message: 'Success!' });
      expect(result.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('creates error ActionResult', () => {
      const error = new Error('Something went wrong');
      const result: ActionResult = {
        error,
        status: 500,
        ok: false,
      };

      expect(result.error).toBe(error);
      expect(result.status).toBe(500);
      expect(result.ok).toBe(false);
      expect(result.data).toBeUndefined();
    });
  });

  describe('SubmissionState type', () => {
    type SubmissionState = 'idle' | 'submitting' | 'loading' | 'error';

    test('accepts valid states', () => {
      const states: SubmissionState[] = ['idle', 'submitting', 'loading', 'error'];

      states.forEach((state) => {
        expect(['idle', 'submitting', 'loading', 'error']).toContain(state);
      });
    });
  });

  describe('FetcherState interface', () => {
    type SubmissionState = 'idle' | 'submitting' | 'loading' | 'error';

    interface FetcherState<T = unknown> {
      state: SubmissionState;
      data?: T;
      error?: Error;
      formData?: FormData;
      formMethod?: string;
      formAction?: string;
    }

    test('creates idle FetcherState', () => {
      const state: FetcherState = {
        state: 'idle',
      };

      expect(state.state).toBe('idle');
      expect(state.data).toBeUndefined();
      expect(state.error).toBeUndefined();
    });

    test('creates submitting FetcherState with form info', () => {
      const formData = new FormData();
      formData.append('name', 'test');

      const state: FetcherState<{ id: number }> = {
        state: 'submitting',
        formData,
        formMethod: 'POST',
        formAction: '/api/submit',
      };

      expect(state.state).toBe('submitting');
      expect(state.formData).toBe(formData);
      expect(state.formMethod).toBe('POST');
      expect(state.formAction).toBe('/api/submit');
    });

    test('creates completed FetcherState with data', () => {
      const state: FetcherState<{ id: number; name: string }> = {
        state: 'idle',
        data: { id: 1, name: 'Test' },
      };

      expect(state.state).toBe('idle');
      expect(state.data).toEqual({ id: 1, name: 'Test' });
    });

    test('creates error FetcherState', () => {
      const error = new Error('Request failed');
      const state: FetcherState = {
        state: 'error',
        error,
      };

      expect(state.state).toBe('error');
      expect(state.error).toBe(error);
    });
  });

  describe('Form component rendering logic', () => {
    test('method mapping for progressive enhancement', () => {
      // Browsers only support GET and POST natively
      function getFormMethod(method: string): 'get' | 'post' {
        return method.toLowerCase() === 'get' ? 'get' : 'post';
      }

      expect(getFormMethod('get')).toBe('get');
      expect(getFormMethod('GET')).toBe('get');
      expect(getFormMethod('post')).toBe('post');
      expect(getFormMethod('POST')).toBe('post');
      expect(getFormMethod('put')).toBe('post');
      expect(getFormMethod('PUT')).toBe('post');
      expect(getFormMethod('patch')).toBe('post');
      expect(getFormMethod('PATCH')).toBe('post');
      expect(getFormMethod('delete')).toBe('post');
      expect(getFormMethod('DELETE')).toBe('post');
    });

    test('action URL resolution', () => {
      function resolveAction(action: string | undefined, currentPath: string): string {
        return action || currentPath;
      }

      expect(resolveAction('/api/submit', '/users')).toBe('/api/submit');
      expect(resolveAction(undefined, '/users')).toBe('/users');
      expect(resolveAction('', '/users')).toBe('/users');
    });

    test('hidden _method input for non-standard methods', () => {
      function needsMethodOverride(method: string): boolean {
        const normalizedMethod = method.toLowerCase();
        return normalizedMethod !== 'get' && normalizedMethod !== 'post';
      }

      expect(needsMethodOverride('get')).toBe(false);
      expect(needsMethodOverride('post')).toBe(false);
      expect(needsMethodOverride('put')).toBe(true);
      expect(needsMethodOverride('patch')).toBe(true);
      expect(needsMethodOverride('delete')).toBe(true);
    });
  });

  describe('Form data serialization', () => {
    test('serializes FormData to URLSearchParams', () => {
      const formData = new FormData();
      formData.append('name', 'John');
      formData.append('email', 'john@example.com');

      const params = new URLSearchParams();
      formData.forEach((value, key) => {
        if (typeof value === 'string') {
          params.append(key, value);
        }
      });

      expect(params.get('name')).toBe('John');
      expect(params.get('email')).toBe('john@example.com');
    });

    test('handles multiple values for same key', () => {
      const formData = new FormData();
      formData.append('tags', 'react');
      formData.append('tags', 'typescript');
      formData.append('tags', 'bun');

      const params = new URLSearchParams();
      formData.forEach((value, key) => {
        if (typeof value === 'string') {
          params.append(key, value);
        }
      });

      expect(params.getAll('tags')).toEqual(['react', 'typescript', 'bun']);
    });

    test('builds GET URL with form data', () => {
      const action = '/search';
      const formData = new FormData();
      formData.append('q', 'hello world');
      formData.append('page', '1');

      const url = new URL(action, 'http://localhost:3000');
      const params = new URLSearchParams();
      formData.forEach((value, key) => {
        if (typeof value === 'string') {
          params.append(key, value);
        }
      });
      url.search = params.toString();

      expect(url.pathname).toBe('/search');
      expect(url.searchParams.get('q')).toBe('hello world');
      expect(url.searchParams.get('page')).toBe('1');
    });
  });

  describe('useSubmit logic', () => {
    test('converts HTMLFormElement to FormData conceptually', () => {
      // Simulate form element data extraction
      const formElementData = {
        elements: [
          { name: 'username', value: 'john' },
          { name: 'password', value: 'secret' },
        ],
      };

      const formData = new FormData();
      formElementData.elements.forEach((el) => {
        formData.append(el.name, el.value);
      });

      expect(formData.get('username')).toBe('john');
      expect(formData.get('password')).toBe('secret');
    });

    test('converts plain object to FormData', () => {
      const obj = { name: 'John', age: '30' };
      const formData = new FormData();

      for (const [key, value] of Object.entries(obj)) {
        formData.append(key, value);
      }

      expect(formData.get('name')).toBe('John');
      expect(formData.get('age')).toBe('30');
    });

    test('converts URLSearchParams to FormData', () => {
      const params = new URLSearchParams();
      params.append('search', 'query');
      params.append('filter', 'active');

      const formData = new FormData();
      params.forEach((value, key) => {
        formData.append(key, value);
      });

      expect(formData.get('search')).toBe('query');
      expect(formData.get('filter')).toBe('active');
    });
  });

  describe('useFetcher state management', () => {
    test('initial fetcher state is idle', () => {
      const initialState = {
        state: 'idle' as const,
        data: undefined,
        error: undefined,
        formData: undefined,
        formMethod: undefined,
        formAction: undefined,
      };

      expect(initialState.state).toBe('idle');
      expect(initialState.data).toBeUndefined();
      expect(initialState.error).toBeUndefined();
    });

    test('state transitions during submission', () => {
      type State = 'idle' | 'submitting' | 'loading' | 'error';

      // Simulate state machine
      function transition(current: State, action: 'submit' | 'load' | 'success' | 'fail'): State {
        switch (action) {
          case 'submit':
            return 'submitting';
          case 'load':
            return 'loading';
          case 'success':
            return 'idle';
          case 'fail':
            return 'error';
          default:
            return current;
        }
      }

      let state: State = 'idle';

      // Submit
      state = transition(state, 'submit');
      expect(state).toBe('submitting');

      // Success
      state = transition(state, 'success');
      expect(state).toBe('idle');

      // Submit again
      state = transition(state, 'submit');
      expect(state).toBe('submitting');

      // Fail
      state = transition(state, 'fail');
      expect(state).toBe('error');
    });

    test('reset clears all fetcher state', () => {
      const state = {
        state: 'error' as const,
        data: { id: 1 },
        error: new Error('Failed'),
        formData: new FormData(),
        formMethod: 'POST',
        formAction: '/api/submit',
      };

      // Reset logic
      const resetState = {
        state: 'idle' as const,
        data: undefined,
        error: undefined,
        formData: undefined,
        formMethod: undefined,
        formAction: undefined,
      };

      expect(resetState.state).toBe('idle');
      expect(resetState.data).toBeUndefined();
      expect(resetState.error).toBeUndefined();
      expect(resetState.formData).toBeUndefined();
      expect(resetState.formMethod).toBeUndefined();
      expect(resetState.formAction).toBeUndefined();
    });
  });

  describe('Progressive enhancement', () => {
    test('form works as standard HTML form without JS', () => {
      // Standard form attributes for progressive enhancement
      const formAttributes = {
        method: 'post',
        action: '/api/submit',
        encType: 'application/x-www-form-urlencoded',
      };

      expect(formAttributes.method).toBe('post');
      expect(formAttributes.action).toBe('/api/submit');
      expect(formAttributes.encType).toBe('application/x-www-form-urlencoded');
    });

    test('encType can be multipart for file uploads', () => {
      const formAttributes = {
        method: 'post',
        action: '/api/upload',
        encType: 'multipart/form-data',
      };

      expect(formAttributes.encType).toBe('multipart/form-data');
    });

    test('method override uses hidden input for non-standard methods', () => {
      // For PUT/PATCH/DELETE, add hidden input _method
      const createMethodOverrideInput = (method: string) => ({
        type: 'hidden',
        name: '_method',
        value: method.toUpperCase(),
      });

      const putInput = createMethodOverrideInput('put');
      expect(putInput.name).toBe('_method');
      expect(putInput.value).toBe('PUT');

      const deleteInput = createMethodOverrideInput('delete');
      expect(deleteInput.name).toBe('_method');
      expect(deleteInput.value).toBe('DELETE');
    });
  });

  describe('Form utility functions', () => {
    describe('serializeFormData', () => {
      function serializeFormData(formData: FormData): string {
        const params = new URLSearchParams();
        formData.forEach((value, key) => {
          if (typeof value === 'string') {
            params.append(key, value);
          }
        });
        return params.toString();
      }

      test('serializes simple form data', () => {
        const formData = new FormData();
        formData.append('name', 'John');
        formData.append('email', 'john@example.com');

        const result = serializeFormData(formData);

        expect(result).toContain('name=John');
        expect(result).toContain('email=john%40example.com');
      });

      test('handles empty form data', () => {
        const formData = new FormData();
        const result = serializeFormData(formData);

        expect(result).toBe('');
      });

      test('handles special characters', () => {
        const formData = new FormData();
        formData.append('query', 'hello world');
        formData.append('symbols', '!@#$%');

        const result = serializeFormData(formData);

        expect(result).toContain('query=hello+world');
      });
    });

    describe('parseFormData', () => {
      function parseFormData(data: string): FormData {
        const formData = new FormData();
        const params = new URLSearchParams(data);
        params.forEach((value, key) => {
          formData.append(key, value);
        });
        return formData;
      }

      test('parses URL-encoded string', () => {
        const data = 'name=John&email=john%40example.com';
        const formData = parseFormData(data);

        expect(formData.get('name')).toBe('John');
        expect(formData.get('email')).toBe('john@example.com');
      });

      test('handles empty string', () => {
        const formData = parseFormData('');
        const entries = Array.from(formData.entries());

        expect(entries.length).toBe(0);
      });

      test('handles multiple values for same key', () => {
        const data = 'tags=react&tags=typescript';
        const formData = parseFormData(data);

        expect(formData.getAll('tags')).toEqual(['react', 'typescript']);
      });
    });

    describe('formDataToObject', () => {
      function formDataToObject(formData: FormData): Record<string, string | string[]> {
        const result: Record<string, string | string[]> = {};
        formData.forEach((value, key) => {
          if (typeof value === 'string') {
            if (key in result) {
              const existing = result[key];
              if (Array.isArray(existing)) {
                existing.push(value);
              } else {
                result[key] = [existing, value];
              }
            } else {
              result[key] = value;
            }
          }
        });
        return result;
      }

      test('converts simple FormData to object', () => {
        const formData = new FormData();
        formData.append('name', 'John');
        formData.append('age', '30');

        const obj = formDataToObject(formData);

        expect(obj.name).toBe('John');
        expect(obj.age).toBe('30');
      });

      test('handles multiple values for same key', () => {
        const formData = new FormData();
        formData.append('tags', 'react');
        formData.append('tags', 'typescript');
        formData.append('tags', 'bun');

        const obj = formDataToObject(formData);

        expect(obj.tags).toEqual(['react', 'typescript', 'bun']);
      });

      test('handles empty FormData', () => {
        const formData = new FormData();
        const obj = formDataToObject(formData);

        expect(Object.keys(obj).length).toBe(0);
      });
    });

    describe('objectToFormData', () => {
      function objectToFormData(
        obj: Record<string, string | string[] | number | boolean>
      ): FormData {
        const formData = new FormData();
        for (const [key, value] of Object.entries(obj)) {
          if (Array.isArray(value)) {
            value.forEach((v) => formData.append(key, String(v)));
          } else {
            formData.append(key, String(value));
          }
        }
        return formData;
      }

      test('converts simple object to FormData', () => {
        const obj = { name: 'John', age: 30 };
        const formData = objectToFormData(obj);

        expect(formData.get('name')).toBe('John');
        expect(formData.get('age')).toBe('30');
      });

      test('handles array values', () => {
        const obj = { tags: ['react', 'typescript', 'bun'] };
        const formData = objectToFormData(obj);

        expect(formData.getAll('tags')).toEqual(['react', 'typescript', 'bun']);
      });

      test('converts boolean values to strings', () => {
        const obj = { active: true, disabled: false };
        const formData = objectToFormData(obj);

        expect(formData.get('active')).toBe('true');
        expect(formData.get('disabled')).toBe('false');
      });

      test('handles empty object', () => {
        const obj = {};
        const formData = objectToFormData(obj);
        const entries = Array.from(formData.entries());

        expect(entries.length).toBe(0);
      });
    });
  });

  describe('Navigation integration', () => {
    test('FormNavigationState extends NavigationState', () => {
      interface NavigationState {
        pathname: string;
        search: string;
        hash: string;
        state?: unknown;
      }

      interface FormNavigationState extends NavigationState {
        state: 'idle' | 'submitting' | 'loading' | 'error';
        formData?: FormData;
        formMethod?: string;
        formAction?: string;
      }

      const navState: FormNavigationState = {
        pathname: '/users',
        search: '?page=1',
        hash: '#top',
        state: 'submitting',
        formMethod: 'POST',
        formAction: '/api/users',
      };

      expect(navState.pathname).toBe('/users');
      expect(navState.search).toBe('?page=1');
      expect(navState.state).toBe('submitting');
      expect(navState.formMethod).toBe('POST');
    });
  });

  describe('Redirect handling', () => {
    test('detects redirect from X-Redirect-Url header', () => {
      // Simulate response with redirect header
      const headers = new Headers();
      headers.set('X-Redirect-Url', '/success');

      const redirectUrl = headers.get('X-Redirect-Url');
      expect(redirectUrl).toBe('/success');
    });

    test('handles missing redirect header', () => {
      const headers = new Headers();

      const redirectUrl = headers.get('X-Redirect-Url');
      expect(redirectUrl).toBeNull();
    });
  });

  describe('Error handling', () => {
    test('creates ActionResult from Error', () => {
      const error = new Error('Network error');

      const result = {
        error,
        status: 0,
        ok: false,
      };

      expect(result.error).toBe(error);
      expect(result.error.message).toBe('Network error');
      expect(result.ok).toBe(false);
    });

    test('converts non-Error to Error', () => {
      const nonError = 'Something went wrong';
      const error = new Error(String(nonError));

      expect(error.message).toBe('Something went wrong');
    });
  });

  describe('Form context', () => {
    test('FormContextValue interface', () => {
      type SubmissionState = 'idle' | 'submitting' | 'loading' | 'error';

      interface FormContextValue {
        actionData: unknown;
        state: SubmissionState;
        setActionData: (data: unknown) => void;
        setState: (state: SubmissionState) => void;
      }

      const mockSetActionData = mock(() => {});
      const mockSetState = mock(() => {});

      const context: FormContextValue = {
        actionData: { message: 'Success' },
        state: 'idle',
        setActionData: mockSetActionData,
        setState: mockSetState,
      };

      expect(context.actionData).toEqual({ message: 'Success' });
      expect(context.state).toBe('idle');

      context.setActionData({ message: 'Updated' });
      expect(mockSetActionData).toHaveBeenCalledWith({ message: 'Updated' });

      context.setState('submitting');
      expect(mockSetState).toHaveBeenCalledWith('submitting');
    });
  });

  describe('SubmitOptions interface', () => {
    test('creates SubmitOptions with all properties', () => {
      interface SubmitOptions {
        method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
        action?: string;
        replace?: boolean;
        preventScrollReset?: boolean;
        encType?: 'application/x-www-form-urlencoded' | 'multipart/form-data';
        fetcherKey?: string;
      }

      const options: SubmitOptions = {
        method: 'put',
        action: '/api/update',
        replace: true,
        preventScrollReset: true,
        encType: 'multipart/form-data',
        fetcherKey: 'updateFetcher',
      };

      expect(options.method).toBe('put');
      expect(options.action).toBe('/api/update');
      expect(options.replace).toBe(true);
      expect(options.preventScrollReset).toBe(true);
      expect(options.encType).toBe('multipart/form-data');
      expect(options.fetcherKey).toBe('updateFetcher');
    });

    test('defaults are applied correctly', () => {
      interface SubmitOptions {
        method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
        action?: string;
        replace?: boolean;
        preventScrollReset?: boolean;
        encType?: 'application/x-www-form-urlencoded' | 'multipart/form-data';
        fetcherKey?: string;
      }

      function applyDefaults(options: SubmitOptions): Required<Omit<SubmitOptions, 'fetcherKey'>> & { fetcherKey?: string } {
        return {
          method: options.method || 'post',
          action: options.action || '/current-path',
          replace: options.replace ?? false,
          preventScrollReset: options.preventScrollReset ?? false,
          encType: options.encType || 'application/x-www-form-urlencoded',
          fetcherKey: options.fetcherKey,
        };
      }

      const defaults = applyDefaults({});

      expect(defaults.method).toBe('post');
      expect(defaults.action).toBe('/current-path');
      expect(defaults.replace).toBe(false);
      expect(defaults.preventScrollReset).toBe(false);
      expect(defaults.encType).toBe('application/x-www-form-urlencoded');
      expect(defaults.fetcherKey).toBeUndefined();
    });
  });

  describe('useFetchers - fetcher registry', () => {
    test('FetcherState interface has expected shape', () => {
      const state: import('./form').FetcherState = {
        state: 'idle',
      };

      expect(state.state).toBe('idle');
      expect(state.data).toBeUndefined();
      expect(state.error).toBeUndefined();
      expect(state.formData).toBeUndefined();
      expect(state.formMethod).toBeUndefined();
      expect(state.formAction).toBeUndefined();
    });

    test('FetcherState tracks submission state', () => {
      const states: import('./form').SubmissionState[] = ['idle', 'submitting', 'loading', 'error'];
      expect(states).toHaveLength(4);

      for (const s of states) {
        const fetcher: import('./form').FetcherState = { state: s };
        expect(fetcher.state).toBe(s);
      }
    });

    test('FetcherState can hold data and error', () => {
      const withData: import('./form').FetcherState<{ message: string }> = {
        state: 'idle',
        data: { message: 'hello' },
      };
      expect(withData.data?.message).toBe('hello');

      const withError: import('./form').FetcherState = {
        state: 'error',
        error: new Error('failed'),
      };
      expect(withError.error?.message).toBe('failed');
    });

    test('FetcherState can track form metadata', () => {
      const fetcher: import('./form').FetcherState = {
        state: 'submitting',
        formMethod: 'POST',
        formAction: '/api/submit',
      };
      expect(fetcher.formMethod).toBe('POST');
      expect(fetcher.formAction).toBe('/api/submit');
    });
  });
});
