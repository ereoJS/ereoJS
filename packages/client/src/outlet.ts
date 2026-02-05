/**
 * @ereo/client - Outlet Component
 *
 * Provides the <Outlet /> component and useOutletContext hook for
 * nested layout rendering. Layouts render <Outlet /> where child
 * content should appear, and can pass data to children via the
 * context prop without prop drilling.
 */

import {
  createContext,
  useContext,
  createElement,
  type ReactNode,
  type ReactElement,
  type Context,
} from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Internal context value for Outlet — carries the child element to render.
 */
export interface OutletElementContextValue {
  /** The child route element to render */
  element: ReactNode;
}

/**
 * Internal context value for Outlet context data — carries data
 * passed via <Outlet context={...} />.
 */
export interface OutletContextValue {
  /** Arbitrary data passed from a layout to its children */
  data: unknown;
}

/**
 * Props for the Outlet component.
 */
export interface OutletProps {
  /**
   * Context data to pass to child routes.
   * Accessible via useOutletContext() in child components.
   *
   * @example
   * ```tsx
   * // In a layout
   * export default function DashboardLayout() {
   *   const { user } = useLoaderData<{ user: User }>();
   *   return (
   *     <div>
   *       <Sidebar user={user} />
   *       <Outlet context={{ user }} />
   *     </div>
   *   );
   * }
   * ```
   */
  context?: unknown;
}

/**
 * Props for OutletProvider (internal — used by the server/router to
 * wrap layout trees).
 */
export interface OutletProviderProps {
  children: ReactNode;
  /** The child route element that <Outlet /> will render */
  element: ReactNode;
  /** Context data available via useOutletContext() */
  context?: unknown;
}

// ============================================================================
// Contexts
// ============================================================================

/**
 * Context for the child element that Outlet should render.
 * @internal
 */
export const OutletElementContext: Context<OutletElementContextValue | null> =
  createContext<OutletElementContextValue | null>(null);

/**
 * Context for data passed via <Outlet context={...} />.
 * This is a separate context so that useOutletContext works
 * regardless of whether the user reads the element context.
 */
export const OutletDataContext: Context<OutletContextValue | null> =
  createContext<OutletContextValue | null>(null);

// ============================================================================
// Components
// ============================================================================

/**
 * Renders the child route element within a layout.
 *
 * Place this component in your layout where child routes should appear.
 * Optionally pass a `context` prop to make data available to children
 * via `useOutletContext()`.
 *
 * @example
 * ```tsx
 * // Basic usage in a layout
 * export default function AppLayout() {
 *   return (
 *     <html>
 *       <body>
 *         <Header />
 *         <main>
 *           <Outlet />
 *         </main>
 *         <Footer />
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // Passing context to child routes
 * export default function DashboardLayout() {
 *   const { user, permissions } = useLoaderData<DashboardData>();
 *   return (
 *     <div className="dashboard">
 *       <Sidebar />
 *       <Outlet context={{ user, permissions }} />
 *     </div>
 *   );
 * }
 *
 * // In a child route
 * function Settings() {
 *   const { user, permissions } = useOutletContext<{
 *     user: User;
 *     permissions: string[];
 *   }>();
 *   // ...
 * }
 * ```
 */
export function Outlet({ context }: OutletProps = {}): ReactNode {
  const elementCtx = useContext(OutletElementContext);

  // If no outlet context exists, render nothing (no child route)
  if (elementCtx === null) {
    return null;
  }

  const child = elementCtx.element;

  // If context prop is provided, wrap the child with OutletDataContext
  if (context !== undefined) {
    return createElement(
      OutletDataContext.Provider,
      { value: { data: context } },
      child
    );
  }

  return child as ReactElement;
}

/**
 * Access context data passed from a parent layout's <Outlet context={...} />.
 *
 * @returns The context data from the nearest parent Outlet
 * @throws Error if no parent Outlet has provided context
 *
 * @example
 * ```tsx
 * interface DashboardContext {
 *   user: User;
 *   permissions: string[];
 * }
 *
 * function SettingsPage() {
 *   const { user, permissions } = useOutletContext<DashboardContext>();
 *   return <div>Settings for {user.name}</div>;
 * }
 * ```
 */
export function useOutletContext<T = unknown>(): T {
  const context = useContext(OutletDataContext);

  if (context === null) {
    throw new Error(
      'useOutletContext must be used within a route rendered by an <Outlet> ' +
        'that has a context prop. Make sure the parent layout passes context ' +
        'via <Outlet context={...} />.'
    );
  }

  return context.data as T;
}

/**
 * Provider that sets up the outlet element context for a layout level.
 *
 * Used internally by the server/router when composing layout trees.
 * Each layout level gets its own OutletProvider that tells <Outlet />
 * what to render as its child content.
 *
 * @internal
 */
export function OutletProvider({
  children,
  element,
  context,
}: OutletProviderProps): ReactNode {
  // Wrap the layout component (children) with the element context
  // so that <Outlet /> inside the layout knows what to render
  const elementValue: OutletElementContextValue = { element };

  let tree: ReactNode = createElement(
    OutletElementContext.Provider,
    { value: elementValue },
    children
  );

  // If context data is provided at the provider level, also set up
  // the data context (this is used when the server pre-sets context)
  if (context !== undefined) {
    tree = createElement(
      OutletDataContext.Provider,
      { value: { data: context } },
      tree
    );
  }

  return tree;
}
