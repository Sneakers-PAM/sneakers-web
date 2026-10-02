import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen } from "@testing-library/react";
import { useLoaderData } from "react-router";

import Home from "@/routes/home";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

describe("renderRoute", () => {
  it("renders a page inside the real frame loader, signed in as Alice by default", async () => {
    renderRoute("/", { Component: Home, path: "/" });
    expect(await screen.findByRole("heading", { name: /, Alice$/ })).toBeInTheDocument();
  });

  it("signs in as whoever the test names, and sends the cookie to the page's own loader", async () => {
    const Page = () => <p>{useLoaderData<string>()}</p>;
    renderRoute(
      "/who",
      {
        Component: Page,
        loader: ({ request }) => request.headers.get("Cookie") ?? "",
        path: "/who",
      },
      { user: "mock-user-bob" },
    );
    expect(await screen.findByText(/^mock_sneakers_sid=/)).toBeInTheDocument();
  });

  it("draws a page's error boundary when its loader fails", async () => {
    renderRoute("/broken", {
      Component: () => <p>never drawn</p>,
      ErrorBoundary: () => <p>the page error</p>,
      loader: () => {
        throw new Error("boom");
      },
      path: "/broken",
    });
    expect(await screen.findByText("the page error")).toBeInTheDocument();
  });
});
