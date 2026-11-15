import type { Locale } from "#i18n/locale";

import en from "#i18n/messages/en.json";

/** Every message id there is. A misspelt id fails to type-check. */
export type MessageId = keyof Messages;

export type Messages = typeof en;

const CATALOGUES: Record<Locale, Messages> = { en };

/** The bundled catalogue for a locale. Bundled, never fetched, so the server render, the strict CSP
 * and hydration all see the same text. */
export const messagesFor = (locale: Locale): Messages => CATALOGUES[locale];
