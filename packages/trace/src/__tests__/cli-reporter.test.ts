import { describe, it, expect, spyOn } from 'bun:test';
import { createTracer } from '../tracer';
import { createCLIReporter } from '../cli-reporter';

describe('CLIReporter', () => {
  it('prints trace output on trace:end', () => {
    const tracer = createTracer();
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    const unsub = createCLIReporter(tracer, { colors: false });

    const root = tracer.startTrace('GET /api/users', 'request', {
      method: 'GET',
      pathname: '/api/users',
    });
    root.setAttribute('http.status_code', 200);

    const routeSpan = root.child('route.match', 'routing');
    routeSpan.setAttribute('route.pattern', '/api/users');
    routeSpan.end();

    root.end();

    // Should have printed something
    expect(logs.length).toBeGreaterThan(0);
    // Should contain the method and path
    const output = logs.join('\n');
    expect(output).toContain('GET');
    expect(output).toContain('/api/users');

    unsub();
    spy.mockRestore();
  });

  it('unsubscribe stops printing', () => {
    const tracer = createTracer();
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    const unsub = createCLIReporter(tracer, { colors: false });
    unsub();

    const root = tracer.startTrace('GET /', 'request');
    root.end();

    expect(logs.length).toBe(0);

    spy.mockRestore();
  });

  it('filters by layer', () => {
    const tracer = createTracer();
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    const unsub = createCLIReporter(tracer, { colors: false, layers: ['routing'] });

    const root = tracer.startTrace('GET /test', 'request', { method: 'GET', pathname: '/test' });
    const routeSpan = root.child('route.match', 'routing');
    routeSpan.setAttribute('route.pattern', '/test');
    routeSpan.end();
    const dataSpan = root.child('loader:users', 'data');
    dataSpan.end();
    root.end();

    const output = logs.join('\n');
    // routing span should appear
    expect(output).toContain('route.match');
    // data span should NOT appear since we filtered to routing only
    expect(output).not.toContain('loader:users');

    unsub();
    spy.mockRestore();
  });

  it('filters by minDuration', () => {
    const tracer = createTracer();
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    // Very high minDuration - should filter out all near-instant child spans
    const unsub = createCLIReporter(tracer, { colors: false, minDuration: 100000 });

    const root = tracer.startTrace('GET /', 'request', { method: 'GET', pathname: '/' });
    const child = root.child('fast-child', 'routing');
    child.end();
    root.end();

    const output = logs.join('\n');
    // The header line should still print (root is always printed)
    expect(output).toContain('GET');
    // But the fast child should be filtered out
    expect(output).not.toContain('fast-child');

    unsub();
    spy.mockRestore();
  });

  it('renders nested tree with depth', () => {
    const tracer = createTracer();
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    const unsub = createCLIReporter(tracer, { colors: false });

    const root = tracer.startTrace('GET /deep', 'request', { method: 'GET', pathname: '/deep' });
    const data = root.child('data', 'data');
    const db = data.child('db.query', 'database');
    db.end();
    data.end();
    root.end();

    const output = logs.join('\n');
    // Should have the tree connectors at different depths
    expect(output).toContain('data');
    expect(output).toContain('db.query');

    unsub();
    spy.mockRestore();
  });

  it('shows error spans with error info', () => {
    const tracer = createTracer();
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    const unsub = createCLIReporter(tracer, { colors: false });

    const root = tracer.startTrace('GET /fail', 'request', { method: 'GET', pathname: '/fail' });
    const child = root.child('broken-loader', 'data');
    child.error(new Error('Connection refused'));
    child.end();
    root.end();

    const output = logs.join('\n');
    expect(output).toContain('broken-loader');
    expect(output).toContain('Connection refused');

    unsub();
    spy.mockRestore();
  });

  it('updates status code from root span attribute', () => {
    const tracer = createTracer();
    const logs: string[] = [];
    const spy = spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.join(' '));
    });

    const unsub = createCLIReporter(tracer, { colors: false });

    const root = tracer.startTrace('GET /api', 'request', { method: 'GET', pathname: '/api' });
    root.setAttribute('http.status_code', 404);
    root.end();

    const output = logs.join('\n');
    expect(output).toContain('404');

    unsub();
    spy.mockRestore();
  });
});
