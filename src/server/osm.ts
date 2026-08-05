/**
 * The one place this app talks to the outside world.
 *
 * Picking a restaurant off a map needs two things nobody can compute at home:
 * map tiles, and a way to turn "Pizzeria Mair Brixen" into a pair of
 * coordinates. Both come from OpenStreetMap. What matters is *who* asks.
 *
 * The browser never does. Every tile and every search goes to our own server,
 * which fetches on its behalf and caches the result. So OpenStreetMap sees one
 * machine in Brixen asking for a tile, not twenty people's browsers with their
 * addresses, their user agents and a referrer saying which app they are using.
 * Which member looked at which valley stays in this building — the property the
 * Radar was built to keep, kept in the only way it still can be once there is a
 * map at all.
 *
 * Two consequences worth knowing:
 *
 *   - Both endpoints require a session. An unauthenticated tile proxy is an open
 *     proxy, and someone else's bandwidth bill.
 *   - Both are rate limited outbound, because OSM's tile server and Nominatim
 *     are donated infrastructure with published usage policies, and a lunch
 *     rating app has no business being a burden on them. Tiles are cached
 *     forever on disk (they barely change and we only ever want one region);
 *     searches are serialised to one per second and remembered for an hour.
 */

import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { DATA_DIR } from "./db.ts";
import { HQ } from "./geo.ts";
import { HttpError } from "./util.ts";
import { haversineKm } from "../shared/geo.ts";
import type { PlaceHit } from "../shared/types.ts";

export const TILE_DIR = resolve(DATA_DIR, "tiles");

/**
 * OSM asks for a User-Agent that identifies the application and offers a way to
 * get in touch if it misbehaves. `OSM_CONTACT` is where that address goes; the
 * app still works without one, it is just less good manners.
 */
const CONTACT = process.env.OSM_CONTACT?.trim();
const USER_AGENT = `Maiausfluginator/1.0 (internes Mittagessen-Werkzeug, Durst Brixen${
  CONTACT ? `; ${CONTACT}` : ""
})`;

const TILE_TEMPLATE =
  process.env.TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const NOMINATIM = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";

/** Zoom range worth serving: a whole country down to a single building. */
export const MIN_ZOOM = 6;
export const MAX_ZOOM = 19;

/* ------------------------------------------------------------------ */
/* Tiles                                                                */
/* ------------------------------------------------------------------ */

/**
 * At most this many tiles in flight upstream at once. OSM's policy asks bulk
 * consumers for no more than two threads; interactive browsing is not bulk, but
 * a fresh region is a couple of dozen tiles at once and there is no reason for
 * all of them to leave simultaneously.
 */
const MAX_TILE_FETCHES = 4;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function acquire(): Promise<void> {
  if (inFlight < MAX_TILE_FETCHES) {
    inFlight += 1;
    return;
  }
  await new Promise<void>((r) => waiting.push(r));
  inFlight += 1;
}

function release(): void {
  inFlight -= 1;
  waiting.shift()?.();
}

/**
 * One promise per tile while it is being fetched. A pan across the valley asks
 * for the same tile from several React effects at once; without this, each of
 * them would be its own request to OSM.
 */
const pending = new Map<string, Promise<string>>();

export interface TileCoords {
  z: number;
  x: number;
  y: number;
}

/** Reject anything that is not a real tile before it can become a filesystem path. */
export function parseTileCoords(z: string, x: string, y: string): TileCoords {
  const nums = [z, x, y].map((raw) => (/^\d{1,9}$/.test(raw) ? Number(raw) : NaN));
  const [zoom, tx, ty] = nums as [number, number, number];

  if (!Number.isInteger(zoom) || zoom < MIN_ZOOM || zoom > MAX_ZOOM) {
    throw new HttpError(400, "Zoomstufe außerhalb des Bereichs");
  }
  const span = 2 ** zoom;
  if (!Number.isInteger(tx) || !Number.isInteger(ty) || tx < 0 || ty < 0 || tx >= span || ty >= span) {
    throw new HttpError(400, "Kachel außerhalb des Bereichs");
  }
  return { z: zoom, x: tx, y: ty };
}

const tilePath = ({ z, x, y }: TileCoords) => resolve(TILE_DIR, String(z), String(x), `${y}.png`);

async function fetchTile(coords: TileCoords): Promise<Uint8Array> {
  const url = TILE_TEMPLATE.replace("{z}", String(coords.z))
    .replace("{x}", String(coords.x))
    .replace("{y}", String(coords.y));

  await acquire();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/png,image/*" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new HttpError(502, `Kachelserver antwortete mit ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    release();
  }
}

/**
 * The path to a tile on our disk, fetching it first if this is the first time
 * anybody has looked at this corner of the valley. Tiles are immutable enough
 * for the purpose — a restaurant does not move because a road was retraced — so
 * nothing here ever expires. Deleting `data/tiles/` is the refresh.
 *
 * A path rather than the bytes, so the response can stream straight off disk on
 * the overwhelmingly common second visit.
 */
export async function ensureTile(coords: TileCoords): Promise<string> {
  const path = tilePath(coords);
  if (await Bun.file(path).exists()) return path;

  const key = `${coords.z}/${coords.x}/${coords.y}`;
  const existing = pending.get(key);
  if (existing) return existing;

  const job = (async () => {
    const bytes = await fetchTile(coords);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, bytes);
    return path;
  })();

  pending.set(key, job);
  try {
    return await job;
  } finally {
    pending.delete(key);
  }
}

/* ------------------------------------------------------------------ */
/* Geocoding                                                            */
/* ------------------------------------------------------------------ */

/**
 * Nominatim's usage policy is one request per second, absolutely. So requests
 * queue behind a single gate rather than merely being throttled on the client —
 * a debounce in a browser is a suggestion, and there are twenty browsers.
 */
const MIN_GAP_MS = 1100;
let lastCall = 0;
let gate: Promise<unknown> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  const next = gate.then(async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await Bun.sleep(wait);
    lastCall = Date.now();
    return work();
  });
  // The gate must not inherit a rejection, or one failed lookup wedges the rest.
  gate = next.catch(() => {});
  return next;
}

/** Same question inside the hour gets the same answer without leaving the house. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; hits: PlaceHit[] }>();

function cached(key: string): PlaceHit[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.hits;
}

function remember(key: string, hits: PlaceHit[]): PlaceHit[] {
  // A hard ceiling so a long afternoon of typing cannot grow without bound.
  if (cache.size > 400) cache.clear();
  cache.set(key, { at: Date.now(), hits });
  return hits;
}

async function askNominatim(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${NOMINATIM}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("accept-language", "de");

  const res = await serialize(() =>
    fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    }),
  );

  if (res.status === 429 || res.status === 503) {
    throw new HttpError(503, "Die Ortssuche ist gerade überlastet. Kurz warten oder auf der Karte tippen.");
  }
  if (!res.ok) throw new HttpError(502, "Die Ortssuche antwortet nicht.");
  return res.json();
}

interface NominatimAddress {
  road?: string;
  house_number?: string;
  pedestrian?: string;
  hamlet?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  suburb?: string;
  county?: string;
}

interface NominatimPlace {
  osm_type?: string;
  osm_id?: number;
  place_id?: number;
  name?: string;
  display_name?: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
  extratags?: Record<string, string> | null;
}

/** "pizza;regional" -> "Pizza, Regional". Nominatim's tags are machine-shaped. */
function prettyCuisine(raw: string | undefined): string | null {
  if (!raw) return null;
  const parts = raw
    .split(";")
    .map((part) => part.trim().replace(/_/g, " "))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1));
  const joined = parts.join(", ");
  return joined.length > 80 ? joined.slice(0, 80) : joined || null;
}

function toHit(place: NominatimPlace): PlaceHit | null {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const address = place.address ?? {};
  /**
   * Nominatim spells "the settlement" a different way depending on how big it
   * is, and hands over every level at once. Which one a person would actually
   * name is the largest one that is still a place you drive *to* — the
   * Finsterwirt is in Brixen, not in Kranebitt, even though both are in the
   * answer.
   *
   * Order matters and was got wrong once: `village` first put that restaurant in
   * "Milland", a district of Brixen. `municipality` is last of the real
   * candidates because in South Tyrol it comes back as the valley community
   * ("Eisacktal"), which is not a town at all — only better than nothing.
   */
  const town =
    address.city ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.suburb ??
    address.municipality ??
    address.county ??
    "";

  const street = address.road ?? address.pedestrian ?? null;
  const street_full = street
    ? address.house_number
      ? `${street} ${address.house_number}`
      : street
    : null;

  // A named POI has a name; a bare point on a road only has the long
  // comma-separated description, whose first part is the closest thing to one.
  const name = place.name?.trim() || place.display_name?.split(",")[0]?.trim() || "Unbenannter Ort";

  const website = place.extratags?.website ?? place.extratags?.["contact:website"] ?? null;

  return {
    id: place.osm_type && place.osm_id ? `${place.osm_type}/${place.osm_id}` : String(place.place_id ?? `${lat},${lon}`),
    name: name.slice(0, 120),
    town: town.slice(0, 80),
    address: street_full ? street_full.slice(0, 200) : null,
    cuisine: prettyCuisine(place.extratags?.cuisine),
    website: website && /^https?:\/\//i.test(website) ? website.slice(0, 300) : null,
    lat,
    lon,
    label: place.display_name ?? name,
  };
}

/**
 * Search by name. Results near the HQ come first: this app is about lunch within
 * driving distance, so a Pizzeria Mair in Hamburg is noise. `bounded=0` means
 * the box is a preference and not a wall — a once-a-year outing to the Dolomites
 * still turns up.
 */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const key = `s:${trimmed.toLowerCase()}`;
  const hit = cached(key);
  if (hit) return hit;

  // Roughly 130 km around the HQ — the whole of South Tyrol and a bit over each
  // border, which is every Mai-Ausflug there has ever been.
  const pad = 1.2;
  const viewbox = [HQ.lon - pad * 1.5, HQ.lat + pad, HQ.lon + pad * 1.5, HQ.lat - pad].join(",");

  const payload = await askNominatim("search", {
    q: trimmed,
    limit: "8",
    viewbox,
    // A preference, not a wall — `bounded=1` was measured to change nothing here
    // except to hide the occasional legitimately distant answer.
    bounded: "0",
  });

  const places = Array.isArray(payload) ? (payload as NominatimPlace[]) : [];
  const hits = places.map(toHit).filter((place): place is PlaceHit => place !== null);

  /**
   * Nominatim ranks by its own notion of importance, and the viewbox nudges that
   * far less than one would hope: searching for a pizzeria in Brixen can put two
   * in Lombardy on top. So anything within driving distance is moved ahead of
   * anything that is not, and the order inside each group is left alone — a sort
   * by distance outright would bury an exact match in the Dolomites under a
   * vague one round the corner.
   */
  const NEAR_KM = 150;
  const near = hits.filter((hit) => haversineKm(HQ.lat, HQ.lon, hit.lat, hit.lon) <= NEAR_KM);
  const far = hits.filter((hit) => haversineKm(HQ.lat, HQ.lon, hit.lat, hit.lon) > NEAR_KM);

  return remember(key, [...near, ...far]);
}

/**
 * What is at this pin? Used when somebody skips the search and just taps the
 * spot — the form still wants a town and an address, and asking them to type
 * what the map already knows would be the coordinate fields all over again.
 */
export async function describePoint(lat: number, lon: number): Promise<PlaceHit | null> {
  const key = `r:${lat.toFixed(5)},${lon.toFixed(5)}`;
  const hit = cached(key);
  if (hit) return hit[0] ?? null;

  const payload = await askNominatim("reverse", {
    lat: String(lat),
    lon: String(lon),
    zoom: "18",
  });

  const place =
    payload && typeof payload === "object" && "lat" in payload ? toHit(payload as NominatimPlace) : null;

  // The pin is the truth here, not whatever building Nominatim matched: the
  // member put it where they meant it.
  const pinned = place === null ? null : { ...place, lat, lon };
  remember(key, pinned ? [pinned] : []);
  return pinned;
}
