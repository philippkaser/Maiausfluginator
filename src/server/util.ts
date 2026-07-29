import { randomBytes, randomUUID, createHash } from "node:crypto";

export function id(): string {
  return randomUUID();
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Unambiguous alphabet: no 0/O, no 1/I/L - these codes get read out loud. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(groups = 3, groupSize = 4): string {
  const bytes = randomBytes(groups * groupSize);
  let out = "";
  for (let i = 0; i < groups * groupSize; i++) {
    if (i > 0 && i % groupSize === 0) out += "-";
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Turn a display name into a stable, URL-safe login handle. */
export function toHandle(displayName: string): string {
  const map: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss", å: "a", ø: "o", æ: "ae" };
  const base = displayName
    .toLowerCase()
    .replace(/[äöüßåøæ]/g, (c) => map[c] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
  return base || `gast.${randomCode(1, 4).toLowerCase()}`;
}

/** Deterministic accent colour per member, so avatars stay recognisable. */
export function hueFor(seed: string): number {
  const digest = sha256(seed);
  return parseInt(digest.slice(0, 4), 16) % 360;
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function clampInt(value: unknown, min: number, max: number, field: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new HttpError(400, `${field} muss eine Zahl sein`);
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function optionalInt(value: unknown, min: number, max: number, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  return clampInt(value, min, max, field);
}

export function optionalNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new HttpError(400, `${field} muss eine Zahl sein`);
  }
  return n;
}

export function requireString(value: unknown, field: string, max = 200): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${field} fehlt`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) throw new HttpError(400, `${field} ist zu lang (max. ${max} Zeichen)`);
  return trimmed;
}

export function optionalString(value: unknown, field: string, max = 2000): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new HttpError(400, `${field} muss Text sein`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new HttpError(400, `${field} ist zu lang (max. ${max} Zeichen)`);
  return trimmed;
}

/** YYYY-MM-DD. */
export function requireDate(value: unknown, field: string): string {
  const raw = requireString(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new HttpError(400, `${field} muss ein Datum sein (JJJJ-MM-TT)`);
  const parsed = new Date(`${raw}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, `${field} ist kein gültiges Datum`);
  return raw;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new HttpError(400, "Ungültiger Request-Body");
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "Ungültiges JSON");
  }
}
