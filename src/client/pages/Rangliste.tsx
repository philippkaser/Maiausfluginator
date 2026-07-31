/**
 * Rangliste — the results.
 *
 * Three movements. The hero is the leader of the season: one very large number
 * with the seven components that produced it, on the only refracted-glass panel
 * on the page. Then the podium. Then the whole field as a single grouped list.
 *
 * The weighting lives in a sheet, not here. That is the structural argument of
 * this redesign: this section is a document about who won, and a document should
 * not have knobs in the middle of it.
 */

import { useMemo, useState } from "react";

import { Frost } from "../components/Frost.tsx";
import { Breakdown, ScoreNumeral } from "../components/Score.tsx";
import { TripRow } from "../components/TripRow.tsx";
import { Empty, Pane, Segmented, Spinner, Tag } from "../components/ui.tsx";
import { useSeason } from "../lib/data.tsx";
import { formatDecimal, formatShortDate } from "../lib/format.ts";
import { useReveal } from "../lib/motion.ts";
import { Link } from "../lib/router.tsx";
import { useSession, useStoredWeights } from "../lib/store.tsx";
import { WeightSheet } from "../sheets/WeightSheet.tsx";
import { rankKey, scoreTrip, type Weights } from "../../shared/scoring.ts";
import type { Trip } from "../../shared/types.ts";

type SortMode = "score" | "date" | "distance" | "wait";

const SORTS: { value: SortMode; label: string; title: string }[] = [
  { value: "score", label: "Score", title: "Nach dem Mai-Score, deiner Gewichtung entsprechend" },
  { value: "date", label: "Zuletzt", title: "Neueste zuerst" },
  { value: "distance", label: "Nähe", title: "Kürzeste Anfahrt zuerst" },
  { value: "wait", label: "Tempo", title: "Kürzeste Wartezeit aufs Essen zuerst" },
];

export function Rangliste() {
  const { me } = useSession();
  const { trips, stats, error } = useSeason();
  const { weights, setWeights, presetId, setPresetId } = useStoredWeights();

  const [sort, setSort] = useState<SortMode>("score");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [tuning, setTuning] = useState(false);

  const reveal = useReveal([trips === null]);

  const ranked = useMemo(
    () => (trips ? [...trips].sort((a, b) => rankKey(b.aggregate, weights) - rankKey(a.aggregate, weights)) : []),
    [trips, weights],
  );

  const visible = useMemo(() => {
    const filtered = onlyOpen ? ranked.filter((trip) => !trip.myRating) : ranked;
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
        break; // already in rank order
    }
    return sorted;
  }, [ranked, sort, onlyOpen]);

  // The leader is only a leader once somebody has actually voted.
  const leader = ranked.find((trip) => trip.aggregate.ratingCount > 0) ?? null;
  const open = trips?.filter((trip) => !trip.myRating).length ?? 0;
  const year = new Date().getFullYear();

  if (error) {
    return (
      <Pane>
        <Empty title="Die Saison lädt gerade nicht.">
          <p className="small">{error}</p>
        </Empty>
      </Pane>
    );
  }

  return (
    <div className="stack stack--lg" ref={reveal}>
      <Hero leader={leader} weights={weights} year={year} open={open} onTune={() => setTuning(true)} />

      {ranked.length >= 3 && (
        <section data-reveal>
          <div className="section__head">
            <div className="stack" style={{ gap: 4 }}>
              <span className="eyebrow">Das Podium</span>
              <h2>Die drei besten Teller</h2>
            </div>
          </div>
          <Podium trips={ranked.slice(0, 3)} weights={weights} />
        </section>
      )}

      <section data-reveal>
        <div className="section__head">
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow">Alle {trips?.length ?? 0} Ausflüge</span>
            <h2>Das ganze Feld</h2>
          </div>

          <div className="row row--tight">
            <Segmented value={sort} options={SORTS} onChange={setSort} label="Sortierung" />
            {open > 0 && (
              <button
                type="button"
                className="btn btn--sm"
                aria-pressed={onlyOpen}
                onClick={() => setOnlyOpen((value) => !value)}
              >
                Nur meine offenen
              </button>
            )}
          </div>
        </div>

        {trips === null ? (
          <Pane>
            <Spinner label="Die Saison wird geholt…" />
          </Pane>
        ) : visible.length === 0 ? (
          <Pane>
            <Empty title={onlyOpen ? "Du bist durch." : "Noch kein Ausflug eingetragen."}>
              <p className="small">
                {onlyOpen
                  ? "Zu jedem Ausflug liegt eine Stimme von dir."
                  : "Trag den ersten ein — Lokal, Datum, fertig."}
              </p>
            </Empty>
          </Pane>
        ) : (
          <Pane pad={false} flush>
            <div className="rows rows--flush">
              {visible.map((trip, index) => (
                <TripRow
                  key={trip.id}
                  trip={trip}
                  // In score order the position *is* the rank. In any other
                  // order it is just a line number, so show the real rank.
                  rank={sort === "score" ? index + 1 : ranked.indexOf(trip) + 1}
                  weights={weights}
                />
              ))}
            </div>
          </Pane>
        )}

        {stats && (
          <p className="small dim" style={{ marginTop: 16 }}>
            {stats.ratingCount} Stimmen von {stats.memberCount} Mitgliedern ·{" "}
            {Math.round(stats.totalKm)} km gefahren · {stats.photoCount} Fotos.{" "}
            <button type="button" className="linkbtn" onClick={() => setTuning(true)}>
              Anders gewichten
            </button>
            .
          </p>
        )}
      </section>

      {tuning && (
        <WeightSheet
          weights={weights}
          onChange={setWeights}
          presetId={presetId}
          onPreset={setPresetId}
          onClose={() => setTuning(false)}
        />
      )}
    </div>
  );
}

/**
 * The hero. One number, very large, and what it is made of.
 *
 * This is the only refracted-glass surface in the section: it is the thing you
 * see before you have read anything, so it gets the material that only a shader
 * can draw.
 */
function Hero({
  leader,
  weights,
  year,
  open,
  onTune,
}: {
  leader: Trip | null;
  weights: Weights;
  year: number;
  open: number;
  onTune: () => void;
}) {
  const breakdown = leader ? scoreTrip(leader.aggregate, weights) : null;

  return (
    <Frost>
      <div className="hero__grid" data-reveal>
        <div className="stack">
          <span className="eyebrow">Spitze der Saison {year}</span>

          {leader ? (
            <>
              <h1 className="hero__name">{leader.restaurant.name}</h1>
              <p className="lead">
                {leader.restaurant.town} · {formatShortDate(leader.tripDate)} ·{" "}
                {leader.aggregate.ratingCount}{" "}
                {leader.aggregate.ratingCount === 1 ? "Stimme" : "Stimmen"}
              </p>

              <div className="row row--tight" style={{ marginTop: 4 }}>
                <Tag tone="copper">Platz 1</Tag>
                <Tag>{formatDecimal(leader.restaurant.distanceKm)} km ab HQ</Tag>
                {leader.aggregate.waitMedian !== null && (
                  <Tag>{Math.round(leader.aggregate.waitMedian)} min aufs Essen</Tag>
                )}
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <Link to={`/ausflug/${leader.id}`} className="btn btn--primary">
                  Ansehen
                </Link>
                <button type="button" className="btn" onClick={onTune}>
                  Anders gewichten
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="hero__name">Noch ist alles offen.</h1>
              <p className="lead">
                Sobald die erste Stimme da ist, steht hier, wer vorne liegt — und woraus sich das
                rechnet. Sieben Komponenten: fünf bewertet ihr selbst, die Wartezeit aufs Essen und
                die Anfahrt kommen dazu.
              </p>
            </>
          )}

          {open > 0 && (
            <p className="small dim">
              Bei dir fehlen noch {open} {open === 1 ? "Bewertung" : "Bewertungen"}.
            </p>
          )}
        </div>

        <div className="hero__score">
          <ScoreNumeral
            score={breakdown?.score ?? null}
            countKey={leader?.id ?? "leer"}
          />
          {breakdown && <Breakdown breakdown={breakdown} />}
        </div>
      </div>
    </Frost>
  );
}

/**
 * The podium. Gold gets the tall pane and the copper edge; silver and bronze
 * stand beside it. The ranks are drawn as numerals rather than medals — this is
 * a company outing, not the Olympics.
 */
function Podium({ trips, weights }: { trips: Trip[]; weights: Weights }) {
  return (
    <div className="podium">
      {trips.map((trip, index) => {
        const { score } = scoreTrip(trip.aggregate, weights);
        return (
          <Link
            key={trip.id}
            to={`/ausflug/${trip.id}`}
            className={index === 0 ? "pane pane--action podium__slot podium__slot--first" : "pane pane--action podium__slot"}
          >
            <span className="podium__rank tnum">{index + 1}</span>
            <span className="podium__name">{trip.restaurant.name}</span>
            <span className="small dim">{trip.restaurant.town}</span>
            <span className="podium__score tnum">
              {score === null ? "–" : formatDecimal(score)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
