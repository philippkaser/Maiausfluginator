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

/**
 * The mark: an isometric cube whose three faces catch the light differently —
 * the top lit by the spring gradient, the sides falling away into the ground.
 */
export function Mark({ size = 26 }: { size?: number }) {
  const id = useId();
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d8f78c" />
          <stop offset="100%" stopColor="#6fe6c4" />
        </linearGradient>
        <linearGradient id={`${id}-left`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6fe6c4" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#6fe6c4" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      <path d="M12 2.4 21.2 7.6 12 12.8 2.8 7.6z" fill={`url(#${id}-top)`} />
      <path d="M2.8 7.6 12 12.8v8.8L2.8 16.4z" fill={`url(#${id}-left)`} />
      <path d="M21.2 7.6 12 12.8v8.8l9.2-5.2z" fill={`url(#${id}-right)`} />
      <path
        d="M12 2.4 21.2 7.6v8.8L12 21.6l-9.2-5.2V7.6z"
        stroke="rgba(255,255,255,0.34)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
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
  return score === null ? "rgba(255,255,255,0.2)" : "var(--accent)";
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
            <stop offset="0%" stopColor="#7ce9c8" />
            <stop offset="55%" stopColor="#a9ee9b" />
            <stop offset="100%" stopColor="#cbf172" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
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
          stroke={score === null ? "rgba(255,255,255,0.16)" : `url(#${id}-arc)`}
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
