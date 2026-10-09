import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { applyMockScenario } from "@/mock/edge.mock";
import { MOCK_INTERNAL_CA_PEM } from "@/mock/mirror.mock";
import Certificates from "@/routes/certificates";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const SERVER_PIN =
  "5c:e8:21:9b:04:7f:a3:d6:30:bb:18:c2:6e:f4:59:0a:97:2d:e1:4c:83:b6:7a:15:f9:0d:62:c8:3e:a4:51:9f";

const trustCard = async () => {
  renderPage(Certificates);
  return screen.findByRole("region", { name: "Update trust" });
};

describe("The update trust on Certificates", () => {
  it("adds a private CA and a pin, then removes them", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    const card = await trustCard();
    expect(within(card).getByText("System roots only")).toBeInTheDocument();
    expect(within(card).getByText(/no option to skip verification/)).toBeInTheDocument();
    expect(within(card).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(within(card).getByLabelText("CA certificate (PEM)"));
    await user.paste(MOCK_INTERNAL_CA_PEM);
    await user.click(within(card).getByLabelText("Server certificate pin"));
    await user.paste(SERVER_PIN);
    await user.click(within(card).getByRole("button", { name: "Save update trust" }));
    const cas = await within(card).findByRole("list", { name: "Trusted CAs" });
    expect(within(cas).getByText("Example Internal Root CA")).toBeInTheDocument();
    expect(within(cas).getByText(SERVER_PIN.toUpperCase())).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Remove update trust" }));
    expect(await within(card).findByText("System roots only")).toBeInTheDocument();
  });

  it("reads the CA from a PEM file", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    const card = await trustCard();
    await user.upload(
      within(card).getByLabelText("CA certificate file"),
      new File([MOCK_INTERNAL_CA_PEM], "internal-ca.pem", { type: "application/x-pem-file" }),
    );
    expect(await within(card).findByDisplayValue(/MOCK-INTERNAL-ROOT-CA/)).toBeInTheDocument();
  });

  it("refuses a pin that isn't a SHA-256", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    const card = await trustCard();
    await user.type(within(card).getByLabelText("Server certificate pin"), "AB:CD");
    await user.click(within(card).getByRole("button", { name: "Save update trust" }));
    expect(await screen.findByText(/a SHA-256 fingerprint is 64 hex digits/)).toBeInTheDocument();
    expect(within(card).getByText("System roots only")).toBeInTheDocument();
  });

  it("lists the trust for an admin without the form", async () => {
    applyMockScenario("mirror-custom-ca");
    signInAs("bob");
    const card = await trustCard();
    expect(within(card).getByText("Example Internal Root CA")).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Save update trust" }),
    ).not.toBeInTheDocument();
  });
});
