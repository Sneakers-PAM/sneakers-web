import { render, screen } from "@testing-library/react";

import { NotAvailable } from "@/components/NotAvailable";

describe("NotAvailable", () => {
  it("names the page and says it isn't built yet", () => {
    render(<NotAvailable name="Updates" />);
    expect(screen.getByText("Updates: not available in this release")).toBeInTheDocument();
  });
});
