/**
 * @ereo/trace/client - Browser entry
 *
 * Reads trace ID from server response, creates client-side spans,
 * and sends them back to the server via WebSocket.
 *
 * This module is designed for browser environments only.
 */

import type { SpanData, SpanEvent, SpanId, SpanLayer, SpanStatus, TraceId } from './types';

/** Generate a random hex string of exactly `len` characters */
function randomHex(len: number): string {
  let s = '';
  while (s.length < len) {
    s += Math.random().toString(16).slice(2);
  }
  return s.slice(0, len);
}

/** Generate a simple span ID in the browser */
function browserSpanId(): SpanId {
  return randomHex(16);
}

/** Client span for browser-side tracing */
class ClientSpan {
  readonly id: SpanId;
  readonly traceId: TraceId;
  readonly parentId: SpanId | null;
  private name: string;
  private layer: SpanLayer;
  private startTime: number;
  private endTime = 0;
  private attributes: Record<string, string | number | boolean> = {};
  private status: SpanStatus = 'ok';
  private events: SpanEvent[] = [];
  private children: SpanId[] = [];
  private ended = false;

  constructor(traceId: TraceId, parentId: SpanId | null, name: string, layer: SpanLayer) {
    this.id = browserSpanId();
    this.traceId = traceId;
    this.parentId = parentId;
    this.name = name;
    this.layer = layer;
    this.startTime = performance.now();
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (!this.ended) this.attributes[key] = value;
  }

  event(name: string, attrs?: Record<string, string | number | boolean>): void {
    if (!this.ended) this.events.push({ name, time: performance.now(), attributes: attrs });
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.endTime = performance.now();
  }

  error(err: unknown): void {
    if (this.ended) return;
    this.status = 'error';
    this.attributes['error.message'] = err instanceof Error ? err.message : String(err);
  }

  addChild(childId: SpanId): void {
    this.children.push(childId);
  }

  toData(): SpanData {
    return {
      id: this.id,
      traceId: this.traceId,
      parentId: this.parentId,
      name: this.name,
      layer: this.layer,
      status: this.status,
      startTime: this.startTime,
      endTime: this.endTime || performance.now(),
      duration: (this.endTime || performance.now()) - this.startTime,
      attributes: { ...this.attributes },
      events: [...this.events],
      children: [...this.children],
    };
  }
}

/** Client trace manager */
class ClientTracer {
  private ws: WebSocket | null = null;
  private pendingSpans: SpanData[] = [];
  private currentTraceId: TraceId | null = null;
  private connected = false;

  /** Initialize client tracing */
  init(): void {
    if (typeof window === 'undefined') return;

    // Read trace ID injected by server
    this.currentTraceId = (window as any).__EREO_TRACE_ID__ || null;

    // Connect to trace WebSocket
    this.connect();

    // Intercept fetch to propagate trace IDs
    this.interceptFetch();
  }

  private connect(): void {
    if (typeof WebSocket === 'undefined') return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/__ereo/trace-ws`;

    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.connected = true;
        this.flushPending();
      };
      this.ws.onclose = () => {
        this.connected = false;
        this.ws = null;
      };
      this.ws.onerror = () => {
        // Silently fail — tracing is optional
      };
    } catch {
      // WebSocket not available
    }
  }

  private interceptFetch(): void {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch.bind(window);
    const self = this;

    const patchedFetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      if (self.currentTraceId) {
        const headers = new Headers(init?.headers);
        if (!headers.has('X-Ereo-Trace-Id')) {
          headers.set('X-Ereo-Trace-Id', self.currentTraceId);
        }
        init = { ...init, headers };
      }

      return originalFetch(input, init).then((response: Response) => {
        // Update trace ID from server response
        const newTraceId = response.headers.get('X-Ereo-Trace-Id');
        if (newTraceId) {
          self.currentTraceId = newTraceId;
        }
        return response;
      });
    };

    // Copy any extra properties from the original fetch (e.g., preconnect)
    Object.assign(patchedFetch, originalFetch);
    (window as any).fetch = patchedFetch;
  }

  /** Create a client-side span */
  startSpan(name: string, layer: SpanLayer, parentId?: SpanId): ClientSpan {
    const traceId = this.currentTraceId || browserSpanId() + browserSpanId();
    return new ClientSpan(traceId, parentId || null, name, layer);
  }

  /** Submit a completed span to the server */
  submitSpan(span: ClientSpan): void {
    const data = span.toData();
    this.pendingSpans.push(data);

    if (this.connected) {
      this.flushPending();
    }
  }

  /** Set the current trace ID (e.g., after SPA navigation) */
  setTraceId(traceId: TraceId): void {
    this.currentTraceId = traceId;
  }

  /** Get current trace ID */
  getTraceId(): TraceId | null {
    return this.currentTraceId;
  }

  private flushPending(): void {
    if (!this.ws || !this.connected || this.pendingSpans.length === 0) return;

    const traceGroups = new Map<TraceId, SpanData[]>();
    for (const span of this.pendingSpans) {
      const group = traceGroups.get(span.traceId) || [];
      group.push(span);
      traceGroups.set(span.traceId, group);
    }

    for (const [traceId, spans] of traceGroups) {
      try {
        this.ws.send(JSON.stringify({
          type: 'client:spans',
          traceId,
          spans,
        }));
      } catch {
        // Send failed, keep pending
        return;
      }
    }

    this.pendingSpans = [];
  }

  /** Disconnect and clean up */
  destroy(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.pendingSpans = [];
  }
}

/** Singleton client tracer */
let clientTracer: ClientTracer | null = null;

/** Get or create the client tracer */
export function getClientTracer(): ClientTracer {
  if (!clientTracer) {
    clientTracer = new ClientTracer();
  }
  return clientTracer;
}

/** Initialize client-side tracing */
export function initClientTracing(): void {
  getClientTracer().init();
}

export { ClientTracer, ClientSpan };
