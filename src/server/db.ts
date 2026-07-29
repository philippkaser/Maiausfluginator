import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const DATA_DIR = resolve(process.env.DATA_DIR ?? "./data");
export const UPLOAD_DIR = resolve(DATA_DIR, "uploads");
const DB_PATH = process.env.DB_PATH ?? resolve(DATA_DIR, "mai.sqlite");

mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(DB_PATH, { create: true, strict: true });

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  handle        TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  hue           INTEGER NOT NULL DEFAULT 200,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  code          TEXT PRIMARY KEY,
  note          TEXT,
  grants_admin  INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL,
  used_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  used_at       INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS restaurants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  town          TEXT NOT NULL,
  address       TEXT,
  cuisine       TEXT,
  website       TEXT,
  lat           REAL,
  lon           REAL,
  distance_km   REAL NOT NULL,
  travel_min    INTEGER NOT NULL,
  travel_source TEXT NOT NULL DEFAULT 'estimated',
  bearing       REAL,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id            TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  trip_date     TEXT NOT NULL,
  notes         TEXT,
  created_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS trips_date ON trips(trip_date DESC);

CREATE TABLE IF NOT EXISTS ratings (
  id            TEXT PRIMARY KEY,
  trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  essen         INTEGER NOT NULL,
  service       INTEGER NOT NULL,
  ambiente      INTEGER NOT NULL,
  preis         INTEGER NOT NULL,
  erlebnis      INTEGER NOT NULL,
  wait_minutes  INTEGER,
  comment       TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  UNIQUE (trip_id, user_id)
);
CREATE INDEX IF NOT EXISTS ratings_trip ON ratings(trip_id);

CREATE TABLE IF NOT EXISTS photos (
  id            TEXT PRIMARY KEY,
  trip_id       TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  mime          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  caption       TEXT,
  width         INTEGER,
  height        INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_trip ON photos(trip_id, created_at);

CREATE TABLE IF NOT EXISTS photo_likes (
  photo_id      TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (photo_id, user_id)
);
`);

export function now(): number {
  return Date.now();
}

/** Wrap a unit of work in a transaction. */
export function tx<T>(fn: () => T): T {
  return db.transaction(fn)();
}
