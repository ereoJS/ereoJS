import { describe, it, expect } from 'bun:test';
import { createTracer } from '../tracer';
import { generateViewerHTML, createViewerHandler, exportTracesHTML } from '../viewer';

describe('generateViewerHTML', () => {
  it('generates valid HTML document', () => {
    const html = generateViewerHTML([]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
    expect(html).toContain('Ereo Trace Viewer');
  });

  it('includes trace count badge', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /', 'request', { method: 'GET', pathname: '/' });
    root.end();
    const root2 = tracer.startTrace('POST /api', 'request', { method: 'POST', pathname: '/api' });
    root2.end();

    const html = generateViewerHTML(tracer.getTraces());
    expect(html).toContain('2 traces');
  });

  it('embeds trace data as JSON', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /test', 'request', {
      method: 'GET',
      pathname: '/test',
    });
    root.setAttribute('http.status_code', 200);
    root.end();

    const html = generateViewerHTML(tracer.getTraces());
    expect(html).toContain('const TRACES =');
    expect(html).toContain('/test');
  });

  it('includes filter controls', () => {
    const html = generateViewerHTML([]);
    expect(html).toContain('filter-method');
    expect(html).toContain('filter-path');
    expect(html).toContain('filter-status');
  });

  it('includes WebSocket live update code', () => {
    const html = generateViewerHTML([]);
    expect(html).toContain('/__ereo/trace-ws');
    expect(html).toContain('trace:end');
  });

  it('escapes script tags in embedded trace data', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /<script>alert(1)</script>', 'request', {
      method: 'GET',
      pathname: '/<script>alert(1)</script>',
    });
    root.end();

    const html = generateViewerHTML(tracer.getTraces());
    // Extract just the TRACES JSON assignment to check the data portion
    const tracesMatch = html.match(/const TRACES = (.+?);/s);
    expect(tracesMatch).toBeTruthy();
    // The embedded JSON data should not contain raw < or > (escaped via \u003c/\u003e)
    expect(tracesMatch![1]).not.toContain('</script>');
    expect(tracesMatch![1]).not.toContain('<script>');
    // It should contain the Unicode-escaped version
    expect(tracesMatch![1]).toContain('\\u003c');
    expect(tracesMatch![1]).toContain('\\u003e');
    // The esc() function is present for runtime XSS protection
    expect(html).toContain('esc(');
  });

  it('handles empty traces', () => {
    const html = generateViewerHTML([]);
    expect(html).toContain('No traces recorded');
  });

  it('includes span layer CSS classes', () => {
    const html = generateViewerHTML([]);
    expect(html).toContain('.layer-request');
    expect(html).toContain('.layer-routing');
    expect(html).toContain('.layer-data');
    expect(html).toContain('.layer-database');
    expect(html).toContain('.layer-auth');
    expect(html).toContain('.layer-errors');
  });
});

describe('createViewerHandler', () => {
  it('returns an HTTP handler that serves HTML', () => {
    const tracer = createTracer();
    const handler = createViewerHandler(tracer);

    const response = handler(new Request('http://localhost/__ereo/traces'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
  });

  it('includes current traces in response', async () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /api', 'request', { method: 'GET', pathname: '/api' });
    root.end();

    const handler = createViewerHandler(tracer);
    const response = handler(new Request('http://localhost/__ereo/traces'));
    const body = await response.text();

    expect(body).toContain('/api');
    expect(body).toContain('1 traces');
  });
});

describe('exportTracesHTML', () => {
  it('exports HTML string with traces', () => {
    const tracer = createTracer();
    const root = tracer.startTrace('GET /export', 'request', { method: 'GET', pathname: '/export' });
    root.end();

    const html = exportTracesHTML(tracer);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('/export');
  });

  it('exports empty HTML when no traces', () => {
    const tracer = createTracer();
    const html = exportTracesHTML(tracer);
    expect(html).toContain('0 traces');
  });
});
