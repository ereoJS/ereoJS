/**
 * Type-level tests for path-parser types.
 *
 * These tests verify that InferParams correctly extracts parameter types
 * from route path patterns at compile time.
 *
 * Run with: npx tsd
 * Or: bun run typecheck
 */

import { expectType, expectNotType, expectAssignable, expectNotAssignable } from 'tsd';
import type {
  InferParams,
  HasParams,
  ParamNames,
  IsOptionalParam,
  IsCatchAllParam,
  StaticPrefix,
  IsStaticPath,
  ParentPath,
  ParseSegment,
  BrandedPath,
} from '../path-parser';

// ============================================================================
// Basic Dynamic Parameter Tests
// ============================================================================

// Single dynamic param
expectType<{ id: string }>({} as InferParams<'/users/[id]'>);

// Multiple dynamic params
expectType<{ id: string; postId: string }>({} as InferParams<'/users/[id]/posts/[postId]'>);

// Deeply nested params
expectType<{ orgId: string; teamId: string; memberId: string }>(
  {} as InferParams<'/orgs/[orgId]/teams/[teamId]/members/[memberId]'>
);

// ============================================================================
// Optional Parameter Tests
// ============================================================================

// Single optional param
expectType<{ page?: string }>({} as InferParams<'/blog/[[page]]'>);

// Optional param is assignable without value
expectAssignable<InferParams<'/blog/[[page]]'>>({});
expectAssignable<InferParams<'/blog/[[page]]'>>({ page: 'hello' });

// Mixed required and optional
expectType<{ slug: string; tab?: string }>(
  {} as InferParams<'/posts/[slug]/[[tab]]'>
);

// ============================================================================
// Catch-All Parameter Tests
// ============================================================================

// Catch-all param
expectType<{ path: string[] }>({} as InferParams<'/docs/[...path]'>);

// Catch-all with prefix
expectType<{ version: string; path: string[] }>(
  {} as InferParams<'/api/[version]/[...path]'>
);

// ============================================================================
// Complex Combinations
// ============================================================================

// All three param types combined
expectType<{ id: string; tab?: string; rest: string[] }>(
  {} as InferParams<'/users/[id]/[[tab]]/[...rest]'>
);

// Real-world examples
expectType<{ username: string; repo: string; branch?: string; path: string[] }>(
  {} as InferParams<'/[username]/[repo]/tree/[[branch]]/[...path]'>
);

// ============================================================================
// Static Path Tests
// ============================================================================

// No params (empty object with no keys)
type EmptyParams = InferParams<'/about'>;
expectType<{}>({} as EmptyParams);
expectAssignable<EmptyParams>({});

// Root path
expectType<{}>({} as InferParams<'/'>);

// Complex static path
expectType<{}>({} as InferParams<'/api/health/status'>);

// ============================================================================
// HasParams Tests
// ============================================================================

// Static paths have no params
expectType<false>({} as HasParams<'/about'>);
expectType<false>({} as HasParams<'/'>);

// Dynamic paths have params
expectType<true>({} as HasParams<'/users/[id]'>);
expectType<true>({} as HasParams<'/blog/[[page]]'>);
expectType<true>({} as HasParams<'/docs/[...path]'>);

// ============================================================================
// ParamNames Tests
// ============================================================================

// Extract param names
expectType<'id'>({} as ParamNames<'/users/[id]'>);
expectType<'id' | 'postId'>({} as ParamNames<'/users/[id]/posts/[postId]'>);
expectType<never>({} as ParamNames<'/about'>);

// ============================================================================
// IsOptionalParam Tests
// ============================================================================

// Required params are not optional
expectType<false>({} as IsOptionalParam<'/users/[id]', 'id'>);

// Optional params are optional
expectType<true>({} as IsOptionalParam<'/blog/[[page]]', 'page'>);

// ============================================================================
// IsCatchAllParam Tests
// ============================================================================

// Regular params are not catch-all
expectType<false>({} as IsCatchAllParam<'/users/[id]', 'id'>);

// Catch-all params are catch-all
expectType<true>({} as IsCatchAllParam<'/docs/[...path]', 'path'>);

// ============================================================================
// StaticPrefix Tests
// ============================================================================

// Extract static prefix before first dynamic segment
expectType<'/users'>({} as StaticPrefix<'/users/[id]'>);
expectType<'/api/v1/users'>({} as StaticPrefix<'/api/v1/users/[id]/posts'>);
expectType<'/about'>({} as StaticPrefix<'/about'>);
expectType<''>({} as StaticPrefix<'/[lang]/about'>);

// ============================================================================
// IsStaticPath Tests
// ============================================================================

// Static paths are static
expectType<true>({} as IsStaticPath<'/about'>);
expectType<true>({} as IsStaticPath<'/api/health'>);

// Dynamic paths are not static
expectType<false>({} as IsStaticPath<'/users/[id]'>);
expectType<false>({} as IsStaticPath<'/blog/[[page]]'>);

// ============================================================================
// ParentPath Tests
// ============================================================================

// Get parent path
expectType<'/users'>({} as ParentPath<'/users/[id]'>);
expectType<'/users/[id]'>({} as ParentPath<'/users/[id]/posts'>);
expectType<'/'>({} as ParentPath<'/users'>);

// ============================================================================
// ParseSegment Tests
// ============================================================================

// Static segment
expectType<{ type: 'static'; value: 'users' }>({} as ParseSegment<'users'>);

// Dynamic segment
expectType<{ type: 'dynamic'; name: 'id' }>({} as ParseSegment<'[id]'>);

// Optional segment
expectType<{ type: 'optional'; name: 'page' }>({} as ParseSegment<'[[page]]'>);

// Catch-all segment
expectType<{ type: 'catchAll'; name: 'path' }>({} as ParseSegment<'[...path]'>);

// ============================================================================
// BrandedPath Tests
// ============================================================================

// Branded paths preserve the path string type
type BrandedUserPath = BrandedPath<'/users/[id]'>;
expectAssignable<string>({} as BrandedUserPath);

// ============================================================================
// Edge Cases
// ============================================================================

// Empty string path
expectType<{}>({} as InferParams<''>);

// Path with trailing slash
expectType<{ id: string }>({} as InferParams<'/users/[id]/'>);

// Path with multiple trailing slashes (normalized)
expectType<{ id: string }>({} as InferParams<'/users/[id]//'>);

// Param names with underscores
expectType<{ user_id: string }>({} as InferParams<'/users/[user_id]'>);

// Param names with numbers
expectType<{ id1: string; id2: string }>(
  {} as InferParams<'/compare/[id1]/[id2]'>
);

// ============================================================================
// Type Compatibility Tests
// ============================================================================

// InferParams result is assignable to Record<string, string | string[] | undefined>
type AnyParams = Record<string, string | string[] | undefined>;
expectAssignable<AnyParams>({} as InferParams<'/users/[id]'>);
expectAssignable<AnyParams>({} as InferParams<'/docs/[...path]'>);
expectAssignable<AnyParams>({} as InferParams<'/blog/[[page]]'>);

// Specific param types
type UserParams = InferParams<'/users/[id]'>;
const validUserParams: UserParams = { id: '123' };
expectType<UserParams>(validUserParams);

// Invalid params should not be assignable
type PostParams = InferParams<'/posts/[slug]'>;
// This would be a type error if uncommented:
// const invalidPostParams: PostParams = { id: '123' }; // Error: 'id' doesn't exist

// ============================================================================
// Real-World Route Patterns
// ============================================================================

// Blog-like routes
expectType<{ slug: string }>({} as InferParams<'/blog/[slug]'>);
expectType<{ year: string; month: string; slug: string }>(
  {} as InferParams<'/blog/[year]/[month]/[slug]'>
);

// E-commerce routes
expectType<{ category: string; productId: string }>(
  {} as InferParams<'/shop/[category]/[productId]'>
);

// Documentation routes
expectType<{ version: string; topic: string[] }>(
  {} as InferParams<'/docs/[version]/[...topic]'>
);

// Dashboard routes with optional view
expectType<{ section: string; view?: string }>(
  {} as InferParams<'/dashboard/[section]/[[view]]'>
);

// API routes
expectType<{ version: string; resource: string; id: string }>(
  {} as InferParams<'/api/[version]/[resource]/[id]'>
);

// Internationalized routes
expectType<{ locale: string; page: string[] }>(
  {} as InferParams<'/[locale]/[...page]'>
);
