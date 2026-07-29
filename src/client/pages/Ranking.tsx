import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { formatHours } from "../lib/format.ts";
import { Link } from "../lib/router.tsx";
import { useSession, useStoredWeights, useToast } from "../lib/store.tsx";
import { rankKey, scoreTrip } from "../../shared/scoring.ts";
import type { Stats, Trip } from "../../shared/types.ts";
import { Radar } from "../components/Radar.tsx";
import { TripCard } from "../components/TripCard.tsx";
import { WeightTuner } from "../components/WeightTuner.tsx";
import { Empty, Spinner } from "../components/ui.tsx";

type SortMode = "score" | "date" | "distance" | "wait";

const SORT_LABELS: Record<SortMode, string> = {
  score: "Mai-Score",
  date: "Datum",
  distance: "Entfernung",
  wait: "Wartezeit",
};

export function Ranking() {
  const { me, hq } = useSession();
  const toast = useToast();
  const { weights, setWeights, presetId, setPresetId } = useStoredWeights();

  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sort, setSort] = useState<SortMode>("score");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [tunerOpen, setTunerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .trips()
      .then((data) => {
        if (cancelled) return;
        setTrips(data.trips);
        setStats(data.stats);
      })
      .catch((err) => {
        if (!cancelled) toast(err instanceof ApiError ? err.message : "Laden fehlgeschlagen", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const visible = useMemo(() => {
    if (!trips) return [];
    const filtered = onlyOpen ? trips.filter((trip) => !trip.myRating) : trips;
    const sorted = [...filtered];
    switch (sort) {
      case "date":
        sorted.sort((a, b) => b.tripDate.localeCompare(a.tripDate));
        break;
      case "distance":
        sorted.sort((a, b) => a.restaurant.distanceKm - b.restaurant.distanceKm);
        break;
      case "wait":
        sorted.sort(
          (a, b) => (a.aggregate.waitMedian ?? Infinity) - (b.aggregate.waitMedian ?? Infinity),
        );
        break;
      default:
        sorted.sort((a, b) => rankKey(b.aggregate, weights) - rankKey(a.aggregate, weights));
    }
    return sorted;
  }, [trips, sort, onlyOpen, weights]);

  const unrated = trips?.filter((trip) => !trip.myRating).length ?? 0;
  const leader = trips ? [...trips].sort((a, b) => rankKey(b.aggregate, weights) - rankKey(a.aggregate, weights))[0] : undefined;
  const leaderScore = leader ? scoreTrip(leader.aggregate, weights).score : null;

  return (
    <div className="stack stack--lg">
      <section className="glass glass--sheen hero fade-up">
        <div className="hero__grid">
          <div>
            <span className="eyebrow">Saison {new Date().getFullYear()} · Durst Brixen</span>
            <h1 style={{ margin: "10px 0 14px" }}>
              Die <span className="gradient-text">Mai-Ausflüge</span>, sauber vermessen.
            </h1>
            <p className="hero__lead">
              Jedes Lokal bekommt einen Mai-Score aus sieben Zutaten: Essen, Erlebnis, Ambiente,
              Service, Preis-Leistung, die Wartezeit auf den Teller und die Anfahrt ab {hq.label}.
              {unrated > 0 && me ? ` Bei dir fehlen noch ${unrated} Bewertungen.` : ""}
            </p>
            <div className="row" style={{ marginTop: 20 }}>
              <Link to="/neu" className="btn btn--primary">
                Ausflug eintragen
              </Link>
              {unrated > 0 && (
                <button type="button" className="btn" onClick={() => setOnlyOpen(true)}>
                  Offene Bewertungen ({unrated})
                </button>
              )}
            </div>
          </div>

          {stats && (
            <div className="statgrid">
              <div className="stat">
                <div className="stat__value tnum">{stats.tripCount}</div>
                <div className="stat__label">Ausflüge</div>
              </div>
              <div className="stat">
                <div className="stat__value tnum">{stats.ratingCount}</div>
                <div className="stat__label">Bewertungen</div>
              </div>
              <div className="stat">
                <div className="stat__value tnum">{stats.photoCount}</div>
                <div className="stat__label">Food-Pics</div>
              </div>
              <div className="stat">
                <div className="stat__value tnum">{Math.round(stats.totalKm)}</div>
                <div className="stat__label">km hin & zurück</div>
              </div>
              <div className="stat">
                <div className="stat__value tnum">{formatHours(stats.totalTravelMin)}</div>
                <div className="stat__label">im Auto</div>
              </div>
              <div className="stat">
                <div className="stat__value tnum">
                  {leaderScore === null ? "–" : leaderScore.toFixed(1)}
                </div>
                <div className="stat__label">Bestwert</div>
              </div>
            </div>
          )}
        </div>
      </section>

      <WeightTuner
        weights={weights}
        onChange={setWeights}
        presetId={presetId}
        onPreset={setPresetId}
        open={tunerOpen}
        onToggle={() => setTunerOpen((open) => !open)}
      />

      <section className="stack">
        <div className="pagehead">
          <div>
            <span className="eyebrow">Rangliste</span>
            <h2 style={{ marginTop: 4 }}>
              {visible.length} {visible.length === 1 ? "Ausflug" : "Ausflüge"}
            </h2>
          </div>
          <div className="row row--tight">
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className="preset"
                aria-pressed={sort === mode}
                onClick={() => setSort(mode)}
              >
                {SORT_LABELS[mode]}
              </button>
            ))}
            <button
              type="button"
              className="preset"
              aria-pressed={onlyOpen}
              onClick={() => setOnlyOpen((value) => !value)}
              title="Nur Ausflüge, die du noch nicht bewertet hast"
            >
              Nur offene
            </button>
          </div>
        </div>

        {trips === null ? (
          <div className="glass glass--pad">
            <Spinner label="Ausflüge werden geladen…" />
          </div>
        ) : visible.length === 0 ? (
          <div className="glass glass--pad">
            <Empty title={onlyOpen ? "Alles bewertet." : "Noch kein Ausflug eingetragen."}>
              <p>
                {onlyOpen
                  ? "Du hast zu jedem Ausflug etwas gesagt. Vorbildlich."
                  : "Trag den ersten ein - Lokal, Datum, fertig."}
              </p>
              {!onlyOpen && (
                <Link to="/neu" className="btn btn--primary" style={{ marginTop: 14 }}>
                  Ausflug eintragen
                </Link>
              )}
            </Empty>
          </div>
        ) : (
          <div className="ranklist">
            {visible.map((trip, index) => (
              <TripCard key={trip.id} trip={trip} rank={index + 1} weights={weights} />
            ))}
          </div>
        )}
      </section>

      {trips && trips.length > 0 && (
        <section className="detail__grid detail__grid--even">
          <div className="glass glass--sheen glass--pad">
            <span className="eyebrow">Auszeichnungen</span>
            <h2 style={{ margin: "4px 0 18px" }}>Rekorde der Saison</h2>
            <div className="awards">
              {stats?.awards.map((award) =>
                award.tripId ? (
                  <Link key={award.key} to={`/ausflug/${award.tripId}`} className="award">
                    <span className="award__title">{award.title}</span>
                    <span className="award__value">{award.tripTitle}</span>
                    <span className="muted small">
                      {award.value} · {award.subtitle}
                    </span>
                  </Link>
                ) : (
                  <div key={award.key} className="award">
                    <span className="award__title">{award.title}</span>
                    <span className="award__value muted">Noch offen</span>
                    <span className="muted small">{award.subtitle}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          <div className="glass glass--sheen glass--pad">
            <span className="eyebrow">Radar</span>
            <h2 style={{ margin: "4px 0 6px" }}>Wo waren wir überall?</h2>
            <p className="muted small" style={{ marginBottom: 8 }}>
              Richtung und Entfernung ab {hq.label}. Punktgröße = Anzahl Stimmen, Farbe = Score.
            </p>
            <Radar trips={trips} weights={weights} hqLabel="HQ" />
          </div>
        </section>
      )}
    </div>
  );
}
