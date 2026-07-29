import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { initials } from "../lib/format.ts";
import { useTheme } from "../lib/theme.tsx";
import { de1 } from "../../shared/num.ts";

/* ------------------------------------------------------------------ */
/* Light                                                                */
/* ------------------------------------------------------------------ */

/**
 * Glass only looks like glass when the light moves on it. These handlers put
 * the pointer position on the element as --mx/--my; the highlight itself is a
 * radial gradient in CSS, so nothing renders in React while the mouse moves.
 */
export function useSpotlight() {
  return useMemo(
    () => ({
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        const element = event.currentTarget;
        const box = element.getBoundingClientRect();
        element.style.setProperty("--mx", `${event.clientX - box.left}px`);
        element.style.setProperty("--my", `${event.clientY - box.top}px`);
        element.dataset.spot = "on";
      },
      onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => {
        event.currentTarget.dataset.spot = "off";
      },
    }),
    [],
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                                */
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
      <path d="M2 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The mark lives in its own file — it carries a shader. */
export { Mark } from "./Mark.tsx";

/**
 * Light or dark. The system decides until someone says otherwise, and this is
 * where they say otherwise: one button, flipping to whatever it is not.
 */
export function ThemeToggle() {
  const { theme, choice, setChoice } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="iconbtn"
      onClick={() => setChoice(next)}
      aria-label={next === "light" ? "Helles Design" : "Dunkles Design"}
      title={
        choice === "system"
          ? `Systemeinstellung (${theme === "dark" ? "dunkel" : "hell"}) — umschalten`
          : next === "light"
            ? "Auf hell umschalten"
            : "Auf dunkel umschalten"
      }
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {theme === "dark" ? (
          <path
            d="M13.4 9.6A5.6 5.6 0 0 1 6.4 2.6 5.7 5.7 0 1 0 13.4 9.6z"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        ) : (
          <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <circle cx="8" cy="8" r="3.1" />
            <path d="M8 1.4v1.4M8 13.2v1.4M14.6 8h-1.4M2.8 8H1.4M12.7 3.3l-1 1M4.3 11.7l-1 1M12.7 12.7l-1-1M4.3 4.3l-1-1" />
          </g>
        )}
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Primitives                                                           */
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

/**
 * One colour for every score. Grading the bars green/amber/red turned the
 * ranking into a traffic light — the length already says who won. Rated things
 * carry the spring gradient; unrated ones stay grey.
 */
export function toneColor(score: number | null): string {
  return score === null ? "var(--text-4)" : "var(--accent)";
}

/**
 * A three-quarter gauge. SVG rather than a conic-gradient so the caps stay
 * round, the sweep can be animated, and the centre stays free for the number.
 */
export function ScoreRing({
  score,
  size = 88,
  label = "Mai-Score",
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const id = useId();
  const stroke = Math.max(4, size * 0.058);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = 0.75; // the bottom quarter stays open
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;

  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        score === null ? `${label}: noch keine Bewertung` : `${label}: ${score.toFixed(1)} von 100`
      }
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring__svg">
        <defs>
          {/* Rotated with the ring, so the gradient runs along the arc rather
              than across the box. */}
          <linearGradient id={`${id}-arc`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--ring-1)" />
            <stop offset="55%" stopColor="var(--ring-2)" />
            <stop offset="100%" stopColor="var(--ring-3)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--sunk)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * sweep} ${circumference}`}
        />
        <circle
          className="ring__arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={score === null ? "var(--text-4)" : `url(#${id}-arc)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * sweep * pct} ${circumference}`}
        />
      </svg>
      <span className="ring__inner">
        <span className="ring__value" style={{ fontSize: size * 0.27 }}>
          {score === null ? "–" : score >= 100 ? "100" : de1(score)}
        </span>
        <span className="ring__unit" style={{ fontSize: Math.max(9, size * 0.1) }}>
          {score === null ? "offen" : "Punkte"}
        </span>
      </span>
    </div>
  );
}

export function Bar({
  label,
  value,
  detail,
  max = 100,
  muted = false,
}: {
  label: string;
  value: number | null;
  detail?: string;
  max?: number;
  muted?: boolean;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="bar__head">
        <span className="bar__label">{label}</span>
        {detail && <span className="bar__value">{detail}</span>}
      </div>
      <div
        className="bar__track"
        role="meter"
        aria-valuenow={value ?? 0}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={`bar__fill${muted || value === null ? " bar__fill--muted" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function Tag({
  children,
  accent = false,
  title,
}: {
  children: ReactNode;
  accent?: boolean;
  title?: string;
}) {
  return (
    <span className={accent ? "tag tag--accent" : "tag"} title={title}>
      {children}
    </span>
  );
}

/**
 * Segmented control. The lit pill is a single element that slides between the
 * options instead of a background switching on and off — measured rather than
 * assumed equal, so labels can be any length.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      const active = track.querySelector<HTMLElement>('[aria-pressed="true"]');
      setThumb(active ? { x: active.offsetLeft, width: active.offsetWidth } : null);
    };

    measure();
    // Labels reflow with the font and the container; keep the pill on them.
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    for (const child of Array.from(track.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [value, options]);

  return (
    <div className="segmented" role="group" aria-label={label} ref={trackRef}>
      <span
        className="segmented__thumb"
        data-ready={thumb !== null}
        aria-hidden="true"
        style={{
          ["--thumb-x" as string]: `${thumb?.x ?? 0}px`,
          ["--thumb-w" as string]: `${thumb?.width ?? 0}px`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented__item"
          aria-pressed={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
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

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="card modal" style={wide ? { width: "min(880px, 100%)" } : undefined}>
        <div className="row row--between" style={{ marginBottom: 16 }}>
          <h2>{title}</h2>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Schließen
          </button>
        </div>
        {children}
      </div>
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
