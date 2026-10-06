/* eslint-disable testing-library/no-container, testing-library/no-node-access -- the mark is decorative, so it has no accessible role to query. */
import { render, screen } from "@testing-library/react";

import { EmptyState } from "#ui/components/Misc";

describe("EmptyState", () => {
  it("shows the still logo, not the loading animation", () => {
    const { container } = render(<EmptyState title="No secrets yet" />);
    expect(screen.queryByTitle("Replay")).not.toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("can leave the logo out", () => {
    const { container } = render(<EmptyState loader={false} title="No secrets yet" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
