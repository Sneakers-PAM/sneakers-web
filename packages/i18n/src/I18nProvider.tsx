import type { ReactNode } from "react";

import { IntlProvider } from "react-intl";

import type { Locale } from "#i18n/locale";

import { type Messages, messagesFor } from "#i18n/messages";

/**
 * Locale and catalogue for everything below. The root document mounts it from the loader's
 * locale. `messages` replaces the bundled catalogue, for a test that checks a screen reads its
 * text from the catalogue.
 */
export const I18nProvider = ({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages?: Messages;
}) => (
  <IntlProvider defaultLocale="en" locale={locale} messages={messages ?? messagesFor(locale)}>
    {children}
  </IntlProvider>
);
