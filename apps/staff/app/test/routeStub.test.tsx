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
});
