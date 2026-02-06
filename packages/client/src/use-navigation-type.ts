/**
 * @ereo/client - useNavigationType Hook
 *
 * Returns the type of the current navigation ('push' | 'replace' | 'pop').
 */

import { useState, useEffect } from 'react';
import { router } from './navigation';

export type NavigationType = 'push' | 'replace' | 'pop';

/**
 * Hook that returns the type of the most recent navigation.
 * Defaults to 'push'.
 *
 * @example
 * ```tsx
 * const navigationType = useNavigationType();
 * // 'push' | 'replace' | 'pop'
 * ```
 */
export function useNavigationType(): NavigationType {
  const [type, setType] = useState<NavigationType>('push');

  useEffect(() => {
    return router.subscribe((event) => {
      setType(event.type);
    });
  }, []);

  return type;
}
