/**
 * @ereo/testing - Request Tests
 */

import { describe, expect, test } from 'bun:test';
import {
  createMockRequest,
  createFormRequest,
  createMockFormData,
  createMockHeaders,
  parseJsonResponse,
  parseTextResponse,
  createMockFile,
  extractCookies,
} from './request';

describe('createMockRequest', () => {
  test('creates basic GET request', () => {
    const request = createMockRequest({ url: '/api/test' });

    expect(request.method).toBe('GET');
    expect(request.url).toContain('/api/test');
  });

  test('creates request with string URL only', () => {
    const request = createMockRequest('/api/simple');

    expect(request.method).toBe('GET');
    expect(request.url).toContain('/api/simple');
  });

  test('creates request with string URL and options', () => {
    const request = createMockRequest('/api/data', { method: 'POST' });

    expect(request.method).toBe('POST');
    expect(request.url).toContain('/api/data');
  });

  test('creates request with custom method', () => {
    const request = createMockRequest({ url: '/api/data', method: 'POST' });

    expect(request.method).toBe('POST');
  });

  test('creates request with headers', () => {
    const request = createMockRequest({
      url: '/api/test',
      headers: {
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value',
      },
    });

    expect(request.headers.get('Authorization')).toBe('Bearer token123');
    expect(request.headers.get('X-Custom-Header')).toBe('custom-value');
  });

  test('creates request with search params (single values)', () => {
    const request = createMockRequest({
      url: '/api/search',
      searchParams: { q: 'test', page: '1' },
    });

    const url = new URL(request.url);
    expect(url.searchParams.get('q')).toBe('test');
    expect(url.searchParams.get('page')).toBe('1');
  });

  test('creates request with search params (array values)', () => {
    const request = createMockRequest({
      url: '/api/filter',
      searchParams: { tags: ['a', 'b', 'c'] },
    });

    const url = new URL(request.url);
    expect(url.searchParams.getAll('tags')).toEqual(['a', 'b', 'c']);
  });

  test('creates request with form data', async () => {
    const request = createMockRequest({
      url: '/api/submit',
      method: 'POST',
      formData: {
        name: 'Test User',
        email: 'test@example.com',
      },
    });

    const formData = await request.formData();
    expect(formData.get('name')).toBe('Test User');
    expect(formData.get('email')).toBe('test@example.com');
  });

  test('creates request with JSON body (object)', async () => {
    const request = createMockRequest({
      url: '/api/data',
      method: 'POST',
      body: { key: 'value', nested: { data: true } },
    });

    const body = await request.json();
    expect(body).toEqual({ key: 'value', nested: { data: true } });
    expect(request.headers.get('Content-Type')).toBe('application/json');
  });

  test('does not override existing Content-Type for body', async () => {
    const request = createMockRequest({
      url: '/api/data',
      method: 'POST',
      headers: { 'Content-Type': 'application/custom+json' },
      body: { key: 'value' },
    });

    expect(request.headers.get('Content-Type')).toBe('application/custom+json');
  });

  test('creates request with raw body', async () => {
    const request = createMockRequest({
      url: '/api/raw',
      method: 'POST',
      body: 'raw string body',
    });

    const text = await request.text();
    expect(text).toBe('raw string body');
  });

  test('creates request with Blob body', async () => {
    const blob = new Blob(['blob content'], { type: 'text/plain' });
    const request = createMockRequest({
      url: '/api/blob',
      method: 'POST',
      body: blob,
    });

    const text = await request.text();
    expect(text).toBe('blob content');
  });

  test('creates request with FormData body', async () => {
    const fd = new FormData();
    fd.append('field', 'value');

    const request = createMockRequest({
      url: '/api/form',
      method: 'POST',
      body: fd,
    });

    const formData = await request.formData();
    expect(formData.get('field')).toBe('value');
  });

  test('creates request with cookies', () => {
    const request = createMockRequest({
      url: '/api/test',
      cookies: {
        session: 'abc123',
        theme: 'dark',
      },
    });

    const cookie = request.headers.get('Cookie');
    expect(cookie).toContain('session=abc123');
    expect(cookie).toContain('theme=dark');
  });

  test('handles absolute URLs', () => {
    const request = createMockRequest({
      url: 'https://api.example.com/endpoint',
    });

    expect(request.url).toBe('https://api.example.com/endpoint');
  });

  test('adds localhost base URL for relative paths', () => {
    const request = createMockRequest({ url: '/relative/path' });

    expect(request.url).toBe('http://localhost:3000/relative/path');
  });

  test('creates request with default options', () => {
    const request = createMockRequest();

    expect(request.method).toBe('GET');
    expect(request.url).toBe('http://localhost:3000/');
  });

  test('handles undefined options', () => {
    const request = createMockRequest(undefined);

    expect(request.method).toBe('GET');
    expect(request.url).toBe('http://localhost:3000/');
  });

  test('handles null-ish url parameter with options', () => {
    const request = createMockRequest(undefined, { method: 'DELETE' });

    expect(request.method).toBe('DELETE');
  });
});

describe('createFormRequest', () => {
  test('creates POST request with form data', async () => {
    const request = createFormRequest('/api/login', {
      email: 'test@example.com',
      password: 'secret',
    });

    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');

    const text = await request.text();
    expect(text).toContain('email=test%40example.com');
    expect(text).toContain('password=secret');
  });

  test('handles absolute URLs', () => {
    const request = createFormRequest('https://api.example.com/login', {
      username: 'test',
    });

    expect(request.url).toBe('https://api.example.com/login');
  });

  test('adds localhost base URL for relative paths', () => {
    const request = createFormRequest('/api/submit', { key: 'value' });

    expect(request.url).toBe('http://localhost:3000/api/submit');
  });

  test('skips non-string values (Blob)', async () => {
    const blob = new Blob(['test']);
    const request = createFormRequest('/api/upload', {
      name: 'test',
      file: blob,
    } as Record<string, string | Blob>);

    const text = await request.text();
    expect(text).toContain('name=test');
    expect(text).not.toContain('file=');
  });

  test('encodes special characters', async () => {
    const request = createFormRequest('/api/submit', {
      message: 'Hello & Goodbye',
      query: 'a=b&c=d',
    });

    const text = await request.text();
    expect(text).toContain('message=Hello+%26+Goodbye');
    expect(text).toContain('query=a%3Db%26c%3Dd');
  });
});

describe('createMockFormData', () => {
  test('creates FormData with string values', () => {
    const formData = createMockFormData({
      name: 'Test',
      email: 'test@example.com',
    });

    expect(formData.get('name')).toBe('Test');
    expect(formData.get('email')).toBe('test@example.com');
  });

  test('creates FormData with Blob values', () => {
    const blob = new Blob(['content'], { type: 'text/plain' });
    const formData = createMockFormData({
      file: blob,
    });

    expect(formData.get('file')).toBeInstanceOf(Blob);
  });

  test('creates FormData with File values', () => {
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    const formData = createMockFormData({
      upload: file,
    });

    const uploaded = formData.get('upload') as File;
    expect(uploaded.name).toBe('test.txt');
  });

  test('handles mixed values', () => {
    const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
    const formData = createMockFormData({
      title: 'Document',
      description: 'A PDF file',
      document: file,
    });

    expect(formData.get('title')).toBe('Document');
    expect(formData.get('description')).toBe('A PDF file');
    expect((formData.get('document') as File).name).toBe('doc.pdf');
  });
});

describe('createMockHeaders', () => {
  test('creates Headers from object', () => {
    const headers = createMockHeaders({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token',
    });

    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer token');
  });

  test('creates empty Headers from empty object', () => {
    const headers = createMockHeaders({});

    expect([...headers.entries()]).toHaveLength(0);
  });

  test('handles case-insensitive header names', () => {
    const headers = createMockHeaders({
      'content-type': 'text/plain',
    });

    expect(headers.get('Content-Type')).toBe('text/plain');
    expect(headers.get('CONTENT-TYPE')).toBe('text/plain');
  });
});

describe('parseJsonResponse', () => {
  test('parses JSON from response', async () => {
    const response = new Response(JSON.stringify({ key: 'value' }), {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await parseJsonResponse(response);

    expect(data).toEqual({ key: 'value' });
  });

  test('parses complex JSON', async () => {
    const response = new Response(JSON.stringify({
      items: [1, 2, 3],
      nested: { deep: { value: true } },
    }));

    const data = await parseJsonResponse<{
      items: number[];
      nested: { deep: { value: boolean } };
    }>(response);

    expect(data.items).toEqual([1, 2, 3]);
    expect(data.nested.deep.value).toBe(true);
  });

  test('throws on invalid JSON', async () => {
    const response = new Response('not valid json');

    await expect(parseJsonResponse(response)).rejects.toThrow('Failed to parse JSON response');
  });

  test('includes truncated body in error', async () => {
    const response = new Response('invalid json content here');

    await expect(parseJsonResponse(response)).rejects.toThrow('invalid json content here');
  });

  test('handles empty response', async () => {
    const response = new Response('');

    await expect(parseJsonResponse(response)).rejects.toThrow('Failed to parse JSON response');
  });
});

describe('parseTextResponse', () => {
  test('parses text from response', async () => {
    const response = new Response('Hello World');

    const text = await parseTextResponse(response);

    expect(text).toBe('Hello World');
  });

  test('handles empty response', async () => {
    const response = new Response('');

    const text = await parseTextResponse(response);

    expect(text).toBe('');
  });

  test('handles unicode text', async () => {
    const response = new Response('Hello \u4e16\u754c');

    const text = await parseTextResponse(response);

    expect(text).toBe('Hello \u4e16\u754c');
  });
});

describe('createMockFile', () => {
  test('creates File with string content', () => {
    const file = createMockFile('test.txt', 'Hello World', 'text/plain');

    expect(file.name).toBe('test.txt');
    expect(file.type).toContain('text/plain');
    expect(file.size).toBe(11);
  });

  test('creates File with Blob content', () => {
    const blob = new Blob(['Blob content'], { type: 'text/plain' });
    const file = createMockFile('from-blob.txt', blob, 'text/plain');

    expect(file.name).toBe('from-blob.txt');
    expect(file.size).toBe(12); // 'Blob content' length
  });

  test('uses default type', () => {
    const file = createMockFile('data.bin', 'binary data');

    expect(file.type).toBe('application/octet-stream');
  });

  test('creates file with various MIME types', () => {
    const png = createMockFile('image.png', 'PNG data', 'image/png');
    const pdf = createMockFile('document.pdf', 'PDF data', 'application/pdf');
    const json = createMockFile('data.json', '{}', 'application/json');

    expect(png.type).toContain('image/png');
    expect(pdf.type).toContain('application/pdf');
    expect(json.type).toContain('application/json');
  });
});

describe('extractCookies', () => {
  test('extracts cookies from Set-Cookie headers', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [
      'session=abc123; HttpOnly',
      'theme=dark; Path=/',
    ];

    const cookies = extractCookies(response);

    expect(cookies).toEqual({
      session: 'abc123',
      theme: 'dark',
    });
  });

  test('handles cookies with complex values', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [
      'data=base64==encoded; HttpOnly',
    ];

    const cookies = extractCookies(response);

    expect(cookies.data).toBe('base64');
  });

  test('handles empty Set-Cookie', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [];

    const cookies = extractCookies(response);

    expect(cookies).toEqual({});
  });

  test('handles missing getSetCookie method', () => {
    const response = new Response('OK');
    // Don't add getSetCookie

    const cookies = extractCookies(response);

    expect(cookies).toEqual({});
  });

  test('handles cookies with spaces', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [
      '  session  =  value  ; HttpOnly',
    ];

    const cookies = extractCookies(response);

    expect(cookies['session']).toBe('value');
  });

  test('handles cookie with empty value', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [
      'empty=; HttpOnly',
    ];

    const cookies = extractCookies(response);

    expect(cookies.empty).toBe('');
  });

  test('handles multiple cookies', () => {
    const response = new Response('OK');
    (response.headers as any).getSetCookie = () => [
      'a=1',
      'b=2',
      'c=3',
      'd=4',
      'e=5',
    ];

    const cookies = extractCookies(response);

    expect(Object.keys(cookies)).toHaveLength(5);
    expect(cookies.a).toBe('1');
    expect(cookies.e).toBe('5');
  });
});
