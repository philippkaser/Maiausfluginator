import { useEffect, useId, type ReactNode } from "react";
import { initials } from "../lib/format.ts";
import { scoreTone } from "../../shared/scoring.ts";

export function Avatar({
  name,
  hue,
  size = "md",
}: {
  name: string;
  hue: number;
  size?: "sm" | "md" | "lg";
}) {
  const cls = size === "md" ? "avatar" : `avatar avatar--${size}`;
  return (
    <span className={cls} style={{ ["--hue" as string]: hue }} title={name} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

const RING_STOPS: Record<string, [string, string]> = {
  gold: ["#ffcf8b", "#ff9ec4"],
  green: ["#7cf5d5", "#8ee9a8"],
  blue: ["#7aa2ff", "#c792ff"],
  grey: ["rgba(255,255,255,0.28)", "rgba(255,255,255,0.2)"],
};

/**
 * A three-quarter gauge. Drawn as SVG rather than a conic-gradient so the arc
 * caps stay round and the centre stays free for the number.
 */
export function ScoreRing({
  score,
  size = 92,
  label = "Mai-Score",
}: {
  score: number | null;
  size?: number;
  label?: string;
}) {
  const tone = scoreTone(score);
  const [from, to] = RING_STOPS[tone]!;
  const gradientId = useId();

  const stroke = Math.max(5, size * 0.085);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const sweep = 0.75; // leave the bottom quarter open
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
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
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
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * sweep * pct} ${circumference}`}
        />
      </svg>
      <span className="ring__inner">
        <span className="ring__value" style={{ fontSize: size * 0.27 }}>
          {score === null ? "–" : score.toFixed(score >= 100 ? 0 : 1)}
        </span>
        <span className="ring__unit" style={{ fontSize: Math.max(7, size * 0.105) }}>
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
        <div className={`bar__fill${muted || value === null ? " bar__fill--muted" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Chip({
  children,
  tone = "default",
  title,
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "gold" | "ghost";
  title?: string;
}) {
  return (
    <span className={tone === "default" ? "chip" : `chip chip--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="row" style={{ justifyContent: "center", gap: 10 }}>
      <span className="spinner" role="status" aria-label={label ?? "Lädt"} />
      {label && <span className="muted small">{label}</span>}
    </div>
  );
}

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__mark" />
      <h3 style={{ color: "var(--text)", marginBottom: 6 }}>{title}</h3>
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
      <div className="glass glass--sheen modal" style={wide ? { width: "min(880px, 100%)" } : undefined}>
        <div className="row row--between" style={{ marginBottom: 18 }}>
          <h2>{title}</h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
            Schließen
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Small labelled block used all over the forms. */
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
