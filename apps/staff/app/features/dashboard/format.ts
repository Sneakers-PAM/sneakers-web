import { clockTime } from "@sneakers-web/ui";

const DAY = 86_400_000;

export const greeting = (now = new Date()): string => {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const startOfDay = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** "Today, 09:12", "Yesterday", "Mon 28 Sep" within a fortnight, then "Sep 2026". */
export const lastOpened = (iso: null | string, now = Date.now()): string => {
  if (!iso) return "Not yet";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
  if (days <= 0) return `Today, ${clockTime(t)}`;
  if (days === 1) return "Yesterday";
  if (days < 14)
    return new Date(t)
      .toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" })
      .replace(",", "");
  return new Date(t).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};
