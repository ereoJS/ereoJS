/**
 * @ereo/trace - WebSocket Transport
 *
 * WebSocket server at /__ereo/trace-ws for streaming trace data
 * to the browser DevTools panel and standalone viewer.
 */

import type { Tracer, TraceStreamEvent, TraceData, SpanData } from './types';

/** Serializable version of TraceData (Map -> Record) */
export interface SerializedTraceData {
  id: string;
  rootSpanId: string;
  startTime: number;
  endTime: number;
  duration: number;
  spans: Record<string, SpanData>;
  metadata: TraceData['metadata'];
}

/** Serialize a TraceData for JSON transport */
export function serializeTrace(trace: TraceData): SerializedTraceData {
  const spans: Record<string, SpanData> = {};
  for (const [id, span] of trace.spans) {
    spans[id] = span;
  }
  return {
    id: trace.id,
    rootSpanId: trace.rootSpanId,
    startTime: trace.startTime,
    endTime: trace.endTime,
    duration: trace.duration,
    spans,
    metadata: trace.metadata,
  };
}

/** Deserialize a TraceData from JSON transport */
export function deserializeTrace(data: SerializedTraceData): TraceData {
  const spans = new Map<string, SpanData>();
  for (const [id, span] of Object.entries(data.spans)) {
    spans.set(id, span);
  }
  return {
    id: data.id,
    rootSpanId: data.rootSpanId,
    startTime: data.startTime,
    endTime: data.endTime,
    duration: data.duration,
    spans,
    metadata: data.metadata,
  };
}

/** Serialized trace stream event for WebSocket */
export type SerializedTraceStreamEvent =
  | { type: 'trace:start'; trace: SerializedTraceData }
  | { type: 'trace:end'; trace: SerializedTraceData }
  | { type: 'span:start'; span: SpanData }
  | { type: 'span:end'; span: SpanData }
  | { type: 'span:event'; spanId: string; event: SpanData['events'][0] };

/** Serialize a TraceStreamEvent for WebSocket transport */
export function serializeEvent(event: TraceStreamEvent): SerializedTraceStreamEvent {
  if (event.type === 'trace:start' || event.type === 'trace:end') {
    return { type: event.type, trace: serializeTrace(event.trace) };
  }
  return event as SerializedTraceStreamEvent;
}

/**
 * Create a WebSocket handler for trace streaming.
 * Attach to the server at `/__ereo/trace-ws`.
 */
export function createTraceWebSocket(tracer: Tracer): {
  /** Handle WebSocket upgrade */
  upgrade: (request: Request) => boolean;
  /** Bun WebSocket handlers */
  websocket: {
    open: (ws: { send: (data: string) => void }) => void;
    close: (ws: { send: (data: string) => void }) => void;
    message: (ws: { send: (data: string) => void }, message: string | Buffer) => void;
  };
  /** Stop streaming and disconnect all clients */
  close: () => void;
} {
  const clients = new Set<{ send: (data: string) => void }>();
  let unsubscribe: (() => void) | null = null;

  // Subscribe to tracer events and broadcast to all connected clients
  const startBroadcast = () => {
    if (unsubscribe) return;
    unsubscribe = tracer.subscribe((event) => {
      const serialized = JSON.stringify(serializeEvent(event));
      for (const client of clients) {
        try {
          client.send(serialized);
        } catch {
          clients.delete(client);
        }
      }
    });
  };

  return {
    upgrade(request: Request): boolean {
      const url = new URL(request.url);
      return url.pathname === '/__ereo/trace-ws';
    },

    websocket: {
      open(ws) {
        clients.add(ws);
        if (clients.size === 1) startBroadcast();

        // Send existing traces as initial state
        const traces = tracer.getTraces();
        const initial = JSON.stringify({
          type: 'initial',
          traces: traces.map(serializeTrace),
        });
        ws.send(initial);
      },

      close(ws) {
        clients.delete(ws);
        if (clients.size === 0 && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      },

      message(_ws, message) {
        // Handle client span submissions
        try {
          const data = JSON.parse(typeof message === 'string' ? message : message.toString());
          if (data.type === 'client:spans' && data.traceId && Array.isArray(data.spans)) {
            tracer.mergeClientSpans(data.traceId, data.spans);
          }
        } catch {
          // Ignore malformed messages
        }
      },
    },

    close() {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      clients.clear();
    },
  };
}

/**
 * Create the HTTP endpoint handler for `/__devtools/api/traces`.
 * Returns all stored traces as JSON.
 */
export function createTracesAPIHandler(tracer: Tracer): (request: Request) => Response {
  return (request: Request) => {
    const url = new URL(request.url);

    // Single trace by ID
    const traceId = url.searchParams.get('id');
    if (traceId) {
      const trace = tracer.getTrace(traceId);
      if (!trace) {
        return new Response(JSON.stringify({ error: 'Trace not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(serializeTrace(trace)), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // All traces
    const traces = tracer.getTraces().map(serializeTrace);
    return new Response(JSON.stringify({ traces }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
