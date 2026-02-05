// ─── Path Parsing ────────────────────────────────────────────────────────────

export function parsePath(path: string): (string | number)[] {
  if (!path) return [];

  const segments: (string | number)[] = [];
  let current = '';

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === '.') {
      if (current) {
        segments.push(isIndex(current) ? parseInt(current, 10) : current);
        current = '';
      }
    } else if (char === '[') {
      if (current) {
        segments.push(isIndex(current) ? parseInt(current, 10) : current);
        current = '';
      }
      const closeBracket = path.indexOf(']', i);
      if (closeBracket !== -1) {
        const indexStr = path.slice(i + 1, closeBracket);
        const index = parseInt(indexStr, 10);
        if (!isNaN(index)) {
          segments.push(index);
        } else if (indexStr) {
          segments.push(indexStr);
        }
        i = closeBracket;
      }
    } else {
      current += char;
    }
  }

  if (current) {
    segments.push(isIndex(current) ? parseInt(current, 10) : current);
  }

  return segments;
}

function isIndex(str: string): boolean {
  return /^\d+$/.test(str);
}

// ─── Get Path ────────────────────────────────────────────────────────────────

export function getPath(obj: any, path: string): unknown {
  if (!path) return obj;
  const segments = parsePath(path);
  let current = obj;

  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }

  return current;
}

// ─── Set Path (Immutable) ────────────────────────────────────────────────────

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const segments = parsePath(path);
  if (segments.length === 0) return value as T;

  return setPathRecursive(obj, segments, 0, value) as T;
}

function setPathRecursive(
  current: any,
  segments: (string | number)[],
  index: number,
  value: unknown
): unknown {
  const segment = segments[index];

  // Normalize: if current is a primitive at a non-leaf, treat as empty container
  if (current !== null && current !== undefined && typeof current !== 'object') {
    const nextSegment = segments[index + 1];
    current = typeof nextSegment === 'number' ? [] : {};
  }

  if (index === segments.length - 1) {
    if (Array.isArray(current)) {
      const copy = [...current];
      copy[segment as number] = value;
      return copy;
    }
    return { ...(current ?? {}), [segment]: value };
  }

  const next = current?.[segment];
  const nextSegment = segments[index + 1];
  const nextIsArray = typeof nextSegment === 'number';
  const nextValue = next ?? (nextIsArray ? [] : {});

  const updated = setPathRecursive(nextValue, segments, index + 1, value);

  if (Array.isArray(current)) {
    const copy = [...current];
    copy[segment as number] = updated;
    return copy;
  }

  return { ...(current ?? {}), [segment]: updated };
}

// ─── Deep Clone ──────────────────────────────────────────────────────────────

export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  // Fallback: handle Date, RegExp, Map, Set before JSON fallback
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as T;
  if (obj instanceof Map) {
    const map = new Map();
    for (const [k, v] of obj) map.set(deepClone(k), deepClone(v));
    return map as T;
  }
  if (obj instanceof Set) {
    const set = new Set();
    for (const v of obj) set.add(deepClone(v));
    return set as T;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }
  const result: Record<string, any> = {};
  for (const key of Object.keys(obj as any)) {
    result[key] = deepClone((obj as any)[key]);
  }
  return result as T;
}

// ─── Deep Equal ──────────────────────────────────────────────────────────────

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return false;

  // Handle Date comparison
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (a instanceof Date || b instanceof Date) return false;

  // Handle RegExp comparison
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (a instanceof RegExp || b instanceof RegExp) return false;

  // Handle Map comparison
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }

  // Handle Set comparison
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) {
      if (!b.has(v)) return false;
    }
    return true;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )) {
      return false;
    }
  }

  return true;
}

// ─── Flatten Object to Paths ─────────────────────────────────────────────────

export function flattenToPaths(obj: any, prefix = ''): Map<string, unknown> {
  const result = new Map<string, unknown>();

  if (obj === null || typeof obj !== 'object') {
    if (prefix) result.set(prefix, obj);
    return result;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const path = prefix ? `${prefix}.${i}` : `${i}`;
      const nested = flattenToPaths(obj[i], path);
      for (const [k, v] of nested) {
        result.set(k, v);
      }
    }
    if (prefix) result.set(prefix, obj);
    return result;
  }

  // Store the object itself at the prefix even if empty
  if (prefix) result.set(prefix, obj);

  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object') {
      const nested = flattenToPaths(value, path);
      for (const [k, v] of nested) {
        result.set(k, v);
      }
      result.set(path, value);
    } else {
      result.set(path, value);
    }
  }

  return result;
}

// ─── Reconstruct Object from Flat Paths ──────────────────────────────────────

export function reconstructFromPaths(paths: Map<string, unknown>): Record<string, any> {
  let result: Record<string, any> = {};
  // First pass: set all leaf values (non-object, including null)
  for (const [path, value] of paths) {
    if (!path.includes('.') && (typeof value !== 'object' || value === null)) {
      result = setPath(result, path, value);
    }
  }
  // Second pass: set top-level object/array values not already set
  for (const [path, value] of paths) {
    if (!path.includes('.') && typeof value === 'object' && value !== null) {
      if (!(path in result)) {
        result = setPath(result, path, value);
      }
    }
  }
  // Third pass: set nested values
  for (const [path, value] of paths) {
    if (path.includes('.')) {
      const existing = getPath(result, path);
      if (existing === undefined) {
        result = setPath(result, path, value);
      }
    }
  }
  return result;
}
