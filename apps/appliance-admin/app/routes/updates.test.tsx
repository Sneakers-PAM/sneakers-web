import { screen } from "@testing-library/react";

import Updates from "@/routes/updates";
import { renderPage } from "@/test/renderPage";

describe("Updates", () => {
  it("says it isn't available in this release", () => {
    renderPage(Updates);
    expect(screen.getByText("Updates: not available in this release")).toBeInTheDocument();
  });
});
