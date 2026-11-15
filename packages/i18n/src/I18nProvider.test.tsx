import { render, screen } from "@testing-library/react";

import { I18nProvider } from "#i18n/I18nProvider";
import { useFormat, useT } from "#i18n/useT";

const Probe = () => {
  const t = useT();
  const f = useFormat();
  return (
    <>
      <p>{t("gate.notFound.title")}</p>
      <p>{t("gate.offline.status", { retrying: "false", seconds: 12, time: "14:30" })}</p>
      <p>{t("gate.offline.status", { retrying: "true", seconds: 12, time: "14:30" })}</p>
      <p>{f.number(1234.5)}</p>
    </>
  );
};

describe("the provider and useT", () => {
  it("renders catalogue messages with their values, selecting the retry wording", () => {
    render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Tried at 14:30. Next automatic try in 12 s.")).toBeInTheDocument();
    expect(screen.getByText("Tried at 14:30. Trying again now.")).toBeInTheDocument();
    expect(screen.getByText("1,234.5")).toBeInTheDocument();
  });

  it("still gives English with no provider, so an error screen or a bare test renders", () => {
    render(<Probe />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
