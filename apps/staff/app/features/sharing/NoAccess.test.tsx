import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

import { NoAccess } from "@/features/sharing/NoAccess";

describe("the sharing no-access card", () => {
  it("shows the still logo, not the loading animation", () => {
    render(
      <MemoryRouter>
        <NoAccess
          data={{
            backTo: "/browse",
            kind: "folder",
            mode: "none",
            ownerNames: ["Alice"],
            title: "Finance",
          }}
          id="folder-1"
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /access to manage this folder/ }),
    ).toBeInTheDocument();
    expect(screen.queryByTitle("Replay")).not.toBeInTheDocument();
  });
});
