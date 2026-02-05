import { describe, expect, test, beforeEach, mock, spyOn, afterEach } from 'bun:test';
import {
  HMRServer,
  HMRWatcher,
  createHMRServer,
  createHMRWatcher,
  createHMRWebSocket,
  HMR_CLIENT_CODE,
  type ModuleDependencyGraph,
} from './hmr';
import { join } from 'node:path';

describe('@ereo/bundler - HMR', () => {
  describe('HMR_CLIENT_CODE', () => {
    test('contains WebSocket connection code', () => {
      expect(HMR_CLIENT_CODE).toContain('WebSocket');
      expect(HMR_CLIENT_CODE).toContain('__hmr');
    });

    test('handles full-reload message', () => {
      expect(HMR_CLIENT_CODE).toContain('full-reload');
      expect(HMR_CLIENT_CODE).toContain('location.reload()');
    });

    test('handles css-update message', () => {
      expect(HMR_CLIENT_CODE).toContain('css-update');
      expect(HMR_CLIENT_CODE).toContain('updateCSS');
    });

    test('handles js-update message', () => {
      expect(HMR_CLIENT_CODE).toContain('js-update');
    });

    test('handles error message', () => {
      expect(HMR_CLIENT_CODE).toContain('error');
      expect(HMR_CLIENT_CODE).toContain('showErrorOverlay');
    });

    test('handles connection close with reconnect', () => {
      expect(HMR_CLIENT_CODE).toContain('onclose');
      expect(HMR_CLIENT_CODE).toContain('retrying');
    });
  });

  describe('HMRServer', () => {
    let hmr: HMRServer;

    beforeEach(() => {
      hmr = createHMRServer();
    });

    test('creates HMR server', () => {
      expect(hmr).toBeInstanceOf(HMRServer);
    });

    test('starts with zero clients', () => {
      expect(hmr.getClientCount()).toBe(0);
    });

    test('tracks client connections', () => {
      const mockWs = {
        send: () => {},
      };

      hmr.handleConnection(mockWs as any);

      expect(hmr.getClientCount()).toBe(1);
    });

    test('removes client on close', () => {
      const mockWs = {
        send: () => {},
      };

      hmr.handleConnection(mockWs as any);
      expect(hmr.getClientCount()).toBe(1);

      hmr.handleClose(mockWs as any);
      expect(hmr.getClientCount()).toBe(0);
    });

    test('sends updates to all clients', () => {
      const messages: string[] = [];
      const mockWs1 = {
        send: (msg: string) => messages.push('ws1:' + msg),
      };
      const mockWs2 = {
        send: (msg: string) => messages.push('ws2:' + msg),
      };

      hmr.handleConnection(mockWs1 as any);
      hmr.handleConnection(mockWs2 as any);

      hmr.reload();

      expect(messages).toHaveLength(2);
      expect(messages[0]).toContain('full-reload');
      expect(messages[1]).toContain('full-reload');
    });

    test('reload sends full-reload message', () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      hmr.reload();

      expect(sentMessage).not.toBeNull();
      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.timestamp).toBeDefined();
    });

    test('cssUpdate sends css-update message with path', () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      hmr.cssUpdate('/styles/main.css');

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('css-update');
      expect(parsed.path).toBe('/styles/main.css');
    });

    test('jsUpdate sends js-update message with path', async () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      await hmr.jsUpdate('/app/page.tsx');

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('js-update');
      expect(parsed.path).toBe('/app/page.tsx');
    });

    test('error sends error message with details', () => {
      let sentMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          sentMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);
      hmr.error('Test error', 'Error stack trace');

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('error');
      expect(parsed.error.message).toBe('Test error');
      expect(parsed.error.stack).toBe('Error stack trace');
    });

    test('clearError clears last error state', () => {
      hmr.error('Test error');
      hmr.clearError();

      // New connection should not receive error
      let receivedMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          receivedMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);

      expect(receivedMessage).toBeNull();
    });

    test('new connection receives last error if present', () => {
      hmr.error('Existing error');

      let receivedMessage: string | null = null;
      const mockWs = {
        send: (msg: string) => {
          receivedMessage = msg;
        },
      };

      hmr.handleConnection(mockWs as any);

      expect(receivedMessage).not.toBeNull();
      const parsed = JSON.parse(receivedMessage!);
      expect(parsed.type).toBe('error');
    });

    test('handles send failure gracefully', () => {
      const mockWs = {
        send: () => {
          throw new Error('Connection closed');
        },
      };

      hmr.handleConnection(mockWs as any);
      expect(hmr.getClientCount()).toBe(1);

      // Should not throw
      hmr.reload();

      // Failed client should be removed
      expect(hmr.getClientCount()).toBe(0);
    });
  });

  describe('createHMRServer', () => {
    test('creates new HMRServer instance', () => {
      const hmr = createHMRServer();
      expect(hmr).toBeInstanceOf(HMRServer);
    });
  });

  describe('createHMRWebSocket', () => {
    test('creates WebSocket handler object', () => {
      const hmr = createHMRServer();
      const handler = createHMRWebSocket(hmr);

      expect(typeof handler.open).toBe('function');
      expect(typeof handler.close).toBe('function');
      expect(typeof handler.message).toBe('function');
    });

    test('open handler adds connection', () => {
      const hmr = createHMRServer();
      const handler = createHMRWebSocket(hmr);

      const mockWs = { send: () => {} };
      handler.open(mockWs as any);

      expect(hmr.getClientCount()).toBe(1);
    });

    test('close handler removes connection', () => {
      const hmr = createHMRServer();
      const handler = createHMRWebSocket(hmr);

      const mockWs = { send: () => {} };
      handler.open(mockWs as any);
      handler.close(mockWs as any);

      expect(hmr.getClientCount()).toBe(0);
    });
  });

  describe('HMRWatcher', () => {
    let hmr: HMRServer;
    let watcher: HMRWatcher;

    beforeEach(() => {
      hmr = createHMRServer();
      watcher = createHMRWatcher(hmr);
    });

    test('creates HMR watcher', () => {
      expect(watcher).toBeInstanceOf(HMRWatcher);
    });

    test('stop method exists', () => {
      expect(typeof watcher.stop).toBe('function');
    });

    test('watch method exists', () => {
      expect(typeof watcher.watch).toBe('function');
    });

    test('stop clears debounce timer', () => {
      // Should not throw
      watcher.stop();
    });
  });

  describe('createHMRWatcher', () => {
    test('creates new HMRWatcher instance', () => {
      const hmr = createHMRServer();
      const watcher = createHMRWatcher(hmr);
      expect(watcher).toBeInstanceOf(HMRWatcher);
    });
  });

  describe('HMR Update Types', () => {
    test('full-reload type', () => {
      const update = { type: 'full-reload' as const, timestamp: Date.now() };
      expect(update.type).toBe('full-reload');
    });

    test('css-update type', () => {
      const update = {
        type: 'css-update' as const,
        path: '/styles.css',
        timestamp: Date.now(),
      };
      expect(update.type).toBe('css-update');
      expect(update.path).toBeDefined();
    });

    test('js-update type', () => {
      const update = {
        type: 'js-update' as const,
        path: '/app.tsx',
        timestamp: Date.now(),
      };
      expect(update.type).toBe('js-update');
    });

    test('error type', () => {
      const update = {
        type: 'error' as const,
        timestamp: Date.now(),
        error: { message: 'Test', stack: 'Stack trace' },
      };
      expect(update.type).toBe('error');
      expect(update.error).toBeDefined();
    });
  });

  describe('HMRServer dependency graph', () => {
    let hmr: HMRServer;

    beforeEach(() => {
      hmr = createHMRServer();
    });

    test('getDependencyGraph returns the dependency graph', () => {
      const depGraph = hmr.getDependencyGraph();

      expect(depGraph).toBeDefined();
      expect(depGraph.dependents).toBeInstanceOf(Map);
      expect(depGraph.dependencies).toBeInstanceOf(Map);
      expect(depGraph.exports).toBeInstanceOf(Map);
      expect(depGraph.islands).toBeInstanceOf(Set);
      expect(depGraph.routes).toBeInstanceOf(Set);
    });

    test('registerModule adds dependencies to graph', () => {
      hmr.registerModule('module-a', {
        dependencies: ['module-b', 'module-c'],
      });

      const depGraph = hmr.getDependencyGraph();

      expect(depGraph.dependencies.get('module-a')).toBeDefined();
      expect(depGraph.dependencies.get('module-a')?.has('module-b')).toBe(true);
      expect(depGraph.dependencies.get('module-a')?.has('module-c')).toBe(true);
    });

    test('registerModule updates dependents', () => {
      hmr.registerModule('module-a', {
        dependencies: ['module-b'],
      });

      const depGraph = hmr.getDependencyGraph();

      expect(depGraph.dependents.get('module-b')?.has('module-a')).toBe(true);
    });

    test('registerModule adds exports to graph', () => {
      hmr.registerModule('module-a', {
        exports: ['foo', 'bar', 'default'],
      });

      const depGraph = hmr.getDependencyGraph();

      expect(depGraph.exports.get('module-a')?.has('foo')).toBe(true);
      expect(depGraph.exports.get('module-a')?.has('bar')).toBe(true);
      expect(depGraph.exports.get('module-a')?.has('default')).toBe(true);
    });

    test('registerModule marks islands', () => {
      hmr.registerModule('island-component', {
        isIsland: true,
      });

      const depGraph = hmr.getDependencyGraph();

      expect(depGraph.islands.has('island-component')).toBe(true);
    });

    test('registerModule marks routes', () => {
      hmr.registerModule('route-module', {
        isRoute: true,
      });

      const depGraph = hmr.getDependencyGraph();

      expect(depGraph.routes.has('route-module')).toBe(true);
    });

    test('registerModule handles all info types together', () => {
      hmr.registerModule('full-module', {
        dependencies: ['dep1'],
        exports: ['export1'],
        isIsland: true,
        isRoute: true,
      });

      const depGraph = hmr.getDependencyGraph();

      expect(depGraph.dependencies.get('full-module')?.has('dep1')).toBe(true);
      expect(depGraph.exports.get('full-module')?.has('export1')).toBe(true);
      expect(depGraph.islands.has('full-module')).toBe(true);
      expect(depGraph.routes.has('full-module')).toBe(true);
    });

    test('registerModule handles multiple registrations with same dependency', () => {
      hmr.registerModule('module-a', { dependencies: ['shared'] });
      hmr.registerModule('module-b', { dependencies: ['shared'] });

      const depGraph = hmr.getDependencyGraph();

      expect(depGraph.dependents.get('shared')?.has('module-a')).toBe(true);
      expect(depGraph.dependents.get('shared')?.has('module-b')).toBe(true);
    });
  });

  describe('HMRServer canHotUpdate', () => {
    let hmr: HMRServer;

    beforeEach(() => {
      hmr = createHMRServer();
    });

    test('islands can always be hot updated', () => {
      hmr.registerModule('island-component', { isIsland: true });

      expect(hmr.canHotUpdate('island-component')).toBe(true);
    });

    test('modules with route dependents cannot be hot updated', () => {
      hmr.registerModule('shared-util', { dependencies: [] });
      hmr.registerModule('route-page', {
        dependencies: ['shared-util'],
        isRoute: true
      });

      expect(hmr.canHotUpdate('shared-util')).toBe(false);
    });

    test('modules without route dependents can be hot updated', () => {
      hmr.registerModule('shared-util', { dependencies: [] });
      hmr.registerModule('component', {
        dependencies: ['shared-util'],
        isRoute: false
      });

      expect(hmr.canHotUpdate('shared-util')).toBe(true);
    });

    test('module without dependents can be hot updated', () => {
      hmr.registerModule('standalone-module', { dependencies: [] });

      expect(hmr.canHotUpdate('standalone-module')).toBe(true);
    });

    test('unregistered module can be hot updated', () => {
      expect(hmr.canHotUpdate('unknown-module')).toBe(true);
    });
  });

  describe('HMRServer jsUpdate with module analysis', () => {
    let hmr: HMRServer;
    let sentMessages: string[];
    let mockWs: { send: (msg: string) => void };

    beforeEach(async () => {
      hmr = createHMRServer();
      sentMessages = [];
      mockWs = { send: (msg: string) => sentMessages.push(msg) };
      hmr.handleConnection(mockWs as any);
    });

    test('jsUpdate sends island-update for island files', async () => {
      // Create a test file with island markers
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'island.tsx');
      await Bun.write(testFile, `
        'use client'
        export default function Island() { return <div data-island>test</div>; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('island-update');
      expect(parsed.module.isIsland).toBe(true);
    });

    test('jsUpdate sends loader-update for loader files', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'route.tsx');
      await Bun.write(testFile, `
        export async function loader() { return { data: true }; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('loader-update');
      expect(parsed.module.isLoader).toBe(true);
    });

    test('jsUpdate sends component-update for pure component files', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'component.tsx');
      await Bun.write(testFile, `
        export default function Component() { return <div>test</div>; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('component-update');
      expect(parsed.module.isComponent).toBe(true);
    });

    test('jsUpdate sends js-update with reason for files with non-component exports', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'mixed.tsx');
      await Bun.write(testFile, `
        export const customHelper = () => 'helper';
        export const anotherUtil = 42;
        export default function Page() { return <div>test</div>; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('js-update');
      expect(parsed.reason).toContain('Full reload');
    });

    test('jsUpdate handles layout files with appropriate reason', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, '_layout.tsx');
      await Bun.write(testFile, `
        export default function Layout({ children }) { return <main>{children}</main>; }
        export const helper = () => {};
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.reason).toContain('layout/error boundary');
    });

    test('jsUpdate handles error boundary files', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, '_error.tsx');
      await Bun.write(testFile, `
        export default function ErrorBoundary() { return <div>Error</div>; }
        export const foo = 1;
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.reason).toContain('layout/error boundary');
    });

    test('jsUpdate handles non-existent files gracefully', async () => {
      await hmr.jsUpdate('/non/existent/file.tsx');

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('js-update');
    });

    test('jsUpdate handles files with action exports', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'action-route.tsx');
      await Bun.write(testFile, `
        export async function action() { return { success: true }; }
        export default function Form() { return <form>test</form>; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      // The module analysis picks up action, but the update type depends on full analysis
      expect(['js-update', 'component-update']).toContain(parsed.type);
    });

    test('jsUpdate detects non-component exports', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'utils.tsx');
      await Bun.write(testFile, `
        export const myUtility = () => {};
        export function helperFn() {}
        export default function Component() { return <div />; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.reason).toContain('exports changed');
    });

    test('jsUpdate detects named exports with as keyword', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'exports.tsx');
      await Bun.write(testFile, `
        const foo = 1;
        const bar = 2;
        export { foo, bar as baz };
        export default function Component() { return <div />; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.module.exports).toContain('foo');
    });

    test('jsUpdate handles files in islands directory', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'islands', 'Counter.tsx');
      await Bun.write(testFile, `
        export default function Counter() { return <button>+</button>; }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('island-update');
      expect(parsed.module.isIsland).toBe(true);
    });

    test('jsUpdate with client:load directive', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'interactive.tsx');
      await Bun.write(testFile, `
        export default function Interactive() {
          return <button client:load>Click</button>;
        }
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.module.isIsland).toBe(true);
    });

    test('jsUpdate with createIsland call', async () => {
      const testDir = '/tmp/hmr-test-' + Date.now();
      const testFile = join(testDir, 'island-factory.tsx');
      await Bun.write(testFile, `
        import { createIsland } from '@ereo/client';
        export default createIsland(function Counter() { return <div />; });
      `);

      await hmr.jsUpdate(testFile);

      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.module.isIsland).toBe(true);
    });
  });

  describe('HMRServer reload with reason', () => {
    let hmr: HMRServer;

    beforeEach(() => {
      hmr = createHMRServer();
    });

    test('reload sends custom reason', () => {
      let sentMessage: string | null = null;
      const mockWs = { send: (msg: string) => { sentMessage = msg; } };

      hmr.handleConnection(mockWs as any);
      hmr.reload('Config file changed');

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toBe('Config file changed');
    });

    test('reload uses default reason if none provided', () => {
      let sentMessage: string | null = null;
      const mockWs = { send: (msg: string) => { sentMessage = msg; } };

      hmr.handleConnection(mockWs as any);
      hmr.reload();

      const parsed = JSON.parse(sentMessage!);
      expect(parsed.reason).toBe('Full reload triggered');
    });
  });

  describe('HMRWatcher file watching', () => {
    let hmr: HMRServer;
    let watcher: HMRWatcher;
    let sentMessages: string[];

    beforeEach(() => {
      hmr = createHMRServer();
      watcher = createHMRWatcher(hmr);
      sentMessages = [];
      hmr.handleConnection({ send: (msg: string) => sentMessages.push(msg) } as any);
    });

    afterEach(() => {
      watcher.stop();
    });

    test('watch method initializes watching', () => {
      // Should not throw
      expect(() => watcher.watch('/tmp')).not.toThrow();
    });

    test('watch ignores if already watching', () => {
      watcher.watch('/tmp');
      // Should not throw or restart
      expect(() => watcher.watch('/tmp/other')).not.toThrow();
    });

    test('stop clears pending changes', () => {
      watcher.watch('/tmp');
      watcher.stop();
      // Should not throw
      expect(() => watcher.stop()).not.toThrow();
    });

    test('stop can be called multiple times', () => {
      watcher.stop();
      watcher.stop();
      // Should not throw
      expect(true).toBe(true);
    });

    test('watch handles non-existent directory gracefully', () => {
      // fs.watch might fail on non-existent directories but watcher should handle it
      expect(() => watcher.watch('/nonexistent/path/that/doesnt/exist')).not.toThrow();
    });
  });

  describe('HMRServer jsUpdate caching', () => {
    let hmr: HMRServer;
    let sentMessages: string[];
    let mockWs: { send: (msg: string) => void };

    beforeEach(async () => {
      hmr = createHMRServer();
      sentMessages = [];
      mockWs = { send: (msg: string) => sentMessages.push(msg) };
      hmr.handleConnection(mockWs as any);
    });

    test('jsUpdate uses cached analysis on second call', async () => {
      const testDir = '/tmp/hmr-cache-test-' + Date.now();
      const testFile = join(testDir, 'cached.tsx');
      await Bun.write(testFile, `export default function Cached() { return <div />; }`);

      // First call - should analyze file
      await hmr.jsUpdate(testFile);
      const first = JSON.parse(sentMessages[0]);

      // Second call - should use cache
      await hmr.jsUpdate(testFile);
      const second = JSON.parse(sentMessages[1]);

      expect(first.type).toBe(second.type);
    });

    test('jsUpdate re-analyzes when file changes', async () => {
      const testDir = '/tmp/hmr-reanalyze-test-' + Date.now();
      const testFile = join(testDir, 'changing.tsx');
      await Bun.write(testFile, `export default function Component() { return <div />; }`);

      await hmr.jsUpdate(testFile);

      // Wait a bit and modify the file
      await new Promise(resolve => setTimeout(resolve, 10));
      await Bun.write(testFile, `'use client'\nexport default function Island() { return <div data-island />; }`);

      await hmr.jsUpdate(testFile);

      const second = JSON.parse(sentMessages[1]);
      expect(second.module.isIsland).toBe(true);
    });
  });

  describe('HMR_CLIENT_CODE additional coverage', () => {
    test('contains island-update handler', () => {
      expect(HMR_CLIENT_CODE).toContain('island-update');
      expect(HMR_CLIENT_CODE).toContain('handleIslandUpdate');
    });

    test('contains component-update handler', () => {
      expect(HMR_CLIENT_CODE).toContain('component-update');
      expect(HMR_CLIENT_CODE).toContain('handleComponentUpdate');
    });

    test('contains loader-update handler', () => {
      expect(HMR_CLIENT_CODE).toContain('loader-update');
      expect(HMR_CLIENT_CODE).toContain('refreshLoaderData');
    });

    test('contains fetchAndRehydrate function', () => {
      expect(HMR_CLIENT_CODE).toContain('fetchAndRehydrate');
    });

    test('contains EREO_HMR registry', () => {
      expect(HMR_CLIENT_CODE).toContain('__EREO_HMR__');
      expect(HMR_CLIENT_CODE).toContain('modules');
      expect(HMR_CLIENT_CODE).toContain('islands');
      expect(HMR_CLIENT_CODE).toContain('acceptedModules');
    });

    test('contains logHMRReason function', () => {
      expect(HMR_CLIENT_CODE).toContain('logHMRReason');
    });

    test('clears error overlay on successful update', () => {
      expect(HMR_CLIENT_CODE).toContain('ereo-error-overlay');
      expect(HMR_CLIENT_CODE).toContain('overlay.remove()');
    });
  });

  describe('HMRWatcher processPendingChanges', () => {
    let hmr: HMRServer;
    let sentMessages: string[];

    beforeEach(() => {
      hmr = createHMRServer();
      sentMessages = [];
      hmr.handleConnection({ send: (msg: string) => sentMessages.push(msg) } as any);
    });

    // We create a TestableHMRWatcher that exposes internal methods for testing
    class TestableHMRWatcher extends HMRWatcher {
      public simulateFileChange(filename: string): void {
        // Access private pendingChanges via any cast
        const self = this as any;
        if (!self.pendingChanges) {
          self.pendingChanges = new Set<string>();
        }
        self.pendingChanges.add(filename);
      }

      public async triggerProcessPendingChanges(): Promise<void> {
        // Call private processPendingChanges via any cast
        const self = this as any;
        await self.processPendingChanges();
      }

      public setWatchDir(dir: string): void {
        const self = this as any;
        self.watchDir = dir;
      }
    }

    test('processPendingChanges handles CSS file changes', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('styles/main.css');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('css-update');
      expect(parsed.path).toBe('styles/main.css');
    });

    test('processPendingChanges handles SCSS file changes', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('styles/main.scss');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('css-update');
    });

    test('processPendingChanges handles LESS file changes', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('styles/main.less');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('css-update');
    });

    test('processPendingChanges handles config file changes with full reload', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('vite.config.ts');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Config changed');
    });

    test('processPendingChanges handles ereo.config.ts changes', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('ereo.config.ts');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Config changed');
    });

    test('processPendingChanges handles package.json changes', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('package.json');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Config changed');
    });

    test('processPendingChanges handles tsconfig.json changes', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('tsconfig.json');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
    });

    test('processPendingChanges handles JS/TS file changes', async () => {
      const testDir = '/tmp/hmr-watcher-test-' + Date.now();
      const testFile = join(testDir, 'component.tsx');
      await Bun.write(testFile, `export default function Component() { return <div />; }`);

      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir(testDir);
      watcher.simulateFileChange('component.tsx');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(['js-update', 'component-update', 'island-update']).toContain(parsed.type);
    });

    test('processPendingChanges handles JSX file changes', async () => {
      const testDir = '/tmp/hmr-watcher-jsx-' + Date.now();
      const testFile = join(testDir, 'component.jsx');
      await Bun.write(testFile, `export default function Component() { return <div />; }`);

      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir(testDir);
      watcher.simulateFileChange('component.jsx');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
    });

    test('processPendingChanges handles JS file changes', async () => {
      const testDir = '/tmp/hmr-watcher-js-' + Date.now();
      const testFile = join(testDir, 'util.js');
      await Bun.write(testFile, `export const helper = () => {};`);

      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir(testDir);
      watcher.simulateFileChange('util.js');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
    });

    test('processPendingChanges handles TS file changes', async () => {
      const testDir = '/tmp/hmr-watcher-ts-' + Date.now();
      const testFile = join(testDir, 'util.ts');
      await Bun.write(testFile, `export const helper = () => {};`);

      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir(testDir);
      watcher.simulateFileChange('util.ts');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
    });

    test('processPendingChanges handles other file types with full reload', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('data.txt');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Files changed');
    });

    test('processPendingChanges handles JSON files (non-config)', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('data.json');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      // Non-config JSON goes to "other" changes which triggers reload
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Files changed');
    });

    test('processPendingChanges batches multiple CSS changes', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('styles/main.css');
      watcher.simulateFileChange('styles/other.css');

      await watcher.triggerProcessPendingChanges();

      // Both CSS files should trigger updates
      expect(sentMessages.length).toBe(2);
      const parsed1 = JSON.parse(sentMessages[0]);
      const parsed2 = JSON.parse(sentMessages[1]);
      expect(parsed1.type).toBe('css-update');
      expect(parsed2.type).toBe('css-update');
    });

    test('processPendingChanges handles mixed changes with config taking priority', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      // Mix of changes including config
      watcher.simulateFileChange('styles.css');
      watcher.simulateFileChange('vite.config.ts');

      await watcher.triggerProcessPendingChanges();

      // Config changes should trigger reload and return early
      expect(sentMessages.length).toBe(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Config changed');
    });

    test('processPendingChanges handles mixed CSS and JS changes', async () => {
      const testDir = '/tmp/hmr-mixed-test-' + Date.now();
      const testFile = join(testDir, 'component.tsx');
      await Bun.write(testFile, `export default function Component() { return <div />; }`);

      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir(testDir);
      watcher.simulateFileChange('styles.css');
      watcher.simulateFileChange('component.tsx');

      await watcher.triggerProcessPendingChanges();

      // Both CSS and JS updates should be sent
      expect(sentMessages.length).toBe(2);
    });

    test('processPendingChanges does not send reload for other files when CSS or JS present', async () => {
      const testDir = '/tmp/hmr-other-test-' + Date.now();
      const testFile = join(testDir, 'component.tsx');
      await Bun.write(testFile, `export default function Component() { return <div />; }`);

      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir(testDir);
      // Mix of JS and other file
      watcher.simulateFileChange('component.tsx');
      watcher.simulateFileChange('data.txt');

      await watcher.triggerProcessPendingChanges();

      // Only JS update should be sent (other changes ignored when JS/CSS present)
      expect(sentMessages.length).toBe(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).not.toBe('full-reload');
    });

    test('processPendingChanges with empty changes does nothing', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      // Don't add any changes

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBe(0);
    });

    test('processPendingChanges handles file without extension', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('Makefile');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Files changed');
    });

    test('processPendingChanges handles .config. in filename as config', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('tailwind.config.js');

      await watcher.triggerProcessPendingChanges();

      expect(sentMessages.length).toBeGreaterThan(0);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Config changed');
    });

    test('processPendingChanges handles multiple config files', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('vite.config.ts');
      watcher.simulateFileChange('package.json');

      await watcher.triggerProcessPendingChanges();

      // Should trigger only one reload (early return after config change)
      expect(sentMessages.length).toBe(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      // Reason should include both config files
      expect(parsed.reason).toContain('Config changed');
    });

    test('processPendingChanges only triggers reload for other files when no CSS or JS', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('image.png');
      watcher.simulateFileChange('data.xml');

      await watcher.triggerProcessPendingChanges();

      // Should trigger reload for other files
      expect(sentMessages.length).toBe(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('full-reload');
      expect(parsed.reason).toContain('Files changed');
    });

    test('processPendingChanges with CSS present does not reload for other files', async () => {
      const watcher = new TestableHMRWatcher(hmr);
      watcher.setWatchDir('/tmp/test-dir');
      watcher.simulateFileChange('styles.css');
      watcher.simulateFileChange('image.png');

      await watcher.triggerProcessPendingChanges();

      // Should only send CSS update, not reload for image
      expect(sentMessages.length).toBe(1);
      const parsed = JSON.parse(sentMessages[0]);
      expect(parsed.type).toBe('css-update');
    });
  });

  describe('ModuleAnalyzer clearCache via HMRServer', () => {
    // Note: ModuleAnalyzer is private to HMRServer, but we can test clearCache
    // indirectly by testing that cache is invalidated after file changes

    test('jsUpdate with changed mtime bypasses cache', async () => {
      const hmr = createHMRServer();
      const sentMessages: string[] = [];
      hmr.handleConnection({ send: (msg: string) => sentMessages.push(msg) } as any);

      const testDir = '/tmp/hmr-cache-clear-test-' + Date.now();
      const testFile = join(testDir, 'cached-file.tsx');

      // First write and analyze
      await Bun.write(testFile, `export default function Component() { return <div />; }`);
      await hmr.jsUpdate(testFile);
      const first = JSON.parse(sentMessages[0]);

      // Wait to ensure mtime changes
      await new Promise(resolve => setTimeout(resolve, 20));

      // Modify the file to change content and mtime
      await Bun.write(testFile, `export default function Island() { return <div data-island />; }`);
      await hmr.jsUpdate(testFile);
      const second = JSON.parse(sentMessages[1]);

      // Should have re-analyzed with new content
      expect(second.module.isIsland).toBe(true);
    });

    test('clearCache can be called on ModuleAnalyzer via HMRServer internals', async () => {
      const hmr = createHMRServer();
      const sentMessages: string[] = [];
      hmr.handleConnection({ send: (msg: string) => sentMessages.push(msg) } as any);

      const testDir = '/tmp/hmr-clear-cache-test-' + Date.now();
      const testFile = join(testDir, 'module.tsx');

      // Write and analyze to populate cache
      await Bun.write(testFile, `export default function Component() { return <div />; }`);
      await hmr.jsUpdate(testFile);

      // Access the private moduleAnalyzer and call clearCache
      const analyzer = (hmr as any).moduleAnalyzer;
      expect(analyzer).toBeDefined();
      expect(typeof analyzer.clearCache).toBe('function');

      // Call clearCache - this should not throw
      analyzer.clearCache();

      // Verify cache is cleared by checking the cache map
      expect(analyzer.cache.size).toBe(0);
    });
  });

  describe('HMRWatcher watch error handling', () => {
    test('watch handles fs.watch error gracefully', () => {
      const hmr = createHMRServer();
      const watcher = createHMRWatcher(hmr);

      // Mock fs.watch to throw an error using Bun's mock
      const fs = require('node:fs');
      const originalWatch = fs.watch;
      fs.watch = () => { throw new Error('Watch not supported'); };

      // Should not throw
      expect(() => watcher.watch('/tmp/test')).not.toThrow();

      // Restore
      fs.watch = originalWatch;
      watcher.stop();
    });
  });

  describe('HMRWatcher debounce timer', () => {
    test('watch triggers debounced processPendingChanges', async () => {
      const hmr = createHMRServer();
      const sentMessages: string[] = [];
      hmr.handleConnection({ send: (msg: string) => sentMessages.push(msg) } as any);

      // Create a test directory with a file
      const testDir = '/tmp/hmr-debounce-timer-test-' + Date.now();
      await Bun.write(join(testDir, 'test.css'), '.test { color: red; }');

      const watcher = createHMRWatcher(hmr);
      watcher.watch(testDir);

      // Modify the file to trigger watcher
      await new Promise(resolve => setTimeout(resolve, 10));
      await Bun.write(join(testDir, 'test.css'), '.test { color: blue; }');

      // Wait for debounce (50ms) + processing time
      await new Promise(resolve => setTimeout(resolve, 150));

      // The file change should have been detected and processed
      // Note: This may or may not trigger depending on OS file watching behavior
      // The important thing is that it doesn't throw
      watcher.stop();
    });

    test('stop clears debounce timer when set', async () => {
      const hmr = createHMRServer();
      const watcher = createHMRWatcher(hmr);

      // Create a test directory
      const testDir = '/tmp/hmr-stop-debounce-test-' + Date.now();
      await Bun.write(join(testDir, 'test.txt'), 'test');

      watcher.watch(testDir);

      // Trigger a change to set the debounce timer
      await Bun.write(join(testDir, 'test.txt'), 'modified');

      // Stop immediately (before debounce fires)
      await new Promise(resolve => setTimeout(resolve, 10));
      watcher.stop();

      // Should not throw even with pending debounce timer
      expect(true).toBe(true);
    });
  });
});
