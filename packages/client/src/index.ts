/**
 * @ereo/client
 *
 * Client-side runtime for the EreoJS framework.
 * Includes islands architecture, navigation, and prefetching.
 */

// Import functions used internally
import { initializeIslands as _initializeIslands } from './islands';
import { setupScrollRestoration as _setupScrollRestoration } from './navigation';
import { setupAutoPrefetch as _setupAutoPrefetch } from './prefetch';

// Hydration
export {
  parseHydrationDirective,
  createHydrationTrigger,
  stripHydrationProps,
  generateIslandId,
  resetIslandCounter,
  getIslandCount,
  shouldHydrate,
} from './hydration';

export type { HydrationProps } from './hydration';

// Hooks
export {
  // Hooks
  useLoaderData,
  useActionData,
  useNavigation,
  useError,
  // Context accessors (for internal use)
  useLoaderDataContext,
  useActionDataContext,
  useNavigationContext,
  useErrorContext,
  // Contexts
  LoaderDataContext,
  ActionDataContext,
  NavigationContext,
  ErrorContext,
  // Providers
  LoaderDataProvider,
  ActionDataProvider,
  NavigationProvider,
  ErrorProvider,
  EreoProvider,
} from './hooks';

export type {
  NavigationStatus,
  NavigationStateHook,
  LoaderDataContextValue,
  ActionDataContextValue,
  NavigationContextValue,
  ErrorContextValue,
  LoaderDataProviderProps,
  ActionDataProviderProps,
  NavigationProviderProps,
  ErrorProviderProps,
  EreoProviderProps,
} from './hooks';

// Islands
export {
  islandRegistry,
  hydrateIslands,
  registerIslandComponent,
  getIslandComponent,
  registerIslandComponents,
  createIsland,
  initializeIslands,
  cleanupIslands,
} from './islands';

export type { IslandRegistration } from './islands';

// Navigation
export {
  router,
  navigate,
  goBack,
  goForward,
  onNavigate,
  getNavigationState,
  fetchLoaderData,
  submitAction,
  setupScrollRestoration,
} from './navigation';

export type { NavigationState, NavigationEvent, NavigationListener } from './navigation';

// Prefetch
export {
  prefetch,
  getPrefetchedData,
  clearPrefetchCache,
  setupLinkPrefetch,
  setupAutoPrefetch,
  prefetchAll,
  isPrefetching,
  isPrefetched,
} from './prefetch';

export type { PrefetchOptions, LinkPrefetchProps } from './prefetch';

// Link Components
export { Link, NavLink, useIsActive } from './link';

export type {
  LinkProps,
  NavLinkProps,
  NavLinkActiveProps,
  PrefetchStrategy,
} from './link';

// Type-Safe Link Components (compile-time route validation)
export {
  TypedLink,
  TypedNavLink,
  useIsRouteActive,
  buildUrl,
} from './typed-link';

export type {
  TypedLinkProps,
  TypedNavLinkProps,
  NavLinkActiveProps as TypedNavLinkActiveProps,
} from './typed-link';

// Type-Safe Navigation Utilities
export {
  typedNavigate,
  useTypedNavigate,
  typedRedirect,
  redirect,
  buildTypedUrl,
  parseTypedSearchParams,
  parseTypedHashParams,
  goBack as typedGoBack,
  goForward as typedGoForward,
  go,
  isCurrentPath,
  preloadRoute,
} from './typed-navigate';

export type {
  TypedNavigateOptions,
  TypedRedirectOptions,
  TypedNavigateFunction,
} from './typed-navigate';

// Form Components
export {
  Form,
  FormProvider,
  useFormContext,
  useSubmit,
  useFetcher,
  useActionData as useFormActionData,
  useNavigation as useFormNavigation,
  serializeFormData,
  parseFormData,
  formDataToObject,
  objectToFormData,
} from './form';

export type {
  FormProps,
  ActionResult,
  SubmissionState,
  SubmitOptions,
  FetcherState,
  Fetcher,
  FormContextValue,
  FormNavigationState,
} from './form';

// Error Boundary
export {
  ErrorBoundary,
  RouteErrorBoundary,
  useErrorBoundary,
  useRouteError,
  isRouteErrorResponse,
  createRouteErrorResponse,
  withErrorBoundary,
  RouteError,
} from './error-boundary';

export type {
  ErrorBoundaryProps,
  RouteErrorResponse,
  RouteErrorBoundaryProps,
  UseErrorBoundaryReturn,
} from './error-boundary';

/**
 * Initialize the client runtime.
 * Call this in your entry point.
 */
export function initClient(): void {
  // Initialize islands
  _initializeIslands();

  // Setup scroll restoration
  _setupScrollRestoration();

  // Setup auto prefetch
  _setupAutoPrefetch({ strategy: 'hover' });
}
