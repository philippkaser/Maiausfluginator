/**
 * One Ausflug.
 *
 * The title photograph is the head of the page, with the facts on a frosted
 * plate laid over it and the score at the top right. Then what the score is made
 * of, then every voice with its comment, then the gallery.
 *
 * A trip without a photograph does not get a broken header: it gets a refracted
 * glass panel instead, which is the same gesture in the material that is always
 * available.
 */

import { useEffect, useState } from "react";

import { Frost } from "../components/Frost.tsx";
import { PhotoPanel } from "../components/PhotoPanel.tsx";
import { Breakdown, ScoreNumeral } from "../components/Score.tsx";
import { Avatar, Empty, Pane, Spinner, Tag } from "../components/ui.tsx";
import { api, ApiError, photoUrl } from "../lib/api.ts";
import { useSeason } from "../lib/data.tsx";
import {
  formatDate,
  formatDecimal,
  formatMinutes,
  formatRelative,
  formatWeekday,
} from "../lib/format.ts";
import { useReveal } from "../lib/motion.ts";
import { Link, useRouter } from "../lib/router.tsx";
import { useSession, useStoredWeights, useToast } from "../lib/store.tsx";
import { RatingSheet } from "../sheets/RatingSheet.tsx";
import { scoreTrip } from "../../shared/scoring.ts";
import { DIMENSIONS, DIMENSION_LABELS } from "../../shared/types.ts";
import type { TripDetail } from "../../shared/types.ts";
import { de1 } from "../../shared/num.ts";

export function TripPage({ tripId }: { tripId: string }) {
  const { me, hq } = useSession();
  const { weights } = useStoredWeights();
  const { merge, forget } = useSeason();
  const { navigate, search, setParam } = useRouter();
  const toast = useToast();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [missing, setMissing] = useState(false);

  // `?bewerten` makes "du hast noch 3 offen" a list of links rather than a list
  // of things to click twice.
  const rating = search.has("bewerten");
  const reveal = useReveal([trip === null]);

  useEffect(() => {
    let live = true;
    setTrip(null);
    setMissing(false);

    api
      .trip(tripId)
      .then((data) => {
        if (live) setTrip(data.trip);
      })
      .catch((err) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 404) setMissing(true);
        else toast(err instanceof ApiError ? err.message : "Der Ausflug lädt nicht.", "error");
      });

    return () => {
      live = false;
    };
  }, [tripId, toast]);

  if (missing) {
    return (
      <Pane>
        <Empty title="Diesen Ausflug gibt es nicht mehr.">
          <p className="small">
            <Link to="/" className="link">
              Zurück zur Rangliste
            </Link>
          </p>
        </Empty>
      </Pane>
    );
  }

  if (!trip) {
    return (
      <div className="center-screen">
        <Spinner label="Wird geholt…" />
      </div>
    );
  }

  const breakdown = scoreTrip(trip.aggregate, weights);
  const { restaurant, aggregate: agg } = trip;
  const canEdit = me?.isAdmin || me?.id === trip.createdBy;

  /** Keep the trip page and the season list in step after any change. */
  function apply(next: TripDetail) {
    setTrip(next);
    merge(next);
  }

  async function removeTrip() {
    if (!confirm("Diesen Ausflug samt Bewertungen und Fotos löschen?")) return;
    try {
      await api.deleteTrip(tripId);
      forget(tripId);
      toast("Ausflug gelöscht.");
      navigate("/ausfluege");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Das ließ sich nicht löschen.", "error");
    }
  }

  const facts = (
    <div className="row row--tight">
      <Tag title={`Einfache Strecke ab ${hq.label}`}>
        {formatDecimal(restaurant.distanceKm)} km ab HQ
      </Tag>
      <Tag title="Einfache Fahrzeit">{formatMinutes(restaurant.travelMin)} Fahrt</Tag>
      {agg.waitMedian !== null && (
        <Tag title={`Median aus ${agg.waitCount} Angaben`}>
          {Math.round(agg.waitMedian)} min aufs Essen
        </Tag>
      )}
      {restaurant.travelSource === "estimated" && (
        <Tag title="Aus den Koordinaten gerechnet, nicht nachgemessen">Anfahrt geschätzt</Tag>
      )}
      {restaurant.website && (
        <a
          className="tag"
          href={restaurant.website}
          target="_blank"
          rel="noreferrer noopener"
        >
          Website ↗
        </a>
      )}
    </div>
  );

  const head = (
    <div className="thead__plate">
      <div className="stack" style={{ gap: 10 }}>
        <span className="eyebrow">
          {formatWeekday(trip.tripDate)}, {formatDate(trip.tripDate)}
        </span>
        <h1>{restaurant.name}</h1>
        <p className="muted">
          {[restaurant.town, restaurant.cuisine, restaurant.address].filter(Boolean).join(" · ")}
        </p>
        {facts}
      </div>

      <div className="thead__score">
        <ScoreNumeral score={breakdown.score} countKey={trip.id} size="md" />
        <span className="small dim">
          {agg.ratingCount === 0
            ? "noch keine Stimme"
            : `${agg.ratingCount} ${agg.ratingCount === 1 ? "Stimme" : "Stimmen"}`}
        </span>
      </div>
    </div>
  );

  return (
    <div className="stack stack--lg" ref={reveal}>
      <div className="row row--between">
        <Link to="/ausfluege" className="btn btn--quiet btn--sm">
          ← Alle Ausflüge
        </Link>
        {canEdit && (
          <button type="button" className="btn btn--danger btn--sm" onClick={removeTrip}>
            Ausflug löschen
          </button>
        )}
      </div>

      {/* The head. With a photograph it is a picture with a plate on it; without
          one it is refracted glass. Same gesture, different material. */}
      {trip.coverPhotoId ? (
        <header className="thead" data-reveal>
          <img
            className="thead__photo"
            src={photoUrl(trip.coverPhotoId)}
            alt=""
            decoding="async"
          />
          <div className="thead__scrim" aria-hidden="true" />
          {head}
        </header>
      ) : (
        <Frost className="thead thead--bare">
          <div data-reveal>{head}</div>
        </Frost>
      )}

      <div className="split">
        <div className="stack stack--md">
          <Pane as="section" data-reveal>
            <div className="section__head">
              <div className="stack" style={{ gap: 4 }}>
                <span className="eyebrow">Sieben Komponenten</span>
                <h2>Woraus sich das rechnet</h2>
              </div>
            </div>
            <Breakdown breakdown={breakdown} />
          </Pane>

          <Pane as="section" data-reveal>
            <div className="section__head">
              <div className="stack" style={{ gap: 4 }}>
                <span className="eyebrow">Die Runde sagt</span>
                <h2>
                  {trip.ratings.length}{" "}
                  {trip.ratings.length === 1 ? "Stimme" : "Stimmen"}
                </h2>
              </div>
            </div>

            {trip.ratings.length === 0 ? (
              <Empty title="Noch hat niemand etwas gesagt.">
                <p className="small">Sei die erste Stimme.</p>
              </Empty>
            ) : (
              <div className="voices">
                {trip.ratings.map((entry) => {
                  const mean =
                    DIMENSIONS.reduce((sum, dimension) => sum + entry[dimension], 0) /
                    DIMENSIONS.length;

                  return (
                    <article key={entry.id} className="voice">
                      <div className="voice__head">
                        <Avatar name={entry.userName} hue={entry.userHue} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div className="voice__who">
                            {entry.userName}
                            {entry.userId === me?.id && <span className="dim small"> · du</span>}
                          </div>
                          <div className="dim small">{formatRelative(entry.updatedAt)}</div>
                        </div>
                        <div className="voice__mean">
                          <span className="tnum">{de1(mean)}</span>
                          <span className="dim small">Schnitt</span>
                        </div>
                      </div>

                      <div className="voice__scores">
                        {DIMENSIONS.map((dimension) => (
                          <span key={dimension}>
                            {DIMENSION_LABELS[dimension]} <b className="tnum">{entry[dimension]}</b>
                          </span>
                        ))}
                        {entry.waitMinutes !== null && (
                          <span>
                            Wartezeit <b className="tnum">{entry.waitMinutes} min</b>
                          </span>
                        )}
                      </div>

                      {entry.comment && <p className="quote">{entry.comment}</p>}
                    </article>
                  );
                })}
              </div>
            )}
          </Pane>

          <div data-reveal>
            <PhotoPanel
              tripId={trip.id}
              photos={trip.photos}
              onChange={(photos) =>
                setTrip((current) => (current ? { ...current, photos } : current))
              }
            />
          </div>
        </div>

        <aside className="tside" data-reveal>
          <Pane>
            <div className="stack">
              <div className="stack" style={{ gap: 4 }}>
                <span className="eyebrow">Deine Stimme</span>
                <h2>{trip.myRating ? "Du warst schon dran" : "Wie war es?"}</h2>
              </div>

              <p className="small muted">
                {trip.myRating
                  ? "Du kannst sie jederzeit ändern — eine Stimme pro Person und Ausflug."
                  : "Fünf Regler, die Wartezeit und ein Satz dazu. Dauert eine Minute."}
              </p>

              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={() => setParam("bewerten", "1")}
              >
                {trip.myRating ? "Bewertung ansehen" : "Jetzt bewerten"}
              </button>
            </div>
          </Pane>

          {trip.notes && (
            <Pane tone="quiet">
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">Notiz</span>
                <p className="muted">{trip.notes}</p>
              </div>
            </Pane>
          )}

          <p className="small dim">
            Eingetragen von {trip.createdByName} · {formatRelative(trip.createdAt)}
            {trip.title !== restaurant.name && ` · „${trip.title}“`}
          </p>
        </aside>
      </div>

      {rating && (
        <RatingSheet
          trip={trip}
          onSaved={apply}
          onClose={() => setParam("bewerten", null)}
        />
      )}
    </div>
  );
}
