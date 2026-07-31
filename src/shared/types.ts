/** Shared contract between the Bun server and the React client. */

export const DIMENSIONS = ["essen", "service", "ambiente", "preis", "erlebnis"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  essen: "Essen",
  service: "Service",
  ambiente: "Ambiente & Aussicht",
  preis: "Preis-Leistung",
  erlebnis: "Gesamterlebnis",
};

export const DIMENSION_HINTS: Record<Dimension, string> = {
  essen: "Qualität, Portion, Küche",
  service: "Freundlichkeit, Tempo, Aufmerksamkeit",
  ambiente: "Lokal, Terrasse, Panorama",
  preis: "Was war es uns wert?",
  erlebnis: "Der Tag als Ganzes",
};

export interface Me {
  id: string;
  handle: string;
  displayName: string;
  isAdmin: boolean;
  hue: number;
  createdAt: number;
}

export interface Member {
  id: string;
  handle: string;
  displayName: string;
  isAdmin: boolean;
  hue: number;
  createdAt: number;
  ratingCount: number;
  photoCount: number;
  avgGiven: number | null;
}

export interface Restaurant {
  id: string;
  name: string;
  town: string;
  address: string | null;
  cuisine: string | null;
  website: string | null;
  lat: number | null;
  lon: number | null;
  /** Road distance from the Durst Brixen HQ in km. */
  distanceKm: number;
  /** One-way travel time from HQ in minutes. */
  travelMin: number;
  /** How distance/time were determined: "measured" (entered by a human) or "estimated". */
  travelSource: "measured" | "estimated";
  /** Compass bearing from HQ in degrees, 0 = north. Null when coordinates are unknown. */
  bearing: number | null;
}

export interface Rating {
  id: string;
  tripId: string;
  userId: string;
  userName: string;
  userHue: number;
  essen: number;
  service: number;
  ambiente: number;
  preis: number;
  erlebnis: number;
  /** Minutes between ordering and the food arriving. */
  waitMinutes: number | null;
  /**
   * Whether the Durst card was accepted. `null` means nobody tried, which is a
   * different fact from "refused" and has to stay distinguishable.
   */
  cardAccepted: boolean | null;
  comment: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Photo {
  id: string;
  tripId: string;
  userId: string;
  userName: string;
  userHue: number;
  caption: string | null;
  width: number | null;
  height: number | null;
  createdAt: number;
  likes: number;
  likedByMe: boolean;
}

/** Everything needed to score a trip, aggregated server-side. */
export interface TripAggregate {
  ratingCount: number;
  photoCount: number;
  /** Mean per dimension, null when nobody rated it yet. */
  means: Record<Dimension, number | null>;
  /** Median reported wait for the food, in minutes. */
  waitMedian: number | null;
  waitCount: number;
  /** How many people reported the Durst card accepted, and how many refused. */
  cardYes: number;
  cardNo: number;
  distanceKm: number;
  travelMin: number;
}

export interface Trip {
  id: string;
  title: string;
  tripDate: string;
  notes: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  restaurant: Restaurant;
  aggregate: TripAggregate;
  /** The signed-in member's own rating, if they left one. */
  myRating: Rating | null;
  coverPhotoId: string | null;
}

export interface TripDetail extends Trip {
  ratings: Rating[];
  photos: Photo[];
}

export interface Invite {
  code: string;
  note: string | null;
  grantsAdmin: boolean;
  createdAt: number;
  createdByName: string | null;
  usedAt: number | null;
  usedByName: string | null;
}

export interface Award {
  key: string;
  title: string;
  subtitle: string;
  tripId: string | null;
  tripTitle: string | null;
  value: string;
}

export interface Stats {
  tripCount: number;
  memberCount: number;
  ratingCount: number;
  photoCount: number;
  totalKm: number;
  totalTravelMin: number;
  awards: Award[];
}

export interface ApiError {
  error: string;
}
