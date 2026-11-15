import { useContext, useMemo } from "react";
import { createIntl, IntlContext, type IntlShape } from "react-intl";

import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelativeTime,
  formatTime,
} from "#i18n/format";
import { DEFAULT_LOCALE, type Locale } from "#i18n/locale";
import { type MessageId, messagesFor } from "#i18n/messages";

const fallback = createIntl({
  defaultLocale: DEFAULT_LOCALE,
  locale: DEFAULT_LOCALE,
  messages: messagesFor(DEFAULT_LOCALE),
});

/** The intl in scope, or English when nothing provided one (an error screen, a bare test). */
const useIntlOrDefault = (): IntlShape => useContext(IntlContext) ?? fallback;

type Values = Record<string, boolean | Date | null | number | string | undefined>;

/** Looks a message up by id and fills in its values. Ids are checked at build time. */
export const useT = (): ((id: MessageId, values?: Values) => string) => {
  const intl = useIntlOrDefault();
  return useMemo(
    () => (id: MessageId, values?: Values) => intl.formatMessage({ id }, values),
    [intl],
  );
};

/** The Intl formatters bound to the page's locale. */
export const useFormat = () => {
  const locale = useIntlOrDefault().locale as Locale;
  return useMemo(
    () => ({
      bytes: (bytes: number) => formatBytes(bytes, locale),
      date: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, locale, options),
      dateTime: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
        formatDateTime(value, locale, options),
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, locale, options),
      relative: (value: Date | number | string, now: Date | number | string = Date.now()) =>
        formatRelativeTime(value, now, locale),
      time: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
        formatTime(value, locale, options),
    }),
    [locale],
  );
};
