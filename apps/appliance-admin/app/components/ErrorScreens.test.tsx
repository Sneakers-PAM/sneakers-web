import { screen } from "@testing-library/react";

import { AccessScreen, ServerErrorScreen } from "@/components/ErrorScreens";
import { renderPage } from "@/test/renderPage";

describe("AccessScreen", () => {
  it("shows a sign-in-again screen for 401", async () => {
    renderPage(() => <AccessScreen status={401} />);
    expect(await screen.findByText("Sign in again")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the start" })).toHaveAttribute("href", "/");
  });

  it("shows a not-allowed screen for 403", async () => {
    renderPage(() => <AccessScreen status={403} />);
    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });
});

describe("ServerErrorScreen", () => {
  it("shows a way back and a reload option", async () => {
    renderPage(ServerErrorScreen);
    expect(await screen.findByText("The box had a problem")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the start" })).toHaveAttribute("href", "/");
  });
});
