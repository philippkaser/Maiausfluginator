/** Season summary: the numbers on the header plus a handful of silly awards. */

import { db } from "./db.ts";
import { rankKey, scoreTrip } from "../shared/scoring.ts";
import type { Award, Stats, Trip } from "../shared/types.ts";

function count(sql: string): number {
  return db.query<{ n: number }, []>(sql).get()!.n;
}

/** "Seehof Kaltern, Kaltern" reads badly - drop the redundant town. */
function placeLabel(trip: Trip): string {
  const { name, town } = trip.restaurant;
  return name.toLowerCase().includes(town.toLowerCase()) ? name : `${name}, ${town}`;
}

export function buildStats(trips: Trip[]): Stats {
  const rated = trips.filter((t) => t.aggregate.ratingCount > 0);
  const awards: Award[] = [];

  const award = (
    key: string,
    title: string,
    subtitle: string,
    trip: Trip | undefined,
    value: (t: Trip) => string,
  ) => {
    awards.push({
      key,
      title,
      subtitle,
      tripId: trip?.id ?? null,
      tripTitle: trip ? placeLabel(trip) : null,
      value: trip ? value(trip) : "-",
    });
  };

  const best = [...rated].sort((a, b) => rankKey(b.aggregate) - rankKey(a.aggregate))[0];
  award("champion", "Ausflug des Monats", "Höchster Mai-Score", best, (t) =>
    `${(scoreTrip(t.aggregate).score ?? 0).toFixed(1)} Punkte`,
  );

  const bestFood = [...rated]
    .filter((t) => t.aggregate.means.essen !== null)
    .sort((a, b) => (b.aggregate.means.essen ?? 0) - (a.aggregate.means.essen ?? 0))[0];
  award("teller", "Bester Teller", "Höchste Essens-Wertung", bestFood, (t) =>
    `${(t.aggregate.means.essen ?? 0).toFixed(1)} / 10`,
  );

  const fastest = [...rated]
    .filter((t) => t.aggregate.waitMedian !== null)
    .sort((a, b) => (a.aggregate.waitMedian ?? 0) - (b.aggregate.waitMedian ?? 0))[0];
  award("blitz", "Küchen-Blitz", "Kürzeste Wartezeit aufs Essen", fastest, (t) =>
    `${Math.round(t.aggregate.waitMedian ?? 0)} min`,
  );

  const slowest = [...rated]
    .filter((t) => t.aggregate.waitMedian !== null)
    .sort((a, b) => (b.aggregate.waitMedian ?? 0) - (a.aggregate.waitMedian ?? 0))[0];
  award("geduld", "Geduldsprobe", "Längste Wartezeit aufs Essen", slowest, (t) =>
    `${Math.round(t.aggregate.waitMedian ?? 0)} min`,
  );

  const farthest = [...trips].sort((a, b) => b.restaurant.distanceKm - a.restaurant.distanceKm)[0];
  award("expedition", "Expedition", "Weiteste Anfahrt ab HQ", farthest, (t) =>
    `${t.restaurant.distanceKm.toFixed(1)} km`,
  );

  const nearest = [...trips].sort((a, b) => a.restaurant.distanceKm - b.restaurant.distanceKm)[0];
  award("nebenan", "Gleich ums Eck", "Kürzeste Anfahrt ab HQ", nearest, (t) =>
    `${t.restaurant.distanceKm.toFixed(1)} km`,
  );

  const bestValue = [...rated]
    .filter((t) => t.aggregate.means.preis !== null)
    .sort((a, b) => (b.aggregate.means.preis ?? 0) - (a.aggregate.means.preis ?? 0))[0];
  award("kassa", "Beste Kassa", "Bestes Preis-Leistungs-Verhaltnis", bestValue, (t) =>
    `${(t.aggregate.means.preis ?? 0).toFixed(1)} / 10`,
  );

  const mostPhotos = [...trips].sort((a, b) => b.aggregate.photoCount - a.aggregate.photoCount)[0];
  award("fotogen", "Fotogen", "Die meisten Food-Pics", mostPhotos?.aggregate.photoCount ? mostPhotos : undefined, (t) =>
    `${t.aggregate.photoCount} Fotos`,
  );

  // Widest spread of opinion across all dimensions - the trip we argued about.
  const divisive = [...rated]
    .filter((t) => t.aggregate.ratingCount >= 2)
    .map((t) => ({ trip: t, spread: spreadFor(t.id) }))
    .sort((a, b) => b.spread - a.spread)[0];
  award("streit", "Diskussionsstoff", "Hier waren wir uns am wenigsten einig", divisive?.trip, () =>
    `${(divisive?.spread ?? 0).toFixed(1)} Punkte Streuung`,
  );

  return {
    tripCount: trips.length,
    memberCount: count("SELECT COUNT(*) AS n FROM users"),
    ratingCount: count("SELECT COUNT(*) AS n FROM ratings"),
    photoCount: count("SELECT COUNT(*) AS n FROM photos"),
    // Every Ausflug is a round trip.
    totalKm: Math.round(trips.reduce((sum, t) => sum + t.restaurant.distanceKm * 2, 0) * 10) / 10,
    totalTravelMin: trips.reduce((sum, t) => sum + t.restaurant.travelMin * 2, 0),
    awards,
  };
}

/** Standard deviation of each member's overall impression of one trip. */
function spreadFor(tripId: string): number {
  const values = db
    .query<{ overall: number }, [string]>(
      `SELECT (essen + service + ambiente + preis + erlebnis) / 5.0 AS overall
         FROM ratings WHERE trip_id = ?`,
    )
    .all(tripId)
    .map((r) => r.overall);

  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
