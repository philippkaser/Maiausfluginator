/**
 * Eintragen.
 *
 * This used to be a page at `/neu`, which meant leaving the ranking in order to
 * add something to it. It is a sheet now: the list stays behind you the whole
 * time, and closing it puts you back exactly where you were.
 *
 * Two steps, because there are genuinely two questions — where did you go, and
 * when. The second step also holds the escape hatch for a place that is not in
 * the list yet, since adding a restaurant is much rarer than adding an outing to
 * one that already exists.
 */

import { useEffect, useMemo, useState } from "react";

import { Sheet } from "../components/Sheet.tsx";
import { Field, Spinner, Tag } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { useSeason } from "../lib/data.tsx";
import { formatDecimal, formatMinutes, todayIso } from "../lib/format.ts";
import { useRouter } from "../lib/router.tsx";
import { useSession, useToast } from "../lib/store.tsx";
import type { Restaurant } from "../../shared/types.ts";

const EMPTY_PLACE = {
  name: "",
  town: "",
  address: "",
  cuisine: "",
  website: "",
  lat: "",
  lon: "",
  distanceKm: "",
  travelMin: "",
};

export function NewTripSheet({ onClose }: { onClose: () => void }) {
  const { hq } = useSession();
  const { merge } = useSeason();
  const { navigate } = useRouter();
  const toast = useToast();

  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [restaurantId, setRestaurantId] = useState("");
  const [newPlace, setNewPlace] = useState(false);
  const [place, setPlace] = useState({ ...EMPTY_PLACE });

  const [title, setTitle] = useState("");
  const [tripDate, setTripDate] = useState(todayIso);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .restaurants()
      .then((data) => {
        if (live) setRestaurants(data.restaurants);
      })
      .catch((err) => {
        if (live) toast(err instanceof ApiError ? err.message : "Die Lokale laden nicht.", "error");
      });
    return () => {
      live = false;
    };
  }, [toast]);

  const selected = useMemo(
    () => restaurants?.find((restaurant) => restaurant.id === restaurantId) ?? null,
    [restaurants, restaurantId],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    try {
      let targetId = restaurantId;
      let fallbackName = selected?.name ?? "Ausflug";

      if (newPlace) {
        const created = await api.createRestaurant({
          name: place.name,
          town: place.town,
          address: place.address || null,
          cuisine: place.cuisine || null,
          website: place.website || null,
          lat: place.lat === "" ? null : Number(place.lat),
          lon: place.lon === "" ? null : Number(place.lon),
          distanceKm: place.distanceKm === "" ? null : Number(place.distanceKm),
          travelMin: place.travelMin === "" ? null : Number(place.travelMin),
        });
        targetId = created.restaurant.id;
        fallbackName = created.restaurant.name;
      }

      if (!targetId) {
        toast("Wähl zuerst ein Lokal.", "error");
        setBusy(false);
        return;
      }

      const created = await api.createTrip({
        restaurantId: targetId,
        title: title.trim() || fallbackName,
        tripDate,
        notes: notes.trim() || null,
      });

      merge(created.trip);
      toast("Eingetragen. Jetzt bist du am Wort.", "success");
      onClose();
      // Straight to the trip with the rating sheet already open — the reason for
      // entering an Ausflug is almost always to say something about it.
      navigate(`/ausflug/${created.trip.id}?bewerten=1`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Das ließ sich nicht speichern.", "error");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Ausflug eintragen"
      description={`Lokal und Datum genügen — Entfernung und Fahrzeit ab ${hq.label} rechnet der Maiausfluginator selbst.`}
      onClose={onClose}
      footer={
        // Outside the scrolling body via the `form` attribute, so the primary
        // action is reachable however long the form gets.
        <button type="submit" form="new-trip" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? "Speichern…" : "Ausflug anlegen"}
        </button>
      }
    >
      <form id="new-trip" onSubmit={submit} className="stack stack--md">
        <div className="stack">
          <div className="row row--between">
            <span className="eyebrow">Wohin ging es</span>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => setNewPlace((value) => !value)}
            >
              {newPlace ? "Aus der Liste wählen" : "Lokal fehlt noch"}
            </button>
          </div>

          {newPlace ? (
            <div className="stack">
              <Field label="Name des Lokals">
                <input
                  className="input"
                  value={place.name}
                  onChange={(event) => setPlace({ ...place, name: event.target.value })}
                  required
                  maxLength={120}
                  autoFocus
                />
              </Field>

              <div className="pair">
                <Field label="Ort">
                  <input
                    className="input"
                    value={place.town}
                    onChange={(event) => setPlace({ ...place, town: event.target.value })}
                    required
                    maxLength={80}
                  />
                </Field>
                <Field label="Küche">
                  <input
                    className="input"
                    value={place.cuisine}
                    onChange={(event) => setPlace({ ...place, cuisine: event.target.value })}
                    placeholder="Pizza, Hütte, Fisch…"
                    maxLength={80}
                  />
                </Field>
              </div>

              <Field label="Adresse">
                <input
                  className="input"
                  value={place.address}
                  onChange={(event) => setPlace({ ...place, address: event.target.value })}
                  maxLength={200}
                />
              </Field>

              <Field label="Website">
                <input
                  className="input"
                  type="url"
                  value={place.website}
                  onChange={(event) => setPlace({ ...place, website: event.target.value })}
                  placeholder="https://…"
                />
              </Field>

              <hr className="divider" />

              <p className="small dim">
                Koordinaten genügen — daraus werden Entfernung und Fahrzeit geschätzt. Wer die echten
                Werte kennt, trägt sie ein; die gewinnen immer.
              </p>

              <div className="pair">
                <Field label="Breitengrad" hint="z. B. 46.7150">
                  <input
                    className="input"
                    value={place.lat}
                    onChange={(event) => setPlace({ ...place, lat: event.target.value })}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Längengrad" hint="z. B. 11.6570">
                  <input
                    className="input"
                    value={place.lon}
                    onChange={(event) => setPlace({ ...place, lon: event.target.value })}
                    inputMode="decimal"
                  />
                </Field>
              </div>

              <div className="pair">
                <Field label="Entfernung" hint="Kilometer, einfache Strecke">
                  <input
                    className="input"
                    value={place.distanceKm}
                    onChange={(event) => setPlace({ ...place, distanceKm: event.target.value })}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Fahrzeit" hint="Minuten ab HQ">
                  <input
                    className="input"
                    value={place.travelMin}
                    onChange={(event) => setPlace({ ...place, travelMin: event.target.value })}
                    inputMode="numeric"
                  />
                </Field>
              </div>
            </div>
          ) : restaurants === null ? (
            <Spinner label="Lokale…" />
          ) : (
            <div className="stack">
              <Field label="Lokal">
                <select
                  className="select"
                  value={restaurantId}
                  onChange={(event) => setRestaurantId(event.target.value)}
                  required
                >
                  <option value="">Bitte wählen…</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name} — {restaurant.town} ({formatDecimal(restaurant.distanceKm)} km)
                    </option>
                  ))}
                </select>
              </Field>

              {selected && (
                <div className="row row--tight">
                  <Tag>{formatDecimal(selected.distanceKm)} km ab HQ</Tag>
                  <Tag>{formatMinutes(selected.travelMin)} Fahrt</Tag>
                  {selected.cuisine && <Tag>{selected.cuisine}</Tag>}
                  {selected.travelSource === "estimated" && (
                    <Tag title="Aus den Koordinaten gerechnet, nicht nachgemessen">geschätzt</Tag>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <hr className="divider" />

        <div className="stack">
          <span className="eyebrow">Wann und was</span>

          <Field label="Datum">
            <input
              className="input"
              type="date"
              value={tripDate}
              onChange={(event) => setTripDate(event.target.value)}
              required
            />
          </Field>

          <Field label="Titel" hint="Optional — sonst nehmen wir den Namen des Lokals.">
            <input
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Abteilungsausflug, Team Vorstufe…"
              maxLength={120}
            />
          </Field>

          <Field label="Notizen" hint="Anlass, Runde, Besonderheiten.">
            <textarea
              className="textarea"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>
      </form>
    </Sheet>
  );
}
