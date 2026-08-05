/**
 * Distances, bearings and the drive — shared, because both sides need them.
 *
 * The server owns the numbers that get stored. But the map picker has to answer
 * "how far is that?" while the pin is still moving under the finger, and a round
 * trip per pixel is not an answer. So the arithmetic lives here and runs in both
 * places, exactly like `scoring.ts`: whatever the client previews is what the
 * server will compute.
 *
 * Where the origin comes from is *not* shared. The HQ is an environment setting
 * (`server/geo.ts`) which the client receives with its session — so every
 * function here takes the origin as an argument rather than reaching for a
 * constant.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in kilometres. */
export function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass bearing from A to B, 0 = north, 90 = east. */
export function bearingDeg(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const dLon = toRad(bLon - aLon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Straight-line km -> plausible road km. Eisacktal roads switchback a lot, so
 * the detour factor is generous and grows for short mountain hops.
 */
export function roadDistanceKm(straightKm: number): number {
  const factor = straightKm < 6 ? 1.45 : straightKm < 20 ? 1.32 : 1.22;
  return straightKm * factor;
}

/**
 * Rough one-way driving time. Average speed climbs with distance (village roads
 * first, then the Brennerstate/autobahn), plus a fixed couple of minutes for
 * getting out of the yard and finding a parking spot.
 */
export function estimateTravelMin(roadKm: number): number {
  const avgKmh = roadKm < 5 ? 26 : roadKm < 15 ? 38 : roadKm < 40 ? 52 : 66;
  return Math.max(3, Math.round((roadKm / avgKmh) * 60 + 3));
}

export interface DerivedTravel {
  distanceKm: number;
  travelMin: number;
  bearing: number | null;
}

/**
 * Work out distance/time for a restaurant. Explicit values entered by a human
 * always win; coordinates are only used to fill the gaps.
 */
export function deriveTravel(
  origin: LatLon,
  input: {
    lat?: number | null;
    lon?: number | null;
    distanceKm?: number | null;
    travelMin?: number | null;
  },
): DerivedTravel & { source: "measured" | "estimated" } {
  const hasCoords = typeof input.lat === "number" && typeof input.lon === "number";
  const bearing = hasCoords ? bearingDeg(origin.lat, origin.lon, input.lat!, input.lon!) : null;

  let distanceKm = input.distanceKm ?? null;
  let source: "measured" | "estimated" = distanceKm !== null ? "measured" : "estimated";

  if (distanceKm === null) {
    distanceKm = hasCoords
      ? roadDistanceKm(haversineKm(origin.lat, origin.lon, input.lat!, input.lon!))
      : 0;
  }

  let travelMin = input.travelMin ?? null;
  if (travelMin === null) {
    travelMin = estimateTravelMin(distanceKm);
    source = "estimated";
  }

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    travelMin: Math.max(1, Math.round(travelMin)),
    bearing: bearing === null ? null : Math.round(bearing * 10) / 10,
    source,
  };
}
