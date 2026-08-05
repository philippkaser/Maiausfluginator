/**
 * Where every measurement starts.
 *
 * The arithmetic itself moved to `shared/geo.ts` so the map picker can preview a
 * distance while the pin is still moving. What stays here is the one thing that
 * is a deployment setting and not a formula: the door we measure from.
 */

import {
  deriveTravel as deriveFrom,
  type DerivedTravel,
  type LatLon,
} from "../shared/geo.ts";

export type { DerivedTravel, LatLon };
export { bearingDeg, estimateTravelMin, haversineKm, roadDistanceKm } from "../shared/geo.ts";

export interface Origin extends LatLon {
  label: string;
}

/**
 * Durst Group AG, Julius-Durst-Straße, 39042 Brixen (Südtirol).
 * Approximate rooftop coordinates - override with HQ_LAT / HQ_LON if you want
 * to measure from a different door.
 */
export const HQ: Origin = {
  label: process.env.HQ_LABEL ?? "Durst HQ Brixen",
  lat: Number(process.env.HQ_LAT ?? 46.7266),
  lon: Number(process.env.HQ_LON ?? 11.6435),
};

/** `shared/geo.ts`'s deriveTravel, bound to this installation's HQ. */
export function deriveTravel(input: {
  lat?: number | null;
  lon?: number | null;
  distanceKm?: number | null;
  travelMin?: number | null;
}): DerivedTravel & { source: "measured" | "estimated" } {
  return deriveFrom(HQ, input);
}
