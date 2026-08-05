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
 *
 * That escape hatch used to ask for latitude and longitude. Nobody has those in
 * their head, so it was the one part of this app that felt like filling in a
 * form for a computer rather than telling it something. It is a map now: search
 * the name, or tap the spot, and the numbers derive themselves — distance and
 * drive from the HQ update under the pin as it moves, computed by the same code
 * the server will use when it saves (`shared/geo.ts`).
 *
 * The coordinates did not go away, they went under a disclosure. They are the
 * path that does not depend on being able to see a map, and they are how you
 * enter a hut the survey has never heard of.
 */

import { useEffect, useMemo, useState } from "react";

import { FindPlace } from "../components/FindPlace.tsx";
import { MapPick } from "../components/MapPick.tsx";
import { Sheet } from "../components/Sheet.tsx";
import { Field, Spinner, Tag } from "../components/ui.tsx";
import { api, ApiError } from "../lib/api.ts";
import { useSeason } from "../lib/data.tsx";
import { formatDecimal, formatMinutes, todayIso } from "../lib/format.ts";
import { useRouter } from "../lib/router.tsx";
import { useSession, useToast } from "../lib/store.tsx";
import type { PlaceHit, Restaurant } from "../../shared/types.ts";

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
  const [manual, setManual] = useState(false);
  const [locating, setLocating] = useState(false);

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

  /**
   * The pin, derived from the two text fields rather than held beside them.
   * One source of truth means typing a coordinate moves the pin and moving the
   * pin rewrites the coordinate, with nothing to keep in sync.
   */
  const spot = useMemo(() => {
    if (place.lat === "" || place.lon === "") return null;
    const lat = Number(place.lat);
    const lon = Number(place.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
  }, [place.lat, place.lon]);

  /** A search hit is the whole answer: everything the form wants, at once. */
  function takeHit(hit: PlaceHit) {
    setPlace((current) => ({
      ...current,
      name: hit.name,
      town: hit.town || current.town,
      address: hit.address ?? current.address,
      cuisine: hit.cuisine ?? current.cuisine,
      website: hit.website ?? current.website,
      lat: hit.lat.toFixed(6),
      lon: hit.lon.toFixed(6),
      // Any distance typed for a previous spot is now about the wrong place.
      distanceKm: "",
      travelMin: "",
    }));
  }

  /**
   * A tap on the map. Town and street describe the *point*, so they follow it;
   * name, kitchen and website describe the restaurant, so they are left exactly
   * as typed. Nudging the pin two doors down must not wipe the name.
   */
  async function pickSpot(next: { lat: number; lon: number }) {
    setPlace((current) => ({
      ...current,
      lat: next.lat.toFixed(6),
      lon: next.lon.toFixed(6),
      distanceKm: "",
      travelMin: "",
    }));

    setLocating(true);
    try {
      const result = await api.placeAt(next.lat, next.lon);
      if (result.place) {
        setPlace((current) => ({
          ...current,
          town: result.place!.town || current.town,
          address: result.place!.address ?? current.address,
        }));
      }
    } catch {
      // No address for this point is not a problem worth a toast: the pin is
      // set, the distance is computed, and the town can be typed.
    } finally {
      setLocating(false);
    }
  }

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
          lat: spot?.lat ?? null,
          lon: spot?.lon ?? null,
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
              <FindPlace onChoose={takeHit} autoFocus />

              <MapPick hq={hq} value={spot} onPick={pickSpot} busy={locating} />

              <hr className="divider" />

              <Field label="Name des Lokals">
                <input
                  className="input"
                  value={place.name}
                  onChange={(event) => setPlace({ ...place, name: event.target.value })}
                  required
                  maxLength={120}
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

              {/* The numbers, for the two cases the map cannot serve: a place no
                  survey knows, and somebody who has driven this route and knows
                  what it actually takes. */}
              <div className="stack" style={{ gap: 10 }}>
                <button
                  type="button"
                  className="btn btn--quiet btn--sm"
                  onClick={() => setManual((value) => !value)}
                  aria-expanded={manual}
                >
                  {manual ? "Zahlen ausblenden" : "Koordinaten und Fahrzeit von Hand"}
                </button>

                {manual && (
                  <div className="stack">
                    <p className="small dim" style={{ margin: 0 }}>
                      Aus den Koordinaten werden Entfernung und Fahrzeit geschätzt. Wer die echten
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
                )}
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
