/** All SQL lives here; the route handlers stay thin. */

import { db, now } from "./db.ts";
import { deriveTravel } from "./geo.ts";
import { HttpError, id, median } from "./util.ts";
import { DIMENSIONS } from "../shared/types.ts";
import type {
  Dimension,
  Invite,
  Member,
  Photo,
  Rating,
  Restaurant,
  Trip,
  TripAggregate,
  TripDetail,
} from "../shared/types.ts";

/* ------------------------------------------------------------------ */
/* Row shapes                                                           */
/* ------------------------------------------------------------------ */

interface RestaurantRow {
  id: string;
  name: string;
  town: string;
  address: string | null;
  cuisine: string | null;
  website: string | null;
  lat: number | null;
  lon: number | null;
  distance_km: number;
  travel_min: number;
  travel_source: string;
  bearing: number | null;
  created_at: number;
}

interface TripRow {
  id: string;
  restaurant_id: string;
  title: string;
  trip_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: number;
  created_by_name: string | null;
}

interface RatingRow {
  id: string;
  trip_id: string;
  user_id: string;
  essen: number;
  service: number;
  ambiente: number;
  preis: number;
  erlebnis: number;
  wait_minutes: number | null;
  card_accepted: number | null;
  comment: string | null;
  created_at: number;
  updated_at: number;
  display_name: string;
  hue: number;
}

interface PhotoRow {
  id: string;
  trip_id: string;
  user_id: string;
  filename: string;
  mime: string;
  bytes: number;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: number;
  display_name: string;
  hue: number;
  likes: number;
  liked_by_me: number;
}

/* ------------------------------------------------------------------ */
/* Mappers                                                              */
/* ------------------------------------------------------------------ */

function mapRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    town: row.town,
    address: row.address,
    cuisine: row.cuisine,
    website: row.website,
    lat: row.lat,
    lon: row.lon,
    distanceKm: row.distance_km,
    travelMin: row.travel_min,
    travelSource: row.travel_source === "measured" ? "measured" : "estimated",
    bearing: row.bearing,
  };
}

function mapRating(row: RatingRow): Rating {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    userName: row.display_name,
    userHue: row.hue,
    essen: row.essen,
    service: row.service,
    ambiente: row.ambiente,
    preis: row.preis,
    erlebnis: row.erlebnis,
    waitMinutes: row.wait_minutes,
    // Three states, so it cannot collapse to a boolean on the way out.
    cardAccepted: row.card_accepted === null ? null : row.card_accepted === 1,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    tripId: row.trip_id,
    userId: row.user_id,
    userName: row.display_name,
    userHue: row.hue,
    caption: row.caption,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    likes: row.likes,
    likedByMe: row.liked_by_me === 1,
  };
}

/* ------------------------------------------------------------------ */
/* Restaurants                                                          */
/* ------------------------------------------------------------------ */

export interface RestaurantInput {
  name: string;
  town: string;
  address: string | null;
  cuisine: string | null;
  website: string | null;
  lat: number | null;
  lon: number | null;
  distanceKm: number | null;
  travelMin: number | null;
}

export function listRestaurants(): Restaurant[] {
  return db
    .query<RestaurantRow, []>("SELECT * FROM restaurants ORDER BY name COLLATE NOCASE")
    .all()
    .map(mapRestaurant);
}

export function createRestaurant(input: RestaurantInput): Restaurant {
  const travel = deriveTravel(input);
  const row: RestaurantRow = {
    id: id(),
    name: input.name,
    town: input.town,
    address: input.address,
    cuisine: input.cuisine,
    website: input.website,
    lat: input.lat,
    lon: input.lon,
    distance_km: travel.distanceKm,
    travel_min: travel.travelMin,
    travel_source: travel.source,
    bearing: travel.bearing,
    created_at: now(),
  };

  db.query(
    `INSERT INTO restaurants
       (id, name, town, address, cuisine, website, lat, lon, distance_km, travel_min, travel_source, bearing, created_at)
     VALUES
       ($id, $name, $town, $address, $cuisine, $website, $lat, $lon, $distance_km, $travel_min, $travel_source, $bearing, $created_at)`,
  ).run({ ...row });

  return mapRestaurant(row);
}

export function updateRestaurant(restaurantId: string, input: RestaurantInput): Restaurant {
  const existing = db
    .query<RestaurantRow, [string]>("SELECT * FROM restaurants WHERE id = ?")
    .get(restaurantId);
  if (!existing) throw new HttpError(404, "Lokal nicht gefunden");

  const travel = deriveTravel(input);
  db.query(
    `UPDATE restaurants SET
       name = $name, town = $town, address = $address, cuisine = $cuisine, website = $website,
       lat = $lat, lon = $lon, distance_km = $distance_km, travel_min = $travel_min,
       travel_source = $travel_source, bearing = $bearing
     WHERE id = $id`,
  ).run({
    id: restaurantId,
    name: input.name,
    town: input.town,
    address: input.address,
    cuisine: input.cuisine,
    website: input.website,
    lat: input.lat,
    lon: input.lon,
    distance_km: travel.distanceKm,
    travel_min: travel.travelMin,
    travel_source: travel.source,
    bearing: travel.bearing,
  });

  return mapRestaurant(
    db.query<RestaurantRow, [string]>("SELECT * FROM restaurants WHERE id = ?").get(restaurantId)!,
  );
}

/* ------------------------------------------------------------------ */
/* Trips                                                               */
/* ------------------------------------------------------------------ */

const TRIP_SELECT = `
  SELECT t.*, u.display_name AS created_by_name
    FROM trips t
    LEFT JOIN users u ON u.id = t.created_by
`;

function aggregateFor(tripId: string, restaurant: Restaurant): TripAggregate {
  const rows = db
    .query<
      {
        essen: number;
        service: number;
        ambiente: number;
        preis: number;
        erlebnis: number;
        wait_minutes: number | null;
        card_accepted: number | null;
      },
      [string]
    >(
      "SELECT essen, service, ambiente, preis, erlebnis, wait_minutes, card_accepted FROM ratings WHERE trip_id = ?",
    )
    .all(tripId);

  const means = {} as Record<Dimension, number | null>;
  for (const dim of DIMENSIONS) {
    means[dim] = rows.length === 0 ? null : rows.reduce((sum, r) => sum + r[dim], 0) / rows.length;
  }

  const waits = rows.map((r) => r.wait_minutes).filter((w): w is number => typeof w === "number");
  const photoCount = db
    .query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM photos WHERE trip_id = ?")
    .get(tripId)!.n;

  return {
    ratingCount: rows.length,
    photoCount,
    means,
    waitMedian: median(waits),
    waitCount: waits.length,
    // Counted rather than averaged: whether a place takes the card is a fact
    // about the place, and two people disagreeing is worth showing as a
    // disagreement instead of hiding behind a majority.
    cardYes: rows.filter((r) => r.card_accepted === 1).length,
    cardNo: rows.filter((r) => r.card_accepted === 0).length,
    distanceKm: restaurant.distanceKm,
    travelMin: restaurant.travelMin,
  };
}

function coverPhotoFor(tripId: string): string | null {
  const row = db
    .query<{ id: string }, [string]>(
      `SELECT p.id FROM photos p
         LEFT JOIN photo_likes l ON l.photo_id = p.id
        WHERE p.trip_id = ?
        GROUP BY p.id
        ORDER BY COUNT(l.user_id) DESC, p.created_at ASC
        LIMIT 1`,
    )
    .get(tripId);
  return row?.id ?? null;
}

function myRatingFor(tripId: string, userId: string): Rating | null {
  const row = db
    .query<RatingRow, [string, string]>(
      `SELECT r.*, u.display_name, u.hue FROM ratings r
         JOIN users u ON u.id = r.user_id
        WHERE r.trip_id = ? AND r.user_id = ?`,
    )
    .get(tripId, userId);
  return row ? mapRating(row) : null;
}

function hydrateTrip(row: TripRow, userId: string): Trip {
  const restaurant = mapRestaurant(
    db.query<RestaurantRow, [string]>("SELECT * FROM restaurants WHERE id = ?").get(row.restaurant_id)!,
  );
  return {
    id: row.id,
    title: row.title,
    tripDate: row.trip_date,
    notes: row.notes,
    createdBy: row.created_by ?? "",
    createdByName: row.created_by_name ?? "Unbekannt",
    createdAt: row.created_at,
    restaurant,
    aggregate: aggregateFor(row.id, restaurant),
    myRating: myRatingFor(row.id, userId),
    coverPhotoId: coverPhotoFor(row.id),
  };
}

export function listTrips(userId: string): Trip[] {
  return db
    .query<TripRow, []>(`${TRIP_SELECT} ORDER BY t.trip_date DESC, t.created_at DESC`)
    .all()
    .map((row) => hydrateTrip(row, userId));
}

export function getTrip(tripId: string, userId: string): TripDetail | null {
  const row = db.query<TripRow, [string]>(`${TRIP_SELECT} WHERE t.id = ?`).get(tripId);
  if (!row) return null;

  const base = hydrateTrip(row, userId);
  const ratings = db
    .query<RatingRow, [string]>(
      `SELECT r.*, u.display_name, u.hue FROM ratings r
         JOIN users u ON u.id = r.user_id
        WHERE r.trip_id = ?
        ORDER BY r.updated_at DESC`,
    )
    .all(tripId)
    .map(mapRating);

  return { ...base, ratings, photos: listPhotos(tripId, userId) };
}

export interface TripInput {
  restaurantId: string;
  title: string;
  tripDate: string;
  notes: string | null;
}

export function createTrip(input: TripInput, userId: string): Trip {
  const restaurant = db
    .query<RestaurantRow, [string]>("SELECT * FROM restaurants WHERE id = ?")
    .get(input.restaurantId);
  if (!restaurant) throw new HttpError(400, "Unbekanntes Lokal");

  const tripId = id();
  db.query(
    `INSERT INTO trips (id, restaurant_id, title, trip_date, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(tripId, input.restaurantId, input.title, input.tripDate, input.notes, userId, now());

  return getTrip(tripId, userId)!;
}

export function updateTrip(tripId: string, input: TripInput, userId: string): Trip {
  const existing = db.query<TripRow, [string]>("SELECT * FROM trips WHERE id = ?").get(tripId);
  if (!existing) throw new HttpError(404, "Ausflug nicht gefunden");

  db.query(
    "UPDATE trips SET restaurant_id = ?, title = ?, trip_date = ?, notes = ? WHERE id = ?",
  ).run(input.restaurantId, input.title, input.tripDate, input.notes, tripId);

  return getTrip(tripId, userId)!;
}

export function deleteTrip(tripId: string): string[] {
  const files = db
    .query<{ filename: string }, [string]>("SELECT filename FROM photos WHERE trip_id = ?")
    .all(tripId)
    .map((r) => r.filename);
  const res = db.query("DELETE FROM trips WHERE id = ?").run(tripId);
  if (res.changes === 0) throw new HttpError(404, "Ausflug nicht gefunden");
  return files;
}

export function tripOwner(tripId: string): string | null {
  const row = db
    .query<{ created_by: string | null }, [string]>("SELECT created_by FROM trips WHERE id = ?")
    .get(tripId);
  if (!row) throw new HttpError(404, "Ausflug nicht gefunden");
  return row.created_by;
}

/* ------------------------------------------------------------------ */
/* Ratings                                                              */
/* ------------------------------------------------------------------ */

export interface RatingInput {
  essen: number;
  service: number;
  ambiente: number;
  preis: number;
  erlebnis: number;
  waitMinutes: number | null;
  cardAccepted: boolean | null;
  comment: string | null;
}

export function upsertRating(tripId: string, userId: string, input: RatingInput): Rating {
  if (!db.query("SELECT 1 FROM trips WHERE id = ?").get(tripId)) {
    throw new HttpError(404, "Ausflug nicht gefunden");
  }

  const timestamp = now();
  db.query(
    `INSERT INTO ratings
       (id, trip_id, user_id, essen, service, ambiente, preis, erlebnis, wait_minutes, card_accepted, comment, created_at, updated_at)
     VALUES
       ($id, $trip_id, $user_id, $essen, $service, $ambiente, $preis, $erlebnis, $wait_minutes, $card_accepted, $comment, $created_at, $updated_at)
     ON CONFLICT (trip_id, user_id) DO UPDATE SET
       essen = excluded.essen,
       service = excluded.service,
       ambiente = excluded.ambiente,
       preis = excluded.preis,
       erlebnis = excluded.erlebnis,
       wait_minutes = excluded.wait_minutes,
       card_accepted = excluded.card_accepted,
       comment = excluded.comment,
       updated_at = excluded.updated_at`,
  ).run({
    id: id(),
    trip_id: tripId,
    user_id: userId,
    essen: input.essen,
    service: input.service,
    ambiente: input.ambiente,
    preis: input.preis,
    erlebnis: input.erlebnis,
    wait_minutes: input.waitMinutes,
    card_accepted: input.cardAccepted === null ? null : input.cardAccepted ? 1 : 0,
    comment: input.comment,
    created_at: timestamp,
    updated_at: timestamp,
  });

  return myRatingFor(tripId, userId)!;
}

export function deleteRating(tripId: string, userId: string): void {
  db.query("DELETE FROM ratings WHERE trip_id = ? AND user_id = ?").run(tripId, userId);
}

/* ------------------------------------------------------------------ */
/* Photos                                                              */
/* ------------------------------------------------------------------ */

export function listPhotos(tripId: string, userId: string): Photo[] {
  return db
    .query<PhotoRow, { trip: string; me: string }>(
      `SELECT p.*, u.display_name, u.hue,
              (SELECT COUNT(*) FROM photo_likes l WHERE l.photo_id = p.id) AS likes,
              (SELECT COUNT(*) FROM photo_likes l WHERE l.photo_id = p.id AND l.user_id = $me) AS liked_by_me
         FROM photos p
         JOIN users u ON u.id = p.user_id
        WHERE p.trip_id = $trip
        ORDER BY p.created_at DESC`,
    )
    .all({ trip: tripId, me: userId })
    .map(mapPhoto);
}

export function getPhotoRow(photoId: string) {
  return db
    .query<{ id: string; filename: string; mime: string; user_id: string; trip_id: string }, [string]>(
      "SELECT id, filename, mime, user_id, trip_id FROM photos WHERE id = ?",
    )
    .get(photoId);
}

export function insertPhoto(input: {
  tripId: string;
  userId: string;
  filename: string;
  mime: string;
  bytes: number;
  caption: string | null;
  width: number | null;
  height: number | null;
}): Photo {
  const photoId = id();
  db.query(
    `INSERT INTO photos (id, trip_id, user_id, filename, mime, bytes, caption, width, height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    photoId,
    input.tripId,
    input.userId,
    input.filename,
    input.mime,
    input.bytes,
    input.caption,
    input.width,
    input.height,
    now(),
  );

  return listPhotos(input.tripId, input.userId).find((p) => p.id === photoId)!;
}

export function deletePhoto(photoId: string): void {
  db.query("DELETE FROM photos WHERE id = ?").run(photoId);
}

export function togglePhotoLike(photoId: string, userId: string): { likes: number; likedByMe: boolean } {
  const existing = db
    .query("SELECT 1 FROM photo_likes WHERE photo_id = ? AND user_id = ?")
    .get(photoId, userId);

  if (existing) {
    db.query("DELETE FROM photo_likes WHERE photo_id = ? AND user_id = ?").run(photoId, userId);
  } else {
    if (!db.query("SELECT 1 FROM photos WHERE id = ?").get(photoId)) {
      throw new HttpError(404, "Foto nicht gefunden");
    }
    db.query("INSERT INTO photo_likes (photo_id, user_id, created_at) VALUES (?, ?, ?)").run(
      photoId,
      userId,
      now(),
    );
  }

  const likes = db
    .query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM photo_likes WHERE photo_id = ?")
    .get(photoId)!.n;
  return { likes, likedByMe: !existing };
}

/* ------------------------------------------------------------------ */
/* Members & invites                                                    */
/* ------------------------------------------------------------------ */

export function listMembers(): Member[] {
  return db
    .query<
      {
        id: string;
        handle: string;
        display_name: string;
        is_admin: number;
        hue: number;
        created_at: number;
        rating_count: number;
        photo_count: number;
        avg_given: number | null;
      },
      []
    >(
      `SELECT u.id, u.handle, u.display_name, u.is_admin, u.hue, u.created_at,
              (SELECT COUNT(*) FROM ratings r WHERE r.user_id = u.id) AS rating_count,
              (SELECT COUNT(*) FROM photos p WHERE p.user_id = u.id) AS photo_count,
              (SELECT AVG((r.essen + r.service + r.ambiente + r.preis + r.erlebnis) / 5.0)
                 FROM ratings r WHERE r.user_id = u.id) AS avg_given
         FROM users u
        ORDER BY rating_count DESC, u.created_at ASC`,
    )
    .all()
    .map((row) => ({
      id: row.id,
      handle: row.handle,
      displayName: row.display_name,
      isAdmin: row.is_admin === 1,
      hue: row.hue,
      createdAt: row.created_at,
      ratingCount: row.rating_count,
      photoCount: row.photo_count,
      avgGiven: row.avg_given,
    }));
}

export function listInvites(): Invite[] {
  return db
    .query<
      {
        code: string;
        note: string | null;
        grants_admin: number;
        created_at: number;
        used_at: number | null;
        creator: string | null;
        redeemer: string | null;
      },
      []
    >(
      `SELECT i.code, i.note, i.grants_admin, i.created_at, i.used_at,
              c.display_name AS creator, r.display_name AS redeemer
         FROM invites i
         LEFT JOIN users c ON c.id = i.created_by
         LEFT JOIN users r ON r.id = i.used_by
        ORDER BY i.created_at DESC`,
    )
    .all()
    .map((row) => ({
      code: row.code,
      note: row.note,
      grantsAdmin: row.grants_admin === 1,
      createdAt: row.created_at,
      createdByName: row.creator,
      usedAt: row.used_at,
      usedByName: row.redeemer,
    }));
}

export function revokeInvite(code: string): void {
  const res = db.query("DELETE FROM invites WHERE code = ? AND used_by IS NULL").run(code);
  if (res.changes === 0) throw new HttpError(404, "Offener Code nicht gefunden");
}
