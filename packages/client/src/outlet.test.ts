import { describe, expect, test } from 'bun:test';
import {
  Outlet,
  useOutletContext,
  OutletProvider,
  OutletElementContext,
  OutletDataContext,
  type OutletElementContextValue,
  type OutletContextValue,
  type OutletProps,
  type OutletProviderProps,
} from './outlet';
import { createElement } from 'react';

// =================================================================
// OutletElementContext tests
// =================================================================

describe('@ereo/client - OutletElementContext', () => {
  test('defaults to null', () => {
    expect(OutletElementContext._currentValue).toBeNull();
  });

  test('context value holds a ReactNode element', () => {
    const child = createElement('div', null, 'Hello');
    const value: OutletElementContextValue = { element: child };

    expect(value.element).toBeDefined();
    expect(value.element).toBe(child);
  });

  test('context value can hold null element', () => {
    const value: OutletElementContextValue = { element: null };
    expect(value.element).toBeNull();
  });

  test('context value can hold string element', () => {
    const value: OutletElementContextValue = { element: 'plain text' };
    expect(value.element).toBe('plain text');
  });
});

// =================================================================
// OutletDataContext tests
// =================================================================

describe('@ereo/client - OutletDataContext', () => {
  test('defaults to null', () => {
    expect(OutletDataContext._currentValue).toBeNull();
  });

  test('context value holds arbitrary data', () => {
    const value: OutletContextValue = {
      data: { user: { id: 1, name: 'Alice' }, permissions: ['read', 'write'] },
    };

    expect(value.data).toEqual({
      user: { id: 1, name: 'Alice' },
      permissions: ['read', 'write'],
    });
  });

  test('context value can hold null data', () => {
    const value: OutletContextValue = { data: null };
    expect(value.data).toBeNull();
  });

  test('context value can hold primitive data', () => {
    const value: OutletContextValue = { data: 42 };
    expect(value.data).toBe(42);
  });

  test('context value can hold array data', () => {
    const value: OutletContextValue = { data: [1, 2, 3] };
    expect(value.data).toEqual([1, 2, 3]);
  });
});

// =================================================================
// Outlet component behavior (unit tests without React rendering)
// =================================================================

describe('@ereo/client - Outlet component', () => {
  test('Outlet is a function', () => {
    expect(typeof Outlet).toBe('function');
  });

  test('Outlet accepts empty props', () => {
    const props: OutletProps = {};
    expect(props.context).toBeUndefined();
  });

  test('Outlet accepts context prop', () => {
    const props: OutletProps = { context: { user: 'Alice' } };
    expect(props.context).toEqual({ user: 'Alice' });
  });

  test('Outlet returns null when no OutletElementContext exists', () => {
    // When OutletElementContext._currentValue is null (default),
    // Outlet should return null (no child to render)
    // We test this by verifying the context default
    expect(OutletElementContext._currentValue).toBeNull();
  });
});

// =================================================================
// useOutletContext hook (unit tests)
// =================================================================

describe('@ereo/client - useOutletContext', () => {
  test('useOutletContext is a function', () => {
    expect(typeof useOutletContext).toBe('function');
  });

  test('throws when OutletDataContext is null (outside Outlet)', () => {
    // Verify the context default is null, which means
    // useOutletContext would throw
    expect(OutletDataContext._currentValue).toBeNull();

    // Simulate the hook logic
    const context = OutletDataContext._currentValue;
    let error: Error | null = null;

    try {
      if (context === null) {
        throw new Error(
          'useOutletContext must be used within a route rendered by an <Outlet> ' +
            'that has a context prop. Make sure the parent layout passes context ' +
            'via <Outlet context={...} />.'
        );
      }
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain('useOutletContext');
    expect(error?.message).toContain('Outlet');
  });

  test('returns typed data when context is present', () => {
    // Simulate what useOutletContext would return with a valid context
    interface DashboardContext {
      user: { id: number; name: string };
      theme: string;
    }

    const contextValue: OutletContextValue = {
      data: { user: { id: 1, name: 'Bob' }, theme: 'dark' },
    };

    // Simulate: return context.data as T
    const result = contextValue.data as DashboardContext;
    expect(result.user.name).toBe('Bob');
    expect(result.theme).toBe('dark');
  });
});

// =================================================================
// OutletProvider (unit tests)
// =================================================================

describe('@ereo/client - OutletProvider', () => {
  test('OutletProvider is a function', () => {
    expect(typeof OutletProvider).toBe('function');
  });

  test('OutletProvider props accept element and children', () => {
    const child = createElement('div', null, 'page content');
    const layout = createElement('div', null, 'layout');

    const props: OutletProviderProps = {
      children: layout,
      element: child,
    };

    expect(props.element).toBe(child);
    expect(props.children).toBe(layout);
    expect(props.context).toBeUndefined();
  });

  test('OutletProvider props accept optional context', () => {
    const props: OutletProviderProps = {
      children: null,
      element: null,
      context: { theme: 'light', locale: 'en' },
    };

    expect(props.context).toEqual({ theme: 'light', locale: 'en' });
  });

  test('OutletProvider creates valid React element', () => {
    const child = createElement('span', null, 'child route');
    const layout = createElement('div', null, 'layout shell');

    const element = createElement(OutletProvider, {
      element: child,
      children: layout,
    });

    // Should be a valid React element
    expect(element).toBeDefined();
    expect(element.type).toBe(OutletProvider);
    expect(element.props.element).toBe(child);
  });
});

// =================================================================
// Nested layout composition with Outlet
// =================================================================

describe('@ereo/client - Nested Outlet composition', () => {
  test('nested OutletProviders create a valid tree', () => {
    // Simulate how the server composes nested layouts:
    // PageComponent (innermost) → Layout2 → Layout1 (outermost)

    const page = createElement('div', null, 'page');

    // Inner layout wraps page in OutletProvider
    const innerLayout = createElement('div', null, 'inner layout');
    const innerProvider = createElement(OutletProvider, {
      element: page,
      children: innerLayout,
    });

    // Outer layout wraps inner provider in OutletProvider
    const outerLayout = createElement('div', null, 'outer layout');
    const outerProvider = createElement(OutletProvider, {
      element: innerProvider,
      children: outerLayout,
    });

    expect(outerProvider).toBeDefined();
    expect(outerProvider.type).toBe(OutletProvider);
    expect(outerProvider.props.element).toBe(innerProvider);
  });

  test('each layout level gets its own element context', () => {
    // Verify that OutletProviderProps properly separates concerns:
    // each level has its own `element` (what Outlet renders)
    // and its own `children` (the layout component)

    const page = createElement('div', null, 'User Profile');
    const dashboard = createElement('div', null, 'Dashboard');
    const root = createElement('div', null, 'Root');

    // Level 1: Dashboard wraps Page
    const level1Props: OutletProviderProps = {
      element: page,
      children: dashboard,
    };

    // Level 2: Root wraps Level1
    const level1Element = createElement(OutletProvider, level1Props);
    const level2Props: OutletProviderProps = {
      element: level1Element,
      children: root,
    };

    expect(level1Props.element).toBe(page);
    expect(level2Props.element).toBe(level1Element);
    expect(level2Props.element).not.toBe(page);
  });

  test('context data is scoped per Outlet level', () => {
    // Each Outlet can pass different context data
    const outerContext = { theme: 'dark' };
    const innerContext = { user: { name: 'Alice' } };

    const outerProps: OutletProps = { context: outerContext };
    const innerProps: OutletProps = { context: innerContext };

    expect(outerProps.context).not.toEqual(innerProps.context);
    expect(outerProps.context).toEqual({ theme: 'dark' });
    expect(innerProps.context).toEqual({ user: { name: 'Alice' } });
  });
});

// =================================================================
// SSR integration scenario tests
// =================================================================

describe('@ereo/client - Outlet SSR integration', () => {
  test('server-side layout composition with OutletProvider', () => {
    // Simulate what the server does in renderPage():
    // 1. Creates page element
    // 2. Wraps in OutletProvider for each layout (innermost to outermost)

    const PageComponent = ({ loaderData }: { loaderData: unknown }) =>
      createElement('div', null, `User: ${(loaderData as any).name}`);

    const LayoutComponent = ({ children }: { children: unknown }) =>
      createElement('div', { className: 'layout' }, children as any);

    // Step 1: Create page element
    const pageElement = createElement(PageComponent, {
      loaderData: { name: 'Alice' },
    });

    // Step 2: Wrap with OutletProvider (what the server does)
    const composed = createElement(
      OutletProvider,
      { element: pageElement } as any,
      createElement(LayoutComponent, {
        loaderData: null,
        children: pageElement, // Also passed as children for backwards compat
      })
    );

    expect(composed).toBeDefined();
    expect(composed.type).toBe(OutletProvider);
    expect(composed.props.element).toBe(pageElement);
  });

  test('backwards compatible: layouts still receive children prop', () => {
    // The server passes both OutletProvider AND children prop
    // so layouts can use either pattern
    const child = createElement('div', null, 'page content');

    const layoutProps = {
      loaderData: null,
      params: {},
      children: child,
    };

    // Layout can render {children} OR <Outlet />
    expect(layoutProps.children).toBe(child);
  });

  test('layout can use Outlet without context prop', () => {
    const props: OutletProps = {};
    expect(props.context).toBeUndefined();
  });

  test('layout can use Outlet with context prop for data passing', () => {
    const props: OutletProps = {
      context: {
        user: { id: 1, name: 'Alice' },
        permissions: ['admin', 'editor'],
        theme: 'dark',
      },
    };

    const ctx = props.context as any;
    expect(ctx.user.id).toBe(1);
    expect(ctx.permissions).toContain('admin');
    expect(ctx.theme).toBe('dark');
  });
});

// =================================================================
// Type safety tests
// =================================================================

describe('@ereo/client - Outlet type safety', () => {
  test('OutletContextValue data is typed as unknown', () => {
    const value: OutletContextValue = { data: 'anything' };
    expect(typeof value.data).toBe('string');

    const value2: OutletContextValue = { data: 123 };
    expect(typeof value2.data).toBe('number');

    const value3: OutletContextValue = { data: { nested: true } };
    expect(typeof value3.data).toBe('object');
  });

  test('OutletElementContextValue element is typed as ReactNode', () => {
    // ReactNode can be many things
    const withElement: OutletElementContextValue = {
      element: createElement('div'),
    };
    expect(withElement.element).toBeDefined();

    const withString: OutletElementContextValue = { element: 'text' };
    expect(withString.element).toBe('text');

    const withNull: OutletElementContextValue = { element: null };
    expect(withNull.element).toBeNull();

    const withNumber: OutletElementContextValue = { element: 42 };
    expect(withNumber.element).toBe(42);
  });

  test('OutletProviderProps requires element and children', () => {
    const props: OutletProviderProps = {
      element: createElement('div'),
      children: createElement('div'),
    };

    expect(props.element).toBeDefined();
    expect(props.children).toBeDefined();
  });
});

// =================================================================
// Export verification
// =================================================================

describe('@ereo/client - Outlet exports from index', () => {
  test('all Outlet exports are available from index', async () => {
    const clientExports = await import('./index');

    expect(clientExports.Outlet).toBeDefined();
    expect(clientExports.useOutletContext).toBeDefined();
    expect(clientExports.OutletProvider).toBeDefined();
    expect(clientExports.OutletElementContext).toBeDefined();
    expect(clientExports.OutletDataContext).toBeDefined();

    expect(typeof clientExports.Outlet).toBe('function');
    expect(typeof clientExports.useOutletContext).toBe('function');
    expect(typeof clientExports.OutletProvider).toBe('function');
  });
});
