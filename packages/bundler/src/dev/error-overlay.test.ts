import { describe, expect, test } from 'bun:test';
import {
  parseError,
  generateErrorOverlayHTML,
  createErrorResponse,
  createErrorJSON,
  ERROR_OVERLAY_SCRIPT,
} from './error-overlay';

describe('@areo/bundler - Error Overlay', () => {
  describe('parseError', () => {
    test('parses string error', () => {
      const info = parseError('Test error message');

      expect(info.message).toBe('Test error message');
      expect(info.type).toBe('runtime');
      expect(info.stack).toBeUndefined();
    });

    test('parses Error object', () => {
      const error = new Error('Test error');
      const info = parseError(error);

      expect(info.message).toBe('Test error');
      expect(info.type).toBe('runtime');
      expect(info.stack).toBeDefined();
    });

    test('extracts source location from stack', () => {
      const error = new Error('Test');
      error.stack = `Error: Test
    at someFunction (/path/to/file.ts:10:5)
    at anotherFunction (/path/to/other.ts:20:10)`;

      const info = parseError(error);

      expect(info.source).toBeDefined();
      expect(info.source?.file).toBe('/path/to/file.ts');
      expect(info.source?.line).toBe(10);
      expect(info.source?.column).toBe(5);
    });

    test('detects SyntaxError type', () => {
      const error = new SyntaxError('Unexpected token');
      const info = parseError(error);

      expect(info.type).toBe('syntax');
    });

    test('detects TypeError type', () => {
      const error = new TypeError('Cannot read property');
      const info = parseError(error);

      expect(info.type).toBe('type');
    });

    test('handles errors without stack', () => {
      const error = new Error('No stack');
      error.stack = undefined;

      const info = parseError(error);

      expect(info.source).toBeUndefined();
    });

    test('handles non-matching stack format', () => {
      const error = new Error('Test');
      error.stack = 'Custom stack format without location';

      const info = parseError(error);

      expect(info.source).toBeUndefined();
    });
  });

  describe('generateErrorOverlayHTML', () => {
    test('generates valid HTML', () => {
      const html = generateErrorOverlayHTML({
        message: 'Test error',
        type: 'runtime',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
    });

    test('includes error message', () => {
      const html = generateErrorOverlayHTML({
        message: 'Test error message',
        type: 'runtime',
      });

      expect(html).toContain('Test error message');
    });

    test('includes type badge', () => {
      const html = generateErrorOverlayHTML({
        message: 'Test',
        type: 'syntax',
      });

      expect(html).toContain('Syntax Error');
    });

    test('includes source location when provided', () => {
      const html = generateErrorOverlayHTML({
        message: 'Test',
        type: 'runtime',
        source: {
          file: '/path/to/file.ts',
          line: 42,
          column: 10,
        },
      });

      expect(html).toContain('/path/to/file.ts');
      expect(html).toContain('42');
      expect(html).toContain('10');
    });

    test('includes stack trace when provided', () => {
      const html = generateErrorOverlayHTML({
        message: 'Test',
        type: 'runtime',
        stack: 'Error: Test\n  at function (file.ts:1:1)',
      });

      expect(html).toContain('Stack Trace');
      expect(html).toContain('details');
    });

    test('escapes HTML in message', () => {
      const html = generateErrorOverlayHTML({
        message: '<script>alert("xss")</script>',
        type: 'runtime',
      });

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });

    test('includes fix instruction', () => {
      const html = generateErrorOverlayHTML({
        message: 'Test',
        type: 'runtime',
      });

      expect(html).toContain('Fix the error');
    });

    test('uses different colors for error types', () => {
      const runtimeHtml = generateErrorOverlayHTML({
        message: 'Test',
        type: 'runtime',
      });
      const buildHtml = generateErrorOverlayHTML({
        message: 'Test',
        type: 'build',
      });

      expect(runtimeHtml).toContain('#ff5555');
      expect(buildHtml).toContain('#ffaa00');
    });
  });

  describe('createErrorResponse', () => {
    test('creates Response with HTML content', () => {
      const response = createErrorResponse('Test error');

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    });

    test('accepts Error object', async () => {
      const error = new Error('Test error');
      const response = createErrorResponse(error);

      const html = await response.text();
      expect(html).toContain('Test error');
    });

    test('accepts string error', async () => {
      const response = createErrorResponse('String error');

      const html = await response.text();
      expect(html).toContain('String error');
    });
  });

  describe('createErrorJSON', () => {
    test('creates Response with JSON content', () => {
      const response = createErrorJSON('Test error');

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(500);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    test('returns parsed error info', async () => {
      const response = createErrorJSON('Test error');
      const json = await response.json();

      expect(json.message).toBe('Test error');
      expect(json.type).toBe('runtime');
    });

    test('includes stack for Error objects', async () => {
      const error = new Error('Test');
      const response = createErrorJSON(error);
      const json = await response.json();

      expect(json.stack).toBeDefined();
    });
  });

  describe('ERROR_OVERLAY_SCRIPT', () => {
    test('is a script tag', () => {
      expect(ERROR_OVERLAY_SCRIPT).toContain('<script>');
      expect(ERROR_OVERLAY_SCRIPT).toContain('</script>');
    });

    test('handles window error event', () => {
      expect(ERROR_OVERLAY_SCRIPT).toContain("addEventListener('error'");
    });

    test('handles unhandled rejection', () => {
      expect(ERROR_OVERLAY_SCRIPT).toContain('unhandledrejection');
    });

    test('creates overlay element', () => {
      expect(ERROR_OVERLAY_SCRIPT).toContain('areo-error-overlay');
    });

    test('has close button', () => {
      expect(ERROR_OVERLAY_SCRIPT).toContain('Close');
      expect(ERROR_OVERLAY_SCRIPT).toContain('Esc');
    });

    test('handles escape key', () => {
      expect(ERROR_OVERLAY_SCRIPT).toContain('Escape');
    });

    test('escapes HTML in error display', () => {
      expect(ERROR_OVERLAY_SCRIPT).toContain('escapeHtml');
    });
  });
});
