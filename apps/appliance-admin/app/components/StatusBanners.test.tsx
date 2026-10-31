import { screen } from "@testing-library/react";

import { StatusBanners } from "@/components/StatusBanners";
import { applyMockScenario } from "@/mock/edge.mock";
import { renderPage } from "@/test/renderPage";

const onPage = (pathname: string) =>
  renderPage(() => <StatusBanners pathname={pathname} />, pathname);

describe("StatusBanners", () => {
  it("explains a changed certificate on the other pages, with the way to Status", async () => {
    applyMockScenario("tls-changed");
    onPage("/network");
    expect(await screen.findByText(/replaced its own certificate/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Status" })).toHaveAttribute("href", "/home");
  });

  it("leaves a changed certificate to Status on the Status page", async () => {
    applyMockScenario("tls-changed");
    applyMockScenario("network-pending");
    onPage("/home");
    expect(await screen.findByText(/waiting to be kept/)).toBeInTheDocument();
    expect(screen.queryByText(/replaced its own certificate/)).not.toBeInTheDocument();
  });

  it("shows nothing for a box that sends no change", async () => {
    applyMockScenario("network-pending");
    onPage("/updates");
    expect(await screen.findByText(/waiting to be kept/)).toBeInTheDocument();
    expect(screen.queryByText(/certificate/)).not.toBeInTheDocument();
  });
});
