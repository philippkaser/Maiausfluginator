import { join } from "node:path";
import { unlink } from "node:fs/promises";
import type { BunRequest } from "bun";

import { UPLOAD_DIR, db } from "./db.ts";
import { HQ } from "./geo.ts";
import {
  clearCookieHeader,
  clearFailures,
  checkRateLimit,
  createInvite,
  createSession,
  currentUser,
  destroySession,
  isSecureRequest,
  login,
  noteFailure,
  readSessionCookie,
  redeemInvite,
  requireAdmin,
  requireUser,
  resetKeyForMember,
  rotateKey,
  sessionCookieHeader,
  toMe,
} from "./auth.ts";
import { sniffImage } from "./imagemeta.ts";
import { describePoint, ensureTile, parseTileCoords, searchPlaces } from "./osm.ts";
import * as repo from "./repo.ts";
import { buildStats } from "./stats.ts";
import {
  HttpError,
  clampInt,
  fail,
  id as newId,
  json,
  optionalInt,
  optionalNumber,
  optionalString,
  readJson,
  requireDate,
  requireString,
} from "./util.ts";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/gif",
]);

type Handler = (req: BunRequest<string>) => Response | Promise<Response>;

/** Turn thrown HttpErrors into clean JSON; anything else is a 500 we log. */
function route(handler: Handler): Handler {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message);
      console.error("[api]", req.method, new URL(req.url).pathname, err);
      return fail(500, "Interner Fehler – das war nicht geplant.");
    }
  };
}

function param(req: BunRequest<string>, name: string): string {
  const value = (req.params as Record<string, string | undefined>)[name];
  if (!value) throw new HttpError(400, `Parameter ${name} fehlt`);
  return value;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

function noUsersYet(): boolean {
  return db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM users").get()!.n === 0;
}

const sessionRoutes = {
  "/api/session": {
    GET: route((req) => {
      const user = currentUser(req);
      return json({
        me: user ? toMe(user) : null,
        needsBootstrap: noUsersYet(),
        hq: { label: HQ.label, lat: HQ.lat, lon: HQ.lon },
      });
    }),
    DELETE: route((req) => {
      const token = readSessionCookie(req);
      if (token) destroySession(token);
      return json(
        { ok: true },
        { headers: { "Set-Cookie": clearCookieHeader(isSecureRequest(req)) } },
      );
    }),
  },

  "/api/auth/redeem": {
    POST: route(async (req) => {
      const body = await readJson(req);
      const code = requireString(body.code, "Einladungscode", 40);
      const displayName = requireString(body.displayName, "Name", 40);

      const limitKey = `redeem:${req.headers.get("x-forwarded-for") ?? "local"}`;
      checkRateLimit(limitKey);

      let result;
      try {
        result = await redeemInvite(code, displayName);
      } catch (err) {
        noteFailure(limitKey);
        throw err;
      }
      clearFailures(limitKey);

      const { token } = createSession(result.user.id);
      return json(
        { me: toMe(result.user), personalKey: result.personalKey },
        { headers: { "Set-Cookie": sessionCookieHeader(token, isSecureRequest(req)) } },
      );
    }),
  },

  "/api/auth/login": {
    POST: route(async (req) => {
      const body = await readJson(req);
      const handle = requireString(body.handle, "Name", 60);
      const key = requireString(body.key, "Schlüssel", 60);

      const limitKey = `login:${handle.toLowerCase()}`;
      checkRateLimit(limitKey);

      let user;
      try {
        user = await login(handle, key);
      } catch (err) {
        noteFailure(limitKey);
        throw err;
      }
      clearFailures(limitKey);

      const { token } = createSession(user.id);
      return json(
        { me: toMe(user) },
        { headers: { "Set-Cookie": sessionCookieHeader(token, isSecureRequest(req)) } },
      );
    }),
  },

  "/api/auth/rotate-key": {
    POST: route(async (req) => {
      const user = requireUser(req);
      const personalKey = await rotateKey(user.id);
      const { token } = createSession(user.id);
      return json(
        { personalKey },
        { headers: { "Set-Cookie": sessionCookieHeader(token, isSecureRequest(req)) } },
      );
    }),
  },
};

/* ------------------------------------------------------------------ */
/* Restaurants                                                          */
/* ------------------------------------------------------------------ */

function readRestaurantInput(body: Record<string, unknown>): repo.RestaurantInput {
  const lat = optionalNumber(body.lat, "Breitengrad");
  const lon = optionalNumber(body.lon, "Längengrad");
  if (lat !== null && (lat < -90 || lat > 90)) throw new HttpError(400, "Breitengrad außerhalb des Bereichs");
  if (lon !== null && (lon < -180 || lon > 180)) throw new HttpError(400, "Längengrad außerhalb des Bereichs");

  const website = optionalString(body.website, "Website", 300);
  if (website && !/^https?:\/\//i.test(website)) {
    throw new HttpError(400, "Website muss mit http:// oder https:// beginnen");
  }

  return {
    name: requireString(body.name, "Name des Lokals", 120),
    town: requireString(body.town, "Ort", 80),
    address: optionalString(body.address, "Adresse", 200),
    cuisine: optionalString(body.cuisine, "Küche", 80),
    website,
    lat,
    lon,
    distanceKm: optionalNumber(body.distanceKm, "Entfernung"),
    travelMin: optionalInt(body.travelMin, 1, 600, "Fahrzeit"),
  };
}

const restaurantRoutes = {
  "/api/restaurants": {
    GET: route((req) => {
      requireUser(req);
      return json({ restaurants: repo.listRestaurants(), hq: HQ });
    }),
    POST: route(async (req) => {
      requireUser(req);
      const body = await readJson(req);
      return json({ restaurant: repo.createRestaurant(readRestaurantInput(body)) }, { status: 201 });
    }),
  },

  "/api/restaurants/:id": {
    PATCH: route(async (req) => {
      requireAdmin(req);
      const body = await readJson(req);
      return json({ restaurant: repo.updateRestaurant(param(req, "id"), readRestaurantInput(body)) });
    }),
  },
};

/* ------------------------------------------------------------------ */
/* Trips                                                                */
/* ------------------------------------------------------------------ */

function readTripInput(body: Record<string, unknown>): repo.TripInput {
  return {
    restaurantId: requireString(body.restaurantId, "Lokal", 60),
    title: requireString(body.title, "Titel", 120),
    tripDate: requireDate(body.tripDate, "Datum"),
    notes: optionalString(body.notes, "Notizen", 2000),
  };
}

const tripRoutes = {
  "/api/trips": {
    GET: route((req) => {
      const user = requireUser(req);
      const trips = repo.listTrips(user.id);
      return json({ trips, stats: buildStats(trips) });
    }),
    POST: route(async (req) => {
      const user = requireUser(req);
      const body = await readJson(req);
      return json({ trip: repo.createTrip(readTripInput(body), user.id) }, { status: 201 });
    }),
  },

  "/api/trips/:id": {
    GET: route((req) => {
      const user = requireUser(req);
      const trip = repo.getTrip(param(req, "id"), user.id);
      if (!trip) return fail(404, "Ausflug nicht gefunden");
      return json({ trip });
    }),
    PATCH: route(async (req) => {
      const user = requireUser(req);
      const tripId = param(req, "id");
      const owner = repo.tripOwner(tripId);
      if (user.is_admin !== 1 && owner !== user.id) {
        throw new HttpError(403, "Nur wer den Ausflug angelegt hat (oder ein Admin) darf ihn ändern.");
      }
      const body = await readJson(req);
      return json({ trip: repo.updateTrip(tripId, readTripInput(body), user.id) });
    }),
    DELETE: route(async (req) => {
      const user = requireUser(req);
      const tripId = param(req, "id");
      const owner = repo.tripOwner(tripId);
      if (user.is_admin !== 1 && owner !== user.id) {
        throw new HttpError(403, "Nur wer den Ausflug angelegt hat (oder ein Admin) darf ihn löschen.");
      }
      const files = repo.deleteTrip(tripId);
      await Promise.all(files.map((f) => unlink(join(UPLOAD_DIR, f)).catch(() => {})));
      return json({ ok: true });
    }),
  },
};

/* ------------------------------------------------------------------ */
/* Ratings                                                              */
/* ------------------------------------------------------------------ */

const ratingRoutes = {
  "/api/trips/:id/rating": {
    PUT: route(async (req) => {
      const user = requireUser(req);
      const body = await readJson(req);
      const rating = repo.upsertRating(param(req, "id"), user.id, {
        essen: clampInt(body.essen, 1, 10, "Essen"),
        service: clampInt(body.service, 1, 10, "Service"),
        ambiente: clampInt(body.ambiente, 1, 10, "Ambiente"),
        preis: clampInt(body.preis, 1, 10, "Preis-Leistung"),
        erlebnis: clampInt(body.erlebnis, 1, 10, "Gesamterlebnis"),
        waitMinutes: optionalInt(body.waitMinutes, 0, 300, "Wartezeit"),
        cardAccepted: typeof body.cardAccepted === "boolean" ? body.cardAccepted : null,
        comment: optionalString(body.comment, "Kommentar", 1500),
      });
      return json({ rating, trip: repo.getTrip(param(req, "id"), user.id) });
    }),
    DELETE: route((req) => {
      const user = requireUser(req);
      repo.deleteRating(param(req, "id"), user.id);
      return json({ trip: repo.getTrip(param(req, "id"), user.id) });
    }),
  },
};

/* ------------------------------------------------------------------ */
/* Photos                                                               */
/* ------------------------------------------------------------------ */

const photoRoutes = {
  "/api/trips/:id/photos": {
    POST: route(async (req) => {
      const user = requireUser(req);
      const tripId = param(req, "id");
      repo.tripOwner(tripId); // throws 404 when the trip is gone

      const form = await req.formData().catch(() => {
        throw new HttpError(400, "Upload konnte nicht gelesen werden");
      });
      const file = form.get("photo");
      if (!(file instanceof File)) throw new HttpError(400, "Kein Foto im Upload");
      if (file.size === 0) throw new HttpError(400, "Die Datei ist leer");
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new HttpError(413, `Foto ist zu groß (max. ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`);
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const meta = sniffImage(bytes);
      if (!meta || !ALLOWED_UPLOAD_MIME.has(meta.mime)) {
        throw new HttpError(415, "Nur Bilder (JPEG, PNG, WebP, AVIF, HEIC, GIF)");
      }

      const filename = `${newId()}.${meta.ext}`;
      await Bun.write(join(UPLOAD_DIR, filename), bytes);

      const photo = repo.insertPhoto({
        tripId,
        userId: user.id,
        filename,
        mime: meta.mime,
        bytes: file.size,
        caption: optionalString(form.get("caption"), "Bildtext", 200),
        width: meta.width,
        height: meta.height,
      });
      return json({ photo }, { status: 201 });
    }),
  },

  "/api/photos/:id/file": {
    GET: route(async (req) => {
      requireUser(req);
      const row = repo.getPhotoRow(param(req, "id"));
      if (!row) return fail(404, "Foto nicht gefunden");

      const file = Bun.file(join(UPLOAD_DIR, row.filename));
      if (!(await file.exists())) return fail(404, "Datei fehlt");

      return new Response(file, {
        headers: {
          "Content-Type": row.mime,
          // Immutable: the id changes whenever the bytes do.
          "Cache-Control": "private, max-age=31536000, immutable",
          "Content-Disposition": "inline",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }),
  },

  "/api/photos/:id": {
    DELETE: route(async (req) => {
      const user = requireUser(req);
      const row = repo.getPhotoRow(param(req, "id"));
      if (!row) return fail(404, "Foto nicht gefunden");
      if (user.is_admin !== 1 && row.user_id !== user.id) {
        throw new HttpError(403, "Das ist nicht dein Foto.");
      }
      repo.deletePhoto(row.id);
      await unlink(join(UPLOAD_DIR, row.filename)).catch(() => {});
      return json({ ok: true });
    }),
  },

  "/api/photos/:id/like": {
    POST: route((req) => {
      const user = requireUser(req);
      return json(repo.togglePhotoLike(param(req, "id"), user.id));
    }),
  },
};

/* ------------------------------------------------------------------ */
/* Members, invites, stats                                              */
/* ------------------------------------------------------------------ */

const communityRoutes = {
  "/api/members": {
    GET: route((req) => {
      requireUser(req);
      return json({ members: repo.listMembers() });
    }),
  },

  /**
   * The way back in for somebody who lost their key. Only a hash of it is
   * stored, so nobody — admin included — can look the old one up; the only thing
   * that can be done is to issue a new one, which is what this does.
   */
  "/api/members/:id/key": {
    POST: route(async (req) => {
      const admin = requireAdmin(req);
      const result = await resetKeyForMember(param(req, "id"), admin);
      return json({ personalKey: result.personalKey, members: repo.listMembers() });
    }),
  },

  "/api/stats": {
    GET: route((req) => {
      const user = requireUser(req);
      return json({ stats: buildStats(repo.listTrips(user.id)) });
    }),
  },

  "/api/invites": {
    GET: route((req) => {
      requireAdmin(req);
      return json({ invites: repo.listInvites() });
    }),
    POST: route(async (req) => {
      const admin = requireAdmin(req);
      const body = await readJson(req).catch(() => ({}) as Record<string, unknown>);
      const code = createInvite({
        createdBy: admin.id,
        note: optionalString(body.note, "Notiz", 120),
        grantsAdmin: body.grantsAdmin === true,
      });
      return json({ code }, { status: 201 });
    }),
  },

  "/api/invites/:code": {
    DELETE: route((req) => {
      requireAdmin(req);
      repo.revokeInvite(param(req, "code"));
      return json({ ok: true });
    }),
  },
};

/* ------------------------------------------------------------------ */
/* The map                                                              */
/* ------------------------------------------------------------------ */

/**
 * Tiles and place search, both proxied. See the long note at the top of
 * `osm.ts` for why the browser is not allowed to fetch either of these itself.
 *
 * Every one of these requires a session — an open tile proxy is somebody else's
 * bandwidth bill.
 */
const mapRoutes = {
  "/api/tiles/:z/:x/:y": {
    GET: route(async (req) => {
      requireUser(req);
      const coords = parseTileCoords(param(req, "z"), param(req, "x"), param(req, "y"));

      let path;
      try {
        path = await ensureTile(coords);
      } catch (err) {
        // A missing tile is a hole in the map, not a broken page: the picker
        // still pans and the pin still drops. No caching of the failure, so the
        // next pan retries.
        if (err instanceof HttpError) {
          return new Response(null, { status: 502, headers: { "Cache-Control": "no-store" } });
        }
        throw err;
      }

      return new Response(Bun.file(path), {
        headers: {
          "Content-Type": "image/png",
          // Ours now, on disk, and a tile for a given z/x/y is always the same
          // place. The browser may keep it as long as it likes.
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }),
  },

  "/api/places/search": {
    GET: route(async (req) => {
      requireUser(req);
      const query = new URL(req.url).searchParams.get("q") ?? "";
      return json({ places: await searchPlaces(query.slice(0, 160)) });
    }),
  },

  "/api/places/at": {
    GET: route(async (req) => {
      requireUser(req);
      const params = new URL(req.url).searchParams;
      const lat = Number(params.get("lat"));
      const lon = Number(params.get("lon"));
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new HttpError(400, "Breitengrad fehlt");
      if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new HttpError(400, "Längengrad fehlt");
      return json({ place: await describePoint(lat, lon) });
    }),
  },
};

export const apiRoutes = {
  "/api/health": new Response("ok"),
  ...sessionRoutes,
  ...mapRoutes,
  ...restaurantRoutes,
  ...tripRoutes,
  ...ratingRoutes,
  ...photoRoutes,
  ...communityRoutes,
};
