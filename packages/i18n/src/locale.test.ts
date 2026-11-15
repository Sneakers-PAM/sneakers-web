import {
  DEFAULT_LOCALE,
  directionOf,
  htmlAttributes,
  isLocale,
  localeFromRequest,
} from "#i18n/locale";

describe("the locale seam", () => {
  it("defaults to English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it("gives English for any request, since English is the only catalogue and there is no picker", () => {
    expect(localeFromRequest(new Request("https://pam.example.org/"))).toBe("en");
    expect(
      localeFromRequest(
        new Request("https://pam.example.org/", {
          headers: { "Accept-Language": "de-DE,de;q=0.9" },
        }),
      ),
    ).toBe("en");
  });

  it("sets the text direction from the locale, right to left for Arabic and Hebrew", () => {
    expect(directionOf("en")).toBe("ltr");
    expect(directionOf("en-GB")).toBe("ltr");
    expect(directionOf("ar")).toBe("rtl");
    expect(directionOf("he-IL")).toBe("rtl");
  });

  it("gives the page's lang and dir together", () => {
    expect(htmlAttributes("en")).toEqual({ dir: "ltr", lang: "en" });
  });
});
