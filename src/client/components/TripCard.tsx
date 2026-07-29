import { scoreTrip, type Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";
import { formatDate, formatMinutes } from "../lib/format.ts";
import { photoUrl } from "../lib/api.ts";
import { Link } from "../lib/router.tsx";
import { Chip, ScoreRing } from "./ui.tsx";

export function TripCard({ trip, rank, weights }: { trip: Trip; rank: number; weights: Weights }) {
  const { score } = scoreTrip(trip.aggregate, weights);
  const { aggregate: agg, restaurant } = trip;

  return (
    <Link to={`/ausflug/${trip.id}`} className="glass tripcard">
      <div className={`tripcard__rank${rank <= 3 ? " tripcard__rank--podium" : ""}`}>
        <span className="tripcard__rankno">{rank}</span>
        {rank === 1 && <span className="small muted">Platz</span>}
      </div>

      <div className="tripcard__body">
        <div className="tripcard__title">{restaurant.name}</div>
        <div className="muted small">
          {restaurant.town} · {formatDate(trip.tripDate)}
          {restaurant.cuisine ? ` · ${restaurant.cuisine}` : ""}
        </div>

        <div className="tripcard__meta">
          <Chip title="Einfache Strecke ab HQ">
            {restaurant.distanceKm.toFixed(1)} km · {formatMinutes(restaurant.travelMin)}
          </Chip>
          {agg.waitMedian !== null && (
            <Chip title="Median der gemeldeten Wartezeit aufs Essen">
              {Math.round(agg.waitMedian)} min Wartezeit
            </Chip>
          )}
          <Chip title="Abgegebene Bewertungen">
            {agg.ratingCount} {agg.ratingCount === 1 ? "Stimme" : "Stimmen"}
          </Chip>
          {agg.photoCount > 0 && <Chip>{agg.photoCount} Fotos</Chip>}
          {trip.myRating ? (
            <Chip tone="accent">Von dir bewertet</Chip>
          ) : (
            <Chip tone="ghost">Deine Stimme fehlt</Chip>
          )}
        </div>
      </div>

      <div className="tripcard__right">
        {trip.coverPhotoId && (
          <img
            className="tripcard__thumb"
            src={photoUrl(trip.coverPhotoId)}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <ScoreRing score={score} size={78} />
      </div>
    </Link>
  );
}
