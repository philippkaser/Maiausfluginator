/**
 * The sheet.
 *
 * Anything that is a setting, a form or an administrative chore happens here
 * rather than on the page: rating a trip, entering a new one, re-weighting the
 * ranking, handing out invite codes, renewing your own key. The reasoning is
 * that those things belong to the person doing them, not to the content — the
 * Rangliste is a document, and a document should not have knobs in the middle
 * of it.
 *
 * One implementation, so the accessibility is done once and done properly:
 * focus moves in and comes back out to where it was, Tab cannot leave, Escape
 * closes, the page behind cannot scroll, and the exit is animated rather than
 * cut (a sheet that vanishes instantly feels like an error, not a dismissal).
 *
 * It renders through a portal into <body>, and that is load-bearing rather than
 * tidiness. `position: fixed` is only fixed to the viewport while no ancestor
 * establishes a containing block — and a transform, a filter, a backdrop-filter
 * or `contain` all do. This app is full of them: `.page-enter` animates a
 * transform on <main>, every `.pane` and `.frost` carries a backdrop-filter, and
 * a section mid-reveal is translated. A sheet opened from inside a page would
 * therefore size itself against that ancestor instead of the screen — tall as
 * the whole document, with its footer below the fold and nothing able to
 * scroll. Portalling puts every sheet in the same place regardless of who opened
 * it, which is also why they now all behave identically.
 */

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useFocusTrap, useScrollLock } from "../lib/a11y.ts";
import { prefersReducedMotion } from "../lib/shader.ts";

/** Long enough to read as a movement, short enough not to be in the way. */
const EXIT_MS = 360;

export function Sheet({
  title,
  description,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  // Two sheets never overlap today, but generated ids cost nothing and mean the
  // labelling stays correct if one ever opens over another.
  const id = useId();

  /** Play the exit, then actually unmount. Guarded so it only ever runs once. */
  const dismiss = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      if (prefersReducedMotion()) onClose();
      else window.setTimeout(onClose, EXIT_MS);
      return true;
    });
  }, [onClose]);

  useFocusTrap(panel);
  useScrollLock();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      dismiss();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [dismiss]);

  const classes = [
    "sheet",
    wide && "sheet--wide",
    closing && "sheet--closing",
  ]
    .filter(Boolean)
    .join(" ");

  const sheet = (
    <>
      <div
        className={closing ? "scrim scrim--closing" : "scrim"}
        onClick={dismiss}
        aria-hidden="true"
      />
      <div
        className={classes}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        ref={panel}
        tabIndex={-1}
      >
        <div className="sheet__head">
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <h2 id={`${id}-title`}>{title}</h2>
            {description && (
              <p id={`${id}-description`} className="small dim">
                {description}
              </p>
            )}
          </div>
          {/* No aria-label: the visible word is the name, and a voice-control
              user says what they can see. */}
          <button type="button" className="btn btn--quiet btn--sm" onClick={dismiss}>
            Fertig
          </button>
        </div>

        <div className="sheet__body">{children}</div>

        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </>
  );

  return createPortal(sheet, document.body);
}
