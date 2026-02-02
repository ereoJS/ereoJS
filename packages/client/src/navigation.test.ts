import { describe, expect, test, beforeEach } from 'bun:test';

// Since navigation depends on window/browser APIs, we test the logic separately
// by reimplementing testable parts

describe('@areo/client - Navigation', () => {
  describe('NavigationState', () => {
    interface NavigationState {
      pathname: string;
      search: string;
      hash: string;
      state?: unknown;
    }

    test('creates state with all properties', () => {
      const state: NavigationState = {
        pathname: '/test',
        search: '?query=value',
        hash: '#section',
        state: { data: 'test' },
      };

      expect(state.pathname).toBe('/test');
      expect(state.search).toBe('?query=value');
      expect(state.hash).toBe('#section');
      expect(state.state).toEqual({ data: 'test' });
    });

    test('creates state with optional properties', () => {
      const state: NavigationState = {
        pathname: '/test',
        search: '',
        hash: '',
      };

      expect(state.state).toBeUndefined();
    });
  });

  describe('NavigationEvent', () => {
    interface NavigationState {
      pathname: string;
      search: string;
      hash: string;
      state?: unknown;
    }

    interface NavigationEvent {
      type: 'push' | 'replace' | 'pop';
      from: NavigationState;
      to: NavigationState;
    }

    test('creates push event', () => {
      const event: NavigationEvent = {
        type: 'push',
        from: { pathname: '/', search: '', hash: '' },
        to: { pathname: '/new', search: '', hash: '' },
      };

      expect(event.type).toBe('push');
      expect(event.from.pathname).toBe('/');
      expect(event.to.pathname).toBe('/new');
    });

    test('creates replace event', () => {
      const event: NavigationEvent = {
        type: 'replace',
        from: { pathname: '/old', search: '', hash: '' },
        to: { pathname: '/new', search: '', hash: '' },
      };

      expect(event.type).toBe('replace');
    });

    test('creates pop event', () => {
      const event: NavigationEvent = {
        type: 'pop',
        from: { pathname: '/current', search: '', hash: '' },
        to: { pathname: '/previous', search: '', hash: '' },
      };

      expect(event.type).toBe('pop');
    });
  });

  describe('isActive logic', () => {
    function isActive(currentPath: string, path: string, exact = false): boolean {
      if (exact) {
        return currentPath === path;
      }
      return currentPath.startsWith(path);
    }

    test('exact match returns true for identical paths', () => {
      expect(isActive('/users', '/users', true)).toBe(true);
    });

    test('exact match returns false for different paths', () => {
      expect(isActive('/users/1', '/users', true)).toBe(false);
    });

    test('prefix match returns true for matching prefix', () => {
      expect(isActive('/users/1', '/users', false)).toBe(true);
      expect(isActive('/users/1/posts', '/users', false)).toBe(true);
    });

    test('prefix match returns false for non-matching paths', () => {
      expect(isActive('/posts', '/users', false)).toBe(false);
    });
  });

  describe('URL parsing', () => {
    test('parses pathname from URL', () => {
      const url = new URL('http://localhost:3000/users/1?tab=posts#section');

      expect(url.pathname).toBe('/users/1');
      expect(url.search).toBe('?tab=posts');
      expect(url.hash).toBe('#section');
    });

    test('handles URL without query or hash', () => {
      const url = new URL('http://localhost:3000/users');

      expect(url.pathname).toBe('/users');
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
    });
  });

  describe('Listener management', () => {
    type Listener = (event: any) => void;

    class ListenerManager {
      private listeners = new Set<Listener>();

      subscribe(listener: Listener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      }

      notify(event: any): void {
        for (const listener of this.listeners) {
          listener(event);
        }
      }

      get size(): number {
        return this.listeners.size;
      }
    }

    test('adds and removes listeners', () => {
      const manager = new ListenerManager();

      const unsubscribe = manager.subscribe(() => {});

      expect(manager.size).toBe(1);

      unsubscribe();

      expect(manager.size).toBe(0);
    });

    test('notifies all listeners', () => {
      const manager = new ListenerManager();
      const calls: number[] = [];

      manager.subscribe(() => calls.push(1));
      manager.subscribe(() => calls.push(2));
      manager.subscribe(() => calls.push(3));

      manager.notify({});

      expect(calls).toEqual([1, 2, 3]);
    });

    test('passes event to listeners', () => {
      const manager = new ListenerManager();
      let receivedEvent: any = null;

      manager.subscribe((event) => {
        receivedEvent = event;
      });

      manager.notify({ type: 'push' });

      expect(receivedEvent).toEqual({ type: 'push' });
    });
  });

  describe('fetchLoaderData logic', () => {
    test('builds URL with params as query string', () => {
      const pathname = '/users/1';
      const params = { tab: 'posts', sort: 'date' };

      const url = new URL(pathname, 'http://localhost:3000');

      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }

      expect(url.searchParams.get('tab')).toBe('posts');
      expect(url.searchParams.get('sort')).toBe('date');
      expect(url.toString()).toContain('tab=posts');
      expect(url.toString()).toContain('sort=date');
    });

    test('skips undefined params', () => {
      const params = { defined: 'value', undefined: undefined };
      const url = new URL('/test', 'http://localhost:3000');

      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }

      expect(url.searchParams.get('defined')).toBe('value');
      expect(url.searchParams.has('undefined')).toBe(false);
    });
  });
});
