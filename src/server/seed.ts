/**
 * Starter destinations so the app is not an empty box on first launch.
 *
 * These are placeholders with real village coordinates around Brixen - the
 * distances and travel times are computed from the Durst HQ by src/server/geo.ts.
 * Rename them, correct the addresses, or delete them once the real list of
 * Ausflugsziele exists. Nothing here is a rating: every score in the app comes
 * from a member who was actually there.
 */

import { db } from "./db.ts";
import { createRestaurant } from "./repo.ts";

const STARTERS = [
  { name: "Gasthof Talblick", town: "Vahrn", cuisine: "Südtiroler Küche", lat: 46.7385, lon: 11.6413 },
  { name: "Stiftskeller Neustift", town: "Neustift", cuisine: "Klassisch, Weinkarte", lat: 46.7466, lon: 11.648 },
  { name: "Buschenschank Sonnseite", town: "Feldthurns", cuisine: "Buschenschank", lat: 46.666, lon: 11.607 },
  { name: "Pizzeria Am Anger", town: "Brixen", cuisine: "Pizza", lat: 46.715, lon: 11.657 },
  { name: "Almgasthaus Rossalm", town: "Plose", cuisine: "Hütte", lat: 46.706, lon: 11.7 },
  { name: "Gasthof Zum Löwen", town: "Klausen", cuisine: "Regional", lat: 46.64, lon: 11.565 },
  { name: "Wirtshaus Villnösser Hof", town: "St. Magdalena", cuisine: "Wild & Regional", lat: 46.644, lon: 11.704 },
  { name: "Lüsner Almstube", town: "Lüsen", cuisine: "Hütte", lat: 46.742, lon: 11.746 },
  { name: "Panoramastube Meransen", town: "Meransen", cuisine: "Panorama", lat: 46.818, lon: 11.658 },
  { name: "Stadtgasthof Sterzing", town: "Sterzing", cuisine: "Südtiroler Küche", lat: 46.895, lon: 11.434 },
  { name: "Weinstube Kastelruth", town: "Kastelruth", cuisine: "Wein & Küche", lat: 46.57, lon: 11.559 },
  { name: "Seehof Kaltern", town: "Kaltern", cuisine: "Fisch & Wein", lat: 46.413, lon: 11.245 },
];

export function seedRestaurants(): number {
  const existing = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM restaurants").get()!.n;
  if (existing > 0) return 0;

  for (const starter of STARTERS) {
    createRestaurant({
      name: starter.name,
      town: starter.town,
      address: null,
      cuisine: starter.cuisine,
      website: null,
      lat: starter.lat,
      lon: starter.lon,
      distanceKm: null,
      travelMin: null,
    });
  }

  console.log(`  ${STARTERS.length} Beispiel-Lokale angelegt (bitte anpassen oder löschen).`);
  return STARTERS.length;
}

if (import.meta.main) {
  const created = seedRestaurants();
  if (created === 0) console.log("  Es gibt bereits Lokale – nichts zu tun.");
}
