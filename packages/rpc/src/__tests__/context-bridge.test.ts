/**
 * Tests for context bridge between RPC and loaders/actions
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  setContextProvider,
  getContextProvider,
  clearContextProvider,
  createSharedContext,
  createContextProvider,
  withSharedContext,
} from '../context-bridge';
import type { BaseContext } from '../types';

describe('Context Bridge', () => {
  beforeEach(() => {
    clearContextProvider();
  });

  describe('setContextProvider / getContextProvider', () => {
    test('sets and gets context provider', () => {
      const provider = async () => ({ user: 'test' });
      setContextProvider(provider);

      expect(getContextProvider()).toBe(provider);
    });

    test('clearContextProvider removes provider', () => {
      setContextProvider(async () => ({ test: true }));
      expect(getContextProvider()).not.toBeNull();

      clearContextProvider();
      expect(getContextProvider()).toBeNull();
    });
  });

  describe('createSharedContext', () => {
    test('returns empty object when no provider set', async () => {
      const request = new Request('http://localhost');
      const ctx = await createSharedContext(request);

      expect(ctx).toEqual({});
    });

    test('calls provider with request when set', async () => {
      const mockRequest = new Request('http://localhost', {
        headers: { 'Authorization': 'Bearer token123' },
      });

      setContextProvider(async (req) => {
        const auth = req.headers.get('Authorization');
        return { auth, user: { id: '1' } };
      });

      const ctx = await createSharedContext(mockRequest);

      expect(ctx.auth).toBe('Bearer token123');
      expect(ctx.user).toEqual({ id: '1' });
    });

    test('handles async providers', async () => {
      setContextProvider(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { delayed: true };
      });

      const ctx = await createSharedContext(new Request('http://localhost'));
      expect(ctx.delayed).toBe(true);
    });
  });

  describe('createContextProvider', () => {
    test('creates typed provider', async () => {
      interface MyContext {
        db: { query: () => string };
        user: { id: string } | null;
      }

      const provider = createContextProvider<MyContext>(async () => ({
        db: { query: () => 'result' },
        user: { id: '123' },
      }));

      setContextProvider(provider);
      const ctx = await createSharedContext(new Request('http://localhost'));

      expect(ctx.user?.id).toBe('123');
      expect(ctx.db.query()).toBe('result');
    });
  });

  describe('withSharedContext middleware', () => {
    test('injects shared context into procedure context', async () => {
      setContextProvider(async () => ({ shared: 'data', userId: '456' }));

      const middleware = withSharedContext();
      const baseCtx: BaseContext = {
        ctx: { existing: 'value' },
        request: new Request('http://localhost'),
      };

      let receivedCtx: any;
      await middleware({
        ctx: baseCtx,
        next: (ctx) => {
          receivedCtx = ctx;
          return { ok: true as const, ctx };
        },
      });

      expect(receivedCtx.ctx.shared).toBe('data');
      expect(receivedCtx.ctx.userId).toBe('456');
      expect(receivedCtx.ctx.existing).toBe('value');
    });

    test('merges context correctly', async () => {
      setContextProvider(async () => ({ shared: 'from-provider' }));

      const middleware = withSharedContext();
      const baseCtx: BaseContext = {
        ctx: { shared: 'from-base', other: 'value' },
        request: new Request('http://localhost'),
      };

      let receivedCtx: any;
      await middleware({
        ctx: baseCtx,
        next: (ctx) => {
          receivedCtx = ctx;
          return { ok: true as const, ctx };
        },
      });

      // Provider context should override or merge with base
      expect(receivedCtx.ctx.shared).toBe('from-provider');
      expect(receivedCtx.ctx.other).toBe('value');
    });
  });

  describe('integration with procedure', () => {
    test('shared context available in procedure handler', async () => {
      interface AppContext {
        user: { id: string; role: string };
        db: { connected: boolean };
      }

      setContextProvider(async () => ({
        user: { id: 'user-123', role: 'admin' },
        db: { connected: true },
      }));

      // Simulate middleware execution
      const middleware = withSharedContext();
      const baseCtx: BaseContext = {
        ctx: {},
        request: new Request('http://localhost'),
      };

      const result = await middleware({
        ctx: baseCtx,
        next: (ctx) => {
          // This simulates what the procedure handler would receive
          expect(ctx.ctx.user).toBeDefined();
          expect(ctx.ctx.user.id).toBe('user-123');
          expect(ctx.ctx.db.connected).toBe(true);
          return { ok: true as const, ctx };
        },
      });

      expect(result.ok).toBe(true);
    });
  });
});
