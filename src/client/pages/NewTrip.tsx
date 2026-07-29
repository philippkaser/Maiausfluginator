import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../lib/api.ts";
import { formatMinutes, todayIso } from "../lib/format.ts";
import { useRouter } from "../lib/router.tsx";
import { useSession, useToast } from "../lib/store.tsx";
import type { Restaurant } from "../../shared/types.ts";
import { Chip, Field, Spinner } from "../components/ui.tsx";

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

export function NewTrip() {
  const { navigate } = useRouter();
  const { hq } = useSession();
  const toast = useToast();

  const [restaurants, setRestaurants] = useState<Restaurant[] | null>(null);
  const [restaurantId, setRestaurantId] = useState("");
  const [creatingPlace, setCreatingPlace] = useState(false);
  const [place, setPlace] = useState({ ...EMPTY_PLACE });

  const [title, setTitle] = useState("");
  const [tripDate, setTripDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .restaurants()
      .then((data) => setRestaurants(data.restaurants))
      .catch((err) => toast(err instanceof ApiError ? err.message : "Laden fehlgeschlagen", "error"));
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

      if (creatingPlace) {
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
      }

      if (!targetId) {
        toast("Bitte ein Lokal auswählen.", "error");
        setBusy(false);
        return;
      }

      const fallbackName = creatingPlace
        ? place.name
        : (restaurants?.find((restaurant) => restaurant.id === targetId)?.name ?? "Ausflug");

      const created = await api.createTrip({
        restaurantId: targetId,
        title: title.trim() || fallbackName,
        tripDate,
        notes: notes.trim() || null,
      });

      toast("Ausflug eingetragen. Jetzt bewerten!", "success");
      navigate(`/ausflug/${created.trip.id}`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Speichern fehlgeschlagen", "error");
      setBusy(false);
    }
  }

  return (
    <div className="stack stack--lg fade-up">
      <div>
        <span className="eyebrow">Neu</span>
        <h1 style={{ margin: "8px 0 8px" }}>Ausflug eintragen</h1>
        <p className="muted" style={{ maxWidth: "62ch" }}>
          Lokal und Datum genügen. Entfernung und Fahrzeit ab {hq.label} rechnet der Maiausfluginator
          aus den Koordinaten – wenn du es genauer weißt, trag die echten Werte ein.
        </p>
      </div>

      <form onSubmit={submit} className="detail__grid detail__grid--even">
        <section className="glass glass--sheen glass--pad stack">
          <div className="row row--between">
            <h2>Wohin ging es?</h2>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setCreatingPlace((value) => !value)}
            >
              {creatingPlace ? "Aus Liste wählen" : "Neues Lokal anlegen"}
            </button>
          </div>

          {creatingPlace ? (
            <div className="stack" style={{ gap: 14 }}>
              <Field label="Name des Lokals">
                <input
                  className="input"
                  value={place.name}
                  onChange={(event) => setPlace({ ...place, name: event.target.value })}
                  required
                  maxLength={120}
                />
              </Field>
              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
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

              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
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

              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <Field label="Entfernung (km)" hint="Leer lassen = aus Koordinaten geschätzt">
                  <input
                    className="input"
                    value={place.distanceKm}
                    onChange={(event) => setPlace({ ...place, distanceKm: event.target.value })}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Fahrzeit (min)" hint="Einfache Strecke ab HQ">
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
            <Spinner label="Lokale werden geladen…" />
          ) : (
            <>
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
                      {restaurant.name} — {restaurant.town} ({restaurant.distanceKm.toFixed(1)} km)
                    </option>
                  ))}
                </select>
              </Field>

              {selected && (
                <div className="row row--tight">
                  <Chip>{selected.distanceKm.toFixed(1)} km ab HQ</Chip>
                  <Chip>{formatMinutes(selected.travelMin)} Fahrt</Chip>
                  {selected.cuisine && <Chip tone="ghost">{selected.cuisine}</Chip>}
                  {selected.travelSource === "estimated" && <Chip tone="ghost">geschätzt</Chip>}
                </div>
              )}
            </>
          )}
        </section>

        <section className="glass glass--sheen glass--pad stack">
          <h2>Wann & was</h2>

          <Field label="Datum">
            <input
              className="input"
              type="date"
              value={tripDate}
              onChange={(event) => setTripDate(event.target.value)}
              required
            />
          </Field>

          <Field label="Titel" hint="Optional – sonst nehmen wir den Namen des Lokals.">
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

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? "Speichern…" : "Ausflug anlegen"}
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => navigate("/")}>
            Abbrechen
          </button>
        </section>
      </form>
    </div>
  );
}
