import { act, render, screen } from "@testing-library/react";

import { PagesUpdatedBanner } from "@/components/PagesUpdatedBanner";
import { noteServedWebVersion, resetServedWebVersion } from "@/lib/webVersion";

describe("PagesUpdatedBanner", () => {
  afterEach(() => resetServedWebVersion());

  it("says nothing until an answer names other pages than this one", () => {
    render(<PagesUpdatedBanner own="0.1.0" />);
    expect(screen.queryByText(/were updated/)).not.toBeInTheDocument();
    act(() => noteServedWebVersion("0.1.0"));
    expect(screen.queryByText(/were updated/)).not.toBeInTheDocument();
  });

  it("offers a reload once the box serves newer pages", () => {
    render(<PagesUpdatedBanner own="0.1.0" />);
    act(() => noteServedWebVersion("0.1.2"));
    expect(
      screen.getByText("The admin pages were updated to 0.1.2. Reload to use them."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
