/**
 * The Mai-Score.
 *
 * Every trip is boiled down to a single 0-100 number so the Ausflüge can be
 * ranked against each other. Five of the seven components come from member
 * ratings, the other two are objective: how long we waited for the food and how
 * far the restaurant is from the Durst HQ in Brixen.
 *
 * The weights are a starting point, not the truth - the client lets everyone
 * re-weight the ranking to their own taste, which is why this module is shared.
 */

import type { Dimension, TripAggregate } from "./types.ts";

export const COMPONENTS = [
  "essen",
  "erlebnis",
  "ambiente",
  "service",
  "preis",
  "wartezeit",
  "anfahrt",
] as const;

export type Component = (typeof COMPONENTS)[number];

export type Weights = Record<Component, number>;

export const COMPONENT_LABELS: Record<Component, string> = {
  essen: "Essen",
  erlebnis: "Gesamterlebnis",
  ambiente: "Ambiente",
  service: "Service",
  preis: "Preis-Leistung",
  wartezeit: "Wartezeit",
  anfahrt: "Anfahrt",
};

/** The house default. Sums to 100 for readability; any sum works. */
export const DEFAULT_WEIGHTS: Weights = {
  essen: 28,
  erlebnis: 18,
  ambiente: 12,
  service: 10,
  preis: 12,
  wartezeit: 10,
  anfahrt: 10,
};

export const WEIGHT_PRESETS: { id: string; label: string; blurb: string; weights: Weights }[] = [
  {
    id: "haus",
    label: "Hausrezept",
    blurb: "Ausgewogen – so rankt die Startseite per Default.",
    weights: DEFAULT_WEIGHTS,
  },
  {
    id: "feinschmecker",
    label: "Feinschmecker",
    blurb: "Nur der Teller zählt. Fahr ruhig zwei Stunden.",
    weights: { essen: 52, erlebnis: 18, ambiente: 12, service: 10, preis: 4, wartezeit: 4, anfahrt: 0 },
  },
  {
    id: "mittagspause",
    label: "Mittagspause",
    blurb: "Kurze Anfahrt, schnelles Essen, zurück ins Büro.",
    weights: { essen: 20, erlebnis: 8, ambiente: 6, service: 8, preis: 12, wartezeit: 21, anfahrt: 25 },
  },
  {
    id: "panorama",
    label: "Panorama",
    blurb: "Aussicht und Gesellschaft schlagen alles andere.",
    weights: { essen: 18, erlebnis: 28, ambiente: 34, service: 6, preis: 6, wartezeit: 4, anfahrt: 4 },
  },
  {
    id: "buchhaltung",
    label: "Buchhaltung",
    blurb: "Preis-Leistung und Kilometer, bitte mit Beleg.",
    weights: { essen: 20, erlebnis: 8, ambiente: 6, service: 8, preis: 34, wartezeit: 8, anfahrt: 16 },
  },
];

/** Smooth 0..1 ramp - no hard cliffs when a trip is one minute over a threshold. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 1-10 member rating -> 0-100. */
export function ratingScore(mean: number): number {
  return ((mean - 1) / 9) * 100;
}

/**
 * Waiting for the food. 12 minutes or less is perfect, an hour and a quarter is
 * a zero. Anything in between rolls off smoothly.
 */
export function waitScore(minutes: number): number {
  return 100 * (1 - smoothstep(12, 75, minutes));
}

/**
 * Getting there. Travel time carries most of the weight, raw distance adds a
 * little because kilometres cost fuel even when the road is fast.
 */
export function travelScore(travelMin: number, distanceKm: number): number {
  const timePart = 100 * (1 - smoothstep(8, 75, travelMin));
  const distancePart = 100 * (1 - smoothstep(4, 80, distanceKm));
  return timePart * 0.72 + distancePart * 0.28;
}

export interface ScoreBreakdown {
  /** 0-100, or null when nobody has rated the trip yet. */
  score: number | null;
  /** Per component: the 0-100 sub-score and the share of the total it earned. */
  parts: {
    component: Component;
    label: string;
    value: number | null;
    weight: number;
    /** Weight normalised over the components that actually had data. */
    effectiveWeight: number;
    /** Human readable source value, e.g. "8.4 / 10" or "28 min". */
    detail: string;
  }[];
  /** True when some components had no data and the weights were renormalised. */
  partial: boolean;
}

const DIMENSION_COMPONENTS: Dimension[] = ["essen", "service", "ambiente", "preis", "erlebnis"];

export function scoreTrip(agg: TripAggregate, weights: Weights = DEFAULT_WEIGHTS): ScoreBreakdown {
  const raw: { component: Component; value: number | null; detail: string }[] = [];

  for (const dim of DIMENSION_COMPONENTS) {
    const mean = agg.means[dim];
    raw.push({
      component: dim,
      value: mean === null ? null : ratingScore(mean),
      detail: mean === null ? "keine Bewertung" : `${mean.toFixed(1)} / 10`,
    });
  }

  raw.push({
    component: "wartezeit",
    value: agg.waitMedian === null ? null : waitScore(agg.waitMedian),
    detail: agg.waitMedian === null ? "nicht erfasst" : `${Math.round(agg.waitMedian)} min bis zum Teller`,
  });

  raw.push({
    component: "anfahrt",
    value: travelScore(agg.travelMin, agg.distanceKm),
    detail: `${agg.travelMin} min · ${agg.distanceKm.toFixed(1)} km ab HQ`,
  });

  // Only components with data get to vote; their weights are renormalised so a
  // trip is never punished for a dimension nobody filled in.
  const available = raw.filter((r) => r.value !== null);
  const availableWeight = available.reduce((sum, r) => sum + Math.max(0, weights[r.component]), 0);

  const parts = raw.map((r) => ({
    component: r.component,
    label: COMPONENT_LABELS[r.component],
    value: r.value,
    weight: weights[r.component],
    effectiveWeight:
      r.value === null || availableWeight === 0 ? 0 : Math.max(0, weights[r.component]) / availableWeight,
    detail: r.detail,
  }));

  // A trip with zero ratings has only the objective travel component, which
  // would hand it a score it did not earn.
  const score =
    agg.ratingCount === 0 || availableWeight === 0
      ? null
      : parts.reduce((sum, p) => sum + (p.value ?? 0) * p.effectiveWeight, 0);

  return { score, parts, partial: available.length < raw.length };
}

/** Confidence nudge for tie-breaks: a 9.0 from six people beats a 9.0 from one. */
export function rankKey(agg: TripAggregate, weights: Weights = DEFAULT_WEIGHTS): number {
  const { score } = scoreTrip(agg, weights);
  if (score === null) return -1;
  const confidence = agg.ratingCount / (agg.ratingCount + 2);
  return score * (0.85 + 0.15 * confidence);
}

export function scoreTone(score: number | null): "gold" | "green" | "blue" | "grey" {
  if (score === null) return "grey";
  if (score >= 85) return "gold";
  if (score >= 70) return "green";
  return "blue";
}
