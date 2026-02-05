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
  useParams,
  useSearchParams,
  useLocation,
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
  ParamsContext,
  LocationContext,
  // Providers
  LoaderDataProvider,
  ActionDataProvider,
  NavigationProvider,
  ErrorProvider,
  ParamsProvider,
  LocationProvider,
  EreoProvider,
} from './hooks';

export type {
  NavigationStatus,
  NavigationStateHook,
  LoaderDataContextValue,
  ActionDataContextValue,
  NavigationContextValue,
  ErrorContextValue,
  ParamsContextValue,
  LocationContextValue,
  LocationState,
  LoaderDataProviderProps,
  ActionDataProviderProps,
  NavigationProviderProps,
  ErrorProviderProps,
  ParamsProviderProps,
  LocationProviderProps,
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

// Revalidation
export {
  getRoutesToRevalidate,
  checkShouldRevalidate,
} from './revalidation';

export type {
  RevalidationRoute,
  RevalidationContext,
} from './revalidation';

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

// Outlet (Nested Layout Rendering)
export {
  Outlet,
  useOutletContext,
  OutletProvider,
  OutletElementContext,
  OutletDataContext,
} from './outlet';

export type {
  OutletProps,
  OutletProviderProps,
  OutletElementContextValue,
  OutletContextValue,
} from './outlet';

// Matches (useMatches + handle metadata)
export {
  useMatches,
  MatchesProvider,
  MatchesContext,
} from './matches';

export type {
  RouteMatchData,
  MatchesContextValue,
  MatchesProviderProps,
} from './matches';

// Route Links (per-route CSS/asset management)
export {
  renderLinkTags,
  updateRouteLinks,
  removeRouteLinks,
  getActiveLinksCount,
} from './route-links';

// Client Data (clientLoader / clientAction runtime)
export {
  executeClientLoader,
  executeClientAction,
  shouldHydrateClientLoader,
} from './client-data';

// Lazy Route Loading (code splitting)
export {
  registerLazyRoute,
  registerLazyRoutes,
  loadLazyRoute,
  preloadLazyRoute,
  isRouteLoaded,
  getLoadedModule,
  getLazyRouteIds,
  clearLazyRouteCache,
  resetLazyRoutes,
  setRouteManifest,
  getRouteManifestEntry,
  preloadRouteAssets,
} from './lazy-route';

export type {
  RouteModuleLoader,
  LazyRouteDefinition,
  RouteManifestEntry,
  RouteManifest,
} from './lazy-route';

// Await Component (for Streaming SSR)
export { Await, resolveAwait } from './await';

export type { AwaitProps, DeferredData } from './await';

// Scroll Restoration (React component)
export { ScrollRestoration, clearScrollPositions } from './scroll-restoration';

export type { ScrollRestorationProps } from './scroll-restoration';

// View Transitions API
export {
  startViewTransition,
  isViewTransitionSupported,
  enableViewTransitions,
  disableViewTransitions,
  areViewTransitionsEnabled,
  resetViewTransitions,
  useViewTransitionState,
  ViewTransitionContext,
} from './view-transition';

export type {
  ViewTransition,
  ViewTransitionOptions,
  ViewTransitionState,
  ViewTransitionContextValue,
} from './view-transition';

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
