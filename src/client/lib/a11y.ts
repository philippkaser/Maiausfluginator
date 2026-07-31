/**
 * What every layer over the page owes the keyboard.
 *
 * There are two of them — the sheet and the photo lightbox — and they had
 * started to grow their own slightly different versions of the same four
 * obligations. One implementation instead, so a fix reaches both:
 *
 *   - focus moves into the layer, and returns to whatever opened it
 *   - Tab cannot walk out of it
 *   - the page behind cannot scroll, and does not shift when it stops
 *   - Escape closes it
 *
 * The last one stays with each caller, because only the caller knows whether
 * closing means "dismiss" or "play the exit animation first".
 */

import { useEffect, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Move focus in, keep it in, hand it back.
 *
 * Handing it back is the part that is easy to skip and most annoying to live
 * without: close a sheet without it and the caret is at the top of the document,
 * so a keyboard user has to walk all the way back to where they were.
 */
export function useFocusTrap(container: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const element = container.current;

    // If something inside already has focus, it asked for it (an autoFocus
    // field, say) and knows better than we do where the caret belongs.
    const alreadyInside = returnTo && element?.contains(returnTo);
    if (!alreadyInside) {
      const first = element?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? element)?.focus({ preventScroll: true });
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const root = container.current;
      if (!root) return;

      // offsetParent is null for anything display:none, which is how a
      // collapsed part of a form drops out of the tab order for free.
      const focusable = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const edge = event.shiftKey ? focusable[0]! : focusable[focusable.length - 1]!;
      if (document.activeElement === edge) {
        event.preventDefault();
        (event.shiftKey ? focusable[focusable.length - 1]! : focusable[0]!).focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      returnTo?.focus?.({ preventScroll: true });
    };
  }, [container]);
}

/**
 * Stop the page behind from scrolling.
 *
 * The padding is not fussiness: hiding overflow removes the scrollbar, and on a
 * platform that reserves space for one, the whole page jumps sideways as the
 * layer opens.
 */
export function useScrollLock() {
  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gutter = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, []);
}
