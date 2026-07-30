import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { formatDecimal, formatHours } from "../lib/format.ts";
import { Link } from "../lib/router.tsx";
import { useSession, useStoredWeights, useToast } from "../lib/store.tsx";
import { rankKey, scoreTrip } from "../../shared/scoring.ts";
import type { Stats, Trip } from "../../shared/types.ts";
import { Radar } from "../components/Radar.tsx";
import { TripRow } from "../components/TripRow.tsx";
import { WeightTuner } from "../components/WeightTuner.tsx";
import { Empty, Segmented, Spinner } from "../components/ui.tsx";

type SortMode = "score" | "date" | "distance" | "wait";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "date", label: "Datum" },
  { value: "distance", label: "Entfernung" },
  { value: "wait", label: "Wartezeit" },
];

export function Ranking() {
  const { me, hq } = useSession();
  const toast = useToast();
  const { weights, setWeights, presetId, setPresetId } = useStoredWeights();

  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sort, setSort] = useState<SortMode>("score");
  const [onlyOpen, setOnlyOpen] = useState(false);

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
  const leader = trips
    ? [...trips].sort((a, b) => rankKey(b.aggregate, weights) - rankKey(a.aggregate, weights))[0]
    : undefined;
  const leaderScore = leader ? scoreTrip(leader.aggregate, weights).score : null;

  return (
    <div className="stack stack--lg">
      <header className="stack" style={{ gap: 24 }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            Durst Brixen
          </p>
          <h1>Mai-Ausflüge {new Date().getFullYear()}</h1>
          <p className="lead" style={{ marginTop: 12 }}>
            Jedes Lokal bekommt einen Mai-Score aus sieben Komponenten — fünf davon bewertet ihr
            selbst, dazu die Wartezeit aufs Essen und die Anfahrt ab {hq.label}.
            {unrated > 0 && me ? ` Bei dir fehlen noch ${unrated} Bewertungen.` : ""}
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link to="/neu" className="btn btn--primary">
              Ausflug eintragen
            </Link>
            {unrated > 0 && (
              <button type="button" className="btn" onClick={() => setOnlyOpen(true)}>
                {unrated} offen
              </button>
            )}
          </div>
        </div>

        {stats && (
          <div className="stats card glass--rim">
            <div className="stat">
              <div className="stat__value">{stats.tripCount}</div>
              <div className="stat__label">Ausflüge</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.ratingCount}</div>
              <div className="stat__label">Bewertungen</div>
            </div>
            <div className="stat">
              <div className="stat__value">{stats.photoCount}</div>
              <div className="stat__label">Fotos</div>
            </div>
            <div className="stat">
              <div className="stat__value">{Math.round(stats.totalKm)}</div>
              <div className="stat__label">km gefahren</div>
            </div>
            <div className="stat">
              <div className="stat__value">{formatHours(stats.totalTravelMin)}</div>
              <div className="stat__label">unterwegs</div>
            </div>
            <div className="stat">
              <div className="stat__value">
                {leaderScore === null ? "–" : formatDecimal(leaderScore)}
              </div>
              <div className="stat__label">Bestwert</div>
            </div>
          </div>
        )}
      </header>

      <WeightTuner
        weights={weights}
        onChange={setWeights}
        presetId={presetId}
        onPreset={setPresetId}
      />

      <section>
        <div className="section__head">
          <h2>Rangliste</h2>
          <div className="row row--tight">
            <Segmented value={sort} options={SORT_OPTIONS} onChange={setSort} label="Sortierung" />
            <button
              type="button"
              className="btn btn--sm"
              aria-pressed={onlyOpen}
              onClick={() => setOnlyOpen((value) => !value)}
            >
              Nur offene
            </button>
          </div>
        </div>

        {trips === null ? (
          <div className="card card--pad">
            <Spinner label="Wird geladen…" />
          </div>
        ) : visible.length === 0 ? (
          <div className="card card--pad">
            <Empty title={onlyOpen ? "Alles bewertet." : "Noch kein Ausflug eingetragen."}>
              <p className="small">
                {onlyOpen
                  ? "Du hast zu jedem Ausflug etwas gesagt."
                  : "Trag den ersten ein — Lokal, Datum, fertig."}
              </p>
              {!onlyOpen && (
                <Link to="/neu" className="btn btn--primary" style={{ marginTop: 14 }}>
                  Ausflug eintragen
                </Link>
              )}
            </Empty>
          </div>
        ) : (
          <div className="card card--flush glass--rim">
            <div className="list">
              {visible.map((trip, index) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  rank={index + 1}
                  index={index}
                  weights={weights}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {trips && trips.length > 0 && (
        <section className="split split--even">
          <div>
            <div className="section__head">
              <h2>Rekorde der Saison</h2>
            </div>
            <div className="awards card">
              {stats?.awards.map((award) =>
                award.tripId ? (
                  <Link key={award.key} to={`/ausflug/${award.tripId}`} className="award">
                    <span className="award__title">{award.title}</span>
                    <span className="award__value">{award.tripTitle}</span>
                    <span className="award__meta">
                      {award.value} · {award.subtitle}
                    </span>
                  </Link>
                ) : (
                  <div key={award.key} className="award">
                    <span className="award__title">{award.title}</span>
                    <span className="award__value dim">Noch offen</span>
                    <span className="award__meta">{award.subtitle}</span>
                  </div>
                ),
              )}
            </div>
          </div>

          <div>
            <div className="section__head">
              <h2>Radar</h2>
            </div>
            <div className="card card--pad">
              <p className="small dim" style={{ marginBottom: 10 }}>
                Richtung und Entfernung ab {hq.label}. Punktgröße = Stimmen.
              </p>
              <Radar trips={trips} weights={weights} hqLabel="HQ" />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
