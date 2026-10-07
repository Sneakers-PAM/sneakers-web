import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { ErrorBoundary } from "@/root";

const stub = (status: number) => {
  const Stub = createRoutesStub([
    {
      ErrorBoundary,
      loader: () => {
        throw new Response("boom", { status });
      },
      path: "/",
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

describe("ErrorBoundary", () => {
  it("shows the sign-in-again page for a 401", async () => {
    stub(401);
    expect(await screen.findByText("Sign in again")).toBeInTheDocument();
  });

  it("shows the not-allowed page for a 403", async () => {
    stub(403);
    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });

  it("shows the box-had-a-problem page for a 500", async () => {
    stub(500);
    expect(await screen.findByText("The box had a problem")).toBeInTheDocument();
  });

  it("still shows the not-found page for a 404", async () => {
    stub(404);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
  });
});
