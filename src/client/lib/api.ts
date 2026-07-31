import type {
  Invite,
  Me,
  Member,
  Photo,
  Rating,
  Restaurant,
  Stats,
  Trip,
  TripDetail,
} from "../../shared/types.ts";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Keine Verbindung zum Server.");
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Fehler ${res.status}`;
    throw new ApiError(res.status, message);
  }
  return payload as T;
}

const body = (data: unknown) => JSON.stringify(data);

export interface SessionInfo {
  me: Me | null;
  needsBootstrap: boolean;
  hq: { label: string; lat: number; lon: number };
}

export const api = {
  session: () => request<SessionInfo>("/api/session"),
  logout: () => request<{ ok: true }>("/api/session", { method: "DELETE" }),

  redeem: (code: string, displayName: string) =>
    request<{ me: Me; personalKey: string }>("/api/auth/redeem", {
      method: "POST",
      body: body({ code, displayName }),
    }),

  login: (handle: string, key: string) =>
    request<{ me: Me }>("/api/auth/login", { method: "POST", body: body({ handle, key }) }),

  rotateKey: () => request<{ personalKey: string }>("/api/auth/rotate-key", { method: "POST" }),

  trips: () => request<{ trips: Trip[]; stats: Stats }>("/api/trips"),
  trip: (id: string) => request<{ trip: TripDetail }>(`/api/trips/${id}`),

  createTrip: (input: { restaurantId: string; title: string; tripDate: string; notes: string | null }) =>
    request<{ trip: Trip }>("/api/trips", { method: "POST", body: body(input) }),

  updateTrip: (
    id: string,
    input: { restaurantId: string; title: string; tripDate: string; notes: string | null },
  ) => request<{ trip: Trip }>(`/api/trips/${id}`, { method: "PATCH", body: body(input) }),

  deleteTrip: (id: string) => request<{ ok: true }>(`/api/trips/${id}`, { method: "DELETE" }),

  saveRating: (
    tripId: string,
    input: {
      essen: number;
      service: number;
      ambiente: number;
      preis: number;
      erlebnis: number;
      waitMinutes: number | null;
      cardAccepted: boolean | null;
      comment: string | null;
    },
  ) =>
    request<{ rating: Rating; trip: TripDetail }>(`/api/trips/${tripId}/rating`, {
      method: "PUT",
      body: body(input),
    }),

  deleteRating: (tripId: string) =>
    request<{ trip: TripDetail }>(`/api/trips/${tripId}/rating`, { method: "DELETE" }),

  restaurants: () => request<{ restaurants: Restaurant[] }>("/api/restaurants"),

  createRestaurant: (input: Record<string, unknown>) =>
    request<{ restaurant: Restaurant }>("/api/restaurants", { method: "POST", body: body(input) }),

  uploadPhoto: (tripId: string, file: File, caption: string) => {
    const form = new FormData();
    form.append("photo", file);
    if (caption) form.append("caption", caption);
    return request<{ photo: Photo }>(`/api/trips/${tripId}/photos`, { method: "POST", body: form });
  },

  deletePhoto: (photoId: string) =>
    request<{ ok: true }>(`/api/photos/${photoId}`, { method: "DELETE" }),

  likePhoto: (photoId: string) =>
    request<{ likes: number; likedByMe: boolean }>(`/api/photos/${photoId}/like`, { method: "POST" }),

  members: () => request<{ members: Member[] }>("/api/members"),
  stats: () => request<{ stats: Stats }>("/api/stats"),

  invites: () => request<{ invites: Invite[] }>("/api/invites"),
  createInvite: (note: string | null, grantsAdmin: boolean) =>
    request<{ code: string }>("/api/invites", { method: "POST", body: body({ note, grantsAdmin }) }),
  revokeInvite: (code: string) =>
    request<{ ok: true }>(`/api/invites/${encodeURIComponent(code)}`, { method: "DELETE" }),
};

export const photoUrl = (photoId: string) => `/api/photos/${photoId}/file`;
