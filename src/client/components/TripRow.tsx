import { scoreTrip, type Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";
import { formatDecimal, formatShortDate } from "../lib/format.ts";
import { photoUrl } from "../lib/api.ts";
import { Link } from "../lib/router.tsx";
import { Chevron, useSpotlight } from "./ui.tsx";

/**
 * One line of the ranking. The secondary line carries everything that used to
 * be a row of badges — it reads faster and leaves the eye a single anchor.
 */
export function TripRow({ trip, rank, weights }: { trip: Trip; rank: number; weights: Weights }) {
  const { score } = scoreTrip(trip.aggregate, weights);
  const { aggregate: agg, restaurant } = trip;
  const spotlight = useSpotlight();

  const facts = [
    restaurant.town,
    formatShortDate(trip.tripDate),
    `${formatDecimal(restaurant.distanceKm)} km`,
    agg.waitMedian === null ? null : `${Math.round(agg.waitMedian)} min Wartezeit`,
    `${agg.ratingCount} ${agg.ratingCount === 1 ? "Stimme" : "Stimmen"}`,
  ].filter(Boolean);

  return (
    <Link
      to={`/ausflug/${trip.id}`}
      className={`list__row${rank <= 3 ? " list__row--podium" : ""}`}
      {...spotlight}
    >
      <span className="list__rank">{rank}</span>

      {trip.coverPhotoId ? (
        <img className="list__thumb" src={photoUrl(trip.coverPhotoId)} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="list__thumb list__thumb--empty" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 11l3.2-3 2.6 2.4L11 7l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      )}

      <span style={{ minWidth: 0 }}>
        <span className="list__title">
          {restaurant.name}
          {!trip.myRating && (
            <span
              className="dot"
              style={{ marginLeft: 8, verticalAlign: "middle" }}
              title="Du hast noch nicht bewertet"
            />
          )}
        </span>
        <span className="list__sub">{facts.join(" · ")}</span>
      </span>

      <span className="list__score">
        <span className="list__scorevalue">{score === null ? "–" : formatDecimal(score)}</span>
        <span className="list__meter">
          <span
            className="list__meterfill"
            style={{
              width: `${score ?? 0}%`,
              ...(score === null ? { background: "rgba(255,255,255,0.2)" } : null),
            }}
          />
        </span>
      </span>

      <Chevron />
    </Link>
  );
}
