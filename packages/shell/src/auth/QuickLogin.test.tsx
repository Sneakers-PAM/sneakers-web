import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { SignInPage } from "#shell/auth/SignInPage";
import { signInAction, signInLoader } from "#shell/server/signIn.server";

withMockGateway();

const Stub = createRoutesStub([
  {
    action: signInAction as never,
    Component: SignInPage,
    HydrateFallback: () => null,
    loader: signInLoader as never,
    path: "/sign-in",
  },
  {
    Component: () => <p>Signed in</p>,
    HydrateFallback: () => null,
    path: "/",
  },
]);

const open = async () => {
  render(<Stub initialEntries={["/sign-in?view=local"]} />);
  await screen.findByRole("heading", { name: /local login/i });
};

describe("the dev quick login on the sign-in page", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sits under the username field in a mock build, marked DEV", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    await open();
    const picker = await screen.findByRole("combobox", { name: "Dev quick login" });
    const username = screen.getByLabelText("Username or email");
    expect(
      username.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Password").compareDocumentPosition(picker) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(screen.getByText("DEV")).toBeInTheDocument();
  });

  it("lists the fixture users and signs in as the one picked", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "true");
    const user = userEvent.setup();
    await open();
    await user.click(await screen.findByRole("combobox", { name: "Dev quick login" }));
    const list = await screen.findByRole("listbox");
    expect(within(list).getByRole("option", { name: /Grace.*recovery role/ })).toBeInTheDocument();
    await user.click(within(list).getByRole("option", { name: /Alice.*site admin/ }));
    expect(await screen.findByText("Signed in")).toBeInTheDocument();
  });

  it("isn't there outside a mock build", async () => {
    vi.stubEnv("SNEAKERS_MOCK", "false");
    await open();
    expect(screen.queryByRole("combobox", { name: "Dev quick login" })).not.toBeInTheDocument();
  });
});
