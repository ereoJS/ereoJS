import type { FormStoreInterface } from './types';

const PROXY_MARKER = Symbol('ereo-form-proxy');

export function createValuesProxy<T extends Record<string, any>>(
  store: FormStoreInterface<T>,
  basePath = '',
  proxyCache?: Map<string, any>
): T {
  const cache = proxyCache ?? new Map<string, any>();

  // Return cached proxy for nested paths to preserve reference equality
  if (basePath && cache.has(basePath)) {
    return cache.get(basePath);
  }

  const proxy = new Proxy({} as T, {
    get(_target, prop, _receiver) {
      if (prop === PROXY_MARKER) return true;
      if (typeof prop === 'symbol') return undefined;

      const fullPath = basePath ? `${basePath}.${String(prop)}` : String(prop);
      const value = store.getValue(fullPath);

      if (value !== null && typeof value === 'object') {
        return createValuesProxy(store, fullPath, cache);
      }

      return value;
    },

    set(_target, prop, value) {
      // Return true for symbols (no-op) to avoid TypeError in strict mode
      if (typeof prop === 'symbol') return true;

      const fullPath = basePath ? `${basePath}.${String(prop)}` : String(prop);
      store.setValue(fullPath, value);
      return true;
    },

    has(_target, prop) {
      if (prop === PROXY_MARKER) return true;
      if (typeof prop === 'symbol') return false;

      // Check if the key exists in the object shape, not just if value is defined
      const obj = basePath ? store.getValue(basePath) : store.getValues();
      if (obj !== null && typeof obj === 'object') {
        return String(prop) in (obj as object);
      }
      return false;
    },

    ownKeys() {
      const obj = basePath ? store.getValue(basePath) : store.getValues();
      if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj as object);
      }
      return [];
    },

    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop === 'symbol') return undefined;

      // Must return a descriptor for any key reported by ownKeys to satisfy Proxy invariants
      const obj = basePath ? store.getValue(basePath) : store.getValues();
      if (obj !== null && typeof obj === 'object' && String(prop) in (obj as object)) {
        const fullPath = basePath ? `${basePath}.${String(prop)}` : String(prop);
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: store.getValue(fullPath),
        };
      }
      return undefined;
    },
  });

  if (basePath) {
    cache.set(basePath, proxy);
  }

  return proxy;
}
