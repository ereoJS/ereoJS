import { describe, expect, test } from 'bun:test';
import { json, redirect, throwRedirect, data, error } from './action';
import { serializeLoaderData } from './loader';

describe('@ereo/data - Response Helpers', () => {
  // =========================================================================
  // json()
  // =========================================================================
  describe('json()', () => {
    test('returns JSON response with correct content-type', async () => {
      const response = json({ hello: 'world' });
      expect(response.headers.get('Content-Type')).toBe('application/json');
      const body = await response.json();
      expect(body).toEqual({ hello: 'world' });
    });

    test('preserves status from init', () => {
      const response = json({ error: 'not found' }, { status: 404 });
      expect(response.status).toBe(404);
    });

    test('allows Content-Type override via Headers object', () => {
      const headers = new Headers({ 'Content-Type': 'application/vnd.api+json' });
      const response = json({ data: 1 }, { headers });
      expect(response.headers.get('Content-Type')).toBe('application/vnd.api+json');
    });

    test('allows Content-Type override via plain object', () => {
      const response = json({ data: 1 }, {
        headers: { 'Content-Type': 'application/vnd.api+json' },
      });
      expect(response.headers.get('Content-Type')).toBe('application/vnd.api+json');
    });

    test('merges custom headers alongside Content-Type', () => {
      const response = json({ ok: true }, {
        headers: { 'X-Custom': 'value' },
      });
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom')).toBe('value');
    });

    test('handles Headers object with additional headers', () => {
      const headers = new Headers();
      headers.set('X-Request-Id', '123');
      headers.set('Cache-Control', 'no-cache');
      const response = json({ a: 1 }, { headers });
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Request-Id')).toBe('123');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
    });
  });

  // =========================================================================
  // redirect()
  // =========================================================================
  describe('redirect()', () => {
    test('defaults to 303 status', () => {
      const response = redirect('/login');
      expect(response.status).toBe(303);
      expect(response.headers.get('Location')).toBe('/login');
    });

    test('accepts numeric status (backward compat)', () => {
      const response = redirect('/moved', 301);
      expect(response.status).toBe(301);
      expect(response.headers.get('Location')).toBe('/moved');
    });

    test('accepts ResponseInit with custom status', () => {
      const response = redirect('/new', { status: 307 });
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('/new');
    });

    test('accepts ResponseInit with custom headers', () => {
      const response = redirect('/auth', {
        status: 303,
        headers: { 'Set-Cookie': 'session=abc' },
      });
      expect(response.status).toBe(303);
      expect(response.headers.get('Location')).toBe('/auth');
      expect(response.headers.get('Set-Cookie')).toBe('session=abc');
    });

    test('Location header is always set even when headers provided', () => {
      const response = redirect('/target', {
        headers: new Headers({ 'X-Custom': 'value' }),
      });
      expect(response.headers.get('Location')).toBe('/target');
      expect(response.headers.get('X-Custom')).toBe('value');
    });

    test('body is null', async () => {
      const response = redirect('/');
      expect(response.body).toBeNull();
    });
  });

  // =========================================================================
  // throwRedirect()
  // =========================================================================
  describe('throwRedirect()', () => {
    test('throws a Response', () => {
      let thrown: unknown;
      try {
        throwRedirect('/login');
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(Response);
      const response = thrown as Response;
      expect(response.status).toBe(303);
      expect(response.headers.get('Location')).toBe('/login');
    });

    test('throws with custom status', () => {
      let thrown: unknown;
      try {
        throwRedirect('/moved', 301);
      } catch (e) {
        thrown = e;
      }
      const response = thrown as Response;
      expect(response.status).toBe(301);
    });

    test('throws with ResponseInit', () => {
      let thrown: unknown;
      try {
        throwRedirect('/auth', {
          status: 303,
          headers: { 'Set-Cookie': 'token=xyz' },
        });
      } catch (e) {
        thrown = e;
      }
      const response = thrown as Response;
      expect(response.status).toBe(303);
      expect(response.headers.get('Set-Cookie')).toBe('token=xyz');
      expect(response.headers.get('Location')).toBe('/auth');
    });
  });

  // =========================================================================
  // data()
  // =========================================================================
  describe('data()', () => {
    test('returns response with XSS-safe serialization', async () => {
      const response = data({ html: '<script>alert("xss")</script>' });
      const body = await response.text();
      // Should not contain raw < or > characters
      expect(body).not.toContain('<script>');
      expect(body).toContain('\\u003c');
      expect(body).toContain('\\u003e');
    });

    test('sets application/json content type', () => {
      const response = data({ ok: true });
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    test('allows Content-Type override', () => {
      const response = data({ ok: true }, {
        headers: { 'Content-Type': 'text/plain' },
      });
      expect(response.headers.get('Content-Type')).toBe('text/plain');
    });

    test('preserves custom status', () => {
      const response = data({ error: 'bad' }, { status: 400 });
      expect(response.status).toBe(400);
    });

    test('output matches serializeLoaderData', async () => {
      const value = { items: [1, 2, 3], name: "test & <things>" };
      const response = data(value);
      const body = await response.text();
      expect(body).toBe(serializeLoaderData(value));
    });
  });

  // =========================================================================
  // error()
  // =========================================================================
  describe('error()', () => {
    test('returns error JSON response', async () => {
      const response = error('Something failed', 500);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Something failed');
    });

    test('defaults to 500 status', () => {
      const response = error('fail');
      expect(response.status).toBe(500);
    });

    test('accepts custom status', () => {
      const response = error('not found', 404);
      expect(response.status).toBe(404);
    });
  });
});
