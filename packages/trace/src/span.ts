/**
 * @ereo/trace - Span Implementation
 *
 * Active span handle with timing, attributes, events, and child creation.
 */

import type { Span, SpanData, SpanEvent, SpanId, SpanLayer, SpanStatus, TraceId } from './types';

let idCounter = 0;

/** Generate a random hex string of exactly `len` characters */
function randomHex(len: number): string {
  let s = '';
  while (s.length < len) {
    s += Math.random().toString(16).slice(2);
  }
  return s.slice(0, len);
}

/** Generate an 8-byte hex span ID (16 chars) */
export function generateSpanId(): SpanId {
  idCounter++;
  const time = Date.now().toString(16).slice(-8);
  const counter = (idCounter & 0xffff).toString(16).padStart(4, '0');
  const random = randomHex(4);
  return `${time}${counter}${random}`;
}

/** Generate a 16-byte hex trace ID (32 chars) */
export function generateTraceId(): TraceId {
  return randomHex(32);
}

export type SpanEndCallback = (span: SpanImpl) => void;
export type SpanChildFactory = (name: string, layer: SpanLayer, parentId: SpanId) => Span;
export type SpanEventCallback = (spanId: SpanId, event: SpanEvent) => void;

/**
 * Concrete Span implementation.
 * Mutable while active, produces immutable SpanData on end().
 */
export class SpanImpl implements Span {
  readonly id: SpanId;
  readonly traceId: TraceId;

  private _parentId: SpanId | null;
  private _name: string;
  private _layer: SpanLayer;
  private _status: SpanStatus = 'ok';
  private _startTime: number;
  private _endTime = 0;
  private _attributes: Record<string, string | number | boolean> = {};
  private _events: SpanEvent[] = [];
  private _children: SpanId[] = [];
  private _ended = false;
  private _onEnd: SpanEndCallback;
  private _childFactory: SpanChildFactory;
  private _onEvent?: SpanEventCallback;

  constructor(
    traceId: TraceId,
    parentId: SpanId | null,
    name: string,
    layer: SpanLayer,
    onEnd: SpanEndCallback,
    childFactory: SpanChildFactory,
    onEvent?: SpanEventCallback,
  ) {
    this.id = generateSpanId();
    this.traceId = traceId;
    this._parentId = parentId;
    this._name = name;
    this._layer = layer;
    this._startTime = performance.now();
    this._onEnd = onEnd;
    this._childFactory = childFactory;
    this._onEvent = onEvent;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (this._ended) return;
    this._attributes[key] = value;
  }

  event(name: string, attributes?: Record<string, string | number | boolean>): void {
    if (this._ended) return;
    const evt: SpanEvent = { name, time: performance.now(), attributes };
    this._events.push(evt);
    this._onEvent?.(this.id, evt);
  }

  end(): void {
    if (this._ended) return;
    this._ended = true;
    this._endTime = performance.now();
    this._onEnd(this);
  }

  error(err: unknown): void {
    if (this._ended) return;
    this._status = 'error';
    if (err instanceof Error) {
      this._attributes['error.message'] = err.message;
      this._attributes['error.name'] = err.name;
      if (err.stack) {
        this._attributes['error.stack'] = err.stack.slice(0, 500);
      }
    } else {
      this._attributes['error.message'] = String(err);
    }
  }

  child(name: string, layer: SpanLayer): Span {
    const childSpan = this._childFactory(name, layer, this.id);
    this._children.push(childSpan.id);
    return childSpan;
  }

  /** Check if this span has ended */
  get ended(): boolean {
    return this._ended;
  }

  /** Export the span as immutable data */
  toData(): SpanData {
    return {
      id: this.id,
      traceId: this.traceId,
      parentId: this._parentId,
      name: this._name,
      layer: this._layer,
      status: this._status,
      startTime: this._startTime,
      endTime: this._endTime || performance.now(),
      duration: (this._endTime || performance.now()) - this._startTime,
      attributes: { ...this._attributes },
      events: [...this._events],
      children: [...this._children],
    };
  }
}
