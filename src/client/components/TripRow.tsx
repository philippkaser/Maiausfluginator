/**
 * One line of the Rangliste.
 *
 * The ranking is a grouped list inside a single pane, not twenty floating
 * cards — twenty cards is a mosaic, and a mosaic has no first place. Rows are
 * separated by hairlines and are deliberately tighter than the pane around them:
 * the panes are airy so the page breathes, the rows are dense so the list can be
 * read in one look.
 */

import { photoUrl } from "../lib/api.ts";
import { formatDecimal, formatShortDate } from "../lib/format.ts";
import { Link } from "../lib/router.tsx";
import { cardVerdict, scoreTrip, type Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";
import { Chevron } from "./ui.tsx";

export function TripRow({
  trip,
  rank,
  weights,
}: {
  trip: Trip;
  rank: number;
  weights: Weights;
}) {
  const { score } = scoreTrip(trip.aggregate, weights);
  const { aggregate: agg, restaurant } = trip;

  // One secondary line rather than a row of badges: it reads faster and leaves
  // the eye a single anchor per row.
  const card = cardVerdict(agg);

  const facts = [
    restaurant.town,
    formatShortDate(trip.tripDate),
    `${formatDecimal(restaurant.distanceKm)} km`,
    agg.waitMedian === null ? null : `${Math.round(agg.waitMedian)} min Wartezeit`,
    // Only when it is good news. A row is scanned, not studied, and "abgelehnt"
    // on every line would just be noise.
    card === "accepted" ? "Karte ✓" : null,
    `${agg.ratingCount} ${agg.ratingCount === 1 ? "Stimme" : "Stimmen"}`,
  ].filter(Boolean);

  return (
    <Link
      to={`/ausflug/${trip.id}`}
      className={rank <= 3 ? "trow trow--podium" : "trow"}
      aria-label={`${restaurant.name}, Platz ${rank}${score === null ? "" : `, ${formatDecimal(score)} Punkte`}`}
    >
      <span className="trow__rank tnum">{rank}</span>

      {trip.coverPhotoId ? (
        <img
          className="trow__thumb"
          src={photoUrl(trip.coverPhotoId)}
          alt=""
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="trow__thumb trow__thumb--empty" aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M2 11l3.2-3 2.6 2.4L11 7l3 3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}

      <span className="trow__body">
        <span className="trow__title">
          {restaurant.name}
          {!trip.myRating && (
            <span
              className="dot"
              role="img"
              aria-label="von dir noch nicht bewertet"
              title="Du hast noch nicht bewertet"
            />
          )}
        </span>
        <span className="trow__facts">{facts.join(" · ")}</span>
      </span>

      <span className="trow__score">
        <span className="trow__value tnum">{score === null ? "–" : formatDecimal(score)}</span>
        <span className="trow__meter" aria-hidden="true">
          <span className="trow__meterfill" style={{ ["--value" as string]: (score ?? 0) / 100 }} />
        </span>
      </span>

      <Chevron />
    </Link>
  );
}
