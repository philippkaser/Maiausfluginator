/**
 * Ausflüge — the season, browsable.
 *
 * The Rangliste asks who won and answers in a list. This asks where we have
 * been, and answers with the places themselves: a photo-led grid, plus the radar,
 * which is the only view in the app that shows the season as geography rather
 * than as a table.
 */

import { useMemo, useState } from "react";

import { Radar } from "../components/Radar.tsx";
import { TripCard } from "../components/TripCard.tsx";
import { Empty, Pane, Segmented, Spinner } from "../components/ui.tsx";
import { useSeason } from "../lib/data.tsx";
import { formatHours } from "../lib/format.ts";
import { useReveal } from "../lib/motion.ts";
import { useSession, useStoredWeights } from "../lib/store.tsx";
import { rankKey } from "../../shared/scoring.ts";

type Lens = "neu" | "score" | "nah" | "offen";

const LENSES: { value: Lens; label: string; title: string }[] = [
  { value: "neu", label: "Zuletzt", title: "Die jüngsten Ausflüge zuerst" },
  { value: "score", label: "Beste", title: "Nach dem Mai-Score" },
  { value: "nah", label: "Um die Ecke", title: "Kürzeste Anfahrt ab HQ" },
  { value: "offen", label: "Ungehört", title: "Ausflüge ohne deine Stimme" },
];

export function Ausfluege() {
  const { hq } = useSession();
  const { trips, stats, error } = useSeason();
  const { weights } = useStoredWeights();
  const [lens, setLens] = useState<Lens>("neu");

  const reveal = useReveal([trips === null]);

  const visible = useMemo(() => {
    if (!trips) return [];
    const list = lens === "offen" ? trips.filter((trip) => !trip.myRating) : [...trips];
    switch (lens) {
      case "score":
        list.sort((a, b) => rankKey(b.aggregate, weights) - rankKey(a.aggregate, weights));
        break;
      case "nah":
        list.sort((a, b) => a.restaurant.distanceKm - b.restaurant.distanceKm);
        break;
      default:
        list.sort((a, b) => b.tripDate.localeCompare(a.tripDate));
    }
    return list;
  }, [trips, lens, weights]);

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
      <header className="stack" data-reveal>
        <span className="eyebrow">Die Saison</span>
        <h1>Wo wir waren</h1>
        <p className="lead">
          {stats
            ? `${stats.tripCount} ${stats.tripCount === 1 ? "Ausflug" : "Ausflüge"}, ${Math.round(stats.totalKm)} Kilometer und ${formatHours(stats.totalTravelMin)} unterwegs — gemessen ab ${hq.label}.`
            : `Alles, wo wir gemeinsam gegessen haben, gemessen ab ${hq.label}.`}
        </p>
      </header>

      <section data-reveal>
        <div className="section__head">
          <div className="stack" style={{ gap: 4 }}>
            <span className="eyebrow">
              {visible.length} {visible.length === 1 ? "Ziel" : "Ziele"}
            </span>
            <h2>Die Ziele</h2>
          </div>
          <Segmented value={lens} options={LENSES} onChange={setLens} label="Ansicht" />
        </div>

        {trips === null ? (
          <Pane>
            <Spinner label="Die Saison wird geholt…" />
          </Pane>
        ) : visible.length === 0 ? (
          <Pane>
            <Empty
              title={
                lens === "offen" ? "Du hast überall etwas gesagt." : "Noch kein Ausflug eingetragen."
              }
            >
              <p className="small">
                {lens === "offen"
                  ? "Zu jedem Ziel liegt eine Stimme von dir."
                  : "Oben rechts auf „Eintragen“ — Lokal, Datum, fertig."}
              </p>
            </Empty>
          </Pane>
        ) : (
          <div className="grid">
            {visible.map((trip) => (
              <TripCard key={trip.id} trip={trip} weights={weights} />
            ))}
          </div>
        )}
      </section>

      {trips && trips.length > 0 && (
        <section data-reveal>
          <div className="section__head">
            <div className="stack" style={{ gap: 4 }}>
              <span className="eyebrow">Ohne Kartendienst</span>
              <h2>Radar</h2>
            </div>
          </div>

          <Pane>
            <div className="radar__wrap">
              <Radar trips={trips} weights={weights} hqLabel="HQ" />
              <div className="stack">
                <p className="muted">
                  Jeder Punkt ist ein Ziel, in seiner echten Himmelsrichtung ab {hq.label}. Nach außen
                  wächst die Entfernung, die Punktgröße ist die Zahl der Stimmen.
                </p>
                <p className="small dim">
                  Die Ringe stehen auf einer Wurzelskala, damit die nahen Ziele nicht alle in der
                  Mitte kleben. Gerechnet wird hier, nicht bei einem Kartenanbieter — was intern
                  bleiben soll, verlässt das Haus nicht.
                </p>
              </div>
            </div>
          </Pane>
        </section>
      )}
    </div>
  );
}
