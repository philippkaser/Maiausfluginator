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
          color: score === null ? "rgba(23,40,88,0.28)" : "#5468ff",
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
          <stop offset="0%" stopColor="rgba(84,104,255,0.14)" />
          <stop offset="60%" stopColor="rgba(84,104,255,0.05)" />
          <stop offset="100%" stopColor="rgba(84,104,255,0)" />
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
          stroke="rgba(23,40,88,0.12)"
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
            fontWeight="600"
            fill="rgba(23,27,42,0.42)"
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
          fill="rgba(23,27,42,0.32)"
          fontVariant="tabular-nums"
        >
          {Math.round(maxKm * ring * ring)} km
        </text>
      ))}

      {/* HQ marker */}
      <circle cx="150" cy="150" r="4.5" fill="#3546c9" />
      <circle cx="150" cy="150" r="9" fill="none" stroke="rgba(53,70,201,0.32)" />
      <text x="150" y="173" textAnchor="middle" fontSize="9" fontWeight="600" fill="rgba(23,27,42,0.5)">
        {hqLabel}
      </text>

      {points.map(({ trip, x, y, color, size, score }) => (
        <g
          key={trip.id}
          className="radar__blip"
          onClick={() => navigate(`/ausflug/${trip.id}`)}
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
          <line x1="150" y1="150" x2={x} y2={y} stroke={color} strokeOpacity="0.24" />
          <circle cx={x} cy={y} r={size} fill={color} fillOpacity="0.18" />
          <circle cx={x} cy={y} r={size / 2.4} fill={color} stroke="#fff" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}
