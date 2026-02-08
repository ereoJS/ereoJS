/**
 * @ereo/state - Signals and reactivity system
 *
 * Fine-grained reactivity for state management.
 */

/** Subscriber function */
type Subscriber<T> = (value: T) => void;

/** Signal with reactive value */
export class Signal<T> {
  private _value: T;
  private _subscribers: Set<Subscriber<T>> = new Set();
  /** Stable reference for batch deduplication */
  private readonly _boundFire: () => void;

  constructor(initialValue: T) {
    this._value = initialValue;
    this._boundFire = this._fireSubscribers.bind(this);
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
    const deferred = _scheduleBatchNotification(this._boundFire);
    if (!deferred) {
      this._fireSubscribers();
    }
  }

  private _fireSubscribers(): void {
    for (const subscriber of this._subscribers) {
      try {
        subscriber(this._value);
      } catch (e) {
        // Isolate subscriber errors so one failing subscriber doesn't block others
        console.error('Signal subscriber error:', e);
      }
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

/** Whether we are currently inside a batch */
let batchDepth = 0;
/** Pending notifications to fire after the batch completes */
let batchQueue: Set<() => void> | null = null;

/** Schedule a notification (called from Signal._notify) */
export function _scheduleBatchNotification(notifier: () => void): boolean {
  if (batchDepth > 0) {
    if (!batchQueue) batchQueue = new Set();
    batchQueue.add(notifier);
    return true; // deferred
  }
  return false; // not batching, fire immediately
}

/** Batch multiple updates — notifications are deferred until the batch completes */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0 && batchQueue) {
      const queue = batchQueue;
      batchQueue = null;
      for (const notifier of queue) {
        notifier();
      }
    }
  }
}

/** Store for global state */
export class Store<T extends Record<string, unknown>> {
  // Use Map<string, Signal<any>> internally to avoid complex type juggling
  private _state: Map<string, Signal<any>> = new Map();

  constructor(initialState: T) {
    for (const [key, value] of Object.entries(initialState)) {
      this._state.set(key, signal(value));
    }
  }

  /** Get signal for key */
  get<K extends keyof T>(key: K): Signal<T[K]> {
    return this._state.get(key as string) as Signal<T[K]>;
  }

  /** Set value for key */
  set<K extends keyof T>(key: K, value: T[K]): void {
    const s = this._state.get(key as string);
    if (s) {
      s.set(value);
    } else {
      this._state.set(key as string, signal(value));
    }
  }

  /** Iterate over all signal entries */
  entries(): IterableIterator<[string, Signal<unknown>]> {
    return this._state.entries();
  }

  /** Get current snapshot of all values */
  getSnapshot(): T {
    const snapshot = {} as T;
    for (const [key, sig] of this._state) {
      (snapshot as Record<string, unknown>)[key] = sig.get();
    }
    return snapshot;
  }
}

/** Create a store */
export function createStore<T extends Record<string, unknown>>(initialState: T): Store<T> {
  return new Store(initialState);
}
