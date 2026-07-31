/**
 * Bewerten.
 *
 * Five sliders, the wait for the food, and a comment. One vote per person per
 * Ausflug, changeable forever — which is why the sheet opens on your existing
 * answers rather than on a blank form.
 *
 * The sliders start at 7 rather than in the middle. A neutral 5 or 6 is a lie
 * about how people actually rate a lunch they chose to go to, and starting there
 * quietly drags every score down.
 */

import { useState } from "react";

import { Sheet } from "../components/Sheet.tsx";
import { Segmented } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { useToast } from "../lib/store.tsx";
import { DIMENSIONS, DIMENSION_HINTS, DIMENSION_LABELS } from "../../shared/types.ts";
import type { Dimension, Rating, TripDetail } from "../../shared/types.ts";

/**
 * The card answer is three-valued, and the third value carries real meaning:
 * "nicht probiert" is not "abgelehnt". Held as a string because that is what a
 * segmented control deals in.
 */
type CardAnswer = "unbekannt" | "ja" | "nein";

const CARD_OPTIONS: { value: CardAnswer; label: string; title: string }[] = [
  { value: "ja", label: "Angenommen", title: "Die Karte wurde akzeptiert — zehn Euro weniger" },
  { value: "nein", label: "Abgelehnt", title: "Die Karte wurde nicht akzeptiert" },
  { value: "unbekannt", label: "Nicht probiert", title: "Niemand hat es versucht" },
];

type Draft = Record<Dimension, number> & {
  waitMinutes: string;
  card: CardAnswer;
  comment: string;
};

const NEUTRAL: Draft = {
  essen: 7,
  service: 7,
  ambiente: 7,
  preis: 7,
  erlebnis: 7,
  waitMinutes: "",
  card: "unbekannt",
  comment: "",
};

function toCardAnswer(value: boolean | null): CardAnswer {
  return value === null ? "unbekannt" : value ? "ja" : "nein";
}

function fromCardAnswer(answer: CardAnswer): boolean | null {
  return answer === "unbekannt" ? null : answer === "ja";
}

function toDraft(rating: Rating | null): Draft {
  if (!rating) return { ...NEUTRAL };
  return {
    essen: rating.essen,
    service: rating.service,
    ambiente: rating.ambiente,
    preis: rating.preis,
    erlebnis: rating.erlebnis,
    waitMinutes: rating.waitMinutes === null ? "" : String(rating.waitMinutes),
    card: toCardAnswer(rating.cardAccepted),
    comment: rating.comment ?? "",
  };
}

export function RatingSheet({
  trip,
  onSaved,
  onClose,
}: {
  trip: TripDetail;
  onSaved: (trip: TripDetail) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(trip.myRating));
  const [busy, setBusy] = useState(false);
  const existing = trip.myRating !== null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api.saveRating(trip.id, {
        essen: draft.essen,
        service: draft.service,
        ambiente: draft.ambiente,
        preis: draft.preis,
        erlebnis: draft.erlebnis,
        waitMinutes: draft.waitMinutes === "" ? null : Number(draft.waitMinutes),
        cardAccepted: fromCardAnswer(draft.card),
        comment: draft.comment.trim() || null,
      });
      onSaved(result.trip);
      toast(existing ? "Geändert." : "Danke — deine Stimme zählt.", "success");
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Das ließ sich nicht speichern.", "error");
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Deine Bewertung für diesen Ausflug löschen?")) return;
    setBusy(true);
    try {
      const result = await api.deleteRating(trip.id);
      onSaved(result.trip);
      toast("Bewertung gelöscht.");
      onClose();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Das ließ sich nicht löschen.", "error");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={existing ? "Deine Bewertung" : "Wie war es?"}
      description={trip.restaurant.name}
      onClose={onClose}
      footer={
        <div className="row row--tight" style={{ flexWrap: "nowrap" }}>
          <button type="submit" form="rating" className="btn btn--primary" style={{ flex: 1 }} disabled={busy}>
            {busy ? "Speichern…" : existing ? "Bewertung ändern" : "Bewertung abschicken"}
          </button>
          {existing && (
            <button type="button" className="btn btn--danger" onClick={remove} disabled={busy}>
              Löschen
            </button>
          )}
        </div>
      }
    >
      <form id="rating" onSubmit={save} className="stack stack--md">
        <div className="stack stack--md">
          {DIMENSIONS.map((dimension) => (
            <label key={dimension} className="slider">
              <span className="slider__head">
                <span className="slider__name">{DIMENSION_LABELS[dimension]}</span>
                <span className="slider__score tnum">{draft[dimension]}</span>
              </span>
              <span className="slider__hint">{DIMENSION_HINTS[dimension]}</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={draft[dimension]}
                style={{ ["--fill" as string]: `${((draft[dimension] - 1) / 9) * 100}%` }}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [dimension]: Number(event.target.value) }))
                }
                aria-label={DIMENSION_LABELS[dimension]}
              />
            </label>
          ))}
        </div>

        <hr className="divider" />

        <label className="field">
          <span className="field__label">Wartezeit aufs Essen</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={300}
            placeholder="z. B. 25"
            value={draft.waitMinutes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, waitMinutes: event.target.value }))
            }
          />
          <span className="field__hint">
            Minuten zwischen Bestellung und Teller. Aus allen Angaben wird der Median — leer lassen
            ist völlig in Ordnung.
          </span>
        </label>

        <div className="field">
          <span className="field__label">Durst-Karte</span>
          <Segmented
            value={draft.card}
            options={CARD_OPTIONS}
            label="Durst-Karte"
            block
            onChange={(card) => setDraft((current) => ({ ...current, card }))}
          />
          <span className="field__hint">
            Zehn Euro weniger auf die Rechnung — das ist für ein Lokal ein echtes Argument. Wenn es
            niemand versucht hat, lass es einfach auf „nicht probiert“ stehen.
          </span>
        </div>

        <label className="field">
          <span className="field__label">Kommentar</span>
          <textarea
            className="textarea"
            value={draft.comment}
            maxLength={1500}
            placeholder="Was war gut, was nicht? Kurz und ehrlich."
            onChange={(event) => setDraft((current) => ({ ...current, comment: event.target.value }))}
          />
        </label>
      </form>
    </Sheet>
  );
}
