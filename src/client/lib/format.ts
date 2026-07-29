const dateFmt = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFmt = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });

const weekdayFmt = new Intl.DateTimeFormat("de-DE", { weekday: "long" });

export function formatDate(isoDate: string): string {
  return dateFmt.format(new Date(`${isoDate}T12:00:00`));
}

export function formatShortDate(isoDate: string): string {
  return shortDateFmt.format(new Date(`${isoDate}T12:00:00`));
}

export function formatWeekday(isoDate: string): string {
  return weekdayFmt.format(new Date(`${isoDate}T12:00:00`));
}

export function formatRelative(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  return dateFmt.format(new Date(timestamp));
}

/** 92 min -> "1 h 32 min" */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Season totals read better as plain hours than as "3 h 58 min". */
export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 1) return `${Math.round(minutes)} min`;
  return `${hours.toFixed(hours < 10 ? 1 : 0).replace(".", ",")} h`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
