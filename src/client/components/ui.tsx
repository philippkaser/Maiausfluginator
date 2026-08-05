/**
 * The primitives.
 *
 * Every surface in the app is a `Pane`, every choice between three or four
 * options is a `Segmented`, and every proportion is a `Meter`. Keeping that
 * list short is the design: a screen that needs a fifth kind of box is usually
 * a screen asking two questions at once.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { initials } from "../lib/format.ts";
import { usePointerSheen } from "../lib/motion.ts";
import { Link } from "../lib/router.tsx";
import { de1 } from "../../shared/num.ts";

/* ------------------------------------------------------------------ */
/* Icons — hairline strokes, no fills.                                  */
/* ------------------------------------------------------------------ */

export function Chevron({ size = 10 }: { size?: number }) {
  return (
    <svg
      className="chevron"
      width={size}
      height={size * 1.6}
      viewBox="0 0 10 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 2l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The mark: an isometric cube in one weight.
 *
 * A cube because a Mai-Ausflug is a thing with sides — the plate, the view, the
 * drive — and because it is the one shape that survives being drawn 18 pixels
 * wide in a rail.
 */
export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <path
        d="M12 2.6 21 7.7v8.6L12 21.4 3 16.3V7.7z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M3 7.7 12 12.8l9-5.1M12 12.8v8.6"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Pane — the one surface                                               */
/* ------------------------------------------------------------------ */

type PaneTone = "default" | "quiet";

export function Pane({
  children,
  tone = "default",
  pad = true,
  flush = false,
  xl = false,
  className,
  as: Tag = "div",
  ...rest
}: {
  children?: ReactNode;
  tone?: PaneTone;
  /** `true` for the standard airy padding, "sm" for a tighter pane, `false` for none. */
  pad?: boolean | "sm";
  flush?: boolean;
  xl?: boolean;
  className?: string;
  as?: "div" | "section" | "article" | "aside" | "header";
} & Omit<React.HTMLAttributes<HTMLElement>, "className">) {
  const ref = usePointerSheen<HTMLDivElement>();
  // Every tag this accepts is a plain block element, so narrowing to one of them
  // for the typechecker costs nothing and keeps the ref honest.
  const Element = Tag as "div";

  const classes = [
    "pane",
    tone !== "default" && `pane--${tone}`,
    pad === true && "pane--pad",
    pad === "sm" && "pane--pad-sm",
    flush && "pane--flush",
    xl && "pane--xl",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Element ref={ref} className={classes} {...rest}>
      {children}
    </Element>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                    */
/* ------------------------------------------------------------------ */

/**
 * In both flavours the selected option is a glass thumb that slides, never a
 * background that blinks on and off.
 *
 * Measure where the thumb belongs and write it to the container as CSS
 * variables. Shared by both flavours below.
 *
 * The active item is found by class rather than by ARIA attribute, because the
 * two flavours mark "on" differently — one is a pressed button, the other is the
 * current page — and the geometry does not care which.
 */
function useSegmentThumb<T extends HTMLElement>(dependency: unknown) {
  const list = useRef<T | null>(null);
  const [measured, setMeasured] = useState(false);

  const place = useCallback(() => {
    const container = list.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(".segmented__item--on");
    if (!active) return;
    container.style.setProperty("--seg-x", `${active.offsetLeft}px`);
    container.style.setProperty("--seg-w", `${active.offsetWidth}px`);
    setMeasured(true);
  }, []);

  // A layout effect, so the thumb is never painted in the wrong place first.
  useLayoutEffect(place, [place, dependency]);

  useEffect(() => {
    const container = list.current;
    if (!container) return;
    const observer = new ResizeObserver(place);
    observer.observe(container);
    // Fraunces arriving changes every label's width; so does a window resize.
    document.fonts?.ready.then(place).catch(() => {});
    return () => observer.disconnect();
  }, [place]);

  return { list, measured, place };
}

/**
 * `choice` separates the two flavours where it matters: picking an answer gets a
 * pine thumb, going somewhere keeps plain glass. See the note in styles.css.
 */
function trackClasses(bare: boolean, block: boolean, measured: boolean, choice: boolean): string {
  return [
    "segmented",
    choice && "segmented--choice",
    bare && "segmented--bare",
    block && "segmented--block",
    !measured && "segmented--unmeasured",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Pick one of a few options — a sort order, a preset, a mode.
 *
 * These are toggle buttons in a group, not tabs. ARIA tabs promise a tabpanel
 * whose content they control, and none of these have one: they re-sort a list
 * that is already on screen. A group of buttons where exactly one is pressed
 * describes what is actually happening.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  bare = false,
  block = false,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  label?: string;
  /** In the rail the control has no track of its own — the rail is the track. */
  bare?: boolean;
  block?: boolean;
}) {
  const { list, measured } = useSegmentThumb<HTMLDivElement>(value);

  return (
    <div className={trackClasses(bare, block, measured, true)} role="group" aria-label={label} ref={list}>
      <span className="segmented__thumb" aria-hidden="true" />
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className={on ? "segmented__item segmented__item--on" : "segmented__item"}
            aria-pressed={on}
            title={option.title}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The same control, but for going somewhere.
 *
 * The three sections are places, so they are links: middle-click and ⌘-click
 * open one in a new tab, the status bar shows where it goes, and `aria-current`
 * says which one you are on. A button that calls navigate() looks identical and
 * takes all of that away.
 */
export function SegmentedNav({
  current,
  options,
  label,
  bare = false,
  block = false,
}: {
  current: string;
  options: { value: string; label: string; title?: string }[];
  label?: string;
  bare?: boolean;
  block?: boolean;
}) {
  const { list, measured } = useSegmentThumb<HTMLElement>(current);

  return (
    // Its own <nav> landmark, so the label belongs to the group rather than
    // being pasted onto every link — an aria-label on the link would replace the
    // visible word, which is exactly what a voice-control user reads out.
    <nav className={trackClasses(bare, block, measured, false)} aria-label={label} ref={list}>
      <span className="segmented__thumb" aria-hidden="true" />
      {options.map((option) => {
        const on = option.value === current;
        return (
          <Link
            key={option.value}
            to={option.value}
            className={on ? "segmented__item segmented__item--on" : "segmented__item"}
            aria-current={on ? "page" : undefined}
            title={option.title}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Meter                                                                */
/* ------------------------------------------------------------------ */

/**
 * A hairline with a pine fill. The whole vocabulary of proportion in this app.
 *
 * `value` is 0..max, or null for "nobody filled this in" — which is drawn as a
 * dashed track rather than an empty one, because a zero and a blank are
 * different facts and a bar at 0% looks like a bad score.
 */
export function Meter({
  label,
  value,
  max = 100,
  detail,
  weight,
  copper = false,
}: {
  label?: string;
  value: number | null;
  max?: number;
  detail?: string;
  /** The share of the score this component earned, as a percentage. */
  weight?: number;
  copper?: boolean;
}) {
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, value / max));

  const fillClasses = [
    "meter__fill",
    value === null && "meter__fill--empty",
    copper && "meter__fill--copper",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="meter">
      {(label || detail) && (
        <div className="meter__head">
          <span className="meter__label">
            {label}
            {weight !== undefined && (
              <span className="meter__weight"> · {Math.round(weight)} %</span>
            )}
          </span>
          {detail && <span className="meter__detail">{detail}</span>}
        </div>
      )}
      <div
        className="meter__track"
        role="meter"
        aria-valuenow={value ?? 0}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuetext={value === null ? "keine Angabe" : `${de1(value)} von ${max}`}
        aria-label={label}
      >
        <span
          className={fillClasses}
          style={{ ["--value" as string]: ratio }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small parts                                                          */
/* ------------------------------------------------------------------ */

export function Avatar({
  name,
  hue,
  size = "md",
}: {
  name: string;
  hue: number;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={size === "md" ? "avatar" : `avatar avatar--${size}`}
      style={{ ["--hue" as string]: hue }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Tag({
  children,
  tone = "plain",
  title,
}: {
  children: ReactNode;
  /** Copper marks the exceptional. Everything else is a neutral fact. */
  tone?: "plain" | "copper";
  title?: string;
}) {
  return (
    <span className={tone === "plain" ? "tag" : `tag tag--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="row" style={{ justifyContent: "center", gap: 10 }}>
      <span className="spinner" role="status" aria-label={label ?? "Lädt"} />
      {label && <span className="dim small">{label}</span>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}
