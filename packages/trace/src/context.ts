/**
 * @ereo/trace - Context Integration
 *
 * Attach/retrieve tracer from RequestContext store.
 * Uses the existing ctx.set()/ctx.get() mechanism — no changes to @ereo/core needed.
 */

import type { AppContext } from '@ereo/core';
import type { Tracer, Span } from './types';

const TRACER_KEY = '__ereo_tracer';
const ACTIVE_SPAN_KEY = '__ereo_active_span';

/** Attach a tracer to the request context */
export function setTracer(context: AppContext, tracer: Tracer): void {
  context.set(TRACER_KEY, tracer);
}

/** Retrieve the tracer from the request context */
export function getTracer(context: AppContext): Tracer | undefined {
  return context.get<Tracer>(TRACER_KEY);
}

/** Store the active root span on the context (for child span creation by instrumentors) */
export function setActiveSpan(context: AppContext, span: Span): void {
  context.set(ACTIVE_SPAN_KEY, span);
}

/** Retrieve the active root span from the context */
export function getActiveSpan(context: AppContext): Span | undefined {
  return context.get<Span>(ACTIVE_SPAN_KEY);
}
