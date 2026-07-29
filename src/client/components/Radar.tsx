import { useMemo } from "react";

import { scoreTrip, scoreTone } from "../../shared/scoring.ts";
import type { Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";
import { useRouter } from "../lib/router.tsx";

const TONE_COLOR: Record<string, string> = {
  gold: "#ffcf8b",
  green: "#7cf5d5",
  blue: "#7aa2ff",
  grey: "rgba(255,255,255,0.32)",
};

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
          color: TONE_COLOR[scoreTone(score)]!,
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
          <stop offset="0%" stopColor="rgba(124,245,213,0.16)" />
          <stop offset="100%" stopColor="rgba(124,245,213,0)" />
        </radialGradient>
      </defs>

      <circle cx="150" cy="150" r="132" fill="url(#radar-glow)" />

      {rings.map((ring) => (
        <circle
          key={ring}
          cx="150"
          cy="150"
          r={128 * ring}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
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
            fill="rgba(228,232,255,0.4)"
            letterSpacing="0.1em"
          >
            {label}
          </text>
        );
      })}

      {rings.map((ring) => (
        <text
          key={`km-${ring}`}
          x="153"
          y={150 - 128 * ring + 11}
          fontSize="8.5"
          fill="rgba(228,232,255,0.34)"
          fontVariant="tabular-nums"
        >
          {Math.round(maxKm * ring * ring)} km
        </text>
      ))}

      {/* HQ marker */}
      <circle cx="150" cy="150" r="4.5" fill="#fff" />
      <circle cx="150" cy="150" r="9" fill="none" stroke="rgba(255,255,255,0.35)" />
      <text x="150" y="172" textAnchor="middle" fontSize="9" fill="rgba(228,232,255,0.55)">
        {hqLabel}
      </text>

      {points.map(({ trip, x, y, color, size, score }) => (
        <g
          key={trip.id}
          onClick={() => navigate(`/ausflug/${trip.id}`)}
          style={{ cursor: "pointer" }}
          tabIndex={0}
          role="link"
          aria-label={`${trip.restaurant.name}, ${trip.restaurant.distanceKm.toFixed(1)} km`}
          onKeyDown={(event) => {
            if (event.key === "Enter") navigate(`/ausflug/${trip.id}`);
          }}
        >
          <title>
            {`${trip.restaurant.name} · ${trip.restaurant.distanceKm.toFixed(1)} km · ${
              score === null ? "unbewertet" : `${score.toFixed(1)} Punkte`
            }`}
          </title>
          <line x1="150" y1="150" x2={x} y2={y} stroke={color} strokeOpacity="0.16" />
          <circle cx={x} cy={y} r={size} fill={color} fillOpacity="0.22" />
          <circle cx={x} cy={y} r={size / 2.4} fill={color} />
        </g>
      ))}
    </svg>
  );
}
