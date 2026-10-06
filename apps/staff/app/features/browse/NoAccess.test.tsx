import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { NoAccess } from "@/features/browse/NoAccess";

describe("the browse no-access card", () => {
  it("shows the still logo, not the loading animation", () => {
    render(
      <MemoryRouter>
        <NoAccess folder="Finance" owners={[{ name: "Alice" }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /can't open this folder/ })).toBeInTheDocument();
    expect(screen.queryByTitle("Replay")).not.toBeInTheDocument();
  });
});
