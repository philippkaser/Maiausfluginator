/**
 * Find a place by name.
 *
 * The point of this box is not the box. It is that picking a row writes the
 * name, the town, the street, sometimes the kitchen and the website, and the two
 * coordinates — all at once, from one thing anybody can type. Before this, adding
 * a restaurant meant knowing its latitude.
 *
 * Answers come from `/api/places/search`, which is our own server standing in
 * front of Nominatim (`server/osm.ts`). Nominatim's usage policy is one request
 * per second and the server enforces that no matter what, so the debounce here
 * is politeness rather than the guarantee — but it is also why the field does not
 * feel like it is fighting you: 450 ms is about a hand's pause between words.
 */

import { useEffect, useId, useRef, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import type { PlaceHit } from "../../shared/types.ts";

/** Below three characters every query in the world matches. */
const MIN_QUERY = 3;
const DEBOUNCE_MS = 450;

export function FindPlace({
  onChoose,
  autoFocus = false,
}: {
  onChoose: (place: PlaceHit) => void;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[] | null>(null);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once a row is taken, so the list does not spring back open when the
  // field it just filled re-renders.
  const settled = useRef(false);

  useEffect(() => {
    if (settled.current) return;

    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setHits(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      api
        .searchPlaces(trimmed, controller.signal)
        .then((data) => {
          setHits(data.places);
          setActive(data.places.length > 0 ? 0 : -1);
          setError(null);
        })
        .catch((err) => {
          // The caller aborted: a newer keystroke is already on its way.
          if (err instanceof DOMException && err.name === "AbortError") return;
          setHits(null);
          setError(
            err instanceof ApiError
              ? err.message
              : "Die Suche ist nicht erreichbar — tipp den Ort auf der Karte an.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const open = hits !== null && hits.length > 0;

  function choose(place: PlaceHit) {
    settled.current = true;
    setQuery(place.name);
    setHits(null);
    setActive(-1);
    onChoose(place);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    const list = hits!;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + list.length) % list.length);
    } else if (event.key === "Enter") {
      // Only swallow Enter when it means "take this one" — otherwise it belongs
      // to the form, and stealing it would make the whole sheet unsubmittable.
      if (active >= 0 && list[active]) {
        event.preventDefault();
        choose(list[active]!);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setHits(null);
      setActive(-1);
    }
  }

  return (
    <div className="findplace">
      <label className="field">
        <span className="field__label">Lokal suchen</span>
        <input
          className="input"
          type="text"
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 && open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder="Pizzeria Mair Brixen"
          onChange={(event) => {
            settled.current = false;
            setQuery(event.target.value);
          }}
          onKeyDown={onKeyDown}
        />
        <span className="field__hint">
          {busy
            ? "Sucht…"
            : error
              ? error
              : "Name und Ort genügen. Aus dem Treffer werden Adresse und Koordinaten übernommen."}
        </span>
      </label>

      {open && (
        <ul className="findplace__hits" id={listId} role="listbox" aria-label="Treffer">
          {hits!.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="findplace__hit"
              // Mousedown rather than click: the input's blur would otherwise
              // close the list out from under the pointer.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <span className="findplace__hit-name">{place.name}</span>
              <span className="findplace__hit-where">
                {[place.town, place.address].filter(Boolean).join(" · ") || place.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
