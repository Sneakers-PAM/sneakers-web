import { I18nProvider, messagesFor } from "@sneakers-web/i18n";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { NotFoundScreen, NotSetUpScreen, OfflineScreen } from "#shell/gate/Screens";

const french = {
  ...messagesFor("en"),
  "gate.notFound.title": "Rien ici",
  "gate.notSetUp.title": "Pas encore configuré",
  "gate.offline.title": "Serveur injoignable",
};

const renderScreen = (screenElement: React.ReactNode, messages?: typeof french) => {
  const Stub = createRoutesStub([
    {
      Component: () =>
        messages ? (
          <I18nProvider locale="en" messages={messages}>
            {screenElement}
          </I18nProvider>
        ) : (
          screenElement
        ),
      path: "/",
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
};

const inFrench = (screenElement: React.ReactNode) => renderScreen(screenElement, french);

describe("the gate screens read their text from the catalogue", () => {
  it("shows the not-found screen's text from the messages it is given", () => {
    inFrench(<NotFoundScreen />);
    expect(screen.getByRole("heading", { name: "Rien ici" })).toBeInTheDocument();
  });

  it("shows the not-set-up screen's text from the messages it is given", () => {
    inFrench(<NotSetUpScreen />);
    expect(screen.getByRole("heading", { name: "Pas encore configuré" })).toBeInTheDocument();
  });

  it("shows the offline screen's text from the messages it is given", () => {
    inFrench(<OfflineScreen />);
    expect(screen.getByRole("heading", { name: "Serveur injoignable" })).toBeInTheDocument();
  });

  it("says when it tried and when it tries next, in the page's time format", () => {
    renderScreen(<OfflineScreen />);
    expect(
      screen.getByText(/^Tried at \d{2}:\d{2}\. Next automatic try in 20 s\.$/),
    ).toBeInTheDocument();
  });
});
