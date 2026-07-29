import { useMemo } from "react";

import { scoreTrip } from "../../shared/scoring.ts";
import type { Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";
import { useRouter } from "../lib/router.tsx";
import { de1 } from "../../shared/num.ts";

/**
 * A compass instead of a map: every Ausflugsziel plotted by its real bearing
 * from the Durst HQ, with distance running outwards on a square-root scale so
 * the near ones do not all pile up in the middle. No map tiles, no third party.
 */
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
        const angle = ((trip.restaurant.bearing! - 90) * Math.PI) / 180;
        const radius = Math.sqrt(trip.restaurant.distanceKm / max) * 128;
        const score = scoreTrip(trip.aggregate, weights).score;
        return {
          trip,
          score,
          x: 150 + Math.cos(angle) * radius,
          y: 150 + Math.sin(angle) * radius,
          color: score === null ? "var(--text-4)" : "var(--ring-1)",
          size: 5 + Math.min(9, trip.aggregate.ratingCount * 1.6),
        };
      }),
    };
  }, [trips, weights]);

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg className="radar" viewBox="0 0 300 300" role="img" aria-label="Ausflugsziele nach Richtung und Entfernung ab HQ">
      <defs>
        <radialGradient id="radar-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="var(--accent-dim)" />
          <stop offset="55%" stopColor="var(--accent-dim)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent-dim)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="radar-spoke" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--ring-1)" />
          <stop offset="100%" stopColor="var(--ring-3)" />
        </linearGradient>
      </defs>

      <circle cx="150" cy="150" r="132" fill="url(#radar-glow)" />

      {rings.map((ring) => (
        <circle
          key={ring}
          cx="150"
          cy="150"
          r={128 * ring}
          fill="none"
          stroke="var(--sunk)"
          strokeDasharray={ring === 1 ? undefined : "3 5"}
        />
      ))}

      {["N", "O", "S", "W"].map((label, index) => {
        const angle = ((index * 90 - 90) * Math.PI) / 180;
        return (
          <text
            key={label}
            x={150 + Math.cos(angle) * 143}
            y={150 + Math.sin(angle) * 143 + 4}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-3)"
            letterSpacing="0.1em"
          >
            {label}
          </text>
        );
      })}

      {rings.map((ring) => (
        <text
          key={`km-${ring}`}
          x="146"
          y={150 - 128 * ring + 11}
          textAnchor="end"
          fontSize="8.5"
          fill="var(--text-4)"
          fontVariant="tabular-nums"
        >
          {Math.round(maxKm * ring * ring)} km
        </text>
      ))}

      {/* HQ marker */}
      <circle cx="150" cy="150" r="4.5" fill="var(--text)" />
      <circle cx="150" cy="150" r="9" fill="none" stroke="var(--text-3)" />
      <text x="150" y="172" textAnchor="middle" fontSize="9" fill="var(--text-3)">
        {hqLabel}
      </text>

      {points.map(({ trip, x, y, color, size, score }) => (
        <g
          key={trip.id}
          onClick={() => navigate(`/ausflug/${trip.id}`)}
          style={{ cursor: "pointer" }}
          tabIndex={0}
          role="link"
          aria-label={`${trip.restaurant.name}, ${de1(trip.restaurant.distanceKm)} km`}
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate(`/ausflug/${trip.id}`);
          }}
        >
          <title>
            {`${trip.restaurant.name} · ${de1(trip.restaurant.distanceKm)} km · ${
              score === null ? "unbewertet" : `${de1(score)} Punkte`
            }`}
          </title>
          <line
            x1="150"
            y1="150"
            x2={x}
            y2={y}
            stroke={score === null ? color : "url(#radar-spoke)"}
            strokeOpacity="0.22"
          />
          <circle cx={x} cy={y} r={size} fill={color} fillOpacity="0.16" />
          <circle cx={x} cy={y} r={size / 2.4} fill={color} />
        </g>
      ))}
    </svg>
  );
}
