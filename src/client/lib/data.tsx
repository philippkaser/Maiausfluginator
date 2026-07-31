/**
 * The season, fetched once.
 *
 * All three sections read the same list of Ausflüge — the Rangliste ranks it,
 * Ausflüge browses it, Runde summarises it — so with the old page-per-fetch
 * arrangement, switching tabs meant refetching the whole season and watching
 * three spinners for data the browser already had. One provider above the router
 * fixes that: the list is loaded on sign-in and only reloaded when something
 * actually changed it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError } from "./api.ts";
import type { Stats, Trip, TripDetail } from "../../shared/types.ts";

interface SeasonValue {
  trips: Trip[] | null;
  stats: Stats | null;
  error: string | null;
  reload: () => Promise<void>;
  /**
   * Fold a freshly saved trip back into the list. Rating a trip changes its
   * score and therefore its rank, and re-fetching the season to learn that would
   * be wasteful — the response already contains everything.
   */
  merge: (trip: Trip | TripDetail) => void;
  /** Drop a deleted trip without a round trip. */
  forget: (tripId: string) => void;
}

const SeasonContext = createContext<SeasonValue | null>(null);

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await api.trips();
      setTrips(data.trips);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Die Saison lädt gerade nicht.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const merge = useCallback(
    (trip: Trip | TripDetail) => {
      setTrips((current) => {
        if (!current) return current;
        // Strip the detail payload: the list only ever needs the summary shape,
        // and keeping ratings and photos in it would quietly double the memory.
        const summary: Trip = {
          id: trip.id,
          title: trip.title,
          tripDate: trip.tripDate,
          notes: trip.notes,
          createdBy: trip.createdBy,
          createdByName: trip.createdByName,
          createdAt: trip.createdAt,
          restaurant: trip.restaurant,
          aggregate: trip.aggregate,
          myRating: trip.myRating,
          coverPhotoId: trip.coverPhotoId,
        };
        const known = current.some((entry) => entry.id === trip.id);
        return known
          ? current.map((entry) => (entry.id === trip.id ? summary : entry))
          : [summary, ...current];
      });

      // The list is now right immediately, so the ranking reorders under the
      // reader's hand. The season totals and awards are not — those are computed
      // server-side, so ask for them again quietly in the background.
      void reload();
    },
    [reload],
  );

  const forget = useCallback((tripId: string) => {
    setTrips((current) => current?.filter((trip) => trip.id !== tripId) ?? current);
  }, []);

  const value = useMemo<SeasonValue>(
    () => ({ trips, stats, error, reload, merge, forget }),
    [trips, stats, error, reload, merge, forget],
  );

  return <SeasonContext value={value}>{children}</SeasonContext>;
}

export function useSeason(): SeasonValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error("useSeason außerhalb des SeasonProvider");
  return value;
}
