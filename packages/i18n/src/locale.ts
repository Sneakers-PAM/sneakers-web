/** The locales that have a message catalogue. English only for now. */
export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/**
 * The locale for a request. This is the one place a later locale choice plugs in (a saved
 * setting, then Accept-Language): the root loader calls it, its answer goes to the server render
 * and then, as loader data, to the client, so all three agree. Today every request gets English,
 * because English is the only catalogue and there is no picker.
 */
export const localeFromRequest = (_request: Request): Locale => DEFAULT_LOCALE;

const RIGHT_TO_LEFT = new Set(["ar", "dv", "fa", "he", "ps", "ur", "yi"]);

/** The text direction a locale is written in: the language part decides it. */
export const directionOf = (locale: string): "ltr" | "rtl" => {
  const language = locale.toLowerCase().split(/[-_]/, 1)[0] ?? "";
  return RIGHT_TO_LEFT.has(language) ? "rtl" : "ltr";
};

/** The `<html>` attributes for a locale. */
export const htmlAttributes = (locale: Locale): { dir: "ltr" | "rtl"; lang: string } => ({
  dir: directionOf(locale),
  lang: locale,
});
