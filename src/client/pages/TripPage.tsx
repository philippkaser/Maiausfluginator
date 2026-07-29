import { useEffect, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { formatDate, formatMinutes, formatRelative, formatWeekday } from "../lib/format.ts";
import { Link, useRouter } from "../lib/router.tsx";
import { useSession, useStoredWeights, useToast } from "../lib/store.tsx";
import { scoreTrip } from "../../shared/scoring.ts";
import { DIMENSION_LABELS, DIMENSIONS } from "../../shared/types.ts";
import type { TripDetail } from "../../shared/types.ts";
import { PhotoPanel } from "../components/PhotoPanel.tsx";
import { RatingForm } from "../components/RatingForm.tsx";
import { Avatar, Bar, Chip, Empty, ScoreRing, Spinner } from "../components/ui.tsx";

export function TripPage({ tripId }: { tripId: string }) {
  const { me, hq } = useSession();
  const { weights } = useStoredWeights();
  const { navigate } = useRouter();
  const toast = useToast();

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
      <div className="glass glass--pad">
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
        <Spinner label="Ausflug wird geladen…" />
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
    <div className="stack stack--lg fade-up">
      <section className="glass glass--sheen hero">
        <div className="row row--between" style={{ marginBottom: 18 }}>
          <Link to="/" className="btn btn--ghost btn--sm">
            ← Rangliste
          </Link>
          {canEdit && (
            <button type="button" className="btn btn--danger btn--sm" onClick={removeTrip}>
              Ausflug löschen
            </button>
          )}
        </div>

        <div className="hero__grid">
          <div>
            <span className="eyebrow">
              {formatWeekday(trip.tripDate)}, {formatDate(trip.tripDate)}
            </span>
            <h1 style={{ margin: "10px 0 6px" }}>{restaurant.name}</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
              {restaurant.town}
              {restaurant.cuisine ? ` · ${restaurant.cuisine}` : ""}
              {restaurant.address ? ` · ${restaurant.address}` : ""}
            </p>

            <div className="row row--tight">
              <Chip title={`Einfache Strecke ab ${hq.label}`}>
                {restaurant.distanceKm.toFixed(1)} km ab HQ
              </Chip>
              <Chip title="Einfache Fahrzeit">{formatMinutes(restaurant.travelMin)} Fahrt</Chip>
              <Chip title="Hin und zurück">
                {(restaurant.distanceKm * 2).toFixed(1)} km retour
              </Chip>
              {agg.waitMedian !== null && (
                <Chip title={`${agg.waitCount} Angaben`}>
                  {Math.round(agg.waitMedian)} min aufs Essen
                </Chip>
              )}
              {restaurant.travelSource === "estimated" && (
                <Chip tone="ghost" title="Aus den Koordinaten geschätzt, nicht nachgemessen">
                  Anfahrt geschätzt
                </Chip>
              )}
              {restaurant.website && (
                <a className="chip" href={restaurant.website} target="_blank" rel="noreferrer noopener">
                  Website ↗
                </a>
              )}
            </div>

            {trip.notes && <p style={{ marginTop: 18, color: "var(--text-2)" }}>{trip.notes}</p>}

            <p className="muted small" style={{ marginTop: 16 }}>
              Eingetragen von {trip.createdByName} · {formatRelative(trip.createdAt)}
              {trip.title !== restaurant.name ? ` · „${trip.title}“` : ""}
            </p>
          </div>

          <div className="stack" style={{ alignItems: "center", gap: 14 }}>
            <ScoreRing score={breakdown.score} size={128} />
            <div className="muted small" style={{ textAlign: "center" }}>
              {agg.ratingCount === 0
                ? "Noch keine Bewertung"
                : `${agg.ratingCount} ${agg.ratingCount === 1 ? "Stimme" : "Stimmen"} · ${agg.photoCount} Fotos`}
            </div>
          </div>
        </div>
      </section>

      <div className="detail__grid">
        <div className="stack">
          <section className="glass glass--sheen glass--pad">
            <span className="eyebrow">Woraus der Score entsteht</span>
            <h2 style={{ margin: "4px 0 18px" }}>Aufschlüsselung</h2>
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
              <p className="muted small" style={{ marginTop: 14 }}>
                Für einzelne Komponenten fehlen Daten – die übrigen Gewichte wurden hochgerechnet.
              </p>
            )}
          </section>

          <section className="glass glass--sheen glass--pad">
            <span className="eyebrow">Stimmen</span>
            <h2 style={{ margin: "4px 0 18px" }}>
              {trip.ratings.length} {trip.ratings.length === 1 ? "Bewertung" : "Bewertungen"}
            </h2>

            {trip.ratings.length === 0 ? (
              <Empty title="Noch hat niemand etwas gesagt.">
                <p className="small">Sei die erste Stimme – das Formular ist gleich daneben.</p>
              </Empty>
            ) : (
              <div className="reviewlist">
                {trip.ratings.map((rating) => (
                  <article key={rating.id} className="review">
                    <div className="review__head">
                      <Avatar name={rating.userName} hue={rating.userHue} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 560 }}>
                          {rating.userName}
                          {rating.userId === me?.id && <span className="muted small"> · du</span>}
                        </div>
                        <div className="muted small">{formatRelative(rating.updatedAt)}</div>
                      </div>
                      <div style={{ marginLeft: "auto", textAlign: "right" }}>
                        <div className="rate__score" style={{ fontSize: "1.15rem" }}>
                          {(
                            DIMENSIONS.reduce((sum, dimension) => sum + rating[dimension], 0) /
                            DIMENSIONS.length
                          ).toFixed(1)}
                        </div>
                        <div className="muted small">Schnitt</div>
                      </div>
                    </div>

                    <div className="review__scores">
                      {DIMENSIONS.map((dimension) => (
                        <span key={dimension} className="pill">
                          {DIMENSION_LABELS[dimension]} <b>{rating[dimension]}</b>
                        </span>
                      ))}
                      {rating.waitMinutes !== null && (
                        <span className="pill">
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

        <div className="stack">
          <section className="glass glass--sheen glass--pad" style={{ position: "sticky", top: 92 }}>
            <RatingForm trip={trip} onSaved={setTrip} />
          </section>
        </div>
      </div>
    </div>
  );
}
