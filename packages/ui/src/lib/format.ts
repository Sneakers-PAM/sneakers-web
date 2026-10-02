const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "14:30", 24-hour. */
export const clockTime = (iso: Date | number | string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, minute: "2-digit" });
};

/** "1 secret", "3 secrets". */
export const plural = (n: number, one: string, many = `${one}s`): string => {
  return `${n} ${n === 1 ? one : many}`;
};

/** "12 Oct 2026". */
export const shortDate = (iso: Date | number | string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** "just now", "5 min ago", "3 h ago", "Yesterday", "4 days ago", "Last week", then a date. */
export const timeAgo = (iso: Date | number | string, now: number = Date.now()): string => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const d = now - t;
  if (d < MIN) return "just now";
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
  if (d < 2 * DAY) return "Yesterday";
  if (d < 7 * DAY) return `${Math.floor(d / DAY)} days ago`;
  if (d < 14 * DAY) return "Last week";
  return shortDate(t);
};
