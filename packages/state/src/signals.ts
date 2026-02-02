/**
 * @areo/state - Signals and reactivity system
 *
 * Fine-grained reactivity for state management.
 */

/** Subscriber function */
type Subscriber<T> = (value: T) => void;

/** Signal with reactive value */
export class Signal<T> {
  private _value: T;
  private _subscribers: Set<Subscriber<T>> = new Set();
  private _derivedFrom: Signal<unknown>[] = [];

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  /** Get current value (subscribes in reactive context) */
  get(): T {
    return this._value;
  }

  /** Set new value (notifies subscribers) */
  set(value: T): void {
    if (this._value !== value) {
      this._value = value;
      this._notify();
    }
  }

  /** Update value with function */
  update(updater: (value: T) => T): void {
    this.set(updater(this._value));
  }

  /** Subscribe to changes */
  subscribe(subscriber: Subscriber<T>): () => void {
    this._subscribers.add(subscriber);
    return () => this._subscribers.delete(subscriber);
  }

  /** Create computed signal from this signal */
  map<U>(fn: (value: T) => U): Signal<U> {
    const computed = new Signal(fn(this._value));
    this.subscribe((v) => computed.set(fn(v)));
    return computed;
  }

  private _notify(): void {
    for (const subscriber of this._subscribers) {
      subscriber(this._value);
    }
  }
}

/** Create a new signal */
export function signal<T>(initialValue: T): Signal<T> {
  return new Signal(initialValue);
}

/** Create a computed signal */
export function computed<T>(fn: () => T, deps: Signal<unknown>[]): Signal<T> {
  const computed = new Signal(fn());

  const update = (): void => {
    computed.set(fn());
  };

  for (const dep of deps) {
    dep.subscribe(update);
  }

  return computed;
}

/** Atom (alias for signal) */
export function atom<T>(initialValue: T): Signal<T> {
  return signal(initialValue);
}

/** Batch multiple updates */
export function batch<T>(fn: () => T): T {
  // In a real implementation, this would batch notifications
  return fn();
}

/** Store for global state */
export class Store<T extends Record<string, unknown>> {
  private _state: Map<keyof T, Signal<T[keyof T]>> = new Map();

  constructor(initialState: T) {
    for (const [key, value] of Object.entries(initialState)) {
      this._state.set(key, signal(value));
    }
  }

  /** Get signal for key */
  get<K extends keyof T>(key: K): Signal<T[K]> {
    return this._state.get(key) as Signal<T[K]>;
  }

  /** Set value for key */
  set<K extends keyof T>(key: K, value: T[K]): void {
    const s = this._state.get(key);
    if (s) {
      s.set(value);
    } else {
      this._state.set(key, signal(value));
    }
  }

  /** Get current snapshot of all values */
  getSnapshot(): T {
    const snapshot = {} as T;
    for (const [key, sig] of this._state) {
      snapshot[key] = sig.get() as T[keyof T];
    }
    return snapshot;
  }
}

/** Create a store */
export function createStore<T extends Record<string, unknown>>(initialState: T): Store<T> {
  return new Store(initialState);
}
