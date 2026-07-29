import { useEffect, type ReactNode } from "react";
import { initials } from "../lib/format.ts";
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
      <path d="M2 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The mark: an isometric cube, drawn in one weight. */
export function Mark({ size = 26 }: { size?: number }) {
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
      <path
        d="M12 2.6 21 7.7v8.6L12 21.4 3 16.3V7.7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M3 7.7 12 12.8l9-5.1M12 12.8v8.6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
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
 * One colour for every score. Grading the bars green/amber/blue turned the
 * ranking into a traffic light — the length already says who won.
 */
export function toneColor(score: number | null): string {
  return score === null ? "rgba(255,255,255,0.22)" : "var(--accent)";
}

/**
 * A three-quarter gauge. SVG rather than a conic-gradient so the caps stay
 * round and the centre stays free for the number.
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
  const stroke = Math.max(4, size * 0.055);
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * sweep} ${circumference}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * sweep * pct} ${circumference}`}
        />
      </svg>
      <span className="ring__inner">
        <span className="ring__value" style={{ fontSize: size * 0.26 }}>
          {score === null ? "–" : score >= 100 ? "100" : de1(score)}
        </span>
        <span className="ring__unit" style={{ fontSize: Math.max(9, size * 0.105) }}>
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

/** iOS-style segmented control. */
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
  return (
    <div className="segmented" role="group" aria-label={label}>
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
