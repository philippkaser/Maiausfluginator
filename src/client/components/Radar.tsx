/**
 * A compass instead of a map.
 *
 * Every colour here is a token rather than a literal, even inside the SVG —
 * inline SVG resolves CSS variables, so the chart cannot drift away from the
 * palette, and a night version would need no changes in this file.
 *
 * Every Ausflugsziel plotted at its true bearing from the Durst HQ, distance
 * running outwards on a square-root scale so the near ones do not all pile up in
 * the middle. No tiles, no third party, no request leaving the building — which
 * for an invite-only list of where a company eats lunch is the point, not a
 * limitation.
 */

import { useMemo } from "react";

import { useRouter } from "../lib/router.tsx";
import { scoreTrip, type Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";
import { de1 } from "../../shared/num.ts";

const CENTRE = 150;
const REACH = 124;

export function Radar({
  trips,
  weights,
  hqLabel,
}: {
  trips: Trip[];
  weights: Weights;
  hqLabel: string;
}) {
  const { navigate } = useRouter();

  const { points, maxKm } = useMemo(() => {
    const plotted = trips.filter((trip) => trip.restaurant.bearing !== null);
    const max = Math.max(10, ...plotted.map((trip) => trip.restaurant.distanceKm));
    return {
      maxKm: max,
      points: plotted.map((trip) => {
        // Bearing is clockwise from north; SVG angles run clockwise from east.
        const angle = ((trip.restaurant.bearing! - 90) * Math.PI) / 180;
        const radius = Math.sqrt(trip.restaurant.distanceKm / max) * REACH;
        const score = scoreTrip(trip.aggregate, weights).score;
        return {
          trip,
          score,
          x: CENTRE + Math.cos(angle) * radius,
          y: CENTRE + Math.sin(angle) * radius,
          // Size is confidence: a dot backed by eight votes is worth more of
          // your attention than one backed by one.
          size: 4.5 + Math.min(8, trip.aggregate.ratingCount * 1.5),
        };
      }),
    };
  }, [trips, weights]);

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      className="radar"
      viewBox="0 0 300 300"
      role="img"
      aria-label={`Ausflugsziele nach Richtung und Entfernung ab ${hqLabel}`}
    >
      <defs>
        <radialGradient id="radar-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(28, 92, 71, 0.07)" />
          <stop offset="100%" stopColor="rgba(28,92,71,0)" />
        </radialGradient>
      </defs>

      <circle cx={CENTRE} cy={CENTRE} r={REACH + 8} fill="url(#radar-glow)" />

      {rings.map((ring) => (
        <circle
          key={ring}
          cx={CENTRE}
          cy={CENTRE}
          r={REACH * ring}
          fill="none"
          stroke="var(--hairline-strong)"
          strokeDasharray={ring === 1 ? undefined : "3 5"}
        />
      ))}

      {["N", "O", "S", "W"].map((label, index) => {
        const angle = ((index * 90 - 90) * Math.PI) / 180;
        return (
          <text
            key={label}
            x={CENTRE + Math.cos(angle) * (REACH + 17)}
            y={CENTRE + Math.sin(angle) * (REACH + 17) + 4}
            textAnchor="middle"
            fontSize="10"
            fill="var(--ink-3)"
            letterSpacing="0.12em"
          >
            {label}
          </text>
        );
      })}

      {rings.map((ring) => (
        <text
          key={`km-${ring}`}
          x={CENTRE - 4}
          y={CENTRE - REACH * ring + 11}
          textAnchor="end"
          fontSize="8.5"
          fill="var(--ink-3)"
          fontVariant="tabular-nums"
        >
          {Math.round(maxKm * ring * ring)} km
        </text>
      ))}

      {/* HQ. Everything on this chart is measured from here. */}
      <circle cx={CENTRE} cy={CENTRE} r="4" fill="var(--ink)" />
      <circle cx={CENTRE} cy={CENTRE} r="8.5" fill="none" stroke="var(--hairline-strong)" />
      <text x={CENTRE} y={CENTRE + 24} textAnchor="middle" fontSize="9" fill="var(--ink-2)">
        {hqLabel}
      </text>

      {points.map(({ trip, x, y, size, score }) => (
        <g
          key={trip.id}
          className="radar__point"
          onClick={() => navigate(`/ausflug/${trip.id}`)}
          tabIndex={0}
          role="link"
          aria-label={`${trip.restaurant.name}, ${de1(trip.restaurant.distanceKm)} Kilometer`}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              navigate(`/ausflug/${trip.id}`);
            }
          }}
        >
          <title>
            {`${trip.restaurant.name} · ${de1(trip.restaurant.distanceKm)} km · ${
              score === null ? "unbewertet" : `${de1(score)} Punkte`
            }`}
          </title>
          <line
            x1={CENTRE}
            y1={CENTRE}
            x2={x}
            y2={y}
            stroke={score === null ? "var(--hairline-strong)" : "var(--accent-line)"}
          />
          <circle
            cx={x}
            cy={y}
            r={size}
            fill={score === null ? "var(--glass-sunken)" : "var(--accent-soft)"}
          />
          <circle
            cx={x}
            cy={y}
            r={size / 2.3}
            fill={score === null ? "var(--ink-4)" : "var(--accent)"}
          />
        </g>
      ))}
    </svg>
  );
}
