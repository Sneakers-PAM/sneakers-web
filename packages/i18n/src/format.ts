// Every date, time, relative time, size and number a person reads goes through Intl with the
// page's locale, never a hand-built string or a fixed locale.

type DateInput = Date | number | string;

const toDate = (value: DateInput): Date | undefined => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const formatNumber = (
  value: number,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string => new Intl.NumberFormat(locale, options).format(value);

const HAS_FIELDS = ["day", "era", "month", "weekday", "year"] as const;

/** A date such as "Oct 5, 2026". A caller that names its own fields (`month: "long"`) gets those. */
export const formatDate = (
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = toDate(value);
  if (!date) return "";
  const named = HAS_FIELDS.some((field) => options[field] !== undefined) || options.dateStyle;
  return new Intl.DateTimeFormat(
    locale,
    named ? options : { dateStyle: "medium", ...options },
  ).format(date);
};

/** A clock time such as "14:30", 24-hour. */
export const formatTime = (
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        ...options,
      }).format(date)
    : "";
};

export const formatDateTime = (
  value: DateInput,
  locale: string,
  options: Intl.DateTimeFormatOptions = {},
): string => {
  const date = toDate(value);
  return date
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "short",
        year: "numeric",
        ...options,
      }).format(date)
    : "";
};

const BYTE_UNITS = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte", "petabyte"] as const;

/** A size in bytes as the biggest unit it fills (1024 to a step), such as "1.5 kB". */
export const formatBytes = (bytes: number, locale: string): string => {
  let step = 0;
  let size = Math.max(0, bytes);
  while (size >= 1024 && step < BYTE_UNITS.length - 1) {
    size /= 1024;
    step += 1;
  }
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: step === 0 ? 0 : 1,
    style: "unit",
    unit: BYTE_UNITS[step],
    unitDisplay: step === 0 ? "long" : "short",
  }).format(size);
};

const RELATIVE_STEPS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "5 minutes ago", "in 2 hours", "yesterday": `value` relative to `now`. */
export const formatRelativeTime = (value: DateInput, now: DateInput, locale: string): string => {
  const date = toDate(value);
  const from = toDate(now);
  if (!date || !from) return "";
  let amount = (date.getTime() - from.getTime()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, per] of RELATIVE_STEPS) {
    if (Math.abs(amount) < per) return formatter.format(Math.round(amount), unit);
    amount /= per;
  }
  return "";
};
