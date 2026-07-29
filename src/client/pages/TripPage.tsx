import { useEffect, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import {
  formatDate,
  formatDecimal,
  formatMinutes,
  formatRelative,
  formatWeekday,
} from "../lib/format.ts";
import { Link, useRouter } from "../lib/router.tsx";
import { useSession, useStoredWeights, useToast } from "../lib/store.tsx";
import { scoreTrip } from "../../shared/scoring.ts";
import { DIMENSION_LABELS, DIMENSIONS } from "../../shared/types.ts";
import type { TripDetail } from "../../shared/types.ts";
import { PhotoPanel } from "../components/PhotoPanel.tsx";
import { RatingForm } from "../components/RatingForm.tsx";
import { Avatar, Bar, Empty, ScoreRing, Spinner, Tag, useSpotlight } from "../components/ui.tsx";

export function TripPage({ tripId }: { tripId: string }) {
  const { me, hq } = useSession();
  const { weights } = useStoredWeights();
  const { navigate } = useRouter();
  const toast = useToast();
  const spotlight = useSpotlight();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTrip(null);
    setMissing(false);
    api
      .trip(tripId)
      .then((data) => {
        if (!cancelled) setTrip(data.trip);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else toast(err instanceof ApiError ? err.message : "Laden fehlgeschlagen", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, toast]);

  if (missing) {
    return (
      <div className="card card--pad">
        <Empty title="Diesen Ausflug gibt es nicht (mehr).">
          <Link to="/" className="btn" style={{ marginTop: 12 }}>
            Zur Rangliste
          </Link>
        </Empty>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="center-screen">
        <Spinner label="Wird geladen…" />
      </div>
    );
  }

  const breakdown = scoreTrip(trip.aggregate, weights);
  const { restaurant, aggregate: agg } = trip;
  const canEdit = me?.isAdmin || me?.id === trip.createdBy;

  async function removeTrip() {
    if (!confirm("Diesen Ausflug samt Bewertungen und Fotos löschen?")) return;
    try {
      await api.deleteTrip(tripId);
      toast("Ausflug gelöscht.");
      navigate("/");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen", "error");
    }
  }

  return (
    <div className="stack stack--lg fade-in">
      <div className="row row--between">
        <Link to="/" className="btn btn--quiet btn--sm">
          ← Rangliste
        </Link>
        {canEdit && (
          <button type="button" className="btn btn--danger btn--sm" onClick={removeTrip}>
            Ausflug löschen
          </button>
        )}
      </div>

      <header
        className="card card--pad row row--between"
        style={{ alignItems: "flex-start", gap: 28 }}
        {...spotlight}
      >
        <div style={{ minWidth: 0, flex: "1 1 340px" }}>
          <span className="eyebrow">
            {formatWeekday(trip.tripDate)}, {formatDate(trip.tripDate)}
          </span>
          <h1
            className="display"
            style={{ marginTop: 12, fontSize: "clamp(1.7rem, 1.2rem + 1.9vw, 2.45rem)" }}
          >
            {restaurant.name}
          </h1>
          <p className="muted" style={{ margin: "8px 0 16px" }}>
            {[restaurant.town, restaurant.cuisine, restaurant.address].filter(Boolean).join(" · ")}
          </p>

          <div className="row row--tight">
            <Tag title={`Einfache Strecke ab ${hq.label}`}>
              {formatDecimal(restaurant.distanceKm)} km ab HQ
            </Tag>
            <Tag title="Einfache Fahrzeit">{formatMinutes(restaurant.travelMin)} Fahrt</Tag>
            {agg.waitMedian !== null && (
              <Tag title={`${agg.waitCount} Angaben`}>
                {Math.round(agg.waitMedian)} min aufs Essen
              </Tag>
            )}
            {restaurant.travelSource === "estimated" && (
              <Tag title="Aus den Koordinaten geschätzt, nicht nachgemessen">Anfahrt geschätzt</Tag>
            )}
            {restaurant.website && (
              <a className="tag" href={restaurant.website} target="_blank" rel="noreferrer noopener">
                Website ↗
              </a>
            )}
          </div>

          {trip.notes && <p className="muted" style={{ marginTop: 18 }}>{trip.notes}</p>}

          <p className="small dim" style={{ marginTop: 16 }}>
            Eingetragen von {trip.createdByName} · {formatRelative(trip.createdAt)}
            {trip.title !== restaurant.name ? ` · „${trip.title}“` : ""}
          </p>
        </div>

        <div className="stack" style={{ alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <ScoreRing score={breakdown.score} size={124} />
          <div className="small dim" style={{ textAlign: "center" }}>
            {agg.ratingCount === 0
              ? "Noch keine Bewertung"
              : `${agg.ratingCount} ${agg.ratingCount === 1 ? "Stimme" : "Stimmen"} · ${agg.photoCount} Fotos`}
          </div>
        </div>
      </header>

      <div className="split">
        <div className="stack">
          <section className="card card--pad">
            <div className="section__head">
              <h2>Aufschlüsselung</h2>
            </div>
            <div className="bars">
              {breakdown.parts.map((part) => (
                <Bar
                  key={part.component}
                  label={`${part.label} · ${Math.round(part.effectiveWeight * 100)} %`}
                  value={part.value}
                  detail={part.detail}
                />
              ))}
            </div>
            {breakdown.partial && (
              <p className="small dim" style={{ marginTop: 14 }}>
                Für einzelne Komponenten fehlen Daten — die übrigen Gewichte wurden hochgerechnet.
              </p>
            )}
          </section>

          <section className="card card--pad">
            <div className="section__head">
              <h2>
                {trip.ratings.length} {trip.ratings.length === 1 ? "Bewertung" : "Bewertungen"}
              </h2>
            </div>

            {trip.ratings.length === 0 ? (
              <Empty title="Noch hat niemand etwas gesagt.">
                <p className="small">Sei die erste Stimme — das Formular ist gleich daneben.</p>
              </Empty>
            ) : (
              <div className="reviews">
                {trip.ratings.map((rating) => (
                  <article key={rating.id} className="review">
                    <div className="review__head">
                      <Avatar name={rating.userName} hue={rating.userHue} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500 }}>
                          {rating.userName}
                          {rating.userId === me?.id && <span className="dim small"> · du</span>}
                        </div>
                        <div className="dim small">{formatRelative(rating.updatedAt)}</div>
                      </div>
                      <div style={{ marginLeft: "auto", textAlign: "right" }}>
                        <div className="rate__score">
                          {formatDecimal(
                            DIMENSIONS.reduce((sum, dimension) => sum + rating[dimension], 0) /
                              DIMENSIONS.length,
                          )}
                        </div>
                        <div className="dim small">Schnitt</div>
                      </div>
                    </div>

                    <div className="review__scores">
                      {DIMENSIONS.map((dimension) => (
                        <span key={dimension}>
                          {DIMENSION_LABELS[dimension]} <b>{rating[dimension]}</b>
                        </span>
                      ))}
                      {rating.waitMinutes !== null && (
                        <span>
                          Wartezeit <b>{rating.waitMinutes} min</b>
                        </span>
                      )}
                    </div>

                    {rating.comment && <p className="quote">{rating.comment}</p>}
                  </article>
                ))}
              </div>
            )}
          </section>

          <PhotoPanel
            tripId={trip.id}
            photos={trip.photos}
            onChange={(photos) => setTrip((current) => (current ? { ...current, photos } : current))}
          />
        </div>

        <section className="card card--pad" style={{ position: "sticky", top: 96 }}>
          <RatingForm trip={trip} onSaved={setTrip} />
        </section>
      </div>
    </div>
  );
}
