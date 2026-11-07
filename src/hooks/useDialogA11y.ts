import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface UseDialogA11yOptions {
  onClose: () => void;
  /**
   * Where focus should go on close when the element that opened the dialog
   * no longer exists (e.g. the calendar event was deleted from the dialog).
   */
  getFallbackFocus?: () => HTMLElement | null;
}

/**
 * Modal-dialog behaviour shared by the Calendar's dialogs:
 *  - Escape closes
 *  - Tab / Shift+Tab are trapped inside the dialog
 *  - page scroll is locked while open
 *  - focus moves into the dialog on open and back to the opener on close
 *
 * Attach `dialogRef` to the element with role="dialog" (give it tabIndex={-1})
 * and `handleKeyDown` to its onKeyDown.
 */
export function useDialogA11y({ onClose, getFallbackFocus }: UseDialogA11yOptions) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Always call the latest callbacks without re-subscribing listeners.
  const onCloseRef = useRef(onClose);
  const fallbackRef = useRef(getFallbackFocus);
  useEffect(() => {
    onCloseRef.current = onClose;
    fallbackRef.current = getFallbackFocus;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
      // The opener may be gone right after closing (e.g. deleted); if focus was
      // lost, hand it to the fallback on the next tick.
      setTimeout(() => {
        const active = document.activeElement;
        if (active && active !== document.body && active.isConnected) return;
        (fallbackRef.current?.() ?? (opener?.isConnected ? opener : null))?.focus();
      }, 0);
    };
  }, []);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    // The dialog container itself (tabIndex -1) counts as "before the first control".
    if (event.shiftKey && (active === first || active === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { dialogRef, handleKeyDown };
}
