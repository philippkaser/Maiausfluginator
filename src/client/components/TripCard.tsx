/**
 * One Ausflug in the grid.
 *
 * The Rangliste answers "who won", so it is a list. Ausflüge answers "where have
 * we been", which is a question about places and plates — so here the photo
 * leads and the score is a quiet number in the corner. Same data, different
 * question, different shape.
 */

import { photoUrl } from "../lib/api.ts";
import { formatDate, formatDecimal, formatMinutes } from "../lib/format.ts";
import { Link } from "../lib/router.tsx";
import { scoreTrip, type Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";

export function TripCard({ trip, weights }: { trip: Trip; weights: Weights }) {
  const { score } = scoreTrip(trip.aggregate, weights);
  const { restaurant, aggregate: agg } = trip;

  return (
    <Link to={`/ausflug/${trip.id}`} className="tcard pane pane--action" aria-label={restaurant.name}>
      <span className="tcard__frame">
        {trip.coverPhotoId ? (
          <img
            className="tcard__photo"
            src={photoUrl(trip.coverPhotoId)}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          // No photo is not a broken card. A plate of warm light stands in, and
          // the name carries the tile instead.
          <span className="tcard__blank" aria-hidden="true">
            <span className="tcard__blankname">{restaurant.name}</span>
          </span>
        )}

        <span className="tcard__score">
          <span className="tnum">{score === null ? "–" : formatDecimal(score)}</span>
        </span>

        {!trip.myRating && <span className="tcard__open">offen</span>}
      </span>

      <span className="tcard__body">
        <span className="tcard__title">{restaurant.name}</span>
        <span className="tcard__meta">
          {formatDate(trip.tripDate)} · {restaurant.town}
        </span>
        <span className="tcard__meta dim">
          {formatDecimal(restaurant.distanceKm)} km · {formatMinutes(restaurant.travelMin)} ·{" "}
          {agg.ratingCount} {agg.ratingCount === 1 ? "Stimme" : "Stimmen"}
          {agg.photoCount > 0 && ` · ${agg.photoCount} Fotos`}
        </span>
      </span>
    </Link>
  );
}
