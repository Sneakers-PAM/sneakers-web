const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * `now` as ISO 8601 with the US Eastern offset (the UI issue bundle's `t`, and each ring
 * buffer entry's `at`), e.g. "2026-10-06T14:05:09-04:00". The offset reflects the date, so it
 * is -05:00 in winter and -04:00 during daylight time.
 */
export const easternIso = (now: Date): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: "America/New_York",
      year: "numeric",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const offsetMinutes = Math.round((wallClockAsUtc - now.getTime()) / 60_000);
  const sign = offsetMinutes <= 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
};
