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
  /** Cleanup functions for upstream subscriptions (from map/computed) */
  _disposers: (() => void)[] = [];
  /** Whether this signal has been disposed */
  private _disposed = false;

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
    if (!Object.is(this._value, value)) {
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
    const mapped = new Signal(fn(this._value));
    const unsub = this.subscribe((v) => mapped.set(fn(v)));
    mapped._disposers.push(unsub);
    return mapped;
  }

  /** Dispose this signal: unsubscribe from upstream sources and clear subscribers */
  dispose(): void {
    this._disposed = true;
    for (const disposer of this._disposers) {
      disposer();
    }
    this._disposers = [];
    this._subscribers.clear();
  }

  private _notify(): void {
    if (this._disposed) return;
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
  const c = new Signal(fn());

  const update = (): void => {
    c.set(fn());
  };

  const uniqueDeps = [...new Set(deps)];
  for (const dep of uniqueDeps) {
    const unsub = dep.subscribe(update);
    c._disposers.push(unsub);
  }

  return c;
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
      let firstError: unknown;
      for (const notifier of queue) {
        try {
          notifier();
        } catch (e) {
          firstError ??= e;
        }
      }
      if (firstError) throw firstError;
    }
  }
}

/** Store for global state */
export class Store<T extends Record<string, unknown>> {
  // Use Map<string, Signal<any>> internally to avoid complex type juggling
  private _state: Map<string, Signal<any>> = new Map();
  /** Listeners notified on any value change or key addition */
  private _listeners: Set<() => void> = new Set();
  /** Internal signal subscriptions that forward to _listeners */
  private _internalUnsubs: (() => void)[] = [];

  constructor(initialState: T) {
    for (const [key, value] of Object.entries(initialState)) {
      const s = signal(value);
      this._state.set(key, s);
      this._subscribeToSignal(s);
    }
  }

  /** Subscribe an internal signal to forward changes to store listeners */
  private _subscribeToSignal(s: Signal<any>): void {
    const unsub = s.subscribe(() => this._notifyListeners());
    this._internalUnsubs.push(unsub);
  }

  /** Notify all store-level listeners */
  private _notifyListeners(): void {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Store listener error:', e);
      }
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
      const newSignal = signal(value);
      this._state.set(key as string, newSignal);
      this._subscribeToSignal(newSignal);
      this._notifyListeners();
    }
  }

  /** Subscribe to any change in the store (value changes or new keys) */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** Dispose the store: unsubscribe all internal signal subscriptions and clear listeners */
  dispose(): void {
    for (const unsub of this._internalUnsubs) {
      unsub();
    }
    this._internalUnsubs = [];
    this._listeners.clear();
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
