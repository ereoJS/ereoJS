/**
 * @ereo/client - Link Prefetching
 *
 * Intelligent prefetching for faster navigation.
 */

/**
 * Prefetch state for a URL.
 */
interface PrefetchEntry {
  url: string;
  timestamp: number;
  data?: unknown;
  error?: Error;
  loading: boolean;
}

/**
 * Prefetch cache with bounded size.
 */
const prefetchCache = new Map<string, PrefetchEntry>();
const MAX_PREFETCH_CACHE_SIZE = 100;

/**
 * Prefetch options.
 */
export interface PrefetchOptions {
  /** Prefetch strategy */
  strategy?: 'hover' | 'viewport' | 'eager' | 'none';
  /** Cache duration in milliseconds (default: 30000) */
  cacheDuration?: number;
  /** Intersection observer threshold */
  threshold?: number;
}

/**
 * Default prefetch options.
 */
const defaultOptions: Required<PrefetchOptions> = {
  strategy: 'hover',
  cacheDuration: 30000,
  threshold: 0,
};

/**
 * Check if prefetch cache entry is valid.
 */
function isCacheValid(entry: PrefetchEntry, cacheDuration: number): boolean {
  return Date.now() - entry.timestamp < cacheDuration;
}

function normalizePrefetchUrl(url: string): string {
  if (typeof window !== 'undefined') {
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin !== window.location.origin) {
        return url;
      }
      return parsed.pathname + parsed.search;
    } catch {
      return url;
    }
  }

  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function isSameOriginHref(href: string): boolean {
  if (typeof window === 'undefined' || !href) {
    return false;
  }

  try {
    return new URL(href, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Prefetch a URL.
 */
export async function prefetch(url: string): Promise<void> {
  const cacheKey = normalizePrefetchUrl(url);

  // Check cache — skip if already loaded or currently loading
  const cached = prefetchCache.get(cacheKey);
  if (cached) {
    if (cached.loading || isCacheValid(cached, defaultOptions.cacheDuration)) {
      return;
    }
    // Evict expired or failed entries so they don't accumulate indefinitely
    prefetchCache.delete(cacheKey);
  }

  // Evict oldest entries if cache is full
  if (prefetchCache.size >= MAX_PREFETCH_CACHE_SIZE) {
    // Delete the oldest (first inserted) entry
    const firstKey = prefetchCache.keys().next().value;
    if (firstKey !== undefined) {
      prefetchCache.delete(firstKey);
    }
  }

  // Create entry
  const entry: PrefetchEntry = {
    url: cacheKey,
    timestamp: Date.now(),
    loading: true,
  };
  prefetchCache.set(cacheKey, entry);

  try {
    // Prefetch using fetch with low priority
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Prefetch': 'true',
      },
      priority: 'low' as RequestInit['priority'],
    });

    if (response.ok) {
      entry.data = await response.json();
    } else {
      entry.error = new Error(`Prefetch failed: ${response.status}`);
    }
  } catch (error) {
    entry.error = error instanceof Error ? error : new Error('Prefetch failed');
  } finally {
    entry.loading = false;
  }
}

/**
 * Get prefetched data.
 */
export function getPrefetchedData<T>(url: string): T | undefined {
  const entry = prefetchCache.get(normalizePrefetchUrl(url));
  if (entry && isCacheValid(entry, defaultOptions.cacheDuration) && entry.data) {
    return entry.data as T;
  }
  return undefined;
}

/**
 * Clear prefetch cache.
 */
export function clearPrefetchCache(): void {
  prefetchCache.clear();
}

/**
 * Setup prefetch for a link element.
 */
export function setupLinkPrefetch(
  element: HTMLAnchorElement,
  options: PrefetchOptions = {}
): () => void {
  const { strategy, threshold } = { ...defaultOptions, ...options };
  const href = element.href;

  if (!isSameOriginHref(href)) {
    return () => {};
  }

  const url = normalizePrefetchUrl(href);
  let cleanup: (() => void) | null = null;

  switch (strategy) {
    case 'hover': {
      const onMouseEnter = () => prefetch(url);
      element.addEventListener('mouseenter', onMouseEnter);
      cleanup = () => element.removeEventListener('mouseenter', onMouseEnter);
      break;
    }

    case 'viewport': {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              prefetch(url);
              observer.disconnect();
              break;
            }
          }
        },
        { threshold }
      );
      observer.observe(element);
      cleanup = () => observer.disconnect();
      break;
    }

    case 'eager': {
      prefetch(url);
      break;
    }

    case 'none':
    default:
      // No prefetching
      break;
  }

  return () => {
    if (cleanup) cleanup();
  };
}

/** Track active auto-prefetch cleanup to prevent duplicate observers on HMR */
let activeAutoPrefetchCleanup: (() => void) | null = null;

/**
 * Auto-setup prefetching for all links.
 */
export function setupAutoPrefetch(options: PrefetchOptions = {}): () => void {
  if (typeof document === 'undefined') return () => {};

  // Clean up previous observer if called again (e.g., during HMR)
  if (activeAutoPrefetchCleanup) {
    activeAutoPrefetchCleanup();
    activeAutoPrefetchCleanup = null;
  }

  // Track which elements have been set up to avoid duplicates
  const setupElements = new WeakSet<Element>();
  // Map element → cleanup to support removal tracking
  const elementCleanups = new Map<Element, () => void>();

  function setupElement(link: HTMLAnchorElement): void {
    if (setupElements.has(link)) return;
    setupElements.add(link);
    const cleanupFn = setupLinkPrefetch(link, options);
    elementCleanups.set(link, cleanupFn);
  }

  // Setup existing links
  const links = document.querySelectorAll('a[href]');
  links.forEach((link) => setupElement(link as HTMLAnchorElement));

  // Watch for new and removed links
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Handle added nodes
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLAnchorElement && isSameOriginHref(node.href)) {
          setupElement(node);
        }
        if (node instanceof Element) {
          const newLinks = node.querySelectorAll('a[href]');
          newLinks.forEach((link) => setupElement(link as HTMLAnchorElement));
        }
      }
      // Handle removed nodes — clean up their listeners
      for (const node of mutation.removedNodes) {
        if (node instanceof HTMLAnchorElement) {
          const fn = elementCleanups.get(node);
          if (fn) { fn(); elementCleanups.delete(node); }
        }
        if (node instanceof Element) {
          const removedLinks = node.querySelectorAll('a[href]');
          removedLinks.forEach((link) => {
            const fn = elementCleanups.get(link);
            if (fn) { fn(); elementCleanups.delete(link); }
          });
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  const cleanup = () => {
    observer.disconnect();
    for (const fn of elementCleanups.values()) {
      fn();
    }
    elementCleanups.clear();
    if (activeAutoPrefetchCleanup === cleanup) {
      activeAutoPrefetchCleanup = null;
    }
  };

  activeAutoPrefetchCleanup = cleanup;
  return cleanup;
}

/**
 * Prefetch multiple URLs.
 */
export async function prefetchAll(urls: string[]): Promise<void> {
  await Promise.all(urls.map(prefetch));
}

/**
 * Create a link prefetch directive for JSX.
 */
export interface LinkPrefetchProps {
  href: string;
  prefetch?: PrefetchOptions['strategy'];
  children: React.ReactNode;
}

/**
 * Check if a URL is being prefetched.
 */
export function isPrefetching(url: string): boolean {
  const entry = prefetchCache.get(normalizePrefetchUrl(url));
  return entry?.loading ?? false;
}

/**
 * Check if a URL has been prefetched.
 */
export function isPrefetched(url: string): boolean {
  const entry = prefetchCache.get(normalizePrefetchUrl(url));
  return entry?.data !== undefined;
}
