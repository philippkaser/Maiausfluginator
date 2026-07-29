import { useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { useToast } from "../lib/store.tsx";
import { DIMENSIONS, DIMENSION_HINTS, DIMENSION_LABELS } from "../../shared/types.ts";
import type { Dimension, Rating, TripDetail } from "../../shared/types.ts";

type Draft = Record<Dimension, number> & { waitMinutes: string; comment: string };

const NEUTRAL: Draft = {
  essen: 7,
  service: 7,
  ambiente: 7,
  preis: 7,
  erlebnis: 7,
  waitMinutes: "",
  comment: "",
};

function toDraft(rating: Rating | null): Draft {
  if (!rating) return { ...NEUTRAL };
  return {
    essen: rating.essen,
    service: rating.service,
    ambiente: rating.ambiente,
    preis: rating.preis,
    erlebnis: rating.erlebnis,
    waitMinutes: rating.waitMinutes === null ? "" : String(rating.waitMinutes),
    comment: rating.comment ?? "",
  };
}

export function RatingForm({
  trip,
  onSaved,
}: {
  trip: TripDetail;
  onSaved: (trip: TripDetail) => void;
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
        comment: draft.comment.trim() || null,
      });
      onSaved(result.trip);
      toast(existing ? "Bewertung aktualisiert." : "Danke für deine Bewertung.", "success");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Deine Bewertung für diesen Ausflug löschen?")) return;
    setBusy(true);
    try {
      const result = await api.deleteRating(trip.id);
      onSaved(result.trip);
      setDraft({ ...NEUTRAL });
      toast("Bewertung gelöscht.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Löschen fehlgeschlagen", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="stack">
      <div className="row row--between">
        <div>
          <span className="eyebrow">Deine Stimme</span>
          <h2 style={{ marginTop: 4 }}>{existing ? "Bewertung anpassen" : "Wie war es?"}</h2>
        </div>
        {existing && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={remove} disabled={busy}>
            Löschen
          </button>
        )}
      </div>

      <div className="stack stack--sm">
        {DIMENSIONS.map((dimension) => (
          <div key={dimension} className="rate">
            <div className="rate__head">
              <span>
                <span className="rate__name">{DIMENSION_LABELS[dimension]}</span>
                <br />
                <span className="rate__hint">{DIMENSION_HINTS[dimension]}</span>
              </span>
              <span className="rate__score">{draft[dimension]}</span>
            </div>
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
          </div>
        ))}
      </div>

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
          onChange={(event) => setDraft((current) => ({ ...current, waitMinutes: event.target.value }))}
        />
        <span className="field__hint">
          Minuten zwischen Bestellung und Teller. Aus allen Angaben wird der Median genommen – leer
          lassen ist ok.
        </span>
      </label>

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

      <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
        {busy ? "Speichern…" : existing ? "Bewertung aktualisieren" : "Bewertung abschicken"}
      </button>
    </form>
  );
}
