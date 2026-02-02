/**
 * @areo/testing - Assertions Tests
 */

import { describe, expect, test } from 'bun:test';
import {
  assertRedirect,
  assertJson,
  assertStatus,
  assertHeaders,
  assertCookies,
  assertThrows,
  assertSchema,
} from './assertions';

describe('assertRedirect', () => {
  test('passes for valid redirect response', () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: '/login' },
    });

    expect(() => assertRedirect(response)).not.toThrow();
  });

  test('passes for redirect to expected location', () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: '/dashboard' },
    });

    expect(() => assertRedirect(response, '/dashboard')).not.toThrow();
  });

  test('throws for null response', () => {
    expect(() => assertRedirect(null)).toThrow('Expected a response but got null');
  });

  test('throws for null response with custom message', () => {
    expect(() => assertRedirect(null, undefined, { message: 'Custom null message' }))
      .toThrow('Custom null message');
  });

  test('throws for non-redirect status', () => {
    const response = new Response('OK', { status: 200 });

    expect(() => assertRedirect(response)).toThrow('Expected redirect status (3xx) but got 200');
  });

  test('throws for non-redirect status with custom message', () => {
    const response = new Response('OK', { status: 200 });

    expect(() => assertRedirect(response, undefined, { message: 'Custom message' }))
      .toThrow('Custom message');
  });

  test('throws for 4xx status', () => {
    const response = new Response('Not Found', { status: 404 });

    expect(() => assertRedirect(response)).toThrow('Expected redirect status (3xx) but got 404');
  });

  test('throws when expected status does not match', () => {
    const response = new Response(null, {
      status: 301,
      headers: { Location: '/new-location' },
    });

    expect(() => assertRedirect(response, undefined, { status: 302 }))
      .toThrow('Expected redirect status 302 but got 301');
  });

  test('throws when expected status does not match with custom message', () => {
    const response = new Response(null, {
      status: 301,
      headers: { Location: '/new-location' },
    });

    expect(() => assertRedirect(response, undefined, { status: 302, message: 'Wrong status' }))
      .toThrow('Wrong status');
  });

  test('throws when location header is missing but expected', () => {
    const response = new Response(null, { status: 302 });

    expect(() => assertRedirect(response, '/expected'))
      .toThrow('Expected Location header but it was not set');
  });

  test('throws when location header is missing with custom message', () => {
    const response = new Response(null, { status: 302 });

    expect(() => assertRedirect(response, '/expected', { message: 'No location' }))
      .toThrow('No location');
  });

  test('throws when location does not match expected', () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: '/actual' },
    });

    expect(() => assertRedirect(response, '/expected'))
      .toThrow('Expected redirect to "/expected" but got "/actual"');
  });

  test('throws when location does not match with custom message', () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: '/actual' },
    });

    expect(() => assertRedirect(response, '/expected', { message: 'Wrong location' }))
      .toThrow('Wrong location');
  });

  test('passes with 301 permanent redirect', () => {
    const response = new Response(null, {
      status: 301,
      headers: { Location: '/new-url' },
    });

    expect(() => assertRedirect(response, '/new-url')).not.toThrow();
  });

  test('passes with 303 See Other', () => {
    const response = new Response(null, {
      status: 303,
      headers: { Location: '/other' },
    });

    expect(() => assertRedirect(response, '/other')).not.toThrow();
  });

  test('passes with 307 Temporary Redirect', () => {
    const response = new Response(null, {
      status: 307,
      headers: { Location: '/temp' },
    });

    expect(() => assertRedirect(response, '/temp')).not.toThrow();
  });
});

describe('assertJson', () => {
  test('passes when data matches expected object', async () => {
    const data = { id: 1, name: 'Test' };

    await assertJson(data, { id: 1, name: 'Test' });
    // If we get here without throwing, the assertion passed
    expect(true).toBe(true);
  });

  test('passes when data is a partial match', async () => {
    const data = { id: 1, name: 'Test', extra: 'field' };

    await assertJson(data, { id: 1 });
    expect(true).toBe(true);
  });

  test('passes when Response contains matching JSON', async () => {
    const response = new Response(JSON.stringify({ id: 1, name: 'Test' }), {
      headers: { 'Content-Type': 'application/json' },
    });

    await assertJson(response, { id: 1 });
    expect(true).toBe(true);
  });

  test('throws when Response JSON does not match', async () => {
    const response = new Response(JSON.stringify({ id: 2 }), {
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(assertJson(response, { id: 1 }))
      .rejects.toThrow('Expected "id" to be 1 but got 2');
  });

  test('throws when Response is not valid JSON', async () => {
    const response = new Response('not json');

    await expect(assertJson(response, { id: 1 }))
      .rejects.toThrow('Failed to parse response body as JSON');
  });

  test('throws when Response is not valid JSON with custom message', async () => {
    const response = new Response('not json');

    await expect(assertJson(response, { id: 1 }, { message: 'Bad JSON' }))
      .rejects.toThrow('Bad JSON');
  });

  test('throws when data field does not match', async () => {
    const data = { id: 1, name: 'Actual' };

    await expect(assertJson(data, { name: 'Expected' }))
      .rejects.toThrow('Expected "name" to be "Expected" but got "Actual"');
  });

  test('throws when data field does not match with custom message', async () => {
    const data = { id: 1, name: 'Actual' };

    await expect(assertJson(data, { name: 'Expected' }, { message: 'Name mismatch' }))
      .rejects.toThrow('Name mismatch');
  });

  test('passes when nested objects match', async () => {
    const data = { user: { id: 1, profile: { name: 'Test' } } };

    await assertJson(data, { user: { id: 1, profile: { name: 'Test' } } });
    expect(true).toBe(true);
  });

  test('throws when nested objects do not match', async () => {
    const data = { user: { id: 1 } };

    await expect(assertJson(data, { user: { id: 2 } }))
      .rejects.toThrow('Expected "user" to be {"id":2} but got {"id":1}');
  });

  test('passes when arrays match', async () => {
    const data = { tags: ['a', 'b', 'c'] };

    await assertJson(data, { tags: ['a', 'b', 'c'] });
    expect(true).toBe(true);
  });

  test('throws when arrays do not match', async () => {
    const data = { tags: ['a', 'b'] };

    await expect(assertJson(data, { tags: ['a', 'b', 'c'] }))
      .rejects.toThrow('Expected "tags" to be ["a","b","c"] but got ["a","b"]');
  });
});

describe('assertStatus', () => {
  test('passes when status matches', () => {
    const response = new Response('OK', { status: 200 });

    expect(() => assertStatus(response, 200)).not.toThrow();
  });

  test('passes when status is in array', () => {
    const response = new Response('OK', { status: 201 });

    expect(() => assertStatus(response, [200, 201, 204])).not.toThrow();
  });

  test('throws for null response', () => {
    expect(() => assertStatus(null, 200)).toThrow('Expected a response but got null');
  });

  test('throws for null response with custom message', () => {
    expect(() => assertStatus(null, 200, { message: 'No response' }))
      .toThrow('No response');
  });

  test('throws when status does not match', () => {
    const response = new Response('Not Found', { status: 404 });

    expect(() => assertStatus(response, 200))
      .toThrow('Expected status 200 but got 404');
  });

  test('throws when status does not match with custom message', () => {
    const response = new Response('Not Found', { status: 404 });

    expect(() => assertStatus(response, 200, { message: 'Wrong status' }))
      .toThrow('Wrong status');
  });

  test('throws when status is not in array', () => {
    const response = new Response('Error', { status: 500 });

    expect(() => assertStatus(response, [200, 201, 204]))
      .toThrow('Expected status 200 or 201 or 204 but got 500');
  });
});

describe('assertHeaders', () => {
  test('passes when headers match', () => {
    const response = new Response('OK', {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom': 'value',
      },
    });

    expect(() => assertHeaders(response, {
      'Content-Type': 'application/json',
      'X-Custom': 'value',
    })).not.toThrow();
  });

  test('passes when header matches regex', () => {
    const response = new Response('OK', {
      headers: { 'Cache-Control': 'max-age=3600, public' },
    });

    expect(() => assertHeaders(response, {
      'Cache-Control': /max-age=\d+/,
    })).not.toThrow();
  });

  test('throws for null response', () => {
    expect(() => assertHeaders(null, { 'Content-Type': 'text/plain' }))
      .toThrow('Expected a response but got null');
  });

  test('throws for null response with custom message', () => {
    expect(() => assertHeaders(null, { 'Content-Type': 'text/plain' }, { message: 'No resp' }))
      .toThrow('No resp');
  });

  test('throws when header is missing', () => {
    const response = new Response('OK');

    expect(() => assertHeaders(response, { 'X-Custom': 'value' }))
      .toThrow('Expected header "X-Custom" to be set but it was not');
  });

  test('throws when header is missing with custom message', () => {
    const response = new Response('OK');

    expect(() => assertHeaders(response, { 'X-Custom': 'value' }, { message: 'Missing header' }))
      .toThrow('Missing header');
  });

  test('throws when header value does not match', () => {
    const response = new Response('OK', {
      headers: { 'Content-Type': 'text/plain' },
    });

    expect(() => assertHeaders(response, { 'Content-Type': 'application/json' }))
      .toThrow('Expected header "Content-Type" to be "application/json" but got "text/plain"');
  });

  test('throws when header value does not match with custom message', () => {
    const response = new Response('OK', {
      headers: { 'Content-Type': 'text/plain' },
    });

    expect(() => assertHeaders(response, { 'Content-Type': 'application/json' }, { message: 'Wrong type' }))
      .toThrow('Wrong type');
  });

  test('throws when header does not match regex', () => {
    const response = new Response('OK', {
      headers: { 'Cache-Control': 'no-cache' },
    });

    expect(() => assertHeaders(response, { 'Cache-Control': /max-age=\d+/ }))
      .toThrow('Expected header "Cache-Control" to match /max-age=\\d+/ but got "no-cache"');
  });

  test('throws when header does not match regex with custom message', () => {
    const response = new Response('OK', {
      headers: { 'Cache-Control': 'no-cache' },
    });

    expect(() => assertHeaders(response, { 'Cache-Control': /max-age=\d+/ }, { message: 'Bad cache' }))
      .toThrow('Bad cache');
  });
});

describe('assertCookies', () => {
  test('throws for null response', () => {
    expect(() => assertCookies(null, { session: { exists: true } }))
      .toThrow('Expected a response but got null');
  });

  test('throws for null response with custom message', () => {
    expect(() => assertCookies(null, { session: { exists: true } }, { message: 'No cookies' }))
      .toThrow('No cookies');
  });

  test('passes when cookie exists', () => {
    const response = new Response('OK');
    // Mock getSetCookie since Response doesn't natively support it
    (response.headers as any).getSetCookie = () => ['session=abc123; HttpOnly; Secure'];

    expect(() => assertCookies(response, { session: { exists: true } }))
      .not.toThrow();
  });

  test('passes when cookie should not exist and it does not', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [];

    expect(() => assertCookies(response, { session: { exists: false } }))
      .not.toThrow();
  });

  test('throws when cookie should not exist but it does', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc123'];

    expect(() => assertCookies(response, { session: { exists: false } }))
      .toThrow('Expected cookie "session" not to be set but it was');
  });

  test('throws when cookie should not exist but it does with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc123'];

    expect(() => assertCookies(response, { session: { exists: false } }, { message: 'Cookie exists' }))
      .toThrow('Cookie exists');
  });

  test('throws when expected cookie is missing', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [];

    expect(() => assertCookies(response, { session: { exists: true } }))
      .toThrow('Expected cookie "session" to be set but it was not');
  });

  test('throws when expected cookie is missing with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [];

    expect(() => assertCookies(response, { session: { exists: true } }, { message: 'Missing cookie' }))
      .toThrow('Missing cookie');
  });

  test('passes when cookie value matches string', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['token=secret123'];

    expect(() => assertCookies(response, { token: { value: 'secret123' } }))
      .not.toThrow();
  });

  test('throws when cookie value does not match string', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['token=wrong'];

    expect(() => assertCookies(response, { token: { value: 'secret123' } }))
      .toThrow('Expected cookie "token" value to be "secret123" but got "wrong"');
  });

  test('throws when cookie value does not match string with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['token=wrong'];

    expect(() => assertCookies(response, { token: { value: 'secret123' } }, { message: 'Wrong token' }))
      .toThrow('Wrong token');
  });

  test('passes when cookie value matches regex', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc-123-xyz'];

    expect(() => assertCookies(response, { session: { value: /^[a-z]+-\d+-[a-z]+$/ } }))
      .not.toThrow();
  });

  test('throws when cookie value does not match regex', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=invalid'];

    expect(() => assertCookies(response, { session: { value: /^[a-z]+-\d+-[a-z]+$/ } }))
      .toThrow('Expected cookie "session" value to match');
  });

  test('throws when cookie value does not match regex with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=invalid'];

    expect(() => assertCookies(response, { session: { value: /^[a-z]+-\d+-[a-z]+$/ } }, { message: 'Bad format' }))
      .toThrow('Bad format');
  });

  test('passes when HttpOnly attribute matches true', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; HttpOnly'];

    expect(() => assertCookies(response, { session: { httpOnly: true } }))
      .not.toThrow();
  });

  test('throws when HttpOnly attribute does not match', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc'];

    expect(() => assertCookies(response, { session: { httpOnly: true } }))
      .toThrow('Expected cookie "session" HttpOnly to be true');
  });

  test('throws when HttpOnly attribute does not match with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc'];

    expect(() => assertCookies(response, { session: { httpOnly: true } }, { message: 'Not httponly' }))
      .toThrow('Not httponly');
  });

  test('passes when HttpOnly false and not present', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc'];

    expect(() => assertCookies(response, { session: { httpOnly: false } }))
      .not.toThrow();
  });

  test('throws when HttpOnly should be false but is present', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; HttpOnly'];

    expect(() => assertCookies(response, { session: { httpOnly: false } }))
      .toThrow('Expected cookie "session" HttpOnly to be false');
  });

  test('passes when Secure attribute matches true', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; Secure'];

    expect(() => assertCookies(response, { session: { secure: true } }))
      .not.toThrow();
  });

  test('throws when Secure attribute does not match', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc'];

    expect(() => assertCookies(response, { session: { secure: true } }))
      .toThrow('Expected cookie "session" Secure to be true');
  });

  test('throws when Secure attribute does not match with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc'];

    expect(() => assertCookies(response, { session: { secure: true } }, { message: 'Not secure' }))
      .toThrow('Not secure');
  });

  test('passes when Secure false and not present', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc'];

    expect(() => assertCookies(response, { session: { secure: false } }))
      .not.toThrow();
  });

  test('throws when Secure should be false but is present', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; Secure'];

    expect(() => assertCookies(response, { session: { secure: false } }))
      .toThrow('Expected cookie "session" Secure to be false');
  });

  test('passes when SameSite matches', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; SameSite=Strict'];

    expect(() => assertCookies(response, { session: { sameSite: 'Strict' } }))
      .not.toThrow();
  });

  test('throws when SameSite does not match', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; SameSite=Lax'];

    expect(() => assertCookies(response, { session: { sameSite: 'Strict' } }))
      .toThrow('Expected cookie "session" SameSite to be Strict');
  });

  test('throws when SameSite does not match with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; SameSite=Lax'];

    expect(() => assertCookies(response, { session: { sameSite: 'Strict' } }, { message: 'Wrong samesite' }))
      .toThrow('Wrong samesite');
  });

  test('passes when path matches', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; Path=/admin'];

    expect(() => assertCookies(response, { session: { path: '/admin' } }))
      .not.toThrow();
  });

  test('throws when path does not match', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; Path=/'];

    expect(() => assertCookies(response, { session: { path: '/admin' } }))
      .toThrow('Expected cookie "session" Path to be /admin');
  });

  test('throws when path does not match with custom message', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['session=abc; Path=/'];

    expect(() => assertCookies(response, { session: { path: '/admin' } }, { message: 'Wrong path' }))
      .toThrow('Wrong path');
  });

  test('handles cookies with = in value', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => ['data=base64==encoded'];

    expect(() => assertCookies(response, { data: { value: 'base64==encoded' } }))
      .not.toThrow();
  });

  test('handles multiple cookies', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [
      'session=abc123; HttpOnly',
      'theme=dark',
    ];

    expect(() => assertCookies(response, {
      session: { httpOnly: true },
      theme: { value: 'dark' },
    })).not.toThrow();
  });

  test('handles empty getSetCookie', () => {
    const response = new Response('OK');
    // Simulate no getSetCookie method
    (response.headers as any).getSetCookie = undefined;

    expect(() => assertCookies(response, { session: { exists: false } }))
      .not.toThrow();
  });
});

describe('assertThrows', () => {
  test('passes when function throws', async () => {
    await assertThrows(async () => {
      throw new Error('Test error');
    });
    expect(true).toBe(true);
  });

  test('throws when function does not throw', async () => {
    await expect(assertThrows(async () => {
      return 'success';
    })).rejects.toThrow('Expected function to throw but it did not');
  });

  test('throws when function does not throw with custom message', async () => {
    await expect(assertThrows(async () => {
      return 'success';
    }, {}, { message: 'Should have thrown' })).rejects.toThrow('Should have thrown');
  });

  test('passes when error message matches string', async () => {
    await assertThrows(async () => {
      throw new Error('Specific error');
    }, { message: 'Specific error' });
    expect(true).toBe(true);
  });

  test('throws when error message does not match string', async () => {
    await expect(assertThrows(async () => {
      throw new Error('Actual error');
    }, { message: 'Expected error' }))
      .rejects.toThrow('Expected error message to be "Expected error" but got "Actual error"');
  });

  test('throws when error message does not match string with custom message', async () => {
    await expect(assertThrows(async () => {
      throw new Error('Actual error');
    }, { message: 'Expected error' }, { message: 'Wrong message' }))
      .rejects.toThrow('Wrong message');
  });

  test('passes when error message matches regex', async () => {
    await assertThrows(async () => {
      throw new Error('User not found: 123');
    }, { message: /not found/i });
    expect(true).toBe(true);
  });

  test('throws when error message does not match regex', async () => {
    await expect(assertThrows(async () => {
      throw new Error('Different error');
    }, { message: /not found/i }))
      .rejects.toThrow('Expected error message to match /not found/i but got "Different error"');
  });

  test('throws when error message does not match regex with custom message', async () => {
    await expect(assertThrows(async () => {
      throw new Error('Different error');
    }, { message: /not found/i }, { message: 'Pattern mismatch' }))
      .rejects.toThrow('Pattern mismatch');
  });

  test('passes when error name matches', async () => {
    const error = new TypeError('Type error');
    await assertThrows(async () => {
      throw error;
    }, { name: 'TypeError' });
    expect(true).toBe(true);
  });

  test('throws when error name does not match', async () => {
    await expect(assertThrows(async () => {
      throw new Error('Regular error');
    }, { name: 'TypeError' }))
      .rejects.toThrow('Expected error name to be "TypeError" but got "Error"');
  });

  test('throws when error name does not match with custom message', async () => {
    await expect(assertThrows(async () => {
      throw new Error('Regular error');
    }, { name: 'TypeError' }, { message: 'Wrong type' }))
      .rejects.toThrow('Wrong type');
  });

  test('passes when error status matches', async () => {
    const error = new Error('Not found') as Error & { status: number };
    error.status = 404;
    await assertThrows(async () => {
      throw error;
    }, { status: 404 });
    expect(true).toBe(true);
  });

  test('throws when error status does not match', async () => {
    const error = new Error('Server error') as Error & { status: number };
    error.status = 500;
    await expect(assertThrows(async () => {
      throw error;
    }, { status: 404 }))
      .rejects.toThrow('Expected error status to be 404 but got 500');
  });

  test('throws when error status does not match with custom message', async () => {
    const error = new Error('Server error') as Error & { status: number };
    error.status = 500;
    await expect(assertThrows(async () => {
      throw error;
    }, { status: 404 }, { message: 'Wrong status' }))
      .rejects.toThrow('Wrong status');
  });

  test('handles non-Error throws', async () => {
    await assertThrows(async () => {
      throw 'string error';
    });
    expect(true).toBe(true);
  });

  test('handles non-Error throws with message check', async () => {
    await assertThrows(async () => {
      throw 'string error';
    }, { message: 'string error' });
    expect(true).toBe(true);
  });
});

describe('assertSchema', () => {
  test('passes when data matches schema', () => {
    const data = {
      id: 1,
      name: 'Test',
      active: true,
      tags: ['a', 'b'],
      meta: { key: 'value' },
    };

    expect(() => assertSchema(data, {
      id: 'number',
      name: 'string',
      active: 'boolean',
      tags: 'array',
      meta: 'object',
    })).not.toThrow();
  });

  test('passes when data has null value', () => {
    const data = { value: null };

    expect(() => assertSchema(data, { value: 'null' }))
      .not.toThrow();
  });

  test('passes when data has undefined value', () => {
    const data: { value?: string } = {};

    expect(() => assertSchema(data, { value: 'undefined' }))
      .not.toThrow();
  });

  test('throws when data is not an object', () => {
    expect(() => assertSchema('not an object', { id: 'string' }))
      .toThrow('Expected data to be an object');
  });

  test('throws when data is not an object with custom message', () => {
    expect(() => assertSchema('not an object', { id: 'string' }, { message: 'Not object' }))
      .toThrow('Not object');
  });

  test('throws when data is null', () => {
    expect(() => assertSchema(null, { id: 'string' }))
      .toThrow('Expected data to be an object');
  });

  test('throws when field type does not match string', () => {
    const data = { name: 123 };

    expect(() => assertSchema(data, { name: 'string' }))
      .toThrow('Expected "name" to be string but got number');
  });

  test('throws when field type does not match number', () => {
    const data = { id: '123' };

    expect(() => assertSchema(data, { id: 'number' }))
      .toThrow('Expected "id" to be number but got string');
  });

  test('throws when field type does not match boolean', () => {
    const data = { active: 'true' };

    expect(() => assertSchema(data, { active: 'boolean' }))
      .toThrow('Expected "active" to be boolean but got string');
  });

  test('throws when field type does not match array', () => {
    const data = { tags: { 0: 'a', 1: 'b' } };

    expect(() => assertSchema(data, { tags: 'array' }))
      .toThrow('Expected "tags" to be array but got object');
  });

  test('throws when field type does not match object', () => {
    const data = { meta: ['array', 'not', 'object'] };

    expect(() => assertSchema(data, { meta: 'object' }))
      .toThrow('Expected "meta" to be object but got array');
  });

  test('throws when field type does not match with custom message', () => {
    const data = { id: 'string' };

    expect(() => assertSchema(data, { id: 'number' }, { message: 'Type mismatch' }))
      .toThrow('Type mismatch');
  });

  test('passes with partial schema', () => {
    const data = { id: 1, name: 'Test', extra: 'field' };

    expect(() => assertSchema(data, { id: 'number' }))
      .not.toThrow();
  });
});
