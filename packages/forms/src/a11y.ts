import type { FieldState, FormSubmitState } from './types';
import type { FormStoreInterface } from './types';

// ─── ID Generation ───────────────────────────────────────────────────────────

let idCounter = 0;

export function generateA11yId(prefix = 'ereo'): string {
  return `${prefix}-${++idCounter}`;
}

// ─── Field ARIA ──────────────────────────────────────────────────────────────

export function getFieldA11y(
  name: string,
  state: Pick<FieldState, 'errors' | 'touched'>
): Record<string, string | boolean | undefined> {
  const attrs: Record<string, string | boolean | undefined> = {};

  if (state.errors.length > 0 && state.touched) {
    attrs['aria-invalid'] = true;
    attrs['aria-describedby'] = `${name}-error`;
  }

  return attrs;
}

export function getErrorA11y(name: string): {
  id: string;
  role: string;
  'aria-live': string;
} {
  return {
    id: `${name}-error`,
    role: 'alert',
    'aria-live': 'polite',
  };
}

export function getLabelA11y(
  name: string,
  opts?: { id?: string }
): { htmlFor: string; id: string } {
  return {
    htmlFor: name,
    id: opts?.id ?? `${name}-label`,
  };
}

export function getDescriptionA11y(name: string): { id: string } {
  return {
    id: `${name}-description`,
  };
}

export function getFieldsetA11y(
  name: string,
  _legend?: string
): { role: string; 'aria-labelledby': string } {
  return {
    role: 'group',
    'aria-labelledby': `${name}-legend`,
  };
}

export function getFieldWrapperA11y(
  name: string,
  state: Pick<FieldState, 'errors' | 'touched'>
): Record<string, string | boolean | undefined> {
  const attrs: Record<string, string | boolean | undefined> = {};
  attrs['data-field'] = name;
  if (state.errors.length > 0 && state.touched) {
    attrs['data-invalid'] = true;
  }
  return attrs;
}

// ─── Form ARIA ───────────────────────────────────────────────────────────────

export function getFormA11y(
  id: string,
  opts?: { isSubmitting?: boolean }
): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {
    id,
    role: 'form',
  };
  if (opts?.isSubmitting) {
    attrs['aria-busy'] = true;
  }
  return attrs;
}

export function getErrorSummaryA11y(formId: string): {
  role: string;
  'aria-labelledby': string;
} {
  return {
    role: 'alert',
    'aria-labelledby': `${formId}-error-summary`,
  };
}

// ─── Focus Management ────────────────────────────────────────────────────────

export function focusFirstError(form: FormStoreInterface<any>): void {
  if (typeof document === 'undefined') return;

  const scrollBehavior = prefersReducedMotion() ? 'auto' as const : 'smooth' as const;

  // Try to use form's field refs first for scoped focusing
  const fieldRefs = (form as any).getFieldRefs?.() ?? (form as any)._fieldRefs;
  if (fieldRefs) {
    for (const [path, el] of fieldRefs as Map<string, HTMLElement | null>) {
      if (!el) continue;
      const errors = form.getErrors(path).get();
      if (errors.length > 0) {
        el.focus();
        el.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
        return;
      }
    }
  }

  // Fallback to global query
  const elements = document.querySelectorAll<HTMLElement>('[aria-invalid="true"]');
  const first = elements[0];
  if (first) {
    first.focus();
    first.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
  }
}

export function focusField(name: string): void {
  if (typeof document === 'undefined') return;

  const scrollBehavior = prefersReducedMotion() ? 'auto' as const : 'smooth' as const;
  const el = document.querySelector<HTMLElement>(`[name="${name}"]`);
  if (el) {
    el.focus();
    el.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
  }
}

export function trapFocus(container: HTMLElement): () => void {
  if (typeof document === 'undefined') return () => {};

  const focusableSelector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    const focusable = container.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeydown);
  return () => container.removeEventListener('keydown', handleKeydown);
}

// ─── Live Announcements ──────────────────────────────────────────────────────

let liveRegion: HTMLElement | null = null;

function getOrCreateLiveRegion(): HTMLElement {
  if (typeof document === 'undefined') {
    return { textContent: '' } as HTMLElement;
  }

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.padding = '0';
    liveRegion.style.margin = '-1px';
    liveRegion.style.overflow = 'hidden';
    liveRegion.style.clip = 'rect(0, 0, 0, 0)';
    liveRegion.style.whiteSpace = 'nowrap';
    liveRegion.style.borderWidth = '0';
    document.body.appendChild(liveRegion);
  }

  return liveRegion;
}

export function announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  const region = getOrCreateLiveRegion();
  region.setAttribute('aria-live', priority);
  // Clear and re-set to ensure announcement
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export function cleanupLiveRegion(): void {
  if (liveRegion && typeof document !== 'undefined') {
    liveRegion.remove();
    liveRegion = null;
  }
}

export function announceErrors(
  errors: Record<string, string[]>,
  opts?: { prefix?: string }
): void {
  const errorEntries = Object.entries(errors).filter(([_, msgs]) => msgs.length > 0);
  if (errorEntries.length === 0) return;

  const prefix = opts?.prefix ?? 'Form has errors:';
  const messages = errorEntries
    .map(([field, msgs]) => `${field}: ${msgs[0]}`)
    .join('. ');

  announce(`${prefix} ${messages}`, 'assertive');
}

export function announceSubmitStatus(
  status: FormSubmitState,
  opts?: { successMessage?: string; errorMessage?: string; submittingMessage?: string }
): void {
  switch (status) {
    case 'submitting':
      announce(opts?.submittingMessage ?? 'Submitting form...', 'polite');
      break;
    case 'success':
      announce(opts?.successMessage ?? 'Form submitted successfully.', 'polite');
      break;
    case 'error':
      announce(opts?.errorMessage ?? 'Form submission failed. Please check for errors.', 'assertive');
      break;
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Heuristic detection — not reliable for all screen readers.
 * Returns true if certain indicators are present, but many screen readers
 * (VoiceOver, TalkBack, Orca) are undetectable from JavaScript.
 * Prefer designing for accessibility by default rather than relying on detection.
 */
export function isScreenReaderActive(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    document.querySelector('[role="application"]') !== null ||
    window.navigator.userAgent.includes('NVDA') ||
    window.navigator.userAgent.includes('JAWS')
  );
}
