import { sessionCookie, withCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import * as page from "@/routes/cli.signed-in";

withMockGateway();

const show = (url: string) => {
  const cookie = sessionCookie("mock-user-alice");
  const Stub = createRoutesStub([
    {
      Component: page.default,
      HydrateFallback: () => null,
      loader: withCookie(cookie, page.loader),
      path: "/cli/signed-in",
    } as never,
  ]);
  return render(<Stub initialEntries={[url]} />);
};

describe("the command-line sign-in confirmation", () => {
  it("says which command signed in, as whom, and that the tab can close", async () => {
    show("/cli/signed-in?client=sneakers-put");
    expect(
      await screen.findByRole("heading", { name: "sneakers-put is signed in" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    expect(screen.getByText(/close this tab/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My tokens" })).toHaveAttribute("href", "/tokens");
  });

  it("names sneakers-run too", async () => {
    show("/cli/signed-in?client=sneakers-run");
    expect(
      await screen.findByRole("heading", { name: "sneakers-run is signed in" }),
    ).toBeInTheDocument();
  });

  it("shows only the commands it knows", async () => {
    show("/cli/signed-in?client=%3Cb%3Eevil%3C%2Fb%3E");
    expect(
      await screen.findByRole("heading", { name: "The command line is signed in" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/evil/)).not.toBeInTheDocument();
  });

  it.each([
    ["denied", "Sign-in denied"],
    ["state", "This sign-in didn't match"],
    ["exchange", "sneakers-put couldn't finish signing in"],
    ["failed", "sneakers-put couldn't sign in"],
    ["anything", "sneakers-put couldn't sign in"],
  ])("explains a failed sign-in (%s) and what to run next", async (reason, title) => {
    show(`/cli/signed-in?client=sneakers-put&reason=${reason}`);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("sneakers-put login")).toBeInTheDocument();
    expect(screen.queryByText(/is signed in/)).not.toBeInTheDocument();
  });
});
