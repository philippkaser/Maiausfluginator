/**
 * Invite-only access, no e-mail and no passwords to forget.
 *
 * An admin hands out an invite code. Redeeming it creates the member and mints
 * a personal key ("Schlüssel") that is shown exactly once - that key plus the
 * handle is how you sign in again on another device. Sessions are opaque random
 * tokens; only their SHA-256 lives in the database.
 */

import { db, now } from "./db.ts";
import {
  HttpError,
  hueFor,
  id,
  normalizeCode,
  randomCode,
  randomToken,
  sha256,
  toHandle,
} from "./util.ts";
import type { Me } from "../shared/types.ts";

export const SESSION_COOKIE = "mai_session";
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface UserRow {
  id: string;
  handle: string;
  display_name: string;
  key_hash: string;
  is_admin: number;
  hue: number;
  created_at: number;
  key_reset_at: number | null;
  key_reset_by: string | null;
}

export function toMe(user: UserRow): Me {
  // Resolved to a name rather than an id, because the point of carrying this to
  // the client is for the member to read "Philipp hat dir einen Schlüssel
  // ausgestellt" in their own account and know whether that was expected.
  const resetBy =
    user.key_reset_by === null
      ? null
      : (db
          .query<{ display_name: string }, [string]>("SELECT display_name FROM users WHERE id = ?")
          .get(user.key_reset_by)?.display_name ?? null);

  return {
    id: user.id,
    handle: user.handle,
    displayName: user.display_name,
    isAdmin: user.is_admin === 1,
    hue: user.hue,
    createdAt: user.created_at,
    keyResetAt: user.key_reset_at ?? null,
    keyResetByName: resetBy,
  };
}

/* ------------------------------------------------------------------ */
/* Brute-force damping                                                  */
/* ------------------------------------------------------------------ */

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export function checkRateLimit(key: string): void {
  const entry = attempts.get(key);
  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((entry.resetAt - Date.now()) / 60000);
    throw new HttpError(429, `Zu viele Versuche. Bitte in ${minutes} Minuten nochmal probieren.`);
  }
}

export function noteFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}

/* ------------------------------------------------------------------ */
/* Sessions                                                             */
/* ------------------------------------------------------------------ */

export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = randomToken();
  const expiresAt = now() + SESSION_TTL_MS;
  db.query(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(sha256(token), userId, now(), expiresAt);
  return { token, expiresAt };
}

export function destroySession(token: string): void {
  db.query("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

function purgeExpiredSessions(): void {
  db.query("DELETE FROM sessions WHERE expires_at < ?").run(now());
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function currentUser(req: Request): UserRow | null {
  const token = readSessionCookie(req);
  if (!token) return null;
  const row = db
    .query<UserRow & { expires_at: number }, [string, number]>(
      `SELECT u.*, s.expires_at FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), now());
  return row ?? null;
}

export function requireUser(req: Request): UserRow {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, "Nicht angemeldet");
  return user;
}

export function requireAdmin(req: Request): UserRow {
  const user = requireUser(req);
  if (user.is_admin !== 1) throw new HttpError(403, "Nur für Admins");
  return user;
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearCookieHeader(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    secure ? "Secure" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Requests arriving through a TLS-terminating proxy still deserve Secure cookies. */
export function isSecureRequest(req: Request): boolean {
  if (process.env.FORCE_SECURE_COOKIES === "1") return true;
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0]!.trim() === "https";
  return new URL(req.url).protocol === "https:";
}

/* ------------------------------------------------------------------ */
/* Members                                                              */
/* ------------------------------------------------------------------ */

function uniqueHandle(displayName: string): string {
  const base = toHandle(displayName);
  let candidate = base;
  let n = 2;
  while (db.query("SELECT 1 FROM users WHERE handle = ?").get(candidate)) {
    candidate = `${base}${n++}`;
  }
  return candidate;
}

export interface RedeemResult {
  user: UserRow;
  personalKey: string;
}

export async function redeemInvite(rawCode: string, displayName: string): Promise<RedeemResult> {
  const code = normalizeCode(rawCode);
  if (!code) throw new HttpError(400, "Einladungscode fehlt");

  const invite = db
    .query<{ code: string; grants_admin: number; used_by: string | null }, [string]>(
      "SELECT code, grants_admin, used_by FROM invites WHERE REPLACE(code, '-', '') = ?",
    )
    .get(code);

  if (!invite) throw new HttpError(403, "Dieser Einladungscode gilt nicht.");
  if (invite.used_by) throw new HttpError(403, "Dieser Einladungscode wurde schon eingelöst.");

  const personalKey = randomCode(4, 4);
  const keyHash = await Bun.password.hash(normalizeCode(personalKey), "argon2id");

  const user: UserRow = {
    id: id(),
    handle: uniqueHandle(displayName),
    display_name: displayName,
    key_hash: keyHash,
    is_admin: invite.grants_admin,
    hue: hueFor(displayName + Math.random()),
    created_at: now(),
    // Their first key is one only they have seen.
    key_reset_at: null,
    key_reset_by: null,
  };

  db.transaction(() => {
    // The user has to exist before the invite can point at them.
    db.query(
      `INSERT INTO users (id, handle, display_name, key_hash, is_admin, hue, created_at)
       VALUES ($id, $handle, $display_name, $key_hash, $is_admin, $hue, $created_at)`,
    ).run({
      id: user.id,
      handle: user.handle,
      display_name: user.display_name,
      key_hash: user.key_hash,
      is_admin: user.is_admin,
      hue: user.hue,
      created_at: user.created_at,
    });

    // Re-check inside the transaction so two people cannot race the same code;
    // a losing race rolls the user insert back with it.
    const claimed = db
      .query("UPDATE invites SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL")
      .run(user.id, now(), invite.code);
    if (claimed.changes === 0) throw new HttpError(403, "Dieser Einladungscode wurde gerade eingelöst.");
  })();

  purgeExpiredSessions();
  return { user, personalKey };
}

export async function login(handleOrName: string, key: string): Promise<UserRow> {
  const handle = toHandle(handleOrName);
  const user = db
    .query<UserRow, [string, string]>("SELECT * FROM users WHERE handle = ? OR lower(display_name) = ?")
    .get(handle, handleOrName.trim().toLowerCase());

  // Constant-ish work either way so a missing handle is not obviously faster.
  const hash = user?.key_hash ?? "$argon2id$v=19$m=65536,t=2,p=1$aaaaaaaaaaaaaaaa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const ok = await Bun.password.verify(normalizeCode(key), hash).catch(() => false);

  if (!user || !ok) throw new HttpError(401, "Name oder Schlüssel stimmt nicht.");
  return user;
}

/**
 * Mint a new key for a member. The old one stops working immediately and so do
 * their sessions — a key that has gone missing may have gone missing into
 * somebody else's pocket, and the caller cannot know.
 *
 * `by` is the admin who did it on someone else's behalf. Rotating your own key
 * clears that mark: from then on the only person who has ever seen this key is
 * you.
 */
export async function rotateKey(userId: string, by: string | null = null): Promise<string> {
  const personalKey = randomCode(4, 4);
  const keyHash = await Bun.password.hash(normalizeCode(personalKey), "argon2id");
  db.query("UPDATE users SET key_hash = ?, key_reset_at = ?, key_reset_by = ? WHERE id = ?").run(
    keyHash,
    by === null ? null : now(),
    by,
    userId,
  );
  db.query("DELETE FROM sessions WHERE user_id = ?").run(userId);
  return personalKey;
}

/**
 * There is nothing to send a reset link to, so a mislaid key is recovered the
 * only way it can be: an admin issues a new one and reads it out. Which makes
 * this the one call in the app that can hand over somebody else's account, so it
 * refuses the two shapes that are mistakes rather than help.
 */
export async function resetKeyForMember(
  targetId: string,
  admin: UserRow,
): Promise<{ personalKey: string; user: UserRow }> {
  if (targetId === admin.id) {
    // Doing it here would drop the admin's own session without setting a new
    // cookie — they would be signed out mid-sheet. Their own account has the
    // button that does this properly.
    throw new HttpError(400, "Deinen eigenen Schlüssel erneuerst du in deinem Konto.");
  }

  const target = db.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?").get(targetId);
  if (!target) throw new HttpError(404, "Dieses Mitglied gibt es nicht.");

  const personalKey = await rotateKey(target.id, admin.id);
  console.log(
    `  Schlüssel für ${target.display_name} (${target.handle}) neu ausgestellt von ${admin.display_name}.`,
  );
  return { personalKey, user: target };
}

/* ------------------------------------------------------------------ */
/* Invites                                                              */
/* ------------------------------------------------------------------ */

export function createInvite(opts: {
  createdBy: string | null;
  note?: string | null;
  grantsAdmin?: boolean;
}): string {
  let code = randomCode();
  while (db.query("SELECT 1 FROM invites WHERE code = ?").get(code)) code = randomCode();

  db.query(
    `INSERT INTO invites (code, note, grants_admin, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(code, opts.note ?? null, opts.grantsAdmin ? 1 : 0, opts.createdBy, now());
  return code;
}

/**
 * First run: nobody exists yet, so print one admin invite to the console. The
 * person who starts the server is the person who gets to be admin.
 */
export function ensureBootstrapInvite(): string | null {
  const userCount = db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM users").get()!.n;
  if (userCount > 0) return null;

  const open = db
    .query<{ code: string }, []>(
      "SELECT code FROM invites WHERE used_by IS NULL AND grants_admin = 1 ORDER BY created_at LIMIT 1",
    )
    .get();
  if (open) return open.code;

  return createInvite({ createdBy: null, note: "Bootstrap – erster Admin", grantsAdmin: true });
}
