/**
 * Type-level tests for RouteParamsFor using InferParams fallback.
 *
 * Verifies that when RouteTypes is empty (no codegen), RouteParamsFor
 * still provides correct param types via InferParams template literals.
 */

import { expectType, expectAssignable, expectNotAssignable } from 'tsd';
import type { RouteParamsFor, TypedRoutes } from '../../types';

// ============================================================================
// Required Params — RouteParamsFor should infer { id: string }
// ============================================================================

expectType<{ id: string }>({} as RouteParamsFor<'/users/[id]'>);
expectType<{ id: string; postId: string }>(
  {} as RouteParamsFor<'/users/[id]/posts/[postId]'>
);

// ============================================================================
// Optional Params — RouteParamsFor should infer { page?: string }
// ============================================================================

expectType<{ page?: string }>({} as RouteParamsFor<'/blog/[[page]]'>);
expectAssignable<RouteParamsFor<'/blog/[[page]]'>>({});
expectAssignable<RouteParamsFor<'/blog/[[page]]'>>({ page: '2' });

// ============================================================================
// Catch-All Params — RouteParamsFor should infer { path: string[] }
// ============================================================================

expectType<{ path: string[] }>({} as RouteParamsFor<'/docs/[...path]'>);

// ============================================================================
// Static Paths — RouteParamsFor should infer {} (no params needed)
// ============================================================================

expectType<{}>({} as RouteParamsFor<'/about'>);
expectType<{}>({} as RouteParamsFor<'/'>);
expectType<{}>({} as RouteParamsFor<'/api/health/status'>);

// ============================================================================
// Mixed Params — combines required, optional, and catch-all
// ============================================================================

expectType<{ slug: string; tab?: string }>(
  {} as RouteParamsFor<'/posts/[slug]/[[tab]]'>
);

expectType<{ version: string; path: string[] }>(
  {} as RouteParamsFor<'/api/[version]/[...path]'>
);

// ============================================================================
// Assignability — wrong params should NOT be assignable
// ============================================================================

// Missing required param
expectNotAssignable<RouteParamsFor<'/users/[id]'>>({});

// Wrong param name
expectNotAssignable<RouteParamsFor<'/users/[id]'>>({ wrong: '123' });
