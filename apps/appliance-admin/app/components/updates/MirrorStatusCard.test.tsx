import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { applyMockScenario } from "@/mock/edge.mock";
import Updates from "@/routes/updates";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const mirrorCard = async () => {
  renderPage(Updates);
  return screen.findByRole("region", { name: "Update mirror" });
};

/** Check now's refusal, in the mirror card. */
const checkRefusal = async (card: HTMLElement): Promise<HTMLElement> => {
  await within(card).findByText("Check now was refused");
  const alert = within(card)
    .getAllByRole("alert")
    .find((element) => element.textContent.startsWith("Check now was refused"));
  if (!alert) throw new Error("Check now's refusal isn't an alert");
  return alert;
};

describe("The update mirror on Updates", () => {
  beforeEach(() => signInAs("alice"));

  it("says a plain HTTP mirror rests on the signature alone", async () => {
    applyMockScenario("mirror-http");
    const card = await mirrorCard();
    expect(within(card).getByText("Plain HTTP")).toBeInTheDocument();
    expect(
      within(card).getByText(/Plain HTTP: integrity from the signature only/),
    ).toBeInTheDocument();
    expect(within(card).queryByText("Issuer")).not.toBeInTheDocument();
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows an HTTPS mirror's certificate from a public CA", async () => {
    applyMockScenario("mirror-https");
    const card = await mirrorCard();
    expect(within(card).getByText("HTTPS")).toBeInTheDocument();
    expect(within(card).getByText("Example Public TLS CA")).toBeInTheDocument();
    expect(within(card).getByText(/days\)/)).toBeInTheDocument();
    expect(within(card).getByText("Not pinned")).toBeInTheDocument();
    expect(within(card).getByText(/Last fetch OK/)).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: "Add a private CA or a pin on Certificates" }),
    ).toHaveAttribute("href", "/certificates#update-trust");
  });

  it("shows a mirror under the update trust's private CA", async () => {
    applyMockScenario("mirror-custom-ca");
    const card = await mirrorCard();
    expect(within(card).getByText(/and the update trust's CA/)).toBeInTheDocument();
    expect(within(card).getByText("Example Internal Issuing CA")).toBeInTheDocument();
    expect(
      within(card).getByRole("link", { name: "Change the update trust on Certificates" }),
    ).toBeInTheDocument();
  });

  it("shows a wrong CA's refusal, on the card and in Check now's answer", async () => {
    applyMockScenario("mirror-wrong-ca");
    const card = await mirrorCard();
    const refusal = await checkRefusal(card);
    expect(refusal).toHaveTextContent("UPGRADE_MIRROR_UNTRUSTED");
    expect(refusal).toHaveTextContent(/isn't trusted/);
    expect(screen.queryByRole("button", { name: /^Fetch/ })).not.toBeInTheDocument();
  });

  it("shows a pin mismatch's refusal", async () => {
    const user = userEvent.setup();
    applyMockScenario("mirror-pin-mismatch");
    const card = await mirrorCard();
    expect(within(card).getByText("Doesn't match")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Check now" }));
    expect(await checkRefusal(card)).toHaveTextContent("UPGRADE_MIRROR_PIN");
  });

  it("takes an http:// mirror as the manual source and says the signature is checked either way", async () => {
    await mirrorCard();
    expect(screen.getByText(/An http:\/\/ or https:\/\/ URL/)).toHaveTextContent(
      "Every file's signature is checked either way.",
    );
  });
});
